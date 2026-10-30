import asyncio
import json
import httpx
from youcam import YouCam

def test_upload_and_task_keep_token_off_upload_host():
    calls = []
    def handle(request):
        calls.append(request)
        if request.url.path == '/s2s/v2.0/file':
            return httpx.Response(200, json={'files':[{'file_id':'f1','requests':[{'url':'https://upload.example/photo','method':'PUT','headers':{'Content-Type':'image/png'}}]}]})
        if request.url.host == 'upload.example':
            assert 'authorization' not in request.headers
            return httpx.Response(200)
        assert request.headers['authorization'] == 'Bearer secret'
        assert json.loads(request.content)['src_file_id'] == 'f1'
        return httpx.Response(200, json={'status':200, 'data':{'task_id':'t1'}})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            api = YouCam('secret', client)
            file_id = await api.upload(b'photo', 'image/png')
            assert await api.create_cloth(file_id, 'https://example.com/shirt.png', 'upper_body') == 't1'
    asyncio.run(run())
    assert len(calls) == 3
