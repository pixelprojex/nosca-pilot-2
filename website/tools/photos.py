#!/usr/bin/env python3
"""Make every photograph and every loop's poster load at once: for each photograph in assets/photo/MANIFEST.json an
AVIF beside each WebP width (the build offers both, the browser takes the smaller), and for every photograph and
every loop a tiny blurred placeholder (a few hundred bytes of WebP as a data URI, `lqip`), which the build paints as
the picture's own background so nothing is ever a blank box while the real one arrives.

    python3 website/tools/photos.py            (only what is missing)
    python3 website/tools/photos.py --force    (all of it again)

Needs Pillow with AVIF (Pillow 11.3 and later carry it)."""
import base64, io, json, os, sys
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTO = os.path.join(HERE, '..', 'assets', 'photo')
FORCE = '--force' in sys.argv


def lqip(path):
    im = Image.open(path).convert('RGB')
    w = 28
    h = max(2, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=42, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def main():
    mp = os.path.join(PHOTO, 'MANIFEST.json')
    m = json.load(open(mp))
    made = 0
    for p in m.get('photos', []):
        for f in p.get('files', []):
            src = os.path.join(PHOTO, f['file'])
            avif = src.rsplit('.', 1)[0] + '.avif'
            if os.path.exists(src) and (FORCE or not os.path.exists(avif)):
                Image.open(src).convert('RGB').save(avif, 'AVIF', quality=52, speed=4)
                made += 1
            if os.path.exists(avif):
                f['avif'] = os.path.basename(avif)
                f['avif_bytes'] = os.path.getsize(avif)
        small = min(p.get('files', []), key=lambda f: f['width'], default=None)
        if small and (FORCE or not p.get('lqip')):
            p['lqip'] = lqip(os.path.join(PHOTO, small['file']))
    for l in m.get('loops', []):
        poster = os.path.join(PHOTO, l['poster']['file'])
        if os.path.exists(poster) and (FORCE or not l.get('lqip')):
            l['lqip'] = lqip(poster)
    json.dump(m, open(mp, 'w'), indent=1, ensure_ascii=False)
    print(f'{made} AVIF files written; placeholders for {len(m.get("photos", []))} photographs and {len(m.get("loops", []))} loops')


if __name__ == '__main__':
    main()
