"""Draws the sample-store product illustrations and writes catalogs/*.json from the specs below.

Run from backend/:  python tools/make_catalog.py
Every illustration is original artwork drawn by this script; none is a photograph of real merchandise.
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
W, H, S, CX = 768, 1024, 2, 384
BG = (244, 242, 236)
LICENSE = 'Original project illustration; not a photograph of a real product.'


def rgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def dark(c, t=0.35):
    return mix(c, (0, 0, 0), t)


def light(c, t=0.35):
    return mix(c, (255, 255, 255), t)


def sym(half):
    """Mirror the left half of a silhouette (offsets from the centre line) into a closed polygon."""
    left = [(CX + dx, y) for dx, y in half]
    return left + [(2 * CX - x, y) for x, y in reversed(left)]


class Pen:
    def __init__(self):
        self.img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    @staticmethod
    def pts(points):
        return [(x * S, y * S) for x, y in points]

    @staticmethod
    def col(color):
        return None if color is None else (tuple(color) + (255,) if len(color) == 3 else tuple(color))

    def poly(self, points, fill):
        self.d.polygon(self.pts(points), fill=self.col(fill))

    def line(self, points, fill, width=3):
        self.d.line(self.pts(points), fill=self.col(fill), width=round(width * S), joint='curve')

    def ellipse(self, box, fill=None, outline=None, width=3):
        self.d.ellipse(self.pts([box[:2], box[2:]]), fill=self.col(fill), outline=self.col(outline), width=round(width * S))

    def dot(self, x, y, r, fill):
        self.ellipse((x - r, y - r, x + r, y + r), fill=fill)

    def pie(self, box, start, end, fill):
        self.d.pieslice(self.pts([box[:2], box[2:]]), start, end, fill=self.col(fill))

    def arc(self, box, start, end, fill, width=3):
        self.d.arc(self.pts([box[:2], box[2:]]), start, end, fill=self.col(fill), width=round(width * S))

    def rrect(self, box, radius, fill=None, outline=None, width=3):
        self.d.rounded_rectangle(self.pts([box[:2], box[2:]]), radius=radius * S, fill=self.col(fill), outline=self.col(outline), width=round(width * S))


def finish(base, fx, outline, blur=3):
    """Add an outline, soft side shading, the translucent effects layer and a drop shadow."""
    size = base.img.size
    mask = base.img.getchannel('A')
    grown = mask.filter(ImageFilter.MaxFilter(5))
    under = Image.new('RGBA', size, tuple(outline) + (255,))
    under.putalpha(grown)
    values = [round(78 * min(1, abs(x - CX * S) / (290 * S)) ** 2.4) for x in range(size[0])]
    grad = Image.new('L', (size[0], 1))
    grad.putdata(values)
    shading = Image.new('RGBA', size, (0, 0, 0, 0))
    shading.putalpha(ImageChops.multiply(grad.resize(size), mask))
    effects = fx.img.filter(ImageFilter.GaussianBlur(blur * S))
    effects.putalpha(ImageChops.multiply(effects.getchannel('A'), mask))
    art = Image.alpha_composite(Image.alpha_composite(base.img, shading), effects)
    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    shadow.putalpha(grown.filter(ImageFilter.GaussianBlur(16 * S)).point(lambda v: round(v * 0.28)))
    shadow = ImageChops.offset(shadow, 0, 16 * S)
    page = Image.new('RGBA', size, BG + (255,))
    for layer in (shadow, under, art):
        page = Image.alpha_composite(page, layer)
    return page.convert('RGB').resize((W, H), Image.LANCZOS)


def scoop(base, c, width=58, depth=64, y=196):
    base.pie((CX - width, y - depth, CX + width, y + depth), 0, 180, c['inside'])
    base.arc((CX - width, y - depth, CX + width, y + depth), 0, 180, c['trim'], 9)


def folds(fx, xs, top, bottom):
    for x in xs:
        fx.line([(x, top), (x - 8, (top + bottom) // 2), (x + 4, bottom)], (0, 0, 0, 46), 7)


def sheen(fx, strength=80):
    fx.poly([(CX - 190, 230), (CX - 140, 230), (CX - 232, 820), (CX - 282, 820)], (255, 255, 255, strength))
    fx.poly([(CX - 70, 230), (CX - 52, 230), (CX - 94, 820), (CX - 112, 820)], (255, 255, 255, strength // 2))


def mesh(fx, box):
    x0, y0, x1, y1 = box
    for x in range(x0, x1, 18):
        fx.line([(x, y0), (x, y1)], (0, 0, 0, 90), 2)
    for y in range(y0, y1, 18):
        fx.line([(x0, y), (x1, y)], (0, 0, 0, 90), 2)


def tee(c, graphic=False):
    base, fx = Pen(), Pen()
    base.poly(sym([(-54, 196), (-136, 222), (-266, 330), (-179, 484), (-122, 438), (-128, 862)]), c['base'])
    scoop(base, c)
    for side in (-1, 1):
        base.line([(CX + side * 266, 330), (CX + side * 179, 484)], dark(c['base'], .22), 4)
    base.line([(CX - 128, 840), (CX + 128, 840)], dark(c['base'], .2), 3)
    if graphic:
        base.ellipse((CX - 54, 410, CX + 54, 518), outline=c['accent'], width=7)
        base.dot(CX, 464, 16, c['accent'])
    folds(fx, (CX - 70, CX + 60), 470, 830)
    return base, fx


def tank(c, mesh_fabric=False):
    base, fx = Pen(), Pen()
    base.poly(sym([(-100, 168), (-112, 250), (-132, 350), (-126, 862)]), c['base'])
    base.pie((CX - 52, 168 - 128, CX + 52, 168 + 128), 0, 180, (0, 0, 0, 0))
    base.arc((CX - 52, 168 - 128, CX + 52, 168 + 128), 0, 180, c['trim'], 8)
    base.line([(CX - 126, 840), (CX + 126, 840)], dark(c['base'], .2), 3)
    if mesh_fabric:
        mesh(fx, (CX - 140, 180, CX + 140, 862))
    folds(fx, (CX - 50, CX + 60), 420, 830)
    return base, fx


def hoodie(c):
    base, fx = Pen(), Pen()
    base.ellipse((CX - 102, 92, CX + 102, 262), fill=dark(c['base'], .18))
    base.poly(sym([(-60, 206), (-136, 226), (-232, 306), (-300, 566), (-296, 800), (-222, 806), (-146, 470), (-134, 862)]), c['base'])
    base.ellipse((CX - 64, 146, CX + 64, 236), fill=c['inside'])
    for side in (-1, 1):
        base.line([(CX + side * 22, 232), (CX + side * 28, 372)], c['trim'], 5)
        base.dot(CX + side * 28, 376, 7, c['trim'])
        base.rrect((CX + side * 261 - 40, 770, CX + side * 261 + 40, 806), 6, dark(c['base'], .16))
    base.rrect((CX - 134, 832, CX + 134, 864), 6, dark(c['base'], .16))
    base.poly([(CX - 96, 640), (CX + 96, 640), (CX + 122, 770), (CX - 122, 770)], dark(c['base'], .1))
    base.line([(CX - 96, 640), (CX - 122, 770), (CX + 122, 770), (CX + 96, 640), (CX - 96, 640)], dark(c['base'], .3), 3)
    folds(fx, (CX - 190, CX + 190), 360, 740)
    return base, fx


def zip_jacket(c, hem=830, collar=True):
    base, fx = Pen(), Pen()
    base.poly(sym([(-48, 176), (-140, 214), (-236, 300), (-304, 568), (-298, hem - 22), (-226, hem - 16), (-148, 470), (-136, hem)]), c['base'])
    if collar:
        for side in (-1, 1):
            base.poly([(CX + side * 4, 170), (CX + side * 58, 176), (CX + side * 86, 236), (CX + side * 6, 270)], dark(c['base'], .14))
    for side in (-1, 1):
        base.rrect((CX + side * 262 - 40, hem - 52, CX + side * 262 + 40, hem - 16), 6, dark(c['base'], .16))
    base.rrect((CX - 136, hem - 34, CX + 136, hem), 6, dark(c['base'], .16))
    base.line([(CX, 176), (CX, hem)], c['trim'], 5)
    for y in range(190, hem - 10, 16):
        base.line([(CX - 7, y), (CX + 7, y)], c['trim'], 2)
    for side in (-1, 1):
        base.line([(CX + side * 70, 600), (CX + side * 92, 700)], c['trim'], 4)
    folds(fx, (CX - 200, CX + 200, CX - 70, CX + 70), 330, hem - 50)
    return base, fx


def bomber(c, hem=780, glossy=False, metallic=False):
    base, fx = Pen(), Pen()
    base.poly(sym([(-56, 184), (-140, 214), (-236, 296), (-290, 520), (-286, 720), (-216, 726), (-150, 470), (-142, hem)]), c['base'])
    scoop(base, c, 66, 70, 184)
    base.rrect((CX - 142, hem - 40, CX + 142, hem), 6, dark(c['base'], .2))
    for side in (-1, 1):
        base.line([(CX + side * 290, 690), (CX + side * 216, 700)], dark(c['base'], .3), 5)
        base.rrect((CX + side * 252 - 40, 690, CX + side * 252 + 40, 728), 6, dark(c['base'], .2))
    base.line([(CX, 250), (CX, hem - 40)], c['trim'], 5)
    for y in range(262, hem - 46, 16):
        base.line([(CX - 6, y), (CX + 6, y)], c['trim'], 2)
    folds(fx, (CX - 190, CX + 190), 320, 700)
    if glossy or metallic:
        sheen(fx, 110 if metallic else 80)
    return base, fx


def blazer(c):
    base, fx = Pen(), Pen()
    base.poly(sym([(-52, 190), (-140, 220), (-236, 304), (-296, 590), (-290, 830), (-222, 836), (-150, 480), (-146, 884)]), c['base'])
    base.poly([(CX - 52, 190), (CX + 52, 190), (CX, 480)], c['inside'])
    for side in (-1, 1):
        base.poly([(CX + side * 52, 190), (CX + side * 4, 478), (CX + side * 70, 452), (CX + side * 128, 318)], light(c['base'], .1))
        base.line([(CX + side * 52, 190), (CX + side * 4, 478)], dark(c['base'], .45), 3)
        base.line([(CX + side * 128, 318), (CX + side * 70, 452)], dark(c['base'], .45), 3)
        base.line([(CX + side * 70, 452), (CX + side * 4, 478)], dark(c['base'], .45), 3)
        base.line([(CX + side * 150, 690), (CX + side * 54, 700)], dark(c['base'], .4), 5)
    for y in (540, 620):
        base.dot(CX, y, 11, c['trim'])
    base.line([(CX - 146, 868), (CX + 146, 868)], dark(c['base'], .2), 3)
    folds(fx, (CX - 200, CX + 200), 360, 800)
    return base, fx


def shirt(c):
    base, fx = Pen(), Pen()
    base.poly(sym([(-56, 190), (-140, 218), (-262, 336), (-190, 500), (-132, 446), (-136, 868)]), c['base'])
    for side in (-1, 1):
        base.poly([(CX + side * 4, 192), (CX + side * 70, 188), (CX + side * 96, 270), (CX + side * 8, 250)], light(c['base'], .2))
    base.line([(CX, 250), (CX, 868)], dark(c['base'], .25), 3)
    for y in range(300, 850, 90):
        base.dot(CX + 14, y, 7, c['trim'])
    base.rrect((CX + 40, 400, CX + 112, 470), 6, None, dark(c['base'], .3), 3)
    folds(fx, (CX - 76, CX + 70), 480, 840)
    return base, fx


def flap_bag(c):
    base, fx = Pen(), Pen()
    base.arc((CX - 140, 150, CX + 140, 590), 180, 360, c['trim'], 16)
    base.rrect((CX - 190, 400, CX + 190, 730), 30, c['base'])
    base.rrect((CX - 190, 400, CX + 190, 540), 30, dark(c['base'], .12))
    base.dot(CX, 540, 16, c['accent'])
    base.line([(CX - 170, 700), (CX + 170, 700)], dark(c['base'], .25), 3)
    return base, fx


def disc_bag(c):
    base, fx = Pen(), Pen()
    base.arc((CX - 100, 130, CX + 100, 770), 180, 360, c['trim'], 14)
    base.ellipse((CX - 180, 400, CX + 180, 760), fill=c['base'])
    base.ellipse((CX - 150, 430, CX + 150, 730), outline=dark(c['base'], .28), width=4)
    base.arc((CX - 110, 470, CX + 110, 690), 200, 340, c['accent'], 6)
    base.dot(CX, 580, 14, c['accent'])
    fx.poly([(CX - 120, 440), (CX - 40, 430), (CX - 150, 600)], (255, 255, 255, 70))
    return base, fx


def mini_bag(c, mesh_fabric=True):
    base, fx = Pen(), Pen()
    base.arc((CX - 90, 380, CX + 90, 700), 180, 360, c['trim'], 14)
    base.rrect((CX - 150, 500, CX + 150, 760), 36, c['base'])
    base.line([(CX - 150, 580), (CX + 150, 580)], dark(c['base'], .35), 4)
    if mesh_fabric:
        mesh(fx, (CX - 150, 500, CX + 150, 760))
    base.dot(CX, 580, 12, c['accent'])
    return base, fx


def tote(c):
    base, fx = Pen(), Pen()
    for dx in (-100, 100):
        base.arc((CX + dx - 50, 230, CX + dx + 50, 560), 180, 360, c['trim'], 14)
    base.poly([(CX - 220, 430), (CX + 220, 430), (CX + 190, 790), (CX - 190, 790)], c['base'])
    base.line([(CX - 220, 430), (CX + 220, 430)], dark(c['base'], .35), 6)
    base.line([(CX - 200, 560), (CX + 200, 560)], dark(c['base'], .2), 3)
    base.rrect((CX - 70, 600, CX + 70, 680), 10, None, dark(c['base'], .3), 3)
    return base, fx


def chain_bag(c):
    base, fx = Pen(), Pen()
    steps = 34
    for i in range(steps + 1):
        angle = math.pi + math.pi * i / steps
        x = CX + 160 * math.cos(angle)
        y = 560 + 400 * math.sin(angle)
        base.ellipse((x - 9, y - 9, x + 9, y + 9), outline=c['trim'], width=4)
    base.rrect((CX - 150, 540, CX + 150, 740), 24, c['base'])
    base.poly([(CX - 150, 540), (CX + 150, 540), (CX, 650)], dark(c['base'], .12))
    base.line([(CX - 150, 540), (CX, 650), (CX + 150, 540)], dark(c['base'], .4), 3)
    base.dot(CX, 650, 13, c['accent'])
    fx.poly([(CX - 120, 556), (CX - 50, 550), (CX - 130, 700)], (255, 255, 255, 70))
    return base, fx


def palette(base, trim=None, inside=None, accent=None):
    b = rgb(base)
    return {'base': b, 'trim': rgb(trim) if trim else light(b, .35), 'inside': rgb(inside) if inside else dark(b, .45), 'accent': rgb(accent) if accent else light(b, .5)}


def item(item_id, name, category, price, sizes, tags, draw, colors, **options):
    return {'itemId': item_id, 'name': name, 'category': category, 'price': price, 'sizesInStock': sizes, 'styleTags': tags, 'draw': draw, 'palette': colors, 'options': options}


ALL = ['XS', 'S', 'M', 'L', 'XL']
STORES = [
    {
        'storeId': 'northline', 'storeName': 'Northline', 'position': 1,
        'items': [
            item('northline_racer', 'Racer zip jacket', 'outer', 89, ['S', 'M', 'L'], ['concert', 'black', 'edgy', 'streetwear', 'night', 'jacket'], zip_jacket, palette('#1f2023', '#c8ccd2')),
            item('northline_chrome', 'Chrome bomber', 'outer', 96, ['M', 'L', 'XL'], ['concert', 'silver', 'metallic', 'party', 'shiny', 'bomber'], bomber, palette('#b4bac4', '#6c717a', '#7d838c'), metallic=True),
            item('northline_vinyl', 'Cropped vinyl jacket', 'outer', 72, ['S', 'M'], ['concert', 'black', 'glossy', 'edgy', 'night', 'party'], bomber, palette('#18191c', '#9aa0a8'), hem=700, glossy=True),
            item('northline_tee', 'Graphic tee', 'top', 32, ALL, ['concert', 'black', 'casual', 'streetwear', 'tee'], tee, palette('#26272b', '#3e4046', accent='#c8ccd2'), graphic=True),
            item('northline_mesh_tank', 'Silver mesh tank', 'top', 28, ['S', 'M', 'L', 'XL'], ['concert', 'silver', 'party', 'summer', 'tank'], tank, palette('#c2c6ce', '#9096a0'), mesh_fabric=True),
            item('northline_hoodie', 'Oversized hoodie', 'top', 54, ['S', 'M', 'L', 'XL'], ['casual', 'comfy', 'streetwear', 'grey', 'hoodie', 'winter'], hoodie, palette('#6b6f77', '#e4e6ea')),
            item('northline_rib_tank', 'Red rib tank', 'top', 26, ['XS', 'S', 'M', 'L'], ['red', 'party', 'summer', 'date', 'tank'], tank, palette('#b3262e', '#8b1a21')),
            item('northline_disc', 'Disc crossbody bag', 'bag', 18, [], ['concert', 'silver', 'party', 'night', 'bag'], disc_bag, palette('#c3c7cf', '#80858e', accent='#7c818a')),
            item('northline_mini', 'Mesh mini bag', 'bag', 15, [], ['concert', 'black', 'night', 'bag'], mini_bag, palette('#1c1d20', '#80858e', accent='#c8ccd2')),
            item('northline_chain', 'Chain shoulder bag', 'bag', 34, [], ['black', 'silver', 'party', 'night', 'date', 'bag'], chain_bag, palette('#1f2023', '#c8ccd2', accent='#c8ccd2')),
        ],
    },
    {
        'storeId': 'mono-studio', 'storeName': 'Mono Studio', 'position': 2,
        'items': [
            item('mono-studio_blazer', 'Tailored blazer', 'outer', 98, ['S', 'M', 'L', 'XL'], ['work', 'minimal', 'black', 'formal', 'date', 'blazer', 'office'], blazer, palette('#24262b', '#b9bcc2', '#ecebe6')),
            item('mono-studio_shine', 'Shine zip jacket', 'outer', 78, ['XS', 'M', 'XL'], ['concert', 'black', 'silver', 'party', 'night', 'jacket'], zip_jacket, palette('#2d3038', '#d2d6dc')),
            item('mono-studio_satin', 'Satin bomber', 'outer', 70, ['M', 'L'], ['party', 'date', 'satin', 'champagne', 'bomber', 'night'], bomber, palette('#c9b79c', '#8a7a62', '#9a8a70'), glossy=True),
            item('mono-studio_knit', 'Cream knit tee', 'top', 38, ALL, ['minimal', 'casual', 'cream', 'date', 'summer', 'tee'], tee, palette('#e9e0cf', '#c9bfa9', '#b3a78f')),
            item('mono-studio_rib', 'White ribbed tank', 'top', 24, ['XS', 'S', 'M', 'L'], ['white', 'minimal', 'summer', 'casual', 'tank'], tank, palette('#fbfbf8', '#d9d9d3')),
            item('mono-studio_shirt', 'Boxy poplin shirt', 'top', 46, ['S', 'M', 'L', 'XL'], ['work', 'minimal', 'grey', 'casual', 'office', 'shirt'], shirt, palette('#aeb7c2', '#f1f1ee', '#8c95a0')),
            item('mono-studio_tee', 'Essential black tee', 'top', 26, ALL, ['black', 'minimal', 'casual', 'concert', 'tee'], tee, palette('#1d1e21', '#34363b')),
            item('mono-studio_nova', 'Nova chain bag', 'bag', 30, [], ['concert', 'silver', 'party', 'night', 'bag'], chain_bag, palette('#c9cdd4', '#8b9099', accent='#6f747d')),
            item('mono-studio_tote', 'Structured tote', 'bag', 48, [], ['work', 'minimal', 'black', 'office', 'bag'], tote, palette('#222428', '#4a4d54')),
            item('mono-studio_camel', 'Camel mini bag', 'bag', 36, [], ['date', 'camel', 'minimal', 'summer', 'bag'], mini_bag, palette('#b98a56', '#7a5b36', accent='#e6d3b6'), mesh_fabric=False),
        ],
    },
]


def render(spec):
    base, fx = spec['draw'](spec['palette'], **spec['options'])
    return finish(base, fx, dark(spec['palette']['base'], .5))


def main():
    products = ROOT / 'static' / 'products'
    products.mkdir(parents=True, exist_ok=True)
    for old in products.glob('*.png'):
        old.unlink()
    for store in STORES:
        items = []
        for spec in store['items']:
            render(spec).save(products / f"{spec['itemId']}.png", optimize=True)
            items.append({
                'itemId': spec['itemId'], 'name': spec['name'], 'category': spec['category'], 'price': spec['price'],
                'sizesInStock': spec['sizesInStock'], 'styleTags': spec['styleTags'], 'imagePath': f"/assets/products/{spec['itemId']}.png",
                'imageLicense': LICENSE,
            })
        catalog = {'storeId': store['storeId'], 'storeName': store['storeName'], 'position': store['position'], 'sampleStore': True, 'items': items}
        (ROOT / 'catalogs' / f"{store['storeId']}.json").write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
    print('wrote', sum(len(s['items']) for s in STORES), 'items')


if __name__ == '__main__':
    main()
