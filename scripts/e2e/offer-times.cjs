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
   d7     Just decline: Request declined, never Lesson cancelled
   d8     an offered time is one write: the request moved and confirmed,
          the player told once, "asked for 10:00 am" on the line
   d9     a junior's request declined reaches the parent as a request
   d10    a request the player takes back: the coach reads a withdrawal
          and the asking notice goes with it

   Usage: node offer-times.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4491), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", junior: "00000000-0000-4000-8000-00000000c41d", parent: "00000000-0000-4000-8000-00000000c0a7" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const CC06 = "b0000000-0000-4000-8000-00000000cc06";   /* the request: tomorrow at 10:00 am */
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
const TIMES = /\d{1,2}:\d\d [ap]m/g;
const { check, summary } = M.checker("offer-times");

function freshDb({ hours = true, away = null, family = false, requestFor = "adult" } = {}) {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  /* with `family`, Saoirse is a junior in Orla's family, so a notice about her reaches Orla */
  if (family) M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  if (family) person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, dob: "2013-09-09", ...(family ? { familyId: FAM } : {}) });
  const week = hours ? M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) : M.weekOf([], []);
  if (away) week.away = [{ from: away, to: away }];
  M.setPrefs(db, IDS.coach, { setup_done: true, availability: week });
  const t0 = dayPlus(db, 0), t1 = dayPlus(db, 1);
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000cc03", coachId: IDS.coach, playerId: IDS.adult, date: t0, time: "4:00 pm", duration: 45 });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000cc05", coachId: IDS.coach, playerId: IDS.junior, date: t0, time: "11:00 am", duration: 45 });
  M.addBooking(db, { id: CC06, coachId: IDS.coach, playerId: IDS[requestFor], date: t1, time: "10:00 am", duration: 45, status: "requested" });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000cc07", coachId: IDS.coach, playerId: IDS.junior, date: t1, time: "4:00 pm", duration: 45 });
  return db;
}

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, hm = "10:30", role = "coach") => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
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
  const dayOf = (iso) => Number(iso.slice(8, 10)), monthOf = (iso) => Number(iso.slice(5, 7));
  /* a player's Diary on a day: the Calendar view, the month moved on where the day is in the next one */
  const openDay = async (page, db, iso) => {
    await M.tap(page, '[aria-label="Diary"]', 1000);
    if ((await page.locator('[data-tour="cal-view"] button[aria-pressed="true"]').getAttribute("aria-label")) !== "Calendar") await M.tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 600);
    if (monthOf(iso) !== monthOf(dayPlus(db, 0))) await M.tap(page, '[aria-label="Next month"]', 600);
    await M.tap(page, `[data-day="${dayOf(iso)}"]`, 700);
  };
  const toldFor = (db, uid, id) => db.notifications.filter((n) => n.user_id === uid && n.data && n.data.id === id).map((n) => `${n.title} · ${n.body}`);

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
      /* nothing was ever booked: the player is told "Request declined" with the
         day and the coach — never "Lesson cancelled", a lesson they never had */
      const told = db.notifications.filter((n) => n.user_id === IDS.adult && n.data && n.data.id === "b0000000-0000-4000-8000-00000000cc06").map((n) => `${n.title} · ${n.body}`);
      check("(d7) Just decline tells the player Request declined · the day · the coach, never Lesson cancelled",
            told.length === 1 && /^Request declined · .* 10:00 am · /.test(told[0]) && !told.some((x) => /Lesson cancelled/.test(x)), JSON.stringify(told));
      await ctx.close();
    }

    /* ---------- (d8) the offer is one write: the request moved and confirmed ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db);
      const before = db.bookings.length, t1 = dayPlus(db, 1);
      await page.locator("button", { hasText: /^Decline$/ }).first().click(); await page.waitForTimeout(800);
      await page.locator('[data-tour="decline-offer"] button', { hasText: /^11:00 am$/ }).click(); await page.waitForTimeout(900);
      const t = M.norm(await M.rootText(page));
      await shot("05-offered"); await page.waitForTimeout(600);
      const req = db.bookings.find((b) => b.id === CC06);
      const theirs = db.bookings.filter((b) => b.player_id === IDS.adult && b.booking_date === t1);
      check("(d8) an offered time is the request's own row moved and confirmed — never a cancel and a second booking",
            !!req && req.status === "confirmed" && req.start_time === "11:00 am" && req.booking_date === t1 && theirs.length === 1 && db.bookings.length === before,
            JSON.stringify({ status: req && req.status, time: req && req.start_time, theirs: theirs.length, added: db.bookings.length - before }));
      const told = toldFor(db, IDS.adult, CC06);
      check("(d8) …and the player is told once: Lesson confirmed · the day 11:00 am · asked for 10:00 am — no Lesson booked, no Request declined",
            told.length === 1 && /^Lesson confirmed · .* 11:00 am · asked for 10:00 am$/.test(told[0]) && !told.some((x) => /Lesson booked|Lesson cancelled|Request declined/.test(x)), JSON.stringify(told));
      check("(d8) the request leaves Today and the toast says Booked · Cian Murphy · 11:00 am",
            (await page.locator("button", { hasText: /^Decline$/ }).count()) === 0 && /Booked/.test(t) && /Cian Murphy · 11:00 am/.test(t), t.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (d9) a junior's request declined reaches the parent as a request ---------- */
    {
      const db = freshDb({ family: true, requestFor: "junior" });
      const { ctx, page } = await boot(db);
      await page.locator("button", { hasText: /^Decline$/ }).first().click(); await page.waitForTimeout(800);
      await page.locator("[data-sheet] button", { hasText: /^Just decline$/ }).first().click(); await page.waitForTimeout(1200);
      const parent = toldFor(db, IDS.parent, CC06), child = toldFor(db, IDS.junior, CC06);
      check("(d9) a junior's request declined: the parent reads Saoirse's request declined · the day, the child Request declined — never 's lesson cancelled",
            parent.length === 1 && /^Saoirse's request declined · .* 10:00 am$/.test(parent[0]) && child.length === 1 && /^Request declined · .* 10:00 am · Niamh Byrne$/.test(child[0]),
            JSON.stringify({ parent, child }));
      await ctx.close();
    }

    /* ---------- (d10) the player takes a request back ---------- */
    {
      const db = freshDb();
      /* the coach's own notice for the request, read already, as the trigger wrote it when it was asked */
      M.addNotification(db, { userId: IDS.coach, kind: "booking", title: "Cian Murphy asked for a lesson", body: "10:00 am", data: { screen: "today", id: CC06 }, readAt: new Date(db.now() - 3600000).toISOString() });
      const { ctx, page, shot } = await boot(db, "09:00", "adult");
      await openDay(page, db, dayPlus(db, 1));
      const t0 = M.norm(await M.rootText(page));
      check("(d10) the player's Diary reads the request as waiting, with Cancel", /Requested/.test(t0) && (await page.locator('[data-tour="day-cancel"]').count()) === 1, t0.slice(0, 200));
      await M.tap(page, '[data-tour="day-cancel"]', 800);
      await page.locator('[data-tour="cancel-why"]', { hasText: "Away" }).click(); await page.waitForTimeout(300);
      await shot("06-withdraw");
      await page.locator("button", { hasText: /^Cancel the lesson$/ }).last().click(); await page.waitForTimeout(1800);
      const req = db.bookings.find((b) => b.id === CC06);
      const coach = toldFor(db, IDS.coach, CC06);
      check("(d10) the coach's asked-for notice goes and one line says Cian Murphy withdrew a request · Away · the day — never cancelled",
            !!req && req.status === "cancelled" && coach.length === 1 && /^Cian Murphy withdrew a request · Away · .* 10:00 am$/.test(coach[0]) && !coach.some((x) => /asked for a lesson|cancelled/.test(x)),
            JSON.stringify({ status: req && req.status, coach }));
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
