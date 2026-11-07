/* Renders every catalogue item to one static page (life/gallery.html):
 * the drawings inline as SVG, grouped by category, with the details
 * that were guessed listed at the top. Run: node scripts/gallery.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ITEMS, CATS } from "../src/lib/catalogue.js";
import { renderGarment } from "../src/lib/garments.js";

const here = dirname(fileURLToPath(import.meta.url));
const esc = s => String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const count = ITEMS.reduce((a, i) => a + (i.qty || 1), 0);
const asks = ITEMS.filter(i => i.ask);

const sections = CATS.map(c => {
  const items = ITEMS.filter(i => i.cat === c.id);
  if (!items.length) return "";
  const n = items.reduce((a, i) => a + (i.qty || 1), 0);
  return `<section id="${c.id}"><h2>${esc(c.label)} <small>${n}</small></h2><div class="grid">${items.map(i => `
  <figure class="item" id="i-${esc(i.id)}">
    <div class="art">${renderGarment(i, { size: 200 })}</div>
    <figcaption><b>${esc(i.name)}</b>${i.brand ? `<span>${esc(i.brand)}</span>` : ""}<span class="meta">${[i.size, i.fit, i.qty > 1 ? `×${i.qty}` : ""].filter(Boolean).map(esc).join(" · ")}</span>${i.ask ? `<span class="ask">${esc(i.ask)}</span>` : ""}</figcaption>
  </figure>`).join("")}</div></section>`;
}).join("");

const html = `<title>Fionn's Wardrobe Drawings</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Public+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: a review sheet. One grid per category; each drawing on its own white tile with the record under it. */
:root{--bg:#FBFBF9;--surface:#FFFFFF;--ink:#171A1F;--muted:#5C6470;--line:#E1E4E9;--accent:#2447C7;--wash:#EEF1FB;--warn:#A8701A;
  --f-display:"Bricolage Grotesque","Helvetica Neue",Arial,sans-serif;--f-body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0F1115;--surface:#171A20;--ink:#ECEEF2;--muted:#9AA3B0;--line:#262B34;--accent:#8AA2FF;--wash:#1A2140;--warn:#D9A24A;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0F1115;--surface:#171A20;--ink:#ECEEF2;--muted:#9AA3B0;--line:#262B34;--accent:#8AA2FF;--wash:#1A2140;--warn:#D9A24A;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--f-body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 60px}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.wrap{max-width:1200px;margin:0 auto}
h1,h2{font-family:var(--f-display);margin:0;text-wrap:balance;letter-spacing:-.015em}
h1{font-size:clamp(30px,5vw,44px);font-weight:700}
h2{font-size:24px;font-weight:600;margin:36px 0 14px;display:flex;align-items:baseline;gap:10px}
h2 small{font:500 13px/1 var(--f-body);color:var(--muted);letter-spacing:.04em}
.head{padding-block:36px 10px;display:grid;gap:10px}
.head p{margin:0;color:var(--muted);max-width:68ch}
.strip{position:sticky;top:env(safe-area-inset-top,0px);z-index:9;background:var(--bg);border-bottom:1px solid var(--line);margin-inline:calc(-1*max(16px,env(safe-area-inset-left,0px))) calc(-1*max(16px,env(safe-area-inset-right,0px)));padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px))}
.strip nav{max-width:1200px;margin:0 auto;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding-block:10px}
.strip nav::-webkit-scrollbar{display:none}
.strip a{flex:none;text-decoration:none;color:var(--muted);font-size:13px;font-weight:500;padding:6px 10px;border-radius:999px;white-space:nowrap}
.strip a:hover{color:var(--ink);background:var(--wash)}
.asks{border-left:3px solid var(--warn);background:var(--wash);padding:12px 16px;border-radius:0 10px 10px 0;margin-top:8px}
.asks b{display:block;margin-bottom:4px}
.asks ul{margin:0;padding-left:18px;font-size:14px}
.asks li{margin:3px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.item{margin:0;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:10px;display:grid;gap:6px;min-width:0}
.art{aspect-ratio:1;display:grid;place-items:center}
.art svg{width:100%;height:100%}
figcaption{display:grid;gap:1px;font-size:12.5px;line-height:1.35}
figcaption b{font-weight:600;font-size:13px}
figcaption span{color:var(--muted)}
figcaption .meta:empty{display:none}
figcaption .ask{color:var(--warn)}
</style>
<div class="strip"><nav aria-label="Categories">${CATS.map(c => `<a href="#${c.id}">${esc(c.label)}</a>`).join("")}</nav></div>
<div class="wrap">
<header class="head">
  <h1>Every item, drawn</h1>
  <p>${ITEMS.length} kinds of thing, ${count} items counting pairs and multiples, from the description of 7 Nov 2026. Each is a flat vector drawing in the garment's own colours, cut and pattern. These are the pictures the app uses; any one can be redrawn from a photo.</p>
  ${asks.length ? `<div class="asks"><b>${asks.length} details were not given and are guessed</b><ul>${asks.map(i => `<li><a href="#i-${esc(i.id)}">${esc(i.name)}</a>: ${esc(i.ask)}</li>`).join("")}</ul></div>` : ""}
</header>
${sections}
</div>
`;

const out = resolve(here, "../gallery.html");
writeFileSync(out, html);
console.log(`wrote ${out}: ${ITEMS.length} items, ${count} counting multiples, ${asks.length} to confirm, ${(html.length / 1024).toFixed(0)} KB`);
