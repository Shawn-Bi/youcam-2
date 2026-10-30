"""Look Exchange API. State is intentionally ephemeral for the demo."""
import os
import json
from pathlib import Path
import asyncio
from contextlib import asynccontextmanager, suppress
import io
import warnings
import time
import uuid
from copy import deepcopy
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.requests import Request
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError
from jobs import Jobs
jobs = Jobs()

@asynccontextmanager
async def lifespan(app):
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
origins = [x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type"])
@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    errors = {}
    for issue in exc.errors():
        location = [str(part) for part in issue["loc"] if part not in ("body", "query", "path")]
        errors[".".join(location) or "request"] = issue["msg"]
    return JSONResponse(status_code=422, content={"errors": errors})

photos, briefs, proposals, previews, videos = {}, {}, {}, {}, {}
TTL = 3600

ROOT = Path(__file__).resolve().parent
PUBLIC_BASE_URL = os.getenv('PUBLIC_BASE_URL', 'http://localhost:8000').rstrip('/')
CATALOG_DATA = {path.stem: json.loads(path.read_text()) for path in (ROOT / 'catalogs').glob('*.json')}
CATALOGS = {key: (value['storeName'], []) for key, value in CATALOG_DATA.items()}
app.mount('/assets', StaticFiles(directory=ROOT / 'static'), name='assets')

@app.get('/api/catalogs/{store_id}')
async def get_catalog(store_id: str):
    if store_id not in CATALOG_DATA: return err(404, 'Catalog not found.')
    return {'storeId':store_id, 'sampleStore':True, 'items':catalog(store_id)}

def ident(): return uuid.uuid4().hex

def clean():
    now = time.time()
    for store in (photos, briefs, proposals, previews, videos):
        for key, value in list(store.items()):
            if value.get("created", now) + TTL < now: del store[key]

def err(status, message): return JSONResponse(status_code=status, content={"error": message})

def catalog(store):
    return [dict(itemId=i['itemId'], name=i['name'], category=i['category'], price=i['price'], sizesInStock=i['sizesInStock'], tags=i['styleTags'], imageUrl=PUBLIC_BASE_URL+i['imagePath'], productUrl=PUBLIC_BASE_URL+i['productPath']) for i in CATALOG_DATA[store]['items']]

def public_item(item, size):
    return {k: v for k, v in item.items() if k != "tags"} | {"size": size if item["sizesInStock"] else None, "locked": False}

def public(p): return {k: deepcopy(v) for k, v in p.items() if k not in ("created", "briefId")}

def proposal(store, brief_id, brief):
    words = (brief.text + " " + brief.occasion).lower()
    candidates = [i for i in catalog(store) if i["category"] in ("top", "outer") and brief.sizes.get("top") in i["sizesInStock"] and i["price"] <= brief.budget]
    candidates.sort(key=lambda i: (-sum(tag in words for tag in i["tags"]), i["price"], i["itemId"]))
    items = [public_item(candidates[0], brief.sizes["top"])] if candidates else []
    bags = [i for i in catalog(store) if i["category"] == "bag" and items and i["price"] + items[0]["price"] <= brief.budget]
    bags.sort(key=lambda i: (-sum(tag in words for tag in i["tags"]), i["price"]))
    if bags: items.append(public_item(bags[0], None))
    return {"id": ident(), "briefId": brief_id, "created": time.time(), "storeId": store, "storeName": CATALOGS[store][0], "sampleStore": True, "items": items, "kept": brief.keep, "subtotal": sum(i["price"] for i in items), "rationale": "Selected " + ", ".join(i["name"] for i in items) + "." if items else "No items in your size fit this budget.", "version": 1, "selected": False}

class Brief(BaseModel):
    photoId: str
    text: str
    budget: float
    occasion: str
    sizes: dict[str, str]
    keep: list[str] = Field(default_factory=list)

@app.get('/api/health')
async def health(): return {"status": "ok"}

@app.post('/api/photos')
async def upload(photo: UploadFile = File(...), consent: str = Form(...)):
    clean()
    if consent.lower() != 'true': return err(422, 'Consent is required.')
    if len(photos) >= 100 or sum(len(p['data']) for p in photos.values()) >= 100_000_000:
        return err(503, 'Photo storage is temporarily full. Please retry later.')
    data = await photo.read(10_000_001)
    if len(data) > 10_000_000 or not (data.startswith(b'\xff\xd8\xff') or data.startswith(b'\x89PNG\r\n\x1a\n')): return err(422, 'A JPG or PNG under 10 MB is required.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in ('JPEG', 'PNG'):
                    return err(422, 'A JPG or PNG under 10 MB is required.')
                image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return err(422, 'The image is invalid or too large.')
    key = ident(); photos[key] = {"data": data, "created": time.time()}
    return {"photoId": key}

@app.post('/api/briefs')
async def create_brief(body: Brief):
    clean(); errors = {}
    if body.photoId not in photos: errors['photoId'] = 'Upload a photo first.'
    if not body.text.strip(): errors['text'] = 'Enter a brief.'
    if not body.occasion.strip(): errors['occasion'] = 'Enter an occasion.'
    if not 0 < body.budget <= 100000: errors['budget'] = 'Enter a valid budget.'
    if not body.sizes.get('top'): errors['sizes.top'] = 'Choose a top size.'
    if errors: return JSONResponse(status_code=422, content={'errors': errors})
    key = ident(); briefs[key] = {'data': body, 'created': time.time()}
    result = [proposal(store, key, body) for store in CATALOGS]
    for p in result: proposals[p['id']] = p
    return {'briefId': key, 'proposals': [public(p) for p in result]}

@app.patch('/api/proposals/{pid}/items/{item_id}')
async def update(pid: str, item_id: str, patch: dict):
    clean(); p = proposals.get(pid)
    if not p: return err(404, 'Proposal not found.')
    item = next ( (i for i in p['items'] if i['itemId'] == item_id), None)
    if not item: return err(404, 'Item not found.')
    if set(patch) not in ({'size'}, {'locked'}) or ('locked' in patch and not isinstance(patch['locked'], bool)) or ('size' in patch and not isinstance(patch['size'], str)): return err(422, 'Provide size or locked.')
    if 'size' in patch and patch['size'] not in item['sizesInStock']:
        alternatives = [public_item(i, patch['size']) for i in catalog(p['storeId']) if i['category'] == item['category'] and patch['size'] in i['sizesInStock'] and i['price'] + p['subtotal'] - item['price'] <= briefs[p['briefId']]['data'].budget]
        return JSONResponse(status_code=409, content={'code': 'out_of_stock', 'alternatives': alternatives})
    item.update(patch); p['version'] += 1
    return public(p)

@app.post('/api/proposals/{pid}/replace')
async def replace(pid: str, body: dict):
    clean(); p = proposals.get(pid)
    if not p: return err(404, 'Proposal not found.')
    item = next((i for i in p['items'] if i['itemId'] == body.get('itemId')), None)
    if not item: return err(404, 'Item not found.')
    if item['locked']: return err(409, 'Unlock the item before replacing it.')
    brief = briefs[p['briefId']]['data']; used = {i['itemId'] for i in p['items']}
    options = [i for i in catalog(p['storeId']) if i['category'] == item['category'] and i['itemId'] not in used and (not i['sizesInStock'] or item['size'] in i['sizesInStock']) and p['subtotal'] - item['price'] + i['price'] <= brief.budget]
    if not options: return err(409, 'No replacement fits the size and budget.')
    replacement = public_item(options[0], item['size']); p['items'][p['items'].index(item)] = replacement
    p['subtotal'] = sum(i['price'] for i in p['items']); p['version'] += 1; p['rationale'] = 'Selected ' + ', '.join(i['name'] for i in p['items']) + '.'
    return public(p)

@app.post('/api/proposals/{pid}/select')
async def select(pid: str):
    clean(); p = proposals.get(pid)
    if not p: return err(404, 'Proposal not found.')
    if not p['items']: return err(409, 'A proposal without items cannot be selected.')
    for other in proposals.values():
        if other['briefId'] == p['briefId']: other['selected'] = other is p
    return public(p)

def item_signature(item):
    return (item['itemId'], item['size'], item['imageUrl'])


def preview_is_current(task, proposal):
    return any(item_signature(item) == task.get('signature') for item in proposal['items'])


@app.post('/api/proposals/{pid}/previews')
async def start_preview(pid: str, body: dict):
    clean(); p = proposals.get(pid)
    if not p: return err(404, 'Proposal not found.')
    item = next((i for i in p['items'] if i['itemId'] == body.get('itemId')), None)
    if not item: return err(404, 'Item not found.')
    if item['category'] not in ('top', 'outer'): return err(422, 'Only clothing previews are currently supported.')
    if not item['imageUrl'].startswith('https://'): return err(503, 'Product imagery is not configured.')
    key = os.getenv('YOUCAM_API_KEY')
    if not key: return err(503, 'YouCam is not configured.')
    brief = briefs.get(p['briefId'])
    photo = photos.get(brief['data'].photoId) if brief else None
    if not photo: return err(410, 'Photo expired. Please upload it again.')
    for tid, task in previews.items():
        if task['proposal'] == pid and task.get('signature') == item_signature(item) and task['item'] == item['itemId'] and task['status'] in ('queued', 'running', 'success'):
            return {'previewId':tid}
    if not await jobs.reserve(brief['data'].photoId, 'preview'): return err(429, 'Generation limit reached for this session or day.')
    tid = ident()
    task = dict(created=time.time(), status='queued', kind='preview', proposal=pid, version=p['version'], item=item['itemId'], signature=item_signature(item))
    previews[tid] = task
    jobs.start(task, key, photo=photo['data'], image_url=item['imageUrl'], category='outer' if item['category'] == 'outer' else 'upper_body')
    return {'previewId':tid}

@app.get('/api/previews/{preview_id}')
async def get_preview(preview_id: str):
    clean()
    task = previews.get(preview_id)
    return jobs.public(task) if task else err(404, 'Preview not found.')

@app.post('/api/proposals/{pid}/videos')
async def start_video(pid: str, body: dict):
    clean(); p = proposals.get(pid)
    if not p: return err(404, 'Proposal not found.')
    if not p['selected']: return err(409, 'Select this proposal first.')
    if body.get('duration') != 5 or body.get('resolution') != '480': return err(422, 'Use a 5-second video at 480p.')
    preview = previews.get(body.get('previewId', ''))
    if not preview or preview['proposal'] != pid or not preview_is_current(preview, p) or preview['status'] != 'success': return err(409, 'Generate a current preview for this proposal first.')
    key = os.getenv('YOUCAM_API_KEY')
    if not key: return err(503, 'YouCam is not configured.')
    for tid, task in videos.items():
        if task['proposal'] == pid and task['status'] in ('queued', 'running', 'success'): return {'videoId':tid}
    brief = briefs.get(p['briefId'])
    if not brief: return err(410, 'Session expired.')
    if not await jobs.reserve(brief['data'].photoId, 'video'): return err(429, 'Generation limit reached for this session or day.')
    tid = ident()
    task = dict(created=time.time(), status='queued', kind='video', proposal=pid)
    videos[tid] = task
    jobs.start(task, key, image_url=preview['imageUrl'])
    return {'videoId':tid}

@app.get('/api/videos/{video_id}')
async def get_video(video_id: str):
    clean()
    task = videos.get(video_id)
    return jobs.public(task) if task else err(404, 'Video not found.')
