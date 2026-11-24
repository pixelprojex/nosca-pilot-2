#!/usr/bin/env python3
"""THE BUSINESS CARD — print files for MOO, and a preview.

    python3 scripts/business-card.py [--out docs/brand/business-card]
                                     [--site https://nosca-pilot-2.netlify.app]
                                     [--ground green|olive] [--no-preview]

MOO size, 84 × 55 mm, trimmed from an 88 × 59 mm bleed; gold foil on
Super paper with the Soft Touch finish, rounded corners. MOO takes the
foil as a file of its own — black (CMYK 0/0/0/100) vector shapes on
white, one per side — beside the colour artwork, so every side is two
PDFs here:

    nosca-card-front-colour.pdf   the ground, edge to edge
    nosca-card-front-foil.pdf     the pinstripes, the mark, the word
    nosca-card-back-colour.pdf    the name, the line, the two codes
    nosca-card-back-foil.pdf      the mark

Nothing printed sits under a foil shape (MOO's halo rule), every foil
line is at least 1 pt and every foil letter at least 10 pt, and the
foil covers well under a third of either side. The codes are drawn as
vector squares from the matrix the `qrcode` library gives, so nothing
is rasterised; the type is Instrument Sans (SIL Open Font License, in
scripts/card/fonts), the face the app itself names after Switzer.

Needs: reportlab, qrcode (pip), pdftoppm and Pillow for the preview.
"""
import argparse, os, subprocess, sys, math
from reportlab.lib.units import mm
from reportlab.lib.colors import CMYKColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "card", "fonts")

# ---------------------------------------------------------------- the sheet
TRIM_W, TRIM_H, BLEED = 84.0, 55.0, 2.0        # mm; MOO: trim 84 × 55, bleed 88 × 59, safe 80 × 51
PAGE_W, PAGE_H = TRIM_W + 2 * BLEED, TRIM_H + 2 * BLEED
MARGIN = 6.0                                    # the design's own inset, inside MOO's 2 mm safe line

# ---------------------------------------------------------------- the inks
# The brand's bottle green (#123C30 on screen) as a press build: the
# blue leaning kept by holding yellow under cyan. 235 % total ink.
GREEN = CMYKColor(0.85, 0.35, 0.55, 0.60)
OLIVE = CMYKColor(0.50, 0.30, 0.85, 0.45)       # the alternative ground
INK   = CMYKColor(0, 0, 0, 1.00)                # the name
GREY  = CMYKColor(0, 0, 0, 0.58)                # the quieter lines
FOIL  = CMYKColor(0, 0, 0, 1.00)                # MOO reads black as foil
WHITE = CMYKColor(0, 0, 0, 0)

# ---------------------------------------------------------------- the type
pdfmetrics.registerFont(TTFont("IS", os.path.join(FONTS, "InstrumentSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("IS-Medium", os.path.join(FONTS, "InstrumentSans-Medium.ttf")))
pdfmetrics.registerFont(TTFont("IS-SemiBold", os.path.join(FONTS, "InstrumentSans-SemiBold.ttf")))
CAP = 0.70                                      # Instrument Sans cap height, as a fraction of the size

# ---------------------------------------------------------------- the mark
# Two rings of radius 8.6 with centres 12 apart in a 40 × 25 space,
# each broken where the other passes over — the numbers in
# src/lib/brandmark.jsx, and nothing here is typed by hand either.
MR, MLX, MRX, MCY, MW = 8.6, 14.0, 26.0, 12.5, 2.75
HALF = math.degrees(math.acos(6 / MR))          # 45.75°, the crossing off the horizontal
GAP = 11.5                                      # half the break
RINGS = [(MLX, HALF), (MRX, -(180 - HALF))]     # (centre x, the angle of its break), in the mark's y-down frame

# ---------------------------------------------------------------- helpers
def X(x): return (x + BLEED) * mm                 # trim mm, from the left → points
def Y(y): return (TRIM_H - y + BLEED) * mm        # trim mm, from the top → points

def width_of(text, font, size, track=0.0):
    """visual width in points; `track` is letter-spacing in em"""
    cs = track * size
    return pdfmetrics.stringWidth(text, font, size) + cs * max(0, len(text) - 1)

def text(c, x, y, s, font, size, colour, track=0.0, align="left"):
    """x, y in trim mm (y from the top, the baseline); track in em"""
    c.setFillColor(colour)
    c.setFont(font, size)
    w = width_of(s, font, size, track)
    px = X(x) - (w if align == "right" else w / 2 if align == "centre" else 0)
    c.drawString(px, Y(y), s, charSpace=track * size)
    return w / mm

def mark(c, x, y, w, colour):
    """the mark with its left edge at x, its top at y, `w` mm wide (trim mm)"""
    scale = w / 40.0
    stroke = MW * scale * mm
    c.saveState()
    c.setStrokeColor(colour); c.setLineWidth(stroke); c.setLineCap(1)
    for cx, brk in RINGS:
        r = MR * scale
        ccx, ccy = x + cx * scale, y + MCY * scale               # trim mm, y down
        # the long way round, from one side of the break to the other;
        # the mark's angles run clockwise on screen (y down), so they are
        # negated into the sheet's y-up frame
        start = -(brk + GAP)
        extent = -(360 - 2 * GAP)
        c.arc(X(ccx - r), Y(ccy + r), X(ccx + r), Y(ccy - r), start, extent)
    c.restoreState()

def qr_matrix(url, version=3):
    q = qrcode.QRCode(version=version, error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(url); q.make(fit=False)
    return q.get_matrix()

def qr(c, x, y, size, url, colour, version=3):
    """a code `size` mm square with its top-left corner at (x, y); runs of
    modules are one rectangle, so no hairline opens between neighbours"""
    m = qr_matrix(url, version)
    n = len(m); cell = size / n
    c.saveState(); c.setFillColor(colour); c.setStrokeColor(colour); c.setLineWidth(0)
    for j, row in enumerate(m):
        i = 0
        while i < n:
            if row[i]:
                k = i
                while k < n and row[k]: k += 1
                c.rect(X(x + i * cell), Y(y + (j + 1) * cell), (k - i) * cell * mm, cell * mm, stroke=0, fill=1)
                i = k
            else:
                i += 1
    c.restoreState()
    return n, cell

def page(path):
    c = canvas.Canvas(path, pagesize=(PAGE_W * mm, PAGE_H * mm))
    c.setTitle(os.path.basename(path)); c.setAuthor("Nosca"); c.setCreator("scripts/business-card.py")
    c.setTrimBox((BLEED * mm, BLEED * mm, (BLEED + TRIM_W) * mm, (BLEED + TRIM_H) * mm))
    c.setBleedBox((0, 0, PAGE_W * mm, PAGE_H * mm))
    return c

# ---------------------------------------------------------------- the front
# A field of fine gold pinstripes with a clear band through the middle
# — the composition of MOO's own gold-foil sample — the mark in the
# band and NOSCA under it, as the app's own front door sets them.
STRIPE_W, STRIPE_PITCH = 0.40, 3.60             # mm; 1.13 pt lines, 11 % cover where they run
BAND_TOP, BAND_BOTTOM = 15.0, 40.0              # trim mm from the top
MARK_W, MARK_TOP = 22.0, 17.5                   # the mark, centred
WORD_SIZE, WORD_TRACK, WORD_GAP = 10.0, 0.42, 3.0   # NOSCA: 10 pt (MOO's floor for foil type), tracked as the sign-up draws it

def front_colour(path, ground):
    c = page(path)
    c.setFillColor(ground); c.rect(0, 0, PAGE_W * mm, PAGE_H * mm, stroke=0, fill=1)
    c.showPage(); c.save()

def front_foil(path):
    c = page(path)
    # two wedges of pinstripes in opposite corners, each finished with a
    # fine gold edge, leaving a clear diagonal band for the mark — the
    # movement of MOO's foil sample, set off-axis so the card reads drawn
    W, H, B = TRIM_W, TRIM_H, BLEED
    tr_wedge = [(W * 0.44, -B), (W + B, -B), (W + B, H * 0.58)]          # top right
    bl_wedge = [(-B, H * 0.42), (-B, H + B), (W * 0.56, H + B)]          # bottom left
    c.saveState()
    clip = c.beginPath()
    for poly in (tr_wedge, bl_wedge):
        clip.moveTo(X(poly[0][0]), Y(poly[0][1]))
        for x, y in poly[1:]: clip.lineTo(X(x), Y(y))
        clip.close()
    c.clipPath(clip, stroke=0, fill=0)
    c.setStrokeColor(FOIL); c.setLineWidth(STRIPE_W * mm); c.setLineCap(0)
    step = STRIPE_PITCH * math.sqrt(2) * mm
    d = -PAGE_H * mm - step
    L = (PAGE_W + PAGE_H) * mm * 2
    while d < PAGE_W * mm + step:
        c.line(d, -10 * mm, d + L, L - 10 * mm)
        d += step
    c.restoreState()
    # the wedges' inner edges, one hairline of gold each (1.4 pt)
    c.setStrokeColor(FOIL); c.setLineWidth(0.5 * mm); c.setLineCap(0)
    for (x1, y1), (x2, y2) in ((tr_wedge[0], tr_wedge[2]), (bl_wedge[0], bl_wedge[2])):
        c.line(X(x1), Y(y1), X(x2), Y(y2))
    # the mark and the word, centred
    mark(c, (TRIM_W - MARK_W) / 2, MARK_TOP, MARK_W, FOIL)
    base = MARK_TOP + MARK_W * 25 / 40 + WORD_GAP + CAP * WORD_SIZE * 0.3528
    text(c, TRIM_W / 2 + WORD_TRACK * WORD_SIZE * 0.3528 / 2, base, "NOSCA", "IS-Medium", WORD_SIZE, FOIL, track=WORD_TRACK, align="centre")
    c.showPage(); c.save()

# ---------------------------------------------------------------- the back
# White. The mark (foil) top left and NOSCA (printed) top right; the
# name; one line of what Nosca is; the two codes with what each does.
NAME, ROLE = "Fionn Breathnach", "Founder"
LINE = ["Coaching, linked.", "One app for coach, player and parent."]
SPORTS = "Golf · Tennis · Rowing · Squash · Padel · Equestrian"
QR_SIZE = 17.0                                  # mm; version 3, 29 modules at 0.59 mm each
QR_X, QR_TOP = TRIM_W - MARGIN - 17.0, 22.5
CAPTION = "Scan to start"
RULE_Y = 16.5                                   # the gold rule under the head

def back_colour(path, site):
    c = page(path)
    c.setFillColor(WHITE); c.rect(0, 0, PAGE_W * mm, PAGE_H * mm, stroke=0, fill=1)
    # the person, under the gold rule
    text(c, MARGIN, 25.0, NAME, "IS-SemiBold", 12, INK)
    text(c, MARGIN, 29.6, ROLE, "IS", 8, GREY)
    # what Nosca is, ending on the code's foot
    foot = QR_TOP + QR_SIZE
    text(c, MARGIN, foot - 2.4, LINE[0], "IS-Medium", 8, INK)
    text(c, MARGIN, foot + 1.3, LINE[1], "IS", 8, INK)
    # the sports, one line under everything, the width of the card
    text(c, MARGIN, TRIM_H - MARGIN, SPORTS, "IS", 7.5, GREY, track=0.02)
    # one code, to the guide that gets the app onto the phone and then opens it
    text(c, QR_X + QR_SIZE, foot + 3.6, CAPTION, "IS-Medium", 7.5, INK, align="right")
    qr(c, QR_X, QR_TOP, QR_SIZE, site.rstrip("/") + "/install", GREEN)
    c.showPage(); c.save()

def back_foil(path):
    c = page(path)
    small = 11.0
    mark(c, MARGIN, MARGIN, small, FOIL)
    # NOSCA in gold on the mark's centre line, right — 10 pt, MOO's floor for foil type
    text(c, TRIM_W - MARGIN, MARGIN + small * 25 / 80 + CAP * 10 * 0.3528 / 2, "NOSCA", "IS-Medium", 10, FOIL, track=0.42, align="right")
    # a fine gold rule across the card under the head (1.4 pt)
    c.setStrokeColor(FOIL); c.setLineWidth(0.5 * mm)
    c.line(X(MARGIN), Y(RULE_Y), X(TRIM_W - MARGIN), Y(RULE_Y))
    c.showPage(); c.save()

# ---------------------------------------------------------------- preview
def preview(out, ground_name):
    """what the printed card looks like: the colour render with gold where
    the foil file is black, trimmed, the corners rounded, on a table"""
    try:
        from PIL import Image, ImageFilter, ImageDraw
    except ImportError:
        print("no Pillow — no preview"); return
    DPI = 600
    px = lambda v: int(round(v / 25.4 * DPI))
    def render(pdf):
        base = os.path.join(out, "_tmp_" + os.path.basename(pdf)[:-4])
        subprocess.run(["pdftoppm", "-r", str(DPI), "-png", "-singlefile", pdf, base], check=True)
        im = Image.open(base + ".png").convert("RGB"); os.remove(base + ".png"); return im
    def gold(size):
        w, h = size
        g = Image.new("RGB", size)
        stops = [(0.00, (176, 134, 48)), (0.38, (226, 190, 96)), (0.50, (250, 230, 160)), (0.62, (222, 184, 90)), (1.00, (160, 118, 38))]
        import numpy as np
        yy, xx = np.mgrid[0:h, 0:w]
        t = (xx + yy) / float(w + h)
        arr = np.zeros((h, w, 3), dtype=np.float32)
        for i in range(len(stops) - 1):
            a, ca = stops[i]; b, cb = stops[i + 1]
            m = (t >= a) & (t <= b); f = ((t - a) / (b - a))[m]
            for ch in range(3): arr[..., ch][m] = ca[ch] + (cb[ch] - ca[ch]) * f
        # a fine grain so it reads as metal, not paint
        rng = np.random.default_rng(7)
        arr += rng.normal(0, 4, arr.shape)
        return Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    def side(colour_pdf, foil_pdf):
        col = render(colour_pdf); foil = render(foil_pdf).convert("L")
        mask = Image.eval(foil, lambda v: 255 - v)                           # foil where the file is black
        g = gold(col.size)
        col = Image.composite(g, col, mask)
        # trim the bleed, round the corners
        b = px(BLEED); col = col.crop((b, b, col.width - b, col.height - b))
        r = px(3.5)
        m = Image.new("L", col.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, col.width - 1, col.height - 1), radius=r, fill=255)
        rgba = col.convert("RGBA"); rgba.putalpha(m)
        return rgba
    for name in ("front", "back"):
        f = render(os.path.join(out, f"nosca-card-{name}-foil.pdf")).convert("L")
        b = px(BLEED); f = f.crop((b, b, f.width - b, f.height - b))
        dark = sum(1 for v in f.get_flattened_data() if v < 128) if hasattr(f, "get_flattened_data") else sum(1 for v in f.getdata() if v < 128)
        print(f"foil on the {name}: {100.0 * dark / (f.width * f.height):.1f} % of the trimmed card")
    front = side(os.path.join(out, "nosca-card-front-colour.pdf"), os.path.join(out, "nosca-card-front-foil.pdf"))
    back = side(os.path.join(out, "nosca-card-back-colour.pdf"), os.path.join(out, "nosca-card-back-foil.pdf"))
    def on_table(cards, path, scale=0.38):
        gap, pad = px(8), px(10)
        W = sum(c.width for c in cards) + gap * (len(cards) - 1) + 2 * pad
        H = max(c.height for c in cards) + 2 * pad
        table = Image.new("RGBA", (W, H), (236, 233, 227, 255))
        x = pad
        for cd in cards:
            sh = Image.new("RGBA", table.size, (0, 0, 0, 0))
            sh.paste((20, 24, 20, 90), (x + px(0.6), pad + px(1.4), x + px(0.6) + cd.width, pad + px(1.4) + cd.height), cd.split()[3])
            sh = sh.filter(ImageFilter.GaussianBlur(px(1.2)))
            table = Image.alpha_composite(table, sh)
            table.alpha_composite(cd, (x, pad)); x += cd.width + gap
        table = table.convert("RGB").resize((int(table.width * scale), int(table.height * scale)), Image.LANCZOS)
        table.save(path, optimize=True)
    on_table([front, back], os.path.join(out, "preview-both.png"))
    on_table([front], os.path.join(out, "preview-front.png"))
    on_table([back], os.path.join(out, "preview-back.png"))
    print("previews written")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "docs", "brand", "business-card"))
    # THE PRINTED CODE. The cards went to print with this address in their code and it cannot be
    # changed: it is the site's first address, kept alive as a signpost that sends every page on to the
    # app's own address (index.html). Never "correct" this default to the new address — a reprint
    # would carry a code the cards in people's pockets do not.
    ap.add_argument("--site", default="https://nosca-pilot-2.netlify.app")
    ap.add_argument("--ground", default="olive", choices=["green", "olive"])
    ap.add_argument("--no-preview", action="store_true")
    a = ap.parse_args()
    out = os.path.abspath(a.out); os.makedirs(out, exist_ok=True)
    ground = GREEN if a.ground == "green" else OLIVE
    front_colour(os.path.join(out, "nosca-card-front-colour.pdf"), ground)
    front_foil(os.path.join(out, "nosca-card-front-foil.pdf"))
    back_colour(os.path.join(out, "nosca-card-back-colour.pdf"), a.site)
    back_foil(os.path.join(out, "nosca-card-back-foil.pdf"))
    print("code:", a.site.rstrip("/") + "/install")
    if not a.no_preview: preview(out, a.ground)

if __name__ == "__main__":
    main()
