/* The Partners page's register, as frames: the coach's day with the clinic on now (the day's one card, its gold
   wedge and Register on it) → one tap and the register rises → all ten names marked, the list scrolled as the
   thumb goes down it → Submit register → the register taken ("Register taken · 9 present", the clinic's row
   reading 9 of 10 present). CSS motion slowed tenfold so bursts of screenshots sample each transition finely.
   SEQ_FIXED=2026-11-26T17:10:00 node seq-pt-register.cjs <dist> <port> <outDir> <harness lib.cjs>
   then: python3 seq-encode.py <outDir> assets/seq/pt-register pt-register 'home:1,open:8,m0:2,…,m9:2,submit:10' 660 */
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const [dist, portArg, outDir, libPath] = process.argv.slice(2);
const L = require(path.resolve(libPath));
const PORT = Number(portArg || 7301), RATE = 0.1;
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const server = await L.serve(path.resolve(dist), PORT);
  const browser = await L.launch();
  const db = L.D.buildDb("golf");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "en-IE", timezoneId: "Europe/Dublin" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
  await page.clock.setFixedTime(L.D.FIXED); await L.M.attach(page, db);
  const u = Object.values(db.users).find((x) => x.id === L.D.IDS.coach); await L.M.injectSession(page, L.M.session(u, db));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" }); await L.M.settle(page, { carryOn: true });
  await page.waitForTimeout(1500);
  await cdp.send("Animation.enable"); await cdp.send("Animation.setPlaybackRate", { playbackRate: RATE });
  const all = []; let n = 0, last = "", clock = 0;
  const grab = async (seg) => {
    const buf = await page.screenshot({ type: "png" });
    const h = crypto.createHash("md5").update(buf).digest("hex"); if (h === last) return false; last = h;
    const f = `raw-${String(n++).padStart(4, "0")}.png`; fs.writeFileSync(path.join(outDir, f), buf); all.push({ f, seg, at: clock++ }); return true;
  };
  const burst = async (seg, ms) => { const t0 = Date.now(); let k = 0; while (Date.now() - t0 < ms) if (await grab(seg)) k++; console.log(seg, k, "distinct frames"); };
  const click = async (el, seg, ms) => { if (!(await el.count())) { console.log("MISSING", seg); return; } await el.dispatchEvent("click"); await burst(seg, ms); };
  /* the list scrolls as the thumb goes down it: a few even steps, a frame each, so the scroll is in the film */
  const glide = async (el, seg) => {
    const d = await el.evaluate((b) => {
      let s = b.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
      if (!s) return 0; const r = b.getBoundingClientRect(), box = s.getBoundingClientRect();
      const want = r.bottom - (box.bottom - 150); const room = s.scrollHeight - s.clientHeight - s.scrollTop;
      return Math.max(0, Math.min(want, room));
    });
    if (d < 4) return;
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      await el.evaluate((b, dy) => { let s = b.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement; if (s) s.scrollTop += dy; }, d / steps);
      await page.waitForTimeout(60); await grab(seg);
    }
  };
  await burst("home", 400);
  await click(page.locator('[data-next-card] button', { hasText: "Register" }).first(), "open", 7000);
  const pres = page.locator("button", { hasText: /^\s*Present\s*$/ }), abs = page.locator("button", { hasText: /^\s*Absent\s*$/ });
  const rows = await pres.count(); console.log("rows", rows);
  for (let i = 0; i < rows; i++) { const b = (i === 3 ? abs : pres).nth(i); await glide(b, "m" + i); await click(b, "m" + i, 1400); }
  const sub = page.locator("button", { hasText: /Submit register/ }).first();
  await glide(sub, "m" + (rows - 1)); await burst("m" + (rows - 1), 300);
  await click(sub, "submit", 9000);
  fs.writeFileSync(path.join(outDir, "frames.json"), JSON.stringify(all, null, 1));
  await ctx.close(); await browser.close(); server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
