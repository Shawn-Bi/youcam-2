import asyncio
import json
import types

import httpx
import pytest

import jobs as module
from jobs import Jobs
from youcam import BAG, CLOTH, VIDEO, YouCamError

PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 20
JPEG = b'\xff\xd8\xff\xe0' + b'0' * 20


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def quick_polls(monkeypatch):
    monkeypatch.setattr(module, 'POLL_SECONDS', 0)


class FakeYouCam:
    """Stands in for the transport. `script` is the list of status payloads returned in order."""
    script = []
    calls = []
    fail_download = False

    def __init__(self, key, client):
        self.key = key

    async def upload(self, data, mime):
        self.calls.append(('upload', mime))
        return f'file-{len(self.calls)}'

    async def download(self, url):
        self.calls.append(('download', url))
        if self.fail_download:
            raise YouCamError('x', code='download_failed')
        return PNG

    async def create_cloth(self, source, garment, category):
        self.calls.append(('cloth', source, garment, category))
        return 'remote-1'

    async def create_bag(self, source, garment, gender):
        self.calls.append(('bag', source, garment, gender))
        return 'remote-3'

    async def create_video(self, source_file_id=None, source_url=None):
        self.calls.append(('video', source_file_id, source_url))
        return 'remote-2'

    async def status(self, endpoint, task_id):
        self.calls.append(('status', endpoint, task_id))
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        return step

    error_code = staticmethod(module.YouCam.error_code)
    result_url = staticmethod(module.YouCam.result_url)


@pytest.fixture
def fake(monkeypatch):
    class Fake(FakeYouCam):
        script, calls = [], []
        fail_download = False
    monkeypatch.setattr(module, 'YouCam', Fake)
    return Fake


def preview_task():
    return {'kind': 'preview', 'status': 'queued'}


def test_limits_count_running_and_successful_tasks_only():
    async def go():
        jobs = Jobs()
        jobs.session_limit['video'] = 1
        assert await jobs.reserve('s', 'video')
        assert not await jobs.reserve('s', 'video')
        for _ in range(jobs.session_limit['preview']):
            assert await jobs.reserve('s', 'preview')
        assert not await jobs.reserve('s', 'preview')
        jobs.release('s', 'preview')
        assert await jobs.reserve('s', 'preview')
    run(go())


def test_attempts_bound_retries_even_when_every_task_fails():
    async def go():
        jobs = Jobs()
        for _ in range(jobs.attempt_limit['preview']):
            assert await jobs.reserve('s', 'preview')
            jobs.release('s', 'preview')
        assert not await jobs.reserve('s', 'preview')
        assert await jobs.reserve('other', 'preview')
    run(go())


def test_daily_and_video_caps_are_global(monkeypatch):
    monkeypatch.setenv('DAILY_TASK_LIMIT', '3')
    monkeypatch.setenv('DAILY_VIDEO_LIMIT', '1')

    async def go():
        jobs = Jobs()
        assert await jobs.reserve('a', 'video')
        assert not await jobs.reserve('b', 'video')
        assert await jobs.reserve('b', 'preview') and await jobs.reserve('c', 'preview')
        assert not await jobs.reserve('d', 'preview')
        jobs.release('a', 'video')
        assert await jobs.reserve('d', 'preview')
    run(go())


def test_limits_reset_each_utc_day(monkeypatch):
    async def go():
        jobs = Jobs()
        jobs.session_limit['video'] = 1
        assert await jobs.reserve('s', 'video') and not await jobs.reserve('s', 'video')
        monkeypatch.setattr(jobs, 'day', lambda: 99999)
        assert await jobs.reserve('s', 'video')
    run(go())


def test_successful_preview_uploads_both_images_and_returns_the_result(fake):
    fake.script = [{'task_status': 'running'}, {'task_status': 'success', 'results': {'url': 'https://r.example/p.png'}}]
    task = preview_task()
    run(Jobs().run(task, 'key', photo=JPEG, reference=PNG, category='outer'))
    assert task['status'] == 'success' and task['imageUrl'] == 'https://r.example/p.png'
    assert fake.calls[:3] == [('upload', 'image/jpeg'), ('upload', 'image/png'), ('cloth', 'file-1', 'file-2', 'outer')]
    assert [c[:2] for c in fake.calls[3:]] == [('status', CLOTH)] * 2


def test_bag_preview_uses_the_bag_endpoint_with_a_gender(fake):
    fake.script = [{'task_status': 'success', 'results': {'url': 'https://r.example/bag.jpg'}}]
    task = preview_task()
    run(Jobs().run(task, 'key', photo=JPEG, reference=PNG, category='bag', gender='male'))
    assert task['status'] == 'success' and task['imageUrl'] == 'https://r.example/bag.jpg'
    assert ('bag', 'file-1', 'file-2', 'male') in fake.calls and not any(c[0] == 'cloth' for c in fake.calls)
    assert [c[:2] for c in fake.calls if c[0] == 'status'] == [('status', BAG)]


def test_youcam_rejection_becomes_a_friendly_message_and_frees_the_slot(fake):
    fake.script = [{'task_status': 'error', 'error': 'error_no_face', 'error_message': 'internal detail'}]

    async def go():
        jobs = Jobs()
        assert await jobs.reserve('s', 'preview')
        task = preview_task()
        await jobs.run(task, 'key', photo=JPEG, reference=PNG, category='upper_body', session='s')
        return jobs, task

    jobs, task = run(go())
    assert task['status'] == 'failed' and 'face' in task['error'] and 'internal detail' not in task['error']
    assert jobs.counts[(jobs.day(), 's', 'preview')] == 0
    assert jobs.counts[(jobs.day(), 's', 'preview', 'attempts')] == 1


def test_transient_status_errors_keep_polling(fake):
    fake.script = [YouCamError('busy', code='http_429', transient=True), {'task_status': 'success', 'results': {'url': 'https://r.example/p.png'}}]
    task = preview_task()
    run(Jobs().run(task, 'key', photo=PNG, reference=PNG, category='upper_body'))
    assert task['status'] == 'success'


def test_status_auth_errors_do_not_claim_the_provider_task_failed(fake):
    fake.script = [YouCamError('nope', code='http_401')]
    task = preview_task()
    run(Jobs().run(task, 'key', photo=PNG, reference=PNG, category='upper_body'))
    assert task['status'] == 'uncertain' and task['remote_id'] == 'remote-1'


def test_success_without_a_usable_url_fails(fake):
    fake.script = [{'task_status': 'success', 'results': {}}]
    task = preview_task()
    run(Jobs().run(task, 'key', photo=PNG, reference=PNG, category='upper_body'))
    assert task['status'] == 'uncertain' and 'imageUrl' not in task


def test_a_job_that_never_finishes_times_out_but_keeps_its_slot_because_youcam_may_still_charge(fake, monkeypatch):
    monkeypatch.setitem(module.DEADLINES, 'preview', 0.05)
    monkeypatch.setattr(module, 'POLL_SECONDS', 0.01)
    fake.script = [{'task_status': 'running'}] * 1000

    async def go():
        jobs = Jobs()
        await jobs.reserve('s', 'preview')
        task = preview_task()
        await jobs.run(task, 'key', photo=PNG, reference=PNG, category='upper_body', session='s')
        return jobs, task

    jobs, task = run(go())
    assert task['status'] == 'uncertain' and 'not confirmed' in task['error']
    assert jobs.counts[(jobs.day(), 's', 'preview')] == 1  # still counted: a retry must not look free


def test_deadlines_are_generous_enough_for_a_slow_video():
    assert module.DEADLINES['video'] >= 900 and module.DEADLINES['preview'] >= 180


def test_unexpected_transport_errors_are_hidden_from_shoppers(fake):
    fake.script = [KeyError('secret-detail')]
    task = preview_task()
    run(Jobs().run(task, 'key', photo=PNG, reference=PNG, category='upper_body'))
    assert task['status'] == 'uncertain' and 'secret-detail' not in task['error']


def test_video_is_made_from_an_upload_of_the_try_on_result(fake):
    fake.script = [{'task_status': 'success', 'results': {'url': 'https://r.example/v.mp4'}}]
    task = {'kind': 'video', 'status': 'queued'}
    run(Jobs().run(task, 'key', source_url='https://r.example/p.png'))
    assert task['status'] == 'success' and task['videoUrl'] == 'https://r.example/v.mp4'
    assert fake.calls[:3] == [('download', 'https://r.example/p.png'), ('upload', 'image/png'), ('video', 'file-2', None)]
    assert fake.calls[3][:2] == ('status', VIDEO)


def test_video_falls_back_to_the_result_url_when_the_download_fails(fake):
    fake.fail_download = True
    fake.script = [{'task_status': 'success', 'results': {'url': 'https://r.example/v.mp4'}}]
    task = {'kind': 'video', 'status': 'queued'}
    run(Jobs().run(task, 'key', source_url='https://r.example/p.png'))
    assert task['status'] == 'success' and ('video', None, 'https://r.example/p.png') in fake.calls


def test_uncertain_video_submission_is_never_submitted_twice(fake, monkeypatch):
    async def ambiguous(self, **source):
        self.calls.append(('accepted_without_response',))
        raise YouCamError('network', code='network', transient=True)
    monkeypatch.setattr(fake, 'create_video', ambiguous)
    task = {'kind': 'video', 'status': 'queued'}
    jobs = Jobs()
    run(jobs.run(task, 'key', source_url='https://r.example/signed-secret'))
    assert fake.calls.count(('accepted_without_response',)) == 1
    assert task['status'] == 'uncertain' and 'remote_id' not in task
    jobs.recheck(task, 'key')
    assert task['status'] == 'uncertain'


def test_timed_out_job_can_finish_by_reading_the_same_provider_task(fake, monkeypatch):
    task = {'kind': 'video', 'status': 'queued', 'remote_id': 'existing-task', 'endpoint': VIDEO}
    fake.script = [{'task_status': 'success', 'results': {'url': 'https://r.example/v.mp4'}}]
    run(Jobs().run(task, 'key'))
    assert task['status'] == 'success'
    assert fake.calls == [('status', VIDEO, 'existing-task')]


def test_phase_timings_do_not_log_photos_keys_or_signed_urls(fake, caplog):
    fake.script = [{'task_status': 'success', 'results': {'url': 'https://r.example/private-result'}}]
    with caplog.at_level('INFO', logger='look-exchange'):
        task = {'kind': 'video', 'status': 'queued'}
        run(Jobs().run(task, 'private-key', source_url='https://r.example/private-source'))
    assert 'phase=preparing' in caplog.text and 'phase=complete' in caplog.text
    assert 'elapsed_ms=' in caplog.text
    assert 'private-key' not in caplog.text and 'https://' not in caplog.text
    assert 'remote_id' not in Jobs.public(task) and 'trace' not in Jobs.public(task)


def test_request_urls_are_not_logged(caplog):
    """YouCam's signed upload/download URLs and task ids must never reach the server log."""
    import logging
    logging.basicConfig(level=logging.INFO)
    assert logging.getLogger('httpx').getEffectiveLevel() >= logging.WARNING
    assert logging.getLogger('httpcore').getEffectiveLevel() >= logging.WARNING


def test_task_response_hides_internal_fields():
    task = {'status': 'success', 'imageUrl': 'https://r.example/a', 'created': 1, 'touched': 2, 'proposal': 'internal', 'item': 'x'}
    assert Jobs.public(task) == {'status': 'success', 'imageUrl': 'https://r.example/a'}


def test_missing_key_fails_cleanly():
    task = preview_task()
    run(Jobs().run(task, '', photo=PNG, reference=PNG, category='upper_body'))
    assert task['status'] == 'failed' and 'configured' in task['error']


def simulated_youcam(seen):
    """An HTTP-level stand-in for YouCam that follows the documented request and response shapes."""
    polls = {}

    def handle(request):
        seen.append((request.method, request.url.host, request.url.path))
        if request.url.host == 'upload.example':
            assert 'authorization' not in request.headers
            return httpx.Response(200)
        if request.url.host == 'results.example':
            assert 'authorization' not in request.headers
            return httpx.Response(200, content=PNG)
        assert request.headers['authorization'] == 'Bearer real-key'
        path = request.url.path
        if path == '/s2s/v2.0/file':
            name = json.loads(request.content)['files'][0]['file_name']
            return httpx.Response(200, json={'status': 200, 'data': {'files': [{'file_id': 'id-' + name, 'requests': [{'method': 'PUT', 'url': 'https://upload.example/x', 'headers': {'Content-Type': 'image/png'}}]}]}})
        if request.method == 'POST' and path == CLOTH:
            assert json.loads(request.content)['garment_category'] == 'upper_body'
            return httpx.Response(200, json={'status': 200, 'data': {'task_id': 'cloth-task'}})
        if request.method == 'POST' and path == VIDEO:
            assert json.loads(request.content)['src_file_id'].startswith('id-')
            return httpx.Response(200, json={'status': 200, 'data': {'task_id': 'video-task'}})
        polls[path] = polls.get(path, 0) + 1
        if polls[path] < 2:
            return httpx.Response(200, json={'status': 200, 'data': {'task_status': 'running', 'error': None, 'results': None}})
        url = 'https://results.example/out.png' if path.endswith('cloth-task') else 'https://results.example/out.mp4'
        return httpx.Response(200, json={'status': 200, 'data': {'task_status': 'success', 'error': None, 'results': {'url': url}}})

    return handle


def test_preview_then_video_through_the_real_transport_against_simulated_youcam(monkeypatch):
    seen = []
    real = httpx.AsyncClient
    transport = httpx.MockTransport(simulated_youcam(seen))
    monkeypatch.setattr(module, 'httpx', types.SimpleNamespace(AsyncClient=lambda **kw: real(transport=transport, **kw), HTTPError=httpx.HTTPError))

    preview = preview_task()
    run(Jobs().run(preview, 'real-key', photo=JPEG, reference=PNG, category='upper_body'))
    assert preview['status'] == 'success' and preview['imageUrl'] == 'https://results.example/out.png'

    video = {'kind': 'video', 'status': 'queued'}
    run(Jobs().run(video, 'real-key', source_url=preview['imageUrl']))
    assert video['status'] == 'success' and video['videoUrl'] == 'https://results.example/out.mp4'
    hosts = [host for _, host, _ in seen]
    assert hosts.count('upload.example') == 3 and hosts.count('results.example') == 1
