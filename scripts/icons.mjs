/* The app icons, drawn from the same geometry as the mark on screen.
 *
 * Run: node scripts/icons.mjs
 *
 * They are checked in — Netlify serves public/ as it stands and never
 * runs this — but they are generated rather than drawn so the icon on
 * a home screen can never drift from the mark inside the app. Change
 * MARK in src/lib/brandmark.jsx, run this, commit what it writes.
 *
 * No image library: a PNG is a zlib stream of rows, and the mark is two
 * circular strokes, so the whole thing is arithmetic. Coverage is
 * sampled 4×4 per pixel, which is enough to look drawn rather than
 * aliased at every size we ship.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

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
function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;                                        // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
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
/* `scale` sizes the mark's own 40-unit box against the icon. At 0.72
   the rings span about 58% of the width — as large as they can be and
   still sit inside the 80% circle a maskable icon is cropped to. */
function render({ size, bg, ring, scale = 0.72, weight = W }) {
  const px = Buffer.alloc(size * size * 4);
  const [br, bgc, bb] = bg ? hex(bg) : [0, 0, 0];
  const [mr, mg, mb] = hex(ring);
  /* the mark's own box is 40 wide; place it centred at `scale` of the icon */
  const unit = (size * scale) / 40;
  const ox = size / 2 - 20 * unit, oy = size / 2 - 12.5 * unit;
  const SS = 4, step = 1 / SS;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let ink = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const mx = (x + (sx + 0.5) * step - ox) / unit;
          const my = (y + (sy + 0.5) * step - oy) / unit;
          if (RINGS.some((r) => onRing(r, mx, my, weight))) ink++;
        }
      }
      const a = ink / (SS * SS);
      const i = (y * size + x) * 4;
      if (bg) {
        px[i] = Math.round(br + (mr - br) * a);
        px[i + 1] = Math.round(bgc + (mg - bgc) * a);
        px[i + 2] = Math.round(bb + (mb - bb) * a);
        px[i + 3] = 255;
      } else {
        px[i] = mr; px[i + 1] = mg; px[i + 2] = mb;
        px[i + 3] = Math.round(a * 255);
      }
    }
  }
  return png(size, size, px);
}

const INK = "#0B0F0C", PAPER = "#F4F6F3";
/* Deliberately one colour. A gold segment on the crossing looked like a
   flaw in the ring at 60px rather than a detail; the weave already says
   linked, and it says it at every size. */
const files = [
  ["icon-192.png", { size: 192, bg: INK, ring: PAPER }],
  ["icon-512.png", { size: 512, bg: INK, ring: PAPER }],
  ["apple-touch-icon.png", { size: 180, bg: INK, ring: PAPER }],
  /* A notification badge is drawn as a silhouette in the system's own
     colour, so it is white on nothing and carries no accent. */
  ["badge-96.png", { size: 96, bg: null, ring: "#FFFFFF", scale: 0.86, weight: 3.4 }],
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
  <g fill="none" stroke="${PAPER}" stroke-width="${W}" stroke-linecap="round" transform="translate(0 7.5)">
    <path d="${arc(LX, HALF)}"/>
    <path d="${arc(RX, -(Math.PI - HALF))}"/>
  </g>
</svg>
`;
writeFileSync(join(OUT, "favicon.svg"), svg);
console.log("wrote favicon.svg");
