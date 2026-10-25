const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4336), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", eoin: "00000000-0000-4000-8000-0000000e0170" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const BK = { group: "b0000000-0000-4000-8000-00000000gr01", aoife: "b0000000-0000-4000-8000-00000000gr02", popup: "b0000000-0000-4000-8000-00000000gr03" };
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));

function freshDb({ popup = false } = {}) {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Doyle", type: "adult", coachId: IDS.coach, dob: "1993-02-02" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* Eoin was in the clinic and has left the roster */
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]), groups: [
    { id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly", "Eoin Walsh"], memberIds: [IDS.adult, IDS.junior, IDS.eoin], day: 5, time: "4:00 pm", weeks: 6, sport: "golf" },
  ] });
  /* today: the clinic at four, Aoife's own lesson at five — and, for (c), a group nobody saved */
  M.addBooking(db, { id: BK.group, coachId: IDS.coach, groupName: "Saturday clinic", date: dayPlus(db, 0), time: "4:00 pm", duration: 60 });
  M.addBooking(db, { id: BK.aoife, coachId: IDS.coach, playerId: IDS.aoife, date: dayPlus(db, 0), time: "5:00 pm", duration: 45 });
  if (popup) M.addBooking(db, { id: BK.popup, coachId: IDS.coach, groupName: "Pop-up clinic", date: dayPlus(db, 0), time: "11:00 am", duration: 60 });
  return db;
}

/* the member's side: the clinic today and in five days, a squad of
   Aoife's on the second, her own lesson at five, and a clinic lesson
   logged two days ago with Cian and Saoirse marked there */
const MB = { today: "b0000000-0000-4000-8000-00000000gr01", far: "b0000000-0000-4000-8000-00000000gr04", aoife: "b0000000-0000-4000-8000-00000000gr02", tues: "b0000000-0000-4000-8000-00000000gr05" };
const GL = "10000000-0000-4000-8000-00000000gl01";
function memberDb() {
  const db = freshDb();
  db.bookings = [];
  db.prefs[IDS.coach].groups.push({ id: "g2", name: "Tuesday squad", members: ["Aoife Doyle"], memberIds: [IDS.aoife], sport: "golf" });
  M.addBooking(db, { id: MB.today, coachId: IDS.coach, groupName: "Saturday clinic", date: dayPlus(db, 0), time: "4:00 pm", duration: 60 });
  M.addBooking(db, { id: MB.far, coachId: IDS.coach, groupName: "Saturday clinic", date: dayPlus(db, 5), time: "4:00 pm", duration: 60 });
  M.addBooking(db, { id: MB.tues, coachId: IDS.coach, groupName: "Tuesday squad", date: dayPlus(db, 2), time: "11:00 am", duration: 60 });
  M.addBooking(db, { id: MB.aoife, coachId: IDS.coach, playerId: IDS.aoife, date: dayPlus(db, 0), time: "5:00 pm", duration: 45 });
  M.addLesson(db, { id: GL, coachId: IDS.coach, groupName: "Saturday clinic", date: dayPlus(db, -2), focus: "Bunker play", subs: [], notes: "Splash, not dig.", createdAt: `${dayPlus(db, -2)}T17:10:00Z` });
  M.addAttendee(db, { lessonId: GL, playerId: IDS.adult }); M.addAttendee(db, { lessonId: GL, playerId: IDS.junior });
  return db;
}


const { check, results, summary } = M.checker("rsvp");
(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, width = 390) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
    await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T09:00:00`));
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false });
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, shot };
  };
  const { tap } = M;
  const told = (db, who, title) => db.notifications.filter((n) => n.user_id === IDS[who] && n.title === title);
  const diaryCal = async (page, day) => {
    await tap(page, '[aria-label="Diary"]', 1500);
    const c = page.locator('[data-tour="cal-view"] button[aria-label="Calendar"]');
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(700); }
    if (day != null) { await page.locator(`[data-day="${day}"]`).first().click(); await page.waitForTimeout(900); }
  };
  const blocks = (page) => page.locator('[data-tour="day-mine"]').allInnerTexts().then((xs) => xs.map((x) => x.replace(/\s+/g, " ")));
  const toastText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  try {
    /* (a) Cian, a member: Not going, then Going */
    {
      const db = memberDb();
      const { ctx, page, shot } = await boot(db, "adult");
      await diaryCal(page);
      const out = page.locator('[data-tour="day-out"]');
      check("(a) the member's clinic block offers Not going", (await out.count()) === 1 && (await out.innerText()).trim() === "Not going", JSON.stringify(await blocks(page)));
      await shot("01-member-block");
      await out.click(); await page.waitForTimeout(1500);
      const t1 = await toastText(page); await shot("02-member-out");
      const row = db.absences.find((x) => x.booking_id === MB.today && x.player_id === IDS.adult);
      const n1 = told(db, "coach", "Cian Murphy can't make Saturday clinic");
      check("(a) Not going writes the member's answer through the function and says so", !!row && row.set_by === IDS.adult && db.rpcs.some((r) => r.fn === "set_group_absence") && /Not going/.test(t1), JSON.stringify(row) + " " + t1.slice(0, 200));
      check("(a) the coach is told once, by the whole name, with the day", n1.length === 1 && /4:00 pm$/.test(n1[0].body || "") && n1[0].data.id === MB.today, JSON.stringify(n1));
      const b2 = await blocks(page); const o2 = page.locator('[data-tour="day-out"]');
      check("(a) the block now reads Not going and offers Going", /^Not going/.test(b2[0] || "") && (await o2.getAttribute("data-out")) === "1" && (await o2.innerText()).trim() === "Going", JSON.stringify(b2));
      await tap(page, '[aria-label="Diary"]', 600);
      const lb = page.locator('[data-tour="cal-view"] button[aria-label="List"]'); if (await lb.count()) { await lb.first().click(); await page.waitForTimeout(700); }
      const rowTxt = (await page.locator('[data-tour="agenda-mine"]', { hasText: "Saturday clinic" }).first().innerText()).replace(/\s+/g, " ");
      await shot("02b-member-list");
      check("(a) the List view's row says Not going under the clinic", /Saturday clinic Not going/.test(rowTxt), rowTxt);
      await page.locator('[data-tour="agenda-mine"]', { hasText: "Saturday clinic" }).first().click(); await page.waitForTimeout(1200);
      await page.locator('[data-tour="day-out"]').click(); await page.waitForTimeout(1500);
      check("(a) Going takes the answer back and the coach is told once", !db.absences.some((x) => x.player_id === IDS.adult) && told(db, "coach", "Cian Murphy can make Saturday clinic").length === 1, JSON.stringify(db.absences));
      await ctx.close();
    }
    /* (b) Orla, for Saoirse: the clinic in five days */
    {
      const db = memberDb();
      const { ctx, page, shot } = await boot(db, "parent");
      await diaryCal(page, String(Number(dayPlus(db, 5).slice(8, 10))));
      const out = page.locator('[data-tour="day-out"]'); await shot("03-parent-block");
      check("(b) a parent booking for a child is offered Not going on the child's clinic", (await out.count()) === 1, JSON.stringify(await blocks(page)));
      if (await out.count()) { await out.click(); await page.waitForTimeout(1500); }
      const row = db.absences.find((x) => x.booking_id === MB.far && x.player_id === IDS.junior);
      check("(b) …which marks the child out, set by the parent; the coach told by the child's whole name", !!row && row.set_by === IDS.parent && told(db, "coach", "Saoirse Kelly can't make Saturday clinic").length === 1, JSON.stringify(db.absences));
      await shot("04-parent-out");
      await ctx.close();
    }
    /* (b2) the coach runs the clinic and has set no hours: the parent still reaches the child's clinic */
    {
      const db = memberDb();
      db.prefs[IDS.coach].availability = { days: {} };
      const { ctx, page, shot } = await boot(db, "parent");
      await diaryCal(page, String(Number(dayPlus(db, 5).slice(8, 10))));
      const out = page.locator('[data-tour="day-out"]'); await shot("03b-parent-nohours");
      const n = await out.count();
      if (n) { await out.click(); await page.waitForTimeout(1500); }
      check("(b2) with no hours set, a parent's Diary still opens on the child's clinic and Not going reaches the coach", n === 1 && db.absences.some((x) => x.booking_id === MB.far && x.player_id === IDS.junior && x.set_by === IDS.parent), `${n} ${JSON.stringify(await blocks(page))}`);
      await ctx.close();
    }
    /* (c) Saoirse, a junior: read only */
    {
      const db = memberDb();
      const { ctx, page } = await boot(db, "junior");
      await diaryCal(page, String(Number(dayPlus(db, 5).slice(8, 10))));
      check("(c) a junior's own diary offers no Not going (a parent answers)", (await page.locator('[data-tour="day-mine"]').count()) >= 1 && (await page.locator('[data-tour="day-out"]').count()) === 0, JSON.stringify(await blocks(page)));
      await ctx.close();
    }
    /* (d) the coach sees who is out on the clinic's block */
    {
      const db = memberDb();
      db.absences.push({ booking_id: MB.today, player_id: IDS.adult, coach_id: IDS.coach, set_by: IDS.adult, created_at: new Date(db.now()).toISOString() });
      const { ctx, page, shot } = await boot(db, "coach");
      await diaryCal(page);
      const blk = page.locator('[data-tour="cal-block"]', { hasText: "Saturday clinic" }).first();
      const line = (await blk.count()) ? (await blk.innerText()).replace(/\s+/g, " ") : "";
      check("(d) the coach's clinic block carries the count not going", /1 not going/.test(line), line);
      if (await blk.count()) { await blk.locator("button").first().click(); await page.waitForTimeout(900); }
      const names = (await page.locator('[data-tour="block-out"]').count()) ? (await page.locator('[data-tour="block-out"]').innerText()).replace(/\s+/g, " ") : "";
      await shot("05-coach-block");
      check("(d) …and, open, names who", /Not going\s*Cian Murphy/i.test(names), names);
      await ctx.close();
    }
    /* (d2) a member who said Not going and has since left the coach is
       counted nowhere, and the register writes them nothing */
    {
      const db = memberDb();
      db.absences.push({ booking_id: MB.today, player_id: IDS.eoin, coach_id: IDS.coach, set_by: IDS.eoin, created_at: new Date(db.now()).toISOString() });
      const { ctx, page } = await boot(db, "coach");
      await tap(page, '[aria-label="Diary"]', 600);
      const lb = page.locator('[data-tour="cal-view"] button[aria-label="List"]'); if (await lb.count()) { await lb.first().click(); await page.waitForTimeout(700); }
      const arow = page.locator('[data-tour="agenda-row"]', { hasText: "Saturday clinic" }).first();
      const txt = (await arow.innerText()).replace(/\s+/g, " ");
      await arow.dispatchEvent("click"); await page.waitForTimeout(900);
      await tap(page, '[data-tour="peek-register"]', 1200);
      for (const r of await page.locator("[data-reg-row]").all()) await r.locator("button", { hasText: "Present" }).click();
      const before = db.marks.length;
      await page.getByRole("button", { name: /Submit register/ }).click().catch(() => {}); await page.waitForTimeout(1500);
      const written = db.marks.slice(before);
      check("(d2) a member gone from the roster is not counted, and the register writes marks only for the roll it showed", !/not going/.test(txt) && written.length > 0 && !written.some((m) => m.player_id === IDS.eoin), `${txt} · ${JSON.stringify(written.map((m) => m.player_id))}`);
      await ctx.close();
    }
    /* (h) at 320 the counts take a line of their own: the group's name
       whole on the List rows, the block's grey line one line, and
       "2 not going" never broken */
    {
      const db = memberDb();
      db.absences.push({ booking_id: MB.today, player_id: IDS.adult, coach_id: IDS.coach, set_by: IDS.adult, created_at: new Date(db.now()).toISOString() });
      db.absences.push({ booking_id: MB.today, player_id: IDS.junior, coach_id: IDS.coach, set_by: IDS.parent, created_at: new Date(db.now()).toISOString() });
      const fit = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
        const name = el.querySelector(".truncate"), cnt = el.querySelector('[data-tour$="out-count"], [data-tour="agenda-out"]');
        return { name: name ? name.scrollWidth <= name.clientWidth + 1 : null, text: name ? name.textContent : "", cnt: cnt ? cnt.getBoundingClientRect().height : null };
      }), sel);
      {
        const { ctx, page, shot } = await boot(db, "coach", 320);
        await tap(page, '[aria-label="Diary"]', 600);
        const lb = page.locator('[data-tour="cal-view"] button[aria-label="List"]'); if (await lb.count()) { await lb.first().click(); await page.waitForTimeout(700); }
        const rows = (await fit(page, '[data-tour="agenda-row"]')).filter((r) => /Saturday clinic/.test(r.text));
        await shot("08-coach-320-list");
        check("(h) at 320 the coach's List row keeps the clinic's name whole, the count on one line under it", rows.length >= 1 && rows[0].name === true && rows[0].cnt > 0 && rows[0].cnt < 24, JSON.stringify(rows));
        const c = page.locator('[data-tour="cal-view"] button[aria-label="Calendar"]'); await c.first().click(); await page.waitForTimeout(800);
        const blk = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tour="cal-block"]')].find((x) => /Saturday clinic/.test(x.textContent)); if (!b) return null;
          const line = [...b.querySelectorAll("span.block")].find((x) => /pm · Group/.test(x.textContent)); const cnt = b.querySelector('[data-tour="block-out-count"]');
          return { line: line ? line.getBoundingClientRect().height : null, lineText: line ? line.textContent : "", cnt: cnt ? cnt.getBoundingClientRect().height : null, cntText: cnt ? cnt.textContent : "" }; });
        await shot("09-coach-320-block");
        check("(h2) at 320 the block's grey line is the time and the kind on one line, and \"2 not going\" whole on its own", !!blk && blk.line < 24 && !/not going/.test(blk.lineText) && blk.cnt < 24 && blk.cntText === "2 not going", JSON.stringify(blk));
        await ctx.close();
      }
      {
        const { ctx, page, shot } = await boot(db, "adult", 320);
        await tap(page, '[aria-label="Diary"]', 600);
        const lb = page.locator('[data-tour="cal-view"] button[aria-label="List"]'); if (await lb.count()) { await lb.first().click(); await page.waitForTimeout(700); }
        const rows = (await fit(page, '[data-tour="agenda-mine"]')).filter((r) => /Saturday clinic/.test(r.text));
        await shot("10-member-320-list");
        check("(h3) at 320 the member's List row keeps the clinic's name whole, Not going on one line under it", rows.length >= 1 && rows[0].name === true && rows[0].cnt > 0 && rows[0].cnt < 24, JSON.stringify(rows));
        await ctx.close();
      }
    }
    /* (e) a project without the table offers nothing */
    {
      const db = memberDb(); db.noAbsences = true;
      const { ctx, page } = await boot(db, "adult");
      await diaryCal(page);
      check("(e) without group_absences nothing is offered and the block is as it was", (await page.locator('[data-tour="day-mine"]').count()) >= 1 && (await page.locator('[data-tour="day-out"]').count()) === 0, JSON.stringify(await blocks(page)));
      await ctx.close();
    }
    /* (f) the coach's notice lands on the Diary on the clinic's day, and a
       fresh register for it starts with the member out marked absent */
    {
      const db = memberDb();
      db.absences.push({ booking_id: MB.far, player_id: IDS.adult, coach_id: IDS.coach, set_by: IDS.adult, created_at: new Date(db.now()).toISOString() });
      M.notify(db, IDS.coach, "booking", "Cian Murphy can't make Saturday clinic", `${dayPlus(db, 5)} 4:00 pm`, { screen: "calendar", id: MB.far });
      db.absences.push({ booking_id: MB.today, player_id: IDS.junior, coach_id: IDS.coach, set_by: IDS.parent, created_at: new Date(db.now()).toISOString() });
      const { ctx, page, shot } = await boot(db, "coach");
      /* the home's catch-up carries an unread notice; else the bell */
      let row = page.locator('[data-tour="catchup-list"] button', { hasText: "Cian Murphy can't make Saturday clinic" });
      if (!(await row.count())) { await tap(page, '[aria-label="Alerts"]', 900); row = page.locator('[data-tour="alerts-list"] button', { hasText: "Cian Murphy can't make Saturday clinic" }); }
      const had = await row.count(); if (had) { await row.first().dispatchEvent("click"); await page.waitForTimeout(1500); }
      const l = await page.evaluate(() => { const on = document.querySelector('[data-day][aria-pressed="true"]'); const v = document.querySelector('[data-tour="cal-view"] button[aria-pressed="true"]'); return { day: on ? on.getAttribute("data-day") : null, view: v ? v.getAttribute("aria-label") : null }; });
      const blk = page.locator('[data-tour="cal-block"]', { hasText: "Saturday clinic" });
      const line = (await blk.count()) ? (await blk.first().innerText()).replace(/\s+/g, " ") : "";
      await shot("06-coach-lands");
      check("(f) the coach's notice opens the Diary on the clinic's day, its block counting one not going", had === 1 && l.day === String(Number(dayPlus(db, 5).slice(8, 10))) && l.view === "Calendar" && /1 not going/.test(line), `${had} ${JSON.stringify(l)} ${line}`);
      /* today's clinic, Saoirse out: Register from the lesson's peek */
      await tap(page, '[aria-label="Diary"]', 600);
      const lb = page.locator('[data-tour="cal-view"] button[aria-label="List"]'); if (await lb.count()) { await lb.first().click(); await page.waitForTimeout(700); }
      const arow = page.locator('[data-tour="agenda-row"]', { hasText: "Saturday clinic" }).first();
      const arowTxt = (await arow.innerText()).replace(/\s+/g, " ");
      await arow.dispatchEvent("click"); await page.waitForTimeout(900);
      const peekOut = (await page.locator('[data-tour="peek-out"]').count()) ? (await page.locator('[data-tour="peek-out"]').innerText()).replace(/\s+/g, " ") : "";
      const peekHead = (await page.locator("[data-sheet]").first().innerText()).replace(/\s+/g, " ");
      check("(f4) the peek reads the clinic at its own hour, as its block does", /Saturday clinic 4:00 pm · 60 min/.test(peekHead), peekHead.slice(0, 120));
      await shot("06b-coach-peek");
      check("(f3) the coach's List row counts who is not going, and the lesson's peek names them", /Saturday clinic 1 not going/.test(arowTxt) && /Not going\s*Saoirse Kelly/i.test(peekOut), `${arowTxt} · ${peekOut}`);
      await tap(page, '[data-tour="peek-register"]', 1200);
      const marks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-reg-row]")].map((r) => [r.getAttribute("data-reg-row"), r.getAttribute("data-mark")])));
      await shot("07-coach-register");
      check("(f2) a fresh register for the clinic starts with the member out marked absent, nobody else marked", marks["Saoirse Kelly"] === "out" && marks["Cian Murphy"] === "" && Object.values(marks).filter((v) => v).length === 1, JSON.stringify(marks));
      await ctx.close();
    }
    /* (f5) a register already taken for the clinic comes back as it was taken */
    {
      const db = memberDb();
      db.absences.push({ booking_id: MB.today, player_id: IDS.junior, coach_id: IDS.coach, set_by: IDS.parent, created_at: new Date(db.now()).toISOString() });
      const sid = "5e000000-0000-4000-8000-00000000rs01", date = dayPlus(db, 0);
      db.sessions.push({ id: sid, coach_id: IDS.coach, label: "Saturday clinic", session_date: date, created_at: `${date}T08:00:00Z` });
      db.marks.push({ id: "6e000000-0000-4000-8000-00000000rs01", session_id: sid, player_id: IDS.junior, state: "in" });
      db.marks.push({ id: "6e000000-0000-4000-8000-00000000rs02", session_id: sid, player_id: IDS.adult, state: "out" });
      const { ctx, page } = await boot(db, "coach");
      await tap(page, '[aria-label="Diary"]', 600);
      const lb = page.locator('[data-tour="cal-view"] button[aria-label="List"]'); if (await lb.count()) { await lb.first().click(); await page.waitForTimeout(700); }
      await page.locator('[data-tour="agenda-row"]', { hasText: "Saturday clinic" }).first().dispatchEvent("click"); await page.waitForTimeout(900);
      await tap(page, '[data-tour="peek-register"]', 1200);
      const marks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-reg-row]")].map((r) => [r.getAttribute("data-reg-row"), r.getAttribute("data-mark")])));
      check("(f5) a register already taken comes back as taken — the member out stays where the coach marked her", marks["Saoirse Kelly"] === "in" && marks["Cian Murphy"] === "out", JSON.stringify(marks));
      await ctx.close();
    }
    /* (g) a session somebody is out of leaves the phone's calendar and the family's Coming up */
    {
      const db = memberDb();
      db.absences.push({ booking_id: MB.far, player_id: IDS.adult, coach_id: IDS.coach, set_by: IDS.adult, created_at: new Date(db.now()).toISOString() });
      db.absences.push({ booking_id: MB.far, player_id: IDS.junior, coach_id: IDS.coach, set_by: IDS.parent, created_at: new Date(db.now()).toISOString() });
      for (const who of ["adult", "parent"]) {
        const { ctx, page } = await boot(db, who);
        await tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 800);
        if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
        const rowC = page.locator('[data-tour="settings-calendar"]');
        let ics = "";
        if (await rowC.count()) {
          const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), rowC.click()]);
          await page.waitForTimeout(600); ics = dl ? fs.readFileSync(await dl.path(), "utf8") : "";
        }
        check(`(g) ${who}: the phone's calendar keeps today's clinic and leaves out the one they are not going to`, ics.includes(MB.today) && !ics.includes(MB.far), ics.slice(0, 300));
        if (who === "parent") {
          await tap(page, '[aria-label="Family"]', 1200);
          const fam = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
          const farDay = await page.evaluate((iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" }).replace(",", ""); }, dayPlus(db, 5));
          check("(g2) the family's Coming up no longer lists the child's clinic they are out of", !fam.includes(farDay), `${farDay} · ${fam.slice(0, 400)}`);
        }
        await ctx.close();
      }
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
