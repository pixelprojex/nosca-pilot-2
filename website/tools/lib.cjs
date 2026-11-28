/* The harness behind every picture of the app on the website: a plain static server for a mock build of the app
   (no vite, nothing written in the repository), the repository's own mocked Supabase (scripts/e2e/mock.cjs) seeded
   with the people in fixtures/db.cjs, and a phone: 390 x 844 with the iPhone's safe areas (47 top, 34 bottom)
   emulated, so the app lays itself out exactly as it does on a Home Screen. Stills are shot at 3x and saved at 2x;
   the sequences and the plus video at 2x.

   The build it serves (from the repository's root; the folder is any you like):
     VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=mock VITE_SUPPORT_EMAIL=help@nosca.ie \
       npx vite build --outDir /tmp/nosca-site-mock
   Playwright as the e2e suites take it: PLAYWRIGHT_MODULE, else a global `playwright`. */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("../../scripts/e2e/mock.cjs");
const D = require("./fixtures/db.cjs");

/* the clip inside the app's screens: the e2e suite's own stylised ball flight (the mock's default). The real coaching
   clips (fixtures/: a swing, a chip, a putt, a forehand, a rider) are served by name by feed-demo.cjs. */
const CLIPS = { synthetic: null };

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2", ".webm": "video/webm", ".mp4": "video/mp4", ".txt": "text/plain" };
function serve(dist, port) {
  const root = path.resolve(dist);
  if (!fs.existsSync(path.join(root, "index.html"))) throw new Error(`no build of the app at ${root} (see the top of website/tools/lib.cjs)`);
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, "index.html");
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok, no) => { server.once("error", no); server.listen(port, "127.0.0.1", () => ok(server)); });
}

const launch = () => chromium.launch();

/* A phone, signed in as `role` (a key of D.IDS, or null for nobody) on `db`, the clock pinned to `at` (default
   D.FIXED: Thursday 26 November 2026, 11:20 am). scale 3 for a still, 2 for a sequence. settle: wait out the
   splash and skip the walkthrough (false keeps the splash). clip: "synthetic" | "green". */
async function boot(browser, db, role, { port, scale = 3, settle = true, insets = true, at = D.FIXED, clip = "synthetic", width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "en-IE", timezoneId: "Europe/Dublin" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (insets) await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
  await page.clock.setFixedTime(new Date(at));
  await M.attach(page, db);
  if (CLIPS[clip]) {
    /* registered after the mock's own route, so it is asked first: a video's bytes are the clip, anything else
       goes on to the mock */
    const body = fs.readFileSync(CLIPS[clip]);
    await page.route(`${M.SB}/storage/v1/object/sign/**`, (route) => {
      const r = route.request(), p = new URL(r.url()).pathname;
      if (r.method() === "GET" && (/\.mp4$/.test(p) || /(markup|compare)-\d+\.webm$/.test(p)))
        return route.fulfill({ status: 200, contentType: "video/webm", headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes" }, body });
      return route.fallback();
    });
  }
  if (role) { const u = Object.values(db.users).find((x) => x.id === D.IDS[role]); await M.injectSession(page, M.session(u, db)); }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || (m.type() === "warning" && !/Download the React DevTools/.test(m.text()))) errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  if (settle) await M.settle(page, { carryOn: true });
  return { ctx, page, cdp, errors };
}

const wait = (page, ms) => page.waitForTimeout(ms);
/* the DOM click, as the suites do: the tab bar swallows a synthetic tap that lands within 150 ms of its own pointerup */
const tap = async (page, sel, ms = 800) => { const el = page.locator(sel).first(); if (!(await el.count())) return false; await el.dispatchEvent("click"); await page.waitForTimeout(ms); return true; };
const tapText = async (page, t, ms = 800, scope = "button") => { const el = page.locator(scope, { hasText: t }).first(); if (!(await el.count())) return false; await el.dispatchEvent("click"); await page.waitForTimeout(ms); return true; };
/* the screen's own scroller (the last one mounted is the one on top) */
const scrollTo = (page, y) => page.evaluate((yy) => { const s = [...document.querySelectorAll('[data-scroll="screen"]')].pop(); if (s) s.scrollTop = yy; }, y);
/* the console's errors and warnings, less what a mock build always says */
const noise = (errors) => errors.filter((x) => !/Failed to load resource|favicon|Service Worker registration blocked/.test(x));

/* A film of the app in use, for the sequences and the plus video. The app's CSS motion is slowed by `rate` through
   the DevTools Animation domain, so a burst of screenshots samples every transition finely. Each distinct frame is
   written as raw-NNNN.png and listed in frames.json with its segment and `at`: its moment in the animation's own
   time (ms since its burst began) for a timed burst, else its place in the film. seq/seq-encode.py picks from them.
   dedupe: false keeps a frame that repeats the one before (a scroll that is the film's own clock). */
async function film(page, cdp, outDir, { rate = 0.1, timed = true, dedupe = true } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^raw-\d+\.png$|^frames\.json$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  await cdp.send("Animation.enable"); await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
  const frames = []; let n = 0, last = "", count = 0;
  const hash = (buf) => require("crypto").createHash("md5").update(buf).digest("hex");
  /* one frame, kept only when it differs from the one before */
  const grab = async (seg, at) => {
    const t = Date.now(), buf = await page.screenshot({ type: "png" }), h = hash(buf);
    if (dedupe && h === last) return false; last = h;
    const f = `raw-${String(n++).padStart(4, "0")}.png`; fs.writeFileSync(path.join(outDir, f), buf);
    frames.push({ f, seg, at: at === undefined ? count++ : typeof at === "function" ? at(t) : at }); return true;
  };
  /* every distinct frame for `ms` of real time */
  const burst = async (seg, ms) => {
    const t0 = Date.now(); let kept = 0;
    while (Date.now() - t0 < ms) if (await grab(seg, timed ? (t) => ((t + Date.now()) / 2 - t0) * rate : undefined)) kept++;
    console.log(`${seg}: ${kept} distinct frames`); return kept;
  };
  const save = () => fs.writeFileSync(path.join(outDir, "frames.json"), JSON.stringify(frames, null, 1));
  /* the motion back at the app's own pace (1), or slowed again: a moment held by a JavaScript timer (a toast's 1.6 s)
     is not slowed with the CSS, so it is filmed at the pace it is read */
  const pace = async (r) => { rate = r; await cdp.send("Animation.setPlaybackRate", { playbackRate: r }); };
  return { frames, grab, burst, save, pace };
}

module.exports = { serve, launch, boot, wait, tap, tapText, scrollTo, noise, film, CLIPS, M, D };
