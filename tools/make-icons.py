"""Generate PWA icons: a dark rounded square with a green progress ring."""
from PIL import Image, ImageDraw
import math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(OUT, exist_ok=True)

def make(size, radius_frac=0.22, maskable=False, bg=(16, 18, 22)):
    s = size * 4  # supersample
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(s * radius_frac)
    if maskable:
        d.rectangle([0, 0, s, s], fill=bg)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=bg)
    # ring
    cx = cy = s / 2
    R = s * 0.30
    w = int(s * 0.085)
    box = [cx - R, cy - R, cx + R, cy + R]
    d.arc(box, start=0, end=360, fill=(44, 50, 60), width=w)
    # green progress arc (~72%) starting at top
    d.arc(box, start=-90, end=-90 + 260, fill=(52, 211, 153), width=w)
    # round caps
    for ang in (-90, -90 + 260):
        a = math.radians(ang)
        px, py = cx + R * math.cos(a), cy + R * math.sin(a)
        d.ellipse([px - w / 2, py - w / 2, px + w / 2, py + w / 2], fill=(52, 211, 153))
    # inner dot
    d.ellipse([cx - s*0.045, cy - s*0.045, cx + s*0.045, cy + s*0.045], fill=(255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)

make(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
make(192).save(os.path.join(OUT, 'icon-192.png'))
make(512).save(os.path.join(OUT, 'icon-512.png'))
make(512, maskable=True).save(os.path.join(OUT, 'icon-maskable-512.png'))
make(32).save(os.path.join(OUT, 'favicon-32.png'))
print('icons written')
