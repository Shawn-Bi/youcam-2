"""The shared catalog and the rule-based proposal builder.

The four sample stores live in frontend/data/catalog.json, which Dennis owns and the shop pages read too,
so items, prices and photos match everywhere. Code, not a model, decides every item, size, price and subtotal.
"""
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SIZES = ('XS', 'S', 'M', 'L', 'XL', 'XXL')
UPPER = ('top', 'outer')  # one outfit slot: a top or a jacket
# Words in "pieces I keep" that mean the shopper already owns that kind of item.
OWNED_WORDS = {
    'bag': {'bag', 'bags', 'purse', 'handbag', 'tote', 'backpack', 'clutch', 'sling'},
    'outer': {'jacket', 'coat', 'blazer', 'bomber', 'outerwear'},
    'top': {'top', 'tee', 'shirt', 'tank', 'hoodie', 'sweater', 'blouse', 'cami'},
    'bottom': {'trousers', 'pants', 'jeans', 'skirt', 'shorts', 'bottoms'},
}
CHEAPER = {'cheaper', 'cheap', 'affordable', 'inexpensive'}
PRICIER = {'pricier', 'premium', 'expensive', 'upgrade', 'luxury'}


def catalog_path():
    """CATALOG_FILE, else the shared file in the repo, else a copy next to this module."""
    for candidate in (os.getenv('CATALOG_FILE'), REPO / 'frontend' / 'data' / 'catalog.json', ROOT / 'catalog.json'):
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise FileNotFoundError('catalog.json not found: expected frontend/data/catalog.json or CATALOG_FILE')


def load(path):
    """Stores keyed by id in the order the file lists them, each with its items."""
    data = json.loads(path.read_text(encoding='utf-8'))
    stores = {s['storeId']: {**s, 'storeName': s['name'], 'items': []} for s in data['stores']}
    for item in data['items']:
        stores[item['storeId']]['items'].append(item)
    return stores


CATALOG_FILE = catalog_path()
STORES = load(CATALOG_FILE)
ITEMS = [item for store in STORES.values() for item in store['items']]
PUBLIC_DIR = CATALOG_FILE.parent.parent / 'public'  # product photos sit at PUBLIC_DIR + item['imageUrl']


def tokens(text):
    return re.findall(r'[a-z0-9]+', text.lower())


def normalize(text):
    """Lower-cased words with single spaces and padding, so a phrase like "night out" can be found whole."""
    return ' ' + ' '.join(tokens(text)) + ' '


def money(amount):
    return '$' + f'{amount:,.2f}'.removesuffix('.00')


def terms(item):
    return item['styleTags'] + item['colors']


def matches(term, wanted):
    return f" {' '.join(tokens(term))} " in wanted


def relevance(item, wanted):
    return sum(matches(term, wanted) for term in terms(item))


def public_item(item, size):
    """The Item shape from the shared API contract. Image and product links stay relative, as in the catalog."""
    return {
        'itemId': item['itemId'], 'name': item['name'], 'category': item['category'], 'price': item['price'],
        'size': size if item['sizesInStock'] else None, 'sizesInStock': list(item['sizesInStock']),
        'imageUrl': item['imageUrl'], 'productUrl': item['productUrl'], 'locked': False,
    }


def find(item_id):
    return next((i for i in ITEMS if i['itemId'] == item_id), None)


def find_anchor(text, item_id=None):
    """The piece a brief is built around: given by id, or named in the text ("Build a look around the Grey knit sweater…")."""
    if item_id:
        return find(item_id)
    lowered = text.lower()
    return next((i for i in ITEMS if i['name'].lower() in lowered), None)


def image_file(item):
    """Local path of the product photo, which is what YouCam receives as the garment."""
    return PUBLIC_DIR / item['imageUrl'].lstrip('/')


def owned_categories(keep):
    wanted = set(tokens(' '.join(keep)))
    return {category for category, names in OWNED_WORDS.items() if wanted & names}


def slot(item):
    return 'upper' if item['category'] in UPPER else item['category']


def size_for(item, size, bottom_size=None):
    """Bottoms use the bottoms size when given, everything else the top size."""
    return (bottom_size or size) if item['category'] == 'bottom' else size


def fits(item, size, bottom_size=None):
    return not item['sizesInStock'] or size_for(item, size, bottom_size) in item['sizesInStock']


def list_names(items):
    names = [i['name'] for i in items]
    return ' and '.join(names) if len(names) <= 2 else ', '.join(names[:-1]) + ' and ' + names[-1]


def rationale(items, wanted, subtotal, budget, anchor=None):
    """Describes only the items passed in, so it can never mention a product that is not in the proposal."""
    budget_note = f'{money(subtotal)} of your {money(budget)} budget.'
    if anchor:
        others = [i for i in items if i['itemId'] != anchor['itemId']]
        lead = f"Built around the {anchor['name']} you picked, with {list_names(others)} to finish the look." if others else f"Built around the {anchor['name']} you picked."
        return f'{lead} {budget_note}'
    matched = sorted({t for i in items for t in terms(i) if matches(t, wanted)})
    lead = f"{list_names(items)}, matched to your {', '.join(matched)} look." if matched else f'{list_names(items)}, the closest in-stock match for your size.'
    return f'{lead} {budget_note}'


def propose(store_id, size, budget, text, keep, bottom_size=None, anchor=None):
    """One outfit from a store: an upper piece, optional bottoms (only when a brief is built around them) and an optional bag.

    Returns (items, rationale), with the upper piece first. `anchor` is a piece the shopper picked: it is used as is
    when it belongs to this store and comes in the shopper's size, and takes over its slot (a top and a jacket share one).
    """
    store = STORES[store_id]
    wanted = normalize(text)
    owned = owned_categories(keep)
    anchor = anchor if anchor and anchor['storeId'] == store_id and fits(anchor, size, bottom_size) else None
    pinned = {slot(anchor): anchor} if anchor else {}
    in_size = [i for i in store['items'] if fits(i, size, bottom_size)]
    uppers = [i for i in in_size if slot(i) == 'upper']
    upper_options = [pinned['upper']] if 'upper' in pinned else ([i for i in uppers if i['category'] not in owned] or uppers)
    bottom_options = [pinned['bottom']] if 'bottom' in pinned else [None]
    bags = [i for i in in_size if i['category'] == 'bag']
    bag_options = [pinned['bag']] if 'bag' in pinned else [None] + ([] if 'bag' in owned else bags)
    combos = [
        [i for i in (upper, bottom, bag) if i]
        for upper in (upper_options or [None]) for bottom in bottom_options for bag in bag_options
    ]
    combos = [c for c in combos if any(i['category'] != 'bag' for i in c)]
    if not combos:
        return [], f"{store['storeName']} has nothing in size {size} for this brief."
    affordable = [c for c in combos if sum(i['price'] for i in c) <= budget]
    if not affordable:
        return [], f'Nothing in size {size} came in under {money(budget)}.'

    def key(combo):
        total = sum(i['price'] for i in combo)
        score = sum((3 if slot(i) == 'upper' else 1) * relevance(i, wanted) + (i['category'] == 'bag') for i in combo)
        return (-score, budget - total, [i['itemId'] for i in combo])

    best = min(affordable, key=key)
    return best, rationale(best, wanted, sum(i['price'] for i in best), budget, anchor)


def replacement(store_id, current, others, budget, text, instruction=None):
    """Another in-stock item of the same category and size that keeps the proposal within budget, or None."""
    wanted = normalize(text)
    asked = normalize(instruction or '')
    asked_words = set(tokens(instruction or ''))
    used = {i['itemId'] for i in others} | {current['itemId']}
    room = budget - sum(i['price'] for i in others)
    options = [
        i for i in STORES[store_id]['items']
        if i['category'] == current['category'] and i['itemId'] not in used and i['price'] <= room
        and (current['size'] in i['sizesInStock'] if i['sizesInStock'] else current['size'] is None)
    ]
    if not options:
        return None
    lean = 1 if asked_words & CHEAPER else -1 if asked_words & PRICIER else 0
    options.sort(key=lambda i: (-relevance(i, asked), lean * i['price'], -relevance(i, wanted), abs(i['price'] - current['price']), i['itemId']))
    return options[0]


def in_size(store_id, current, others, size, budget):
    """Same-category items in `size`, offered when the requested size of an item is out of stock."""
    used = {i['itemId'] for i in others} | {current['itemId']}
    room = budget - sum(i['price'] for i in others)
    return [i for i in STORES[store_id]['items'] if i['category'] == current['category'] and i['itemId'] not in used and size in i['sizesInStock'] and i['price'] <= room]
