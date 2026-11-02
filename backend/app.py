"""Look Exchange API. State is intentionally ephemeral for the demo."""
import asyncio
import io
import logging
import os
import time
import uuid
import warnings
from contextlib import asynccontextmanager, suppress
from copy import deepcopy

import httpx
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from starlette.requests import Request

import catalog
import config
from jobs import Jobs
from youcam import GENDERS

logging.basicConfig(level=logging.INFO)
jobs = Jobs()
TTL = 3600  # seconds of inactivity before a session's data is dropped
# Items a video can be made from: the try-on of a piece of clothing. A bag preview restages the shopper in a new scene.
VIDEO_SOURCES = catalog.UPPER + ('bottom',)
# How each catalog category is sent to YouCam.
YOUCAM_CATEGORY = {'top': 'upper_body', 'outer': 'outer', 'bottom': 'lower_body', 'bag': 'bag'}
ACTIVE = ('queued', 'running', 'success', 'uncertain')
MAX_PHOTO_BYTES = 10_000_000

photos, briefs, proposals, previews, videos = {}, {}, {}, {}, {}


def clean():
    cutoff = time.time() - TTL
    for store in (photos, briefs, proposals, previews, videos):
        for key, value in list(store.items()):
            if value['touched'] < cutoff:
                del store[key]


@asynccontextmanager
async def lifespan(app):
    logging.getLogger('look-exchange').info('service_started')
    async def sweep():
        while True:
            await asyncio.sleep(60)
            clean()
    sweeper = asyncio.create_task(sweep())
    try:
        yield
    finally:
        sweeper.cancel()
        with suppress(asyncio.CancelledError):
            await sweeper
        pending = list(jobs.running)
        for future in pending:
            future.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)


app = FastAPI(lifespan=lifespan)


@app.middleware('http')
async def request_timing(request, call_next):
    started = time.monotonic()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        route = request.scope.get('route')
        # Only route templates: no user inputs, query strings, signed URLs or provider IDs.
        logging.getLogger('look-exchange').info('request method=%s route=%s status=%s elapsed_ms=%s',
            request.method, getattr(route, 'path', 'unmatched'), status,
            round((time.monotonic() - started) * 1000))
app.add_middleware(
    CORSMiddleware, allow_origins=config.FRONTEND_ORIGINS, allow_origin_regex=config.FRONTEND_ORIGIN_REGEX,
    allow_methods=['GET', 'POST', 'PATCH'], allow_headers=['Content-Type'],
)

# The frontend only reads these 422 field names, and shows the text to shoppers as written.
FIELD_NAMES = {'photoId': 'photo', 'sizes': 'topSize', 'sizes.top': 'topSize'}
FIELD_MESSAGES = {
    'photo': 'Add a full-body photo of yourself.',
    'consent': 'Agree to send your photo for try-on to continue.',
    'text': 'Describe the look you want.',
    'budget': 'Enter a budget in dollars.',
    'topSize': 'Choose your top or jacket size.',
}


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    errors = {}
    for issue in exc.errors():
        location = '.'.join(str(part) for part in issue['loc'] if part not in ('body', 'query', 'path'))
        name = FIELD_NAMES.get(location, location) or 'request'
        errors[name] = FIELD_MESSAGES.get(name, issue['msg'])
    return JSONResponse(status_code=422, content={'errors': errors})


def ident():
    return uuid.uuid4().hex


def error(status, message):
    return JSONResponse(status_code=status, content={'error': message})


def field_error(field, message):
    return JSONResponse(status_code=422, content={'errors': {field: message}})


def get(store, key):
    """Look up a record and mark it as in use, so an active session does not expire."""
    record = store.get(key)
    if record is not None:
        record['touched'] = time.time()
    return record


def record(**fields):
    now = time.time()
    return {'created': now, 'touched': now, **fields}


def public(p):
    return {k: deepcopy(v) for k, v in p.items() if k not in ('created', 'touched', 'briefId')}


def proposal_of(pid):
    """The proposal, its brief and the shopper's photo, all kept alive together."""
    p = get(proposals, pid)
    if p is None:
        return None, None
    brief = get(briefs, p['briefId'])
    if brief is not None:
        get(photos, brief['photoId'])
    return p, brief


def item_of(p, item_id):
    return next((i for i in p['items'] if i['itemId'] == item_id), None)


def subtotal(items):
    return round(sum(i['price'] for i in items), 2)


def describe(p, brief):
    listed = [catalog.find(i['itemId']) for i in p['items']]
    anchor = brief['anchor'] if brief['anchor'] and item_of(p, brief['anchor']['itemId']) else None
    return catalog.rationale(listed, catalog.normalize(brief['text'] + ' ' + brief['occasion']), p['subtotal'], brief['budget'], anchor)


def new_proposal(store_id, brief_id, brief):
    picked, reason = catalog.propose(
        store_id, brief['size'], brief['budget'], brief['text'] + ' ' + brief['occasion'], brief['keep'], brief['bottomSize'], brief['anchor'],
    )
    items = [catalog.public_item(i, catalog.size_for(i, brief['size'], brief['bottomSize'])) for i in picked]
    return record(
        id=ident(), briefId=brief_id, storeId=store_id, storeName=catalog.STORES[store_id]['storeName'], items=items,
        kept=brief['keep'], subtotal=subtotal(items), rationale=reason, version=1, selected=False,
    )


BAD_PHOTO = 'Use a JPG or PNG photo under 10 MB.'


def normalize_photo(data):
    """Decode a shopper photo, fix its orientation, drop metadata (including location) and return JPEG bytes."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format not in ('JPEG', 'PNG'):
                    raise ValueError(BAD_PHOTO)
                image = ImageOps.exif_transpose(source)
                image.load()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValueError('That image could not be read. Use a JPG or PNG photo.') from exc
    short, long = sorted(image.size)
    if short < 384 or long < 512:
        raise ValueError('That photo is too small. Use one at least 512 pixels tall.')
    if long > 2.5 * short:
        raise ValueError('That photo has an unusual shape. Use a standard portrait photo.')
    if image.mode in ('RGBA', 'LA', 'P'):
        rgba = image.convert('RGBA')
        flat = Image.new('RGB', rgba.size, 'white')
        flat.paste(rgba, mask=rgba.getchannel('A'))
        image = flat
    else:
        image = image.convert('RGB')
    image.thumbnail((2048, 2048), Image.LANCZOS)
    out = io.BytesIO()
    image.save(out, 'JPEG', quality=92)
    return out.getvalue()


class Brief(BaseModel):
    photoId: str = ''
    text: str = ''
    budget: float = 0
    occasion: str = ''
    sizes: dict[str, str] = Field(default_factory=dict)
    keep: list[str] = Field(default_factory=list)
    itemId: str | None = None  # optional: build every store's outfit around this catalog piece


@app.get('/api/health')
async def health():
    return {'status': 'ok', 'youcamConfigured': bool(os.getenv('YOUCAM_API_KEY')), 'catalogItems': len(catalog.ITEMS)}


@app.get('/api/catalogs/{store_id}')
async def get_catalog(store_id: str):
    store = catalog.STORES.get(store_id)
    if store is None:
        return error(404, 'Catalog not found.')
    return {'storeId': store_id, 'sampleStore': True, 'items': [catalog.public_item(i, None) for i in store['items']]}


@app.post('/api/photos')
async def upload(photo: UploadFile = File(...), consent: str = Form(...)):
    clean()
    if consent.strip().lower() != 'true':
        return field_error('consent', FIELD_MESSAGES['consent'])
    if len(photos) >= 100 or sum(len(p['data']) for p in photos.values()) >= 100_000_000:
        return error(503, 'Photo storage is temporarily full. Please retry later.')
    data = await photo.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        return field_error('photo', BAD_PHOTO)
    try:
        jpeg = await asyncio.to_thread(normalize_photo, data)
    except ValueError as exc:
        return field_error('photo', str(exc))
    key = ident()
    photos[key] = record(data=jpeg)
    return {'photoId': key}


@app.post('/api/briefs')
async def create_brief(body: Brief):
    clean()
    errors = {}
    if not body.photoId:
        errors['photo'] = FIELD_MESSAGES['photo']
    elif body.photoId not in photos:
        errors['photo'] = 'Your photo expired. Add it again.'
    text = body.text.strip()
    if not text:
        errors['text'] = FIELD_MESSAGES['text']
    elif len(text) > 1000:
        errors['text'] = 'Keep the description under 1,000 characters.'
    if not 0 < body.budget <= 100000:
        errors['budget'] = FIELD_MESSAGES['budget']
    size = body.sizes.get('top', '').strip().upper()
    if size not in catalog.SIZES:
        errors['topSize'] = FIELD_MESSAGES['topSize']
    bottom_size = body.sizes.get('bottom', '').strip().upper() or None
    if bottom_size and bottom_size not in catalog.SIZES:
        errors['bottomSize'] = 'Choose a bottoms size from the list.'
    if errors:
        return JSONResponse(status_code=422, content={'errors': errors})
    get(photos, body.photoId)
    keep = [k.strip()[:80] for k in body.keep if k.strip()][:10]
    key = ident()
    briefs[key] = record(
        photoId=body.photoId, text=text, budget=body.budget, occasion=body.occasion.strip()[:200], size=size, bottomSize=bottom_size, keep=keep,
        anchor=catalog.find_anchor(text, body.itemId),
    )
    result = [new_proposal(store_id, key, briefs[key]) for store_id in catalog.STORES]
    for p in result:
        proposals[p['id']] = p
    return {'briefId': key, 'proposals': [public(p) for p in result]}


@app.patch('/api/proposals/{pid}/items/{item_id}')
async def update(pid: str, item_id: str, patch: dict):
    clean()
    p, brief = proposal_of(pid)
    if p is None:
        return error(404, 'Proposal not found.')
    item = item_of(p, item_id)
    if item is None:
        return error(404, 'Item not found.')
    if set(patch) not in ({'size'}, {'locked'}) or ('locked' in patch and not isinstance(patch['locked'], bool)) or ('size' in patch and not isinstance(patch['size'], str)):
        return error(422, 'Provide size or locked.')
    if 'size' in patch and patch['size'] not in item['sizesInStock']:
        others = [i for i in p['items'] if i is not item]
        options = catalog.in_size(p['storeId'], item, others, patch['size'], brief['budget'] if brief else float('inf'))
        return JSONResponse(status_code=409, content={'code': 'out_of_stock', 'alternatives': [catalog.public_item(i, patch['size']) for i in options]})
    item.update(patch)
    p['version'] += 1
    return public(p)


class ReplaceBody(BaseModel):
    itemId: str = ''
    instruction: str | None = None


@app.post('/api/proposals/{pid}/replace')
async def replace(pid: str, body: ReplaceBody):
    clean()
    p, brief = proposal_of(pid)
    if p is None or brief is None:
        return error(404, 'Proposal not found.')
    item = item_of(p, body.itemId)
    if item is None:
        return error(404, 'Item not found.')
    if item['locked']:
        return error(409, 'Unlock the item before replacing it.')
    others = [i for i in p['items'] if i is not item]
    chosen = catalog.replacement(p['storeId'], item, others, brief['budget'], brief['text'] + ' ' + brief['occasion'], (body.instruction or '')[:200])
    if chosen is None:
        return error(409, 'No replacement fits the size and budget.')
    p['items'][p['items'].index(item)] = catalog.public_item(chosen, item['size'])
    p['subtotal'] = subtotal(p['items'])
    p['rationale'] = describe(p, brief)
    p['version'] += 1
    return public(p)


@app.post('/api/proposals/{pid}/select')
async def select(pid: str):
    clean()
    p, _ = proposal_of(pid)
    if p is None:
        return error(404, 'Proposal not found.')
    if not p['items']:
        return error(409, 'A proposal without items cannot be selected.')
    for other in proposals.values():
        if other['briefId'] == p['briefId']:
            other['selected'] = other is p
    return public(p)


class PreviewBody(BaseModel):
    itemId: str = ''
    gender: str | None = None  # optional; only bag try-on uses it, and the server default applies when omitted


async def garment_image(item):
    """The product photo, from the repo checkout, or else from the live frontend, which serves the same files."""
    path = catalog.image_file(item)
    if path.is_file():
        return path.read_bytes()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(config.FRONTEND_PUBLIC_URL + item['imageUrl'])
            response.raise_for_status()
            return response.content
    except httpx.HTTPError:
        return None


@app.post('/api/proposals/{pid}/previews')
async def start_preview(pid: str, body: PreviewBody):
    clean()
    p, brief = proposal_of(pid)
    if p is None:
        return error(404, 'Proposal not found.')
    item = item_of(p, body.itemId)
    if item is None:
        return error(404, 'Item not found.')
    if item['category'] not in YOUCAM_CATEGORY:
        return error(422, 'This kind of item cannot be previewed.')
    gender = (body.gender or config.BAG_GENDER).strip().lower()
    if item['category'] == 'bag' and gender not in GENDERS:
        return field_error('gender', 'Use female or male.')
    key = os.getenv('YOUCAM_API_KEY')
    if not key:
        return error(503, 'YouCam is not configured.')
    photo = get(photos, brief['photoId']) if brief else None
    if photo is None:
        return error(410, 'Photo expired. Please upload it again.')
    for tid, task in previews.items():
        if task['proposal'] == pid and task['item'] == item['itemId'] and task['status'] in ACTIVE:
            return {'previewId': tid}
    garment = await garment_image(catalog.find(item['itemId']))
    if garment is None:
        return error(503, 'The product photo is unavailable right now. Please try again.')
    # Photo preparation can yield while another request creates the same job.
    for tid, task in previews.items():
        if task['proposal'] == pid and task['item'] == item['itemId'] and task['status'] in ACTIVE:
            return {'previewId': tid}
    if not await jobs.reserve(brief['photoId'], 'preview'):
        return error(429, 'Generation limit reached for this session or day.')
    tid = ident()
    previews[tid] = task = record(status='queued', kind='preview', proposal=pid, item=item['itemId'], category=item['category'])
    jobs.start(task, key, session=brief['photoId'], photo=photo['data'], reference=garment, category=YOUCAM_CATEGORY[item['category']], gender=gender)
    return {'previewId': tid}


@app.get('/api/previews/{preview_id}')
async def get_preview(preview_id: str):
    clean()
    task = get(previews, preview_id)
    if task:
        jobs.recheck(task, os.getenv('YOUCAM_API_KEY'))
    return jobs.public(task) if task else error(404, 'Preview not found.')


class VideoBody(BaseModel):
    previewId: str = ''
    duration: int = 0
    resolution: str = ''


@app.post('/api/proposals/{pid}/videos')
async def start_video(pid: str, body: VideoBody):
    clean()
    p, brief = proposal_of(pid)
    if p is None:
        return error(404, 'Proposal not found.')
    if not p['selected']:
        return error(409, 'Select this proposal first.')
    if body.duration != 5 or body.resolution != '480':
        return error(422, 'Use a 5-second video at 480p.')
    preview = get(previews, body.previewId)
    # The video is made from a clothing try-on; a bag preview restages the shopper in a new scene.
    if preview is None or preview['proposal'] != pid or preview['status'] != 'success' or item_of(p, preview['item']) is None or preview['category'] not in VIDEO_SOURCES:
        return error(409, 'Generate a current preview for this proposal first.')
    key = os.getenv('YOUCAM_API_KEY')
    if not key:
        return error(503, 'YouCam is not configured.')
    for tid, task in videos.items():
        if task['proposal'] == pid and task['preview'] == body.previewId and task['status'] in ACTIVE:
            return {'videoId': tid}
    if brief is None:
        return error(410, 'Session expired.')
    if not await jobs.reserve(brief['photoId'], 'video'):
        return error(429, 'Generation limit reached for this session or day.')
    tid = ident()
    videos[tid] = task = record(status='queued', kind='video', proposal=pid, preview=body.previewId)
    jobs.start(task, key, session=brief['photoId'], source_url=preview['imageUrl'])
    return {'videoId': tid}


@app.get('/api/videos/{video_id}')
async def get_video(video_id: str):
    clean()
    task = get(videos, video_id)
    if task:
        jobs.recheck(task, os.getenv('YOUCAM_API_KEY'))
    return jobs.public(task) if task else error(404, 'Video not found.')
