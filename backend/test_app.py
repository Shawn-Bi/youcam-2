from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_brief_and_revision():
    response = client.post('/api/photos', data={'consent':'true'}, files={'photo':('test.png', b'\x89PNG\r\n\x1a\nfixture', 'image/png')})
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
    response = client.post('/api/photos', data={'consent':'true'}, files={'photo':('test.png', b'\x89PNG\r\n\x1a\nfixture', 'image/png')})
    payload = {'photoId':response.json()['photoId'], 'text':'concert', 'budget':120, 'occasion':'concert', 'sizes':{'top':'M'}, 'keep':[]}
    proposal = client.post('/api/briefs', json=payload).json()['proposals'][0]
    item_id = proposal['items'][0]['itemId']
    response = client.patch(f"/api/proposals/{proposal['id']}/items/{item_id}", json={'size': []})
    assert response.status_code == 422
