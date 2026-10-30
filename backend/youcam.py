"""YouCam API transport. Never send the API key to a signed upload URL."""
from urllib.parse import urlparse
import httpx

API_BASE = 'https://yce-api-01.makeupar.com'
CLOTH = '/s2s/v2.0/task/cloth-v4'
VIDEO = '/s2s/v2.0/task/image-to-video/youcam'

class YouCamError(Exception):
    pass

class YouCam:
    def __init__(self, key, client):
        if not key:
            raise YouCamError('YouCam is not configured.')
        self.key, self.client = key, client

    async def request(self, method, path, **kwargs):
        try:
            response = await self.client.request(method, API_BASE + path, headers={'Authorization': 'Bearer ' + self.key}, **kwargs)
            response.raise_for_status()
            result = response.json()
            if result.get('status', 200) != 200:
                raise YouCamError('YouCam rejected the request.')
            return result
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise YouCamError('YouCam request failed.') from exc

    async def upload(self, data, content_type):
        if content_type not in ('image/jpeg', 'image/png'):
            raise YouCamError('Unsupported image type.')
        result = await self.request('POST', '/s2s/v2.0/file', json={'files': [{'file_name': 'photo.jpg' if content_type == 'image/jpeg' else 'photo.png', 'content_type': content_type, 'file_size': len(data)}]})
        try:
            files = result.get('files') or result['data']['files']
            file = files[0]
            upload = file['requests'][0]
            url = urlparse(upload['url'])
            if url.scheme != 'https' or not url.hostname or upload['method'].upper() != 'PUT':
                raise YouCamError('Invalid upload instruction.')
            headers = {str(k): str(v) for k, v in upload.get('headers', {}).items() if k.lower() not in ('authorization', 'host')}
            response = await self.client.put(upload['url'], content=data, headers=headers)
            response.raise_for_status()
            return file['file_id']
        except (KeyError, IndexError, TypeError, httpx.HTTPError, ValueError) as exc:
            raise YouCamError('Image upload failed.') from exc

    async def create_cloth(self, source_file_id, reference_url, category):
        if category not in ('upper_body', 'outer'):
            raise YouCamError('Unsupported garment category.')
        result = await self.request('POST', CLOTH, json={'src_file_id': source_file_id, 'ref_file_url': reference_url, 'garment_category': category})
        return self.task_id(result)

    async def create_video(self, source_url):
        result = await self.request('POST', VIDEO, json={'src_file_url': source_url, 'dst_duration': 5, 'resolution': '480', 'model': 'youcam-video-v2', 'prompt': 'The person turns slowly and smiles, showing the outfit.'})
        return self.task_id(result)

    async def status(self, endpoint, task_id):
        if endpoint not in (CLOTH, VIDEO) or not task_id or '/' in task_id:
            raise YouCamError('Invalid task.')
        result = await self.request('GET', endpoint + '/' + task_id)
        return result.get('data', {})

    @staticmethod
    def task_id(result):
        try:
            return result['data']['task_id']
        except (KeyError, TypeError) as exc:
            raise YouCamError('YouCam returned an invalid task.') from exc
