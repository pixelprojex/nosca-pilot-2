/* THE DIARY'S PER-DAY SHEET IS THAT DATE.

   The pencil on a day in the coach's Diary (List view, aria "Edit this
   day") opens EditDay. For a long time it was titled with the date and
   wrote every change to that weekday's hours for every week: one tap
   took 9:00 off every Thursday, emptying it took Thursdays out of every
   player's diary and a confirmed lesson out of the coach's List, and
   its Group only / Private only were never saved. Now:

   (a) it is headed with the date ("Thu 22 Oct"), its subtitle the count
       of times ("5 times", nothing at nought), and "Every Thursday" at
       its foot opens Hours on that weekday;
   (b) nothing goes by a tap — Edit puts a red minus on each free time,
       a booked time carries who and no minus, Done takes them off — and
       a time taken off is that date's alone (availability.blocked), the
       week untouched;
   (c) Add a time is the app's tile grid of the half hours not on the
       day; adding a blocked weekly time unblocks it, any other time is
       that date's (availability.extra); a player's diary offers it on
       that date only, and a parent booking for a child reads the
       child's coach's blocked times;
   (d) an emptied day reads "Nothing offered", never a nought, and no
       kind control is left anywhere;
   (e) the coach's List never drops a confirmed lesson — a booking
       outside the hours, or on a day with none, is a row;
   (f) a refused write is said and the sheet stays as it was;
   (g) today's times already gone and an away day offer nothing; a
       booked day: who on the tile, no minus on it, Edit ending by
       itself, Call off opening on that day; a time blocked in the
       Calendar view coming back through the sheet; an entry for last
       year or a day gone by neither read nor moved a year on;
   (h) the harness's sheet, with no account;
   (s) Settings › Setup opened again opens on the stored week — the days
       that hold a time, every time they hold, the length — and Finish
       writes only what changed: a day off emptied, a time ticked or
       unticked changing each day by exactly that, the length alone, the
       dated times and the days away untouched, nothing at all when
       nothing changed (24 November);
   (t) a name on a booked or a requested tile never breaks inside a word
       (24 November): at 390 "Maximiliano Ó Súilleabháin" stands whole on
       two lines, three across; at 320, where even "Maximiliano" ran past a
       tile three across and ended on an ellipsis, the day's tiles go two
       across (28 November) and the whole name stands on two lines; a name that fits
       (Cian Murphy) is never shortened; every rendered line, read off the
       characters' own boxes, starts and ends on a whole word; and a word
       wider than the tile ends on an ellipsis, never broken.

   Usage: node edit-day.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4481), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = {
  coach:  "00000000-0000-4000-8000-00000000c0ac",
  adult:  "00000000-0000-4000-8000-0000000adu17",
  parent: "00000000-0000-4000-8000-000000pa4e07",
  junior: "00000000-0000-4000-8000-00000000c41d",
  long:   "00000000-0000-4000-8000-0000000710n6",
};
const LONG = "Maximiliano Ó Súilleabháin";
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
const DOW = (iso) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;   // the app's Monday-first index
const label = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${DAYS[DOW(iso)].slice(0, 3)} ${d.getDate()} ${MON[d.getMonth()]}`; };

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach",  "coach@t.ie",  { role: "coach",  name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult",  "adult@t.ie",  { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly",  type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* five times a day on every weekday but one; that one carries a lesson */
  const BARE = dayPlus(db, 3);
  const week = M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== DOW(BARE)));
  week.blocked = [`${dayPlus(db, 2)}|10:00 am`];
  M.setPrefs(db, IDS.coach, { setup_done: true, availability: week });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000ed01", coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 8), time: "9:00 am", duration: 45 });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000ed02", coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 15), time: "8:00 am", duration: 45 });
  M.addBooking(db, { id: "b0000000-0000-4000-8000-00000000ed03", coachId: IDS.coach, playerId: IDS.adult, date: BARE, time: "10:00 am", duration: 45 });
  return db;
}

const { check, summary } = M.checker("edit-day");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const db = freshDb();
  const TOM = dayPlus(db, 1), NEXT = dayPlus(db, 8), AFTER = dayPlus(db, 15), BARE = dayPlus(db, 3), LATER = dayPlus(db, 2);
  /* every day is counted from the one the page clock is pinned to, so a
     run that crosses midnight still agrees with its fixture */
  const TODAY = dayPlus(db, 0);
  const boot = async (role, d = db, width = 390) => {
    const u = Object.values(d.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`)); await M.attach(page, d);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") { const tx = m.text(); if (!/vibrate|Failed to load resource|favicon/i.test(tx)) errors.push(`${role} console: ${tx.slice(0, 160)}`); } });
    await M.injectSession(page, M.session(u, d));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    return { ctx, page, shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) }) };
  };
  const { tap } = M;
  const hours = (d = db) => ((d.prefs[IDS.coach] || {}).availability || {});
  const sheet = (page) => page.locator("[data-sheet]");
  const sheetText = async (page) => M.norm(await sheet(page).innerText());
  const dayBox = (page, name) => page.locator("div.mb-6").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) }).first();
  /* a coach's free hours fold into one chip, Free · 4, on every day but the first one bookable (28 November, the
     class plan's S3): the day's hours are read laid out, the chip tapped first */
  const boxText = async (page, name) => {
    const b = dayBox(page, name); if (!(await b.count())) return "";
    const fold = b.locator('[data-tour="agenda-free"]');
    if (await fold.count()) { await fold.first().click(); await page.waitForTimeout(400); }
    return M.norm(await b.innerText());
  };
  const openList = async (page) => {
    await tap(page, '[aria-label="Diary"]', 1000);
    const list = page.locator('[data-tour="cal-view"] [aria-label="List"]');
    if (await list.count()) await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
  };
  const openEdit = async (page, name) => { await dayBox(page, name).locator('[data-tour="agenda-edit"]').dispatchEvent("click"); await page.waitForTimeout(800); };
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").dispatchEvent("click"); await page.waitForTimeout(700); };
  const tileTimes = (page) => page.locator('[data-tour="editday-times"] [data-time]').evaluateAll((els) => els.map((e) => e.getAttribute("data-time")));
  const weekBefore = JSON.stringify(hours().days);

  try {
    /* ---------- (a) the date, its count, and the week as a door ---------- */
    const c = await boot("coach");
    let page = c.page;
    await openList(page);
    await openEdit(page, "Tomorrow");
    await c.shot("01-sheet");
    const s0 = await sheetText(page);
    check("(a1) the sheet opened from tomorrow's pencil is headed with the date, the app's way, and counts its times",
          s0.startsWith(label(TOM)) && /\b5 times\b/.test(s0) && !/\bhours?\b/.test(s0.split("Times")[0]), s0.slice(0, 120));
    const every = page.locator('[data-tour="editday-every"]');
    const everyTxt = (await every.count()) ? M.norm(await every.innerText()) : "";
    check("(a2) \"Every <weekday>\" sits at its foot carrying the week's count", new RegExp(`^Every ${DAYS[DOW(TOM)]}`).test(everyTxt) && /5 times/.test(everyTxt), everyTxt);

    /* ---------- (b) nothing goes by a tap; a removal is that date's ---------- */
    const p0 = JSON.stringify(hours());
    const asButtons = await page.locator('[data-tour="editday-times"] button[data-time]').count();
    const firstTile = page.locator('[data-tour="editday-times"] [data-time]').first();
    if (await firstTile.count()) { await firstTile.dispatchEvent("click"); await page.waitForTimeout(500); }
    check("(b1) outside Edit no time is a button, and a tap on one writes nothing", asButtons === 0 && JSON.stringify(hours()) === p0 && (await tileTimes(page)).length === 5, `buttons=${asButtons}`);
    await tap(page, '[data-tour="editday-edit"]', 500);
    const minus = await page.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').count();
    check("(b2) Edit puts a red minus on every free time", minus === 5 && (await page.locator('[data-tour="editday-edit"]').getAttribute("aria-pressed")) === "true", `minus=${minus}`);
    await page.locator('[data-tour="editday-times"] button[aria-label="Remove 9:00 am"]').dispatchEvent("click"); await page.waitForTimeout(900);
    const h1 = hours();
    check("(b3) the minus on 9:00 am takes it off that date alone: blocked holds it, the week is as it was",
          (h1.blocked || []).includes(`${TOM}|9:00 am`) && JSON.stringify(h1.days) === weekBefore && !(await tileTimes(page)).includes("9:00 am"), JSON.stringify({ blocked: h1.blocked, sameWeek: JSON.stringify(h1.days) === weekBefore }));
    check("(b3b) the count follows: 4 times", /\b4 times\b/.test(await sheetText(page)), (await sheetText(page)).slice(0, 80));
    await tap(page, '[data-tour="editday-edit"]', 500);
    check("(b4) Done takes the minuses away", (await page.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').count()) === 0, "");

    /* ---------- (c) Add a time: tiles, the unblock, a time of that date ---------- */
    await tap(page, '[data-tour="editday-add"]', 600);
    await c.shot("02-add");
    const addCells = page.locator('[data-tour="editday-add-grid"] button');
    const addTimes = await addCells.allInnerTexts();
    const radii = await addCells.evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).borderRadius)));
    check("(c1) Add a time is a grid of the half hours not on the day, tiles and never pills, 9:00 am among them",
          addTimes.length > 20 && addTimes.includes("9:00 am") && addTimes.includes("7:30 am") && !addTimes.includes("10:00 am") && radii.every((r) => r < 20), JSON.stringify({ n: addTimes.length, r: radii.slice(0, 3) }));
    await page.locator('[data-tour="editday-add-grid"] button', { hasText: /^9:00 am$/ }).dispatchEvent("click"); await page.waitForTimeout(900);
    const h2 = hours();
    check("(c2) adding 9:00 am back unblocks it (the way a blocked time comes back), and writes no extra",
          !(h2.blocked || []).includes(`${TOM}|9:00 am`) && !(h2.extra || []).includes(`${TOM}|9:00 am`) && (await tileTimes(page)).includes("9:00 am"), JSON.stringify({ blocked: h2.blocked, extra: h2.extra }));
    if (!(await page.locator('[data-tour="editday-add-grid"]').count())) await tap(page, '[data-tour="editday-add"]', 600);
    await page.locator('[data-tour="editday-add-grid"] button', { hasText: /^7:30 am$/ }).dispatchEvent("click"); await page.waitForTimeout(900);
    const h3 = hours();
    check("(c2b) adding 7:30 am writes it for that date (extra), the week as it was",
          (h3.extra || []).includes(`${TOM}|7:30 am`) && JSON.stringify(h3.days) === weekBefore && (await tileTimes(page))[0] === "7:30 am" && /\b6 times\b/.test(await sheetText(page)), JSON.stringify({ extra: h3.extra, tiles: await tileTimes(page) }));
    await c.shot("03-added");

    /* ---------- (a2b) the week's door opens Hours on that weekday ----------
       Hours opens on Friday by itself, so the door is tried from a day
       that is not a Friday. */
    const DOOR = DOW(TOM) !== 4 ? TOM : LATER;
    if (DOOR !== TOM) { await closeSheet(page); await openEdit(page, label(LATER)); }
    await page.locator('[data-tour="editday-every"]').dispatchEvent("click"); await page.waitForTimeout(1200);
    const unfolded = await page.evaluate(() => { const card = document.querySelector('[data-tour="avail-days"]'); const ex = card && card.querySelector("div.px-5.pb-4"); const row = ex && ex.previousElementSibling; const sp = row && row.querySelector("span"); return sp ? sp.textContent.trim() : null; });
    await c.shot("04-hours");
    check("(a2b) a tap on it opens Hours with that weekday unfolded", DOW(DOOR) !== 4 && unfolded === DAYS[DOW(DOOR)], `${unfolded} for ${DAYS[DOW(DOOR)]}`);
    await M.back(page); await page.waitForTimeout(900);

    /* ---------- (e) the coach's List never drops a lesson ---------- */
    await openList(page);
    const nextTxt = await boxText(page, label(NEXT)), afterTxt = await boxText(page, label(AFTER)), bareTxt = await boxText(page, label(BARE));
    check("(e1) a lesson booked outside the week's hours keeps its row in the coach's List", /8:00/.test(afterTxt) && /Cian Murphy/.test(afterTxt), afterTxt.slice(0, 160));
    check("(e1b) a day with no weekly hours that holds a lesson is still a day, with its row", /10:00/.test(bareTxt) && /Cian Murphy/.test(bareTxt), bareTxt.slice(0, 160));
    check("(e2) after the day's edits, next week's same weekday is untouched: its lesson and its hours", /9:00/.test(nextTxt) && /Cian Murphy/.test(nextTxt) && /10:00/.test(nextTxt) && /5:00/.test(nextTxt), nextTxt.slice(0, 200));
    const tomTxt = await boxText(page, "Tomorrow");
    check("(e3) the coach's own List reads tomorrow's 7:30 am", /7:30/.test(tomTxt), tomTxt.slice(0, 160));
    await c.ctx.close();

    /* ---------- (c4) a parent booking for a child reads the child's coach ----------
       (before the player below asks for 7:30, which then becomes a
       taken time for everyone else) */
    const o = await boot("parent");
    await openList(o.page);
    const lt = await boxText(o.page, label(LATER)), ot = await boxText(o.page, "Tomorrow");
    await o.shot("06-parent-list");
    check("(c4) a parent booking for a child is not offered the time the child's coach blocked", /9:00/.test(lt) && !/10:00/.test(lt), lt.slice(0, 160));
    check("(c4b) …and is offered the time the child's coach added on a date", /7:30/.test(ot), ot.slice(0, 160));
    await o.ctx.close();

    /* ---------- (c3) the player reads it, on that date only ---------- */
    const p = await boot("adult");
    await openList(p.page);
    const pt = await boxText(p.page, "Tomorrow"), pn = await boxText(p.page, label(NEXT));
    await p.shot("05-player-list");
    check("(c3) the player's List offers 7:30 am tomorrow, and next week's day keeps its hours without it",
          /7:30/.test(pt) && /9:00/.test(pt) && !/7:30/.test(pn) && /10:00/.test(pn), JSON.stringify({ pt: pt.slice(0, 120), pn: pn.slice(0, 120) }));
    const tomD = Number(TOM.slice(8)), thisMonth = TODAY.slice(0, 7) === TOM.slice(0, 7);
    await tap(p.page, '[data-tour="cal-view"] [aria-label="Calendar"]', 700);
    if (!thisMonth) await tap(p.page, '[aria-label="Next month"]', 600);
    await p.page.locator(`button[data-day="${tomD}"]`).first().dispatchEvent("click"); await p.page.waitForTimeout(700);
    const calTxt = M.norm(await M.rootText(p.page));
    check("(c3b) the Calendar view offers 7:30 am on that day too", /7:30/.test(calTxt), calTxt.slice(0, 200));
    await tap(p.page, '[data-tour="cal-view"] [aria-label="List"]', 700);
    const row730 = dayBox(p.page, "Tomorrow").locator("button", { hasText: /^7:30 am/ });
    if (await row730.count()) { await row730.first().dispatchEvent("click"); await p.page.waitForTimeout(800); }
    const req = p.page.getByRole("button", { name: "Request", exact: true });
    if (await req.count()) { await req.first().click(); await p.page.waitForTimeout(1500); }
    const posted = db.posts.filter((x) => x.table === "bookings").slice(-1)[0];
    check("(c3c) a tap on it asks for that time: the booking posts 7:30 am on that date", !!posted && posted.rows[0].start_time === "7:30 am" && posted.rows[0].booking_date === TOM && posted.rows[0].status === "requested", JSON.stringify(posted && posted.rows[0]));
    await p.ctx.close();

    /* ---------- (d) an emptied day, and no kind control ---------- */
    const c2 = await boot("coach"); page = c2.page;
    await openList(page);
    await openEdit(page, "Tomorrow");
    /* every tile tapped outside Edit: no kind, no change */
    const before = JSON.stringify(hours());
    for (const el of await page.locator('[data-tour="editday-times"] [data-time]').all()) { await el.dispatchEvent("click"); await page.waitForTimeout(120); }
    const tappedTxt = await sheetText(page);
    check("(d0) a tap on each time outside Edit sets no kind and writes nothing", !/Group only|Private only|\bGroup\b|\bPrivate\b/.test(tappedTxt) && JSON.stringify(hours()) === before, tappedTxt.slice(0, 160));
    /* (d0b) 24 November: Cian's request for 7:30 holds its hour on the sheet as a booking does — carrying who and
       Requested, and no minus in Edit: the time is not taken from under the ask. The coach answers it (Decline, from the
       Diary's row for it) and the hour is the coach's to take off again — the day below is emptied then */
    await tap(page, '[data-tour="editday-edit"]', 500);
    const held = page.locator('[data-tour="editday-times"] [data-time="7:30 am"]');
    const heldTxt = (await held.count()) ? M.norm(await held.first().innerText()) : "";
    check("(d0b) the requested 7:30 am is held on the sheet: a tile carrying Cian Murphy and Requested, with no minus in Edit",
          (await held.count()) === 1 && (await held.first().getAttribute("data-requested")) === "1" && heldTxt === "7:30 am Cian Murphy Requested" && (await page.locator('[data-tour="editday-times"] [aria-label="Remove 7:30 am"]').count()) === 0,
          heldTxt || "no tile");
    await closeSheet(page);
    await dayBox(page, "Tomorrow").locator('[data-tour="agenda-ask"] [data-tour="agenda-decline"]').first().dispatchEvent("click"); await page.waitForTimeout(900);
    await page.locator("[data-sheet] button", { hasText: /^Just decline$/ }).first().click(); await page.waitForTimeout(1500);
    await openEdit(page, "Tomorrow");
    await tap(page, '[data-tour="editday-edit"]', 500);
    for (let i = 0; i < 12 && (await page.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').count()); i++) {
      await page.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').first().dispatchEvent("click"); await page.waitForTimeout(450);
    }
    await c2.shot("07-emptied");
    const s3 = await sheetText(page);
    const emptyIsBox = await page.locator('[data-tour="editday-empty"]').evaluate((e) => { const cs = getComputedStyle(e); return parseFloat(cs.borderTopWidth) > 0 || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent"); }).catch(() => true);
    check("(d1) an emptied day reads \"Nothing offered\" as a line — no nought, no box — and Add a time is still there",
          /Nothing offered/.test(s3) && !/\b0 (hours?|times?)\b/.test(s3) && !emptyIsBox && (await page.locator('[data-tour="editday-add"]').count()) === 1 && (await page.locator('[data-tour="editday-edit"]').count()) === 0, s3.slice(0, 160));
    check("(d1b) the week's hours are as they were", JSON.stringify(hours().days) === weekBefore, "");
    await closeSheet(page);
    const nextAfter = await boxText(page, label(NEXT));
    check("(d3) emptying tomorrow leaves next week's same weekday whole: 10:00 and 11:00 still there, no 7:30", /10:00/.test(nextAfter) && /11:00/.test(nextAfter) && !/7:30/.test(nextAfter), nextAfter.slice(0, 200));
    const diaryTxt = M.norm(await M.rootText(page));
    check("(d2) no Group only, Private only or kind label in the sheet or the Diary", !/Group only|Private only/.test(s3) && !/Group only|Private only/.test(diaryTxt), "");
    await c2.ctx.close();

    /* ---------- (f) a refused write is said, and the sheet stays as it was ---------- */
    const dbF = freshDb();
    const f = await boot("coach", dbF); page = f.page;
    await page.route(/\/rest\/v1\/preferences/, (route) => (route.request().method() === "GET" ? route.fallback()
      : route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "new row violates row-level security policy for table \"preferences\"" }) })));
    await openList(page);
    await openEdit(page, "Tomorrow");
    await tap(page, '[data-tour="editday-edit"]', 500);
    await page.locator('[data-tour="editday-times"] button[aria-label="Remove 9:00 am"]').dispatchEvent("click");
    let said = "";
    for (let i = 0; i < 25 && !said; i++) { await page.waitForTimeout(100); const tx = M.norm(await M.rootText(page)); if (/Couldn.t save the hours/.test(tx)) said = tx; }
    await page.waitForTimeout(1200);
    check("(f1) a refused write says \"Couldn't save the hours\" and the sheet's times are as before",
          !!said && (await tileTimes(page)).includes("9:00 am") && !((hours(dbF).blocked || []).includes(`${TOM}|9:00 am`)), JSON.stringify({ said: !!said, tiles: await tileTimes(page) }));
    await f.ctx.close();

    /* ---------- (g) a booked day, a blocked time, and entries from another year ---------- */
    {
      const dbG = freshDb();
      const Y = Number(TOM.slice(0, 4)), PREV = dayPlus(dbG, -40);
      const hG = dbG.prefs[IDS.coach].availability;
      hG.extra = [`${Y - 1}${TOM.slice(4)}|6:30 am`, `${PREV}|7:00 am`];
      hG.blocked = [...hG.blocked, `${PREV}|9:00 am`];
      const AWAY = dayPlus(dbG, 4);
      hG.away = [{ from: AWAY, to: AWAY }];
      const g = await boot("coach", dbG); page = g.page;
      await openList(page);
      await openEdit(page, "Tomorrow");
      check("(g0) last year's entry for this date is not this year's: no 6:30 am on the sheet", !(await tileTimes(page)).includes("6:30 am"), JSON.stringify(await tileTimes(page)));
      await closeSheet(page);
      /* today, with the clock at nine: what has been and gone is neither
         counted nor offered back */
      await openEdit(page, "Today");
      const todayTiles = await tileTimes(page), todayTxt = await sheetText(page);
      await tap(page, '[data-tour="editday-add"]', 600);
      const todayAdd = await page.locator('[data-tour="editday-add-grid"] button').allInnerTexts();
      check("(g0b) today's sheet leaves out the times already gone: 9:00 am neither a tile nor counted, nothing before it to add",
            !todayTiles.includes("9:00 am") && /\b4 times\b/.test(todayTxt) && !todayAdd.some((x) => /^(6|7|8):\d\d am$|^9:00 am$/.test(x)) && todayAdd.includes("9:30 am"), JSON.stringify({ todayTiles, add: todayAdd.slice(0, 4) }));
      await closeSheet(page);
      /* an away day offers nothing */
      await openEdit(page, label(AWAY));
      const awayTxt = await sheetText(page);
      check("(g0c) an away day's sheet says Away, offers no time and nothing to add",
            /Away/.test(awayTxt) && (await tileTimes(page)).length === 0 && (await page.locator('[data-tour="editday-add"]').count()) === 0 && (await page.locator('[data-tour="editday-edit"]').count()) === 0 && !/Nothing offered/.test(awayTxt), awayTxt.slice(0, 160));
      await closeSheet(page);
      await openEdit(page, label(NEXT));
      await g.shot("08-booked-day");
      const booked = page.locator('[data-tour="editday-times"] [data-booked="1"]');
      const bookedTxt = (await booked.count()) ? M.norm(await booked.first().innerText()) : "";
      check("(g1) a booked time is a tile carrying who", (await booked.count()) === 1 && /^9:00/.test(bookedTxt) && /Cian Murphy/.test(bookedTxt), bookedTxt);
      await tap(page, '[data-tour="editday-edit"]', 500);
      const minusG = await page.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      check("(g2) Edit puts a minus on the four free times and none on the booked one", minusG.length === 4 && !minusG.includes("Remove 9:00 am"), JSON.stringify(minusG));
      for (let i = 0; i < 6 && (await page.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').count()); i++) {
        await page.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').first().dispatchEvent("click"); await page.waitForTimeout(450);
      }
      const leftG = await tileTimes(page);
      check("(g3) taking the last free time off ends Edit by itself: the booked tile stays, Add a time is back",
            JSON.stringify(leftG) === JSON.stringify(["9:00 am"]) && (await page.locator('[data-tour="editday-edit"]').count()) === 0 && (await page.locator('[data-tour="editday-add"]').count()) === 1, JSON.stringify(leftG));
      const stored = hours(dbG);
      check("(g4) a write drops entries for days gone by and never moves one a year on",
            !(stored.blocked || []).some((x) => x.startsWith(PREV) || x.startsWith(`${Y + 1}${PREV.slice(4)}`)) && !(stored.extra || []).some((x) => x.startsWith(PREV) || x.startsWith(`${Y + 1}${PREV.slice(4)}`) || x.endsWith("6:30 am") && x.startsWith(`${Y}${TOM.slice(4)}`)),
            JSON.stringify({ blocked: stored.blocked, extra: stored.extra }));
      await page.locator('[data-tour="editday-calloff"]').dispatchEvent("click"); await page.waitForTimeout(900);
      const whyTxt = await sheetText(page);
      await page.locator("[data-sheet] button", { hasText: /^Weather$/ }).first().dispatchEvent("click"); await page.waitForTimeout(300);
      await page.locator("[data-sheet] button", { hasText: /^Next$/ }).first().dispatchEvent("click"); await page.waitForTimeout(700);
      const callTxt = await sheetText(page);
      /* a chosen tile is filled with the sport's cloth tone since 23 November (golf's #A4C9AC), every other tile the
         quiet key in the sport's pale — read the fill */
      const picked = await page.locator("[data-sheet] button[aria-label]").evaluateAll((els) => els.filter((e) => getComputedStyle(e).backgroundColor === "rgb(164, 201, 172)").map((e) => e.getAttribute("aria-label")));
      check("(g5) Call off on a booked day opens the call-off, and its days start on that day",
            /Why/.test(whyTxt) && callTxt.includes(label(NEXT)) && picked.length === 1 && picked[0].startsWith(label(NEXT)), JSON.stringify({ picked, txt: callTxt.slice(0, 160) }));
      await closeSheet(page);
      /* a time blocked in the Calendar view comes back through the sheet */
      await openEdit(page, label(LATER));
      const laterTiles = await tileTimes(page);
      await tap(page, '[data-tour="editday-add"]', 600);
      const laterAdd = await page.locator('[data-tour="editday-add-grid"] button').allInnerTexts();
      await page.locator('[data-tour="editday-add-grid"] button', { hasText: /^10:00 am$/ }).dispatchEvent("click"); await page.waitForTimeout(900);
      check("(g6) a time blocked on a date is off the sheet and in Add a time, and adding it unblocks it",
            !laterTiles.includes("10:00 am") && laterAdd.includes("10:00 am") && !(hours(dbG).blocked || []).includes(`${LATER}|10:00 am`) && (await tileTimes(page)).includes("10:00 am"), JSON.stringify({ laterTiles, blocked: hours(dbG).blocked }));
      await g.ctx.close();
    }

    /* ---------- (s) Settings › Setup opened again: the stored week, and only what changed ----------
       (24 November) Reopened, Setup's Hours showed no day lit over a coach whose week was Monday to
       Saturday, and Finish rebuilt every day from the tiles — one set of times for the whole week.
       It opens on the week as stored now: the days that hold a time lit, every time they hold lit,
       the length; and Finish writes only what was changed — a day off emptied, a time ticked added
       to the days that stay on, a time unticked taken off them, each day keeping its own — never
       the dated times nor the days away. */
    {
      const dbS = freshDb();
      const FIVE = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
      const av = dbS.prefs[IDS.coach].availability;
      av.days = { 0: FIVE, 1: FIVE, 2: FIVE, 3: FIVE, 4: FIVE, 5: ["9:00 am", "10:00 am"], 6: [] };
      av.slots = ["9:00 am", "10:00 am", "11:00 am", "12:00 pm", "4:00 pm", "5:00 pm"];
      av.duration = 60;
      const EXTRA = `${dayPlus(dbS, 4)}|7:00 pm`, BLOCK = `${dayPlus(dbS, 2)}|10:00 am`;
      av.extra = [EXTRA]; av.blocked = [BLOCK]; av.away = [{ from: dayPlus(dbS, 20), to: dayPlus(dbS, 21) }];
      const S = '[data-tour="setup"]';
      const g = await boot("coach", dbS); const page = g.page;
      const openSetup = async () => {
        if (!(await page.locator('[data-tour="settings-setup"]').count())) await tap(page, '[aria-label="Your profile"]', 900);
        await page.locator('[data-tour="settings-setup"]').first().click(); await page.waitForTimeout(900);
      };
      const grid = () => page.evaluate((S) => { const root = document.querySelector(S); if (!root) return null;
        const btns = [...root.querySelectorAll("button[aria-pressed]")].map((b) => ({ t: b.textContent.trim(), on: b.getAttribute("aria-pressed") === "true" }));
        return { days: btns.filter((b) => /^(Mo|Tu|We|Th|Fr|Sa|Su)$/.test(b.t)), len: btns.filter((b) => / min$/.test(b.t)), times: btns.filter((b) => /^\d{1,2}:\d\d [ap]m$/.test(b.t)) }; }, S);
      const press = async (txt) => { await page.locator(`${S} button[aria-pressed]`, { hasText: new RegExp(`^${txt}$`) }).first().click(); await page.waitForTimeout(250); };
      const finish = async () => {
        for (let i = 0; i < 2; i++) { await page.locator(`${S} button`, { hasText: /^Continue$/ }).first().click(); await page.waitForTimeout(500); }
        await page.locator(`${S} button`, { hasText: /^Finish$/ }).first().click(); await page.waitForTimeout(500);
        const toast = M.norm(await page.locator("[data-toast]").first().innerText().catch(() => "")); await page.waitForTimeout(1500); return toast;
      };
      const week = () => JSON.stringify(hours(dbS).days);
      const posts = () => dbS.posts.filter((x) => x.table === "preferences" && x.rows && x.rows[0] && "availability" in x.rows[0]).length;

      await openSetup();
      const G0 = await grid(); await g.shot("10-setup-reopened");
      check("(s1) reopened, Setup's Hours opens on the stored week: Mo to Sa lit, Su not; 60 min; every time a day holds lit — 12:00 pm, in the pool on no day, not",
        !!G0 && G0.days.filter((d) => d.on).map((d) => d.t).join() === "Mo,Tu,We,Th,Fr,Sa" && G0.len.filter((l) => l.on).map((l) => l.t).join() === "60 min"
          && G0.times.filter((x) => x.on).map((x) => x.t).join("|") === FIVE.join("|") && G0.times.some((x) => x.t === "12:00 pm" && !x.on),
        JSON.stringify(G0));
      const before = week(), postsBefore = posts();
      const t0 = await finish();
      check("(s2) Finish on an untouched setup writes no hours — the week, the dated times and the days away exactly as they were — and says nothing was saved",
        week() === before && posts() === postsBefore && JSON.stringify(hours(dbS).extra) === JSON.stringify([EXTRA]) && JSON.stringify(hours(dbS).blocked) === JSON.stringify([BLOCK]) && /You're set up/.test(t0) && !/saved/i.test(t0),
        JSON.stringify({ same: week() === before, posts: posts() - postsBefore, toast: t0.slice(-80) }));

      /* a time ticked and a time unticked: each day keeps its own times, changed by exactly that */
      await openSetup();
      await press("12:00 pm"); await press("11:00 am");
      const t1 = await finish();
      const d1 = hours(dbS).days;
      const WD = ["9:00 am", "10:00 am", "12:00 pm", "4:00 pm", "5:00 pm"];
      check("(s3) ticking 12:00 pm and unticking 11:00 am changes each day by exactly that: Monday to Friday 9, 10, 12, 4, 5 — Saturday keeps its own, 9, 10 and now 12 — Sunday still nothing",
        [0, 1, 2, 3, 4].every((d) => JSON.stringify(d1[d]) === JSON.stringify(WD)) && JSON.stringify(d1[5]) === JSON.stringify(["9:00 am", "10:00 am", "12:00 pm"]) && (d1[6] || []).length === 0 && /Hours saved/.test(t1),
        JSON.stringify({ d1, toast: t1.slice(-60) }));
      check("(s3) …the dated times, the days away and the length untouched",
        JSON.stringify(hours(dbS).extra) === JSON.stringify([EXTRA]) && JSON.stringify(hours(dbS).blocked) === JSON.stringify([BLOCK]) && (hours(dbS).away || []).length === 1 && hours(dbS).duration === 60,
        JSON.stringify({ extra: hours(dbS).extra, blocked: hours(dbS).blocked, away: hours(dbS).away, duration: hours(dbS).duration }));

      /* a day turned off is emptied, and nothing else moves */
      await openSetup();
      const G1 = await grid();
      check("(s4) opened again it reads what it wrote: Mo to Sa lit, the times 9, 10, 12, 4 and 5", !!G1 && G1.days.filter((d) => d.on).map((d) => d.t).join() === "Mo,Tu,We,Th,Fr,Sa" && G1.times.filter((x) => x.on).map((x) => x.t).join("|") === WD.join("|"), JSON.stringify(G1 && { days: G1.days, times: G1.times }));
      await press("Sa");
      await finish();
      const d2 = hours(dbS).days;
      check("(s4) Saturday turned off is emptied; Monday to Friday keep their own times", (d2[5] || []).length === 0 && [0, 1, 2, 3, 4].every((d) => JSON.stringify(d2[d]) === JSON.stringify(WD)), JSON.stringify(d2));

      /* the length alone */
      await openSetup();
      await press("45 min");
      const wk = week();
      const t3 = await finish();
      check("(s5) the length changed alone writes the length alone — 45 minutes, every day as it was", hours(dbS).duration === 45 && week() === wk && /Hours saved/.test(t3), JSON.stringify({ duration: hours(dbS).duration, toast: t3.slice(-60) }));
      /* and the Diary still offers the dated time on its date */
      await M.back(page); await openList(page);
      const extraDay = await boxText(page, label(dayPlus(dbS, 4)));
      check("(s6) the time added on one date is still offered on it after three setups", /7:00 pm/.test(extraDay), extraDay.slice(0, 120));
      await g.ctx.close();
    }

    /* ---------- (t) a name on a tile never breaks inside a word ---------- */
    {
      const dbT = freshDb();
      M.addUser(dbT, { id: IDS.long, email: "long@t.ie" });
      M.addProfile(dbT, { id: IDS.long, role: "player", name: LONG, type: "adult", coachId: IDS.coach, dob: "1990-01-01" });
      const LONGDAY = dayPlus(dbT, 9);
      M.addBooking(dbT, { coachId: IDS.coach, playerId: IDS.long, date: LONGDAY, time: "9:00 am", duration: 45 });
      M.addBooking(dbT, { coachId: IDS.coach, playerId: IDS.long, date: LONGDAY, time: "10:00 am", duration: 45, status: "requested" });
      M.addBooking(dbT, { coachId: IDS.coach, playerId: IDS.adult, date: LONGDAY, time: "11:00 am", duration: 45 });
      /* each held tile's name as it is laid out: the text it shows, and its lines read off every
         character's own box (a Range a character), so a word split across two lines is two pieces */
      const tiles = (page) => page.evaluate(() => {
        const probe = document.createElement("span"); probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap"; document.body.appendChild(probe);
        const out = [...document.querySelectorAll('[data-tour="editday-times"] [data-time]')].filter((tile) => tile.hasAttribute("data-booked") || tile.hasAttribute("data-requested")).map((tile) => {
          const el = tile.querySelector("[data-tile-name]"); if (!el) return { time: tile.getAttribute("data-time"), missing: true };
          const cs = getComputedStyle(el), box = el.getBoundingClientRect();
          const inL = box.left + parseFloat(cs.paddingLeft), inR = box.right - parseFloat(cs.paddingRight);
          const chars = []; const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walk.nextNode(); n; n = walk.nextNode()) for (let i = 0; i < n.data.length; i++) {
            const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
            const rect = [...r.getClientRects()][0]; if (!rect) continue;
            chars.push({ ch: n.data[i], top: Math.round(rect.top), left: rect.left, right: rect.right, node: n });
          }
          const lines = [];
          chars.forEach((c) => { const L = lines.find((l) => Math.abs(l.top - c.top) <= 3); if (L) L.chars.push(c); else lines.push({ top: c.top, chars: [c] }); });
          lines.sort((a, b) => a.top - b.top);
          const shown = el.textContent.replace(/\s+/g, " ").trim(), words = shown.split(" ");
          probe.style.font = cs.font; probe.style.letterSpacing = cs.letterSpacing;
          /* a word whose characters run past the tile's inside is clipped: say whether it could have
             stood on a line of its own, and whether it ends on the ellipsis */
          const clipped = words.filter((w) => { const cs0 = chars.filter((c) => c.node.data === w); return cs0.length && cs0.some((c) => c.right > inR + 0.5 || c.left < inL - 0.5); })
            .map((w) => { probe.textContent = w; const node = chars.find((c) => c.node.data === w).node;
              return { word: w, wider: probe.getBoundingClientRect().width > inR - inL - 0.5, ellipsis: getComputedStyle(node.parentElement).textOverflow === "ellipsis" }; });
          return { time: tile.getAttribute("data-time"), requested: tile.hasAttribute("data-requested"), shown, words, lines: lines.map((l) => l.chars.sort((a, b) => a.left - b.left).map((c) => c.ch).join("").trim()), clipped,
                   inside: Math.round(inR - inL), tileText: tile.innerText.replace(/\s+/g, " ").trim() };
        });
        probe.remove(); return out;
      });
      /* every line is whole words of what is shown, in order, and no word is split between lines */
      const whole = (t) => !!t && !t.missing && t.lines.length >= 1 && t.lines.length <= 2 && t.lines.every((l) => l.split(" ").every((w) => t.words.includes(w)))
        && t.lines.join(" ").split(" ").join(" ") === t.words.join(" ") && t.clipped.every((c) => c.wider && c.ellipsis);
      for (const width of [390, 320]) {
        const tt = await boot("coach", dbT, width); page = tt.page;
        await openList(page);
        await openEdit(page, label(LONGDAY));
        const T = await tiles(page);
        await tt.shot(`11-long-name-${width}`);
        const long9 = T.find((x) => x.time === "9:00 am"), long10 = T.find((x) => x.time === "10:00 am"), cian = T.find((x) => x.time === "11:00 am");
        const said = JSON.stringify(T.map((x) => ({ t: x.time, shown: x.shown, lines: x.lines, clipped: x.clipped, inside: x.inside })));
        check(`(t1 ${width}) every held tile's lines start and end on whole words — no word broken — and a word cut is one wider than the tile, on its ellipsis`, T.length === 3 && T.every(whole), said);
        const cols = await page.locator('[data-tour="editday-times"]').getAttribute("data-cols");
        if (width === 390) {
          check("(t2 390) at 390 the long name stands whole on two lines, on the booked tile and the requested one, three across", !!long9 && !!long10 && long9.shown === LONG && long10.shown === LONG && long9.lines.length === 2 && long10.lines.length === 2 && cols === "3", `${said} · cols ${cols}`);
        } else {
          /* 28 November: three across at 320 a tile has 71 inside, and even the short form's "Maximiliano" ended on an
             ellipsis ("Maximilia…" — a name cut inside a word, the sweep's loose end). The tile says so and the day's
             tiles go two across, where the whole name stands on two lines; nothing is shortened and nothing is cut */
          check("(t2 320) at 320, where a word of the name would not fit a tile three across, the day's tiles go two across and the long name stands whole on two lines, on the booked tile and the requested one",
            !!long9 && !!long10 && long9.shown === LONG && long10.shown === LONG && long9.lines.length === 2 && long10.lines.length === 2 && long9.clipped.length === 0 && long10.clipped.length === 0 && cols === "2", `${said} · cols ${cols}`);
        }
        check(`(t3 ${width}) a name that fits is never shortened: Cian Murphy whole`, !!cian && cian.shown === "Cian Murphy" && cian.clipped.length === 0, said);
        check(`(t4 ${width}) the requested tile still says Requested under the name, and the time leads both`, !!long10 && long10.requested && /^10:00 am .* Requested$/.test(long10.tileText) && !!long9 && /^9:00 am /.test(long9.tileText), JSON.stringify([long9 && long9.tileText, long10 && long10.tileText]));
        await tt.ctx.close();
      }
    }

    /* ---------- (h) the harness: the same sheet, no account ---------- */
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const hp = await ctx.newPage();
      hp.on("pageerror", (e) => errors.push(`harness: ${String(e.message || e)}`));
      await hp.goto(`${BASE}/?demo`, { waitUntil: "load" });
      await hp.waitForSelector("text=Scenarios", { timeout: 15000 });
      await hp.getByRole("button", { name: "Coach", exact: true }).first().click(); await hp.waitForTimeout(M.SPLASH_MS);
      await openList(hp);
      await hp.locator('[data-tour="agenda-edit"]').first().dispatchEvent("click"); await hp.waitForTimeout(800);
      const h0 = await tileTimes(hp);
      if (await hp.locator('[data-tour="editday-edit"]').count()) await tap(hp, '[data-tour="editday-edit"]', 500);
      const firstMinus = hp.locator('[data-tour="editday-times"] button[aria-label^="Remove "]').first();
      if (await firstMinus.count()) { await firstMinus.dispatchEvent("click"); await hp.waitForTimeout(500); }
      const h1t = await tileTimes(hp);
      check("(h1) in the harness the sheet opens on the day and a time comes off it", h0.length > 0 && h1t.length === h0.length - 1, JSON.stringify({ h0, h1t }));
      await ctx.close();
    }
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  }
  check("(z) no page errors or console warnings", errors.length === 0, errors.slice(0, 4).join(" | "));
  await browser.close(); M.stopServer(server);
  const s = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(s, null, 2));
  process.exit(0);
})();
