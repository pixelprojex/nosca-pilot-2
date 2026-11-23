#!/usr/bin/env node
/* Look at the built site: stills, motion frames and a few measurements, without a dev server.
   node website/tools/cap.cjs --dist <built dir> --out <dir> --pages index,product [--widths 1440,390]
        [--mode off|on|nojs] [--frames 12] [--port 5900] [--height 900]
   off   Reduce Motion: the finished page, scrolled once so lazy pictures load, then one full-page still
   nojs  JavaScript off: the same, as a visitor with scripts blocked gets it
   on    motion on: --frames viewport stills taken while wheeling down the whole page
   Every run prints one JSON line a page and width: console errors, failed requests, sideways scroll,
   text under 12px, pictures that did not load, and where the stills are. */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node-tools/node_modules/playwright");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const DIST = path.resolve(arg("dist", "website/dist")), OUT = path.resolve(arg("out", "cap-out")), PORT = Number(arg("port", 5900));
const pages = arg("pages", "index").split(","), widths = arg("widths", "1440,390").split(",").map(Number);
const mode = arg("mode", "off"), frames = Number(arg("frames", 12)), H = Number(arg("height", 0));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".mp4": "video/mp4", ".txt": "text/plain" };
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    const f = path.join(DIST, p);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((ok) => server.listen(PORT, "127.0.0.1", ok));
  const browser = await chromium.launch();
  for (const w of widths) {
    const h = H || (w < 600 ? 844 : w < 1000 ? 1024 : 900);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: mode === "on" ? "no-preference" : "reduce",
      javaScriptEnabled: mode !== "nojs", isMobile: w < 600, hasTouch: w < 600 });
    for (const name of pages) {
      const page = await ctx.newPage(); const errors = [], failed = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      page.on("requestfailed", (r) => failed.push(r.url().replace(`http://127.0.0.1:${PORT}/`, "")));
      page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(`http://127.0.0.1:${PORT}/`, "")}`); });
      await page.goto(`http://127.0.0.1:${PORT}/${name}.html`, { waitUntil: "networkidle" }); await page.waitForTimeout(900);
      const total = () => page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      let sideways = 0; const shots = [];
      const side = async () => { sideways = Math.max(sideways, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
      if (mode === "on") {
        const max = (await total()) - h, step = Math.max(1, Math.ceil(max / Math.max(1, frames - 1)));
        for (let i = 0; i < frames; i++) {
          if (i) { let left = step; while (left > 0) { const d = Math.min(left, 120); await page.mouse.wheel(0, d); left -= d; await page.waitForTimeout(16); } await page.waitForTimeout(650); }
          const f = path.join(OUT, `${name}-${w}-on-f${String(i).padStart(2, "0")}.png`); await page.screenshot({ path: f }); shots.push(path.basename(f)); await side();
        }
      } else {
        const max = await total();
        for (let y = 0; y < max; y += Math.round(h * 0.8)) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(140); await side(); }
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
        const f = path.join(OUT, `${name}-${w}-${mode}.png`); await page.screenshot({ path: f, fullPage: true }); shots.push(path.basename(f));
      }
      const facts = await page.evaluate(() => {
        const small = [], seen = new Set();
        for (const el of document.querySelectorAll("body *")) {
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own) continue;
          const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none") continue;
          const px = parseFloat(cs.fontSize); if (px < 11.95) { const t = el.textContent.trim().slice(0, 30); if (!seen.has(t)) { seen.add(t); small.push(`${px}px "${t}"`); } }
        }
        const dead = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src"));
        return { small: small.slice(0, 12), smallCount: small.length, dead, height: document.documentElement.scrollHeight, title: document.title };
      });
      console.log(JSON.stringify({ page: name, width: w, mode, height: facts.height, sideways, errors: errors.slice(0, 6), failed: [...new Set(failed)].slice(0, 8), under12: facts.smallCount, under12sample: facts.small, deadImages: facts.dead, shots: shots.length > 3 ? [shots[0], "…", shots[shots.length - 1]] : shots, out: OUT }));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
