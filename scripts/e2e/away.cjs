/* AWAY. A coach marks the days they are not coaching — a holiday, a
   tournament, a closed course — as spans on their hours, and no diary
   offers a time on them. This suite proves the Settings row (found by
   "holiday"), the span added with From · To, the row with its days and
   the lessons still booked, the coach's diary striking the days and
   reading Away, a player's diary offering nothing and naming the coach,
   a parent booking for a child the same, Remove bringing the times
   back, and the spans on the coach's own preferences row.
   Usage: node away.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4331), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const BK = { cian: "b0000000-0000-4000-8000-00000000aa01", kid: "b0000000-0000-4000-8000-00000000aa02" };
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
  /* two lessons already booked inside the week the coach will mark away */
  M.addBooking(db, { id: BK.cian, coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 3), time: "10:00 am", duration: 45 });
  M.addBooking(db, { id: BK.kid, coachId: IDS.coach, playerId: IDS.junior, date: dayPlus(db, 4), time: "11:00 am", duration: 60 });
  return db;
}

const { check, results, summary } = M.checker("away");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const FROM = dayPlus(db, 2), TO = dayPlus(db, 5), OUTSIDE = dayPlus(db, 1);
  const dayOf = (iso) => Number(iso.slice(8, 10)), monthOf = (iso) => Number(iso.slice(5, 7));
  const todayIso = dayPlus(db, 0);
  const boot = async (role) => {
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
  const openSettings = async (page) => {
    await tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 800);
    if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
  };
  /* the diary on its Calendar half, the month of `iso` showing, that day picked */
  const openDay = async (page, iso) => {
    await tap(page, '[aria-label="Diary"]', 1000);
    if ((await page.locator('[data-tour="cal-view"] button[aria-pressed="true"]').getAttribute("aria-label")) !== "Calendar") await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 600);
    if (monthOf(iso) !== monthOf(todayIso)) await tap(page, '[aria-label="Next month"]', 600);
    await tap(page, `[data-day="${dayOf(iso)}"]`, 700);
  };
  const dayCell = (page, iso) => page.locator(`[data-day="${dayOf(iso)}"] span`).first();
  const struck = async (page, iso) => (await dayCell(page, iso).evaluate((el) => getComputedStyle(el).textDecorationLine)).includes("line-through");

  try {
    /* ---------- (a) the coach: the Settings row, found by "holiday" ---------- */
    const coach = await boot("coach");
    {
      const { page, text, shot } = coach;
      await openSettings(page);
      await page.locator('input[aria-label="Search settings"]').fill("holiday"); await page.waitForTimeout(400);
      const row = page.locator('[data-tour="settings-away"]');
      check("(a) Settings carries Away, found by \"holiday\", with no value while nothing is planned", (await row.count()) === 1 && /Away/.test(await row.innerText()) && !/Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep/.test(await row.innerText()), await row.innerText());
      await row.click(); await page.waitForTimeout(900);
      const t0 = await text(); await shot("01-away-empty");
      check("(a) the Away screen opens on nothing planned, with Add days away and no count in its subtitle", /^Away/m.test(t0) && /Nothing planned/.test(t0) && (await page.locator('[data-tour="away-add"]').count()) === 1 && !/\d+ days?/.test(t0.split("Nothing planned")[0]), t0.slice(0, 160));

      /* ---------- (b) a span added with From · To ---------- */
      await tap(page, '[data-tour="away-add"]', 500);
      check("(b) Add days away unfolds From and To, each reading the day the app's way", (await page.locator('[data-tour="away-from"]').count()) === 1 && (await page.locator('[data-tour="away-to"]').count()) === 1 && /From/.test(await text()) && /To/.test(await text()));
      await page.locator('[data-tour="away-from"]').fill(FROM); await page.waitForTimeout(200);
      await page.locator('[data-tour="away-to"]').fill(TO); await page.waitForTimeout(200);
      await tap(page, '[data-tour="away-save"]', 900);
      const t1 = await text(); await shot("02-away-span");
      const prefAway = ((db.prefs[IDS.coach] || {}).availability || {}).away;
      check("(b) Add puts the span in the list — four days, two lessons booked, Call off beside it — and 4 days in the subtitle", (await page.locator("[data-away-row]").count()) === 1 && /4 days/.test(t1) && /2 lessons booked/.test(t1) && (await page.locator('[data-tour="away-calloff"]').count()) === 1, t1.slice(0, 220));
      check("(b) the span is on the coach's own preferences row, beside the week's hours, which are untouched", Array.isArray(prefAway) && prefAway.length === 1 && prefAway[0].from === FROM && prefAway[0].to === TO && JSON.stringify(((db.prefs[IDS.coach] || {}).availability || {}).days) === JSON.stringify(M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]).days), JSON.stringify(prefAway));
      await M.back(page); await page.waitForTimeout(700);
      const rowSub = await page.locator('[data-tour="settings-away"]').innerText();
      check("(b) back in Settings the Away row carries the span as its value", /–/.test(rowSub) && /\d/.test(rowSub), rowSub);

      /* ---------- (c) the coach's diary ---------- */
      await openDay(page, FROM);
      await shot("03-coach-diary-away");
      const t2 = await text();
      check("(c) the month grid strikes the away days through, and not the day before", (await struck(page, FROM)) && (await struck(page, TO)) && !(await struck(page, OUTSIDE)));
      check("(c) the day picked reads Away with nothing offered and Edit, and no Free times", (await page.locator('[data-tour="cal-away"]').count()) === 1 && /Nothing offered/.test(t2) && !/^Free$/m.test(t2) && /Edit/.test(t2), t2.slice(0, 200));
      await tap(page, `[data-day="${dayOf(dayPlus(db, 3))}"]`, 700);
      const t3 = await text();
      check("(c) a booked day inside the span reads Away · 1 lesson still booked, the lesson under it, Call off under that", /1 lesson still booked/.test(t3) && /Cian Murphy/.test(t3) && (await page.locator('[data-tour="cal-weather"]').count()) === 1, t3.slice(0, 220));
      await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      const boxes = page.locator('.nsc-day[data-away="1"]');
      check("(c) the List view carries one box per away day leading with Away, the booked days keeping their lessons", (await boxes.count()) === 4 && /Away/.test(await boxes.first().innerText()) && /Cian Murphy/.test(await boxes.nth(1).innerText()) && !/4:00 pm/.test(await boxes.first().innerText()), String(await boxes.count()));
    }

    /* ---------- (d) a player's diary ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await openDay(page, FROM);
      const t4 = await text(); await shot("04-player-diary-away");
      check("(d) the player's month grid strikes the days through and the day picked reads Niamh is away, with no times", (await struck(page, FROM)) && /Niamh is away/.test(t4) && !/10:00/.test(t4.split("Niamh is away")[1] || ""), t4.slice(0, 200));
      await tap(page, `[data-day="${dayOf(OUTSIDE)}"]`, 700);
      check("(d) the day before the span still offers the week's times", /9:00/.test(await text()) && !/is away/.test(await text()), (await text()).slice(0, 160));
      await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      const pb = page.locator('.nsc-day[data-away="1"]');
      check("(d) the List view's boxes for those days read Away · no lessons and nothing else", (await pb.count()) === 4 && /Away · no lessons/.test(await pb.first().innerText()) && !/am|pm/.test(await pb.first().innerText()), String(await pb.count()));
      await ctx.close();
    }

    /* ---------- (e) a parent booking for a child ---------- */
    {
      const { ctx, page, text } = await boot("parent");
      await openDay(page, FROM);
      const t5 = await text();
      check("(e) a parent booking for Saoirse reads the child's coach as away on those days", /Book for Saoirse|Saoirse/.test(t5) && /Niamh is away/.test(t5), t5.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (f) Remove brings the times back ---------- */
    {
      const { page, text } = coach;
      await openSettings(page); await tap(page, '[data-tour="settings-away"]', 900);
      const row = page.locator("[data-away-row]").first();
      const b = await row.boundingBox();
      await page.mouse.move(b.x + b.width - 20, b.y + b.height / 2); await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width - 20 - (b.width * 0.8 * i) / 10, b.y + b.height / 2);
      await page.mouse.up(); await page.waitForTimeout(900);
      const t6 = await text();
      check("(f) a swipe removes the span: Nothing planned, and the preferences row carries none", (await page.locator("[data-away-row]").count()) === 0 && /Nothing planned/.test(t6) && ((((db.prefs[IDS.coach] || {}).availability || {}).away) || []).length === 0, t6.slice(0, 160));
      await M.back(page); await page.waitForTimeout(500);
      await openDay(page, FROM);
      check("(f) the coach's diary offers the day's times again", !(await struck(page, FROM)) && (await page.locator('[data-tour="cal-away"]').count()) === 0 && /Free/.test(await text()), (await text()).slice(0, 160));
      await coach.ctx.close();
    }

    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
