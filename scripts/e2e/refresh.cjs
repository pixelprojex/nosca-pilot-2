/* BACK TO THE FRONT, THE SCREEN IS RIGHT. A phone put away keeps no
   socket — the browser throttles the heartbeat in the background and then
   closes the connection — and a channel that rejoins is told nothing of
   what it missed, so a lesson booked, a request made or a group a member
   was added to while the app was away stayed off the screen until the next
   event or a fresh open. The hook loads again on every return to the
   front (visibilitychange to visible, pageshow, focus), at most once in
   RETURN_GAP_MS (20s), never while the phone says it is offline — and a
   sheet that was open stays open. The mock swallows the realtime socket,
   so a row written straight into its database is exactly a change the app
   was never told about.
   Usage: node refresh.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4371), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
const GAP = 20000;
const AVAIL = M.weekOf(["9:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]);
const GROUP = { id: "g1", name: "Winter league", members: ["Saoirse Kelly"], memberIds: [IDS.junior], day: 5, time: "4:00 pm", weeks: 8, sport: "golf" };

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: AVAIL, groups: [GROUP] });
  /* the adult's own lesson tomorrow, and a clinic they are not in */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(1)), time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, groupName: "Winter league", date: M.ymd(dayFrom(2)), time: "4:00 pm" });
  return db;
}

const { check, results, summary } = M.checker("refresh");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  let clockMs = 0;
  const boot = async (role, d, at = "09:00") => {
    const u = Object.values(d.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    clockMs = new Date(`${TODAY}T${at}:00`).getTime();
    await page.clock.setFixedTime(new Date(clockMs)); await M.attach(page, d);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, d));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* the clock moves only when the suite says so (the page's Date is pinned) */
  const later = async (page, ms) => { clockMs += ms; await page.clock.setFixedTime(new Date(clockMs)); };
  /* every read of a table the app has made, off the mock's request log */
  const gets = (db, table) => db.log.filter((l) => l.startsWith("GET ") && l.includes(`/rest/v1/${table}?`)).length;
  const setVis = (page, state) => page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => state === "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
  /* put the app away for `ms` and bring it back */
  const away = async (page, ms) => { await setVis(page, "hidden"); await later(page, ms); await setVis(page, "visible"); await page.waitForTimeout(1600); };
  const toList = async (page) => { const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]'); if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700); };
  const mine = (page) => page.locator('[data-tour="agenda-mine"]').count();

  try {
    /* ---------- (a) a player: a lesson booked while the app was away ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot("adult", db);
      await tap(page, '[aria-label="Diary"]', 1000); await toList(page);
      const m0 = await mine(page), g0 = gets(db, "bookings");
      check("(a0) the Diary's List carries the player's one lesson, tomorrow", m0 === 1 && /9:00 am/.test(await text()), `rows ${m0}`);
      /* the coach books a second lesson while the phone is in a pocket: no socket, no event */
      M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(3)), time: "10:30 am" });
      await page.waitForTimeout(900);
      check("(a1) with the socket swallowed the row the coach wrote is not on the screen", (await mine(page)) === m0, `rows ${await mine(page)}`);
      await away(page, GAP + 11000);
      const m1 = await mine(page), g1 = gets(db, "bookings");
      await shot("01-back-with-lesson");
      check("(a2) back to the front after half a minute the Diary carries the new lesson — the data loaded again", m1 === m0 + 1 && g1 > g0, `rows ${m0}→${m1} · bookings read ${g0}→${g1}`);
      /* a flick between apps is not a day away */
      await away(page, 5000);
      check("(a3) a second return inside the gap loads nothing again", gets(db, "bookings") === g1, `bookings read ${g1}→${gets(db, "bookings")}`);
      await ctx.close();
    }

    /* ---------- (b) a member added to a group while away sees the clinic ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot("adult", db);
      await tap(page, '[aria-label="Diary"]', 1000); await toList(page);
      check("(b0) the clinic the player is not in is not on their Diary", !/Winter league/.test(await text()), (await text()).slice(0, 160));
      M.setPrefs(db, IDS.coach, { availability: AVAIL, groups: [{ ...GROUP, members: ["Saoirse Kelly", "Cian Murphy"], memberIds: [IDS.junior, IDS.adult] }] });
      await away(page, GAP + 11000);
      await shot("02-back-in-the-group");
      check("(b1) added to the group while away, back to the front the clinic is on their Diary", /Winter league/.test(await text()), (await text()).slice(0, 200));
      await ctx.close();
    }

    /* ---------- (c) a sheet that was open stays open ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot("adult", db);
      await tap(page, '[aria-label="Diary"]', 1000); await toList(page);
      await tap(page, '[data-tour="agenda-book"]', 900);
      const open0 = await page.locator("[data-sheet]").count();
      const g0 = gets(db, "bookings");
      await away(page, GAP + 11000);
      await shot("03-sheet-stays");
      check("(c) the request sheet that was open before the app was put away is still open after the reload", open0 === 1 && (await page.locator("[data-sheet]").count()) === 1 && gets(db, "bookings") > g0,
            `sheet ${open0}→${await page.locator("[data-sheet]").count()} · bookings read ${g0}→${gets(db, "bookings")}`);
      await ctx.close();
    }

    /* ---------- (d) the coach: a request made while away is on Today ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot("coach", db);
      await tap(page, '[aria-label="Today"]', 900);
      const acc0 = await page.locator("button", { hasText: /^Accept$/ }).count();
      M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(4)), time: "9:00 am", status: "requested" });
      await page.waitForTimeout(900);
      check("(d0) the request made while the coach's phone was away is not on Today yet", (await page.locator("button", { hasText: /^Accept$/ }).count()) === acc0, "");
      await away(page, GAP + 11000);
      await shot("04-coach-back-with-request");
      check("(d1) back to the front, Today carries the request with Accept · Decline", (await page.locator("button", { hasText: /^Accept$/ }).count()) === acc0 + 1 && /Cian Murphy/.test(await text()), (await text()).slice(0, 200));
      await ctx.close();
    }

    /* ---------- (e) offline, no load; focus and pageshow are returns too ---------- */
    {
      const db = freshDb();
      const { ctx, page } = await boot("adult", db);
      await tap(page, '[aria-label="Diary"]', 1000); await toList(page);
      await ctx.setOffline(true); await page.waitForTimeout(300);
      const online = await page.evaluate(() => navigator.onLine);
      const g0 = gets(db, "bookings");
      await away(page, GAP + 11000);
      check("(e1) while the phone says it is offline a return loads nothing (the online event does that)", online === false && gets(db, "bookings") === g0, `onLine ${online} · bookings read ${g0}→${gets(db, "bookings")}`);
      await ctx.setOffline(false); await page.waitForTimeout(1500);
      const g1 = gets(db, "bookings");
      await later(page, GAP + 11000);
      await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await page.waitForTimeout(1500);
      const g2 = gets(db, "bookings");
      check("(e2) the window gaining focus is a return: the data loads again", g2 > g1, `bookings read ${g1}→${g2}`);
      await later(page, GAP + 11000);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))); await page.waitForTimeout(1500);
      const g3 = gets(db, "bookings");
      check("(e3) a page restored from the back-forward cache (pageshow) is a return too", g3 > g2, `bookings read ${g2}→${g3}`);
      await ctx.close();
    }

    check("(z) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
