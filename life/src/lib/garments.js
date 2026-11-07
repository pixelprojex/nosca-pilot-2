/* Garment illustrations, second pass.
 *
 * Every item is drawn as a flat-lay illustration in a 200×200 box in
 * the manner of an animated film: soft volume shading on each part
 * (body, sleeves, legs), fabric folds, a soft ground shadow, small
 * brand marks at the size they really are, and model-specific shoe
 * silhouettes. No hard cartoon outline: a thin edge in a darker tone
 * of the fabric. The same module draws the gallery and the app.
 *
 *   renderGarment(item) -> string of <svg>
 */

export const C = {
  black: "#1F2125", charcoal: "#33363B", darkGrey: "#4A4D52", midGrey: "#7B7E83",
  grey: "#9A9C9F", lightGrey: "#D4D6D8", paleGrey: "#E6E7E9",
  white: "#F7F7F5", stark: "#FFFFFF", offWhite: "#F1ECE1", cream: "#F3EBD8",
  ecru: "#E9E1CF", beige: "#D9C7A6", yellowBeige: "#E2CD9E", sage: "#CFCBB0", sand: "#E4D5B8", stone: "#B9B3A8",
  navy: "#1E2A4A", darkNavy: "#161C33", dustyNavy: "#3E4A6E", blueNavy: "#2B3F73", primaryBlue: "#2457C5",
  lightBlue: "#9CC3E8", oceanBlue: "#6FA8DC", turquoise: "#5FC4D6", skyBlue: "#BFD9F0", frenchBlue: "#4B6CB7",
  denimLight: "#A9C6E3", denimDark: "#3E4A5C",
  red: "#C8323C", orangeRed: "#E8502A", lightRed: "#D9534F", wine: "#6B1F2E", redBurgundy: "#8C2130", burgundy: "#7A2A3A",
  pink: "#F2C4D0", lilac: "#D9B8D6", lightOrange: "#F4C9A6", olive: "#B8B890", lightOlive: "#C9CBA3",
  green: "#3F7A4F", croc: "#1E8A3E", greySage: "#A9B19E", gold: "#D4AF37", silver: "#C0C4C8", brass: "#8B6B2E",
  gum: "#C9A271", brown: "#8B6A47", suede: "#B9B2A4", volt: "#D8F23C", magenta: "#E24C8F", leather: "#6B4A2B",
};

/* ---------- colour helpers ---------- */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex([r, g, b]) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const t = f < 0 ? 0 : 255, k = Math.abs(f);
  return rgbToHex([r + (t - r) * k, g + (t - g) * k, b + (t - b) * k]);
}
const lum = hex => { const [r, g, b] = hexToRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000; };
const isLight = hex => lum(hex) > 180;
const isDark = hex => lum(hex) < 70;
/** Edge tone: darker than the fabric, never black. */
const edge = fill => isLight(fill) ? shade(fill, -0.3) : isDark(fill) ? shade(fill, 0.22) : shade(fill, -0.4);
const fold = fill => isLight(fill) ? shade(fill, -0.12) : shade(fill, -0.22);
const lift = fill => isLight(fill) ? shade(fill, 0.5) : shade(fill, 0.18);

/* ---------- patterns ---------- */
function patternDef(id, p) {
  const { kind } = p;
  if (kind === "vstripes") {
    const wa = p.wa ?? 3, wb = p.wb ?? 3, w = wa + wb;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="10"><rect width="${w}" height="10" fill="${p.b}"/><rect width="${wa}" height="10" fill="${p.a}"/></pattern>`;
  }
  if (kind === "multistripe") {
    const n = p.n ?? 4, lw = p.lw ?? 1.2, gap = p.gap ?? 1.2, block = p.block ?? 8;
    const groupW = n * lw + (n - 1) * gap, w = groupW + block;
    let lines = ""; for (let i = 0; i < n; i++) lines += `<rect x="${(i * (lw + gap)).toFixed(2)}" width="${lw}" height="10" fill="${p.a}"/>`;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w.toFixed(2)}" height="10"><rect width="${w.toFixed(2)}" height="10" fill="${p.b}"/>${lines}</pattern>`;
  }
  if (kind === "hoops") {
    const ha = p.ha ?? 10, hb = p.hb ?? 10, h = ha + hb;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="10" height="${h}"><rect width="10" height="${h}" fill="${p.b}"/><rect width="10" height="${ha}" fill="${p.a}"/></pattern>`;
  }
  if (kind === "cable") { // braided ropes with a lit side and a shaded side
    const d = shade(p.base, isLight(p.base) ? -0.16 : -0.3), l = lift(p.base), w = p.w ?? 16;
    const r = w * 0.5;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="20"><rect width="${w}" height="20" fill="${p.base}"/>
      <path d="M${r * .45} 0 C ${r * 1.5} 6, ${r * 1.5} 14, ${r * .45} 20" fill="none" stroke="${d}" stroke-width="2.4"/>
      <path d="M${r * .45 + 1.2} 0 C ${r * 1.5 + 1.2} 6, ${r * 1.5 + 1.2} 14, ${r * .45 + 1.2} 20" fill="none" stroke="${l}" stroke-width="1" opacity=".7"/>
      <path d="M${r * 1.55} 0 C ${r * .5} 6, ${r * .5} 14, ${r * 1.55} 20" fill="none" stroke="${d}" stroke-width="2.4"/>
      <path d="M${r * 1.55 - 1.2} 0 C ${r * .5 - 1.2} 6, ${r * .5 - 1.2} 14, ${r * 1.55 - 1.2} 20" fill="none" stroke="${l}" stroke-width="1" opacity=".7"/>
      <path d="M${w - 1} 0 V20" stroke="${d}" stroke-width="1" opacity=".5"/></pattern>`;
  }
  if (kind === "rib") {
    const d = fold(p.base), l = lift(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="4" height="10"><rect width="4" height="10" fill="${p.base}"/><rect width="1.3" height="10" fill="${d}"/><rect x="2.4" width=".8" height="10" fill="${l}" opacity=".6"/></pattern>`;
  }
  if (kind === "waffle") {
    const d = fold(p.base), l = lift(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="7" height="7"><rect width="7" height="7" fill="${p.base}"/><rect x="1" y="1" width="5" height="5" fill="${d}" opacity=".55"/><rect x="1.6" y="1.6" width="3.8" height="3.8" fill="${p.base}"/><path d="M1.6 1.6 H5.4" stroke="${l}" stroke-width=".7" opacity=".6"/></pattern>`;
  }
  if (kind === "seams") {
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="12" height="12"><rect width="12" height="12" fill="${p.base}"/><path d="M0 12 L12 0 M-3 3 L3 -3 M9 15 L15 9" stroke="${d}" stroke-width="1.2"/></pattern>`;
  }
  if (kind === "argyle") {
    const w = p.w ?? 34, h = p.h ?? 46;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${p.b}"/><path d="M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z" fill="${p.a}"/><path d="M0 0 L${w} ${h} M${w} 0 L0 ${h}" stroke="${p.c}" stroke-width="1" stroke-dasharray="2 1.5" opacity=".85"/></pattern>`;
  }
  if (kind === "checks") {
    const s = p.s ?? 12;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${s * 2}" height="${s * 2}"><rect width="${s * 2}" height="${s * 2}" fill="${p.b}"/><rect width="${s}" height="${s}" fill="${p.a}"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="${p.a}"/></pattern>`;
  }
  if (kind === "baffles") { // puffer: each baffle a soft tube
    const d = shade(p.base, isDark(p.base) ? 0.0 : -0.25), l = lift(p.base), h = p.h ?? 15;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="60" height="${h}"><rect width="60" height="${h}" fill="${p.base}"/><path d="M0 ${h - 1.5} Q30 ${h - 4} 60 ${h - 1.5}" fill="none" stroke="${shade(p.base, -0.55)}" stroke-width="2"/><path d="M0 3 Q30 .5 60 3" fill="none" stroke="${l}" stroke-width="1.2" opacity=".45"/><path d="M0 ${h - 4} Q30 ${h - 6.5} 60 ${h - 4}" fill="none" stroke="${d}" stroke-width="2" opacity=".5"/></pattern>`;
  }
  if (kind === "tartan") {
    const z = p.s ?? 22, k = z * 0.23, m = z / 2;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${z}" height="${z}"><rect width="${z}" height="${z}" fill="${p.base}"/><rect width="${z}" height="${k}" fill="${p.c}" opacity=".55"/><rect width="${k}" height="${z}" fill="${p.c}" opacity=".55"/><rect x="${m}" width="${z}" height="1" fill="${p.d ?? p.c}" opacity=".5"/><rect y="${m}" width="1" height="${z}" fill="${p.d ?? p.c}" opacity=".5"/></pattern>`;
  }
  if (kind === "pique") {
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="3" height="3"><rect width="3" height="3" fill="${p.base}"/><circle cx=".8" cy=".8" r=".5" fill="${d}" opacity=".55"/><circle cx="2.3" cy="2.3" r=".5" fill="${d}" opacity=".55"/></pattern>`;
  }
  if (kind === "mesh") {
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="3" height="3"><rect width="3" height="3" fill="${p.base}"/><circle cx="1.5" cy="1.5" r=".55" fill="${d}" opacity=".5"/></pattern>`;
  }
  if (kind === "fleece") {
    const d = fold(p.base);
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="5" height="5"><rect width="5" height="5" fill="${p.base}"/><circle cx="1" cy="1.5" r=".6" fill="${d}" opacity=".4"/><circle cx="3.5" cy="3.8" r=".6" fill="${d}" opacity=".4"/></pattern>`;
  }
  return "";
}

/* A drawing context: collects defs, hands out ids, shares the light rig. */
function ctx(prefix) {
  let n = 0; const defs = []; const shared = {};
  const g = {
    defs,
    id: () => `${prefix}-${++n}`,
    pat(p) { const id = this.id(); defs.push(patternDef(id, p)); return `url(#${id})`; },
    /** Light rig, defined once per drawing. */
    rig() {
      if (shared.rig) return shared.rig;
      const h = this.id(), v = this.id(), s = this.id(), hi = this.id();
      defs.push(`<linearGradient id="${h}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".22" stop-color="#000" stop-opacity=".05"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset=".78" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>`);
      defs.push(`<linearGradient id="${v}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>`);
      defs.push(`<radialGradient id="${s}"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".7" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`);
      defs.push(`<radialGradient id="${hi}" cx=".35" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
      shared.rig = { h: `url(#${h})`, v: `url(#${v})`, s: `url(#${s})`, hi: `url(#${hi})` };
      return shared.rig;
    },
  };
  return g;
}

/* ---------- drawing primitives ---------- */
/** A shaded part: fill, optional pattern, the two form gradients, a soft edge. */
function part(d, fill, g, { pattern = null, edgeW = 1.1, noV = false, opacity = 1 } = {}) {
  const r = g.rig();
  let s = `<path d="${d}" fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ""}/>`;
  if (pattern) s += `<path d="${d}" fill="${pattern}"/>`;
  s += `<path d="${d}" fill="${r.h}"/>`;
  if (!noV) s += `<path d="${d}" fill="${r.v}"/>`;
  s += `<path d="${d}" fill="none" stroke="${edge(fill)}" stroke-width="${edgeW}" stroke-linejoin="round" opacity=".75"/>`;
  return s;
}
/** A fabric fold: a soft dark crease with a thin lit ridge beside it. */
function crease(d, fill, strength = 1) {
  return `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${(0.14 * strength).toFixed(2)}" stroke-width="2.2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity="${((isDark(fill) ? 0.14 : 0.3) * strength).toFixed(2)}" stroke-width=".9" stroke-linecap="round" transform="translate(1.4 -1)"/>`;
}
function seam(d, fill) { return `<path d="${d}" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".55"/>`; }
function stitch(d, color) { return `<path d="${d}" fill="none" stroke="${color}" stroke-width=".8" stroke-dasharray="1.6 1.2" opacity=".85"/>`; }
function ground(g, cx = 100, cy = 178, rx = 74, ry = 9) { return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${g.rig().s}"/>`; }

/* ---------- brand marks, drawn small ---------- */
const MARK = {
  pony: (x, y, c, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-3.6 2.4 l.8-2.2 1.2-.6.4-1.6 1.1.6.9-1.6.9.3-.2 1.4 1.1.3.5 1.3-.9.4-.2 1.2-.9-.4-1.2.6-.9-.9-1.4.8-.6.9-.9-.3.4-1.3Z" fill="${c}"/><path d="M-.2-2.6 l.6-1.6 1.1.2-.4 1.4" fill="${c}"/></g>`,
  croc: (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-4 .4 q1.6-1.8 4-1.6 q1.6 0 2.6-.6 l1.4.3-.6 1 q-.8.9-2.2 1.1 q-2.6.4-5.2-.2Z" fill="${C.croc}"/><path d="M2.2-1.2 l.5.6 M3.4-.9 l.3.5" stroke="#fff" stroke-width=".4"/><path d="M-2.4 .8 l-.5.9 M0 .9 l-.3 1" stroke="${C.croc}" stroke-width=".6"/></g>`,
  tnf: (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M1 -3.2 h5.2 M1 -1.6 h5.2 M1 0 h5.2" stroke="${c}" stroke-width=".9"/><path d="M8 -3.2 a3.2 3.2 0 0 1 3.2 3.2 M8 -1.6 a1.6 1.6 0 0 1 1.6 1.6 M8 -3.2 V0" stroke="${c}" stroke-width=".8" fill="none"/></g>`,
  arc: (x, y, c, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-3.5 1.5 c1-3 3-4 5.5-3.5 c-1.5.5-2.2 1.5-2.4 2.6 c.8-.4 1.8-.3 2.6.3 c-1.3-.1-2.3.4-3 1.2 M-1.6 -.6 l-1.1 1.9 M.2 -1.2 l-.6 2.2" fill="none" stroke="${c}" stroke-width=".7" stroke-linecap="round"/></g>`,
  flag: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-3" y="-2.2" width="6" height="4.4" fill="${C.navy}"/><rect x="-1" y="-2.2" width="2" height="4.4" fill="#fff"/><rect x="-1" y="-2.2" width="2" height="2.2" fill="${C.red}"/></g>`,
  ck: (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M-2.2 -2.6 a3 3 0 1 0 0 5.2 M1.4 -3 v6 M1.4 0 l3.4-3 M1.4 0 l3.4 3" fill="none" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/></g>`,
  ua: (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M-3 -1.5 q3 3 6 0 M-3 1.5 q3-3 6 0" fill="none" stroke="${c}" stroke-width="1"/></g>`,
  swoosh: (x, y, w, c, flip = false) => `<path transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)" d="M0 0 C ${w * .25} ${w * .05}, ${w * .55} ${-w * .02}, ${w} ${-w * .3} C ${w * .62} ${-w * .06}, ${w * .35} ${-w * .07}, ${w * .08} ${-w * .12} Z" fill="${c}"/>`,
  text: (x, y, w, c, h = 1.2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".4" fill="${c}"/>`,
  box: (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".8" fill="none" stroke="${c}" stroke-width=".7"/>`,
  norway: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-3.2" y="-2.3" width="6.4" height="4.6" fill="#B8323A"/><path d="M-1.3 -2.3 v4.6 M-3.2 0 h6.4" stroke="#fff" stroke-width="1.3"/><path d="M-1.3 -2.3 v4.6 M-3.2 0 h6.4" stroke="#1F3A7A" stroke-width=".6"/></g>`,
};

/* ---------- shared top geometry ---------- */
/* Flat lay: shoulders slope, sleeves fall a little out from the body. */
function topGeo(p) {
  const hem = p.long ? 184 : p.crop ? 148 : 168;
  const bx = p.wide ? 4 : 0;
  const tl = p.taper ? 4 : 0;
  const L = 60 - bx, R = 140 + bx;
  const shL = 66 - bx, shR = 134 + bx;
  const torso = `M${shL} 56 Q${shL + 6} 48 ${shL + 14} 46 L${shR - 14} 46 Q${shR - 6} 48 ${shR} 56 L${R} 98 L${R - tl} ${hem} Q100 ${hem + 4} ${L + tl} ${hem} L${L} 98 Z`;
  const sleeveL = p.sleeve === "short"
    ? `M${shL} 56 Q${shL - 14} 66 ${shL - 22} 94 L${L + 2} 101 L${L} 98 Z`
    : `M${shL} 56 Q${shL - 16} 70 ${shL - 26} 100 L${shL - 36} 146 Q${shL - 24} 154 ${shL - 10} 150 L${L} 98 Z`;
  const sleeveR = p.sleeve === "short"
    ? `M${shR} 56 Q${shR + 14} 66 ${shR + 22} 94 L${R - 2} 101 L${R} 98 Z`
    : `M${shR} 56 Q${shR + 16} 70 ${shR + 26} 100 L${shR + 36} 146 Q${shR + 24} 154 ${shR + 10} 150 L${R} 98 Z`;
  return { hem, L, R, shL, shR, torso, sleeveL, sleeveR, bx, tl };
}

function hoodBack(fill, g) {
  const d = "M62 54 Q60 16 100 12 Q140 16 138 54 Q120 46 100 46 Q80 46 62 54 Z";
  return part(d, fold(fill), g) + crease("M78 24 Q84 40 80 50", fill, .6) + crease("M122 24 Q116 40 120 50", fill, .6);
}
function neckHole(fill, kind = "round") {
  const inner = shade(fill, isLight(fill) ? -0.3 : -0.5);
  if (kind === "v") return `<path d="M84 46 L100 70 L116 46 Z" fill="${inner}"/>`;
  return `<path d="M76 46 Q100 58 124 46 Q100 50 76 46 Z" fill="${inner}"/>`;
}
function ribBand(x, y, w, h, fill, g) {
  const pat = g.pat({ kind: "rib", base: fill });
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${pat}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${g.rig().h}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".7"/>`;
}
function elasticBand(x, y, w, h, fill, g) {
  let lines = ""; for (let i = x + 3; i < x + w - 2; i += 3) lines += `M${i} ${y + 1.5} Q${i + 1} ${y + h / 2} ${i} ${y + h - 1.5} `;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}"/><path d="${lines}" stroke="${fold(fill)}" stroke-width=".9" fill="none"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${g.rig().h}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".7"/>`;
}
/* sleeve cuffs along the slanted sleeve ends */
function cuffs(fill, kind, geo, g) {
  if (kind === "none" || !kind) return "";
  const { shL, shR } = geo;
  const lx1 = shL - 36, ly1 = 146, lx2 = shL - 10, ly2 = 150;
  const rx1 = shR + 10, ry1 = 150, rx2 = shR + 36, ry2 = 146;
  const band = (x1, y1, x2, y2) => {
    const h = kind === "button" ? 12 : 10;
    const d = `M${x1 + 1.2} ${y1 - h} L${x2 + 1} ${y2 - h} L${x2} ${y2} L${x1} ${y1} Z`;
    let s = kind === "rib" ? `<path d="${d}" fill="${g.pat({ kind: "rib", base: fill })}"/><path d="${d}" fill="${g.rig().h}"/>` : `<path d="${d}" fill="${fill}"/><path d="${d}" fill="${g.rig().h}"/>`;
    s += `<path d="${d}" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".75"/>`;
    if (kind === "button") s += `<circle cx="${(x1 + x2) / 2 + 4}" cy="${(y1 + y2) / 2 - 5}" r="1.4" fill="${lift(fill)}" stroke="${edge(fill)}" stroke-width=".5"/>`;
    return s;
  };
  return band(lx1, ly1, lx2, ly2) + band(rx1, ry1, rx2, ry2);
}
function zip(x, y1, y2, color, { pull = true, tape = null, teeth = true } = {}) {
  let s = "";
  if (tape) s += `<rect x="${x - 3}" y="${y1}" width="6" height="${y2 - y1}" fill="${tape}" opacity=".9"/>`;
  s += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="2.4"/>`;
  if (teeth) s += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${shade(color, 0.55)}" stroke-width=".9" stroke-dasharray="1.2 1.2"/>`;
  if (pull) s += `<rect x="${x - 1.6}" y="${y1 + 3}" width="3.2" height="6" rx=".8" fill="${color}" stroke="${shade(color, 0.5)}" stroke-width=".4"/><rect x="${x - 1}" y="${y1 + 8.5}" width="2" height="4" rx=".6" fill="${color}"/>`;
  return s;
}
function shirtCollar(fill, collarFill, g, { stand = true, wide = 0, pattern = null } = {}) {
  const cf = collarFill || fill;
  let s = "";
  if (stand) s += `<path d="M74 46 Q100 58 126 46 L124 40 Q100 50 76 40 Z" fill="${shade(cf, isLight(cf) ? -0.08 : -0.15)}" stroke="${edge(cf)}" stroke-width=".8" opacity=".95"/>`;
  const left = `M${74 - wide} 44 Q86 56 100 66 Q96 52 ${90 - wide} 36 Q82 40 ${74 - wide} 44 Z`, right = `M${126 + wide} 44 Q114 56 100 66 Q104 52 ${110 + wide} 36 Q118 40 ${126 + wide} 44 Z`;
  for (const d of [left, right]) {
    s += `<path d="${d}" fill="${cf}"/>`;
    if (pattern) s += `<path d="${d}" fill="${pattern}"/>`;
    s += `<path d="${d}" fill="${g.rig().v}"/><path d="${d}" fill="none" stroke="${edge(cf)}" stroke-width="1" stroke-linejoin="round" opacity=".85"/>`;
  }
  s += `<path d="M100 66 Q100 58 100 50" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`;
  return s;
}
function poloCollar(fill, collarFill, g, tipping) {
  const cf = collarFill || fill;
  let s = `<path d="M78 46 Q100 56 122 46 L121 42 Q100 50 79 42 Z" fill="${shade(cf, isLight(cf) ? -0.08 : -0.15)}" opacity=".95"/>`;
  const left = "M78 44 Q88 54 100 64 Q97 52 89 38 Q82 40 78 44 Z", right = "M122 44 Q112 54 100 64 Q103 52 111 38 Q118 40 122 44 Z";
  for (const d of [left, right]) s += `<path d="${d}" fill="${cf}"/><path d="${d}" fill="${g.rig().v}"/><path d="${d}" fill="none" stroke="${edge(cf)}" stroke-width="1" stroke-linejoin="round" opacity=".85"/>`;
  if (tipping && tipping.length) tipping.forEach((c, i) => { s += `<path d="M${79 + i * 1.5} ${45 + i * 1.5} Q89 ${53 + i} 100 ${62 - i * 1.6} Q111 ${53 + i} ${121 - i * 1.5} ${45 + i * 1.5}" stroke="${c}" stroke-width="1.3" fill="none"/>`; });
  s += `<path d="M100 64 V52" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`;
  return s;
}
function standCollar(fill, g, { rib = false, h = 15 } = {}) {
  const d = `M76 ${49 - h} Q100 ${45 - h} 124 ${49 - h} L126 49 Q100 54 74 49 Z`;
  let s = rib ? `<path d="${d}" fill="${g.pat({ kind: "rib", base: fill })}"/>` : `<path d="${d}" fill="${fill}"/>`;
  s += `<path d="${d}" fill="${g.rig().h}"/><path d="${d}" fill="none" stroke="${edge(fill)}" stroke-width="1" opacity=".8"/>`;
  s += `<path d="M100 ${46 - h} V49" stroke="${edge(fill)}" stroke-width=".9" opacity=".6"/>`;
  s += `<path d="M78 ${50 - h} Q100 ${46 - h} 122 ${50 - h}" stroke="#fff" stroke-opacity=".25" stroke-width="1"/>`;
  return s;
}
function placket(fill, y1, y2, buttons, color) {
  let b = "";
  for (let i = 0; i < buttons; i++) { const y = y1 + 8 + i * ((y2 - y1 - 12) / Math.max(1, buttons - 1)); b += `<circle cx="100" cy="${y.toFixed(1)}" r="1.7" fill="${color || lift(fill)}" stroke="${edge(fill)}" stroke-width=".5"/><circle cx="100" cy="${y.toFixed(1)}" r=".6" fill="${edge(fill)}" opacity=".6"/>`; }
  return `<path d="M95.5 ${y1} V${y2} M104.5 ${y1} V${y2}" stroke="${edge(fill)}" stroke-width=".8" opacity=".55"/><path d="M95.5 ${y1} V${y2}" stroke="#000" stroke-opacity=".08" stroke-width="3"/>${b}`;
}
function kangaroo(fill, g) {
  const d = "M66 124 L134 124 L137 160 L63 160 Z";
  return `<path d="${d}" fill="${fill}"/><path d="${d}" fill="${g.rig().v}"/><path d="M66 124 L74 148 M134 124 L126 148" stroke="${edge(fill)}" stroke-width="1" opacity=".8"/><path d="${d}" fill="none" stroke="${edge(fill)}" stroke-width="1" opacity=".8"/><path d="M66 124 H134" stroke="#000" stroke-opacity=".12" stroke-width="3"/>`;
}
function slashPockets(fill, { flap = false, zipColor = null } = {}) {
  let s = `<path d="M64 128 L80 148 M136 128 L120 148" stroke="${edge(fill)}" stroke-width="1.6" stroke-linecap="round"/><path d="M64 128 L80 148 M136 128 L120 148" stroke="#000" stroke-opacity=".14" stroke-width="3.5" stroke-linecap="round"/>`;
  if (zipColor) s += `<path d="M64 128 L80 148 M136 128 L120 148" stroke="${zipColor}" stroke-width="1.2" stroke-dasharray="1 1"/>`;
  if (flap) s += `<path d="M60 124 L84 124 L82 134 L62 134 Z M116 124 L140 124 L138 134 L118 134 Z" fill="${fill}" stroke="${edge(fill)}" stroke-width="1"/><path d="M60 124 L84 124 L82 134 L62 134 Z M116 124 L140 124 L138 134 L118 134 Z" fill="#000" fill-opacity=".06"/>`;
  return s;
}
function drawcords(color, x1 = 92, x2 = 108, y1 = 54, y2 = 84) {
  return `<path d="M${x1} ${y1} Q${x1 - 2} ${y1 + 15} ${x1} ${y2} M${x2} ${y1} Q${x2 + 2} ${y1 + 15} ${x2} ${y2}" stroke="${color}" stroke-width="1.5" fill="none"/><rect x="${x1 - 1.5}" y="${y2}" width="3" height="4" rx="1" fill="${color}"/><rect x="${x2 - 1.5}" y="${y2}" width="3" height="4" rx="1" fill="${color}"/>`;
}

/* ---------- TOP ---------- */
function top(p, g) {
  const fill = p.fill;
  const geo = topGeo(p);
  const { hem, L, R, shL, shR, torso, sleeveL, sleeveR } = geo;
  const patFill = p.pattern ? g.pat({ ...p.pattern, base: p.pattern.base || fill }) : null;
  let s = ground(g, 100, hem + 8, 78, 8);
  if (p.collar === "hood") s += hoodBack(fill, g);
  // sleeves first (behind the body at the shoulder), then the torso
  const slv = p.sleeveFill || fill;
  const slvPat = p.sleevePattern === false ? null : (p.sleeveFill ? null : patFill);
  s += part(sleeveL, slv, g, { pattern: slvPat }) + part(sleeveR, slv, g, { pattern: slvPat });
  s += part(torso, fill, g, { pattern: patFill });
  // armhole seams
  s += seam(`M${shL} 56 Q${shL - 2} 78 ${L} 98 M${shR} 56 Q${shR + 2} 78 ${R} 98`, fill);
  // folds
  if (p.sleeve !== "short") {
    s += crease(`M${shL - 20} 104 Q${shL - 26} 118 ${shL - 22} 134`, fill, .7) + crease(`M${shR + 20} 104 Q${shR + 26} 118 ${shR + 22} 134`, fill, .7);
  }
  s += crease(`M${L + 10} 110 Q${L + 6} 136 ${L + 12} ${hem - 8}`, fill, .5) + crease(`M${R - 10} 110 Q${R - 6} 136 ${R - 12} ${hem - 8}`, fill, .5);
  // colour blocks and decoration on the body
  if (p.yoke) s += `<path d="M${shL} 56 Q${shL + 6} 48 ${shL + 14} 46 L${shR - 14} 46 Q${shR - 6} 48 ${shR} 56 L${shR - 2} 74 Q100 84 ${shL + 2} 74 Z" fill="${p.yoke}"/><path d="M${shL} 56 Q${shL + 6} 48 ${shL + 14} 46 L${shR - 14} 46 Q${shR - 6} 48 ${shR} 56 L${shR - 2} 74 Q100 84 ${shL + 2} 74 Z" fill="${g.rig().h}"/>`;
  if (p.smoothYoke) { // puffer: a smooth chevron yoke over the baffles
    const d = `M${shL} 56 Q${shL + 6} 48 ${shL + 14} 46 L${shR - 14} 46 Q${shR - 6} 48 ${shR} 56 L${R} 98 L${R} 86 Q120 94 100 100 Q80 94 ${L} 86 L${L} 98 Z`;
    s += `<path d="${d}" fill="${fill}"/><path d="${d}" fill="${g.rig().h}"/><path d="${d}" fill="${g.rig().v}"/><path d="M${L} 86 Q80 94 100 100 Q120 94 ${R} 86" fill="none" stroke="${shade(fill, -0.55)}" stroke-width="1.6"/>`;
  }
  if (p.bands) for (const b of p.bands) s += `<path d="M${L} ${b.y} L${R} ${b.y} L${R} ${b.y + b.h} L${L} ${b.y + b.h} Z" fill="${b.color}"/>`;
  if (p.blocks) for (const b of p.blocks) s += `<path d="${b.d}" fill="${b.color}"/><path d="${b.d}" fill="${g.rig().h}"/>`;
  if (p.piping) for (const l of p.piping) s += `<path d="${l}" fill="none" stroke="${p.pipingColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (p.lines) for (const l of p.lines) s += `<path d="${l.d}" stroke="${l.color}" stroke-width="${l.w || 1.4}" fill="none" stroke-linecap="round"/>`;
  if (p.graphic) {
    const gc = p.graphic.color || C.black;
    s += `<g opacity=".93"><path d="M74 92 h52 v9 h-52z" fill="${gc}"/><path d="M74 106 h22 v16 h-22z M100 106 h26 v7 h-26z M100 117 h26 v5 h-26z" fill="${gc}"/><path d="M78 96 h44" stroke="${fill}" stroke-width="1.2" opacity=".6"/></g>`;
  }
  if (p.emboss) {
    const gc = fold(fill), hl = lift(fill);
    s += `<path d="M86 88 h28 v24 l-14 10 l-14 -10 z" fill="${gc}"/><path d="M86 88 h28 v24 l-14 10 l-14 -10 z" fill="none" stroke="${hl}" stroke-width=".8" opacity=".6"/><path d="M92 96 h16 M92 102 h16 M94 108 h12" stroke="${hl}" stroke-width="1.2" opacity=".6"/>`;
  }
  if (p.text) {
    s += `<g><rect x="76" y="98" width="48" height="11" rx="1" fill="${p.text}"/><path d="M80 101 v5 M84 101 h3 v5 h-3 M90 101 v5 l3-2.5-3-2.5 M96 101 v5 M100 101 h3 v5 h-3 M106 101 v5 M110 101 v5 l3-5 M116 101 v5 h3" stroke="${fill}" stroke-width="1" fill="none"/></g>`;
  }
  if (p.anorakPouch) { // Napapijri: the kangaroo pouch with two angled zips and the patches
    const zc = p.zipColor || shade(fill, 0.3);
    s += `<path d="M66 104 L134 104 L138 156 L62 156 Z" fill="${fill}"/><path d="M66 104 L134 104 L138 156 L62 156 Z" fill="${g.rig().v}"/><path d="M66 104 L134 104 L138 156 L62 156 Z" fill="none" stroke="${edge(fill)}" stroke-width="1" opacity=".8"/>`;
    s += `<path d="M70 112 L92 124 M130 112 L108 124" stroke="${zc}" stroke-width="2"/><path d="M70 112 L92 124 M130 112 L108 124" stroke="${shade(zc, 0.5)}" stroke-width=".8" stroke-dasharray="1 1"/>`;
    s += `<rect x="90" y="84" width="20" height="9" rx="1" fill="#141A30" stroke="#C9A74A" stroke-width=".6"/><path d="M92.5 87 h15 M92.5 90.5 h11" stroke="#E2C06A" stroke-width="1.2"/>`;
    s += MARK.norway(118, 92);
    s += `<path d="M86 60 Q100 56 114 60" stroke="${zc}" stroke-width="1.6" fill="none"/>`;
  }
  if (p.chestPocket) {
    const zc = p.zipColor || shade(fill, 0.3);
    s += `<rect x="108" y="86" width="26" height="3.2" rx="1.2" fill="${shade(fill, -0.25)}"/><line x1="110" y1="87.6" x2="132" y2="87.6" stroke="${zc}" stroke-width="1.4"/>`;
  }
  if (p.pockets === "kangaroo") s += kangaroo(fill, g);
  if (p.pockets === "two") s += [[62, 124], [110, 124]].map(([x, y]) => `<rect x="${x}" y="${y}" width="28" height="30" rx="3" fill="${fill}"/><rect x="${x}" y="${y}" width="28" height="30" rx="3" fill="${g.rig().v}"/><rect x="${x}" y="${y}" width="28" height="30" rx="3" fill="none" stroke="${edge(fill)}" stroke-width="1" opacity=".8"/>`).join("");
  if (p.pockets === "slash") s += slashPockets(fill);
  if (p.pockets === "slashZip") s += slashPockets(fill, { zipColor: p.pocketZip || shade(fill, 0.35) });
  if (p.pockets === "flap") s += slashPockets(fill, { flap: true });
  if (p.pockets === "chest") s += `<path d="M110 84 H130 V104 L120 108 L110 104 Z" fill="none" stroke="${edge(fill)}" stroke-width="1"/><path d="M110 84 H130" stroke="#000" stroke-opacity=".1" stroke-width="2"/>`;
  // zips
  const zc = p.zipColor || (isLight(fill) ? shade(fill, -0.45) : shade(fill, 0.35));
  if (p.zip === "full") s += zip(100, 50, hem - 2, zc, { tape: p.zipTape || null });
  if (p.zip === "quarter") s += zip(100, 36, 92, zc);
  // hems
  if (p.hem === "rib") s += ribBand(L + geo.tl, hem - 11, R - L - geo.tl * 2, 11, p.ribFill || fill, g);
  if (p.hem === "elastic") s += elasticBand(L + geo.tl, hem - 10, R - L - geo.tl * 2, 10, fill, g);
  if (p.hem === "band") s += `<rect x="${L + geo.tl}" y="${hem - 8}" width="${R - L - geo.tl * 2}" height="8" rx="1" fill="${fold(fill)}"/><rect x="${L + geo.tl}" y="${hem - 8}" width="${R - L - geo.tl * 2}" height="8" rx="1" fill="${g.rig().h}"/><path d="M${L + geo.tl} ${hem - 8} H${R - geo.tl}" stroke="${edge(fill)}" stroke-width=".9" opacity=".7"/>`;
  if (p.hem === "drawcord") s += `<path d="M${L + 2} ${hem - 6} H${R - 2}" stroke="${edge(fill)}" stroke-width=".9" opacity=".6"/><circle cx="${L + 6}" cy="${hem - 2}" r="2" fill="${shade(fill, 0.2)}"/><circle cx="${R - 6}" cy="${hem - 2}" r="2" fill="${shade(fill, 0.2)}"/>`;
  // cuffs
  if (p.sleeve !== "short") s += cuffs(p.ribFill && p.cuffs === "rib" ? p.ribFill : fill, p.cuffs, geo, g);
  // collars
  if (p.collar === "crew") s += neckHole(fill) + `<path d="M76 46 Q100 60 124 46" fill="none" stroke="${fold(fill)}" stroke-width="6"/><path d="M76 46 Q100 60 124 46" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".8"/><path d="M78 47 Q100 58 122 47" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="1"/>`;
  if (p.collar === "v" || p.collar === "johnny") s += neckHole(fill, "v") + `<path d="M84 46 L100 70 L116 46" fill="none" stroke="${fold(fill)}" stroke-width="4.5"/><path d="M84 46 L100 70 L116 46" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".8"/>`;
  if (p.collar === "hood") s += `<path d="M74 46 Q100 64 126 46 Q100 56 74 46 Z" fill="${shade(fill, isLight(fill) ? -0.28 : -0.5)}"/>` + drawcords(p.stringColor || (isLight(fill) ? shade(fill, -0.5) : shade(fill, 0.4)));
  if (p.collar === "stand") s += standCollar(p.collarFill || fill, g);
  if (p.collar === "bomber") s += standCollar(p.collarFill || fill, g, { rib: true, h: 13 });
  if (p.collar === "shirt") s += shirtCollar(fill, p.collarFill, g, { pattern: p.collarPattern ? patFill : null });
  if (p.collar === "polo") s += poloCollar(fill, p.collarFill, g, p.tipping);
  if (p.collar === "quarter") s += standCollar(p.collarFill || fill, g);
  if (p.collar === "rugby") s += shirtCollar(fill, p.collarFill || C.white, g, { stand: false });
  if (p.collar === "hoodStowed") s += standCollar(p.collarFill || fill, g, { h: 14 }) + `<path d="M80 36 Q100 30 120 36" stroke="${edge(fill)}" stroke-width=".9" fill="none" opacity=".6"/>`;
  // plackets
  if (p.placket === "shirt") s += placket(fill, 64, hem - 8, p.buttons ?? 6, p.buttonColor);
  if (p.placket === "polo") s += placket(fill, 62, 88, p.buttons ?? 2, p.buttonColor);
  if (p.placket === "rugby") s += placket(fill, 62, 92, 3, p.buttonColor || C.white);
  // marks
  if (p.mark) s += p.mark;
  if (p.signature) s += `<path d="M122 160 q2-5 5-1 t5-1 q2 1 4-2" stroke="${p.signature}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
  return s;
}

/* ---------- BOTTOMS ---------- */
function bottoms(p, g) {
  const fill = p.fill;
  const cut = p.cut || "straight";
  const H = 184;
  const legs = {
    wide: ["M62 38 L100 38 L100 108 L90 186 L48 184 L58 100 Z", "M100 38 L138 38 L142 100 L152 184 L110 186 L100 108 Z"],
    straight: ["M62 38 L100 38 L100 108 L90 186 L54 184 L60 100 Z", "M100 38 L138 38 L140 100 L146 184 L110 186 L100 108 Z"],
    slim: ["M62 38 L100 38 L100 108 L88 186 L60 184 L60 100 Z", "M100 38 L138 38 L140 100 L140 184 L112 186 L100 108 Z"],
    barrel: ["M62 38 L100 38 L100 108 L92 186 L56 184 Q42 110 62 38 Z", "M100 38 L138 38 Q158 110 144 184 L108 186 L100 108 Z"],
    track: ["M60 38 L100 38 L100 108 L90 186 L54 184 L58 100 Z", "M100 38 L140 38 L142 100 L146 184 L110 186 L100 108 Z"],
  }[cut];
  const patFill = p.pattern ? g.pat({ ...p.pattern, base: p.pattern.base || fill }) : null;
  let s = ground(g, 100, H + 6, 60, 7);
  s += part(legs[0], fill, g, { pattern: patFill }) + part(legs[1], fill, g, { pattern: patFill });
  s += `<path d="M100 108 L90 186 M100 108 L110 186" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`;
  s += crease("M70 120 Q66 150 70 176", fill, .6) + crease("M130 120 Q134 150 130 176", fill, .6);
  if (p.pleats) s += crease("M82 44 Q80 70 78 100", fill, 1) + crease("M118 44 Q120 70 122 100", fill, 1) + crease("M92 44 Q90 70 92 96", fill, .5) + crease("M108 44 Q110 70 108 96", fill, .5);
  if (p.waist === "elastic") {
    s += elasticBand(60, 32, 80, 10, fill, g);
    const cord = isLight(fill) ? shade(fill, -0.5) : shade(fill, 0.5);
    s += `<path d="M95 42 Q97 50 95 56 M105 42 Q103 50 105 56" stroke="${cord}" stroke-width="1.4" fill="none"/><circle cx="95" cy="57" r="1.4" fill="${cord}"/><circle cx="105" cy="57" r="1.4" fill="${cord}"/>`;
  } else {
    const d = "M62 32 L138 32 L138 41 L62 41 Z";
    s += `<path d="${d}" fill="${fill}"/><path d="${d}" fill="${g.rig().h}"/><path d="${d}" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".8"/>`;
    for (const x of [70, 99, 128]) s += `<rect x="${x}" y="31" width="2.6" height="11" rx=".6" fill="${fill}" stroke="${edge(fill)}" stroke-width=".6"/>`;
    s += `<circle cx="100" cy="36.5" r="1.8" fill="${lift(fill)}" stroke="${edge(fill)}" stroke-width=".5"/>`;
    s += `<path d="M100 41 V106" stroke="${edge(fill)}" stroke-width="1" opacity=".55"/><path d="M103 44 Q104 70 101 104" stroke="${edge(fill)}" stroke-width=".8" opacity=".4"/>`;
  }
  if (p.jeans) {
    const st = p.stitch || "#C9A24A";
    s += stitch("M62 44 Q80 48 86 66", st) + stitch("M138 44 Q120 48 114 66", st) + stitch("M64 34 H136", st) + stitch("M101 44 Q102 72 100 104", st);
    s += `<rect x="78" y="46" width="8" height="7" rx="1" fill="none" stroke="${st}" stroke-width=".7" opacity=".8"/>`;
  }
  if (p.pockets === "slim") for (const x of [58, 128]) s += `<rect x="${x}" y="96" width="14" height="26" rx="1.5" fill="${fill}"/><rect x="${x}" y="96" width="14" height="26" rx="1.5" fill="${g.rig().v}"/><rect x="${x}" y="96" width="14" height="26" rx="1.5" fill="none" stroke="${edge(fill)}" stroke-width=".9" opacity=".85"/><path d="M${x} 102 H${x + 14}" stroke="${edge(fill)}" stroke-width=".8" opacity=".6"/>`;
  if (p.pockets === "cargo") for (const x of [52, 122]) s += `<path d="M${x} 102 h26 v32 h-26z" fill="${fill}"/><path d="M${x} 102 h26 v32 h-26z" fill="${g.rig().v}"/><path d="M${x} 102 h26 v32 h-26z" fill="none" stroke="${edge(fill)}" stroke-width="1" opacity=".85"/><path d="M${x} 110 h26" stroke="${edge(fill)}" stroke-width=".9" opacity=".7"/><path d="M${x} 102 h26 v8 h-26z" fill="#000" fill-opacity=".06"/>`;
  if (p.distress) s += `<g stroke="${shade(fill, 0.4)}" stroke-width="1.8" stroke-linecap="round" opacity=".8"><path d="M70 122 h10 M118 140 h12 M74 152 h8 M128 102 h8 M66 136 h6"/></g>`;
  if (p.flames) {
    const fc = p.flames;
    const flame = (x, y, k) => { const n = v => (v * k).toFixed(1); return `<path d="M${x} ${y} q${n(3)} -10 ${n(1)} -18 q${n(6)} 8 ${n(2)} 18 q${n(5)} -6 ${n(3)} -14 q${n(4)} 10 ${n(-2)} 20 z" fill="${fc}" opacity=".9"/>`; };
    s += flame(60, 150, 1) + flame(62, 122, 1) + flame(140, 150, -1) + flame(138, 122, -1);
  }
  if (p.hem === "cuff") s += ribBand(52, 174, 38, 11, fill, g) + ribBand(110, 174, 38, 11, fill, g);
  return s;
}

/* ---------- SHOES ---------- */
/* Side profile, toe to the left, on the ground at y=150. */
function shoe(p, g) {
  const up = p.upper, sole = p.sole || C.white, style = p.style || "low";
  const soleH = p.soleH ?? ({ low: 9, chunky: 17, runner: 24, racer: 30, oxford: 7 }[style] || 9);
  const B = 150 - soleH;
  let s = ground(g, 100, 156, 84, 7);
  const r = g.rig();

  if (style === "runner" || style === "racer") {
    const d = `M22 ${B + 2} Q60 ${B - 4} 100 ${B} Q150 ${B + 2} 180 ${B - 8} Q190 ${B} 186 ${150 - 10} L182 150 L40 150 Q18 150 14 ${150 - 10} Q14 ${B + 6} 22 ${B + 2} Z`;
    const mid = p.midsole || shade(sole, -0.04);
    s += `<path d="${d}" fill="${mid}"/><path d="${d}" fill="${r.v}"/><path d="${d}" fill="none" stroke="${edge(mid)}" stroke-width="1" opacity=".8"/>`;
    s += `<path d="M16 ${150 - 6} L184 ${150 - 6} L182 150 L40 150 Q18 150 16 ${150 - 6} Z" fill="${sole}" stroke="${edge(sole)}" stroke-width=".8"/>`;
    if (p.plate) s += `<path d="M26 ${150 - 9} Q100 ${150 - 20} 176 ${150 - 11}" stroke="${p.plate}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    if (p.pods) s += `<ellipse cx="60" cy="${B + 14}" rx="22" ry="7" fill="${shade(mid, -0.12)}" opacity=".6"/><ellipse cx="60" cy="${B + 13}" rx="18" ry="5" fill="${shade(mid, 0.4)}" opacity=".5"/>`;
    if (p.airHeel) s += `<rect x="134" y="${B + 6}" width="30" height="9" rx="4" fill="${p.airHeel}" opacity=".85"/><path d="M138 ${B + 10} h22" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>`;
    s += `<path d="M30 ${B + 8} Q100 ${B + 12} 172 ${B + 4}" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" fill="none"/>`;
  } else {
    const d = `M16 ${B} L184 ${B} Q190 ${B + soleH / 2} 184 150 L30 150 Q12 150 16 ${B} Z`;
    s += `<path d="${d}" fill="${sole}"/><path d="${d}" fill="${r.v}"/><path d="${d}" fill="none" stroke="${edge(sole)}" stroke-width="1" opacity=".85"/>`;
    s += `<path d="M18 ${B + soleH * .45} H182" stroke="${shade(sole, -0.2)}" stroke-width=".8" opacity=".6"/>`;
    if (style === "chunky") s += `<path d="M24 ${B + 3} H176" stroke="#fff" stroke-opacity=".4" stroke-width="1"/><path d="M110 ${B + 5} h50 a3 3 0 0 1 0 6 h-50 a3 3 0 0 1 0 -6z" fill="none" stroke="${shade(sole, -0.18)}" stroke-width=".8"/>`;
    if (style === "oxford") s += `<path d="M138 150 h40 v6 h-38 Q136 156 138 150 Z" fill="${shade(up, -0.1)}" stroke="${edge(up)}" stroke-width=".8"/>`;
    if (p.gumText) s += `<path d="M30 ${B + soleH * .72} h120" stroke="${shade(sole, 0.25)}" stroke-width=".6" opacity=".7"/>`;
  }

  const low = style === "low" || style === "oxford";
  const vampX = low ? 62 : 58, vampY = B - (low ? 16 : 20), colX = 112, colY = B - (low ? 38 : 44), heelTopX = 150, heelTopY = B - (low ? 44 : 50);
  const upperD = style === "oxford"
    ? `M18 ${B} C18 ${B - 10} 34 ${B - 18} 70 ${B - 22} L120 ${B - 36} C136 ${B - 42} 160 ${B - 36} 170 ${B - 26} L178 ${B} Z`
    : `M18 ${B} C18 ${B - 12} 36 ${B - 22} ${vampX} ${vampY} L${colX} ${colY} C${colX + 8} ${colY - 6} ${heelTopX - 12} ${heelTopY - 2} ${heelTopX} ${heelTopY} C${heelTopX + 18} ${heelTopY + 4} ${heelTopX + 28} ${B - 20} ${heelTopX + 30} ${B - 6} L182 ${B} Z`;
  s += `<path d="${upperD}" fill="${up}"/>`;
  if (p.mesh) s += `<path d="${upperD}" fill="${g.pat({ kind: "mesh", base: up })}"/>`;
  s += `<path d="${upperD}" fill="${r.v}"/><path d="${upperD}" fill="${r.hi}"/>`;
  const cid = g.id(); g.defs.push(`<clipPath id="${cid}"><path d="${upperD}"/></clipPath>`);
  s += `<g clip-path="url(#${cid})">`;
  if (p.toe) s += `<path d="M10 ${B + 2} C10 ${B - 12} 36 ${B - 22} ${vampX} ${vampY} L${vampX + 8} ${vampY - 4} Q${vampX + 14} ${B - 8} ${vampX + 6} ${B + 2} Z" fill="${p.toe}"/><path d="M${vampX + 8} ${vampY - 4} Q${vampX + 14} ${B - 8} ${vampX + 6} ${B + 2}" stroke="${edge(p.toe)}" stroke-width=".9" fill="none" opacity=".8"/>`;
  if (p.tToe) s += `<path d="M${vampX - 6} ${vampY + 10} L${vampX + 26} ${vampY - 8} L${vampX + 32} ${vampY - 2} L${vampX} ${B} Z" fill="${p.tToe}" opacity=".95"/>`;
  if (p.heelPanel) s += `<path d="M${heelTopX - 8} ${heelTopY - 6} C${heelTopX + 20} ${heelTopY} ${heelTopX + 30} ${B - 20} ${heelTopX + 34} ${B + 2} L${heelTopX - 2} ${B + 2} Q${heelTopX - 10} ${B - 20} ${heelTopX - 8} ${heelTopY - 6} Z" fill="${p.heelPanel}" opacity=".95"/>`;
  if (p.sidePanel) s += `<path d="M${vampX + 30} ${B + 2} L${vampX + 38} ${colY + 14} Q${colX + 20} ${colY + 10} ${heelTopX - 4} ${B - 10} L${heelTopX} ${B + 2} Z" fill="${p.sidePanel}" opacity=".9"/>`;
  if (p.stripes) for (let i = 0; i < 3; i++) { const x = 84 + i * 13; s += `<path d="M${x} ${colY + 16 + i * 2} L${x + 10} ${B + 2}" stroke="${p.stripes}" stroke-width="5.5"/>`; }
  if (p.swoosh) s += MARK.swoosh(58, B - 8, 100, p.swoosh);
  if (p.nPanel) s += `<path d="M98 ${B} L104 ${B - 34} L114 ${B - 34} L124 ${B - 14} L126 ${B - 34} L136 ${B - 34} L130 ${B} L120 ${B} L110 ${B - 20} L108 ${B} Z" fill="${p.nPanel}" stroke="${edge(p.nPanel)}" stroke-width=".8"/>`;
  if (p.perforated) { let d = ""; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) d += `M${30 + i * 8 + j * 3} ${B - 6 - j * 5 - i * 2.2} h.01 `; s += `<path d="${d}" stroke="${shade(up, -0.35)}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`; }
  if (p.capToe) s += `<path d="M70 ${B - 22} Q76 ${B - 8} 70 ${B + 2}" stroke="${shade(up, 0.4)}" stroke-width="1" fill="none" opacity=".8"/>` + stitch(`M72 ${B - 22} Q78 ${B - 8} 72 ${B + 2}`, shade(up, 0.5));
  s += `</g>`;
  s += `<path d="${upperD}" fill="none" stroke="${edge(up)}" stroke-width="1.1" stroke-linejoin="round" opacity=".85"/>`;
  if (style !== "oxford") {
    s += `<path d="M${colX + 2} ${colY - 1} C${colX + 10} ${colY - 7} ${heelTopX - 12} ${heelTopY - 3} ${heelTopX} ${heelTopY} Q${heelTopX - 8} ${heelTopY + 8} ${colX + 6} ${colY + 6} Z" fill="${shade(up, isLight(up) ? -0.35 : -0.5)}"/>`;
    s += `<path d="M${colX - 2} ${colY + 2} C${colX - 2} ${colY - 10} ${colX + 10} ${colY - 16} ${colX + 20} ${colY - 10} L${colX + 16} ${colY - 2} Q${colX + 6} ${colY - 4} ${colX} ${colY + 2} Z" fill="${p.tongue || up}" stroke="${edge(p.tongue || up)}" stroke-width=".9"/>`;
    if (p.heelTab) s += `<path d="M${heelTopX - 2} ${heelTopY - 1} Q${heelTopX + 10} ${heelTopY} ${heelTopX + 12} ${heelTopY + 10}" stroke="${p.heelTab}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    s += seam(`M${vampX + 2} ${vampY + 2} L${colX - 2} ${colY + 4}`, up);
    const lc = p.laces || (isLight(up) ? shade(up, -0.2) : shade(up, 0.45));
    for (let i = 0; i < 5; i++) { const t = i / 4, x = vampX + 6 + (colX - vampX - 10) * t, y = vampY - 2 + (colY - vampY) * t; s += `<path d="M${x.toFixed(1)} ${(y + 3).toFixed(1)} l8 -6" stroke="${lc}" stroke-width="2" stroke-linecap="round"/><path d="M${x.toFixed(1)} ${(y + 4.2).toFixed(1)} l8 -6" stroke="#000" stroke-opacity=".15" stroke-width="2" stroke-linecap="round"/>`; }
  } else {
    s += `<path d="M122 ${B - 36} C130 ${B - 40} 150 ${B - 38} 160 ${B - 30}" stroke="${shade(up, 0.3)}" stroke-width="1" fill="none" opacity=".8"/>`;
    for (let i = 0; i < 4; i++) { const x = 118 + i * 9; s += `<path d="M${x} ${B - 30 - i * 1.5} l9 -4" stroke="${shade(up, 0.4)}" stroke-width="1.4" stroke-linecap="round"/>`; }
    s += `<path d="M30 ${B - 10} Q60 ${B - 22} 90 ${B - 24}" stroke="#fff" stroke-opacity=".28" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  if (p.serial) s += `<path d="M150 ${B - 8} h18" stroke="${p.serial}" stroke-width="1" opacity=".9"/>`;
  if (p.brandText) s += MARK.text(94, B - 6, 16, p.brandText, 1.4);
  return s;
}

/* ---------- HATS ---------- */
function cap(p, g) {
  const f = p.fill, peak = p.peak || f, r = g.rig();
  let s = ground(g, 100, 150, 70, 7);
  const crown = "M48 118 Q46 60 100 58 Q154 60 152 118 Z";
  s += `<path d="${crown}" fill="${f}"/><path d="${crown}" fill="${r.h}"/><path d="${crown}" fill="${r.hi}"/>`;
  s += `<path d="M100 58 V118 M74 64 Q66 90 66 118 M126 64 Q134 90 134 118" stroke="${edge(f)}" stroke-width=".9" fill="none" opacity=".7"/>` + stitch("M102 60 V118", lift(f));
  s += `<path d="${crown}" fill="none" stroke="${edge(f)}" stroke-width="1.1" opacity=".85"/>`;
  s += `<circle cx="100" cy="58" r="3.2" fill="${f}" stroke="${edge(f)}" stroke-width=".8"/>`;
  const pk = "M30 118 Q100 104 170 118 Q170 142 100 150 Q30 142 30 118 Z";
  s += `<path d="${pk}" fill="${peak}"/><path d="${pk}" fill="${r.v}"/><path d="M36 126 Q100 114 164 126" stroke="#000" stroke-opacity=".15" stroke-width="3" fill="none"/><path d="${pk}" fill="none" stroke="${edge(peak)}" stroke-width="1.1" opacity=".85"/>` + stitch("M38 136 Q100 146 162 136", lift(peak));
  s += `<circle cx="84" cy="80" r="1.4" fill="${shade(f, -0.4)}"/><circle cx="116" cy="80" r="1.4" fill="${shade(f, -0.4)}"/>`;
  if (p.mark) s += p.mark;
  return s;
}
function beanie(p, g) {
  const f = p.fill, r = g.rig();
  let s = ground(g, 100, 150, 64, 7);
  const d = "M46 132 Q44 50 100 48 Q156 50 154 132 Z";
  s += `<path d="${d}" fill="${g.pat({ kind: "rib", base: f })}"/><path d="${d}" fill="${r.h}"/><path d="${d}" fill="${r.hi}"/><path d="${d}" fill="none" stroke="${edge(f)}" stroke-width="1.1" opacity=".85"/>`;
  s += crease("M72 60 Q64 92 62 130", f, .5) + crease("M128 60 Q136 92 138 130", f, .5);
  s += ribBand(44, 112, 112, 24, f, g);
  s += `<path d="M44 112 H156" stroke="#000" stroke-opacity=".18" stroke-width="3"/>`;
  if (p.mark) s += p.mark;
  return s;
}
function scarf(p, g) {
  const f = p.fill, r = g.rig();
  const pat = g.pat({ kind: "tartan", s: 11, base: f, c: p.check || shade(f, -0.3), d: p.check2 || shade(f, 0.35) });
  let s = ground(g, 100, 180, 50, 6);
  const left = "M56 28 L100 72 L112 60 L72 20 Z", right = "M144 28 L100 72 L88 60 L128 20 Z", tail = "M88 60 L112 60 L112 170 L88 170 Z";
  for (const d of [left, right, tail]) s += `<path d="${d}" fill="${f}"/><path d="${d}" fill="${pat}"/><path d="${d}" fill="${r.h}"/><path d="${d}" fill="none" stroke="${edge(f)}" stroke-width="1" stroke-linejoin="round" opacity=".85"/>`;
  s += `<path d="M88 170 v10 M94 170 v10 M100 170 v10 M106 170 v10 M112 170 v10" stroke="${edge(f)}" stroke-width="1.6"/>`;
  s += crease("M94 80 Q92 120 95 160", f, .6);
  return s;
}

/* ---------- BAGS ---------- */
function backpack(p, g) {
  const f = p.fill, r = g.rig();
  let s = ground(g, 100, 178, 56, 7);
  const body = "M60 72 Q60 40 100 38 Q140 40 140 72 L140 158 Q140 170 128 170 L72 170 Q60 170 60 158 Z";
  s += `<path d="M84 40 Q100 22 116 40" stroke="${edge(f)}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M84 40 Q100 22 116 40" stroke="${f}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  s += `<path d="${body}" fill="${f}"/><path d="${body}" fill="${r.h}"/><path d="${body}" fill="${r.hi}"/><path d="${body}" fill="none" stroke="${edge(f)}" stroke-width="1.1" opacity=".85"/>`;
  const front = "M70 108 H130 V158 Q130 164 124 164 H76 Q70 164 70 158 Z";
  s += `<path d="${front}" fill="${f}"/><path d="${front}" fill="${r.h}"/><path d="${front}" fill="none" stroke="${edge(f)}" stroke-width="1" opacity=".85"/><path d="M70 108 H130" stroke="#000" stroke-opacity=".12" stroke-width="3"/>`;
  const zc = isLight(f) ? shade(f, -0.4) : shade(f, 0.35);
  s += `<path d="M70 110 H130" stroke="${zc}" stroke-width="1.6" stroke-dasharray="1.6 1.4"/><rect x="118" y="107" width="3" height="6" rx="1" fill="${zc}"/>`;
  s += `<path d="M64 78 Q100 88 136 78" stroke="${zc}" stroke-width="1.6" stroke-dasharray="1.6 1.4" fill="none"/>`;
  if (p.bottom) s += `<path d="M60 150 L140 150 L140 158 Q140 170 128 170 L72 170 Q60 170 60 158 Z" fill="${p.bottom}"/><path d="M60 150 L140 150 L140 158 Q140 170 128 170 L72 170 Q60 170 60 158 Z" fill="${r.h}"/>` + stitch("M62 152 H138", shade(p.bottom, 0.4));
  if (p.mark) s += p.mark;
  return s;
}
function duffel(p, g) {
  const f = p.fill, r = g.rig();
  let s = ground(g, 100, 156, 90, 8);
  const d = "M34 72 H166 Q190 72 190 110 Q190 148 166 148 H34 Q10 148 10 110 Q10 72 34 72 Z";
  s += `<path d="${d}" fill="${f}"/><path d="${d}" fill="${r.v}"/><path d="${d}" fill="${r.hi}"/><path d="${d}" fill="none" stroke="${edge(f)}" stroke-width="1.1" opacity=".85"/>`;
  s += `<path d="M34 72 Q44 110 34 148 M166 72 Q156 110 166 148" stroke="${edge(f)}" stroke-width="1" fill="none" opacity=".7"/>`;
  const zc = isLight(f) ? shade(f, -0.4) : shade(f, 0.4);
  s += `<path d="M44 80 H156" stroke="${zc}" stroke-width="1.6" stroke-dasharray="1.6 1.4"/>`;
  const strap = p.strap || fold(f);
  for (const x of [58, 130]) s += `<rect x="${x}" y="70" width="12" height="80" fill="${strap}"/><rect x="${x}" y="70" width="12" height="80" fill="${r.h}"/><rect x="${x}" y="70" width="12" height="80" fill="none" stroke="${edge(strap)}" stroke-width=".8"/>` + stitch(`M${x + 2} 72 V148 M${x + 10} 72 V148`, shade(strap, -0.3));
  s += `<path d="M64 70 Q80 32 100 32 Q120 32 136 70" stroke="${edge(strap)}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M64 70 Q80 32 100 32 Q120 32 136 70" stroke="${strap}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  if (p.buckle) for (const x of [57, 129]) s += `<rect x="${x}" y="110" width="14" height="11" rx="2" fill="${p.buckle}" stroke="${edge(p.buckle)}" stroke-width=".8"/><rect x="${x + 4}" y="113" width="6" height="5" rx="1" fill="none" stroke="${C.brass}" stroke-width="1"/>`;
  if (p.mark) s += p.mark;
  return s;
}
function holdall(p, g) {
  const f = p.fill, r = g.rig();
  const pat = p.pattern ? g.pat({ ...p.pattern, base: f }) : null;
  let s = ground(g, 100, 158, 90, 8);
  const d = "M28 76 H172 Q184 76 184 88 V140 Q184 152 172 152 H28 Q16 152 16 140 V88 Q16 76 28 76 Z";
  s += `<path d="${d}" fill="${f}"/>`; if (pat) s += `<path d="${d}" fill="${pat}"/>`;
  s += `<path d="${d}" fill="${r.v}"/><path d="${d}" fill="${r.hi}"/><path d="${d}" fill="none" stroke="${edge(f)}" stroke-width="1.1" opacity=".85"/>`;
  s += `<path d="M46 76 V152 M154 76 V152" stroke="${edge(f)}" stroke-width="1" opacity=".6"/>`;
  const h = p.handle || fold(f);
  s += `<path d="M70 76 Q78 42 100 42 Q122 42 130 76" stroke="${edge(h)}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M70 76 Q78 42 100 42 Q122 42 130 76" stroke="${h}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M60 80 H140" stroke="${isLight(f) ? shade(f, -0.4) : shade(f, 0.4)}" stroke-width="1.6" stroke-dasharray="1.6 1.4"/>`;
  if (p.mark) s += p.mark;
  return s;
}

/* ---------- SMALL THINGS ---------- */
function watch(p, g) {
  const strap = p.strap, face = p.face || C.black, caseC = p.case || C.silver, r = g.rig();
  let s = ground(g, 100, 182, 24, 5);
  s += `<rect x="86" y="22" width="28" height="156" rx="6" fill="${strap}"/><rect x="86" y="22" width="28" height="156" rx="6" fill="${r.h}"/><rect x="86" y="22" width="28" height="156" rx="6" fill="none" stroke="${edge(strap)}" stroke-width="1" opacity=".85"/>`;
  if (p.links) { let l = ""; for (let y = 30; y < 176; y += 9) l += `M86 ${y} H114 `; s += `<path d="${l}" stroke="${edge(strap)}" stroke-width="1" opacity=".8"/><path d="M100 30 V172" stroke="${lift(strap)}" stroke-width="1" opacity=".5"/>`; }
  else { for (let y = 146; y < 172; y += 7) s += `<circle cx="100" cy="${y}" r="1.4" fill="${shade(strap, -0.4)}"/>`; s += `<rect x="86" y="118" width="28" height="7" rx="2" fill="${caseC}" stroke="${edge(caseC)}" stroke-width=".8"/>`; }
  if (p.shape === "square") {
    const rx = p.rx ?? 8;
    s += `<rect x="72" y="68" width="56" height="64" rx="${rx}" fill="${caseC}"/><rect x="72" y="68" width="56" height="64" rx="${rx}" fill="${r.h}"/><rect x="72" y="68" width="56" height="64" rx="${rx}" fill="none" stroke="${edge(caseC)}" stroke-width="1.1"/>`;
    s += `<rect x="79" y="77" width="42" height="46" rx="${Math.max(2, rx - 3)}" fill="${face}" stroke="${edge(face)}" stroke-width=".8"/>`;
    if (p.digits) s += `<path d="M86 92 h10 M100 92 h12 M86 104 h26 M90 112 h18" stroke="${p.digits}" stroke-width="2.2"/><path d="M84 84 h8 M110 84 h6" stroke="${p.digits}" stroke-width="1" opacity=".7"/>`;
    if (p.screen) s += `<circle cx="92" cy="92" r="4.2" fill="${p.screen}"/><rect x="99" y="88" width="16" height="8" rx="2" fill="${shade(p.screen, 0.3)}"/><rect x="85" y="102" width="30" height="4" rx="2" fill="${shade(p.screen, -0.2)}"/><rect x="85" y="110" width="20" height="4" rx="2" fill="#fff" opacity=".6"/>`;
    s += `<rect x="128" y="86" width="4.5" height="12" rx="1.5" fill="${caseC}" stroke="${edge(caseC)}" stroke-width=".8"/>`;
    s += `<path d="M76 72 Q100 66 124 72" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" fill="none"/>`;
  } else {
    s += `<circle cx="100" cy="100" r="35" fill="${caseC}"/><circle cx="100" cy="100" r="35" fill="${r.h}"/><circle cx="100" cy="100" r="35" fill="none" stroke="${edge(caseC)}" stroke-width="1.1"/>`;
    s += `<circle cx="100" cy="100" r="29" fill="${face}"/><circle cx="100" cy="100" r="29" fill="none" stroke="${edge(face)}" stroke-width=".8"/>`;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, x1 = 100 + Math.sin(a) * 25, y1 = 100 - Math.cos(a) * 25, x2 = 100 + Math.sin(a) * 22, y2 = 100 - Math.cos(a) * 22; s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${p.hands || "#fff"}" stroke-width="${i % 3 ? .8 : 1.6}" opacity=".8"/>`; }
    if (p.digital) s += `<path d="M88 96 h24 M92 104 h16" stroke="${p.hands}" stroke-width="2.4"/><path d="M90 88 h20" stroke="${p.hands}" stroke-width="1" opacity=".6"/>`;
    else s += `<path d="M100 100 V80 M100 100 L114 108" stroke="${p.hands || "#fff"}" stroke-width="2.2" stroke-linecap="round"/><circle cx="100" cy="100" r="1.6" fill="${p.hands || "#fff"}"/>`;
    s += `<rect x="134" y="94" width="5" height="12" rx="1.5" fill="${caseC}" stroke="${edge(caseC)}" stroke-width=".8"/>`;
    s += `<path d="M78 84 Q90 70 108 72" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" fill="none"/>`;
  }
  return s;
}
function tie(p, g) {
  const f = p.fill, r = g.rig();
  let s = ground(g, 100, 188, 26, 5);
  const blade = "M94 56 L106 56 L120 160 L100 186 L80 160 Z", knot = "M88 30 L112 30 L108 52 L92 52 Z";
  s += `<path d="${blade}" fill="${f}"/><path d="${blade}" fill="${r.h}"/><path d="${blade}" fill="none" stroke="${edge(f)}" stroke-width="1" stroke-linejoin="round" opacity=".85"/>`;
  s += `<path d="${knot}" fill="${f}"/><path d="${knot}" fill="${r.h}"/><path d="${knot}" fill="none" stroke="${edge(f)}" stroke-width="1" opacity=".85"/>`;
  s += `<path d="M92 52 Q100 60 108 52" stroke="#000" stroke-opacity=".2" stroke-width="2.5" fill="none"/>` + crease("M100 62 V170", f, .5);
  return s;
}
function belt(p, g) {
  const f = p.fill;
  const pat = p.pattern ? g.pat({ ...p.pattern, base: f }) : null;
  const d = "M34 156 Q86 128 146 64";
  let s = ground(g, 100, 170, 70, 6);
  s += `<path d="${d}" stroke="${edge(f)}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${f}" stroke-width="18" fill="none" stroke-linecap="round"/>`;
  if (pat) s += `<path d="${d}" stroke="${pat}" stroke-width="18" fill="none" stroke-linecap="round"/>`;
  s += `<path d="${d}" stroke="#fff" stroke-opacity="${isDark(f) ? .14 : .3}" stroke-width="3" fill="none" transform="translate(-3 -3)"/>`;
  s += `<path d="${d}" stroke="#000" stroke-opacity=".12" stroke-width="3" fill="none" transform="translate(3 3)"/>`;
  s += stitch("M30 150 Q82 122 142 58", shade(f, 0.4)) + stitch("M38 162 Q90 134 150 70", shade(f, 0.4));
  s += `<g fill="${edge(f)}"><circle cx="46" cy="146" r="1.6"/><circle cx="56" cy="138" r="1.6"/><circle cx="66" cy="130" r="1.6"/><circle cx="76" cy="121" r="1.6"/></g>`;
  const b = p.buckle || C.silver;
  s += `<g transform="translate(148 60) rotate(-48)"><rect x="-12" y="-16" width="24" height="32" rx="4" fill="none" stroke="${shade(b, -0.3)}" stroke-width="5"/><rect x="-12" y="-16" width="24" height="32" rx="4" fill="none" stroke="${b}" stroke-width="3.5"/><path d="M0 -14 V14" stroke="${b}" stroke-width="3.2" stroke-linecap="round"/><path d="M-10 -14 h8" stroke="#fff" stroke-opacity=".6" stroke-width="1"/></g>`;
  return s;
}
function sunglasses(p, g) {
  const f = p.fill, lens = p.lens || shade(f, 0.08), r = g.rig();
  let s = ground(g, 100, 140, 80, 6);
  const L = "M22 92 Q22 68 48 68 H86 Q98 68 98 84 V104 Q98 128 72 128 H48 Q22 128 22 104 Z", R = "M102 92 Q102 68 128 68 H152 Q178 68 178 104 Q178 128 152 128 H128 Q102 128 102 104 Z";
  for (const d of [L, R]) s += `<path d="${d}" fill="${f}"/><path d="${d}" fill="${r.h}"/><path d="${d}" fill="none" stroke="${edge(f)}" stroke-width="1" opacity=".85"/>`;
  s += `<rect x="30" y="76" width="62" height="44" rx="14" fill="${lens}"/><rect x="108" y="76" width="62" height="44" rx="14" fill="${lens}"/>`;
  s += `<rect x="30" y="76" width="62" height="44" rx="14" fill="${r.hi}"/><rect x="108" y="76" width="62" height="44" rx="14" fill="${r.hi}"/>`;
  s += `<path d="M98 86 Q100 80 102 86" stroke="${f}" stroke-width="5" fill="none"/><path d="M22 86 L8 80 M178 86 L192 80" stroke="${f}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<path d="M40 86 q12 -8 24 -2" stroke="#fff" stroke-opacity=".45" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M118 86 q12 -8 24 -2" stroke="#fff" stroke-opacity=".45" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return s;
}
function socks(p, g) {
  const f = p.fill, r = g.rig();
  const pat = p.pattern ? g.pat({ ...p.pattern, base: f }) : null;
  let s = ground(g, 100, 180, 56, 6);
  const one = (dx, dim) => {
    const d = `M${72 + dx} 40 H${106 + dx} V120 Q${110 + dx} 142 ${138 + dx} 150 Q${152 + dx} 160 ${136 + dx} 172 H${90 + dx} Q${72 + dx} 170 ${72 + dx} 150 Z`;
    let t = `<g opacity="${dim ? .6 : 1}"><path d="${d}" fill="${f}"/>`;
    if (pat) t += `<path d="${d}" fill="${pat}"/>`;
    t += `<path d="${d}" fill="${r.h}"/><path d="${d}" fill="none" stroke="${edge(f)}" stroke-width="1" stroke-linejoin="round" opacity=".85"/>`;
    t += ribBand(72 + dx, 40, 34, 16, f, g);
    if (p.lines) t += `<path d="M${72 + dx} 66 H${106 + dx} M${72 + dx} 74 H${106 + dx}" stroke="${p.lines}" stroke-width="2.4"/>`;
    t += `<path d="M${124 + dx} 164 Q${100 + dx} 172 ${80 + dx} 164" stroke="${fold(f)}" stroke-width="1.2" fill="none"/><path d="M${106 + dx} 120 Q${118 + dx} 140 ${134 + dx} 150" stroke="#000" stroke-opacity=".12" stroke-width="2.5" fill="none"/></g>`;
    return t;
  };
  return s + one(-22, true) + one(10, false);
}

const TEMPLATES = { top, bottoms, shoe, cap, beanie, scarf, backpack, duffel, holdall, watch, tie, belt, sunglasses, socks };

/** Draws one item. `item.id` keeps ids unique when many sit on one page. */
export function renderGarment(item, { size = 200, className = "" } = {}) {
  const d = item.draw || {};
  const fn = TEMPLATES[d.t];
  const g = ctx(`p${String(item.id).replace(/[^a-zA-Z0-9_-]/g, "")}`);
  const body = fn ? fn(d, g) : `<rect x="40" y="40" width="120" height="120" rx="12" fill="none" stroke="#999" stroke-dasharray="4 4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${(item.name || "").replace(/"/g, "&quot;")}" class="${className}"><defs>${g.defs.join("")}</defs>${body}</svg>`;
}

export { MARK };
