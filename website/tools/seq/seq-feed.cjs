/* The player's feed as frames: the first lesson, the thumb moving it up, the next lesson arriving, then one more.
   node seq-feed.cjs <dist> <port> <outDir> [probe] */
const path = require("path"), fs = require("fs");
const L = require("/tmp/claude-0/-home-user-nosca-pilot-2/59796c7e-eaeb-5dc3-9ca9-bb5a1bf5dfb8/scratchpad/site/tools/lib.cjs");
const [dist, portArg, outDir, probe] = process.argv.slice(2);
const PORT = Number(portArg || 7305);
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
  const u = Object.values(db.users).find((x) => x.id === L.D.IDS.cian); await L.M.injectSession(page, L.M.session(u, db));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" }); await L.M.settle(page, { carryOn: true });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll("*")) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 200) out.push({ tag: e.tagName, cls: String(e.className).slice(0, 80), data: JSON.stringify(e.dataset), sh: e.scrollHeight, ch: e.clientHeight, snap: cs.scrollSnapType, kids: e.children.length }); }
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: path.join(outDir, "probe.png") });
  if (probe) { await browser.close(); server.close(); process.exit(0); }
  /* mark the feed's scroller, switch its snapping and smoothness off, pause every clip on its first frame */
  const n = await page.evaluate(() => {
    let best = null;
    for (const e of document.querySelectorAll("*")) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 200 && /y/.test(cs.scrollSnapType)) best = e; }
    if (!best) return 0;
    best.setAttribute("data-seq-feed", ""); best.style.scrollSnapType = "none"; best.style.scrollBehavior = "auto";
    document.querySelectorAll("video").forEach((v) => { v.pause(); v.autoplay = false; try { v.currentTime = 0.4; } catch (e) {} });
    return Math.round(best.scrollHeight / best.clientHeight);
  });
  console.log("cards", n);
  const all = []; let k = 0;
  const H = await page.evaluate(() => document.querySelector("[data-seq-feed]").clientHeight);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const shot = async (seg) => { const f = `raw-${String(k++).padStart(4, "0")}.png`; await page.screenshot({ path: path.join(outDir, f) }); all.push({ f, seg, at: k }); };
  await shot("first");
  const cards = Math.min(3, n);
  for (let c = 1; c < cards; c++) {
    const STEPS = 16;
    for (let i = 1; i <= STEPS; i++) {
      await page.evaluate(([y]) => { const s = document.querySelector("[data-seq-feed]"); s.scrollTop = y; document.querySelectorAll("video").forEach((v) => v.pause()); }, [Math.round((c - 1 + ease(i / STEPS)) * H)]);
      await page.waitForTimeout(i === STEPS ? 700 : 90);
      await shot("to" + c);
    }
  }
  fs.writeFileSync(path.join(outDir, "frames.json"), JSON.stringify(all, null, 1));
  await ctx.close(); await browser.close(); server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
