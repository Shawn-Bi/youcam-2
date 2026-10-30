from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as module
from app import app
from jobs import Jobs

client = TestClient(app)
BRIEF = 'silver and black concert look'
PROPOSAL_KEYS = {'id', 'storeId', 'storeName', 'items', 'kept', 'subtotal', 'rationale', 'version', 'selected'}
ITEM_KEYS = {'itemId', 'name', 'category', 'price', 'size', 'sizesInStock', 'imageUrl', 'productUrl', 'locked'}


@pytest.fixture(autouse=True)
def fresh_jobs(monkeypatch):
    monkeypatch.setattr(module, 'jobs', Jobs())


@pytest.fixture
def youcam(monkeypatch):
    """A configured key and jobs that finish instantly, so no test can reach YouCam."""
    monkeypatch.setenv('YOUCAM_API_KEY', 'test-key')
    started = []

    def fake_start(task, key, session=None, **inputs):
        started.append({'task': task, 'session': session, **inputs})
        task['status'] = 'success'
        task['imageUrl' if task['kind'] == 'preview' else 'videoUrl'] = 'https://example.com/' + task['kind']

    monkeypatch.setattr(module.jobs, 'start', fake_start)
    return started


def picture(width=600, height=800, fmt='PNG', **save):
    output = BytesIO()
    Image.new('RGB', (width, height), 'white').save(output, format=fmt, **save)
    return output.getvalue()


def upload(data=None, consent='true', name='photo.png'):
    return client.post('/api/photos', data={'consent': consent}, files={'photo': (name, data or picture(), 'image/png')})


def new_brief(text=BRIEF, budget=120, size='M', **extra):
    photo = upload().json()['photoId']
    body = {'photoId': photo, 'text': text, 'budget': budget, 'occasion': 'concert', 'sizes': {'top': size}, 'keep': ['boots'], **extra}
    return client.post('/api/briefs', json=body)


def proposal(index=0, **kwargs):
    return new_brief(**kwargs).json()['proposals'][index]


# --- photos ---------------------------------------------------------------------------

def test_upload_returns_photo_id_and_rejects_bad_files():
    assert upload().status_code == 200
    response = upload(consent='false')
    assert response.status_code == 422 and list(response.json()['errors']) == ['consent']
    for data in (b'not an image', b'\x89PNG\r\n\x1a\ninvalid', picture(100, 100), picture(300, 1200)):
        response = upload(data)
        assert response.status_code == 422 and list(response.json()['errors']) == ['photo'], data[:12]


def test_missing_photo_or_consent_use_contract_field_names():
    response = client.post('/api/photos', data={'consent': 'true'})
    assert response.status_code == 422 and response.json()['errors'] == {'photo': 'Add a full-body photo of yourself.'}
    response = client.post('/api/photos', files={'photo': ('a.png', picture(), 'image/png')})
    assert response.json()['errors'] == {'consent': 'Agree to send your photo for try-on to continue.'}


def test_oversized_upload_is_rejected():
    assert upload(b'\x89PNG\r\n\x1a\n' + b'0' * 10_000_100).status_code == 422


def test_photo_is_reoriented_and_stripped_of_metadata():
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 degrees on display
    exif[0x010F] = 'Camera Maker'
    stored = module.photos[upload(picture(800, 600, 'JPEG', exif=exif), name='photo.jpg').json()['photoId']]['data']
    with Image.open(BytesIO(stored)) as image:
        assert image.format == 'JPEG' and image.size == (600, 800)
        assert len(image.getexif()) == 0


def test_large_photo_is_downscaled_and_alpha_flattened():
    big = Image.new('RGBA', (3000, 2400), (255, 0, 0, 0))
    output = BytesIO()
    big.save(output, format='PNG')
    stored = module.photos[upload(output.getvalue()).json()['photoId']]['data']
    with Image.open(BytesIO(stored)) as image:
        assert max(image.size) == 2048 and image.mode == 'RGB' and image.getpixel((5, 5)) == (255, 255, 255)


# --- briefs ---------------------------------------------------------------------------

def test_brief_returns_contract_shaped_proposals_from_two_different_stores():
    data = new_brief().json()
    north, mono = data['proposals']
    assert [p['storeId'] for p in data['proposals']] == ['northline', 'mono-studio']
    for p, names, total in ((north, ['Chrome bomber', 'Disc crossbody bag'], 114), (mono, ['Shine zip jacket', 'Nova chain bag'], 108)):
        assert set(p) == PROPOSAL_KEYS and p['version'] == 1 and p['selected'] is False and p['kept'] == ['boots']
        assert [i['name'] for i in p['items']] == names and p['subtotal'] == total
        for item in p['items']:
            assert set(item) == ITEM_KEYS and item['locked'] is False
            assert item['productUrl'].startswith(('http://', 'https://')) and item['imageUrl'].endswith('.png')
        assert p['items'][0]['size'] == 'M' and p['items'][1]['size'] is None


def test_occasion_is_optional():
    photo = upload().json()['photoId']
    response = client.post('/api/briefs', json={'photoId': photo, 'text': BRIEF, 'budget': 120, 'sizes': {'top': 'm'}, 'keep': []})
    assert response.status_code == 200
    assert response.json()['proposals'][0]['items'][0]['size'] == 'M'


def test_brief_errors_use_the_field_names_the_frontend_reads():
    response = client.post('/api/briefs', json={'photoId': 'missing', 'text': '', 'budget': 0, 'sizes': {}})
    assert response.status_code == 422
    assert response.json()['errors'] == {
        'photo': 'Your photo expired. Add it again.', 'text': 'Describe the look you want.',
        'budget': 'Enter a budget in dollars.', 'topSize': 'Choose your top or jacket size.',
    }
    response = client.post('/api/briefs', json={'budget': 'bad'})
    assert response.status_code == 422 and response.json()['errors'] == {'budget': 'Enter a budget in dollars.'}
    response = client.post('/api/briefs', json={'photoId': 'x', 'text': 'a', 'budget': 5, 'sizes': {'top': 'HUGE'}})
    assert response.json()['errors']['topSize'] == 'Choose your top or jacket size.'
    assert client.post('/api/briefs', json={'photoId': 'x', 'text': 'a' * 1001, 'budget': 5, 'sizes': {'top': 'M'}}).json()['errors']['text'].startswith('Keep the description')


def test_over_budget_store_returns_an_empty_proposal_with_a_reason():
    p = proposal(budget=20)
    assert p['items'] == [] and p['subtotal'] == 0 and p['rationale'] == 'Nothing in size M came in under $20.'
    assert client.post(f"/api/proposals/{p['id']}/select").status_code == 409


# --- revising -------------------------------------------------------------------------

def test_size_change_in_stock_keeps_the_preview_valid(youcam):
    p = proposal()
    item = p['items'][0]
    base = f"/api/proposals/{p['id']}"
    preview = client.post(base + '/previews', json={'itemId': item['itemId']}).json()['previewId']
    changed = client.patch(f"{base}/items/{item['itemId']}", json={'size': 'L'})
    assert changed.status_code == 200 and changed.json()['version'] == 2 and changed.json()['items'][0]['size'] == 'L'
    assert client.post(base + '/previews', json={'itemId': item['itemId']}).json()['previewId'] == preview
    client.post(base + '/select')
    assert client.post(base + '/videos', json={'previewId': preview, 'duration': 5, 'resolution': '480'}).status_code == 200


def test_out_of_stock_size_returns_alternatives_in_that_size():
    p = proposal(budget=200)
    chrome = p['items'][0]
    assert chrome['itemId'] == 'northline_chrome' and chrome['sizesInStock'] == ['M', 'L', 'XL']
    url = f"/api/proposals/{p['id']}/items/{chrome['itemId']}"
    response = client.patch(url, json={'size': 'XXL'})
    assert response.status_code == 409 and response.json() == {'code': 'out_of_stock', 'alternatives': []}
    response = client.patch(url, json={'size': 'S'})
    assert response.status_code == 409 and response.json()['code'] == 'out_of_stock'
    alternatives = response.json()['alternatives']
    assert {a['itemId'] for a in alternatives} == {'northline_racer', 'northline_vinyl'}
    assert all(set(a) == ITEM_KEYS and a['size'] == 'S' and 'S' in a['sizesInStock'] and a['category'] == 'outer' for a in alternatives)
    assert module.proposals[p['id']]['version'] == 1  # a refused change leaves the proposal alone


def test_lock_and_bad_patches():
    p = proposal()
    item = p['items'][0]
    url = f"/api/proposals/{p['id']}/items/{item['itemId']}"
    assert client.patch(url, json={'locked': True}).json()['items'][0]['locked'] is True
    for patch in ({'size': []}, {'locked': 'yes'}, {'size': 'M', 'locked': True}, {}, {'price': 1}):
        assert client.patch(url, json=patch).status_code == 422
    assert client.patch(f"/api/proposals/{p['id']}/items/nope", json={'locked': True}).status_code == 404
    assert client.patch('/api/proposals/nope/items/x', json={'locked': True}).status_code == 404


def test_replace_gives_a_new_item_id_and_recomputes_the_subtotal():
    p = proposal(budget=150)
    old = p['items'][0]
    response = client.post(f"/api/proposals/{p['id']}/replace", json={'itemId': old['itemId']})
    assert response.status_code == 200
    new = response.json()
    assert new['version'] == 2 and new['items'][0]['itemId'] != old['itemId'] and new['items'][0]['category'] == old['category']
    assert new['subtotal'] == sum(i['price'] for i in new['items']) <= 150 and old['name'] not in new['rationale']
    assert [i['itemId'] for i in new['items'][1:]] == [i['itemId'] for i in p['items'][1:]]


def test_replace_honors_the_instruction_and_refuses_locked_items():
    p = proposal(budget=150)
    jacket = p['items'][0]
    cheaper = client.post(f"/api/proposals/{p['id']}/replace", json={'itemId': jacket['itemId'], 'instruction': 'cheaper'}).json()
    assert cheaper['items'][0]['price'] < jacket['price']
    client.patch(f"/api/proposals/{p['id']}/items/{cheaper['items'][0]['itemId']}", json={'locked': True})
    assert client.post(f"/api/proposals/{p['id']}/replace", json={'itemId': cheaper['items'][0]['itemId']}).status_code == 409


def test_replace_without_an_option_is_a_conflict():
    p = proposal(budget=27, size='XS')
    assert [i['name'] for i in p['items']] == ['Red rib tank']
    response = client.post(f"/api/proposals/{p['id']}/replace", json={'itemId': p['items'][0]['itemId']})
    assert response.status_code == 409 and response.json() == {'error': 'No replacement fits the size and budget.'}
    assert client.post(f"/api/proposals/{p['id']}/replace", json={'itemId': 'missing'}).status_code == 404
    assert client.post('/api/proposals/nope/replace', json={'itemId': 'x'}).status_code == 404


def test_select_marks_exactly_one_proposal_of_the_brief():
    data = new_brief().json()
    first, second = data['proposals']
    assert client.post(f"/api/proposals/{first['id']}/select").json()['selected'] is True
    assert client.post(f"/api/proposals/{second['id']}/select").json()['selected'] is True
    assert [module.proposals[p['id']]['selected'] for p in data['proposals']] == [False, True]
    assert client.post('/api/proposals/nope/select').status_code == 404


# --- previews and videos ----------------------------------------------------------------

def test_previews_need_a_key_and_only_cover_clothing(monkeypatch):
    p = proposal()
    jacket, bag = p['items']
    base = f"/api/proposals/{p['id']}"
    assert client.post(base + '/previews', json={'itemId': jacket['itemId']}).status_code == 503
    monkeypatch.setenv('YOUCAM_API_KEY', 'test-key')
    assert client.post(base + '/previews', json={'itemId': bag['itemId']}).status_code == 422
    assert client.post(base + '/previews', json={'itemId': 'missing'}).status_code == 404
    assert client.post('/api/proposals/nope/previews', json={'itemId': 'x'}).status_code == 404


def test_preview_sends_the_stored_photo_and_the_garment_image(youcam):
    p = proposal()
    jacket = p['items'][0]
    response = client.post(f"/api/proposals/{p['id']}/previews", json={'itemId': jacket['itemId']})
    assert response.status_code == 200
    job = youcam[0]
    assert jacket['category'] == 'outer' and job['category'] == 'outer'
    assert job['photo'].startswith(b'\xff\xd8\xff') and job['reference'].startswith(b'\x89PNG') and job['session']
    assert client.get('/api/previews/' + response.json()['previewId']).json() == {'status': 'success', 'imageUrl': 'https://example.com/preview'}
    assert client.get('/api/previews/nope').status_code == 404


def test_preview_is_reused_while_active_and_retried_after_failure(youcam):
    p = proposal()
    item = p['items'][0]
    url = f"/api/proposals/{p['id']}/previews"
    first = client.post(url, json={'itemId': item['itemId']}).json()['previewId']
    assert client.post(url, json={'itemId': item['itemId']}).json()['previewId'] == first
    module.previews[first]['status'] = 'failed'
    second = client.post(url, json={'itemId': item['itemId']}).json()['previewId']
    assert second != first and len(youcam) == 2


def test_replaced_item_needs_its_own_preview_and_invalidates_the_video(youcam):
    p = proposal(budget=150)
    base = f"/api/proposals/{p['id']}"
    old = p['items'][0]
    preview = client.post(base + '/previews', json={'itemId': old['itemId']}).json()['previewId']
    client.post(base + '/select')
    video_body = {'previewId': preview, 'duration': 5, 'resolution': '480'}
    assert client.post(base + '/videos', json=video_body).status_code == 200
    client.post(base + '/replace', json={'itemId': old['itemId']})
    assert client.post(base + '/videos', json=video_body).status_code == 409


def test_video_rules(youcam):
    p = proposal()
    base = f"/api/proposals/{p['id']}"
    preview = client.post(base + '/previews', json={'itemId': p['items'][0]['itemId']}).json()['previewId']
    body = {'previewId': preview, 'duration': 5, 'resolution': '480'}
    assert client.post(base + '/videos', json=body).status_code == 409  # not selected yet
    client.post(base + '/select')
    assert client.post(base + '/videos', json={**body, 'duration': 10}).status_code == 422
    assert client.post(base + '/videos', json={**body, 'resolution': '1080'}).status_code == 422
    assert client.post(base + '/videos', json={**body, 'previewId': 'nope'}).status_code == 409
    video = client.post(base + '/videos', json=body)
    assert video.status_code == 200
    assert client.post(base + '/videos', json=body).json() == video.json()
    assert youcam[-1]['source_url'] == 'https://example.com/preview'
    assert client.get('/api/videos/' + video.json()['videoId']).json() == {'status': 'success', 'videoUrl': 'https://example.com/video'}
    assert client.get('/api/videos/nope').status_code == 404


def test_failed_video_can_be_retried_without_losing_the_quota(youcam):
    p = proposal()
    base = f"/api/proposals/{p['id']}"
    preview = client.post(base + '/previews', json={'itemId': p['items'][0]['itemId']}).json()['previewId']
    client.post(base + '/select')
    body = {'previewId': preview, 'duration': 5, 'resolution': '480'}
    first = client.post(base + '/videos', json=body).json()['videoId']
    task = module.videos[first]
    module.jobs.fail(task, youcam[-1]['session'], 'The try-on service could not finish this one. Please try again.', 'test')
    assert client.get('/api/videos/' + first).json()['status'] == 'failed'
    second = client.post(base + '/videos', json=body)
    assert second.status_code == 200 and second.json()['videoId'] != first


def test_generation_limits_are_reported_clearly(youcam):
    p = proposal(budget=200)
    base = f"/api/proposals/{p['id']}"
    module.jobs.session_limit['preview'] = 1
    assert client.post(base + '/previews', json={'itemId': p['items'][0]['itemId']}).status_code == 200
    replaced = client.post(base + '/replace', json={'itemId': p['items'][0]['itemId']}).json()
    limited = client.post(base + '/previews', json={'itemId': replaced['items'][0]['itemId']})
    assert limited.status_code == 429 and 'limit' in limited.json()['error']


def test_expired_photo_asks_for_a_new_upload(youcam):
    p = proposal()
    module.photos.clear()
    response = client.post(f"/api/proposals/{p['id']}/previews", json={'itemId': p['items'][0]['itemId']})
    assert response.status_code == 410


def test_idle_sessions_expire_but_active_ones_do_not():
    idle, active = proposal(), proposal()
    module.proposals[idle['id']]['touched'] -= module.TTL + 5
    module.proposals[active['id']]['touched'] -= module.TTL - 5
    before = module.proposals[active['id']]['touched']
    assert client.post(f"/api/proposals/{active['id']}/select").status_code == 200
    assert module.proposals[active['id']]['touched'] > before + 100
    module.clean()
    assert idle['id'] not in module.proposals and active['id'] in module.proposals


# --- static pieces ---------------------------------------------------------------------

def test_health_catalog_product_pages_and_assets():
    assert client.get('/api/health').json() == {'status': 'ok', 'youcamConfigured': False}
    catalog_response = client.get('/api/catalogs/northline').json()
    assert len(catalog_response['items']) == 10 and all(set(i) == ITEM_KEYS for i in catalog_response['items'])
    image = client.get(catalog_response['items'][0]['imageUrl'].replace('http://localhost:8000', ''))
    assert image.status_code == 200 and image.headers['content-type'] == 'image/png'
    page = client.get(f"/shop/northline/{catalog_response['items'][0]['itemId']}")
    assert page.status_code == 200 and 'Racer zip jacket' in page.text and 'sample store' in page.text
    assert client.get('/shop/northline/missing').status_code == 404
    assert client.get('/api/catalogs/nope').status_code == 404


def test_cors_allows_the_frontend_only():
    ask = {'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type'}
    allowed = client.options('/api/briefs', headers={'Origin': 'http://localhost:3000', **ask})
    assert allowed.status_code == 200 and allowed.headers['access-control-allow-origin'] == 'http://localhost:3000'
    assert 'PATCH' in allowed.headers['access-control-allow-methods']
    denied = client.options('/api/briefs', headers={'Origin': 'https://evil.example', **ask})
    assert 'access-control-allow-origin' not in denied.headers
