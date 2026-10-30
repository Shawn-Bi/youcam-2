import asyncio
from jobs import Jobs

def test_session_video_limit_is_shared_and_daily_limit_applies():
    async def run():
        jobs = Jobs()
        assert await jobs.reserve('session', 'video')
        assert not await jobs.reserve('session', 'video')
        for _ in range(4): assert await jobs.reserve('session', 'preview')
        assert not await jobs.reserve('session', 'preview')
        for i in range(25): assert await jobs.reserve(str(i), 'preview')
        assert not await jobs.reserve('another', 'preview')
    asyncio.run(run())

def test_provider_failure_has_safe_error():
    async def run():
        task = {'kind':'preview', 'status':'queued'}
        await Jobs().run(task, '', b'photo', 'https://example.com/item', 'upper_body')
        assert task['status'] == 'failed'
        assert 'error' in task
        assert 'example.com' not in task['error']
    asyncio.run(run())

def test_task_response_hides_internal_fields():
    task = {'status':'success','imageUrl':'https://example.com/result','created':1,'proposal':'internal','version':2}
    assert Jobs.public(task) == {'status':'success','imageUrl':'https://example.com/result'}

def test_successful_clothing_job(monkeypatch):
    import jobs as module
    class FakeYouCam:
        def __init__(self, key, client): pass
        async def upload(self, data, mime):
            assert mime == 'image/png'
            return 'uploaded'
        async def create_cloth(self, source, reference, category):
            assert source == 'uploaded' and category == 'upper_body'
            return 'remote-task'
        async def status(self, endpoint, task_id):
            return {'task_status':'success', 'url':'https://example.com/result.png'}
    monkeypatch.setattr(module, 'YouCam', FakeYouCam)
    async def run():
        task = {'kind':'preview', 'status':'queued'}
        await Jobs().run(task, 'test', b'\x89PNGphoto', 'https://example.com/shirt', 'upper_body')
        assert task['status'] == 'success'
        assert task['imageUrl'] == 'https://example.com/result.png'
    asyncio.run(run())
