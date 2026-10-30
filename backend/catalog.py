"""Sample store catalogs and the rule-based proposal builder.

Code decides every item, size, price and subtotal a shopper sees; no model is involved.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SIZES = ('XS', 'S', 'M', 'L', 'XL', 'XXL')
CLOTHING = ('top', 'outer')
# Words in "pieces I keep" that mean the shopper already owns that kind of item.
OWNED_WORDS = {
    'bag': {'bag', 'bags', 'purse', 'handbag', 'tote', 'backpack', 'clutch'},
    'outer': {'jacket', 'coat', 'blazer', 'bomber', 'outerwear'},
    'top': {'top', 'tee', 'shirt', 'tank', 'hoodie', 'sweater', 'blouse'},
}
CHEAPER = {'cheaper', 'cheap', 'affordable', 'inexpensive'}
PRICIER = {'pricier', 'premium', 'expensive', 'upgrade', 'luxury'}


def load():
    """Stores keyed by id, in the order shoppers see them (`position` in each catalog file)."""
    found = [json.loads(path.read_text(encoding='utf-8')) for path in (ROOT / 'catalogs').glob('*.json')]
    return {data['storeId']: data for data in sorted(found, key=lambda data: data.get('position', 99))}


STORES = load()


def words(text):
    return set(re.findall(r'[a-z0-9]+', text.lower()))


def money(amount):
    return '$' + f'{amount:,.2f}'.removesuffix('.00')


def relevance(item, wanted):
    return sum(tag in wanted for tag in item['styleTags'])


def public_item(store_id, item, size, base_url):
    """The Item shape from the shared API contract."""
    return {
        'itemId': item['itemId'], 'name': item['name'], 'category': item['category'], 'price': item['price'],
        'size': size if item['sizesInStock'] else None, 'sizesInStock': list(item['sizesInStock']),
        'imageUrl': base_url + item['imagePath'], 'productUrl': f"{base_url}/shop/{store_id}/{item['itemId']}",
        'locked': False,
    }


def find(store_id, item_id):
    return next((i for i in STORES[store_id]['items'] if i['itemId'] == item_id), None)


def image_file(item):
    """Local path of the product illustration, which is what YouCam receives as the garment."""
    return ROOT / item['imagePath'].lstrip('/').replace('assets/', 'static/', 1)


def owned_categories(keep):
    wanted = words(' '.join(keep))
    return {category for category, names in OWNED_WORDS.items() if wanted & names}


def rationale(items, wanted, subtotal, budget):
    names = ' and '.join(i['name'] for i in items)
    matched = sorted({t for i in items for t in i['styleTags'] if t in wanted})
    lead = f"{names}, matched to your {', '.join(matched)} look." if matched else f'{names}, the closest in-stock match for your size.'
    return f'{lead} {money(subtotal)} of your {money(budget)} budget.'


def propose(store_id, size, budget, text, keep):
    """Pick the best main piece (top or jacket) plus an optional bag. Returns (items, rationale)."""
    store = STORES[store_id]
    wanted = words(text)
    owned = owned_categories(keep)
    pieces = [i for i in store['items'] if i['category'] in CLOTHING and size in i['sizesInStock']]
    mains = [i for i in pieces if i['category'] not in owned] or pieces
    if not mains:
        return [], f"{store['storeName']} has nothing in size {size} for this brief."
    mains = [i for i in mains if i['price'] <= budget]
    if not mains:
        return [], f'Nothing in size {size} came in under {money(budget)}.'
    bags = [] if 'bag' in owned else [i for i in store['items'] if i['category'] == 'bag']
    best = None
    for main in mains:
        for combo in [(main,)] + [(main, bag) for bag in bags if main['price'] + bag['price'] <= budget]:
            total = sum(i['price'] for i in combo)
            score = 3 * relevance(main, wanted) + sum(relevance(b, wanted) + 1 for b in combo[1:])
            key = (-score, budget - total, tuple(i['itemId'] for i in combo))
            if best is None or key < best[0]:
                best = (key, combo, total)
    _, combo, total = best
    return list(combo), rationale(combo, wanted, total, budget)


def replacement(store_id, current, others, budget, text, instruction=None):
    """Another in-stock item of the same category and size that keeps the proposal within budget, or None."""
    wanted = words(text)
    asked = words(instruction or '')
    used = {i['itemId'] for i in others} | {current['itemId']}
    room = budget - sum(i['price'] for i in others)
    options = [
        i for i in STORES[store_id]['items']
        if i['category'] == current['category'] and i['itemId'] not in used and i['price'] <= room
        and (current['size'] in i['sizesInStock'] if i['sizesInStock'] else current['size'] is None)
    ]
    if not options:
        return None
    lean = 1 if asked & CHEAPER else -1 if asked & PRICIER else 0
    options.sort(key=lambda i: (-relevance(i, asked), lean * i['price'], -relevance(i, wanted), abs(i['price'] - current['price']), i['itemId']))
    return options[0]


def in_size(store_id, current, others, size, budget):
    """Same-category items in `size`, offered when the requested size of an item is out of stock."""
    used = {i['itemId'] for i in others} | {current['itemId']}
    room = budget - sum(i['price'] for i in others)
    return [i for i in STORES[store_id]['items'] if i['category'] == current['category'] and i['itemId'] not in used and size in i['sizesInStock'] and i['price'] <= room]
