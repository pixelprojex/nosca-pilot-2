/* The app icons, drawn from the same geometry as the mark on screen.
 *
 * Run: node scripts/icons.mjs
 *
 * They are checked in — Netlify serves public/ as it stands and never
 * runs this — but they are generated rather than drawn so the icon on
 * a home screen can never drift from the mark inside the app. Change
 * MARK in src/lib/brandmark.jsx, run this, commit what it writes.
 *
 * The App Store and Google Play shell's icons and launch screens come
 * from the same numbers, written into ios/ and android/ when they are
 * there (the end of this file; docs/native/README.md).
 *
 * No image library: a PNG is a zlib stream of rows, and the mark is two
 * circular strokes, so the whole thing is arithmetic. Coverage is
 * sampled 4×4 per pixel, which is enough to look drawn rather than
 * aliased at every size we ship.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");

/* ---------- the mark, in its own 40 × 25 space ---------- */
const R = 8.6, LX = 14, RX = 26, CY = 12.5, W = 2.75;
const DEG = Math.PI / 180;
const HALF = Math.acos(6 / R);          // where the circles cross
const GAP = 11.5 * DEG;                 // half the break in each ring

/* Each ring is drawn everywhere except a gap centred on the crossing
   the other ring passes over: the bottom one for the left ring, the
   top one for the right. */
const RINGS = [
  { cx: LX, gapAt: HALF },              //  +45.76°, the bottom crossing
  { cx: RX, gapAt: -(Math.PI - HALF) }, // -134.24°, the top crossing
];

const norm = (a) => { let x = a; while (x <= -Math.PI) x += 2 * Math.PI; while (x > Math.PI) x -= 2 * Math.PI; return x; };

/* Is this point on the stroke of ring `ring`? Round caps at both ends
   of the break, so the ring stops the way it does on screen. */
function onRing(ring, x, y, weight) {
  const dx = x - ring.cx, dy = y - CY;
  const d = Math.hypot(dx, dy);
  const half = weight / 2;
  if (d < R - half - 1.5 || d > R + half + 1.5) return false;
  const inGap = Math.abs(norm(Math.atan2(dy, dx) - ring.gapAt)) < GAP;
  if (!inGap) return d >= R - half && d <= R + half;
  /* inside the break: only the two rounded ends are ink */
  for (const s of [-1, 1]) {
    const a = ring.gapAt + s * GAP;
    if (Math.hypot(x - (ring.cx + R * Math.cos(a)), y - (CY + R * Math.sin(a))) <= half) return true;
  }
  return false;
}

/* ---------- PNG ---------- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
/* `ch` 4 is RGBA; 3 is RGB, for the App Store's icon, which may carry no
   alpha channel at all, however opaque */
function png(width, height, rgba, ch = 4) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = ch === 3 ? 2 : 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGB or RGBA
  const row = width * ch;
  const raw = Buffer.alloc(height * (row + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (row + 1)] = 0;                                              // filter: none
    rgba.copy(raw, y * (row + 1) + 1, y * row, (y + 1) * row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* ---------- render ---------- */
/* `scale` sizes the mark's own 40-unit box against the icon. At 0.74
   the rings span about 60% of the width — as large as they can be and
   still sit inside the 80% circle a maskable icon is cropped to.
   `weight` is heavier than the on-screen mark: iOS makes its 29px
   settings icon by shrinking the 180, and at 2.75 the stroke came out
   under a pixel and a half there. 3.6 keeps it a clear two. */
/* For the shell: `width` × `height` for a canvas that is not square (the
   Play Store's feature graphic), `markW` for the mark's box in pixels
   rather than a share of the canvas (a launch screen), `rgb` for no alpha
   channel, `clip: "circle"` for Android's round icon. Outside the mark's
   own box nothing is sampled — nothing there could be ink — so a launch
   screen of 2732 is quick and the web's icons come out byte for byte as
   they always have. */
function render({ size, width = size, height = size, bg, ring, scale = 0.74, weight = 3.6, markW = null, rgb = false, clip = null }) {
  const ch = rgb ? 3 : 4;
  const px = Buffer.alloc(width * height * ch);
  const [br, bgc, bb] = bg ? hex(bg) : [0, 0, 0];
  const [mr, mg, mb] = hex(ring);
  /* the mark's own box is 40 wide; place it centred at `scale` of the icon */
  const unit = markW ? markW / 40 : (size * scale) / 40;
  const ox = width / 2 - 20 * unit, oy = height / 2 - 12.5 * unit;
  const SS = 4, step = 1 / SS;
  const m = weight / 2 + 2;
  const x0 = Math.floor(ox + (LX - R - m) * unit) - 1, x1 = Math.ceil(ox + (RX + R + m) * unit) + 1;
  const y0 = Math.floor(oy + (CY - R - m) * unit) - 1, y1 = Math.ceil(oy + (CY + R + m) * unit) + 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let ink = 0;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const mx = (x + (sx + 0.5) * step - ox) / unit;
            const my = (y + (sy + 0.5) * step - oy) / unit;
            if (RINGS.some((r) => onRing(r, mx, my, weight))) ink++;
          }
        }
      }
      const a = ink / (SS * SS);
      let keep = 1;
      if (clip === "circle") {
        let inside = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            if (Math.hypot(x + (sx + 0.5) * step - width / 2, y + (sy + 0.5) * step - height / 2) <= width / 2) inside++;
          }
        }
        keep = inside / (SS * SS);
      }
      const i = (y * width + x) * ch;
      if (bg) {
        px[i] = Math.round(br + (mr - br) * a);
        px[i + 1] = Math.round(bgc + (mg - bgc) * a);
        px[i + 2] = Math.round(bb + (mb - bb) * a);
        if (!rgb) px[i + 3] = Math.round(255 * keep);
      } else {
        px[i] = mr; px[i + 1] = mg; px[i + 2] = mb;
        if (!rgb) px[i + 3] = Math.round(a * keep * 255);
      }
    }
  }
  return png(width, height, px, ch);
}

/* The base brand colour — the same value as BRAND in src/lib/brandmark.jsx,
   repeated here because this script runs outside the bundle. */
const INK = "#123C30", PAPER = "#F4F6F3";
/* Deliberately one colour. A gold segment on the crossing looked like a
   flaw in the ring at 60px rather than a detail; the weave already says
   linked, and it says it at every size. */
const files = [
  ["icon-192.png", { size: 192, bg: INK, ring: PAPER }],
  ["icon-512.png", { size: 512, bg: INK, ring: PAPER }],
  ["apple-touch-icon.png", { size: 180, bg: INK, ring: PAPER }],
  /* A notification badge is drawn as a silhouette in the system's own
     colour, so it is white on nothing and carries no accent. */
  ["badge-96.png", { size: 96, bg: null, ring: "#FFFFFF", scale: 0.86, weight: 3.6 }],
  /* the sizes iOS and Android actually show, rendered directly so the
     small ones are judged as drawn rather than as a guess */
  ["preview-29.png", { size: 29, bg: INK, ring: PAPER }],
  ["preview-60.png", { size: 60, bg: INK, ring: PAPER }],
];

for (const [name, opts] of files) {
  writeFileSync(join(OUT, name), render(opts));
  console.log("wrote", name, opts.size + "px");
}

/* The browser tab, as vector: crisp at 16px on a hi-dpi screen, which a
   PNG at that size never is. Same two arcs, written out from the same
   angles. */
const pt = (cx, deg) => `${(cx + R * Math.cos(deg)).toFixed(3)} ${(CY + R * Math.sin(deg)).toFixed(3)}`;
const arc = (cx, gapAt) => `M${pt(cx, gapAt + GAP)} A ${R} ${R} 0 1 1 ${pt(cx, gapAt - GAP)}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect width="40" height="40" rx="9" fill="${INK}"/>
  <g fill="none" stroke="${PAPER}" stroke-width="3.6" stroke-linecap="round" transform="translate(0 7.5)">
    <path d="${arc(LX, HALF)}"/>
    <path d="${arc(RX, -(Math.PI - HALF))}"/>
  </g>
</svg>
`;
writeFileSync(join(OUT, "favicon.svg"), svg);
console.log("wrote favicon.svg");

/* ---------- the App Store and Google Play shell ---------- */
/* Written only where `npx cap add` has made the native projects. The
   shell opens on its own launch screen — the brand ground and the mark —
   which fades once the app has drawn its first screen (src/lib/native.js);
   the sport splash is still the app's own. */
const IOS = join(ROOT, "ios", "App", "App", "Assets.xcassets");
const ANDROID = join(ROOT, "android", "app", "src", "main", "res");
const put = (path, body) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, body); console.log("wrote", path.slice(ROOT.length + 1)); };

/* The mark as vector paths in its own 40 × 25 units, for Android. */
const markPaths = (color, weight) => [arc(LX, HALF), arc(RX, -(Math.PI - HALF))]
  .map((d) => `        <path android:pathData="${d}" android:strokeColor="${color}" android:strokeWidth="${weight}" android:strokeLineCap="round" android:fillColor="#00000000" />`).join("\n");
const vector = ({ dp, unit, color, weight }) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/icons.mjs from the mark's own numbers: change the mark there. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${dp}dp" android:height="${dp}dp"
    android:viewportWidth="${dp}" android:viewportHeight="${dp}">
    <group android:translateX="${(dp / 2 - 20 * unit).toFixed(3)}" android:translateY="${(dp / 2 - 12.5 * unit).toFixed(3)}"
        android:scaleX="${unit}" android:scaleY="${unit}">
${markPaths(color, weight)}
    </group>
</vector>
`;

if (existsSync(IOS)) {
  /* one 1024 for every size iOS draws; no alpha channel, or App Store Connect refuses it */
  put(join(IOS, "AppIcon.appiconset", "AppIcon-512@2x.png"), render({ size: 1024, bg: INK, ring: PAPER, rgb: true }));
  /* the launch screen fills the phone from one square (LaunchScreen.storyboard, aspect fill):
     a mark of 616 there stands about 192 points across on a current iPhone — the sport
     splash's own — and 150 on the smallest; at the splash's own stroke */
  const launch = render({ size: 2732, bg: INK, ring: PAPER, markW: 616, weight: 2, rgb: true });
  for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) put(join(IOS, "Splash.imageset", f), launch);
}

if (existsSync(ANDROID)) {
  const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(DENSITY)) {
    /* Android 7: the square and the round, as the web's icon */
    put(join(ANDROID, `mipmap-${d}`, "ic_launcher.png"), render({ size: 48 * k, bg: INK, ring: PAPER }));
    put(join(ANDROID, `mipmap-${d}`, "ic_launcher_round.png"), render({ size: 48 * k, bg: INK, ring: PAPER, clip: "circle" }));
    /* Android 8 on: the mark alone on 108dp, the launcher's mask over the brand ground. A
       mask shows the middle 72, so the mark is drawn at two thirds of the web icon's share
       to stand the same in the shape the phone cuts */
    put(join(ANDROID, `mipmap-${d}`, "ic_launcher_foreground.png"), render({ size: 108 * k, bg: null, ring: PAPER, scale: 0.74 * 72 / 108 }));
  }
  put(join(ANDROID, "values", "ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- the brand, as src/lib/brandmark.jsx's BRAND (scripts/icons.mjs) -->
    <color name="ic_launcher_background">${INK}</color>
    <color name="nosca_brand">${INK}</color>
</resources>
`);
  /* Android 12's launch screen draws an icon of 288dp inside a circle of 192: the mark's box at 192 */
  put(join(ANDROID, "drawable", "splash_mark.xml"), vector({ dp: 288, unit: 4.8, color: PAPER, weight: 2 }));
  /* the launch screen for the plugin's older path: the ground and the same mark */
  put(join(ANDROID, "drawable", "splash.xml"), `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/icons.mjs. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/nosca_brand" />
    <item android:drawable="@drawable/splash_mark" android:gravity="center" />
</layer-list>
`);
  /* the status bar's notification icon: a white silhouette, as the web's badge */
  put(join(ANDROID, "drawable", "ic_stat_nosca.xml"), vector({ dp: 24, unit: 0.54, color: "#FFFFFF", weight: 3.6 }));
}

/* Google Play's feature graphic, 1024 × 500, uploaded by hand with the listing (docs/native/README.md);
   its 512 icon is public/icons/icon-512.png */
put(join(ROOT, "docs", "native", "store", "play-feature-graphic.png"), render({ size: 500, width: 1024, height: 500, bg: INK, ring: PAPER, markW: 300, weight: 2.4, rgb: true }));
