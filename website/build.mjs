#!/usr/bin/env node
/* Nosca's website: the build. Plain Node, no dependencies.
   src/pages/*.html + src/partials/* + site.config.json  ->  dist/
   Every URL it writes is relative, so dist/ works at a domain root or under a folder.
   Usage: node build.mjs            (build once, with the kit page)
          node build.mjs --out <dir> [--kit]   (a release build; --kit keeps the kit page)
          node build.mjs --watch    (rebuild when src/ changes)                          */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
/* --out <dir>: where to write (default website/dist). --release, or any --out, leaves the kit page out:
   pages, styles and scripts whose name starts with an underscore are for working on the site, not for visitors. */
const outAt = process.argv.indexOf('--out');
const DIST = outAt > -1 && process.argv[outAt + 1] ? path.resolve(process.cwd(), process.argv[outAt + 1]) : path.join(ROOT, 'dist');
const RELEASE = (outAt > -1 || process.argv.includes('--release')) && !process.argv.includes('--kit');   /* --kit keeps the kit page with --out */
const shown = (n) => !(RELEASE && n.startsWith('_'));
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- the geometry the pages share ---------- */
const RING_L = 'M18.651 19.734 A 8.6 8.6 0 1 1 21.108 17.341';
const RING_R = 'M21.349 5.266 A 8.6 8.6 0 1 1 18.892 7.659';
const CIRC = 'M8.6 0 A 8.6 8.6 0 1 1 -8.6 0 A 8.6 8.6 0 1 1 8.6 0'; /* a whole ring from its east point, clockwise */

/* The card's pinstripe wedge (top right), in the card's own millimetres: the boundary runs from
   (39.85, 0) on the top edge to (84, 30.52) on the right edge; the stripes cross it at 45 degrees,
   4.24 mm apart along the top edge. Each stripe is its own path so it can be drawn in line by line. */
function wedge(cls, flip) {
  const W = 44.15, H = 30.52, m = H / W, step = 4.24;
  const f = (n) => +n.toFixed(2);
  let i = 0, out = '';
  for (let c = 2.9; c < W + H - 0.6; c += step) {
    const px = c / (1 + m), py = m * px;
    const ex = c <= W ? c : W, ey = c <= W ? 0 : c - W;
    out += `<path class="pins__s" style="--i:${i++}" pathLength="1" d="M${f(px)} ${f(py)}L${f(ex)} ${f(ey)}"/>`;
  }
  /* the bottom-left wedge is the top-right one turned half a turn, inside the drawing, so CSS transforms stay free */
  return `<svg class="pins__w ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<g${flip ? ` transform="rotate(180 ${W / 2} ${H / 2})"` : ''}><path class="pins__edge" pathLength="1" d="M0 0L${W} ${H}"/>${out}</g></svg>`;
}

/* THE DEEP GREEN CARD'S STRIPES, as the first print file drew them (src/pages/Install.jsx, BAND): the lines
   x + y = c, 3.6 mm apart (c steps 3.6 * sqrt 2 from 0.909), across the top 15 mm and the foot 15 mm of the 84 x 55
   card, a clear band through the middle where the mark and NOSCA stand, and no gold edge. */
const CARD_W = 84, CARD_H = 55, PITCH = 3.6 * Math.SQRT2, PHASE = 0.909, BAND_TOP = 15, BAND_FOOT = 40;
const f2 = (n) => +n.toFixed(2);
function cardBand() {
  const top = [], foot = [];
  for (let c = PHASE; c < CARD_W + CARD_H; c += PITCH) {
    const ts = Math.min(BAND_TOP, c), te = Math.max(0, c - CARD_W);
    if (ts > te) top.push(`M${f2(c - ts)} ${f2(ts)}L${f2(c - te)} ${f2(te)}`);
    const fs = Math.max(BAND_FOOT, c - CARD_W), fe = Math.min(CARD_H, c);
    if (fe > fs) foot.push(`M${f2(c - fs)} ${f2(fs)}L${f2(c - fe)} ${f2(fe)}`);
  }
  return [...top, ...foot];
}
/* the same stripes as a band along a section's edge: a strip 15 units tall and 400 wide, sliced to the strip's
   height so the stripes keep the card's angle and spacing at any width; each stripe drawn outward from the band */
function edgeBand(where) {
  const W = 400, H = 15, out = [];
  for (let c = PHASE; c < W + H; c += PITCH) {
    const a = Math.min(H, c), b = Math.max(0, c - W);
    if (a <= b) continue;
    /* top: from the band's inner edge (y = 15) up; foot: from its inner edge (y = 0) down */
    out.push(where === 'top' ? `M${f2(c - a)} ${f2(a)}L${f2(c - b)} ${f2(b)}` : `M${f2(c - a)} ${f2(H - a)}L${f2(c - b)} ${f2(H - b)}`);
  }
  return `<svg class="band__${where}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
    out.map((d) => `<path pathLength="1" d="${d}"/>`).join('') + '</svg>';
}

/* an image sequence's manifest (assets/seq/<name>/manifest.json, written by the capture tools) */
const frameName = (m, i) => m.pattern.replace(/%0(\d)d/, (_, n) => String(i).padStart(+n, '0'));
function seqOf(name) {
  const f = path.join(ROOT, 'assets', 'seq', name, 'manifest.json');
  if (!exists(f)) throw new Error(`no image sequence called "${name}" (assets/seq/${name}/manifest.json)`);
  return JSON.parse(read(f));
}
/* a photograph's entry in assets/photo/MANIFEST.json (the imagery engineer's file), found by name, id or file */
function photoOf(name, kind) {
  const f = path.join(ROOT, 'assets', 'photo', 'MANIFEST.json');
  if (!exists(f)) return null;
  const raw = JSON.parse(read(f)); const list = kind === 'loop' ? (raw.loops || []) : Array.isArray(raw) ? raw : (raw.photos || raw.images || raw.items || Object.entries(raw).map(([k, v]) => ({ name: k, ...v })));
  const base = (s) => String(s || '').replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '').replace(/-(\d{3,4})w?$/, '');
  return list.find((e) => e && (e.name === name || e.id === name || e.slug === name || e.file === name || base(e.file || e.src) === name)) || null;
}

const GEN = {
  /* <!-- @include seq name="log" alt="…" poster="0|last|N" class="…" attrs="…" --> frames of the real app, scrubbed by the scroll (Site.sequence) */
  seq: (a) => {
    const m = seqOf(a.name);
    const at = a.poster === 'last' ? m.frames - 1 : +a.poster || 0;
    return `<div class="seq${a.class ? ' ' + a.class : ''}" style="--ar:${m.w}/${m.h}" data-sequence="assets/seq/${m.name}/" data-frames="${m.frames}" data-pattern="${m.pattern}" data-w="${m.w}" data-h="${m.h}"${a.attrs ? ' ' + a.attrs : ''}>` +
      `<img src="assets/seq/${m.name}/${frameName(m, at)}" width="${m.w}" height="${m.h}" alt="${esc(a.alt || '')}" decoding="async"${a.eager ? ' fetchpriority="high"' : ' loading="lazy"'}></div>`;
  },
  /* <!-- @include photo name="fairway-dawn" class="photo--tall" attrs="data-settle" sizes="(min-width:900px) 50vw, 100vw" alt="…" credit="1" eager="1" -->
     Reads width, height, alt, the sizes on disk and the credit from assets/photo/MANIFEST.json. */
  photo: (a) => {
    const e = photoOf(a.name) || {};
    const dir = 'assets/photo/';
    const file = (f) => (/^assets\//.test(f) ? f : dir + String(f).replace(/^.*photo\//, ''));
    const vars = (e.variants || e.sizes || e.srcset || e.files || []).filter((v) => v && (v.file || v.src) && (v.w || v.width));
    const big = vars.slice().sort((x, y) => (y.w || y.width) - (x.w || x.width))[0];
    const src = a.src || (e.file || e.src ? file(e.file || e.src) : big ? file(big.file || big.src) : '');
    if (!src) throw new Error(`no photograph called "${a.name}" in assets/photo/MANIFEST.json (and no src given)`);
    const w = a.w || e.w || e.width || (big && (big.w || big.width)), h = a.h || e.h || e.height || (big && (big.h || big.height));
    const srcset = vars.length > 1 ? ` srcset="${vars.map((v) => `${file(v.file || v.src)} ${v.w || v.width}w`).join(', ')}" sizes="${esc(a.sizes || '100vw')}"` : '';
    const alt = a.alt !== undefined ? a.alt : (e.alt || '');
    const focus = a.focus || e.focus || e.position;
    const credit = a.credit && (e.credit || e.by || e.author) ? `<p class="photo__credit">${esc(typeof (e.credit || e.by || e.author) === 'string' ? (e.credit || e.by || e.author) : '')}</p>` : '';
    const tone = /^#[0-9a-f]{3,8}$/i.test(e.dominant || e.tone || '') ? (e.dominant || e.tone) : '';
    const fig = `<figure class="photo${a.class ? ' ' + a.class : ''}" style="${w && h ? `--ar:${w}/${h};` : ''}${focus ? `--focus:${esc(focus)};` : ''}${tone ? `--tone:${tone};` : ''}"${a.attrs ? ' ' + a.attrs : ''}>` +
      `<img src="${src}"${srcset}${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''} alt="${esc(alt)}" decoding="async"${a.eager ? ' fetchpriority="high"' : ' loading="lazy"'}></figure>`;
    return credit ? `<div class="photo-wrap">${fig}${credit}</div>` : fig;
  },
  /* <!-- @include loop name="loop-golf-green-1" class="…" attrs="…" alt="…" scrub="1" credit="1" -->
     A clip from assets/photo/MANIFEST.json's loops: muted, inline, its poster the still. It plays only while it is on
     screen (data-video); with scrub="1" it never plays and the scroll is its play head (data-scrub-video). */
  loop: (a) => {
    const e = photoOf(a.name, 'loop') || photoOf('loop-' + a.name, 'loop');
    if (!e) throw new Error(`no loop called "${a.name}" in assets/photo/MANIFEST.json`);
    const dir = 'assets/photo/', w = e.width, h = e.height, alt = a.alt !== undefined ? a.alt : (e.alt || '');
    const tone = /^#[0-9a-f]{3,8}$/i.test(e.dominant || '') ? e.dominant : '';
    const credit = a.credit && typeof e.credit === 'string' ? `<p class="photo__credit">${esc(e.credit)}</p>` : '';
    const fig = `<figure class="vid${a.class ? ' ' + a.class : ''}" style="--ar:${w}/${h};${e.focus ? `--focus:${esc(e.focus)};` : ''}${tone ? `--tone:${tone};` : ''}"${a.attrs ? ' ' + a.attrs : ''}>` +
      `<video ${a.scrub ? 'data-scrub-video' : 'data-video'} muted playsinline${a.scrub ? '' : ' loop'} preload="none" width="${w}" height="${h}" poster="${dir}${e.poster.file}" src="${dir}${e.file}"${alt ? ` aria-label="${esc(alt)}"` : ' aria-hidden="true"'}></video></figure>`;
    return credit ? `<div class="photo-wrap">${fig}${credit}</div>` : fig;
  },
  /* <!-- @include mark class="…" --> the woven mark, two paths that can be drawn */
  mark: (a) => {
    const st = '';
    return `<svg class="mark${a.foil ? ' mark--gold' : ''}${a.class ? ' ' + a.class : ''}" viewBox="0 0 40 25"${a.label ? ` role="img" aria-label="${esc(a.label)}"` : ' aria-hidden="true"'} focusable="false"${a.attrs ? ' ' + a.attrs : ''}>` +
      `<path class="mark__l" pathLength="1"${st} d="${RING_L}"/><path class="mark__r" pathLength="1"${st} d="${RING_R}"/></svg>`;
  },
  /* <!-- @include weave class="…" --> two whole rings that travel and weave (Site.weave) */
  weave: (a) => {
    const st = '';
    return `<svg class="weave${a.foil ? ' weave--gold' : ''}${a.class ? ' ' + a.class : ''}" viewBox="0 0 40 25"${a.label ? ` role="img" aria-label="${esc(a.label)}"` : ' aria-hidden="true"'} focusable="false"${a.attrs ? ' ' + a.attrs : ''}>` +
      `<g class="weave__l" transform="translate(14 12.5)"><path${st} d="${CIRC}" stroke-dasharray="50.583 3.452" stroke-dashoffset="45.441"/></g>` +
      `<g class="weave__r" transform="translate(26 12.5)"><path${st} d="${CIRC}" stroke-dasharray="50.583 3.452" stroke-dashoffset="18.423"/></g></svg>`;
  },
  /* <!-- @include band edge="both|top|foot" class="…" --> the deep green card's stripes along a section's top and foot */
  band: (a) => {
    const e = a.edge || 'both';
    return `<div class="band band--${e}${a.class ? ' ' + a.class : ''}" aria-hidden="true" data-stripes${a.attrs ? ' ' + a.attrs : ''}>` +
      (e !== 'foot' ? edgeBand('top') : '') + (e !== 'top' ? edgeBand('foot') : '') + '</div>';
  },
  /* <!-- @include bcard world="green|olive" class="…" attrs="…" --> the business card as an object, both faces.
     The deep green's front is the first print file's (the band); the olive's is the two corner wedges. */
  bcard: (a) => {
    const world = a.world === 'olive' ? 'olive' : 'green';
    const ring = `<path d="${RING_L}"/><path d="${RING_R}"/>`;
    const front = world === 'green'
      ? `<div class="bcard__face bcard__front bcard__front--band" role="img" aria-label="The front of the deep green Nosca card: gold pinstripes across its top and foot, the two woven rings and NOSCA in gold">` +
        `<svg class="bcard__art" viewBox="0 0 ${CARD_W} ${CARD_H}" aria-hidden="true" focusable="false"><rect width="${CARD_W}" height="${CARD_H}" class="bcard__ground"/>` +
        `<g class="bcard__band">${cardBand().map((d) => `<path pathLength="1" d="${d}"/>`).join('')}</g>` +
        `<g class="bcard__rings" transform="translate(31 17.5) scale(0.55)">${ring}</g>` +
        `<text class="bcard__nosca" x="${f2(CARD_W / 2 + 0.42 * 3.53 / 2)}" y="36.72" text-anchor="middle">NOSCA</text></svg><i class="sheen" aria-hidden="true"></i></div>`
      : `<div class="bcard__face bcard__front" role="img" aria-label="The front of the olive Nosca card: gold pinstripes in two corners, the two woven rings and NOSCA in gold">` +
        `<div class="pins" aria-hidden="true">${wedge('pins__tr')}${wedge('pins__bl', true)}</div>` +
        `<div class="bcard__lock" aria-hidden="true">${GEN.mark({ class: 'bcard__mark', foil: 'd' })}<span class="wordmark bcard__word">NOSCA</span></div><i class="sheen" aria-hidden="true"></i></div>`;
    const back = render(read(path.join(SRC, 'partials', 'cardback.html')), {});
    return `<div class="bcard${a.class ? ' ' + a.class : ''}" data-world="${world}"${a.attrs ? ' ' + a.attrs : ''}><div class="bcard__flip">${front}${back}</div></div>`;
  },
  /* <!-- @include pins class="…" --> the two opposing wedges of gold pinstripes */
  pins: (a) => `<div class="pins${a.class ? ' ' + a.class : ''}" aria-hidden="true"${a.attrs ? ' ' + a.attrs : ''}>${wedge('pins__tr')}${wedge('pins__bl', true)}</div>`,
  /* <!-- @include phone screens="coach-today-golf,coach-plus-golf" alts="…|…" mode="fade" class="…" eager="1" --> */
  phone: (a) => {
    const names = String(a.screens || a.src || '').split(',').map((s) => s.trim()).filter(Boolean);
    const alts = String(a.alts || a.alt || '').split('|');
    const seq = a.seq ? seqOf(a.seq) : null;
    const lead = seq ? `<div class="screen seq is-on" data-sequence="assets/seq/${seq.name}/" data-frames="${seq.frames}" data-pattern="${seq.pattern}" data-w="${seq.w}" data-h="${seq.h}"${a.seqattrs ? ' ' + a.seqattrs : ''}>` +
      `<img src="assets/seq/${seq.name}/${frameName(seq, a.poster === 'last' ? seq.frames - 1 : +a.poster || 0)}" width="${seq.w}" height="${seq.h}" alt="${esc(a.seqalt || alts[0] || '')}" decoding="async"${a.eager ? ' fetchpriority="high"' : ' loading="lazy"'}></div>` : '';
    const imgs = lead + names.map((n, i) => `<img class="screen${i === 0 && !seq ? ' is-on' : ''}" src="assets/${n}.webp" width="780" height="1688" alt="${esc(seq ? '' : alts[i] || '')}"${(i > 0 || seq) && !(alts[i] && !seq) ? ' aria-hidden="true"' : ''} decoding="async"${a.eager && i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>`).join('');
    return `<div class="phone${a.class ? ' ' + a.class : ''}"${a.attrs ? ' ' + a.attrs : ''}${a.settle ? ` data-phone="${esc(a.settle)}"` : ' data-phone'}>` +
      `<div class="phone__body"><div class="phone__screen"${names.length + (seq ? 1 : 0) > 1 || a.mode ? ` data-screens="${esc(a.mode || 'fade')}"` : ''}${a.autoplay ? ` data-autoplay="${esc(a.autoplay)}"` : ''}>${imgs}</div>` +
      `<i class="phone__island" aria-hidden="true"></i><i class="phone__sheen" aria-hidden="true"><b></b></i></div><i class="phone__floor" aria-hidden="true"></i></div>`;
  }
};

/* ---------- the template language: includes, variables, conditions ---------- */
function attrsOf(str) {
  const out = {};
  String(str || '').replace(/([\w-]+)\s*=\s*"([^"]*)"/g, (_, k, v) => { out[k] = v; return ''; });
  return out;
}
function render(text, vars, depth = 0) {
  if (depth > 8) throw new Error('includes nested too deep');
  /* <!-- @if key --> … <!-- @else --> … <!-- @endif -->   (key may be !key; not nested) */
  text = text.replace(/<!--\s*@if\s+(!?)([\w.]+)\s*-->([\s\S]*?)<!--\s*@endif\s*-->/g, (_, not, key, body) => {
    const [yes, no = ''] = body.split(/<!--\s*@else\s*-->/);
    const v = vars[key];
    const on = !(v === undefined || v === null || v === '' || v === false || v === '0');
    return (not ? !on : on) ? yes : no;
  });
  /* <!-- @include name key="value" --> */
  text = text.replace(/<!--\s*@include\s+([\w-]+)([^>]*?)-->/g, (_, name, rest) => {
    const a = attrsOf(rest);
    if (GEN[name]) return GEN[name](a);
    const file = path.join(SRC, 'partials', name + '.html');
    if (!exists(file)) throw new Error(`no partial or generator called "${name}"`);
    return render(read(file), { ...vars, ...a }, depth + 1);
  });
  /* {{key}}  {{key|fallback}}  {{cur:page}} */
  text = text.replace(/\{\{\s*cur:([\w-]+)\s*\}\}/g, (_, p) => (vars.page === p ? ' aria-current="page"' : ''));
  text = text.replace(/\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g, (_, key, fb) => {
    const v = vars[key];
    return v === undefined || v === null || v === '' ? (fb !== undefined ? fb : '') : String(v);
  });
  return text;
}
/* A page starts with one comment of "key: value" lines (title, description, world, header, theme). */
function frontMatter(src) {
  const m = src.match(/^\s*<!--([\s\S]*?)-->/);
  const meta = {};
  if (!m) return { meta, body: src };
  m[1].split('\n').forEach((line) => {
    const k = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (k) meta[k[1]] = k[2];
  });
  return { meta, body: src.slice(m[0].length) };
}

/* ---------- files ---------- */
function put(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (exists(file) && fs.readFileSync(file).equals(buf)) return false;
  fs.writeFileSync(file, buf);
  return true;
}
function copyDir(from, to, keep = () => true) {
  if (!exists(from)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(a, b, keep);
    else if (keep(e.name)) { put(b, fs.readFileSync(a)); n++; }
  }
  return n;
}
const WORLD = { olive: '#4F5B29', green: '#123C30' };

function build() {
  const t0 = Date.now();
  const config = JSON.parse(read(path.join(ROOT, 'site.config.json')));
  copyDir(path.join(SRC, 'css'), path.join(DIST, 'css'), (n) => n.endsWith('.css') && shown(n));
  copyDir(path.join(SRC, 'js'), path.join(DIST, 'js'), (n) => n.endsWith('.js') && shown(n));
  copyDir(path.join(ROOT, 'vendor'), path.join(DIST, 'vendor'), (n) => /\.(js|css)$/.test(n));
  copyDir(path.join(ROOT, 'fonts'), path.join(DIST, 'fonts'), (n) => /\.(woff2|txt)$/.test(n));
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), (n) => !/\.(json|md|py|cjs)$/.test(n) && shown(n));

  const shell = read(path.join(SRC, 'partials', 'shell.html'));
  const pagesDir = path.join(SRC, 'pages');
  const built = [];
  for (const f of fs.readdirSync(pagesDir).filter((n) => n.endsWith('.html') && shown(n)).sort()) {
    const page = f.replace(/\.html$/, '');
    const { meta, body } = frontMatter(read(path.join(pagesDir, f)));
    const world = meta.world === 'green' ? 'green' : 'olive';
    const vars = {
      ...config,
      title: 'Nosca · Coaching, linked.',
      description: 'One coaching app for coach, player and parent, in golf, tennis, rowing, squash, padel and equestrian. In pilot in Ireland.',
      header: 'paper',
      ...meta,
      page, world,
      theme: meta.theme || (/^(dark|world|green)$/.test(meta.header || '') ? WORLD[world] : meta.header === 'rest' ? '#F6F4EE' : '#FFFFFF'),
      worldColor: WORLD[world],
      pageCss: exists(path.join(SRC, 'css', page + '.css')) ? `<link rel="stylesheet" href="css/${page}.css">` : '',
      pageJs: exists(path.join(SRC, 'js', page + '.js')) ? `<script defer src="js/${page}.js"></script>` : '',
      /* preload: InstrumentSerif-Italic, … — a font the page's first screen sets large, fetched with the two the shell always preloads */
      preload: (meta.preload || '').split(',').map((n) => n.trim()).filter((n) => /^[\w-]+$/.test(n) && exists(path.join(ROOT, 'fonts', n + '.woff2')))
        .map((n) => `<link rel="preload" href="fonts/${n}.woff2" as="font" type="font/woff2" crossorigin>`).join('\n')
    };
    vars.title = esc(vars.title); vars.description = esc(vars.description);
    let html = meta.raw ? render(body.trim() + '\n', vars) : render(shell, { ...vars, content: '%%CONTENT%%' });
    if (!meta.raw) html = html.replace('%%CONTENT%%', () => render(body, vars));
    html = html.replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n');
    /* guard rails: nothing absolute, nothing third-party but the app's own links */
    const bad = [...html.matchAll(/(?:src|href)="(\/[^"]*|https?:\/\/[^"]*)"/g)].map((m) => m[1])
      .filter((u) => !(config.appUrl && u.startsWith(config.appUrl.replace(/\/$/, ''))));
    if (bad.length) console.warn(`  ! ${f}: not relative: ${[...new Set(bad)].join(', ')}`);
    if (/\[[A-Z][^\]\n<>]{2,40}\]|lorem ipsum|coming soon/i.test(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' '))) console.warn(`  ! ${f}: looks like a placeholder is showing`);
    put(path.join(DIST, f), html);
    built.push(f);
  }
  console.log(`built ${built.join(' ')} in ${Date.now() - t0} ms`);
}

try { build(); } catch (e) { console.error('build failed: ' + e.message); process.exitCode = 1; }
if (process.argv.includes('--watch')) {
  let t = 0;
  fs.watch(SRC, { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => { try { build(); } catch (e) { console.error('build failed: ' + e.message); } }, 120); });
  console.log('watching src/ …');
}
