/* A DRILL WITH A DAY. The coach's Set-drills sheet carries By — the
   player's next lesson when one is booked, else no day, or tomorrow, a
   week, two weeks — the day rides in the notification's body, and the
   player's Drills puts the dated ones first with the day on the row
   (By Thu 8 Oct · By today · Was by Fri 2 Oct in the warning colour).
   A project whose table has no `due` column yet shows no By row and
   still saves the drill. Usage: node drills-due.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4395), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
const day = (n) => M.ymd(new Date(Date.now() + n * 86400000));
const TODAY = day(0), NEXT = day(5), YESTERDAY = day(-1);
const nice = (iso) => { const d = new Date(iso); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`; };
function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: NEXT, time: "10:00 am", status: "confirmed" });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Towel drill", done: false });
  const late = M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Clock drill", done: false }); late.due = YESTERDAY;
  return db;
}

const { check, results, summary } = M.checker("drills-due");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const openSheet = async (page) => {
    await tap(page, '[aria-label="Roster"]', 700);
    await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
    await page.locator('[data-tour="player-actions"] button', { hasText: "Drills" }).first().click(); await page.waitForTimeout(900);
  };

  try {
    const db = freshDb();
    /* ---------- the coach sets a drill for the next lesson ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openSheet(page);
      const byRow = page.locator('[data-tour="assign-due"]');
      check("(a) the Set-drills sheet carries By, opening on the player's next lesson", (await byRow.count()) === 1 && new RegExp(`Next lesson · ${nice(NEXT)}`).test(M.norm(await byRow.innerText())), M.norm((await byRow.count()) ? await byRow.innerText() : "none"));
      await byRow.locator("button").first().click(); await page.waitForTimeout(400);
      const opts = M.norm(await byRow.innerText());
      check("(b) …and offers No day, Tomorrow, In a week and In two weeks, each a named day", /No day/.test(opts) && /Tomorrow · /.test(opts) && /In a week · /.test(opts) && /In two weeks · /.test(opts), opts.slice(0, 200));
      await byRow.getByRole("button", { name: new RegExp(`^Next lesson`) }).first().click(); await page.waitForTimeout(300);
      await shot("01-by-row");
      await page.getByText("Gate drill", { exact: true }).first().click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: /^Set 1 drill/ }).first().click(); await page.waitForTimeout(1200);
      const row = db.drills.find((d) => d.title === "Gate drill" && d.player_id === IDS.adult);
      check("(c) the drill is written with its day", !!row && row.due === NEXT, JSON.stringify(row && { title: row.title, due: row.due }));
      const n = db.notifications.filter((x) => x.user_id === IDS.adult && x.kind === "drill").slice(-1)[0];
      check("(d) the player's notification carries the day in its body", !!n && n.title === "New drill" && new RegExp(`^Gate drill · by ${nice(NEXT)} · Niamh Byrne$`).test(n.body), n ? `${n.title} / ${n.body}` : "none");
      await ctx.close();
    }
    /* ---------- the player reads the days ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "adult");
      await tap(page, '[aria-label="Drills"]', 900);
      const rows = await page.locator('[data-tour="drill-row"], [data-drill-due], .nsc-list button').allInnerTexts();
      const names = rows.map(M.norm).filter(Boolean);
      check("(e) the dated drills come first, soonest first, the undated after", names.length >= 3 && /^Clock drill/.test(names[0]) && /^Gate drill/.test(names[1]) && /^Towel drill/.test(names[2]), JSON.stringify(names));
      check("(f) a drill for a day gone by, not done, reads Was by that day; the next lesson's reads By it", new RegExp(`Was by ${nice(YESTERDAY)}`).test(names[0]) && new RegExp(`By ${nice(NEXT)}`).test(names[1]) && !/By /.test(names[2]), JSON.stringify(names));
      const lateColor = await page.locator('.nsc-list button').first().locator("span", { hasText: /^Was by/ }).first().evaluate((el) => getComputedStyle(el).color);
      check("(g) the gone-by line is in the warning colour", /rgb\((1[89]\d|2\d\d), ?\d+, ?\d+\)/.test(lateColor), lateColor);
      check("(h) no hairline inside the boxed rows", (await page.locator('.nsc-list > div > button').evaluateAll((els) => els.filter((el) => parseFloat(getComputedStyle(el).borderBottomWidth) > 0).length)) === 0);
      await shot("02-player-drills");
      await ctx.close();
    }
    /* ---------- a project whose table has no day yet ---------- */
    {
      const db2 = freshDb(); db2.missingColumns = { drills: ["due"] };
      const { ctx, page } = await boot(db2, "coach");
      await openSheet(page);
      check("(i) with no due column the sheet shows no By row", (await page.locator('[data-tour="assign-due"]').count()) === 0);
      await page.getByText("Gate drill", { exact: true }).first().click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: /^Set 1 drill/ }).first().click(); await page.waitForTimeout(1200);
      const row = db2.drills.find((d) => d.title === "Gate drill" && d.player_id === IDS.adult);
      const posted = db2.posts.filter((p) => p.table === "drills" && !p.refused).slice(-1)[0];
      check("(j) …and the drill still saves, with no day sent", !!row && !!posted && posted.rows.every((r) => !("due" in r) || r.due == null) && !db2.posts.some((p) => p.table === "drills" && p.refused), JSON.stringify(posted && posted.rows.map((r) => Object.keys(r))));
      await ctx.close();
    }
    check("(k) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
