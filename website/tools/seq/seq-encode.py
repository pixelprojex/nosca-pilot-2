"""raw frames -> a scrubbable sequence: python3 seq-encode.py <rawDir> <outDir> <name> '<seg:n,seg:n,...>' [width] [quality]
Picks n frames a segment, evenly in animation time (always the segment's last), writes fNNN.webp and manifest.json."""
import json, sys, os
from PIL import Image
raw, out, name, spec = sys.argv[1:5]
width = int(sys.argv[5]) if len(sys.argv) > 5 else 600
q = int(sys.argv[6]) if len(sys.argv) > 6 else 74
fr = json.load(open(os.path.join(raw, 'frames.json')))
segs = {}
for f in fr: segs.setdefault(f['seg'], []).append(f)
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith('.webp'): os.remove(os.path.join(out, f))
n = 0; marks = {}; total = 0; size = None
for part in spec.split(','):
    seg, k = part.split(':'); k = int(k); lst = segs[seg]
    if k >= len(lst): pick = lst
    else:
        t0, t1 = lst[0]['at'], lst[-1]['at']; pick = []
        for i in range(k):
            t = t0 + (t1 - t0) * (i + 1) / k
            best = min(lst, key=lambda x: abs(x['at'] - t))
            if best not in pick: pick.append(best)
    start = n
    for p in pick:
        im = Image.open(os.path.join(raw, p['f'])).convert('RGB')
        h = round(im.height * width / im.width); im = im.resize((width, h), Image.LANCZOS); size = (width, h)
        fn = os.path.join(out, 'f%03d.webp' % n); im.save(fn, 'WEBP', quality=q, method=6); total += os.path.getsize(fn); n += 1
    marks[seg] = [start, n - 1]
man = {'name': name, 'frames': n, 'w': size[0], 'h': size[1], 'pattern': 'f%03d.webp', 'kb': round(total / 1024, 1), 'marks': marks}
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
print(json.dumps(man))
