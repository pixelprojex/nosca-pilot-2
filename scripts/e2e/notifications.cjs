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
const N = { lesson: "aa000000-0000-4000-8000-0000000000a1", message: "aa000000-0000-4000-8000-0000000000a2", booking: "aa000000-0000-4000-8000-0000000000a3", booking2: "aa000000-0000-4000-8000-0000000000a4", land: "aa000000-0000-4000-8000-0000000000a5", gone: "aa000000-0000-4000-8000-0000000000a6", remind: "aa000000-0000-4000-8000-0000000000a7", late: "aa000000-0000-4000-8000-0000000000a8", lost: "aa000000-0000-4000-8000-0000000000a9", kid: "aa000000-0000-4000-8000-0000000000b0" };
const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString();
/* minutes ago but never before today's midnight (the order kept), and yesterday at noon: a day's head
   that does not move when the suite runs just after midnight */
const todayAgo = (mins) => { const mid = new Date(); mid.setHours(0, 0, 30, 0); return new Date(Math.max(Date.now() - mins * 60000, mid.getTime() + (1440 - mins) * 10)).toISOString(); };
const yesterdayNoon = () => { const x = new Date(); x.setDate(x.getDate() - 1); x.setHours(12, 0, 0, 0); return x.toISOString(); };

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
  M.addNotification(db, { id: N.lesson, userId: IDS.adult, kind: "lesson", title: "Lesson logged", body: "Short game · Niamh Byrne", data: { screen: "lesson", id: LESSON.new }, createdAt: ago(120) });
  M.addNotification(db, { id: N.message, userId: IDS.adult, kind: "message", title: "Niamh Byrne", body: "See you Tuesday at nine.", data: { screen: "thread", id: IDS.adult }, createdAt: ago(90) });
  M.addNotification(db, { id: N.booking, userId: IDS.adult, kind: "booking", title: "Lesson confirmed", body: "Tue 8 Sep 9:00 am · Niamh Byrne", data: { screen: "calendar", id: "b0" }, createdAt: ago(30) });
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
  const readPatchesOf = (d) => d.patches.filter((x) => x.table === "notifications");

  try {
    /* ---------- (a) three unread: the catch-up, a tap goes to the lesson ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      const t0 = await text(); await shot("01-adult-catchup");
      const rows = catchup(page).locator("button");
      /* the catch-up is the app's one sheet since 28 November, headed with its count ("3 new"); it was a dark
         takeover reading "3 things happened" */
      check("(a) opening with unread notifications shows the catch-up, in the app's one sheet", (await catchup(page).count()) === 1 && (await page.locator('[data-sheet] [data-tour="catchup-list"]').count()) === 1 && /while you were away/i.test(t0) && t0.includes("3 new"), t0.slice(0, 200));
      check("(a) it lists the three, newest first, with their bodies", (await rows.count()) === 3 && /Lesson confirmed/.test(await rows.nth(0).innerText()) && /Niamh Byrne/.test(await rows.nth(1).innerText()) && /Lesson logged/.test(await rows.nth(2).innerText()) && t0.includes("Short game · Niamh Byrne"), t0.slice(0, 300));
      await rows.filter({ hasText: "Lesson logged" }).first().click(); await page.waitForTimeout(1200);
      const t1 = await text(); await shot("02-adult-lesson-from-catchup");
      check("(a) tapping a lesson notification lands on that lesson", (await catchup(page).count()) === 0 && t1.includes("Short game") && t1.includes("Cleaner contact from the fringe.") && (await page.locator('button', { hasText: "Download" }).count()) === 1, t1.slice(0, 200));
      const p1 = readPatches()[0];
      check("(a) …and marks only that one read (PATCH id=in.(…) read_at=is.null)", !!p1 && p1.body.read_at && /id=in\.%28|id=in\.\(/.test(p1.query) && p1.query.includes(N.lesson) && !p1.query.includes(N.message) && p1.query.includes("read_at=is.null") && p1.n === 1, p1 ? p1.query : "no PATCH");
      await M.back(page);
      check("(a) the bell now counts the two still unread", (await M.bellCount(page)) === 2, String(await M.bellCount(page)));
      await tap(page, '[aria-label="Alerts"]', 900);
      const t2 = await text(); await shot("03-adult-alerts");
      check("(a) the bell opens the list of all three, read and unread", (await alertRows(page).count()) === 3 && t2.includes("Lesson logged") && t2.includes("Lesson confirmed") && t2.includes("See you Tuesday at nine."), t2.slice(0, 240));
      await alertRows(page).filter({ hasText: "See you Tuesday" }).first().click(); await page.waitForTimeout(1200);
      const t3 = await text(); await shot("04-adult-thread-from-alert");
      /* the notification carries the player's id; the thread is the one with their coach */
      check("(a) tapping a message notification opens the player's real thread with the coach (not an empty one)", t3.includes("Niamh Byrne") && t3.includes("See you Tuesday at nine.") && !t3.includes("No messages yet") && (await page.locator('input[placeholder="Message"]').count()) === 1, t3.slice(0, 200));
      check("(a) …and marks that one read", readPatches().some((p) => p.query.includes(N.message)) && db.notifications.find((n) => n.id === N.message).read_at, JSON.stringify(readPatches().map((p) => p.query)));
      /* the bell reads itself: closing the list marks what it showed as read */
      check("(a) leaving the list marks the rest read, so the bell counts nothing", db.notifications.filter((n) => n.user_id === IDS.adult && !n.read_at).length === 0 && (await M.bellCount(page)) === 0, JSON.stringify(readPatches().map((p) => p.query)));
      await ctx.close();
    }

    /* ---------- (b) one new thing: Dismiss marks it, a fresh open shows nothing, Clear all deletes ---------- */
    {
      /* a booking confirmed while they were away */
      M.addNotification(db, { id: N.booking2, userId: IDS.adult, kind: "booking", title: "Lesson confirmed", body: "Thu 24 Sep · 10:00 am", data: { screen: "calendar", id: "b1" }, createdAt: ago(1) });
      const { ctx, page, text, shot } = await boot("adult");
      const t0 = await text(); await shot("05-adult-catchup-one");
      check("(b) the next open shows only what is still unread", (await catchup(page).count()) === 1 && t0.includes("1 new") && t0.includes("Lesson confirmed") && !t0.includes("Lesson logged"), t0.slice(0, 200));
      /* the one key is Done since 28 November (it was Dismiss on the dark takeover) */
      await page.locator('[data-tour="catchup-done"]').click(); await page.waitForTimeout(1000);
      const p = readPatches().slice(-1)[0];
      check("(b) Done PATCHes read_at for everything unread", !!p && p.body.read_at && p.query.includes(N.booking2) && p.query.includes("read_at=is.null") && p.n === 1 && db.notifications.filter((n) => n.user_id === IDS.adult && !n.read_at).length === 0, p ? p.query : "no PATCH");
      check("(b) the bell reads 0", (await M.bellCount(page)) === 0 && (await page.locator('[aria-label="Alerts"] span:not([aria-hidden="true"])').count()) === 0, String(await M.bellCount(page)));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false });
      const t1 = await text(); await shot("06-adult-no-catchup");
      check("(b) a fresh open with nothing unread shows no catch-up", (await catchup(page).count()) === 0 && !t1.includes("While you were away"), t1.slice(0, 120));
      await tap(page, '[aria-label="Alerts"]', 900);
      const t2 = await text();
      check("(b) the list still holds the four, now read, with Clear all", (await alertRows(page).count()) === 4 && (await byText(page, "Clear all").count()) === 1, t2.slice(0, 200));
      await click(page, "Clear all", 1200);
      const del = db.deletes.find((d) => d.table === "notifications");
      const t3 = await text(); await shot("07-adult-cleared");
      check("(b) Clear all DELETEs the person's notifications and the list says All clear", !!del && del.query.includes(`user_id=eq.${IDS.adult}`) && del.rows.length === 4 && db.notifications.filter((n) => n.user_id === IDS.adult).length === 0 && t3.includes("All clear"), del ? del.query : "no DELETE");
      check("(b) nobody else's rows went with them", db.notifications.some((n) => n.user_id === IDS.coach), String(db.notifications.length));
      await ctx.close();
    }

    /* ---------- (c) the coach: a request under the catch-up and under jobs ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      const t0 = await text(); await shot("08-coach-catchup");
      check("(c) the coach's catch-up names who asked to join", (await catchup(page).count()) === 1 && t0.includes("Eoin Walsh asked to join"), t0.slice(0, 200));
      await catchup(page).locator("button", { hasText: "asked to join" }).first().click(); await page.waitForTimeout(1200);
      const t1 = await text(); await shot("09-coach-requests-from-catchup");
      check("(c) tapping it lands on Requests with the asker", t1.includes("Requests") && t1.includes("Eoin Walsh") && (await byText(page, "Accept").count()) === 1, t1.slice(0, 200));
      await M.back(page);
      await tap(page, '[aria-label="Alerts"]', 900);
      const t2 = await text(); await shot("10-coach-alerts");
      /* the ask is answered on this screen. One row for the person,
         carrying the two buttons; the notification that says the same
         thing happened is suppressed while the row is there, so the
         name is on the screen once. */
      const named = (t2.match(/Eoin Walsh/g) || []).length;
      check("(c) the alerts list names the person asking to join, once", named === 1 && /Requests/.test(t2) && t2.includes("wants to join"), t2.slice(0, 240));
      check("(c) the row carries Accept and Decline", (await byText(page, "Accept").count()) === 1 && (await byText(page, "Decline").count()) === 1, t2.slice(0, 200));
      await byText(page, "Accept").first().click(); await page.waitForTimeout(1400);
      const t3 = await text(); await shot("10b-coach-alerts-accepted");
      check("(c) accepting from the alerts list answers it there", !/Requests/.test(t3) && db.requests.every((r) => r.status !== "pending"), `${t3.slice(0, 160)} · ${JSON.stringify(db.requests.map((r) => r.status))}`);
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

    /* ---------- (e) a booking's notice opens the Diary on its day ---------- */
    {
      const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dayIn = (n) => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
      const far = dayIn(25), next = dayIn(1), later = dayIn(40);
      const BK = "b1000000-0000-4000-8000-0000000000b1", GONE = "b1000000-0000-4000-8000-0000000000b2", LATE = "b1000000-0000-4000-8000-0000000000b3", KIDBK = "b1000000-0000-4000-8000-0000000000b4";
      M.addBooking(db, { id: BK, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(far), time: "10:00 am" });
      M.addBooking(db, { id: GONE, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(next), time: "9:00 am", status: "cancelled" });
      M.addNotification(db, { id: N.land, userId: IDS.adult, kind: "booking", title: "Lesson confirmed", body: "10:00 am · Niamh Byrne", data: { screen: "calendar", id: BK }, createdAt: ago(2) });
      M.addNotification(db, { id: N.gone, userId: IDS.coach, kind: "booking", title: "Cian Murphy cancelled", body: "Away · 9:00 am", data: { screen: "calendar", id: GONE }, createdAt: ago(3) });
      M.addNotification(db, { id: N.remind, userId: IDS.coach, kind: "booking", title: "1 lesson tomorrow", body: null, data: { screen: "calendar", remind_day: M.ymd(next) }, createdAt: ago(4) });
      /* a booking written after the app loaded (the phone asleep), and one the diary will never hold */
      M.addNotification(db, { id: N.late, userId: IDS.adult, kind: "booking", title: "Lesson booked", body: "11:00 am · Niamh Byrne", data: { screen: "calendar", id: LATE }, createdAt: ago(5) });
      M.addNotification(db, { id: N.lost, userId: IDS.adult, kind: "booking", title: "Lesson asked for", body: "9:00 am · Niamh Byrne", data: { screen: "calendar", id: "b1000000-0000-4000-8000-0000000000ff" }, createdAt: ago(6) });
      /* a junior's adult is told on Family, as before */
      M.addBooking(db, { id: KIDBK, coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(far), time: "4:00 pm" });
      M.addNotification(db, { id: N.kid, userId: IDS.parent, kind: "booking", title: "Saoirse's lesson booked", body: "4:00 pm", data: { screen: "family", id: KIDBK }, createdAt: ago(2) });
      const landed = (page) => page.evaluate(() => {
        const on = document.querySelector('[data-day][aria-pressed="true"]');
        const view = document.querySelector('[data-tour="cal-view"] button[aria-pressed="true"]');
        return { day: on ? on.getAttribute("data-day") : null, view: view ? view.getAttribute("aria-label") : null };
      });
      const monthOf = (x) => `${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
      /* a tap wherever the notice is: the catch-up if it is up, else the bell */
      const openNotice = async (page, title) => {
        if (await catchup(page).count()) { await catchup(page).locator("button", { hasText: title }).first().click(); }
        else { await tap(page, '[aria-label="Alerts"]', 900); await alertRows(page).filter({ hasText: title }).first().click(); }
        await page.waitForTimeout(1200);
      };
      {
        const { ctx, page, text, shot } = await boot("adult");
        await openNotice(page, "Lesson confirmed");
        const l1 = await landed(page), t1 = await text(); await page.waitForTimeout(600); await shot("13-adult-booking-lands");
        const seen = await page.evaluate(() => { const el = [...document.querySelectorAll("[data-cal-day] span")].find((x) => x.textContent === "Your lesson"); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }; });
        check("(e) a booking's notice opens the Diary on that lesson's day, on the Calendar view where its block is", l1.day === String(far.getDate()) && l1.view === "Calendar" && t1.includes(monthOf(far)) && /Your lesson/.test(t1) && /10:00/.test(t1), `${JSON.stringify(l1)} · ${t1.slice(0, 200)}`);
        check("(e1) …with the lesson's block brought up on the screen, above the tab bar", !!seen && seen.top > 0 && seen.bottom < seen.h - 90, JSON.stringify(seen));
        /* the Diary moved off the day — the month after, on List — and the bell lands it again; the
           booking is at most a month out and the diary spans six, so Next month is always there */
        await page.locator('button[aria-label="Next month"]').click(); await page.waitForTimeout(400);
        const off = { moved: !(await text()).includes(monthOf(far)) };
        await page.locator('[data-tour="cal-view"] button[aria-label="List"]').click(); await page.waitForTimeout(500);
        await tap(page, '[aria-label="Alerts"]', 900);
        await alertRows(page).filter({ hasText: "Lesson confirmed" }).first().click(); await page.waitForTimeout(1200);
        const l2 = await landed(page), t2 = await text();
        check("(e2) …and again from the bell over a Diary left on another month, on List", off.moved && l2.day === String(far.getDate()) && l2.view === "Calendar" && t2.includes(monthOf(far)), `${JSON.stringify(off)} → ${JSON.stringify(l2)}`);
        await ctx.close();
      }
      {
        /* booked a moment ago: the diary does not hold it yet, so it lands when the fresh load brings it */
        const { ctx, page, text } = await boot("adult");
        M.addBooking(db, { id: LATE, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(later), time: "11:00 am" });
        await openNotice(page, "Lesson booked");
        await page.waitForTimeout(1500);
        const l6 = await landed(page), t6 = await text();
        check("(e6) a booking written after the app loaded is fetched and landed on", l6.day === String(later.getDate()) && l6.view === "Calendar" && t6.includes(monthOf(later)), `${JSON.stringify(l6)} · ${t6.slice(0, 160)}`);
        await ctx.close();
      }
      {
        /* a booking the diary will never hold: the Diary as it was, nothing broken */
        const { ctx, page, text } = await boot("adult");
        await openNotice(page, "Lesson asked for");
        await page.waitForTimeout(1500);
        const l7 = await landed(page), t7 = await text();
        check("(e7) a notice whose booking the diary cannot find opens the Diary as it was", /\bDiary\b/.test(t7) && l7.view === "List", `${JSON.stringify(l7)} · ${t7.slice(0, 120)}`);
        await ctx.close();
      }
      {
        const { ctx, page, text, shot } = await boot("adult", { url: `${BASE}/?open=calendar&oid=${BK}` });
        await page.waitForTimeout(1200);
        const l3 = await landed(page), t3 = await text(); await shot("14-adult-cold-open-lands");
        check("(e3) a push opened cold (?open=calendar&oid=…) lands on the same day and leaves the address clean", l3.day === String(far.getDate()) && l3.view === "Calendar" && t3.includes(monthOf(far)) && !/open=|oid=|oday=/.test(page.url()), `${JSON.stringify(l3)} · ${page.url()}`);
        await ctx.close();
      }
      {
        const { ctx, page, text, shot } = await boot("coach");
        await openNotice(page, "Cian Murphy cancelled");
        const l4 = await landed(page), t4 = await text(); await shot("15-coach-cancelled-lands");
        check("(e4) the coach's \"Cian Murphy cancelled\" opens the Diary on that day", l4.day === String(next.getDate()) && l4.view === "Calendar" && t4.includes(monthOf(next)), `${JSON.stringify(l4)} · ${t4.slice(0, 160)}`);
        await ctx.close();
      }
      {
        /* a fresh phone, so nothing kept from (e4) can stand in for the landing */
        const { ctx, page, text } = await boot("coach");
        const before = await (async () => { await tap(page, '[aria-label="Diary"]', 900); return landed(page); })();
        await tap(page, '[aria-label="Today"]', 900);
        await openNotice(page, "1 lesson tomorrow");
        const l5 = await landed(page), t5 = await text();
        check("(e5) the coach's evening \"1 lesson tomorrow\" opens on tomorrow, from a Diary that was on List", before.view === "List" && l5.day === String(next.getDate()) && l5.view === "Calendar" && t5.includes(monthOf(next)), `${JSON.stringify(before)} → ${JSON.stringify(l5)}`);
        await ctx.close();
      }
      {
        /* the same reminder opened cold: the worker carries its day */
        const { ctx, page, text } = await boot("coach", { url: `${BASE}/?open=calendar&oday=${M.ymd(next)}` });
        await page.waitForTimeout(1200);
        const l8 = await landed(page), t8 = await text();
        check("(e8) the evening reminder opened cold (?open=calendar&oday=…) lands on tomorrow and leaves the address clean", l8.day === String(next.getDate()) && l8.view === "Calendar" && t8.includes(monthOf(next)) && !/open=|oid=|oday=/.test(page.url()), `${JSON.stringify(l8)} · ${page.url()}`);
        await ctx.close();
      }
      {
        /* a junior's adult: their child's booking notice still opens Family */
        const { ctx, page, text } = await boot("parent");
        /* away from Family first, so the landing is the tap's and not the home's */
        if (await catchup(page).count()) { await page.locator('[data-tour="catchup-done"]').click(); await page.waitForTimeout(900); }
        await tap(page, '[aria-label="Diary"]', 900);
        const onDiary = (await page.locator('[data-tour="cal-view"]').count()) === 1 && (await page.locator('[data-tour="family-people"]').count()) === 0;
        await tap(page, '[aria-label="Alerts"]', 900);
        await alertRows(page).filter({ hasText: "Saoirse's lesson booked" }).first().click(); await page.waitForTimeout(1200);
        const l9 = await landed(page), t9 = await text();
        /* every notice opens what it is about (28 November): the child's lesson on its day, the Diary for
           the child — it landed on Family, where the lesson was a tap and a hunt away */
        check("(e9) a junior's adult's booking notice opens the Diary on the child's lesson's day, for the child", onDiary && l9.day === String(far.getDate()) && l9.view === "Calendar" && t9.includes(monthOf(far)) && /4:00/.test(t9) && /Saoirse/.test(t9), `${JSON.stringify(l9)} · ${t9.slice(0, 200)}`);
        await ctx.close();
      }
    }

    /* ---------- (f) the catch-up is whole and light: the app's sheet, every notice whole, Done and the scrim ---------- */
    {
      const LONGT = "Maximiliano Ó Súilleabháin can't make Saturday clinic";
      const LONGB = "Can we look at the bunker shots again next week please? The sand on the third was heavy";
      const db2 = M.emptyDb();
      M.addUser(db2, { id: IDS.coach, email: "coach@t.ie" }); M.addProfile(db2, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
      M.addUser(db2, { id: IDS.adult, email: "adult@t.ie" }); M.addProfile(db2, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
      M.addNotification(db2, { userId: IDS.coach, kind: "booking", title: LONGT, body: "Sat 7 Nov 9:00 am", data: { screen: "calendar" }, createdAt: todayAgo(10) });
      M.addNotification(db2, { userId: IDS.coach, kind: "message", title: "Cian Murphy", body: LONGB, data: { screen: "thread", id: IDS.adult }, createdAt: todayAgo(20) });
      M.addNotification(db2, { userId: IDS.coach, kind: "booking", title: "Cian Murphy cancelled", body: "Unwell · Sat 14 Nov 10:00 am", data: { screen: "calendar" }, createdAt: yesterdayNoon() });
      for (const width of [375, 320]) {
        const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); await M.attach(page, db2);
        page.on("pageerror", (e) => errors.push(`coach@${width} (f): ${String(e.message || e)}`));
        await M.injectSession(page, M.session(db2.users[IDS.coach] || Object.values(db2.users).find((x) => x.id === IDS.coach), db2));
        await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false }); await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(outDir, `16-catchup-${width}.png`) });
        const look = await page.evaluate(() => {
          const sheet = document.querySelector("[data-sheet]"), list = document.querySelector('[data-tour="catchup-list"]');
          if (!sheet || !list) return null;
          const lum = (c) => { const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return 0; const [r, g, b] = m.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
          const panel = sheet.parentElement, bg = getComputedStyle(panel).backgroundColor;
          const cut = (e) => { const st = getComputedStyle(e); return st.textOverflow === "ellipsis" || (st.webkitLineClamp && st.webkitLineClamp !== "none" && st.webkitLineClamp !== "") || e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1; };
          const rows = [...list.querySelectorAll("[data-bell-row]")].map((r) => { const ti = r.querySelector("[data-bell-title]"), bo = r.querySelector("[data-bell-body]"); return { title: ti.textContent, body: bo ? bo.textContent.replace(/\s+/g, " ").trim() : "", cut: cut(ti) || (bo ? cut(bo) : false), bodyH: bo ? Math.round(bo.getBoundingClientRect().height) : 0 }; });
          const head = sheet.querySelector('[data-tour="catchup"] h2');
          return { bg, light: lum(bg) > 0.9, rows, head: head ? getComputedStyle(head).fontFamily : "", heads: [...list.querySelectorAll("[data-bell-head]")].map((h) => h.textContent), cards: list.querySelectorAll("[data-bell-card]").length,
                   done: !!sheet.querySelector('[data-tour="catchup-done"]'), dark: [...document.querySelectorAll("div")].some((d) => { const st = getComputedStyle(d); return st.position === "absolute" && st.zIndex === "70" && lum(st.backgroundColor) < 0.2 && d.getBoundingClientRect().height > 400; }) };
        });
        check(`(f) at ${width} the catch-up is the app's light sheet — white, the title in the serif, no dark takeover — with one key, Done`, !!look && look.light && /Nosca Serif/.test(look.head) && !look.dark && look.done, JSON.stringify(look && { bg: look.bg, head: look.head, dark: look.dark, done: look.done }));
        check(`(f) at ${width} every notice is whole: the long title and the message's words wrap, nothing is cut, on the bell's own rows on their days' cards`,
          !!look && look.rows.length === 3 && look.rows.every((r) => !r.cut) && look.rows.some((r) => r.title === LONGT) && look.rows.some((r) => r.body === LONGB && r.bodyH > 30) && look.heads.join("|") === "Today|Yesterday" && look.cards === 2,
          JSON.stringify(look && { rows: look.rows, heads: look.heads, cards: look.cards }));
        if (width === 375) {
          /* the scrim closes it and marks everything read, as Done does */
          await page.mouse.click(200, 60); await page.waitForTimeout(900);
          const p = readPatchesOf(db2).slice(-1)[0];
          check("(f) the scrim closes the catch-up and marks every notice in it read, as Done does", (await catchup(page).count()) === 0 && !!p && p.body.read_at && db2.notifications.filter((n) => n.user_id === IDS.coach && !n.read_at).length === 0, p ? p.query : "no PATCH");
          db2.notifications.forEach((n) => { n.read_at = null; });
        }
        await ctx.close();
      }
    }

    /* ---------- (g) every notice opens what it is about: each kind, as its trigger writes it ---------- */
    {
      const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dayIn = (n) => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
      const G = { clip: "10000000-0000-4000-8000-00000000c1f1", practice: "10000000-0000-4000-8000-00000000c1f2", imported: "10000000-0000-4000-8000-00000000c1f3", kid: "10000000-0000-4000-8000-00000000c1f4",
                  ask: "b2000000-0000-4000-8000-0000000000a1", req: "ce000000-0000-4000-8000-0000000000a1", req2: "ce000000-0000-4000-8000-0000000000a2", imp: "1a000000-0000-4000-8000-0000000000a1" };
      const askDay = dayIn(9);
      const db3 = M.emptyDb();
      const person = (key, email, prof) => { M.addUser(db3, { id: IDS[key], email }); return M.addProfile(db3, { id: IDS[key], ...prof }); };
      M.addFamily(db3, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
      person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
      person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
      person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
      person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
      person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
      M.setPrefs(db3, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "11:00 am"], [0, 1, 2, 3, 4, 5, 6]) });
      M.addLesson(db3, { id: LESSON.new, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-01", focus: "Short game", notes: "Cleaner contact from the fringe." });
      M.addLesson(db3, { id: G.clip, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayIn(-1)), focus: "Chipping", sentBy: IDS.adult, notes: "Is the ball too far back?" });
      M.addLesson(db3, { id: G.practice, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayIn(-1)), focus: "Putting", sentBy: IDS.adult, kind: "practice", notes: "Twenty from six feet." });
      M.addLesson(db3, { id: G.imported, coachId: IDS.coach, playerId: IDS.junior, date: "2025-07-02", focus: "Driving", notes: "Tee it lower in the wind.", importId: G.imp });
      M.addLesson(db3, { id: G.kid, coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayIn(-2)), focus: "Bunker play", notes: "Open the face and splash." });
      M.addBooking(db3, { id: G.ask, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(askDay), time: "10:00 am", status: "requested", note: "Bunker play before the medal" });
      M.addDrill(db3, { coachId: IDS.coach, playerId: IDS.junior, title: "Ladder drill" });
      M.addMessage(db3, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.coach, body: "Can Saoirse come at four on Friday?", createdAt: ago(40) });
      const nn = (who, kind, title, body, data, mins) => M.addNotification(db3, { userId: IDS[who], kind, title, body, data, createdAt: ago(mins) });
      nn("coach", "clip", "Cian sent a clip", "Chipping", { screen: "lesson", id: G.clip }, 1);
      nn("coach", "practice", "Cian practised", "Putting", { screen: "lesson", id: G.practice }, 2);
      nn("coach", "booking", "Cian Murphy asked for a lesson", "10:00 am · Bunker play before the medal", { screen: "today", id: G.ask }, 3);
      nn("coach", "lesson", "Orla Kelly imported 1 lesson", "Jul 2025", { screen: "lesson", id: G.imported, import: G.imp }, 4);
      nn("coach", "lesson", "Orla Kelly removed 2 imported lessons", "Aug 2025", { screen: "player", id: IDS.junior }, 5);
      nn("adult", "tip", "Something to work on", "Tempo over speed · Niamh Byrne", { screen: "tips" }, 1);
      nn("adult", "drill", "New drill", "Gate drill · Niamh Byrne", { screen: "practice" }, 2);
      nn("adult", "rating", "Niamh asked for a rating", "Short game", { screen: "lesson", id: LESSON.new }, 3);
      nn("adult", "accepted", "Niamh Byrne accepted you", null, { screen: "home", id: G.req }, 4);
      nn("eoin", "declined", "Niamh Byrne can't take you on", null, { screen: "home", id: G.req2 }, 1);
      nn("parent", "lesson", "Saoirse's lesson logged", "Bunker play · Niamh Byrne", { screen: "family", id: G.kid }, 1);
      nn("parent", "drill", "Saoirse has a new drill", "Niamh Byrne", { screen: "family", id: IDS.junior }, 2);
      /* written before the trigger carried the child: found by the name its title opens with */
      nn("parent", "tip", "Saoirse has something to work on", "Tempo over speed", { screen: "family" }, 3);
      nn("parent", "message", "Niamh Byrne messaged Saoirse", "Can Saoirse come at four on Friday?", { screen: "thread", id: IDS.junior }, 4);
      nn("junior", "message", "Niamh Byrne messaged your family", null, { screen: "home" }, 1);
      const bootG = async (role, url = BASE) => {
        const u = Object.values(db3.users).find((x) => x.id === IDS[role]);
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); await M.attach(page, db3);
        page.on("pageerror", (e) => errors.push(`${role} (g): ${String(e.message || e)}`));
        await M.injectSession(page, M.session(u, db3));
        await page.goto(url, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false }); await page.waitForTimeout(500);
        return { ctx, page };
      };
      const landed = (page) => page.evaluate(() => {
        const on = document.querySelector('[data-day][aria-pressed="true"]');
        const view = document.querySelector('[data-tour="cal-view"] button[aria-pressed="true"]');
        return { day: on ? on.getAttribute("data-day") : null, view: view ? view.getAttribute("aria-label") : null };
      });
      /* open a notice from the catch-up where it is up, else from the bell, and read where it landed */
      const open = async (page, title, shot) => {
        if (await catchup(page).count()) await catchup(page).locator("button", { hasText: title }).first().click();
        else { await tap(page, '[aria-label="Alerts"]', 900); await page.locator('[data-tour="alerts-list"] [data-bell-row]', { hasText: title }).first().click(); }
        await page.waitForTimeout(1300);
        if (shot) await page.screenshot({ path: path.join(outDir, `${shot}.png`) });
        return { t: await M.rootText(page), l: await landed(page), has: async (sel) => (await page.locator(sel).count()) > 0 };
      };
      const home = async (page, tab) => { await tap(page, `[aria-label="${tab}"]`, 700); };
      {
        const { ctx, page } = await bootG("coach");
        /* from the catch-up: the bell itself leaves out an asking notice its Requests row already says */
        let r = await open(page, "Cian Murphy asked for a lesson", "19-coach-ask");
        check("(g3) \"Cian Murphy asked for a lesson\" opens the Diary on the day asked for, on the request in its hour (Decline · Accept)", r.l.day === String(askDay.getDate()) && r.l.view === "Calendar" && r.t.includes(`${MONTHS[askDay.getMonth()]} ${askDay.getFullYear()}`) && await r.has('[data-tour="cal-ask"]'), `${JSON.stringify(r.l)} · ${r.t.slice(0, 200)}`);
        await home(page, "Today");
        r = await open(page, "Cian sent a clip", "17-coach-clip");
        check("(g1) the coach's \"Cian sent a clip\" opens the clip's own page, where Reply is", r.t.includes("Chipping") && r.t.includes("Is the ball too far back?") && await r.has('[data-tour="clip-reply"]'), r.t.slice(0, 200));
        await home(page, "Today");
        r = await open(page, "Cian practised", "18-coach-practice");
        check("(g2) \"Cian practised\" opens the practice's page", r.t.includes("Putting") && r.t.includes("Twenty from six feet.") && r.t.includes("Sent by Cian Murphy") && await r.has('[data-tour="clip-reply"]'), r.t.slice(0, 200));
        await home(page, "Today");
        r = await open(page, "Orla Kelly imported 1 lesson", "20-coach-import");
        check("(g4) an import's notice opens its newest lesson", r.t.includes("Driving") && r.t.includes("Tee it lower in the wind."), r.t.slice(0, 200));
        await home(page, "Today");
        r = await open(page, "Orla Kelly removed 2 imported lessons");
        check("(g5) an import taken away opens the player's file", r.t.includes("Saoirse Kelly") && await r.has('[data-tour="player-notes"]'), r.t.slice(0, 200));
        await ctx.close();
      }
      {
        /* a push opened cold: the coach's ask, by its id */
        const { ctx, page } = await bootG("coach", `${BASE}/?open=today&oid=${G.ask}`);
        await page.waitForTimeout(1200);
        const l = await landed(page);
        check("(g6) the same ask opened cold from a push (?open=today&oid=…) lands on its day and its request", l.day === String(askDay.getDate()) && l.view === "Calendar" && (await page.locator('[data-tour="cal-ask"]').count()) > 0 && !/open=|oid=/.test(page.url()), `${JSON.stringify(l)} · ${page.url()}`);
        await ctx.close();
      }
      {
        const { ctx, page } = await bootG("adult");
        let r = await open(page, "Something to work on");
        check("(g7) a tip opens the tips", /What you've worked on/.test(r.t), r.t.slice(0, 160));
        await home(page, "Home");
        r = await open(page, "New drill");
        check("(g8) a drill opens Drills", await r.has('[data-tour="drills-log-practice"]'), r.t.slice(0, 160));
        await home(page, "Home");
        r = await open(page, "Niamh asked for a rating");
        check("(g9) a rating asked for opens the lesson", r.t.includes("Short game") && r.t.includes("Cleaner contact from the fringe."), r.t.slice(0, 160));
        await home(page, "Home");
        r = await open(page, "Niamh Byrne accepted you", "21-adult-accepted");
        check("(g10) \"Niamh Byrne accepted you\" opens the coach's profile", await r.has('[data-tour="coach-message"]') && r.t.includes("Niamh Byrne"), r.t.slice(0, 160));
        await ctx.close();
      }
      {
        const { ctx, page } = await bootG("eoin");
        const r = await open(page, "can't take you on", "22-eoin-declined");
        check("(g11) \"Niamh Byrne can't take you on\" opens Add your coach, the code boxes ready for the next ask", r.t.includes("Add your coach") && (await M.codeBoxes(page).count()) >= 6 && !(await page.locator('[data-sheet] [data-tour="catchup"]').count()), r.t.slice(0, 200));
        await ctx.close();
      }
      {
        const { ctx, page } = await bootG("parent");
        let r = await open(page, "Saoirse's lesson logged", "23-parent-kid-lesson");
        check("(g12) a junior's adult's \"Saoirse's lesson logged\" opens the child's lesson", r.t.includes("Bunker play") && r.t.includes("Open the face and splash."), r.t.slice(0, 200));
        await home(page, "Family");
        r = await open(page, "Saoirse has a new drill", "24-parent-kid-drill");
        check("(g13) \"Saoirse has a new drill\" opens the child's own screen", await r.has('[data-tour="kid-progress"]') && r.t.includes("Saoirse") && /Drills\s*1 drill/.test(r.t), r.t.slice(0, 200));
        await home(page, "Family");
        r = await open(page, "Saoirse has something to work on");
        check("(g14) a notice written before the trigger carried the child (no id) finds her by the name it opens with", await r.has('[data-tour="kid-progress"]') && r.t.includes("Saoirse"), r.t.slice(0, 200));
        await home(page, "Family");
        r = await open(page, "Niamh Byrne messaged Saoirse");
        check("(g15) \"Niamh Byrne messaged Saoirse\" opens Saoirse's thread", r.t.includes("Can Saoirse come at four on Friday?") && (await page.locator('input[placeholder="Message"], textarea[placeholder="Message"]').count()) >= 1, r.t.slice(0, 200));
        await ctx.close();
      }
      {
        const { ctx, page } = await bootG("parent", `${BASE}/?open=family&oid=${IDS.junior}`);
        await page.waitForTimeout(1200);
        check("(g16) the child's drill opened cold from a push (?open=family&oid=<child>) lands on the child's own screen", (await page.locator('[data-tour="kid-progress"]').count()) === 1 && !/open=|oid=/.test(page.url()), page.url());
        await ctx.close();
      }
      {
        const { ctx, page } = await bootG("junior");
        const r = await open(page, "messaged your family");
        check("(g17) a junior's \"Niamh Byrne messaged your family\" opens the family, where their adults are", await r.has('[data-tour="family-people"]'), r.t.slice(0, 200));
        await ctx.close();
      }
    }

    /* ---------- (h) a hundred and fifty notices: thirty drawn, Show earlier, and quick ---------- */
    {
      const db4 = M.emptyDb();
      M.addUser(db4, { id: IDS.coach, email: "coach@t.ie" }); M.addProfile(db4, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
      M.addUser(db4, { id: IDS.adult, email: "adult@t.ie" }); M.addProfile(db4, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
      const kinds = [["booking", "Cian Murphy cancelled", "Unwell · Sat 14 Nov 10:00 am"], ["message", "Cian Murphy", "See you Tuesday at nine."], ["practice", "Cian practised", "Putting · Chipping"], ["clip", "Cian sent a clip", "Chipping"], ["booking", "3 lessons tomorrow", null]];
      for (let i = 0; i < 150; i++) { const k = kinds[i % kinds.length]; M.addNotification(db4, { userId: IDS.coach, kind: k[0], title: k[1], body: k[2], data: { screen: "calendar" }, createdAt: ago(30 + i * 7 * 60), readAt: i < 120 ? ago(1) : null }); }
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage(); await M.attach(page, db4);
      page.on("pageerror", (e) => errors.push(`coach (h): ${String(e.message || e)}`));
      await M.injectSession(page, M.session(Object.values(db4.users).find((x) => x.id === IDS.coach), db4));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false }); await page.waitForTimeout(600);
      const cRows = await catchup(page).locator("[data-bell-row]").count(), cMore = await page.locator('[data-tour="catchup-earlier"]').count();
      await page.screenshot({ path: path.join(outDir, "25-catchup-thirty.png") });
      check("(h) thirty unread draw thirty rows in the catch-up and no Show earlier; the count says thirty", cRows === 30 && cMore === 0 && (await M.rootText(page)).includes("30 new"), JSON.stringify({ cRows, cMore }));
      await page.locator('[data-tour="catchup-done"]').click(); await page.waitForTimeout(800);
      const t0 = Date.now();
      await page.locator('[aria-label="Alerts"]').first().dispatchEvent("click");
      await page.locator('[data-tour="alerts-list"] [data-bell-row]').nth(29).waitFor({ timeout: 8000 });
      const openMs = Date.now() - t0;
      const first = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-bell-row]").length, cards: document.querySelectorAll('[data-tour="alerts-list"] [data-bell-card]').length,
        heads: [...document.querySelectorAll('[data-tour="alerts-list"] [data-bell-head]')].map((h) => h.textContent), nodes: document.querySelectorAll("#root *").length }));
      await page.waitForTimeout(600); await page.screenshot({ path: path.join(outDir, "26-bell-hundred-fifty.png") });
      check("(h) a hundred and fifty notices: the bell draws the newest thirty on their days' cards — one card a day — and is up in well under a second and a half", first.rows === 30 && first.cards >= 2 && first.cards === first.heads.length && /^(Today|Yesterday)$/.test(first.heads[0]) && openMs < 1500, JSON.stringify({ openMs, ...first }));
      const t1 = Date.now();
      await page.locator('[data-tour="alerts-earlier"]').click();
      await page.locator('[data-tour="alerts-list"] [data-bell-row]').nth(59).waitFor({ timeout: 8000 });
      const moreMs = Date.now() - t1, after = await page.evaluate(() => document.querySelectorAll("[data-bell-row]").length);
      for (let i = 0; i < 3; i++) { await page.locator('[data-tour="alerts-earlier"]').click(); await page.waitForTimeout(250); }
      const all = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-bell-row]").length, more: !!document.querySelector('[data-tour="alerts-earlier"]') }));
      /* a scroll through all of it: the longest frame while the list moves */
      const jank = await page.evaluate(async () => {
        const box = document.querySelector('[data-scroll="screen"]'); if (!box) return null;
        let last = performance.now(), worst = 0; const end = last + 1200;
        await new Promise((res) => { const step = (now) => { worst = Math.max(worst, now - last); last = now; box.scrollTop += 60; if (now < end) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
        return Math.round(worst);
      });
      check("(h) Show earlier draws thirty more each time, quickly, until all hundred and fifty are there and it goes; a scroll through them drops no long frame", after === 60 && moreMs < 1500 && all.rows === 150 && !all.more && jank != null && jank < 250, JSON.stringify({ moreMs, after, all, jank }));
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
