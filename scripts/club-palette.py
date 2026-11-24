#!/usr/bin/env python3
"""The club colours' lighter half, from one set of numbers.

Every colour of the family (CLUB in src/Nosca.jsx) has three lighter
relations on its own hue, made in OKLCH so they share a tone the way the
deep ones do:

  pale   lightness 0.93, a third of the colour's chroma (the reds capped
         lower: plaster, never baby pink) — a glyph tile's face, a face
         with no picture, what is chosen
  ledge  lightness 0.865 — what the pale stands on
  cloth  lightness 0.76 — what the colour is on a dark page, and the
         face of a function key; the blues, the violets and the reds
         (hue 200° and round to 30°) at 0.78 with their chroma capped,
         because at the family's full cloth chroma they read as baby
         blue, lilac and pink on a key (the class study, 23 November)

Run it after changing a colour:  python3 scripts/club-palette.py
It prints the CLUB_PALE table to paste into src/Nosca.jsx and writes the
website's website/src/css/palette.css (variables only), so the app and
the site can never drift apart.
"""
import math
import os

CLUB = {
    "fairway": "#285937", "olive": "#4F5B29", "bottle": "#123C30", "lawn": "#44613A", "court": "#125856",
    "petrol": "#1F525F", "river": "#264A70", "navy": "#213654", "steel": "#445E72", "aubergine": "#4D3566",
    "indigo": "#363864", "plum": "#5F3954", "claret": "#6B2935", "sienna": "#844925", "rust": "#88452A",
    "saddle": "#765637", "chestnut": "#613E2B", "gold": "#C2A24C", "slate": "#48555C", "brick": "#9A322A",
}
GOLD_INK = (0.47, 0.085)  # what is drawn on the gold's pale: a deeper gold (lightness, chroma)


def oklch_to_srgb(L, C, h):
    a = C * math.cos(math.radians(h))
    b = C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    def enc(x):
        x = max(0.0, min(1.0, x))
        return 12.92 * x if x <= 0.0031308 else 1.055 * (x ** (1 / 2.4)) - 0.055

    ok = all(-0.002 <= v <= 1.002 for v in (r, g, bb))
    return tuple(round(enc(v) * 255) for v in (r, g, bb)), ok


def srgb_to_oklch(hexs):
    hexs = hexs.lstrip("#")
    r, g, b = [int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)]

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = lin(r), lin(g), lin(b)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, math.hypot(a, b2), (math.degrees(math.atan2(b2, a)) + 360) % 360


def fit(L, C, h):
    """the colour at this lightness and hue, its chroma brought inside sRGB"""
    c = C
    while c > 0:
        rgb, ok = oklch_to_srgb(L, c, h)
        if ok:
            return "#%02X%02X%02X" % rgb
        c -= 0.001
    return "#%02X%02X%02X" % oklch_to_srgb(L, 0, h)[0]


def lum(hexs):
    hexs = hexs.lstrip("#")

    def f(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = [int(hexs[i:i + 2], 16) for i in (0, 2, 4)]
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def clamp(x, a, b):
    return max(a, min(b, x))


def mix(a, b, k):
    """src/Nosca.jsx's MIX: a toward b by k, channel by channel"""
    x = [int(a.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    y = [int(b.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return "#%02X%02X%02X" % tuple(int(v + (w - v) * k + 0.5) for v, w in zip(x, y))


ON_CLOTH = 0.45    # the word and the glyph on a cloth-filled key: the deep colour this far toward black
CLOTH_LEDGE = 0.5  # the ledge under a cloth-filled key: the cloth this far toward its ink (the deep colour; the gold's deeper gold)
CLOTH_QUIET = (0.78, 0.036, 0.055)  # a blue's, a violet's and a red's cloth: its lightness, its chroma's ceiling, the brick's (Call off) ceiling
# the roles each sport gives its colours (green is the lead), as CLUB_SETS in src/Nosca.jsx has them — change the two
# together. With the cloth capped, two blues (or two reds) of one sport can come to the same key: the check below
# measures the plus sheet's eight keys of every sport and stops the script if two are closer than SEPARATE.
ROLES = ("green", "teal", "blue", "orange", "purple", "wine", "brand")
SETS = {
    "brand": ("bottle", "olive", "navy", "saddle", "plum", "claret", "bottle"),
    "golf": ("fairway", "olive", "navy", "saddle", "plum", "claret", "bottle"),
    "tennis": ("court", "lawn", "navy", "rust", "aubergine", "claret", "bottle"),
    "rowing": ("river", "court", "indigo", "saddle", "plum", "claret", "bottle"),
    "squash": ("sienna", "petrol", "navy", "saddle", "plum", "claret", "bottle"),
    "padel": ("aubergine", "petrol", "navy", "rust", "plum", "claret", "bottle"),
    "equestrian": ("claret", "fairway", "navy", "saddle", "aubergine", "chestnut", "bottle"),
}
PLUS = ("green", "blue", "gold", "purple", "teal", "brand", "red", "orange")  # Register, Capture, Tip, Drills, Add player, New group, Call off, Competition
SEPARATE = 0.019  # the least distance (OKLab) between two of a sport's keys of different colours


def lighter(name, deep):
    L, C, h = srgb_to_oklch(deep)
    warm = h < 60 or h > 335
    pale = fit(0.93, clamp(0.36 * C, 0.008, 0.024 if warm else 0.032), h)
    ledge = fit(0.865, clamp(0.5 * C, 0.012, 0.036 if warm else 0.045), h)
    cool_or_red = h >= 200 or h < 30
    if cool_or_red:
        cloth = fit(CLOTH_QUIET[0], min(clamp(0.8 * C, 0.03, 0.07), CLOTH_QUIET[2] if name == "brick" else CLOTH_QUIET[1]), h)
    else:
        cloth = fit(0.76, clamp(0.8 * C, 0.03, 0.07), h)
    ink = fit(GOLD_INK[0], GOLD_INK[1], h) if name == "gold" else deep
    return pale, ledge, cloth, ink


def oklab(hexs):
    L, C, h = srgb_to_oklch(hexs)
    return L, C * math.cos(math.radians(h)), C * math.sin(math.radians(h))


def separation():
    """every sport's plus sheet: the two keys of different colours that sit closest"""
    out = {}
    for sport, s in SETS.items():
        roles = dict(zip(ROLES, s), gold="gold", red="brick")
        cloth = {r: lighter(roles[r], CLUB[roles[r]])[2] for r in PLUS}
        out[sport] = min((math.dist(oklab(cloth[a]), oklab(cloth[b])), a, b)
                         for i, a in enumerate(PLUS) for b in PLUS[i + 1:] if roles[a] != roles[b])
    return out


def main():
    for sport, (d, a, b) in separation().items():
        assert d >= SEPARATE, (sport, "two of its keys sit too close", a, b, round(d, 3))
    rows, css = [], [":root{"]
    line = "  "
    for name, deep in CLUB.items():
        pale, ledge, cloth, ink = lighter(name, deep)
        assert contrast(ink, pale) >= 4.5, (name, "the ink on its pale", contrast(ink, pale))
        item = f'{name}: ["{pale}", "{ledge}", "{cloth}"], '
        if len(line) + len(item) > 118:
            rows.append(line.rstrip())
            line = "  "
        line += item
        on = mix(ink, "#000000", ON_CLOTH)
        assert contrast(on, cloth) >= 4.5, (name, "the ink on its cloth", contrast(on, cloth))
        css.append(f"  --club-{name}:{deep}; --club-{name}-tint:{pale}; --club-{name}-lip:{ledge}; "
                   f"--club-{name}-mid:{cloth}; --club-{name}-ink:{ink}; "
                   f"--club-{name}-on:{on}; --club-{name}-mid-lip:{mix(cloth, ink, CLOTH_LEDGE)};")
    rows.append(line.rstrip())
    css.append("}")
    print("const CLUB_PALE = {")
    print("\n".join(rows))
    print("};")
    print(f'// the gold\'s ink on its pale: {lighter("gold", CLUB["gold"])[3]}')
    print("// the closest two keys of each sport: " + ", ".join(f"{k} {d:.3f} ({a}/{b})" for k, (d, a, b) in separation().items()))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "website", "src", "css", "palette.css")
    if os.path.isdir(os.path.dirname(out)):
        with open(out, "w") as f:
            f.write("/* written by scripts/club-palette.py — the app's club colours and their lighter half; never edit by hand */\n")
            f.write("\n".join(css) + "\n")
        print("wrote", os.path.normpath(out))


if __name__ == "__main__":
    main()
