"""Bounded asynchronous provider jobs for a single-process demo server."""
import asyncio
import time
from collections import Counter
import httpx
from youcam import YouCam, CLOTH, VIDEO, YouCamError

class Jobs:
    def __init__(self):
        self.counts = Counter()
        self.running = set()
        self.lock = asyncio.Lock()

    async def reserve(self, session, kind):
        async with self.lock:
            day = int(time.time() // 86400)
            self.counts = Counter({k:v for k,v in self.counts.items() if k[0] == day})
            key = (day, session, kind)
            daily = (day, 'global', 'all')
            limit = 1 if kind == 'video' else 4
            if self.counts[key] >= limit or self.counts[daily] >= 30:
                return False
            self.counts[key] += 1
            self.counts[daily] += 1
            return True

    def start(self, task, key, photo=None, image_url=None, category=None):
        future = asyncio.create_task(self.run(task, key, photo, image_url, category))
        self.running.add(future)
        future.add_done_callback(self.running.discard)

    async def run(self, task, key, photo, image_url, category):
        task['status'] = 'running'
        try:
            async with asyncio.timeout(180):
                async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
                    api = YouCam(key, client)
                    if task['kind'] == 'preview':
                        mime = 'image/png' if photo.startswith(b'\x89PNG') else 'image/jpeg'
                        source = await api.upload(photo, mime)
                        remote_id = await api.create_cloth(source, image_url, category)
                        endpoint, field = CLOTH, 'imageUrl'
                    else:
                        remote_id = await api.create_video(image_url)
                        endpoint, field = VIDEO, 'videoUrl'
                    while True:
                        result = await api.status(endpoint, remote_id)
                        status = result.get('task_status')
                        if status == 'error':
                            raise YouCamError('Generation failed. Please try another image.')
                        if status == 'success':
                            url = result.get('url') or (result.get('results') or {}).get('url')
                            if not isinstance(url, str) or not url.startswith('https://'):
                                raise YouCamError('Generation returned no usable result.')
                            task.update(status='success', **{field:url})
                            return
                        await asyncio.sleep(2)
        except TimeoutError:
            task.update(status='failed', error='Generation timed out. Please retry later.')
        except (YouCamError, httpx.HTTPError, ValueError, TypeError, KeyError):
            task.update(status='failed', error='Generation failed. Please try again later.')

    @staticmethod
    def public(task):
        return {k:v for k,v in task.items() if k in ('status','imageUrl','videoUrl','error')}
