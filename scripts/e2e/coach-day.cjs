/* THE COACH'S DAY. What sits on the coach's home and the plus, and what
   the two destructive actions ask for: All lessons is its own row and
   not a chore under To do; the plus leads with Log a lesson and a red
   Call off beside it, in place of Message; the call-off and the peek's
   Cancel both end on the coach's password, a wrong one is refused with
   nothing written, and the right one writes the bookings and tells the
   players; every lesson row and feed card carries a Download disc that
   saves the lesson; the header sits clear of the phone's status bar.
   Usage: node coach-day.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4199), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", junior: "00000000-0000-4000-8000-00000000c41d", parent: "00000000-0000-4000-8000-000000pa4e07" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const TOMORROW = M.ymd(new Date(Date.now() + 864e5));
/* the app's own day label: Thu 24 Sep */
const dayLabel = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); const dt = new Date(y, m - 1, d);
  return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getDay()]} ${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]}`; };
const DANGER = "rgb(196, 52, 42)";           // #C4342A

function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addUser(db, { id: IDS.parent, email: "parent@t.ie" }); M.addUser(db, { id: IDS.junior, email: "junior@t.ie" });
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  M.addProfile(db, { id: IDS.parent, role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  M.addProfile(db, { id: IDS.junior, role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-01", focus: "Short game", subs: ["Chipping"], notes: "Cleaner contact from the fringe." });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: "Putting", subs: ["Lag putting"], notes: "Pace on the long ones first." });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-08-28", focus: "Grip", notes: "Left hand a touch stronger." });
  db.b1 = M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: TODAY, time: "10:30 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm", status: "requested" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TOMORROW, time: "11:00 am" });
  return db;
}

const { check, summary } = M.checker("coach-day");
const last = (arr, table) => arr.filter((x) => x.table === table).slice(-1)[0];

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db = freshDb()) => {
    const u = Object.values(db.users).find((x) => x.id === IDS.coach);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const text = () => M.rootText(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    const box = async (sel) => page.locator(sel).first().boundingBox();
    return { db, ctx, page, text, shot, box };
  };
  const { tap } = M;
  const pw = (page) => page.locator('input[type="password"]');
  /* the app's one Sheet stays mounted, translated off-screen: closed means empty */
  const sheetOpen = async (page) => (await page.locator("[data-sheet]").innerText()).trim().length > 0;
  const lastBtn = (page, re) => page.locator("button", { hasText: re }).last();

  try {
    /* ---------- (a) the home: All lessons on its own, the header clear of the top ---------- */
    {
      const { page, text, shot, box } = await boot();
      const t0 = await text(); await shot("01-coach-home");
      const face = await box('[aria-label="Your profile"]');
      check("(a) the header sits clear of the status bar (12px of air above it)", !!face && face.y >= 12, JSON.stringify(face));
      check("(a) All lessons is on the home, and No show is nowhere", t0.includes("All lessons") && !/no show/i.test(t0), t0.slice(0, 240));
      const own = await page.locator('[data-tour="today-archive"]').evaluate((el) => { const p = el.parentElement; return { n: p.children.length, txt: p.innerText }; }).catch(() => null);
      check("(a) All lessons is its own box, not a row under To do", !!own && own.n === 1 && !/To log|Asking|To do/.test(own.txt), JSON.stringify(own));
      await tap(page, '[data-tour="today-archive"]', 1000);
      const t1 = await text(); await shot("02-archive");
      check("(a) it opens the archive: Filter, List · Feed, and every lesson", t1.includes("Filter") && (await page.locator('[data-tour="archive-view"]').count()) === 1 && t1.includes("Short game") && t1.includes("Grip"), t1.slice(0, 240));
      /* (e) a Download disc on every row */
      const discs = await page.getByRole("button", { name: /^Download / }).count();
      check("(e) every archive row carries its own Download disc", discs === 3, String(discs));
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), page.getByRole("button", { name: /^Download Putting/ }).click()]);
      check("(e) the disc saves that lesson as a file", !!dl && /\.html$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : "no download");
      const html = dl ? fs.readFileSync(await dl.path(), "utf8") : "";
      check("(e) …the right lesson", html.includes("Putting") && html.includes("Pace on the long ones first."), html.slice(0, 120));
      /* the feed carries the same disc on each card */
      await page.locator('[data-tour="archive-view"] button', { hasText: "Feed" }).first().click(); await page.waitForTimeout(1200);
      await shot("03-archive-feed");
      const cards = await page.locator("[data-feed-card]").count();
      const cardDisc = await page.locator("[data-feed-card]").first().getByRole("button", { name: /^Download / }).count();
      check("(e) the feed's cards each carry a Download disc", cards >= 3 && cardDisc === 1, `${cards} cards · ${cardDisc} disc`);
      const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), page.locator("[data-feed-card]").first().getByRole("button", { name: /^Download / }).click()]);
      check("(e) …and it saves the lesson on the card", !!dl2 && /\.html$/.test(dl2.suggestedFilename()), dl2 ? dl2.suggestedFilename() : "no download");
      await page.context().close();
    }

    /* ---------- (b) the plus: Log a lesson full width, the eight two to a row, Call off in red among them ---------- */
    {
      const { db, page, text, shot, box } = await boot();
      await tap(page, '[data-tour="quick"]', 900);
      const t2 = await text(); await shot("04-plus");
      check("(b) the plus leads with Log a lesson, the eight carry Call off, and Message is gone", t2.includes("Log a lesson") && t2.includes("Call off") && !/\bMessage\b/.test(t2), t2.slice(0, 240));
      const log = await box('[data-tour="quick-log"]'), off = await box('[data-tour="quick-weather"]');
      const tiles = await page.locator('[data-tour^="quick-"]:not([data-tour="quick-log"])').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute("data-tour"), y: Math.round(r.y), w: Math.round(r.width) }; }));
      const rows = [...new Set(tiles.map((x) => x.y))];
      check("(b) Log a lesson is the full-width tile at the top and the eight sit two to a row under it", !!log && !!off && log.width > 300 && tiles.length === 8 && rows.length === 4 && rows.every((y) => tiles.filter((x) => x.y === y).length === 2) && off.y > log.y + log.height - 2, JSON.stringify({ log: log && [Math.round(log.y), Math.round(log.width)], rows, n: tiles.length }));
      const bg = await page.locator('[data-tour="quick-weather"]').evaluate((el) => getComputedStyle(el).backgroundColor);
      check("(b) Call off is red", bg === DANGER, bg);

      /* ---------- (c) Call off: a reason, the days, the lessons, the password ---------- */
      await tap(page, '[data-tour="quick-weather"]', 900);
      const t3 = await text(); await shot("05-calloff-why");
      check("(c) Call off asks why first, and never says weather call-off", t3.includes("Call off") && t3.includes("Weather") && t3.includes("Unwell") && !t3.includes("Weather call-off"), t3.slice(0, 200));
      await M.click(page, "Weather", 400); await M.click(page, "Next", 700);
      const t4 = await text(); await shot("05b-calloff-days");
      const dayTiles = page.getByRole("button", { name: /· \d lessons?$/ });
      check("(c) then which days: every day ahead with lessons, as tiles carrying their count", t4.includes("Which days") && (await dayTiles.count()) === 2 && (await page.getByRole("button", { name: `${dayLabel(TODAY)} · 3 lessons` }).count()) === 1 && (await page.getByRole("button", { name: `${dayLabel(TOMORROW)} · 1 lesson` }).count()) === 1, t4.slice(0, 200));
      /* today is already picked; add tomorrow — as many days as you like */
      await page.getByRole("button", { name: `${dayLabel(TOMORROW)} · 1 lesson` }).click(); await page.waitForTimeout(300);
      await M.click(page, "Next", 700);
      const t5 = await text(); await shot("05c-calloff-which");
      const ticks = page.locator('[data-sheet] button[aria-pressed]');
      check("(c) then which lessons: both days, every lesson ticked", t5.includes("Which lessons") && t5.includes(dayLabel(TODAY)) && t5.includes(dayLabel(TOMORROW)) && (await ticks.count()) === 4 && (await page.locator('[data-sheet] button[aria-pressed="true"]').count()) === 4 && t5.includes("Call off 4 lessons"), t5.slice(0, 240));
      await ticks.filter({ hasText: /4:00/ }).click(); await page.waitForTimeout(300);
      check("(c) unticking one keeps it, and the button counts the rest", (await text()).includes("Call off 3 lessons") && (await page.locator('[data-sheet] button[aria-pressed="false"]').count()) === 1, (await text()).slice(0, 200));
      await M.click(page, "Call off 3 lessons", 800);
      const t6 = await text(); await shot("06-calloff-password");
      check("(c) …then asks for the password", t6.includes("3 lessons will be called off") && t6.includes("Your password") && (await pw(page).count()) === 1, t6.slice(0, 240));
      await pw(page).fill("wrongone"); await lastBtn(page, /^Call off 3 lessons$/).click(); await page.waitForTimeout(900);
      check("(c) a wrong password is refused, and nothing is written", (await text()).includes("That password isn't right.") && !db.patches.some((x) => x.table === "bookings"), (await text()).slice(0, 200));
      await pw(page).fill("secret12"); await lastBtn(page, /^Call off 3 lessons$/).click(); await page.waitForTimeout(700);
      const t7 = await text(); await shot("07-calledoff");
      check("(c) the right one is answered with the Called off moment", t7.includes("Called off") && /3 lessons/.test(t7), t7.slice(0, 200));
      await page.waitForTimeout(1600);
      const c1 = last(db.patches, "bookings");
      check("(c) the three go in one write, as weather, by id", !!c1 && c1.body.status === "weather" && /id=in\./.test(c1.query) && c1.n === 3, JSON.stringify(c1));
      check("(c) …and every player is told", db.notifications.some((n) => n.user_id === IDS.adult && n.kind === "weather") && db.notifications.some((n) => n.user_id === IDS.junior && n.kind === "weather") && db.notifications.some((n) => n.user_id === IDS.parent), JSON.stringify(db.notifications.map((n) => [n.user_id.slice(-4), n.title])));
      const t8 = await text();
      check("(c) the sheet is gone; the kept lesson stays and the rest are off the day", !(await sheetOpen(page)) && /4:00 pm/.test(t8) && !/9:00 am|10:30 am/.test(t8), t8.slice(0, 200));
      await page.context().close();
    }

    /* ---------- (c2) any other reason is a cancellation ---------- */
    {
      const { db, page, text } = await boot();
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-weather"]', 900);
      await M.click(page, "Unwell", 400); await M.click(page, "Next", 700); await M.click(page, "Next", 700);
      await M.click(page, "Call off 3 lessons", 800);
      await pw(page).fill("secret12"); await lastBtn(page, /^Call off 3 lessons$/).click(); await page.waitForTimeout(2000);
      const c2 = last(db.patches, "bookings");
      check("(c2) Unwell calls today off as cancelled, and the players are told", !!c2 && c2.body.status === "cancelled" && c2.n === 3 && db.notifications.some((n) => n.user_id === IDS.adult && n.title === "Lesson cancelled"), JSON.stringify(c2) + " " + JSON.stringify(db.notifications.map((n) => n.title)));
      check("(c2) no page errors so far", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 2).join(" | "));
      void text;
      await page.context().close();
    }

    /* ---------- (d) Cancel on the peek: Keep it, a wrong password, the right one ---------- */
    {
      const { db, page, text, shot } = await boot();
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const t6 = await text(); await shot("08-peek");
      check("(d) the peek offers Cancel, not No show", (await sheetOpen(page)) && /Cancel/.test(t6) && !/No show/i.test(t6), t6.slice(0, 240));
      await page.locator('[data-sheet] button', { hasText: /^Cancel$/ }).first().click(); await page.waitForTimeout(800);
      const t7 = await text(); await shot("09-cancel-password");
      check("(d) Cancel asks for the password, naming the lesson, with Keep it as the way back", t7.includes("Cancel this lesson") && t7.includes("Cian Murphy") && t7.includes("Keep it") && (await pw(page).count()) === 1, t7.slice(0, 240));
      await M.click(page, "Keep it", 900); await shot("09b-kept");
      check("(d) Keep it closes it with nothing written", !(await sheetOpen(page)) && !db.patches.some((x) => x.table === "bookings"), `open ${await sheetOpen(page)} · patches ${JSON.stringify(db.patches.filter((x) => x.table === "bookings"))}`);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.locator('[data-sheet] button', { hasText: /^Cancel$/ }).first().click(); await page.waitForTimeout(800);
      await pw(page).fill("wrongone"); await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(900);
      check("(d) a wrong password is refused, and nothing is written", (await text()).includes("That password isn't right.") && !db.patches.some((x) => x.table === "bookings"), (await text()).slice(0, 200));
      await pw(page).fill("secret12"); await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(1800);
      const c2 = last(db.patches, "bookings"); await shot("10-cancelled");
      check("(d) the right one cancels that one booking", !!c2 && c2.body.status === "cancelled" && c2.query.includes(`id=eq.${db.b1.id}`) && c2.n === 1, JSON.stringify(c2));
      check("(d) …the player is told, and the row is gone", db.notifications.some((n) => n.user_id === IDS.adult && n.title === "Lesson cancelled") && !(await text()).includes("9:00 am"), (await text()).slice(0, 200));
      await page.context().close();
    }
    /* ---------- (g) the log takes more than one area worked on ---------- */
    {
      const { db, page, text } = await boot();
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
      await page.locator('[data-tour="wiz-who"]').first().click(); await page.waitForTimeout(500);
      /* dictation that cannot start says why — here a mic with no microphone behind it */
      await page.evaluate(() => { window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onerror && this.onerror({ error: "audio-capture" }), 50); } stop() {} }; window.SpeechRecognition = window.webkitSpeechRecognition; });
      await page.locator('[aria-label="Dictate"]').first().click(); await page.waitForTimeout(800);
      check("(g) a mic that cannot start says why — No microphone found — rather than going quiet", /No microphone found/.test(await text()), (await text()).slice(0, 200));
      await page.getByRole("button", { name: "Chipping", exact: true }).click(); await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Putting", exact: true }).click(); await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Full swing", exact: true }).click(); await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Full swing", exact: true }).click(); await page.waitForTimeout(200);   /* and off again */
      await page.getByRole("button", { name: "Log it", exact: true }).click(); await page.waitForTimeout(1500);
      const lp = db.posts.filter((x) => x.table === "lessons").pop(); const lrow = lp && lp.rows[0];
      check("(g) two areas tapped are both on the lesson, joined with a dot; a third tapped twice is not", !!lrow && lrow.focus.split(" · ").sort().join(",") === "Chipping,Putting", JSON.stringify(lrow && lrow.focus));
      check("(g) …and the row reads both", /Chipping · Putting|Putting · Chipping/.test(await text()), (await text()).slice(0, 200));
      await page.context().close();
    }
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    check("run completed", false, String(e && e.message || e));
  } finally { await browser.close(); M.stopServer(server); }

  const real = errors.filter((e) => !/vibrate/.test(e));
  check("(f) no page errors as coach", real.length === 0, real.slice(0, 3).join(" | "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "coach-day.json"), JSON.stringify(out, null, 2));
  process.exit(0);
})();
