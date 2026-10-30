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
