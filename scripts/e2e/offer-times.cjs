/* THE TIMES A COACH OFFERS ARE THAT DAY'S OPEN TIMES.

   The coach's Cancel → Offer another time, and the decline sheet's
   Offer another time, book the offered time on the lesson's own date.
   For a long time both offered the first six of the coach's whole pool
   whatever the day: a time already gone, the very time being cancelled
   or declined, another player's lesson, an away day. Now both read the
   diary's own rule (`dayOpenTimes` → `openTimes`: the day's hours, the
   date's blocked and added times, nothing past, nothing on an away day,
   a confirmed or requested time held), on the app's one TimeGrid; with
   nothing open, Cancel goes from Why to the password and the decline
   sheet says so over Just decline.

   o1-o4  Cancel on the peek: today's open times only
   o5     an away day: Why, then straight to the password
   o6     a coach with no hours: the password, and Back returns to Why
   o7     the Calendar view's Cancel offers the same times
   d1-d3  decline: that day's open times, not the time asked for
   d4     nothing open: said, and Just decline still declines
   d5     the decline's times are the app's tiles, not pills
   o8     the clock as it is when the sheet opens, not when the app did
   o9     a time is offered only if the lesson fits clear of the others
   d6     a request left unanswered from last month offers nothing

   Usage: node offer-times.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4491), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", junior: "00000000-0000-4000-8000-00000000c41d" };
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
const TIMES = /\d{1,2}:\d\d [ap]m/g;
const { check, summary } = M.checker("offer-times");

function freshDb({ hours = true, away = null } = {}) {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, dob: "2013-09-09" });
  const week = hours ? M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) : M.weekOf([], []);
  if (away) week.away = [{ from: away, to: away }];
  M.setPrefs(db, IDS.coach, { setup_done: true, availability: week });
  const t0 = dayPlus(db, 0), t1 = dayPlus(db, 1);
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000cc03", coachId: IDS.coach, playerId: IDS.adult, date: t0, time: "4:00 pm", duration: 45 });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000cc05", coachId: IDS.coach, playerId: IDS.junior, date: t0, time: "11:00 am", duration: 45 });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000cc06", coachId: IDS.coach, playerId: IDS.adult, date: t1, time: "10:00 am", duration: 45, status: "requested" });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000cc07", coachId: IDS.coach, playerId: IDS.junior, date: t1, time: "4:00 pm", duration: 45 });
  return db;
}

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, hm = "10:30") => {
    const u = Object.values(db.users).find((x) => x.id === IDS.coach);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    /* half past ten today: 9:00 and 10:00 have been and gone */
    await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T${hm}:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    return { ctx, page, shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) }) };
  };
  const sheetText = async (page) => M.norm(await page.locator("[data-sheet]").innerText());
  const toWhy = async (page) => {
    await page.locator('[data-tour="cancel-why"]').first().click(); await page.waitForTimeout(300);
    await page.locator("[data-sheet] button", { hasText: /^Next$/ }).first().click(); await page.waitForTimeout(800);
  };
  const cancelFromPeek = async (page, who) => {
    await page.locator("button", { hasText: who }).first().click(); await page.waitForTimeout(900);
    await page.locator("[data-sheet] button", { hasText: /^Cancel$/ }).first().click(); await page.waitForTimeout(800);
    await toWhy(page);
  };
  const offered = async (page) => (await page.locator("[data-sheet]").innerText()).match(TIMES) || [];
  /* a time offered is a button reading only that time */
  const offerButtons = (page) => page.locator("[data-sheet] button").evaluateAll((els) => els.map((e) => e.textContent.trim()).filter((x) => /^\d{1,2}:\d\d [ap]m$/.test(x)));

  try {
    /* ---------- (o) Cancel on the peek ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db);
      await cancelFromPeek(page, "Cian Murphy");
      await shot("01-cancel-offer");
      const times = await offered(page);
      check("(o1) Cancel offers today's open time and nothing else: 5:00 pm", JSON.stringify(times) === JSON.stringify(["5:00 pm"]), times.join(", ") || "none");
      check("(o2) no time outside the week's hours", times.length > 0 && times.every((x) => WEEK.includes(x)), times.join(", "));
      check("(o3) nothing another player holds (Saoirse's 11:00 am), nor the lesson being cancelled (4:00 pm)", !times.includes("11:00 am") && !times.includes("4:00 pm"), times.join(", "));
      check("(o4) nothing already gone today (9:00 am, 10:00 am)", !times.includes("9:00 am") && !times.includes("10:00 am"), times.join(", "));
      await ctx.close();
    }

    /* ---------- (o5) an away day offers nothing: Why, then the password ---------- */
    {
      const db = freshDb({ away: dayPlus(M.emptyDb(), 0) });
      const { ctx, page, shot } = await boot(db);
      /* the coach's home still lists the day's lessons; the peek's Cancel is the way in */
      await cancelFromPeek(page, "Cian Murphy");
      const t = await sheetText(page);
      await shot("02-away");
      check("(o5) on an away day Why goes straight to the password, with no time offered",
            /password/i.test(t) && !/Offer another time/.test(t) && (await offerButtons(page)).length === 0, t.slice(0, 160));
      await ctx.close();
    }

    /* ---------- (o6) a coach with no hours: the password, and Back returns to Why ---------- */
    {
      const db = freshDb({ hours: false });
      const { ctx, page } = await boot(db);
      await cancelFromPeek(page, "Cian Murphy");
      const t = await sheetText(page);
      const onPassword = /password/i.test(t) && !/Offer another time/.test(t);
      await page.locator("[data-sheet] button", { hasText: /^Back$/ }).first().click(); await page.waitForTimeout(600);
      const back = await page.locator('[data-tour="cancel-why"]').count();
      check("(o6) a coach with no hours goes from Why to the password, and Back returns to Why", onPassword && back > 0, t.slice(0, 160));
      await ctx.close();
    }

    /* ---------- (o7) the Calendar view's Cancel ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db);
      await M.tap(page, '[aria-label="Diary"]', 1000);
      await M.tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 800);
      await page.locator(`button[data-day="${Number(dayPlus(db, 0).slice(8))}"]`).first().dispatchEvent("click"); await page.waitForTimeout(700);
      /* the day's schedule block is folded; open Cian's, then its Cancel */
      let times = null;
      await page.locator("button", { hasText: /Cian Murphy/ }).filter({ hasText: /4:00/ }).first().dispatchEvent("click"); await page.waitForTimeout(600);
      const blockCancel = page.locator('[data-tour="block-cancel"]');
      if (await blockCancel.count()) {
        await blockCancel.first().dispatchEvent("click"); await page.waitForTimeout(800);
        if (await page.locator('[data-tour="cancel-why"]').count()) { await toWhy(page); times = await offerButtons(page); }
      }
      await shot("03-calendar-cancel");
      check("(o7) the Calendar view's Cancel offers the same open time: 5:00 pm", JSON.stringify(times) === JSON.stringify(["5:00 pm"]), JSON.stringify(times));
      await ctx.close();
    }

    /* ---------- (d) the decline sheet ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db);
      await page.locator("button", { hasText: /^Decline$/ }).first().click(); await page.waitForTimeout(800);
      await shot("04-decline");
      const dt = await offered(page);
      check("(d1) decline offers that day's open times: 9:00 am, 11:00 am, 5:00 pm", JSON.stringify(dt) === JSON.stringify(["9:00 am", "11:00 am", "5:00 pm"]), dt.join(", ") || "none");
      check("(d2) decline offers no time another player holds (Saoirse's 4:00 pm)", !dt.includes("4:00 pm"), dt.join(", "));
      check("(d3) decline does not offer the requested time back (10:00 am)", !dt.includes("10:00 am"), dt.join(", "));
      const radii = await page.locator('[data-tour="decline-offer"] button').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).borderRadius)));
      check("(d5) the decline's times are the app's tiles — the control's corner, never a pill", radii.length === 3 && radii.every((r) => r > 0 && r < 20), JSON.stringify(radii));
      await ctx.close();
    }
    {
      const db = freshDb({ hours: false });
      const { ctx, page } = await boot(db);
      await page.locator("button", { hasText: /^Decline$/ }).first().click(); await page.waitForTimeout(800);
      const t = await sheetText(page);
      const none = await page.locator("[data-offer-none]").count();
      await page.locator("[data-sheet] button", { hasText: /^Just decline$/ }).first().click(); await page.waitForTimeout(1200);
      const req = db.bookings.find((b) => b.id === "b0000000-0000-4000-8000-00000000cc06");
      check("(d4) with nothing open the sheet says so, offers no time, and Just decline still declines",
            none === 1 && /Nothing open that day/.test(t) && !(t.match(TIMES) || []).length && !!req && req.status === "cancelled", JSON.stringify({ none, status: req && req.status, t: t.slice(0, 120) }));
      await ctx.close();
    }

    /* ---------- (o8) the app opened at half eight, the sheet at half three ---------- */
    {
      const db = freshDb();
      const { ctx, page } = await boot(db, "08:30");
      await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T15:30:00`)); await page.waitForTimeout(400);
      await cancelFromPeek(page, "Cian Murphy");
      const times = await offerButtons(page);
      check("(o8) the clock is read when the sheet opens: at half three, only 5:00 pm — never the morning", JSON.stringify(times) === JSON.stringify(["5:00 pm"]), times.join(", ") || "none");
      await ctx.close();
    }

    /* ---------- (o9) half-hour times and hour-long lessons ---------- */
    {
      const db = freshDb();
      const h = db.prefs[IDS.coach].availability;
      Object.keys(h.days).forEach((k) => { h.days[k] = ["9:00 am", "9:30 am", "10:00 am", "4:00 pm"]; });
      h.duration = 60; h.slots = ["9:00 am", "9:30 am", "10:00 am", "4:00 pm"];
      db.bookings.forEach((b) => { b.duration = 60; });
      const sb = db.bookings.find((b) => b.id === "b0000000-0000-4000-8000-00000000cc05"); sb.start_time = "10:00 am";
      const { ctx, page } = await boot(db, "08:30");
      await cancelFromPeek(page, "Cian Murphy");
      const times = await offerButtons(page);
      check("(o9) an hour-long lesson is offered only where it fits: 9:00 am, not 9:30 am, which runs into Saoirse's 10:00", JSON.stringify(times) === JSON.stringify(["9:00 am"]), times.join(", ") || "none");
      await ctx.close();
    }

    /* ---------- (d6) a request left from last month ---------- */
    {
      const db = freshDb();
      const old = dayPlus(db, -40);
      const rq = db.bookings.find((b) => b.id === "b0000000-0000-4000-8000-00000000cc06"); rq.booking_date = old;
      const before = db.bookings.length;
      const { ctx, page } = await boot(db);
      await page.locator("button", { hasText: /^Decline$/ }).first().click(); await page.waitForTimeout(800);
      const t = await sheetText(page);
      const offeredOld = await offerButtons(page);
      check("(d6) a request left from last month offers nothing — Nothing open that day, never a time on a day gone by",
            /Nothing open that day/.test(t) && offeredOld.length === 0 && db.bookings.length === before, JSON.stringify({ offeredOld, t: t.slice(0, 120) }));
      await ctx.close();
    }
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  }
  check("(z) no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); M.stopServer(server);
  const s = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(s, null, 2));
  process.exit(0);
})();
