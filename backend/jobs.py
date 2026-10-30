"""Bounded asynchronous provider jobs for a single-process demo server."""
import asyncio
import logging
import time
from collections import Counter
import httpx
from config import int_env
from youcam import YouCam, CLOTH, VIDEO, YouCamError, sniff, friendly

log = logging.getLogger('look-exchange')
POLL_SECONDS = 3
DEADLINES = {'preview': 120, 'video': 300}


class Jobs:
    """Counts only tasks that are running or succeeded: YouCam charges units for successes alone.

    A failed task is released so the shopper can retry, while `attempts` still bounds retries.
    """

    def __init__(self):
        self.counts = Counter()
        self.running = set()
        self.lock = asyncio.Lock()
        self.session_limit = {'preview': int_env('SESSION_PREVIEW_LIMIT', 6), 'video': int_env('SESSION_VIDEO_LIMIT', 2)}
        self.attempt_limit = {'preview': int_env('SESSION_PREVIEW_ATTEMPTS', 12), 'video': int_env('SESSION_VIDEO_ATTEMPTS', 4)}
        self.daily_limit = int_env('DAILY_TASK_LIMIT', 40)
        self.daily_video_limit = int_env('DAILY_VIDEO_LIMIT', 10)
        self.daily_attempts = int_env('DAILY_ATTEMPT_LIMIT', 150)

    def day(self):
        return int(time.time() // 86400)

    async def reserve(self, session, kind):
        async with self.lock:
            day = self.day()
            self.counts = Counter({k: v for k, v in self.counts.items() if k[0] == day})
            used, tries = self.counts[(day, session, kind)], self.counts[(day, session, kind, 'attempts')]
            if used >= self.session_limit[kind] or tries >= self.attempt_limit[kind]:
                return False
            if self.counts[(day, 'global', 'all')] >= self.daily_limit or self.counts[(day, 'global', 'attempts')] >= self.daily_attempts:
                return False
            if kind == 'video' and self.counts[(day, 'global', 'video')] >= self.daily_video_limit:
                return False
            for key in ((day, session, kind), (day, 'global', 'all')) + (((day, 'global', 'video'),) if kind == 'video' else ()):
                self.counts[key] += 1
            self.counts[(day, session, kind, 'attempts')] += 1
            self.counts[(day, 'global', 'attempts')] += 1
            return True

    def release(self, session, kind):
        """Give back the slot of a task that failed, so it was never charged."""
        day = self.day()
        for key in ((day, session, kind), (day, 'global', 'all')) + (((day, 'global', 'video'),) if kind == 'video' else ()):
            if self.counts[key] > 0:
                self.counts[key] -= 1

    def start(self, task, key, session=None, **inputs):
        future = asyncio.create_task(self.run(task, key, session=session, **inputs))
        self.running.add(future)
        future.add_done_callback(self.running.discard)

    async def run(self, task, key, photo=None, reference=None, category=None, source_url=None, session=None):
        task['status'] = 'running'
        try:
            async with asyncio.timeout(DEADLINES[task['kind']]):
                async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
                    api = YouCam(key, client)
                    if task['kind'] == 'preview':
                        source = await api.upload(photo, sniff(photo) or 'image/jpeg')
                        garment = await api.upload(reference, sniff(reference) or 'image/png')
                        remote_id = await api.create_cloth(source, garment, category)
                        endpoint, field = CLOTH, 'imageUrl'
                    else:
                        remote_id = await self.create_video(api, source_url)
                        endpoint, field = VIDEO, 'videoUrl'
                    while True:
                        try:
                            data = await api.status(endpoint, remote_id)
                        except YouCamError as exc:
                            if not exc.transient:
                                raise
                            data = {}
                        state = data.get('task_status')
                        if state == 'error':
                            code = api.error_code(data)
                            raise YouCamError(friendly(code), code=code or 'task_error')
                        if state == 'success':
                            url = api.result_url(data)
                            if not url:
                                raise YouCamError('The try-on service returned nothing usable. Please try again.', code='no_result')
                            task.update(status='success', **{field: url})
                            return
                        await asyncio.sleep(POLL_SECONDS)
        except TimeoutError:
            self.fail(task, session, 'Generation timed out. Please try again.', 'timeout')
        except YouCamError as exc:
            self.fail(task, session, str(exc), exc.code)
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            self.fail(task, session, friendly(None), 'unexpected')

    @staticmethod
    async def create_video(api, source_url):
        """YouCam reads the try-on result from our upload, which does not depend on its signed URL being public."""
        try:
            image = await api.download(source_url)
            return await api.create_video(source_file_id=await api.upload(image, sniff(image)))
        except YouCamError as exc:
            log.warning('video source upload failed (%s); falling back to the result URL', exc.code)
            return await api.create_video(source_url=source_url)

    def fail(self, task, session, message, code):
        log.warning('%s failed: %s', task['kind'], code)
        task.update(status='failed', error=message)
        if session is not None:
            self.release(session, task['kind'])

    @staticmethod
    def public(task):
        return {k: v for k, v in task.items() if k in ('status', 'imageUrl', 'videoUrl', 'error')}
