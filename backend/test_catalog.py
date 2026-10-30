import catalog

BRIEF = 'silver and black concert look'


def test_catalogs_are_well_formed_and_differ():
    assert list(catalog.STORES) == ['northline', 'mono-studio']
    ids = set()
    for store_id, store in catalog.STORES.items():
        assert 8 <= len(store['items']) <= 12
        for item in store['items']:
            assert item['itemId'] not in ids
            ids.add(item['itemId'])
            assert item['itemId'].startswith(store_id)
            assert item['category'] in ('top', 'outer', 'bottom', 'bag')
            assert item['price'] > 0
            assert set(item['sizesInStock']) <= set(catalog.SIZES)
            assert (item['category'] == 'bag') == (item['sizesInStock'] == [])
            assert item['styleTags'] and all(tag == tag.lower() for tag in item['styleTags'])
            assert catalog.image_file(item).is_file()
    names = [{i['name'] for i in s['items']} for s in catalog.STORES.values()]
    assert not names[0] & names[1]


def test_each_store_gives_a_different_proposal_within_budget():
    north, north_reason = catalog.propose('northline', 'M', 120, BRIEF, ['boots'])
    mono, mono_reason = catalog.propose('mono-studio', 'M', 120, BRIEF, ['boots'])
    assert [i['name'] for i in north] == ['Chrome bomber', 'Disc crossbody bag']
    assert [i['name'] for i in mono] == ['Shine zip jacket', 'Nova chain bag']
    assert sum(i['price'] for i in north) <= 120 and sum(i['price'] for i in mono) <= 120
    assert 'concert' in north_reason and '$114' in north_reason and '$120' in north_reason
    assert 'silver' in mono_reason


def test_proposal_items_are_in_the_requested_size():
    for store_id in catalog.STORES:
        items, _ = catalog.propose(store_id, 'S', 150, BRIEF, [])
        assert items and 'S' in items[0]['sizesInStock']


def test_empty_proposals_explain_why():
    items, reason = catalog.propose('northline', 'M', 20, BRIEF, [])
    assert items == [] and reason == 'Nothing in size M came in under $20.'
    items, reason = catalog.propose('northline', 'XXL', 500, BRIEF, [])
    assert items == [] and 'Northline has nothing in size XXL' in reason


def test_kept_bag_is_not_sold_again():
    items, _ = catalog.propose('northline', 'M', 200, BRIEF, ['my black bag'])
    assert items and all(i['category'] != 'bag' for i in items)


def current(store_id, item_id, size='M'):
    item = catalog.find(store_id, item_id)
    return {'itemId': item_id, 'category': item['category'], 'price': item['price'], 'size': size if item['sizesInStock'] else None}


def test_replacement_stays_in_category_size_and_budget():
    racer = current('northline', 'northline_racer')
    chosen = catalog.replacement('northline', racer, [], 120, BRIEF)
    assert chosen['category'] == 'outer' and chosen['itemId'] != 'northline_racer' and 'M' in chosen['sizesInStock']
    assert catalog.replacement('northline', racer, [], 80, BRIEF)['itemId'] == 'northline_vinyl'
    assert catalog.replacement('northline', racer, [], 60, BRIEF) is None


def test_replacement_honors_instruction_and_room_left_by_other_items():
    racer = current('northline', 'northline_racer')
    cheaper = catalog.replacement('northline', racer, [], 200, BRIEF, 'something cheaper')
    assert cheaper['price'] == min(i['price'] for i in catalog.STORES['northline']['items'] if i['category'] == 'outer' and 'M' in i['sizesInStock'] and i['itemId'] != 'northline_racer')
    red = catalog.replacement('northline', current('northline', 'northline_tee'), [], 200, BRIEF, 'red please')
    assert red['itemId'] == 'northline_rib_tank'
    bag = {'itemId': 'northline_disc', 'category': 'bag', 'price': 18, 'size': None}
    other = {'itemId': 'northline_racer', 'category': 'outer', 'price': 89, 'size': 'M'}
    assert catalog.replacement('northline', bag, [other], 100, BRIEF) is None
    assert catalog.replacement('northline', bag, [other], 106, BRIEF)['itemId'] == 'northline_mini'


def test_bag_replacement_stays_a_bag():
    bag = current('northline', 'northline_disc')
    chosen = catalog.replacement('northline', bag, [], 100, BRIEF)
    assert chosen['category'] == 'bag' and chosen['sizesInStock'] == []


def test_out_of_stock_alternatives_have_the_requested_size():
    racer = current('northline', 'northline_racer')
    options = catalog.in_size('northline', racer, [], 'XL', 200)
    assert [i['itemId'] for i in options] == ['northline_chrome']
    assert catalog.in_size('northline', racer, [], 'XL', 50) == []


def test_money_formatting():
    assert catalog.money(114) == '$114' and catalog.money(99.5) == '$99.50' and catalog.money(1200) == '$1,200'
