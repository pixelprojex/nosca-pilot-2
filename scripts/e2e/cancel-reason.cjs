/* CANCEL REASON. The Cancel sheet promises the other side is told
   "straight away with the reason"; the reason used to be dropped on the
   floor and the notice read the day and the coach's name. Now it rides
   on the booking (bookings.cancel_reason) and leads the notice. This
   suite proves: the coach's peek Cancel with Something else and typed
   words (the words are the reason); the player's own Cancel in the
   diary asking why with no password and the coach's bell leading with
   it; a parent's for a child; the call-off from the plus carrying the
   reason on every row; and a project without the column still
   cancelling with the status alone and promising only that.
   Usage: node cancel-reason.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4332), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const BK = { cian: "b0000000-0000-4000-8000-00000000cc01", kid: "b0000000-0000-4000-8000-00000000cc02", today1: "b0000000-0000-4000-8000-00000000cc03", today2: "b0000000-0000-4000-8000-00000000cc04" };
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) });
  /* two today for the coach's peek and the call-off; one each ahead for the player and the child */
  M.addBooking(db, { id: BK.today1, coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 0), time: "4:00 pm", duration: 45 });
  M.addBooking(db, { id: BK.today2, coachId: IDS.coach, playerId: IDS.junior, date: dayPlus(db, 0), time: "5:00 pm", duration: 45 });
  M.addBooking(db, { id: BK.cian, coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 3), time: "10:00 am", duration: 45 });
  M.addBooking(db, { id: BK.kid, coachId: IDS.coach, playerId: IDS.junior, date: dayPlus(db, 4), time: "11:00 am", duration: 60 });
  return db;
}

const { check, results, summary } = M.checker("cancel-reason");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    /* nine in the morning, so today's four o'clock is still ahead */
    await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T09:00:00`));
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const dayOf = (iso) => Number(iso.slice(8, 10)), monthOf = (iso) => Number(iso.slice(5, 7));
  const openDay = async (page, db, iso) => {
    await tap(page, '[aria-label="Diary"]', 1000);
    if ((await page.locator('[data-tour="cal-view"] button[aria-pressed="true"]').getAttribute("aria-label")) !== "Calendar") await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 600);
    if (monthOf(iso) !== monthOf(dayPlus(db, 0))) await tap(page, '[aria-label="Next month"]', 600);
    await tap(page, `[data-day="${dayOf(iso)}"]`, 700);
  };
  const lastBtn = (page, re) => page.locator("button", { hasText: re }).last();
  const pw = (page) => page.locator('input[type="password"]');
  const sheetOpen = async (page) => (await page.locator("[data-sheet]").innerText()).trim().length > 0;
  const patches = (db, id) => db.patches.filter((x) => x.table === "bookings" && x.query.includes(`id=eq.${id}`));

  try {
    /* ---------- (a) the coach: Something else, in their own words ---------- */
    const db = freshDb();
    {
      const { ctx, page, text, shot } = await boot(db, "coach");
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.locator('[data-sheet] button', { hasText: /^Cancel$/ }).first().click(); await page.waitForTimeout(800);
      const t1 = await text(); await shot("01-coach-why");
      check("(a) the peek's Cancel asks why, promising the reason travels", /Cancel lesson/.test(t1) && /with the reason/.test(t1) && (await page.locator('[data-tour="cancel-why"]').count()) === 5, t1.slice(0, 240));
      await page.locator('[data-tour="cancel-why"]', { hasText: "Something else" }).click(); await page.waitForTimeout(400);
      check("(a) Something else opens a line to say it in", (await page.locator('[data-tour="cancel-note"] textarea').count()) === 1);
      await page.locator('[data-tour="cancel-note"] textarea').fill("Course flooded"); await page.waitForTimeout(200);
      await lastBtn(page, /^Next$/).click(); await page.waitForTimeout(700);
      await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(800);
      await pw(page).fill("secret12"); await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(1800);
      const p1 = patches(db, BK.today1).pop(); await shot("02-coach-cancelled");
      check("(a) the words typed are the reason on the row", !!p1 && p1.body.status === "cancelled" && p1.body.cancel_reason === "Course flooded" && p1.n === 1, JSON.stringify(p1));
      const told = db.notifications.find((n) => n.user_id === IDS.adult && n.title === "Lesson cancelled");
      check("(a) the player's notice leads with the reason, then the day — two facts, no coach's name", !!told && /^Course flooded · /.test(told.body) && !/Niamh/.test(told.body), JSON.stringify(told));
      check("(a) the sheet is closed and the row is off today", !(await sheetOpen(page)) && !/4:00 pm/.test(await text()), (await text()).slice(0, 160));
      await ctx.close();
    }
    /* ---------- (b) the player reads it in the bell ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "adult");
      await tap(page, '[aria-label="Alerts"]', 900);
      const t2 = await text(); await shot("03-player-bell");
      check("(b) the player's bell reads Lesson cancelled · Course flooded · the day", /Lesson cancelled/.test(t2) && /Course flooded · /.test(t2), t2.slice(0, 240));
      await ctx.close();
    }
    /* ---------- (c) the player's own Cancel asks why, no password ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "adult");
      await openDay(page, db, dayPlus(db, 3));
      const t3 = await text(); await shot("04-player-day");
      check("(c) the day shows Your lesson with Cancel and Reschedule", /Your lesson/.test(t3) && (await page.locator('[data-tour="day-cancel"]').count()) === 1 && (await page.locator('[data-tour="day-reschedule"]').count()) === 1, t3.slice(0, 240));
      await tap(page, '[data-tour="day-cancel"]', 800);
      const t4 = await text(); await shot("05-player-why");
      check("(c) Cancel opens the Why sheet naming the day, with the player's reasons and one button asleep", /Cancel lesson/.test(t4) && /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2} · 10:00 am/.test(t4) && /Work or school/.test(t4) && /your coach straight away with the reason/.test(t4) && (await lastBtn(page, /^Cancel the lesson$/).isDisabled()) && (await lastBtn(page, /^Next$/).count()) === 0, t4.slice(0, 260));
      check("(c) …and no password is asked of a player for their own lesson", (await pw(page).count()) === 0);
      /* Something else is a reason only once there are words */
      await page.locator('[data-tour="cancel-why"]', { hasText: "Something else" }).click(); await page.waitForTimeout(400);
      check("(c) Something else alone leaves the button asleep — the sheet promises the reason", (await lastBtn(page, /^Cancel the lesson$/).isDisabled()) && (await page.locator('[data-tour="cancel-note"] textarea').count()) === 1);
      await page.locator('[data-tour="cancel-note"] textarea').fill("Flat tyre"); await page.waitForTimeout(200);
      check("(c) …and wakes with words", !(await lastBtn(page, /^Cancel the lesson$/).isDisabled()));
      await page.locator('[data-tour="cancel-why"]', { hasText: "Away" }).click(); await page.waitForTimeout(300);
      await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(1800);
      const p3 = patches(db, BK.cian).pop(); await shot("06-player-cancelled");
      check("(c) one tap cancels with the reason on the row, nothing else changed", !!p3 && p3.by === IDS.adult && p3.body.status === "cancelled" && p3.body.cancel_reason === "Away" && Object.keys(p3.body).length === 2 && p3.n === 1, JSON.stringify(p3));
      const toCoach = db.notifications.find((n) => n.user_id === IDS.coach && n.title === "Cian Murphy cancelled");
      check("(c) the coach is told who, with the reason leading the line", !!toCoach && /^Away · /.test(toCoach.body), JSON.stringify(toCoach));
      check("(c) the sheet closes and the lesson is off the day", !(await sheetOpen(page)) && !/Your lesson/.test(await text()), (await text()).slice(0, 160));
      await ctx.close();
    }
    /* ---------- (d) a parent, for a child ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "parent");
      await tap(page, '[aria-label="Diary"]', 1000);
      if ((await page.locator('[data-tour="cal-view"] button[aria-pressed="true"]').getAttribute("aria-label")) !== "Calendar") await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 600);
      if (monthOf(dayPlus(db, 4)) !== monthOf(dayPlus(db, 0))) await tap(page, '[aria-label="Next month"]', 600);
      await tap(page, `[data-day="${dayOf(dayPlus(db, 4))}"]`, 700);
      const t5 = await text(); await shot("07-parent-day");
      check("(d) the parent opens on the child, the child's lesson on the day with Cancel", /Saoirse/.test(t5) && /11:00/.test(t5) && (await page.locator('[data-tour="day-cancel"]').count()) === 1, t5.slice(0, 240));
      await tap(page, '[data-tour="day-cancel"]', 800);
      const t6 = await text(); await shot("08-parent-why");
      check("(d) the sheet names the child and the day", /Cancel lesson/.test(t6) && /Saoirse · (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2} · 11:00 am/.test(t6), t6.slice(0, 240));
      await page.locator('[data-tour="cancel-why"]', { hasText: "Unwell" }).click(); await page.waitForTimeout(300);
      await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(700);
      check("(d) the toast names the child's coach, not the parent's own", /Niamh Byrne is told\./.test(await text()), (await text()).slice(0, 200));
      await page.waitForTimeout(1100);
      const p4 = patches(db, BK.kid).pop();
      check("(d) the child's booking is cancelled with the reason", !!p4 && p4.by === IDS.parent && p4.body.status === "cancelled" && p4.body.cancel_reason === "Unwell" && p4.n === 1, JSON.stringify(p4));
      const c4 = db.notifications.find((n) => n.user_id === IDS.coach && n.title === "Saoirse Kelly cancelled");
      const k4 = db.notifications.find((n) => n.user_id === IDS.junior && n.title === "Lesson cancelled");
      check("(d) the coach is told Saoirse cancelled · Unwell, and the child that their lesson is cancelled · Unwell", !!c4 && /^Unwell · /.test(c4.body) && !!k4 && /^Unwell · /.test(k4.body), JSON.stringify([c4, k4]));
      await ctx.close();
    }
    /* ---------- (e) the call-off from the plus carries the reason on every row ---------- */
    {
      const db2 = freshDb();
      const { ctx, page, text, shot } = await boot(db2, "coach");
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-weather"]', 900);
      await M.click(page, "Course closed", 400); await M.click(page, "Next", 700); await M.click(page, "Next", 700);
      await M.click(page, "Call off 2 lessons", 800);
      await pw(page).fill("secret12"); await lastBtn(page, /^Call off 2 lessons$/).click(); await page.waitForTimeout(2000);
      const p5 = db2.patches.filter((x) => x.table === "bookings").pop(); await shot("09-calloff");
      check("(e) Course closed cancels both with the reason on each row", !!p5 && p5.body.status === "cancelled" && p5.body.cancel_reason === "Course closed" && p5.n === 2, JSON.stringify(p5));
      const a5 = db2.notifications.find((n) => n.user_id === IDS.adult && n.title === "Lesson cancelled");
      const g5 = db2.notifications.find((n) => n.user_id === IDS.parent && /Saoirse's lesson cancelled/.test(n.title));
      check("(e) the player and the junior's adult both read the reason first", !!a5 && /^Course closed · /.test(a5.body) && !!g5 && /^Course closed · /.test(g5.body), JSON.stringify([a5, g5]));
      void text;
      await ctx.close();
    }
    /* ---------- (e2) Something else on the call-off has no words to send, so none go ---------- */
    {
      const db4 = freshDb();
      const { ctx, page, text } = await boot(db4, "coach");
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-weather"]', 900);
      await M.click(page, "Something else", 400); await M.click(page, "Next", 700); await M.click(page, "Next", 700);
      await M.click(page, "Call off 2 lessons", 800);
      await pw(page).fill("secret12"); await lastBtn(page, /^Call off 2 lessons$/).click(); await page.waitForTimeout(2000);
      const p6 = db4.patches.filter((x) => x.table === "bookings").pop();
      check("(e2) Something else from the call-off cancels with no reason on the row", !!p6 && p6.body.status === "cancelled" && !("cancel_reason" in p6.body) && p6.n === 2, JSON.stringify(p6));
      check("(e2) …and no notice reads Something else", db4.notifications.length > 0 && !db4.notifications.some((n) => /Something else/.test(n.body || "")), JSON.stringify(db4.notifications.map((n) => n.body)));
      void text;
      await ctx.close();
    }
    /* ---------- (g) the coach's diary: Cancel on a day's block opens the same Why ---------- */
    {
      const db5 = freshDb();
      const { ctx, page, text, shot } = await boot(db5, "coach");
      await openDay(page, db5, dayPlus(db5, 0));
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(600);
      const blk = page.locator('[data-tour="block-cancel"]');
      check("(g) the day's block unfolds with Cancel on it", (await blk.count()) >= 1, (await text()).slice(0, 200));
      if (await blk.count()) { await blk.first().click(); await page.waitForTimeout(800); }
      const t8 = await text(); await shot("11-diary-block-cancel");
      check("(g) …which opens the Why sheet, not nothing", /Cancel lesson/.test(t8) && (await page.locator('[data-tour="cancel-why"]').count()) === 5, t8.slice(0, 240));
      await ctx.close();
    }
    /* ---------- (f) a project without the column ---------- */
    {
      const db3 = freshDb(); db3.missingColumns = { bookings: ["cancel_reason"] };
      const { ctx, page, text, shot } = await boot(db3, "adult");
      await openDay(page, db3, dayPlus(db3, 3));
      await tap(page, '[data-tour="day-cancel"]', 800);
      const t7 = await text(); await shot("10-no-column-why");
      check("(f) the sheet still asks why but promises only what it can — no 'with the reason'", /Cancel lesson/.test(t7) && /your coach straight away\./.test(t7) && !/with the reason/.test(t7), t7.slice(0, 240));
      await page.locator('[data-tour="cancel-why"]', { hasText: "Unwell" }).click(); await page.waitForTimeout(300);
      await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(1800);
      const p7 = patches(db3, BK.cian).filter((x) => !x.refused).pop();
      check("(f) the cancel still lands, as the status alone", !!p7 && p7.body.status === "cancelled" && !("cancel_reason" in p7.body) && p7.n === 1 && !patches(db3, BK.cian).some((x) => x.refused), JSON.stringify(patches(db3, BK.cian)));
      const c7 = db3.notifications.find((n) => n.user_id === IDS.coach && n.title === "Cian Murphy cancelled");
      check("(f) the coach's notice is the day alone", !!c7 && !/Unwell/.test(c7.body) && /\d/.test(c7.body), JSON.stringify(c7));
      await ctx.close();
    }
    check("no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
