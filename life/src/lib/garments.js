/* Garment illustrations.
 *
 * Every item in the wardrobe is drawn, not photographed: a flat vector
 * sticker in a 200×200 box, the garment's own colour with a slightly
 * darker outline, patterns as SVG patterns (stripes, hoops, cable knit,
 * waffle, argyle, checks), and details as simple marks (a zip, a
 * collar, a logo dot). The same module draws for the gallery and for
 * the app, so an item looks identical everywhere.
 *
 *   renderGarment(item) -> string of <svg>
 *
 * `item.draw` picks the template and its parameters. Ids inside the
 * SVG are prefixed with the item id so a page can hold hundreds.
 */

export const C = {
  black: "#1B1B1F", charcoal: "#33363B", darkGrey: "#4A4D52", midGrey: "#7B7E83",
  grey: "#9A9C9F", lightGrey: "#D4D6D8", paleGrey: "#E6E7E9",
  white: "#F7F7F5", stark: "#FFFFFF", offWhite: "#F1ECE1", cream: "#F3EBD8",
  ecru: "#E9E1CF", beige: "#D9C7A6", yellowBeige: "#E2CD9E", sage: "#CFCBB0", sand: "#E4D5B8",
  navy: "#1E2A4A", darkNavy: "#141C33", blueNavy: "#2B3F73", primaryBlue: "#2457C5",
  lightBlue: "#9CC3E8", oceanBlue: "#6FA8DC", turquoise: "#5FC4D6", skyBlue: "#BFD9F0",
  denimLight: "#A9C6E3", denimDark: "#3E4A5C",
  red: "#C8323C", lightRed: "#D9534F", wine: "#6B1F2E", redBurgundy: "#8C2130", burgundy: "#7A2A3A",
  pink: "#F2C4D0", lilac: "#D9C2E3", lightOrange: "#F4C9A6", olive: "#B8B890", lightOlive: "#C9CBA3",
  green: "#3F7A4F", pastelGreen: "#CFE3D1", gold: "#D4AF37", silver: "#C0C4C8", brass: "#8B6B2E",
  gum: "#C9A271", brown: "#8B6A47", volt: "#D8F23C", magenta: "#E24C8F", leather: "#6B4A2B",
};

/* ---------- colour helpers ---------- */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex([r, g, b]) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
/** shade(hex, f): f < 0 darkens towards black, f > 0 lightens towards white. */
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const t = f < 0 ? 0 : 255, k = Math.abs(f);
  return rgbToHex([r + (t - r) * k, g + (t - g) * k, b + (t - b) * k]);
}
const isLight = hex => { const [r, g, b] = hexToRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000 > 180; };
/** The outline is a darker version of the fill; a near-white garment gets a visible grey edge. */
const edge = fill => isLight(fill) ? shade(fill, -0.28) : shade(fill, -0.45);
const fold = fill => isLight(fill) ? shade(fill, -0.1) : shade(fill, -0.2);

/* ---------- patterns ---------- */
function patternDef(id, p) {
  const { kind } = p;
  if (kind === "vstripes") { // thin vertical stripes: a on b
    const wa = p.wa ?? 3, wb = p.wb ?? 3, w = wa + wb;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="10"><rect width="${w}" height="10" fill="${p.b}"/><rect width="${wa}" height="10" fill="${p.a}"/></pattern>`;
  }
  if (kind === "multistripe") { // a group of n fine lines of colour a, then a gap of b
    const n = p.n ?? 4, lw = p.lw ?? 1.2, gap = p.gap ?? 1.2, block = p.block ?? 8;
    const groupW = n * lw + (n - 1) * gap, w = groupW + block;
    let lines = ""; for (let i = 0; i < n; i++) lines += `<rect x="${(i * (lw + gap)).toFixed(2)}" width="${lw}" height="10" fill="${p.a}"/>`;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w.toFixed(2)}" height="10"><rect width="${w.toFixed(2)}" height="10" fill="${p.b}"/>${lines}</pattern>`;
  }
  if (kind === "hoops") { // horizontal stripes
    const ha = p.ha ?? 10, hb = p.hb ?? 10, h = ha + hb;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="10" height="${h}"><rect width="10" height="${h}" fill="${p.b}"/><rect width="10" height="${ha}" fill="${p.a}"/></pattern>`;
  }
  if (kind === "cable") { // vertical ropes on the base
    const d = fold(p.base), w = p.w ?? 14;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="16"><rect width="${w}" height="16" fill="${p.base}"/><path d="M${w * .3} 0 C ${w * .7} 5, ${w * .7} 11, ${w * .3} 16 M${w * .7} 0 C ${w * .3} 5, ${w * .3} 11, ${w * .7} 16" fill="none" stroke="${d}" stroke-width="1.6"/></pattern>`;
  }
  if (kind === "rib") { // fine vertical ribs
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="4" height="10"><rect width="4" height="10" fill="${p.base}"/><rect width="1.2" height="10" fill="${d}"/></pattern>`;
  }
  if (kind === "waffle") {
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="7" height="7"><rect width="7" height="7" fill="${p.base}"/><path d="M0 .5 H7 M.5 0 V7" stroke="${d}" stroke-width="1"/></pattern>`;
  }
  if (kind === "seams") { // diagonal knit seams
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="12" height="12"><rect width="12" height="12" fill="${p.base}"/><path d="M0 12 L12 0 M-3 3 L3 -3 M9 15 L15 9" stroke="${d}" stroke-width="1.2"/></pattern>`;
  }
  if (kind === "argyle") { // big diamonds, a over b, thin lines of c
    const w = p.w ?? 34, h = p.h ?? 46;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${p.b}"/><path d="M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z" fill="${p.a}"/><path d="M0 0 L${w} ${h} M${w} 0 L0 ${h}" stroke="${p.c}" stroke-width="1" opacity=".8"/></pattern>`;
  }
  if (kind === "checks") { // checkerboard a/b
    const s = p.s ?? 12;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${s * 2}" height="${s * 2}"><rect width="${s * 2}" height="${s * 2}" fill="${p.b}"/><rect width="${s}" height="${s}" fill="${p.a}"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="${p.a}"/></pattern>`;
  }
  if (kind === "baffles") { // puffer: horizontal quilt lines on the base
    const d = shade(p.base, isLight(p.base) ? -0.18 : -0.35);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="40" height="14"><rect width="40" height="14" fill="${p.base}"/><path d="M0 12 Q20 9 40 12" fill="none" stroke="${d}" stroke-width="1.6"/></pattern>`;
  }
  if (kind === "tartan") { // a windowpane check of c over base
    const z = p.s ?? 22, k = z * 0.23, m = z / 2;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${z}" height="${z}"><rect width="${z}" height="${z}" fill="${p.base}"/><rect width="${z}" height="${k}" fill="${p.c}" opacity=".55"/><rect width="${k}" height="${z}" fill="${p.c}" opacity=".55"/><rect x="${m}" width="${z}" height="1" fill="${p.d ?? p.c}" opacity=".5"/><rect y="${m}" width="1" height="${z}" fill="${p.d ?? p.c}" opacity=".5"/></pattern>`;
  }
  if (kind === "pique") { // tiny dots
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="4" height="4"><rect width="4" height="4" fill="${p.base}"/><circle cx="1" cy="1" r=".6" fill="${d}" opacity=".7"/><circle cx="3" cy="3" r=".6" fill="${d}" opacity=".7"/></pattern>`;
  }
  return "";
}

/* A drawing context: collects defs, hands out ids. */
function ctx(prefix) {
  let n = 0; const defs = [];
  return {
    defs,
    id: () => `${prefix}-${++n}`,
    /** fill for a pattern: returns url(#id) and registers the def */
    pat(p) { const id = this.id(); defs.push(patternDef(id, p)); return `url(#${id})`; },
  };
}

/* ---------- shared pieces ---------- */
const OUT = 2; // outline width

/* torso outlines: flat lay, arms down and a little out */
function torsoPath({ sleeve = "long", long = false, crop = false, taper = false, wide = false } = {}) {
  const hem = long ? 186 : crop ? 150 : 170;
  const bx = wide ? 4 : 0; // body wider
  const bl = 58 - bx, br = 142 + bx;
  const tl = taper ? 4 : 0; // hem pulled in
  if (sleeve === "short") {
    return `M74 46 L126 46 L158 54 L170 98 L146 104 L${br} 94 L${br - tl} ${hem} L${bl + tl} ${hem} L${bl} 94 L54 104 L30 98 L42 54 Z`;
  }
  if (sleeve === "none") {
    return `M74 46 L126 46 L150 54 L${br} 94 L${br - tl} ${hem} L${bl + tl} ${hem} L${bl} 94 L50 54 Z`;
  }
  return `M74 46 L126 46 L158 54 L174 140 L150 144 L${br} 92 L${br - tl} ${hem} L${bl + tl} ${hem} L${bl} 92 L50 144 L26 140 L42 54 Z`;
}

function neckOpening(fill, kind) {
  const inner = shade(fill, isLight(fill) ? -0.22 : -0.4);
  if (kind === "v") return `<path d="M82 46 L100 70 L118 46 Z" fill="${inner}"/>`;
  return `<ellipse cx="100" cy="47" rx="24" ry="7" fill="${inner}"/>`;
}
function ribBand(x, y, w, h, fill) { // horizontal rib: a band with vertical lines
  const d = fold(fill);
  let lines = ""; for (let i = x + 3; i < x + w; i += 4) lines += `M${i} ${y + 1} V${y + h - 1} `;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${edge(fill)}" stroke-width="1"/><path d="${lines}" stroke="${d}" stroke-width="1"/>`;
}
function cuffs(fill, kind) { // rib cuffs on the long sleeves
  if (kind === "none") return "";
  const f = kind === "button" ? fill : fill;
  const d = fold(fill), e = edge(fill);
  const left = `M27.5 131 L51.5 135 L50 144 L26 140 Z`, right = `M148.5 135 L172.5 131 L174 140 L150 144 Z`;
  let r = `<path d="${left}" fill="${f}" stroke="${e}" stroke-width="1"/><path d="${right}" fill="${f}" stroke="${e}" stroke-width="1"/>`;
  if (kind === "rib") r += `<path d="M31 133 L30 141 M35 133.6 L34 141.6 M39 134.3 L38 142.3 M43 135 L42 143 M47 135.6 L46 143.6 M153 134.6 L154 142.6 M157 134 L158 142 M161 133.3 L162 141.3 M165 132.6 L166 140.6 M169 132 L170 140" stroke="${d}" stroke-width="1"/>`;
  if (kind === "button") r += `<circle cx="36" cy="138" r="1.6" fill="${e}"/><circle cx="164" cy="138" r="1.6" fill="${e}"/>`;
  return r;
}
function zipLine(y1, y2, color, pull = true) {
  return `<line x1="100" y1="${y1}" x2="100" y2="${y2}" stroke="${color}" stroke-width="2.2"/><line x1="100" y1="${y1}" x2="100" y2="${y2}" stroke="${shade(color, 0.5)}" stroke-width=".8" stroke-dasharray="1.5 1.5"/>${pull ? `<rect x="98" y="${y1 + 4}" width="4" height="7" rx="1" fill="${color}"/>` : ""}`;
}
function logoMark(color, x = 124, y = 82, size = 5) {
  return `<circle cx="${x}" cy="${y}" r="${size * .6}" fill="${color}"/><path d="M${x - size * .9} ${y + size * .9} l${size * .9} -${size * .5} l${size * .9} ${size * .5}" stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
}
function hoodBack(fill) {
  const f = fold(fill), e = edge(fill);
  return `<path d="M64 52 Q66 12 100 10 Q134 12 136 52 Q118 44 100 44 Q82 44 64 52 Z" fill="${f}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
}
function drawstrings(color) {
  return `<path d="M92 54 V84 M108 54 V84" stroke="${color}" stroke-width="1.6"/><circle cx="92" cy="86" r="2" fill="${color}"/><circle cx="108" cy="86" r="2" fill="${color}"/>`;
}
function shirtCollar(fill, collarFill, { wide = false, stand = true } = {}) {
  const cf = collarFill || fill, e = edge(cf), w = wide ? 6 : 0;
  return `${stand ? `<path d="M72 46 Q100 60 128 46 L126 40 Q100 52 74 40 Z" fill="${fold(cf)}" stroke="${e}" stroke-width="1"/>` : ""}<path d="M${74 - w} 44 L100 68 L${92 - w} 36 Z" fill="${cf}" stroke="${e}" stroke-width="1.4" stroke-linejoin="round"/><path d="M${126 + w} 44 L100 68 L${108 + w} 36 Z" fill="${cf}" stroke="${e}" stroke-width="1.4" stroke-linejoin="round"/>`;
}
function placket(fill, y1, y2, buttons, color) {
  const e = edge(fill);
  let b = ""; for (let i = 0; i < buttons; i++) { const y = y1 + 10 + i * ((y2 - y1 - 14) / Math.max(1, buttons - 1)); b += `<circle cx="100" cy="${y.toFixed(1)}" r="1.8" fill="${color || e}"/>`; }
  return `<path d="M96 ${y1} V${y2} M104 ${y1} V${y2}" stroke="${e}" stroke-width="1" opacity=".7"/>${b}`;
}
function poloCollar(fill, collarFill, tipping) {
  const cf = collarFill || fill, e = edge(cf);
  let tip = "";
  if (tipping && tipping.length) { // stripes along the collar edge
    const n = tipping.length;
    tip = tipping.map((c, i) => `<path d="M${80 + i * 1.6} ${48 + i * 1.6} L100 ${64 - i * 1.8} L${120 - i * 1.6} ${48 + i * 1.6}" stroke="${c}" stroke-width="1.4" fill="none"/>`).join("") + (n ? "" : "");
  }
  return `<path d="M78 44 L100 66 L88 36 Z" fill="${cf}" stroke="${e}" stroke-width="1.4" stroke-linejoin="round"/><path d="M122 44 L100 66 L112 36 Z" fill="${cf}" stroke="${e}" stroke-width="1.4" stroke-linejoin="round"/>${tip}`;
}
function standCollar(fill, rib) {
  const e = edge(fill);
  return `<rect x="76" y="34" width="48" height="15" rx="5" fill="${fold(fill)}" stroke="${e}" stroke-width="1.4"/>${rib ? `<path d="M80 36 V47 M84 36 V47 M88 36 V47 M92 36 V47 M96 36 V47 M104 36 V47 M108 36 V47 M112 36 V47 M116 36 V47 M120 36 V47" stroke="${edge(fill)}" stroke-width=".8" opacity=".6"/>` : ""}<line x1="100" y1="34" x2="100" y2="49" stroke="${e}" stroke-width="1"/>`;
}
function pocketsKangaroo(fill) { const e = edge(fill); return `<path d="M68 126 L132 126 L136 162 L64 162 Z" fill="none" stroke="${e}" stroke-width="1.4"/><path d="M68 126 L74 146 M132 126 L126 146" stroke="${e}" stroke-width="1.4"/>`; }
function pocketsTwo(fill, y = 128, h = 30) { const e = edge(fill); return `<rect x="62" y="${y}" width="28" height="${h}" rx="3" fill="${fold(fill)}" stroke="${e}" stroke-width="1.2"/><rect x="110" y="${y}" width="28" height="${h}" rx="3" fill="${fold(fill)}" stroke="${e}" stroke-width="1.2"/>`; }
function pocketsSlash(fill) { const e = edge(fill); return `<path d="M66 128 L80 146 M134 128 L120 146" stroke="${e}" stroke-width="1.6"/>`; }
function chestPocket(fill, x = 110) { const e = edge(fill); return `<path d="M${x} 84 H${x + 20} V104 L${x + 10} 108 L${x} 104 Z" fill="none" stroke="${e}" stroke-width="1.2"/>`; }

/* ---------- templates ---------- */

function top(p, g) {
  const fill = p.fill, e = edge(fill);
  const body = torsoPath({ sleeve: p.sleeve, long: p.long, crop: p.crop, taper: p.taper, wide: p.wide });
  const hem = p.long ? 186 : p.crop ? 150 : 170;
  const patFill = p.pattern ? g.pat({ ...p.pattern, base: p.pattern.base || fill }) : null;
  let s = "";
  if (p.collar === "hood") s += hoodBack(fill);
  // body
  s += `<path d="${body}" fill="${fill}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
  if (patFill) s += `<path d="${body}" fill="${patFill}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
  // side folds for a little depth
  s += `<path d="M${p.wide ? 54 : 58} 94 L${p.wide ? 54 : 58} ${hem} M${p.wide ? 146 : 142} 94 L${p.wide ? 146 : 142} ${hem}" stroke="${fold(fill)}" stroke-width="1.2" opacity=".6"/>`;
  // extras painted on the body
  if (p.yoke) s += `<path d="M42 54 L74 46 L126 46 L158 54 L156 74 Q100 84 44 74 Z" fill="${p.yoke}" stroke="${edge(p.yoke)}" stroke-width="1.2"/>`;
  if (p.band) { // horizontal band(s) across the chest: [{y,h,color}]
    for (const b of p.band) s += `<rect x="${p.wide ? 55 : 59}" y="${b.y}" width="${p.wide ? 90 : 82}" height="${b.h}" fill="${b.color}"/>`;
  }
  if (p.panels) { // golf jacket piping
    const c = p.panels;
    s += `<path d="M58 100 H142 M58 134 H142 M30 98 L46 104 M170 98 L154 104 M100 100 V134" stroke="${c}" stroke-width="1.8" fill="none"/>`;
    s += `<path d="M42 54 L74 46 L126 46 L158 54 L156 72 Q100 80 44 72 Z" fill="${c}" opacity=".9"/>`;
  }
  if (p.lines) { // decorative lines [{d,color,w}]
    for (const l of p.lines) s += `<path d="${l.d}" stroke="${l.color}" stroke-width="${l.w || 2.2}" fill="none" stroke-linecap="round"/>`;
  }
  if (p.graphic) { // big front graphic
    const gc = p.graphic.color || C.black;
    s += `<g opacity=".92"><rect x="72" y="92" width="56" height="12" rx="2" fill="${gc}"/><rect x="72" y="110" width="40" height="10" rx="2" fill="${gc}"/><path d="M118 110 h12 v10 h-12 z M72 126 h22 v8 h-22 z M100 126 h28 v8 h-28 z" fill="${gc}"/></g>`;
  }
  if (p.emboss) { // tonal crest (Wimbledon)
    const gc = fold(fill);
    s += `<path d="M86 90 h28 v26 l-14 10 l-14 -10 z" fill="${gc}" stroke="${shade(fill, -0.3)}" stroke-width="1"/><path d="M92 98 h16 M92 104 h16 M92 110 h16" stroke="${shade(fill, -0.3)}" stroke-width="1.4"/>`;
  }
  if (p.text) { // a word across the chest (brand hoodie)
    s += `<rect x="78" y="100" width="44" height="12" rx="1" fill="${p.text}"/><path d="M84 104 h4 v4 h-4 z M92 104 h4 v4 h-4 z M100 104 h4 v4 h-4 z M108 104 h4 v4 h-4 z" fill="${fill}"/>`;
  }
  if (p.centerPatch) s += `<rect x="82" y="74" width="36" height="22" rx="3" fill="${p.centerPatch}" stroke="${edge(p.centerPatch)}" stroke-width="1"/>`;
  // pockets
  if (p.pockets === "kangaroo") s += pocketsKangaroo(fill);
  if (p.pockets === "two") s += pocketsTwo(fill);
  if (p.pockets === "twoBig") s += pocketsTwo(fill, 118, 44);
  if (p.pockets === "slash") s += pocketsSlash(fill);
  if (p.pockets === "chest") s += chestPocket(fill);
  if (p.pockets === "chestLeft") s += chestPocket(fill, 70);
  // zips
  const zc = p.zipColor || (isLight(fill) ? shade(fill, -0.5) : shade(fill, 0.35));
  if (p.zip === "full") s += zipLine(p.collar === "hood" ? 48 : 48, hem - 2, zc);
  if (p.zip === "quarter") s += zipLine(36, 92, zc);
  // hem
  if (p.hem === "rib") s += ribBand(p.wide ? 54 : 58, hem - 11, p.wide ? 92 : 84, 11, fill);
  if (p.hem === "band") s += `<rect x="${p.wide ? 54 : 58}" y="${hem - 9}" width="${p.wide ? 92 : 84}" height="9" fill="${fold(fill)}" stroke="${e}" stroke-width="1"/>`;
  // cuffs
  if (p.sleeve !== "short" && p.sleeve !== "none") s += cuffs(fill, p.cuffs || "plain");
  // collars
  if (p.collar === "crew") s += neckOpening(fill) + `<path d="M74 46 Q100 60 126 46" fill="none" stroke="${fold(fill)}" stroke-width="6"/><path d="M74 46 Q100 60 126 46" fill="none" stroke="${e}" stroke-width="1.2"/>`;
  if (p.collar === "v" || p.collar === "johnny") s += neckOpening(fill, "v") + `<path d="M82 46 L100 70 L118 46" fill="none" stroke="${fold(fill)}" stroke-width="4"/><path d="M82 46 L100 70 L118 46" fill="none" stroke="${e}" stroke-width="1.2"/>`;
  if (p.collar === "hood") s += `<path d="M74 46 Q100 64 126 46 Q100 56 74 46 Z" fill="${shade(fill, isLight(fill) ? -0.22 : -0.4)}"/>` + drawstrings(p.stringColor || (isLight(fill) ? shade(fill, -0.45) : shade(fill, 0.4)));
  if (p.collar === "stand") s += standCollar(p.collarFill || fill, false);
  if (p.collar === "bomber") s += standCollar(p.collarFill || fill, true);
  if (p.collar === "shirt") s += shirtCollar(fill, p.collarFill, { wide: p.wideCollar });
  if (p.collar === "polo") s += poloCollar(fill, p.collarFill, p.tipping);
  if (p.collar === "quarter") s += standCollar(p.collarFill || fill, false);
  if (p.collar === "rugby") s += shirtCollar(fill, p.collarFill || C.white, { stand: false });
  // plackets and buttons
  if (p.placket === "shirt") s += placket(fill, 64, hem - 6, p.buttons ?? 6, p.buttonColor);
  if (p.placket === "polo") s += placket(fill, 64, 90, p.buttons ?? 2, p.buttonColor);
  if (p.placket === "rugby") s += placket(fill, 64, 92, 3, p.buttonColor || C.white);
  // logo
  if (p.logo) s += logoMark(p.logo, p.logoX || 124, p.logoY || 84, p.logoSize || 5);
  if (p.signature) s += `<path d="M64 158 q4 -6 8 0 t8 0" stroke="${p.signature}" stroke-width="1.2" fill="none"/>`;
  return s;
}

function bottoms(p, g) {
  const fill = p.fill, e = edge(fill), f = fold(fill);
  const cut = p.cut || "straight";
  const shapes = {
    wide: "M62 30 L138 30 L152 184 L108 186 L100 108 L92 186 L48 184 Z",
    straight: "M62 30 L138 30 L146 184 L110 186 L100 108 L90 186 L54 184 Z",
    slim: "M62 30 L138 30 L140 184 L112 186 L100 108 L88 186 L60 184 Z",
    barrel: "M62 30 L138 30 Q158 110 144 184 L108 186 L100 108 L92 186 L56 184 Q42 110 62 30 Z",
    track: "M60 30 L140 30 L146 184 L110 186 L100 108 L90 186 L54 184 Z",
  };
  const body = shapes[cut] || shapes.straight;
  const patFill = p.pattern ? g.pat({ ...p.pattern, base: p.pattern.base || fill }) : null;
  let s = `<path d="${body}" fill="${fill}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
  if (patFill) s += `<path d="${body}" fill="${patFill}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
  // inseam shadow
  s += `<path d="M100 108 L92 186 M100 108 L108 186" stroke="${f}" stroke-width="1.2" opacity=".7"/>`;
  // waistband
  if (p.waist === "elastic") {
    s += ribBand(60, 28, 80, 10, fill);
    s += `<path d="M94 38 Q100 48 106 38" stroke="${isLight(fill) ? shade(fill, -0.5) : shade(fill, 0.5)}" stroke-width="1.4" fill="none"/>`;
  } else {
    s += `<rect x="62" y="28" width="76" height="9" fill="${f}" stroke="${e}" stroke-width="1"/>`;
    s += `<rect x="70" y="27" width="3" height="11" fill="${e}" opacity=".6"/><rect x="98.5" y="27" width="3" height="11" fill="${e}" opacity=".6"/><rect x="127" y="27" width="3" height="11" fill="${e}" opacity=".6"/>`;
    s += `<path d="M100 37 V106" stroke="${e}" stroke-width="1.2" opacity=".6"/>`;
  }
  if (p.pleats) s += `<path d="M82 38 L80 100 M118 38 L120 100" stroke="${shade(fill, isLight(fill) ? -0.2 : -0.35)}" stroke-width="1.6"/>`;
  if (p.jeans) {
    const st = p.stitch || C.gold;
    s += `<path d="M62 40 Q78 46 84 64 M138 40 Q122 46 116 64" stroke="${st}" stroke-width="1" fill="none" opacity=".8"/>`;
    s += `<path d="M66 32 V38 M134 32 V38" stroke="${st}" stroke-width="1" opacity=".8"/>`;
  }
  if (p.pockets === "slim") s += `<path d="M58 96 h12 v24 h-12 z M130 96 h12 v24 h-12 z" fill="${f}" stroke="${e}" stroke-width="1"/>`;
  if (p.pockets === "cargo") s += `<path d="M54 104 h24 v30 h-24 z M122 104 h24 v30 h-24 z" fill="${f}" stroke="${e}" stroke-width="1.2"/><path d="M54 112 h24 M122 112 h24" stroke="${e}" stroke-width="1"/>`;
  if (p.distress) s += `<path d="M70 120 h10 M118 140 h12 M74 150 h8 M128 100 h8" stroke="${shade(fill, 0.35)}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
  if (p.flames) {
    const fc = p.flames;
    const flame = (x, y, k) => { const n = v => (v * k).toFixed(1); return `<path d="M${x} ${y} q${n(3)} -10 ${n(1)} -18 q${n(6)} 8 ${n(2)} 18 q${n(5)} -6 ${n(3)} -14 q${n(4)} 10 ${n(-2)} 20 z" fill="${fc}" opacity=".9"/>`; };
    s += flame(58, 150, 1) + flame(60, 122, 1) + flame(142, 150, -1) + flame(140, 122, -1);
  }
  if (p.hem === "cuff") s += ribBand(52, 174, 38, 11, fill) + ribBand(110, 174, 38, 11, fill);
  if (p.drape) s += `<path d="M58 150 Q62 170 56 184 M142 150 Q138 170 144 184" stroke="${f}" stroke-width="1.2" fill="none" opacity=".7"/>`;
  return s;
}

function shoe(p) {
  const up = p.upper, e = edge(up), sole = p.sole || C.white, accent = p.accent;
  const style = p.style || "sneaker";
  let s = "";
  if (style === "oxford") {
    s += `<path d="M22 138 Q28 114 72 108 L118 92 Q150 86 170 112 L176 138 Z" fill="${up}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
    s += `<path d="M22 138 H176 Q180 146 170 148 L30 148 Q18 148 22 138 Z" fill="${shade(up, -0.2)}" stroke="${e}" stroke-width="1.5"/>`;
    s += `<rect x="150" y="146" width="24" height="8" rx="2" fill="${shade(up, -0.2)}" stroke="${e}" stroke-width="1"/>`; // heel
    s += `<path d="M72 108 Q78 126 70 138" stroke="${shade(up, 0.35)}" stroke-width="1.2" fill="none"/>`; // cap toe
    s += `<path d="M112 100 l10 6 M118 96 l10 6 M124 92 l10 6" stroke="${shade(up, 0.4)}" stroke-width="1.4"/>`; // laces
    s += `<path d="M22 140 Q100 146 176 140" stroke="${shade(up, 0.25)}" stroke-width="1" fill="none"/>`;
    return s;
  }
  const chunky = style === "af1" || style === "runner" || style === "nb";
  const T = chunky ? 128 : 136, soleBot = chunky ? 158 : 152;
  // upper: toe at the left, the collar opening at the right
  const upperD = `M22 ${T} C22 ${T - 12} 40 ${T - 22} 68 ${T - 26} L112 ${T - 46} C122 ${T - 52} 136 ${T - 56} 148 ${T - 52} C160 ${T - 48} 170 ${T - 32} 174 ${T - 12} L176 ${T} Z`;
  s += `<path d="${upperD}" fill="${up}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
  if (p.panel) s += `<path d="M128 ${T - 50} Q150 ${T - 56} 166 ${T - 36} L174 ${T - 12} L176 ${T} L136 ${T} Z" fill="${p.panel}" opacity=".9"/>`;
  if (p.toe) s += `<path d="M22 ${T} C22 ${T - 12} 40 ${T - 22} 68 ${T - 26} L76 ${T - 22} Q78 ${T - 10} 74 ${T} Z" fill="${p.toe}" stroke="${edge(p.toe)}" stroke-width="1.2"/>`;
  if (p.perforated) s += `<g fill="${shade(up, -0.3)}" opacity=".6"><circle cx="40" cy="${T - 10}" r="1"/><circle cx="48" cy="${T - 14}" r="1"/><circle cx="56" cy="${T - 17}" r="1"/><circle cx="44" cy="${T - 4}" r="1"/><circle cx="52" cy="${T - 8}" r="1"/><circle cx="60" cy="${T - 11}" r="1"/></g>`;
  if (p.stripes) s += `<path d="M84 ${T - 26} L92 ${T - 2} M96 ${T - 31} L104 ${T - 2} M108 ${T - 36} L116 ${T - 2}" stroke="${p.stripes}" stroke-width="5" stroke-linecap="round" opacity=".95"/>`;
  if (p.swoosh) s += `<path d="M58 ${T - 6} Q110 ${T - 2} 156 ${T - 36} Q116 ${T - 14} 68 ${T - 16} Z" fill="${p.swoosh}" opacity=".95"/>`;
  if (p.nPanel) s += `<path d="M100 ${T - 6} L104 ${T - 38} L112 ${T - 38} L122 ${T - 18} L124 ${T - 38} L132 ${T - 38} L128 ${T - 6} L120 ${T - 6} L110 ${T - 26} L108 ${T - 6} Z" fill="${p.nPanel}" stroke="${edge(p.nPanel)}" stroke-width="1"/>`;
  if (p.heelTab) s += `<path d="M150 ${T - 51} Q168 ${T - 44} 174 ${T - 20}" stroke="${p.heelTab}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  // the collar opening and the eyestay
  s += `<path d="M114 ${T - 45} Q132 ${T - 57} 150 ${T - 51} Q140 ${T - 41} 118 ${T - 40} Z" fill="${shade(up, isLight(up) ? -0.3 : -0.5)}"/>`;
  s += `<path d="M70 ${T - 22} L112 ${T - 42}" stroke="${e}" stroke-width="1.2" opacity=".7"/>`;
  const lc = p.laces || (isLight(up) ? shade(up, -0.35) : shade(up, 0.5));
  s += `<path d="M78 ${T - 28} l9 -5 M87 ${T - 32} l9 -5 M96 ${T - 36} l9 -5 M105 ${T - 40} l8 -4" stroke="${lc}" stroke-width="2" stroke-linecap="round"/>`;
  const soleTop = T;
  // sole
  const se = edge(sole);
  s += `<path d="M20 ${soleTop} H178 Q184 ${(soleTop + soleBot) / 2} 170 ${soleBot} L34 ${soleBot} Q16 ${soleBot} 20 ${soleTop} Z" fill="${sole}" stroke="${se}" stroke-width="1.5"/>`;
  if (p.midsole) s += `<path d="M24 ${soleTop + 2} H176 Q178 ${soleTop + 10} 172 ${soleTop + 14} L30 ${soleTop + 14} Q22 ${soleTop + 10} 24 ${soleTop + 2} Z" fill="${p.midsole}" opacity=".95"/>`;
  if (p.plate) s += `<path d="M30 ${soleBot - 6} Q100 ${soleBot - 18} 172 ${soleBot - 8}" stroke="${p.plate}" stroke-width="2.4" fill="none"/>`;
  if (p.soleLine) s += `<path d="M28 ${soleTop + 8} H170" stroke="${shade(sole, -0.25)}" stroke-width="1" opacity=".8"/>`;
  return s;
}

function cap(p) {
  const f = p.fill, e = edge(f), peak = p.peak || f;
  let s = `<path d="M46 118 Q46 56 100 56 Q154 56 154 118 Z" fill="${f}" stroke="${e}" stroke-width="${OUT}"/>`;
  s += `<path d="M100 56 V118 M72 62 Q66 90 66 118 M128 62 Q134 90 134 118" stroke="${fold(f)}" stroke-width="1.2" fill="none"/>`;
  s += `<circle cx="100" cy="56" r="3" fill="${fold(f)}" stroke="${e}" stroke-width="1"/>`;
  s += `<path d="M32 118 Q100 102 168 118 Q168 140 100 146 Q32 140 32 118 Z" fill="${peak}" stroke="${edge(peak)}" stroke-width="${OUT}"/>`;
  s += `<path d="M40 124 Q100 112 160 124" stroke="${fold(peak)}" stroke-width="1" fill="none"/>`;
  if (p.logo) s += logoMark(p.logo, 100, 92, 6);
  if (p.patch) s += `<rect x="86" y="84" width="28" height="14" rx="2" fill="${p.patch}" stroke="${edge(p.patch)}" stroke-width="1"/>`;
  return s;
}
function beanie(p) {
  const f = p.fill, e = edge(f);
  let s = `<path d="M46 128 Q46 48 100 48 Q154 48 154 128 Z" fill="${f}" stroke="${e}" stroke-width="${OUT}"/>`;
  s += `<path d="M70 56 Q62 90 60 128 M85 50 Q80 90 80 128 M100 48 V128 M115 50 Q120 90 120 128 M130 56 Q138 90 140 128" stroke="${fold(f)}" stroke-width="1.2" fill="none"/>`;
  s += ribBand(44, 112, 112, 22, f);
  if (p.patch) s += `<rect x="88" y="117" width="24" height="12" rx="2" fill="${p.patch}" stroke="${edge(p.patch)}" stroke-width="1"/>`;
  return s;
}
function scarf(p, g) {
  const f = p.fill, e = edge(f);
  const pat = g.pat({ kind: "tartan", s: 11, base: f, c: p.check || shade(f, -0.3), d: p.check2 || shade(f, 0.35) });
  const d = "M56 28 L100 72 L144 28 L158 42 L112 88 L112 166 L88 166 L88 88 L42 42 Z";
  let s = `<path d="${d}" fill="${f}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/><path d="${d}" fill="${pat}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
  s += `<path d="M88 166 l0 10 M94 166 l0 10 M100 166 l0 10 M106 166 l0 10 M112 166 l0 10" stroke="${e}" stroke-width="1.6"/>`;
  return s;
}
function backpack(p) {
  const f = p.fill, e = edge(f), fd = fold(f);
  let s = `<path d="M60 70 Q60 40 100 38 Q140 40 140 70 L140 158 Q140 170 128 170 L72 170 Q60 170 60 158 Z" fill="${f}" stroke="${e}" stroke-width="${OUT}"/>`;
  s += `<path d="M86 40 Q100 24 114 40" stroke="${e}" stroke-width="3" fill="none" stroke-linecap="round"/>`; // handle
  s += `<path d="M70 108 H130 V158 Q130 164 124 164 H76 Q70 164 70 158 Z" fill="${fd}" stroke="${e}" stroke-width="1.4"/>`; // front pocket
  s += `<path d="M70 110 H130" stroke="${isLight(f) ? shade(f, -0.4) : shade(f, 0.35)}" stroke-width="1.6" stroke-dasharray="2 2"/>`; // zip
  s += `<path d="M64 76 Q100 86 136 76" stroke="${isLight(f) ? shade(f, -0.4) : shade(f, 0.35)}" stroke-width="1.6" stroke-dasharray="2 2" fill="none"/>`;
  if (p.bottom) s += `<path d="M60 150 L140 150 L140 158 Q140 170 128 170 L72 170 Q60 170 60 158 Z" fill="${p.bottom}" stroke="${edge(p.bottom)}" stroke-width="1.2"/>`;
  if (p.logo) s += logoMark(p.logo, 100, 94, 5);
  if (p.patch) s += `<rect x="90" y="88" width="20" height="12" rx="2" fill="${p.patch}" stroke="${edge(p.patch)}" stroke-width="1"/>`;
  return s;
}
function duffel(p, g) {
  const f = p.fill, e = edge(f);
  const pat = p.pattern ? g.pat({ ...p.pattern, base: f }) : null;
  const d = "M30 72 H170 Q190 72 190 110 Q190 148 170 148 H30 Q10 148 10 110 Q10 72 30 72 Z";
  let s = `<path d="${d}" fill="${f}" stroke="${e}" stroke-width="${OUT}"/>`;
  if (pat) s += `<path d="${d}" fill="${pat}" stroke="${e}" stroke-width="${OUT}"/>`;
  s += `<path d="M30 72 Q40 110 30 148 M170 72 Q160 110 170 148" stroke="${fold(f)}" stroke-width="1.4" fill="none"/>`; // end caps
  s += `<path d="M40 78 H160" stroke="${isLight(f) ? shade(f, -0.4) : shade(f, 0.4)}" stroke-width="1.6" stroke-dasharray="2 2"/>`; // zip
  const strap = p.strap || fold(f);
  s += `<rect x="60" y="70" width="12" height="80" fill="${strap}" stroke="${edge(strap)}" stroke-width="1"/><rect x="128" y="70" width="12" height="80" fill="${strap}" stroke="${edge(strap)}" stroke-width="1"/>`;
  s += `<path d="M66 70 Q80 36 100 36 Q120 36 134 70" stroke="${strap}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M66 70 Q80 36 100 36 Q120 36 134 70" stroke="${edge(strap)}" stroke-width="1" fill="none"/>`; // handles
  if (p.buckle) s += `<rect x="58" y="112" width="16" height="10" rx="2" fill="${p.buckle}" stroke="${edge(p.buckle)}" stroke-width="1"/><rect x="126" y="112" width="16" height="10" rx="2" fill="${p.buckle}" stroke="${edge(p.buckle)}" stroke-width="1"/>`;
  if (p.logo) s += logoMark(p.logo, 100, 112, 5);
  return s;
}
function holdall(p, g) {
  const f = p.fill, e = edge(f);
  const pat = p.pattern ? g.pat({ ...p.pattern, base: f }) : null;
  const d = "M28 76 H172 Q182 76 182 86 V140 Q182 150 172 150 H28 Q18 150 18 140 V86 Q18 76 28 76 Z";
  let s = `<path d="${d}" fill="${f}" stroke="${e}" stroke-width="${OUT}"/>`;
  if (pat) s += `<path d="${d}" fill="${pat}" stroke="${e}" stroke-width="${OUT}"/>`;
  s += `<path d="M18 92 H182" stroke="${fold(f)}" stroke-width="1.2"/>`;
  s += `<path d="M46 76 V150 M154 76 V150" stroke="${fold(f)}" stroke-width="1.2"/>`; // end panels
  const h = p.handle || fold(f);
  s += `<path d="M70 76 Q78 44 100 44 Q122 44 130 76" stroke="${h}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M70 76 Q78 44 100 44 Q122 44 130 76" stroke="${edge(h)}" stroke-width="1" fill="none"/>`;
  s += `<path d="M60 80 H140" stroke="${isLight(f) ? shade(f, -0.4) : shade(f, 0.4)}" stroke-width="1.6" stroke-dasharray="2 2"/>`;
  if (p.patch) s += `<rect x="84" y="106" width="32" height="18" rx="2" fill="${p.patch}" stroke="${edge(p.patch)}" stroke-width="1"/>`;
  return s;
}
function watch(p) {
  const strap = p.strap, face = p.face || C.black, caseC = p.case || C.silver;
  let s = `<rect x="86" y="24" width="28" height="152" rx="6" fill="${strap}" stroke="${edge(strap)}" stroke-width="${OUT}"/>`;
  if (p.links) { let l = ""; for (let y = 30; y < 176; y += 9) l += `M86 ${y} H114 `; s += `<path d="${l}" stroke="${edge(strap)}" stroke-width="1.2"/>`; }
  if (p.shape === "square") {
    s += `<rect x="72" y="68" width="56" height="64" rx="${p.rx ?? 8}" fill="${caseC}" stroke="${edge(caseC)}" stroke-width="${OUT}"/>`;
    s += `<rect x="80" y="78" width="40" height="44" rx="${p.rx ? p.rx - 2 : 4}" fill="${face}" stroke="${edge(face)}" stroke-width="1"/>`;
    if (p.digits) s += `<path d="M86 90 h12 M102 90 h12 M86 104 h28 M90 112 h20" stroke="${p.digits}" stroke-width="2.2"/>`;
    if (p.screen) s += `<circle cx="92" cy="94" r="4" fill="${p.screen}"/><rect x="100" y="90" width="14" height="8" rx="2" fill="${p.screen}"/><rect x="86" y="104" width="28" height="4" rx="2" fill="${shade(p.screen, -0.3)}"/>`;
    s += `<rect x="128" y="90" width="4" height="10" rx="1" fill="${caseC}" stroke="${edge(caseC)}" stroke-width="1"/>`;
  } else {
    s += `<circle cx="100" cy="100" r="34" fill="${caseC}" stroke="${edge(caseC)}" stroke-width="${OUT}"/>`;
    s += `<circle cx="100" cy="100" r="28" fill="${face}" stroke="${edge(face)}" stroke-width="1"/>`;
    s += `<path d="M100 100 V80 M100 100 L114 108" stroke="${p.hands || C.white}" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `<rect x="134" y="94" width="5" height="12" rx="1" fill="${caseC}" stroke="${edge(caseC)}" stroke-width="1"/>`;
  }
  return s;
}
function tie(p) {
  const f = p.fill, e = edge(f);
  let s = `<path d="M88 30 L112 30 L106 56 L120 160 L100 186 L80 160 L94 56 Z" fill="${f}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
  s += `<path d="M88 30 L112 30 L108 50 L92 50 Z" fill="${fold(f)}" stroke="${e}" stroke-width="1.2"/>`;
  s += `<path d="M100 60 V170" stroke="${fold(f)}" stroke-width="1" opacity=".7"/>`;
  return s;
}
function belt(p, g) {
  const f = p.fill, e = edge(f);
  const pat = p.pattern ? g.pat({ ...p.pattern, base: f }) : null;
  const d = "M34 156 Q86 128 146 64";
  let s = `<path d="${d}" stroke="${e}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${f}" stroke-width="18" fill="none" stroke-linecap="round"/>`;
  if (pat) s += `<path d="${d}" stroke="${pat}" stroke-width="18" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M34 156 Q86 128 146 64" stroke="${fold(f)}" stroke-width="1" fill="none" opacity=".7" transform="translate(0 -6)"/>`;
  s += `<g fill="${e}"><circle cx="46" cy="146" r="1.8"/><circle cx="56" cy="138" r="1.8"/><circle cx="66" cy="130" r="1.8"/><circle cx="76" cy="121" r="1.8"/></g>`;
  const b = p.buckle || C.silver;
  s += `<g transform="translate(148 60) rotate(-48)"><rect x="-12" y="-16" width="24" height="32" rx="4" fill="none" stroke="${b}" stroke-width="4.5"/><path d="M0 -14 V14" stroke="${b}" stroke-width="3.5"/></g>`;
  return s;
}
function sunglasses(p) {
  const f = p.fill, e = edge(f), lens = p.lens || shade(f, 0.08);
  let s = `<path d="M24 92 Q24 70 48 70 H84 Q98 70 98 84 V104 Q98 126 74 126 H48 Q24 126 24 104 Z" fill="${f}" stroke="${e}" stroke-width="${OUT}"/>`;
  s += `<path d="M102 92 Q102 70 126 70 H152 Q176 70 176 104 Q176 126 152 126 H126 Q102 126 102 104 Z" fill="${f}" stroke="${e}" stroke-width="${OUT}"/>`;
  s += `<rect x="30" y="76" width="62" height="44" rx="14" fill="${lens}"/><rect x="108" y="76" width="62" height="44" rx="14" fill="${lens}"/>`;
  s += `<path d="M98 86 Q100 80 102 86" stroke="${f}" stroke-width="5" fill="none"/>`;
  s += `<path d="M24 86 L8 80 M176 86 L192 80" stroke="${f}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<path d="M40 84 q10 -6 20 0" stroke="${shade(lens, 0.5)}" stroke-width="2" fill="none" opacity=".5"/>`;
  return s;
}
function socks(p, g) {
  const f = p.fill, e = edge(f);
  const pat = p.pattern ? g.pat({ ...p.pattern, base: f }) : null;
  const one = (dx) => {
    const d = `M${72 + dx} 40 H${106 + dx} V120 Q${110 + dx} 142 ${138 + dx} 150 Q${152 + dx} 160 ${136 + dx} 172 H${90 + dx} Q${72 + dx} 170 ${72 + dx} 150 Z`;
    let s = `<path d="${d}" fill="${f}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
    if (pat) s += `<path d="${d}" fill="${pat}" stroke="${e}" stroke-width="${OUT}" stroke-linejoin="round"/>`;
    s += ribBand(72 + dx, 40, 34, 16, f);
    if (p.lines) s += `<path d="M${72 + dx} 68 H${106 + dx} M${72 + dx} 76 H${106 + dx}" stroke="${p.lines}" stroke-width="2.4"/>`;
    s += `<path d="M${124 + dx} 164 Q${100 + dx} 172 ${80 + dx} 164" stroke="${fold(f)}" stroke-width="1.2" fill="none"/>`;
    return s;
  };
  return `<g opacity=".55">${one(-22)}</g>${one(10)}`;
}

const TEMPLATES = { top, bottoms, shoe, cap, beanie, scarf, backpack, duffel, holdall, watch, tie, belt, sunglasses, socks };

/** Draws one item. `item.id` keeps pattern ids unique on a page. */
export function renderGarment(item, { size = 200, className = "" } = {}) {
  const d = item.draw || {};
  const fn = TEMPLATES[d.t];
  const g = ctx(`p${String(item.id).replace(/[^a-zA-Z0-9_-]/g, "")}`);
  const body = fn ? fn(d, g) : `<rect x="40" y="40" width="120" height="120" rx="12" fill="none" stroke="#999" stroke-dasharray="4 4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${(item.name || "").replace(/"/g, "&quot;")}" class="${className}"><defs>${g.defs.join("")}</defs>${body}</svg>`;
}
