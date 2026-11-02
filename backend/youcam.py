"""YouCam API transport. Never send the API key to a signed upload or download URL."""
from urllib.parse import urlparse
import httpx

API_BASE = 'https://yce-api-01.makeupar.com'
CLOTH = '/s2s/v2.0/task/cloth-v4'
BAG = '/s2s/v2.0/task/bag'
VIDEO = '/s2s/v2.0/task/image-to-video/youcam'
GENDERS = ('female', 'male')  # bag try-on requires one; YouCam rejects anything else
MAX_DOWNLOAD = 15_000_000
VIDEO_PROMPT = 'The person turns slowly and smiles, showing the outfit.'
TRANSIENT = (429, 500, 502, 503, 504)

# What shoppers read when YouCam rejects a task. Keys are YouCam's error codes.
FRIENDLY = {
    'error_no_face': 'We could not find your face. Use a front-facing photo with your face fully visible.',
    'error_pose': 'We could not read your pose. Use a standing, front-facing photo.',
    'error_face_parsing': 'We could not read your face. Use a clear, front-facing photo.',
    'error_no_shoulder': 'Your shoulders need to be visible. Try a photo that shows them.',
    'error_large_face_angle': 'Face the camera straight on and try again.',
    'error_multi_person': 'Use a photo with only you in it.',
    'error_multiple_people': 'Use a photo with only you in it.',
    'error_nsfw_content_detected': 'The try-on service flagged this result. Try a different photo.',
    'exceed_nsfw_retry_limits': 'The try-on service flagged this result. Try a different photo.',
    'error_below_min_image_size': 'That photo is too small. Use a larger one.',
    'error_unsupport_ratio': 'That photo has an unusual shape. Use a standard portrait photo.',
    'exceed_max_filesize': 'That photo is too large. Use one under 10 MB.',
    'error_invalid_ref': 'This item cannot be tried on automatically. Try a different item.',
    'error_apply_region_mismatch': 'This item cannot be tried on automatically. Try a different item.',
}
GENERIC = 'The try-on service could not finish this one. Please try again.'


class YouCamError(Exception):
    """`str(error)` is safe to show shoppers. `code` is YouCam's own code, for logs only."""

    def __init__(self, message, code=None, transient=False):
        super().__init__(message)
        self.code, self.transient = code, transient


def friendly(code):
    return FRIENDLY.get(code, GENERIC)


def sniff(data):
    """MIME type of image bytes, or None."""
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    return None


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
        except httpx.HTTPStatusError as exc:
            code = None
            try:
                code = exc.response.json().get('error_code')
            except (ValueError, AttributeError):
                pass
            raise YouCamError(GENERIC, code=code or f'http_{exc.response.status_code}', transient=exc.response.status_code in TRANSIENT) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise YouCamError(GENERIC, code='network', transient=True) from exc
        if not isinstance(result, dict):
            raise YouCamError(GENERIC, code='task_response', transient=True)
        if result.get('status', 200) != 200:
            raise YouCamError(GENERIC, code='rejected')
        return result

    async def upload(self, data, content_type):
        if content_type not in ('image/jpeg', 'image/png'):
            raise YouCamError('Unsupported image type.', code='content_type')
        name = 'image.jpg' if content_type == 'image/jpeg' else 'image.png'
        result = await self.request('POST', '/s2s/v2.0/file', json={'files': [{'file_name': name, 'content_type': content_type, 'file_size': len(data)}]})
        try:
            file = (result.get('files') or result['data']['files'])[0]
            upload = file['requests'][0]
            url = urlparse(upload['url'])
            if url.scheme != 'https' or not url.hostname or upload['method'].upper() != 'PUT':
                raise YouCamError(GENERIC, code='upload_instruction')
            headers = {str(k): str(v) for k, v in upload.get('headers', {}).items() if k.lower() not in ('authorization', 'host', 'content-length')}
            response = await self.client.put(upload['url'], content=data, headers=headers)
            response.raise_for_status()
            return file['file_id']
        except (KeyError, IndexError, TypeError, AttributeError) as exc:
            raise YouCamError(GENERIC, code='upload_response') from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise YouCamError(GENERIC, code='upload_failed') from exc

    async def download(self, url):
        """Fetch a result image from a signed URL. The API key is not sent."""
        if urlparse(url).scheme != 'https':
            raise YouCamError(GENERIC, code='download_scheme')
        try:
            async with self.client.stream('GET', url) as response:
                response.raise_for_status()
                data = b''
                async for chunk in response.aiter_bytes():
                    data += chunk
                    if len(data) > MAX_DOWNLOAD:
                        raise YouCamError(GENERIC, code='download_size')
        except (httpx.HTTPError, ValueError) as exc:
            raise YouCamError(GENERIC, code='download_failed') from exc
        if not sniff(data):
            raise YouCamError(GENERIC, code='download_type')
        return data

    async def create_cloth(self, source_file_id, reference_file_id, category):
        if category not in ('upper_body', 'outer', 'lower_body'):
            raise YouCamError('Unsupported garment category.', code='category')
        result = await self.request('POST', CLOTH, json={'src_file_id': source_file_id, 'ref_file_id': reference_file_id, 'garment_category': category})
        return self.task_id(result)

    async def create_bag(self, source_file_id, reference_file_id, gender):
        if gender not in GENDERS:
            raise YouCamError('Unsupported gender.', code='gender')
        result = await self.request('POST', BAG, json={'src_file_id': source_file_id, 'ref_file_id': reference_file_id, 'gender': gender})
        return self.task_id(result)

    async def create_video(self, source_file_id=None, source_url=None):
        body = {'dst_duration': 5, 'resolution': '480', 'model': 'youcam-video-v2', 'prompt': VIDEO_PROMPT}
        if source_file_id:
            body['src_file_id'] = source_file_id
        else:
            body['src_file_url'] = source_url
        return self.task_id(await self.request('POST', VIDEO, json=body))

    async def status(self, endpoint, task_id):
        if endpoint not in (CLOTH, BAG, VIDEO) or not task_id or '/' in task_id:
            raise YouCamError('Invalid task.', code='task')
        result = await self.request('GET', endpoint + '/' + task_id)
        data = result.get('data')
        return data if isinstance(data, dict) else {}

    @staticmethod
    def task_id(result):
        try:
            task_id = result['data']['task_id']
            if not isinstance(task_id, str) or not task_id.strip() or '/' in task_id:
                raise YouCamError(GENERIC, code='task_response')
            return task_id
        except (KeyError, TypeError) as exc:
            raise YouCamError(GENERIC, code='task_response') from exc

    @staticmethod
    def result_url(data):
        """`data.results.url` per the docs; tolerate a list of results or a bare `url`."""
        results = data.get('results')
        if isinstance(results, list) and results:
            results = results[0]
        url = results.get('url') if isinstance(results, dict) else data.get('url')
        return url if isinstance(url, str) and url.startswith('https://') else None

    @staticmethod
    def error_code(data):
        error = data.get('error')
        if isinstance(error, dict):
            error = error.get('code')
        return error if isinstance(error, str) else None
