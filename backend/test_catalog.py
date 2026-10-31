import catalog

BRIEF = 'Silver-and-black concert look, under $120. Keep my boots.'


def item(item_id, size='M'):
    found = catalog.find(item_id)
    return {'itemId': item_id, 'category': found['category'], 'price': found['price'], 'size': size if found['sizesInStock'] else None}


def ids(items):
    return [i['itemId'] for i in items]


def test_the_shared_catalog_loads_with_four_stores_and_real_photos():
    assert catalog.CATALOG_FILE == catalog.REPO / 'frontend' / 'data' / 'catalog.json'
    assert list(catalog.STORES) == ['northline', 'mono-studio', 'sol-social', 'haven']
    assert len(catalog.ITEMS) == 48 and len({i['itemId'] for i in catalog.ITEMS}) == 48
    for store_id, store in catalog.STORES.items():
        assert len(store['items']) == 12 and {i['category'] for i in store['items']} == {'top', 'outer', 'bottom', 'bag'}
        for i in store['items']:
            assert i['storeId'] == store_id and i['price'] > 0 and set(i['sizesInStock']) <= set(catalog.SIZES)
            assert (i['category'] == 'bag') == (i['sizesInStock'] == [])
            assert i['styleTags'] and i['imageUrl'].startswith('/catalog/') and i['productUrl'] == '/products/' + i['itemId']
            assert catalog.image_file(i).is_file()


def test_public_items_match_the_contract_and_keep_relative_links():
    racer = catalog.public_item(catalog.find('nl_racer_jacket'), 'M')
    assert racer == {
        'itemId': 'nl_racer_jacket', 'name': 'Racer leather jacket', 'category': 'outer', 'price': 89, 'size': 'M', 'sizesInStock': ['S', 'M', 'L'],
        'imageUrl': '/catalog/nl_racer_jacket.jpg', 'productUrl': '/products/nl_racer_jacket', 'locked': False,
    }
    assert catalog.public_item(catalog.find('nl_luna_bag'), 'M')['size'] is None


def test_each_store_answers_the_demo_brief_with_its_own_outfit():
    expected = {
        'northline': (['nl_racer_jacket', 'nl_luna_bag'], 114), 'mono-studio': (['ms_shine_jacket', 'ms_nova_bag'], 108),
        'sol-social': (['sol_sequin_tank', 'sol_disco_bag'], 70), 'haven': (['hv_quilted_jacket', 'hv_canvas_sling'], 112),
    }
    for store_id, (item_ids, total) in expected.items():
        items, reason = catalog.propose(store_id, 'M', 120, BRIEF, ['Black boots'])
        assert ids(items) == item_ids and sum(i['price'] for i in items) == total
        assert f'${total} of your $120 budget' in reason and 'concert' in reason


def test_proposals_respect_size_budget_and_slots_for_every_store_and_size():
    for store_id in catalog.STORES:
        for size in catalog.SIZES:
            for budget in (40, 80, 120, 300):
                items, reason = catalog.propose(store_id, size, budget, BRIEF, [])
                if not items:
                    assert reason
                    continue
                assert sum(i['price'] for i in items) <= budget
                assert all(not i['sizesInStock'] or size in i['sizesInStock'] for i in items)
                assert catalog.slot(items[0]) == 'upper' and [catalog.slot(i) for i in items].count('upper') == 1
                assert [i['category'] for i in items].count('bag') <= 1


def test_empty_proposals_explain_why():
    items, reason = catalog.propose('northline', 'M', 20, BRIEF, [])
    assert items == [] and reason == 'Nothing in size M came in under $20.'
    items, reason = catalog.propose('northline', 'XXS', 500, BRIEF, [])
    assert items == [] and 'Northline has nothing in size XXS' in reason


def test_a_bag_alone_is_never_a_look():
    items, reason = catalog.propose('northline', 'XS', 30, BRIEF, [])  # bags fit the budget, but no clothing does
    assert items == [] and reason == 'Nothing in size XS came in under $30.'


def test_kept_bag_is_not_sold_again():
    items, _ = catalog.propose('northline', 'M', 200, BRIEF, ['my black bag'])
    assert ids(items) == ['nl_racer_jacket']


def test_a_piece_is_found_by_id_or_by_name_in_the_text():
    assert catalog.find_anchor('Build a look around the Grey knit sweater from Mono Studio.')['itemId'] == 'ms_knit_sweater'
    assert catalog.find_anchor('build a look around the grey KNIT sweater')['itemId'] == 'ms_knit_sweater'
    assert catalog.find_anchor(BRIEF) is None
    assert catalog.find_anchor('anything', 'nl_luna_bag')['itemId'] == 'nl_luna_bag'
    assert catalog.find_anchor('anything', 'nope') is None


def test_the_store_that_sells_the_piece_builds_around_it_and_the_others_do_not():
    anchor = catalog.find('ms_knit_sweater')
    text = 'Build a look around the Grey knit sweater from Mono Studio.'
    items, reason = catalog.propose('mono-studio', 'M', 150, text, [], None, anchor)
    assert ids(items) == ['ms_knit_sweater', 'ms_nova_bag'] and reason.startswith('Built around the Grey knit sweater you picked')
    for other in ('northline', 'sol-social', 'haven'):
        items, reason = catalog.propose(other, 'M', 150, text, [], None, anchor)
        assert items and 'ms_knit_sweater' not in ids(items) and not reason.startswith('Built around')


def test_a_top_and_a_jacket_share_one_slot_so_the_picked_piece_replaces_the_other():
    jacket = catalog.find('ms_wool_blazer')
    items, _ = catalog.propose('mono-studio', 'M', 300, 'a look around the blazer', [], None, jacket)
    assert items[0]['itemId'] == 'ms_wool_blazer' and [i['category'] for i in items].count('outer') == 1 and 'top' not in [i['category'] for i in items]


def test_a_picked_bottom_goes_between_the_upper_piece_and_the_bag_and_uses_the_bottoms_size():
    trouser = catalog.find('ms_pleat_trouser')  # sizes S, M, L
    items, reason = catalog.propose('mono-studio', 'XS', 300, 'a work look', [], 'L', trouser)
    assert [i['category'] for i in items][:2] == [items[0]['category'], 'bottom'] and items[0]['category'] in catalog.UPPER
    assert 'ms_pleat_trouser' in ids(items) and reason.startswith('Built around the Pleated grey trousers')
    assert catalog.size_for(trouser, 'XS', 'L') == 'L' and catalog.size_for(trouser, 'XS') == 'XS'
    # Without a bottoms size the top size applies, and XS is not in stock, so the piece cannot be used.
    items, reason = catalog.propose('mono-studio', 'XS', 300, 'a work look', [], None, trouser)
    assert 'ms_pleat_trouser' not in ids(items)


def test_a_picked_bag_still_needs_clothes_and_a_picked_piece_over_budget_means_no_match():
    bag = catalog.find('ms_nova_bag')
    items, _ = catalog.propose('mono-studio', 'M', 200, 'build around the Nova chain bag', [], None, bag)
    assert 'ms_nova_bag' in ids(items) and items[0]['category'] in catalog.UPPER
    blazer = catalog.find('ms_wool_blazer')
    items, reason = catalog.propose('mono-studio', 'M', 50, 'build around the Boxy wool blazer', [], None, blazer)  # the blazer costs $98
    assert items == [] and reason == 'Nothing in size M came in under $50.'


def test_replacement_stays_in_category_size_and_budget():
    racer = item('nl_racer_jacket')
    assert catalog.replacement('northline', racer, [], 200, BRIEF)['itemId'] == 'nl_chrome_bomber'
    assert catalog.replacement('northline', racer, [], 80, BRIEF)['itemId'] == 'nl_vinyl_jacket'
    assert catalog.replacement('northline', racer, [], 60, BRIEF) is None
    assert catalog.replacement('northline', item('nl_vinyl_jacket', 'S'), [], 200, BRIEF)['itemId'] == 'nl_racer_jacket'
    assert catalog.replacement('northline', item('nl_vinyl_jacket', 'XS'), [], 200, BRIEF) is None  # no other jacket comes in XS


def test_replacement_honors_instruction_and_room_left_by_other_items():
    racer = item('nl_racer_jacket')
    assert catalog.replacement('northline', racer, [], 200, BRIEF, 'something cheaper')['itemId'] == 'nl_vinyl_jacket'
    assert catalog.replacement('northline', item('nl_vinyl_jacket'), [], 200, BRIEF, 'pricier please')['itemId'] == 'nl_chrome_bomber'
    assert catalog.replacement('northline', item('nl_studded_tee'), [], 200, BRIEF, 'silver')['itemId'] == 'nl_chrome_cami'
    bag, other = item('nl_luna_bag'), item('nl_racer_jacket')
    assert catalog.replacement('northline', bag, [other], 100, BRIEF) is None
    assert catalog.replacement('northline', bag, [other], 104, BRIEF)['itemId'] == 'nl_mesh_bag'


def test_bag_replacement_stays_a_bag():
    chosen = catalog.replacement('northline', item('nl_luna_bag'), [], 100, BRIEF)
    assert chosen['category'] == 'bag' and chosen['sizesInStock'] == []


def test_out_of_stock_alternatives_have_the_requested_size():
    racer = item('nl_racer_jacket')
    assert ids(catalog.in_size('northline', racer, [], 'XL', 200)) == ['nl_chrome_bomber']
    assert ids(catalog.in_size('northline', racer, [], 'XS', 200)) == ['nl_vinyl_jacket']
    assert catalog.in_size('northline', racer, [], 'XL', 50) == []


def test_money_formatting():
    assert catalog.money(114) == '$114' and catalog.money(99.5) == '$99.50' and catalog.money(1200) == '$1,200'
