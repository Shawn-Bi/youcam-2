import asyncio
import json

import httpx
import pytest

from youcam import BAG, CLOTH, VIDEO, YouCam, YouCamError, friendly, sniff

PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 20
JPEG = b'\xff\xd8\xff\xe0' + b'0' * 20


@pytest.mark.parametrize('task_id', [None, '', ' ', 42, 'bad/id'])
def test_invalid_submission_id_remains_ambiguous(task_id):
    with pytest.raises(YouCamError) as caught:
        YouCam.task_id({'data': {'task_id': task_id}})
    assert caught.value.code == 'task_response'


def test_non_object_submission_response_is_ambiguous():
    with pytest.raises(YouCamError) as caught:
        run(lambda request: httpx.Response(200, json=[]), lambda api: api.create_video(source_url='https://example.com/photo'))
    assert caught.value.code == 'task_response'


def run(handler, work):
    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await work(YouCam('secret', client))
    return asyncio.run(go())


def file_handler(calls):
    def handle(request):
        calls.append(request)
        if request.url.path == '/s2s/v2.0/file':
            assert request.headers['authorization'] == 'Bearer secret'
            body = json.loads(request.content)['files'][0]
            assert body['content_type'] in ('image/png', 'image/jpeg') and body['file_size'] > 0
            return httpx.Response(200, json={'status': 200, 'data': {'files': [{'file_id': 'f' + str(len(calls)), 'requests': [
                {'url': 'https://upload.example/object', 'method': 'PUT', 'headers': {'Content-Type': body['content_type'], 'Content-Length': str(body['file_size']), 'Authorization': 'leak'}}]}]}})
        if request.url.host == 'upload.example':
            assert 'authorization' not in request.headers and request.content
            assert request.headers['content-type'] in ('image/png', 'image/jpeg')
            return httpx.Response(200)
        assert request.headers['authorization'] == 'Bearer secret'
        return httpx.Response(200, json={'status': 200, 'data': {'task_id': 'task-1'}})
    return handle


def test_upload_and_cloth_task_use_file_ids_and_keep_the_token_off_the_upload_host():
    calls = []

    async def work(api):
        person = await api.upload(JPEG, 'image/jpeg')
        garment = await api.upload(PNG, 'image/png')
        return person, garment, await api.create_cloth(person, garment, 'outer')

    person, garment, task = run(file_handler(calls), work)
    assert (person, garment, task) == ('f1', 'f3', 'task-1')
    task_request = calls[-1]
    assert task_request.url.path == CLOTH
    assert json.loads(task_request.content) == {'src_file_id': 'f1', 'ref_file_id': 'f3', 'garment_category': 'outer'}
    assert len(calls) == 5


def test_bag_task_sends_the_required_gender_and_rejects_unknown_ones():
    calls = []

    async def work(api):
        task = await api.create_bag('f1', 'f2', 'female')
        with pytest.raises(YouCamError):
            await api.create_bag('f1', 'f2', 'robot')
        return task

    assert run(file_handler(calls), work) == 'task-1'
    assert len(calls) == 1 and calls[0].url.path == BAG
    assert json.loads(calls[0].content) == {'src_file_id': 'f1', 'ref_file_id': 'f2', 'gender': 'female'}


def test_video_uses_a_file_id_or_a_url():
    calls = []

    async def work(api):
        return await api.create_video(source_file_id='f9'), await api.create_video(source_url='https://example.com/result.png')

    assert run(file_handler(calls), work) == ('task-1', 'task-1')
    by_id, by_url = (json.loads(c.content) for c in calls)
    assert calls[0].url.path == VIDEO
    assert by_id == {'src_file_id': 'f9', 'dst_duration': 5, 'resolution': '480', 'model': 'youcam-video-v2', 'prompt': by_id['prompt']}
    assert by_url['src_file_url'] == 'https://example.com/result.png' and 'src_file_id' not in by_url


def test_rejects_unsupported_input_before_calling_youcam():
    def handle(request):
        raise AssertionError('no request expected')

    async def work(api):
        for call in (api.upload(b'x', 'image/gif'), api.create_cloth('a', 'b', 'shoes'), api.status('/other', 't'), api.status(CLOTH, 'a/b')):
            with pytest.raises(YouCamError):
                await call

    run(handle, work)
    with pytest.raises(YouCamError):
        YouCam('', None)


def test_http_errors_carry_codes_and_flag_transient_failures():
    def handle(request):
        if request.url.path.endswith('/busy'):
            return httpx.Response(429, json={'status': 429, 'error': 'Too many requests'})
        return httpx.Response(400, json={'status': 400, 'error_code': 'CreditInsufficiency', 'error': 'No credit'})

    async def work(api):
        with pytest.raises(YouCamError) as busy:
            await api.request('GET', CLOTH + '/busy')
        with pytest.raises(YouCamError) as credit:
            await api.request('POST', CLOTH)
        return busy.value, credit.value

    busy, credit = run(handle, work)
    assert busy.transient and busy.code == 'http_429'
    assert not credit.transient and credit.code == 'CreditInsufficiency'
    assert 'secret' not in str(credit) and 'No credit' not in str(credit)


def test_network_failures_are_transient_and_status_200_envelope_is_checked():
    def broken(request):
        raise httpx.ConnectError('down')

    async def rejected(api):
        with pytest.raises(YouCamError) as error:
            await api.request('GET', CLOTH + '/x')
        return error.value

    assert run(broken, rejected).transient
    envelope = run(lambda request: httpx.Response(200, json={'status': 500}), rejected)
    assert not envelope.transient and envelope.code == 'rejected'


def test_status_returns_the_data_object():
    def handle(request):
        return httpx.Response(200, json={'status': 200, 'data': {'task_status': 'running'}})

    async def work(api):
        return await api.status(CLOTH, 'task-1')

    assert run(handle, work) == {'task_status': 'running'}


def test_download_is_https_only_capped_and_checked_for_image_bytes(monkeypatch):
    seen = []

    def handle(request):
        seen.append(request)
        return httpx.Response(200, content={'/png': PNG, '/text': b'hello', '/big': PNG + b'0' * 100}[request.url.path])

    async def work(api):
        data = await api.download('https://files.example/png')
        for url in ('http://files.example/png', 'https://files.example/text', 'https://files.example/big'):
            with pytest.raises(YouCamError):
                await api.download(url)
        return data

    import youcam
    monkeypatch.setattr(youcam, 'MAX_DOWNLOAD', 50)
    assert run(handle, work) == PNG
    assert all('authorization' not in r.headers for r in seen)


def test_result_url_and_error_code_parsing():
    assert YouCam.result_url({'results': {'url': 'https://r.example/a.png'}}) == 'https://r.example/a.png'
    assert YouCam.result_url({'results': [{'url': 'https://r.example/b.mp4'}]}) == 'https://r.example/b.mp4'
    assert YouCam.result_url({'url': 'https://r.example/c.png'}) == 'https://r.example/c.png'
    assert YouCam.result_url({'results': {'url': 'http://insecure.example/x'}}) is None
    assert YouCam.result_url({'results': None}) is None
    assert YouCam.error_code({'error': 'error_no_face'}) == 'error_no_face'
    assert YouCam.error_code({'error': {'code': 'error_pose'}}) == 'error_pose'
    assert YouCam.error_code({'error': None}) is None


def test_friendly_messages_are_plain_english_and_never_echo_codes():
    assert 'face' in friendly('error_no_face')
    assert friendly('something_new') == friendly(None)
    assert 'error_' not in friendly('error_no_face') and 'unknown' not in friendly('unknown_internal_error')


def test_sniff():
    assert sniff(PNG) == 'image/png' and sniff(JPEG) == 'image/jpeg' and sniff(b'GIF89a') is None
