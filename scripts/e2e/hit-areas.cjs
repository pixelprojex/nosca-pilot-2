/* THE HIT AREA IS NOT THE GLYPH. The header's controls draw 25 square
   and answer a finger 44 tall, as wide as their row's gap allows without
   reaching into a neighbour; Back, the month chevrons and the diary's
   pencil answer 44 square. Measured by elementFromPoint — what a finger
   actually lands on — as each role at 375 and 320, with nothing another
   control owns taken (stolen 0) and no glyph moved. The register's
   Present and Absent are drawn 44 tall (they were 38) in a row still 62;
   the log's Set level reaches 44 (it was 30) and the line it sits on
   does not move.
   node scripts/e2e/hit-areas.cjs <dist> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });
const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Maximiliano Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 0), time: "4:00 pm", duration: 45 });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: dayPlus(db, 2), time: "11:00 am", duration: 60 });
  const l1 = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-20", focus: "Short game · Putting", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  const l2 = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-09-22", focus: "Grip", subs: ["Red ball"], notes: "x", unread: false });
  M.addNotification && M.addNotification(db, { userId: IDS.coach, title: "Cian Murphy cancelled", kind: "calendar" });
  M.addNotification && M.addNotification(db, { userId: IDS.adult, title: "Lesson logged", kind: "lesson" });
  return db;
}
const SELS = ['[data-tour="saved"]', '[data-tour="search"]', '[data-tour="alerts"]', '[data-tour="profile-pill"]', '[aria-label="Back"]', '[aria-label="Previous month"]', '[aria-label="Next month"]', '[data-tour="agenda-edit"]'];
const measure = (page, scope, sels = SELS) => page.evaluate(({ SELS, scope }) => {
  const root = scope ? document.querySelector(scope) : document;
  if (!root) return [];
  const out = [];
  for (const sel of SELS) {
    const els = Array.from(root.querySelectorAll(sel)).filter((e) => e.getClientRects().length && e.getBoundingClientRect().width > 0);
    const el = els[0]; if (!el) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0, stolen = 0;
    /* what a reach could take: every control in the same layer — the sheet's own when the scope is the sheet, since what lies under its scrim cannot be touched */
    const layer = scope && /^\[data-sheet/.test(scope) ? root : document;
    const others = Array.from(layer.querySelectorAll("button, a[href], input, select, textarea, [role=button], [tabindex]")).filter((o) => o !== el && !el.contains(o) && !o.contains(el) && o.getClientRects().length).map((o) => o.getBoundingClientRect());
    for (let y = Math.floor(cy - 45); y <= cy + 45; y++) for (let x = Math.floor(cx - 60); x <= cx + 60; x++) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x + 0.5, y + 0.5);
      if (hit && (hit === el || el.contains(hit))) { n++; if (others.some((q) => x + 0.5 > q.left && x + 0.5 < q.right && y + 0.5 > q.top && y + 0.5 < q.bottom)) stolen++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    const g = el.querySelector("svg"); const gr = g ? g.getBoundingClientRect() : null;
    out.push({ sel, box: [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)], hit: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null, stolen, glyph: gr ? [+gr.left.toFixed(1), +gr.top.toFixed(1), +gr.width.toFixed(1)] : null });
  }
  return out;
}, { SELS: sels, scope });
(async () => {
  const { check, results, summary } = M.checker("hit-areas");
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const all = {};
  const errors = [];
  const clickIf = async (page, sel, wait = 900) => { const el = page.locator(sel); if (await el.count()) { await el.first().dispatchEvent("click"); await page.waitForTimeout(wait); return true; } return false; };
  try {
    for (const width of [375, 320]) for (const role of ["coach", "adult", "parent", "junior"]) {
      const db = freshDb();
      const ctx = await browser.newContext({ viewport: { width, height: 760 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
      const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
      page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
      const u = Object.values(db.users).find((x) => x.id === IDS[role]); await M.injectSession(page, M.session(u, db));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page); await page.waitForTimeout(800);
      const k = (s) => `${width}/${role}/${s}`;
      const feed = await page.locator('[data-tour="feed-header"]').count();
      all[k(feed ? "feed" : "home")] = await measure(page, feed ? '[data-tour="feed-header"]' : null);
      if (role === "parent") { await clickIf(page, '[aria-label="Lessons"]'); if (await page.locator('[data-tour="feed-header"]').count()) all[k("feed")] = await measure(page, '[data-tour="feed-header"]'); }
      await clickIf(page, '[aria-label="Diary"]', 1000);
      all[k("diary")] = await measure(page, null);
      await clickIf(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 800);
      all[k("diary-cal")] = await measure(page, null);
      await clickIf(page, '[data-tour="cal-view"] [aria-label="List"]', 500);
      if (await clickIf(page, '[aria-label="Alerts"]')) all[k("alerts")] = await measure(page, null);
      await ctx.close();
    }
    /* the register's Present and Absent, and the log's Set level, as the coach at both widths */
    for (const width of [375, 320]) {
      const db = freshDb();
      const ctx = await browser.newContext({ viewport: { width, height: 760 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
      const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
      page.on("pageerror", (e) => errors.push(`coach: ${String(e.message || e)}`));
      /* ten past four: the four o'clock lesson is running, so its peek carries the register and the log opens on its face */
      await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T16:10:00`));
      const u = Object.values(db.users).find((x) => x.id === IDS.coach); await M.injectSession(page, M.session(u, db));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page); await page.waitForTimeout(800);
      const k = (s) => `${width}/coach/${s}`;
      await page.locator("button", { hasText: "Maximiliano Murphy" }).first().click(); await page.waitForTimeout(900);
      if (await clickIf(page, '[data-tour="peek-register"]', 1000)) {
        const reg = await measure(page, "[data-sheet]", ['[data-tour="register-in"]', '[data-tour="register-out"]']);
        const rowH = await page.locator("[data-sheet] [data-reg-row]").first().evaluate((e) => Math.round(e.getBoundingClientRect().height)).catch(() => null);
        reg.forEach((m) => { m.rowH = rowH; }); all[k("register")] = reg;
        await page.screenshot({ path: path.join(outDir, `register-${width}.png`) });
        await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500);
      }
      await clickIf(page, '[data-tour="quick"]', 900); await clickIf(page, '[data-tour="quick-log"]', 900);
      if (await clickIf(page, '[data-tour="wiz-who"]', 700)) {
        const lg = await measure(page, null, ['[data-tour="wiz-stage"]']);
        const lineH = await page.locator('[data-tour="wiz-when"]').first().evaluate((e) => Math.round(e.parentElement.getBoundingClientRect().height)).catch(() => null);
        lg.forEach((m) => { m.lineH = lineH; }); all[k("log")] = lg;
        await page.screenshot({ path: path.join(outDir, `log-${width}.png`) });
      }
      await ctx.close();
    }
    fs.writeFileSync(path.join(outDir, "measure.json"), JSON.stringify(all, null, 1));
    const rows = Object.entries(all).flatMap(([k, v]) => v.map((m) => ({ k, ...m })));
    const fails = (pred) => rows.filter(pred).map((m) => `${m.k} ${m.sel} hit ${m.hit ? m.hit.slice(2).join("x") : "-"}`);
    const icon = (m) => /saved|search|alerts/.test(m.sel);
    const inFeed = (m) => /\/feed$/.test(m.k);
    const sq = (m) => /Back|month|agenda-edit/.test(m.sel);
    check("(a) every header control was found and measured, as each role at 375 and 320", rows.filter(icon).length >= 40 && rows.some((m) => /Back/.test(m.sel)) && rows.some((m) => /month/.test(m.sel)) && rows.some((m) => /agenda-edit/.test(m.sel)), `${rows.length} rows`);
    const a = fails((m) => icon(m) && !inFeed(m) && !(m.hit && m.hit[3] >= 44 && m.hit[2] >= 34));
    check("(b) Saved, Search and Alerts answer 44 tall and 34 or more wide in a screen's header", a.length === 0, a.slice(0, 4).join(" | "));
    const b = fails((m) => icon(m) && inFeed(m) && !(m.hit && m.hit[3] >= 44 && m.hit[2] >= 26));
    check("(c) …and 44 tall in the feed's pill, as wide as its 2px gap allows", b.length === 0, b.slice(0, 4).join(" | "));
    const c = fails((m) => /profile-pill/.test(m.sel) && !(m.hit && m.hit[3] >= 44));
    check("(d) the profile pill answers 44 tall", c.length === 0, c.slice(0, 4).join(" | "));
    const d = fails((m) => sq(m) && !(m.hit && m.hit[2] >= 44 && m.hit[3] >= 44));
    check("(e) Back, the month chevrons and the diary's pencil answer 44 square", d.length === 0, d.slice(0, 4).join(" | "));
    const e = rows.filter((m) => m.stolen > 0).map((m) => `${m.k} ${m.sel} stolen ${m.stolen}`);
    check("(f) no hit area reaches into another control", e.length === 0, e.slice(0, 4).join(" | "));
    const g = rows.filter((m) => icon(m) && m.glyph && Math.abs(m.glyph[2] - 21) > 0.5).map((m) => `${m.k} ${m.sel} ${m.glyph}`);
    check("(g) the glyphs are drawn as they were, 21 across", g.length === 0, g.slice(0, 4).join(" | "));
    const reg = rows.filter((m) => /\/register$/.test(m.k)), hFail = fails((m) => /\/register$/.test(m.k) && (!m.hit || m.hit[3] < 44 || m.stolen > 0));
    check("(h) the register's Present and Absent answer 44 tall and are drawn 44, inside the row's own 62, at 375 and 320", reg.length === 4 && hFail.length === 0 && reg.every((m) => m.box[3] >= 44 && m.rowH >= 62), `${hFail.slice(0, 4).join(" | ")} ${JSON.stringify(reg.map((m) => [m.k, m.box[3], m.hit && m.hit[3], m.rowH]))}`);
    const lg = rows.filter((m) => /\/log$/.test(m.k)), iFail = fails((m) => /\/log$/.test(m.k) && (!m.hit || m.hit[3] < 44 || m.stolen > 0));
    check("(i) the log's Set level answers 44 tall, and the line it sits on is still 30", lg.length === 2 && iFail.length === 0 && lg.every((m) => m.lineH != null && m.lineH <= 32), `${iFail.slice(0, 4).join(" | ")} ${JSON.stringify(lg.map((m) => [m.k, m.box[3], m.hit && m.hit[3], m.lineH]))}`);
    check("no page errors", errors.filter((x) => !/vibrate/.test(x)).length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
