/* The log-a-lesson flow as frames: home → plus → Who → the page → two areas → Log it → Logged.
   CSS motion slowed tenfold so bursts of screenshots sample each transition finely.
   node seq-log.cjs <dist> <port> <outDir> */
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const L = require("/tmp/claude-0/-home-user-nosca-pilot-2/59796c7e-eaeb-5dc3-9ca9-bb5a1bf5dfb8/scratchpad/site/tools/lib.cjs");
const [dist, portArg, outDir] = process.argv.slice(2);
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
  await page.waitForTimeout(1200);
  await cdp.send("Animation.enable"); await cdp.send("Animation.setPlaybackRate", { playbackRate: RATE });
  const all = []; let n = 0, last = "";
  const burst = async (seg, ms) => {
    const t0 = Date.now(); let kept = 0;
    while (Date.now() - t0 < ms) {
      const t = Date.now(); const buf = await page.screenshot({ type: "png" });
      const h = crypto.createHash("md5").update(buf).digest("hex"); if (h === last) continue; last = h;
      const f = `raw-${String(n++).padStart(4, "0")}.png`; fs.writeFileSync(path.join(outDir, f), buf); all.push({ f, seg, at: ((t + Date.now()) / 2 - t0) * RATE }); kept++;
    }
    console.log(seg, kept, "distinct frames");
  };
  const click = async (loc, seg, ms) => { const el = typeof loc === "string" ? page.locator(loc).first() : loc; if (!(await el.count())) { console.log("MISSING", seg); return; } await el.dispatchEvent("click"); await burst(seg, ms); };
  await burst("home", 400);
  await click('[data-tour="quick"]', "plus", 7000);
  await click('[data-tour="quick-log"]', "who", 7000);
  await click(page.locator('[data-tour="wiz-who"]').first(), "page", 7000);
  await click(page.locator("button", { hasText: /^Chipping$/ }).first(), "chipping", 2500);
  await click(page.locator("button", { hasText: /^Putting$/ }).first(), "putting", 2500);
  await click(page.locator("button", { hasText: /^Log it$/ }).first(), "logged", 14000);
  fs.writeFileSync(path.join(outDir, "frames.json"), JSON.stringify(all, null, 1));
  await ctx.close(); await browser.close(); server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
