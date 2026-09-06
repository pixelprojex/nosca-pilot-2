/* NOTIFICATIONS. The table is written by the database's triggers (the
   mock does the same); the app reads it for the bell, shows what landed
   while it was closed once on opening, marks read, clears, and routes a
   tap to the thing itself. ?open=<screen> from the service worker lands
   the same way.
   Usage: node notifications.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4303), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", eoin: "00000000-0000-4000-8000-000000e01e01" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const LESSON = { new: "10000000-0000-4000-8000-00000000ae01", old: "10000000-0000-4000-8000-00000000ae02" };
const N = { lesson: "aa000000-0000-4000-8000-0000000000a1", message: "aa000000-0000-4000-8000-0000000000a2", booking: "aa000000-0000-4000-8000-0000000000a3" };
const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString();

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  M.addLesson(db, { id: LESSON.new, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-01", focus: "Short game", subs: ["Chipping"], notes: "Cleaner contact from the fringe." });
  M.addLesson(db, { id: LESSON.old, coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: "Putting", notes: "Pace on the long ones first." });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "See you Tuesday at nine.", createdAt: ago(90) });
  /* what the triggers wrote while Cian was away — three unread */
  M.addNotification(db, { id: N.lesson, userId: IDS.adult, kind: "lesson", title: "New lesson logged", body: "Short game · Niamh Byrne", data: { screen: "lesson", id: LESSON.new }, createdAt: ago(120) });
  M.addNotification(db, { id: N.message, userId: IDS.adult, kind: "message", title: "Niamh Byrne", body: "See you Tuesday at nine.", data: { screen: "thread", id: IDS.adult }, createdAt: ago(90) });
  M.addNotification(db, { id: N.booking, userId: IDS.adult, kind: "booking", title: "Lesson confirmed", body: "Tue 08 Sep 9:00 am · Niamh Byrne", data: { screen: "calendar", id: "b0" }, createdAt: ago(30) });
  /* a player asking the coach: the request and the notification the trigger writes with it */
  M.addRequest(db, { playerId: IDS.eoin, coachId: IDS.coach, notify: true });
  return db;
}

const { check, results, summary } = M.checker("notifications");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async (role, { url = BASE } = {}) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(url, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false });
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap, byText, click } = M;
  const catchup = (page) => page.locator('[data-tour="catchup-list"]');
  const alertsList = (page) => page.locator('[data-tour="alerts-list"]');
  /* each row sits in a swipe wrapper with its own Clear button; the rows are the rest */
  const alertRows = (page) => alertsList(page).locator("button").filter({ hasNotText: /^Clear$/ });
  const readPatches = () => db.patches.filter((x) => x.table === "notifications");

  try {
    /* ---------- (a) three unread: the catch-up, a tap goes to the lesson ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      const t0 = await text(); await shot("01-adult-catchup");
      const rows = catchup(page).locator("button");
      check("(a) opening with unread notifications shows the catch-up over everything", (await catchup(page).count()) === 1 && /while you were away/i.test(t0) && t0.includes("3 things happened"), t0.slice(0, 200));
      check("(a) it lists the three, newest first, with their bodies", (await rows.count()) === 3 && /Lesson confirmed/.test(await rows.nth(0).innerText()) && /Niamh Byrne/.test(await rows.nth(1).innerText()) && /New lesson logged/.test(await rows.nth(2).innerText()) && t0.includes("Short game · Niamh Byrne"), t0.slice(0, 300));
      await rows.filter({ hasText: "New lesson logged" }).first().click(); await page.waitForTimeout(1200);
      const t1 = await text(); await shot("02-adult-lesson-from-catchup");
      check("(a) tapping a lesson notification lands on that lesson", (await catchup(page).count()) === 0 && t1.includes("Short game") && t1.includes("Cleaner contact from the fringe.") && (await page.locator('button', { hasText: "Download lesson log" }).count()) === 1, t1.slice(0, 200));
      const p1 = readPatches()[0];
      check("(a) …and marks only that one read (PATCH id=in.(…) read_at=is.null)", !!p1 && p1.body.read_at && /id=in\.%28|id=in\.\(/.test(p1.query) && p1.query.includes(N.lesson) && !p1.query.includes(N.message) && p1.query.includes("read_at=is.null") && p1.n === 1, p1 ? p1.query : "no PATCH");
      await M.back(page);
      check("(a) the bell now counts the two still unread", (await M.bellCount(page)) === 2, String(await M.bellCount(page)));
      await tap(page, '[aria-label="Alerts"]', 900);
      const t2 = await text(); await shot("03-adult-alerts");
      check("(a) the bell opens the list of all three, read and unread", (await alertRows(page).count()) === 3 && t2.includes("New lesson logged") && t2.includes("Lesson confirmed") && t2.includes("See you Tuesday at nine."), t2.slice(0, 240));
      await alertRows(page).filter({ hasText: "See you Tuesday" }).first().click(); await page.waitForTimeout(1200);
      const t3 = await text(); await shot("04-adult-thread-from-alert");
      /* the notification carries the player's id; the thread is the one with their coach */
      check("(a) tapping a message notification opens the player's real thread with the coach (not an empty one)", t3.includes("Niamh Byrne") && t3.includes("See you Tuesday at nine.") && !t3.includes("No messages yet") && (await page.locator('input[placeholder="Message"]').count()) === 1, t3.slice(0, 200));
      check("(a) …and marks that one read", readPatches().length === 2 && readPatches()[1].query.includes(N.message) && db.notifications.find((n) => n.id === N.message).read_at, JSON.stringify(readPatches().map((p) => p.query)));
      await ctx.close();
    }

    /* ---------- (b) one left: Carry on marks it, a fresh open shows nothing, Clear all deletes ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      const t0 = await text(); await shot("05-adult-catchup-one");
      check("(b) the next open shows only what is still unread", (await catchup(page).count()) === 1 && t0.includes("One thing happened") && t0.includes("Lesson confirmed") && !t0.includes("New lesson logged"), t0.slice(0, 200));
      await click(page, "Carry on", 1000);
      const p = readPatches().slice(-1)[0];
      check("(b) Carry on PATCHes read_at for everything unread", !!p && p.body.read_at && p.query.includes(N.booking) && p.query.includes("read_at=is.null") && p.n === 1 && db.notifications.filter((n) => n.user_id === IDS.adult && !n.read_at).length === 0, p ? p.query : "no PATCH");
      check("(b) the bell reads 0", (await M.bellCount(page)) === 0 && (await page.locator('[aria-label="Alerts"] span').count()) === 0, String(await M.bellCount(page)));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false });
      const t1 = await text(); await shot("06-adult-no-catchup");
      check("(b) a fresh open with nothing unread shows no catch-up", (await catchup(page).count()) === 0 && !t1.includes("While you were away"), t1.slice(0, 120));
      await tap(page, '[aria-label="Alerts"]', 900);
      const t2 = await text();
      check("(b) the list still holds the three, now read, with Clear all", (await alertRows(page).count()) === 3 && (await byText(page, "Clear all").count()) === 1, t2.slice(0, 200));
      await click(page, "Clear all", 1200);
      const del = db.deletes.find((d) => d.table === "notifications");
      const t3 = await text(); await shot("07-adult-cleared");
      check("(b) Clear all DELETEs the person's notifications and the list says All clear", !!del && del.query.includes(`user_id=eq.${IDS.adult}`) && del.rows.length === 3 && db.notifications.filter((n) => n.user_id === IDS.adult).length === 0 && t3.includes("All clear"), del ? del.query : "no DELETE");
      check("(b) nobody else's rows went with them", db.notifications.some((n) => n.user_id === IDS.coach), String(db.notifications.length));
      await ctx.close();
    }

    /* ---------- (c) the coach: a request under the catch-up and under jobs ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      const t0 = await text(); await shot("08-coach-catchup");
      check("(c) the coach's catch-up names who asked to join", (await catchup(page).count()) === 1 && t0.includes("Eoin Walsh asked to join you"), t0.slice(0, 200));
      await catchup(page).locator("button", { hasText: "asked to join you" }).first().click(); await page.waitForTimeout(1200);
      const t1 = await text(); await shot("09-coach-requests-from-catchup");
      check("(c) tapping it lands on Requests with the asker", t1.includes("Requests") && t1.includes("Eoin Walsh") && (await byText(page, "Accept").count()) === 1, t1.slice(0, 200));
      await M.back(page);
      await tap(page, '[aria-label="Alerts"]', 900);
      const t2 = await text(); await shot("10-coach-alerts");
      /* the notification row IS the door — a strip above it counting the
         same rows was the screen saying it twice */
      const job = page.locator("button", { hasText: "Eoin Walsh asked to join you" }).first();
      check("(c) the alerts list names the person asking to join, once", (await job.count()) === 1 && !/asking to join you/.test(t2) && t2.includes("Eoin Walsh asked to join you"), t2.slice(0, 240));
      await job.click(); await page.waitForTimeout(900);
      const t3 = await text();
      check("(c) the row opens Requests", t3.includes("Requests") && t3.includes("Eoin Walsh"), t3.slice(0, 160));
      await ctx.close();
    }

    /* ---------- (d) ?open=family on load ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult", { url: `${BASE}/?open=family` });
      await page.waitForTimeout(800);
      const t0 = await text(); await shot("11-adult-open-family");
      check("(d) ?open=family opens the Family screen and leaves the address bar clean", t0.includes("No family yet") && (await page.locator('[data-tour="family-setup"]').count()) === 1 && !/open=/.test(page.url()), `${page.url()} · ${t0.slice(0, 160)}`);
      await ctx.close();
    }
    {
      const { ctx, page, text, shot } = await boot("junior", { url: `${BASE}/?open=family` });
      await page.waitForTimeout(800);
      const t0 = await text(); await shot("12-junior-open-family");
      check("(d) …for a junior in a family it is the family dashboard", t0.includes("Orla's family") && (await page.locator('[data-tour="family-people"]').count()) === 1, t0.slice(0, 160));
      await ctx.close();
    }
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    results.push({ name: "run completed", ok: false, detail: String(e && e.message || e) });
  } finally { await browser.close(); M.stopServer(server); }

  const real = errors.filter((e) => !/vibrate/.test(e));
  check("no page errors", real.length === 0, real.slice(0, 3).join(" | "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ ...out, log: db.log.slice(-300) }, null, 2));
  process.exit(0);
})();
