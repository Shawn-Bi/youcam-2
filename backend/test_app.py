from io import BytesIO
from PIL import Image
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def png():
    output = BytesIO()
    Image.new('RGB', (10, 10), 'white').save(output, format='PNG')
    return output.getvalue()

def test_brief_and_revision():
    response = client.post('/api/photos', data={'consent':'true'}, files={'photo':('test.png', png(), 'image/png')})
    assert response.status_code == 200
    photo = response.json()['photoId']
    response = client.post('/api/briefs', json={'photoId':photo, 'text':'black concert', 'budget':120, 'occasion':'concert', 'sizes':{'top':'M'}, 'keep':['boots']})
    assert response.status_code == 200
    data = response.json()
    assert len(data['proposals']) == 2
    p = data['proposals'][0]
    assert p['subtotal'] <= 120 and p['kept'] == ['boots']
    item = p['items'][0]
    response = client.patch(f"/api/proposals/{p['id']}/items/{item['itemId']}", json={'size':'unavailable'})
    assert response.status_code == 409 and response.json()['code'] == 'out_of_stock'
    response = client.post(f"/api/proposals/{p['id']}/replace", json={'itemId':item['itemId']})
    assert response.status_code == 200 and response.json()['version'] == 2 and response.json()['subtotal'] <= 120
    assert client.post(f"/api/proposals/{p['id']}/select").json()['selected']

def test_upload_and_budget_validation():
    assert client.post('/api/photos', data={'consent':'false'}, files={'photo':('a.png', b'bad', 'image/png')}).status_code == 422
    assert client.post('/api/briefs', json={'photoId':'missing', 'text':'', 'budget':0, 'occasion':'', 'sizes':{}, 'keep':[]}).status_code == 422

def test_malformed_brief_has_contract_errors():
    response = client.post('/api/briefs', json={'budget': 'bad'})
    assert response.status_code == 422
    assert 'budget' in response.json()['errors']
    assert 'photoId' in response.json()['errors']

def test_bad_item_patch_is_rejected():
    response = client.post('/api/photos', data={'consent':'true'}, files={'photo':('test.png', png(), 'image/png')})
    payload = {'photoId':response.json()['photoId'], 'text':'concert', 'budget':120, 'occasion':'concert', 'sizes':{'top':'M'}, 'keep':[]}
    proposal = client.post('/api/briefs', json=payload).json()['proposals'][0]
    item_id = proposal['items'][0]['itemId']
    response = client.patch(f"/api/proposals/{proposal['id']}/items/{item_id}", json={'size': []})
    assert response.status_code == 422


def test_rejects_corrupt_images():
    response = client.post('/api/photos', data={'consent':'true'}, files={'photo':('fake.png', b'\x89PNG\r\n\x1a\ninvalid', 'image/png')})
    assert response.status_code == 422

def test_catalog_images_are_served():
    catalog = client.get('/api/catalogs/northline')
    assert catalog.status_code == 200
    assert len(catalog.json()['items']) == 8
    path = catalog.json()['items'][0]['imageUrl'].replace('http://localhost:8000', '')
    image = client.get(path)
    assert image.status_code == 200
    assert image.headers['content-type'] == 'image/png'

def test_preview_video_reuse_and_stale_guard(monkeypatch):
    import app as module
    monkeypatch.setenv('YOUCAM_API_KEY', 'test-key')
    monkeypatch.setattr(module, 'PUBLIC_BASE_URL', 'https://example.com')
    def fake_start(task, key, **kwargs):
        task.update(status='success')
        if task['kind'] == 'preview': task['imageUrl'] = 'https://example.com/preview.png'
        else: task['videoUrl'] = 'https://example.com/video.mp4'
    monkeypatch.setattr(module.jobs, 'start', fake_start)
    photo = client.post('/api/photos', data={'consent':'true'}, files={'photo':('test.png', png(), 'image/png')}).json()['photoId']
    p = client.post('/api/briefs', json={'photoId':photo, 'text':'concert', 'budget':120, 'occasion':'concert','sizes':{'top':'M'},'keep':[]}).json()['proposals'][0]
    base = f"/api/proposals/{p['id']}"
    item = p['items'][0]
    preview = client.post(base+'/previews',json={'itemId':item['itemId']})
    assert preview.status_code == 200
    preview_id = preview.json()['previewId']
    assert client.post(base+'/previews',json={'itemId':item['itemId']}).json()['previewId'] == preview_id
    assert client.get('/api/previews/'+preview_id).json() == {'status':'success','imageUrl':'https://example.com/preview.png'}
    video_body = {'previewId':preview_id,'duration':5,'resolution':'480'}
    assert client.post(base+'/videos',json=video_body).status_code == 409
    assert client.post(base+'/select').status_code == 200
    video = client.post(base+'/videos',json=video_body)
    assert video.status_code == 200
    assert client.get('/api/videos/'+video.json()['videoId']).json()['status'] == 'success'
    client.patch(base+'/items/'+item['itemId'],json={'size':'S'})
    assert client.post(base+'/videos',json=video_body).status_code == 409

def test_lock_does_not_invalidate_preview(monkeypatch):
    import app as module
    monkeypatch.setenv('YOUCAM_API_KEY', 'test-key')
    monkeypatch.setattr(module, 'PUBLIC_BASE_URL', 'https://example.com')
    def fake_start(task, key, **kwargs):
        task.update(status='success', imageUrl='https://example.com/preview.png')
    monkeypatch.setattr(module.jobs, 'start', fake_start)
    photo = client.post('/api/photos', data={'consent':'true'}, files={'photo':('photo.png',png(),'image/png')}).json()['photoId']
    p = client.post('/api/briefs',json={'photoId':photo,'text':'concert','budget':120,'occasion':'concert','sizes':{'top':'M'},'keep':[]}).json()['proposals'][0]
    base = '/api/proposals/'+p['id']
    item = p['items'][0]
    tid = client.post(base+'/previews',json={'itemId':item['itemId']}).json()['previewId']
    assert client.patch(base+'/items/'+item['itemId'],json={'locked':True}).status_code == 200
    assert client.post(base+'/previews',json={'itemId':item['itemId']}).json()['previewId'] == tid
    assert module.preview_is_current(module.previews[tid], module.proposals[p['id']])
