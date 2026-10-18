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

  try {
    /* ---------- (a) three unread: the catch-up, a tap goes to the lesson ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      const t0 = await text(); await shot("01-adult-catchup");
      const rows = catchup(page).locator("button");
      check("(a) opening with unread notifications shows the catch-up over everything", (await catchup(page).count()) === 1 && /while you were away/i.test(t0) && t0.includes("3 things happened"), t0.slice(0, 200));
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
      check("(b) the next open shows only what is still unread", (await catchup(page).count()) === 1 && t0.includes("One thing happened") && t0.includes("Lesson confirmed") && !t0.includes("Lesson logged"), t0.slice(0, 200));
      await click(page, "Dismiss", 1000);
      const p = readPatches().slice(-1)[0];
      check("(b) Dismiss PATCHes read_at for everything unread", !!p && p.body.read_at && p.query.includes(N.booking2) && p.query.includes("read_at=is.null") && p.n === 1 && db.notifications.filter((n) => n.user_id === IDS.adult && !n.read_at).length === 0, p ? p.query : "no PATCH");
      check("(b) the bell reads 0", (await M.bellCount(page)) === 0 && (await page.locator('[aria-label="Alerts"] span').count()) === 0, String(await M.bellCount(page)));
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
        if (await catchup(page).count()) await click(page, "Dismiss", 900);
        await tap(page, '[aria-label="Diary"]', 900);
        const onDiary = (await page.locator('[data-tour="cal-view"]').count()) === 1 && (await page.locator('[data-tour="family-people"]').count()) === 0;
        await tap(page, '[aria-label="Alerts"]', 900);
        await alertRows(page).filter({ hasText: "Saoirse's lesson booked" }).first().click(); await page.waitForTimeout(1200);
        const t9 = await text();
        check("(e9) a junior's adult's booking notice still lands on Family, from the Diary", onDiary && (await page.locator('[data-tour="family-people"]').count()) === 1 && !(await page.locator('[data-tour="cal-view"]').count()), t9.slice(0, 160));
        await ctx.close();
      }
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
