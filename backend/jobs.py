"""Bounded asynchronous provider jobs for a single-process demo server."""
import asyncio
import logging
import time
import uuid
from collections import Counter
import httpx
from config import int_env
from youcam import YouCam, BAG, CLOTH, VIDEO, YouCamError, sniff, friendly

log = logging.getLogger('look-exchange')
# httpx logs every request URL at INFO, which would put YouCam's signed URLs and task ids in the server log.
for noisy in ('httpx', 'httpcore'):
    logging.getLogger(noisy).setLevel(logging.WARNING)
POLL_SECONDS = 3
# Seconds to wait for YouCam. A video once took over five minutes, and YouCam still finished and charged for it
# after we had given up, so these are generous: giving up early costs units and shows the shopper a false failure.
DEADLINES = {'preview': 180, 'video': 900}


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

    async def run(self, task, key, photo=None, reference=None, category=None, source_url=None, gender=None, session=None):
        """`category` is upper_body or outer for clothes try-on, or bag for bag try-on (which needs `gender`)."""
        task['status'] = 'running'
        task.setdefault('started', time.monotonic())
        task.setdefault('trace', uuid.uuid4().hex)
        task.setdefault('timing_marks', {})
        if session is not None:
            task['reservation_session'] = session
        submitting = False
        try:
            async with asyncio.timeout(DEADLINES[task['kind']]):
                async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
                    api = YouCam(key, client)
                    if task.get('remote_id'):
                        remote_id, endpoint = task['remote_id'], task['endpoint']
                        field = 'imageUrl' if task['kind'] == 'preview' else 'videoUrl'
                    elif task['kind'] == 'preview':
                        self.mark(task, 'uploading')
                        source = await api.upload(photo, sniff(photo) or 'image/jpeg')
                        garment = await api.upload(reference, sniff(reference) or 'image/png')
                        self.mark(task, 'submitting')
                        submitting = True
                        if category == 'bag':
                            remote_id, endpoint = await api.create_bag(source, garment, gender), BAG
                        else:
                            remote_id, endpoint = await api.create_cloth(source, garment, category), CLOTH
                        field = 'imageUrl'
                    else:
                        self.mark(task, 'preparing')
                        source = await self.video_source(api, source_url, lambda phase: self.mark(task, phase))
                        self.mark(task, 'submitting')
                        submitting = True
                        remote_id = await api.create_video(**source)
                        endpoint, field = VIDEO, 'videoUrl'
                    task.update(remote_id=remote_id, endpoint=endpoint)
                    submitting = False
                    self.mark(task, 'generating')
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
                            self.fail(task, session, friendly(code), code or 'task_error')
                            return
                        if state == 'success':
                            url = api.result_url(data)
                            if not url:
                                raise YouCamError('The try-on service returned nothing usable. Please try again.', code='no_result')
                            task.update(status='success', **{field: url})
                            task.pop('error', None)
                            self.mark(task, 'complete')
                            return
                        await asyncio.sleep(POLL_SECONDS)
        except TimeoutError:
            if task.get('remote_id') or submitting:
                self.uncertain(task)
            else:
                self.fail(task, session, 'Image preparation timed out. Please try again.', 'timeout')
        except YouCamError as exc:
            if task.get('remote_id') or (submitting and (exc.transient or exc.code in ('network', 'upload_response', 'task_response'))):
                self.uncertain(task)
            else:
                self.fail(task, session, str(exc), exc.code)
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            if submitting or task.get('remote_id'):
                self.uncertain(task)
            else:
                self.fail(task, session, friendly(None), 'unexpected')

    @staticmethod
    async def video_source(api, source_url, mark=lambda phase: None):
        """YouCam reads the try-on result from our upload, which does not depend on its signed URL being public."""
        try:
            mark('downloading')
            image = await api.download(source_url)
            mark('uploading')
            return {'source_file_id': await api.upload(image, sniff(image))}
        except YouCamError as exc:
            log.warning('video source upload failed (%s); falling back to the result URL', exc.code)
            return {'source_url': source_url}

    @staticmethod
    def mark(task, phase):
        task.setdefault('started', time.monotonic())
        task.setdefault('trace', uuid.uuid4().hex)
        task.setdefault('timing_marks', {})
        task['phase'] = phase
        elapsed = round((time.monotonic() - task['started']) * 1000)
        previous = max(task['timing_marks'].values(), default=0)
        task['timing_marks'][phase] = elapsed
        if phase in ('complete', 'failed'):
            task['finished_elapsed'] = elapsed / 1000
        log.info('generation trace=%s kind=%s phase=%s elapsed_ms=%s phase_ms=%s',
                 task['trace'], task['kind'], phase, elapsed, elapsed - previous)

    def uncertain(self, task):
        task.update(status='uncertain', error='Completion is not confirmed. Check this task again; do not start another generation.')
        self.mark(task, 'unconfirmed')

    def recheck(self, task, key):
        """Resume status reads only. A missing provider ID never triggers a new submission."""
        if task['status'] == 'uncertain' and task.get('remote_id') and key:
            task['status'] = 'running'
            self.start(task, key, session=task.get('reservation_session'))

    def fail(self, task, session, message, code, release=True):
        """Mark a task failed. Its slot is given back unless YouCam might still charge for it."""
        log.warning('%s failed: %s', task['kind'], code)
        task.update(status='failed', error=message)
        self.mark(task, 'failed')
        if session is not None and release:
            self.release(session, task['kind'])

    @staticmethod
    def public(task):
        result = {k: v for k, v in task.items() if k in ('status', 'imageUrl', 'videoUrl', 'error', 'phase')}
        if 'started' in task:
            elapsed = task.get('finished_elapsed', time.monotonic() - task['started'])
            result['elapsedSeconds'] = round(elapsed)
        return result
