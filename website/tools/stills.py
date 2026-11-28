"""The stills shoot.cjs wrote (PNG, 1170 x 2532) -> website/assets/<name>.webp at 780 x 1688.
   python3 website/tools/stills.py <rawDir> <assetsDir> [name,name,...] [--present]
Each still is its raw shot at two thirds, Lanczos, WebP at the quality below (method 6). The qualities hold each
picture near the weight the site budgets for it: the dark screens (a clip) carry the higher quality their gradients
need, the opening (its rings grew on 23 November) a step under it, Partners' screens the lower one they were first
shot at."""
import os, sys
from PIL import Image

DARK, SPLASH, LIGHT, PARTNERS = 94, 91, 86, 80
SPORTS = ["golf", "tennis", "rowing", "squash", "padel", "equestrian"]
# the still, the raw shot it is made from, its quality
STILLS = [
    ("coach-today-golf", "coach-today-golf", LIGHT), ("coach-today-actions", "coach-today-actions", LIGHT),
    ("coach-plus-golf", "coach-plus-golf", LIGHT), ("coach-peek", "coach-peek", LIGHT),
    ("coach-log-who", "coach-log-who", LIGHT), ("coach-log-golf", "coach-log-golf", LIGHT),
    ("coach-register", "coach-register", LIGHT), ("coach-calloff", "coach-calloff", LIGHT),
    ("coach-diary-list", "coach-diary-list", LIGHT), ("coach-diary-calendar", "coach-diary-calendar", LIGHT),
    ("coach-chat", "coach-chat", LIGHT), ("coach-thread", "coach-thread", LIGHT),
    ("coach-thread-junior", "coach-thread-junior", LIGHT), ("coach-settings", "coach-settings", LIGHT),
    ("coach-player-file", "coach-player-file", LIGHT), ("coach-markup", "coach-markup", DARK),
    ("coach-compare", "coach-compare", DARK),
    ("player-feed", "player-feed", DARK), ("player-lesson", "player-lesson", DARK), ("player-drills", "player-drills", LIGHT),
    ("player-progress", "player-progress", LIGHT), ("player-progress-attendance", "player-progress-attendance", LIGHT),
    ("player-feed-tennis", "player-feed-tennis", DARK), ("player-drills-tennis", "player-drills-tennis", LIGHT),
    ("parent-family", "parent-family", LIGHT), ("junior-home", "junior-home", DARK), ("junior-drills", "junior-drills", LIGHT),
    # the Product page's (kept by name): the same screens, on the same real clips
    ("product-feed", "product-feed", LIGHT), ("product-lesson", "product-lesson", LIGHT), ("product-markup", "product-markup", LIGHT),
    ("product-compare", "product-compare", LIGHT), ("product-junior-home", "product-junior-home", LIGHT),
    ("product-diary-list", "product-diary-list", LIGHT),
    # the Partners page's: the same screens as the family's and the coach's, at Partners' weight
    ("partners-family", "parent-family", PARTNERS), ("partners-thread", "coach-thread-junior", PARTNERS),
    ("partners-chat", "coach-chat", PARTNERS), ("partners-junior", "junior-drills", PARTNERS),
] + [(f"coach-today-{s}", f"coach-today-{s}", LIGHT) for s in SPORTS[1:]] \
  + [(f"coach-log-{s}", f"coach-log-{s}", LIGHT) for s in SPORTS[1:]] \
  + [(f"splash-{s}", f"splash-{s}", SPLASH) for s in SPORTS]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    present = "--present" in sys.argv   # only the stills whose raw shot is there (a shoot of some steps)
    raw, out = args[0], args[1]
    only = set(args[2].split(",")) if len(args) > 2 else None
    done, missing = [], []
    for name, src, q in STILLS:
        if only and name not in only: continue
        f = os.path.join(raw, src + ".png")
        if not os.path.exists(f):
            if not present: missing.append(src)
            continue
        im = Image.open(f).convert("RGB")
        if im.size != (1170, 2532): raise SystemExit(f"{src}.png is {im.size[0]} x {im.size[1]}, not 1170 x 2532 (shot at 3x?)")
        p = os.path.join(out, name + ".webp")
        im.resize((780, 1688), Image.LANCZOS).save(p, "WEBP", quality=q, method=6)
        done.append((name, round(os.path.getsize(p) / 1024, 1)))
    for name, kb in done: print(f"{name:28} {kb:6} KB")
    print(len(done), "stills written to", out, "· missing raw:", ", ".join(sorted(set(missing))) or "none")
    if missing: sys.exit(1)

if __name__ == "__main__":
    main()
