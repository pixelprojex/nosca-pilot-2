/* THE SPRINT'S THIRD BATCH (15 November). One search field at 16px on
   every surface that searches (iOS zooms the page under 16); Call off's
   lessons as person rows that keep a long name whole at 320, a group's
   as the group's glyph, a ticked row's edge in red; one head across the
   sheets (the facts in TYPE.small, Why as the eyebrow in t.sub); the
   peek's Log, the register's Submit and the password's confirm as the
   one Button; Hours' and EditDay's tiles with the start time alone and
   an Add a time that never breaks mid-phrase; the recurring manager's
   chips at 44 on the control's corner with End under the Segmented, the
   three words whole at 320; the Add player sheet's routes as the app's
   tiles with their glyphs in ink; the group page's members as person
   rows.  Usage: node sprint-3.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4361), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", long: "00000000-0000-4000-8000-00000000f00d",
  junior: "00000000-0000-4000-8000-00000000c41d", parent: "00000000-0000-4000-8000-000000pa4e07" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const DANGER = "rgb(196, 52, 42)";          // #C4342A
const ACCENT = "rgb(47, 107, 58)";          // golf's accent #2F6B3A
const NINE = ["Aoife Doyle", "Brian Nolan", "Clodagh Hayes", "Dara Ryan", "Eimear Walsh", "Fionn Byrne", "Gráinne Tran", "Hugh Okafor", "Iseult Burke"];

function freshDb() {
  const db = M.emptyDb();
  const person = (id, email, prof) => { M.addUser(db, { id, email }); return M.addProfile(db, { id, ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person(IDS.coach, "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person(IDS.adult, "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person(IDS.long, "long@t.ie", { role: "player", name: "Maximiliano Ó Súilleabháin", type: "adult", coachId: IDS.coach, dob: "1989-01-01" });
  person(IDS.parent, "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person(IDS.junior, "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* more than eight on the roster, so its search is there */
  NINE.forEach((n, i) => person(`00000000-0000-4000-8000-0000000a00${String(i).padStart(2, "0")}`, `p${i}@t.ie`, { role: "player", name: n, type: "adult", coachId: IDS.coach, dob: "1990-05-05" }));
  M.setPrefs(db, IDS.coach, {
    availability: M.weekOf(["9:00 am", "10:30 am", "12:00 pm", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]),
    groups: [{ id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], day: 5, time: "12:00 pm", weeks: 8, sport: "golf" }],
  });
  /* today: the long name at nine, Cian at half ten, the clinic at noon */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.long, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "10:30 am" });
  M.addBooking(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: TODAY, time: "12:00 pm", duration: 60 });
  /* Dara: a lesson a month ago and nothing booked — drifting */
  M.addLesson(db, { coachId: IDS.coach, playerId: "00000000-0000-4000-8000-0000000a0003", date: M.ymd(new Date(Date.now() - 30 * 864e5)), focus: "Putting" });
  /* a running arrangement, for the manager */
  M.addRecurring(db, { id: "7e000000-0000-4000-8000-00000000000a", coachId: IDS.coach, playerId: IDS.adult, weekday: 2, time: "10:30 am" });
  /* (i) a clinic session already taught, for the group page's lesson rows */
  M.addLesson(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: M.ymd(new Date(Date.now() - 3 * 864e5)), focus: "Bunker play", notes: "Splash, not dig." });
  for (let i = 0; i < 9; i++) M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: `2026-0${1 + (i % 9)}-1${i}`.replace(/-1(\d)$/, (m, d) => `-1${d}`), focus: "Short game" });
  return db;
}

const { check, results, summary } = M.checker("sprint-3");
const { tap } = M;
const px = (v) => parseFloat(v) || 0;
const styleOf = (loc, prop) => loc.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
const boxOf = async (loc) => (await loc.first().boundingBox()) || { x: 0, y: 0, width: 0, height: 0 };

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async ({ width = 390, mod = null } = {}) => {
    const db = freshDb(); if (mod) mod(db);
    const u = Object.values(db.users).find((x) => x.id === IDS.coach);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    return { db, ctx, page, text: () => M.rootText(page), shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) }) };
  };
  const sheet = (page) => page.locator("[data-sheet]").first();
  const openSettings = async (page) => { await tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 800); if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900); };
  const searchField = async (page, within, label) => {
    const input = (within || page).locator('input[placeholder="Search"], input[placeholder="Search settings"]').first();
    if (!(await input.count())) return check(`${label}: a search field is there`, false, "no field");
    const fs = await styleOf(input, "fontSize");
    const wrap = input.locator("xpath=..");
    const radius = await styleOf(wrap, "borderRadius"), h = (await boxOf(wrap)).height;
    return check(`${label}: the one search field — a pill, 46 tall, the words at 16px (iOS zooms under 16)`, fs === "16px" && px(radius) >= 100 && h >= 45, `${fs} r=${radius} h=${h}`);
  };

  try {
    /* ---------- (a) Call off's lessons as person rows, at 320 ---------- */
    for (const width of [320, 390]) {
      const { ctx, page, text, shot } = await boot({ width });
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-weather"]', 900);
      const whyEyebrow = sheet(page).locator("div", { hasText: /^Why$/ }).last();
      const whyFs = await styleOf(whyEyebrow, "fontSize"), whyColor = await styleOf(whyEyebrow, "color");
      await M.click(page, "Weather", 400); await M.click(page, "Next", 700);
      /* the label grey is the sport's own (golf's here): Why reads in the
         same grey as the day labels over the Which-lessons rows, which have
         always been the eyebrow in t.sub */
      const dayLabel = sheet(page).locator("div", { hasText: /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d/ }).last();
      const sub = sheet(page).locator("p", { hasText: /^Weather$/ }).first();
      check(`(a${width}) Which days: the reason as the sub in TYPE.small`, (await sub.count()) === 1 && (await styleOf(sub, "fontSize")) === "12.5px", await styleOf(sub, "fontSize").catch(() => "none"));
      await M.click(page, "Next", 700);
      const dayColor = (await dayLabel.count()) ? await styleOf(dayLabel, "color") : "none";
      check(`(a${width}) Call off: Why as the eyebrow over the reasons, in the same label grey as the day labels over the lessons`, whyFs === "12.5px" && whyColor === dayColor && dayColor !== "none", `${whyFs} ${whyColor} vs ${dayColor}`);
      const rows = sheet(page).locator("[data-person-row]");
      const n = await rows.count();
      const names = await rows.locator("[data-name]").evaluateAll((els) => els.map((e) => ({ t: e.textContent, over: e.scrollWidth - e.clientWidth, h: e.getBoundingClientRect().height })));
      const pressed = await sheet(page).locator('button[aria-pressed="true"]').count();
      const group = rows.filter({ hasText: "Saturday clinic" }).first();
      const groupSvg = (await group.count()) ? await group.locator("svg").count() : 0;
      const groupInitials = (await group.count()) ? /\bSc\b/.test(await group.innerText()) : true;
      const edge = n ? await styleOf(rows, "borderColor") : "";
      await shot(`a-calloff-which-${width}`);
      check(`(a${width}) Which lessons: three person rows, every one ticked, the long name whole (no sideways cut) on up to two lines`,
        n === 3 && pressed === 3 && names.length === 3 && names.every((x) => x.over <= 1) && names.some((x) => /Maximiliano Ó Súilleabháin/.test(x.t)), JSON.stringify(names));
      check(`(a${width}) the clinic's row carries the group's glyph, never initials; a ticked row's edge is red`, groupSvg >= 1 && !groupInitials && edge === DANGER, `svg ${groupSvg} initials ${groupInitials} edge ${edge}`);
      await M.click(page, `Call off 3 lessons`, 800);
      const confirm = sheet(page).locator("button", { hasText: /^Call off 3 lessons$/ }).first();
      const r = (await confirm.count()) ? await styleOf(confirm, "borderRadius") : "none";
      check(`(a${width}) the password's confirm is the app's Button (16px corners)`, r === "16px", r);
      await ctx.close();
    }

    /* ---------- (b) the peek's Log and the register's Submit through Button ---------- */
    {
      const { ctx, page, shot } = await boot();
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const log = page.locator('[data-tour="peek-log"]');
      const r1 = (await log.count()) ? await styleOf(log, "borderRadius") : "none", sh = (await log.count()) ? await styleOf(log, "boxShadow") : "none";
      check("(b) the peek's Log is the Button: 16px corners and the cast shadow, no glow of its own", r1 === "16px" && sh !== "none" && !/0px 6px 18px/.test(sh), `${r1} · ${sh.slice(0, 60)}`);
      await shot("b-peek");
      await page.keyboard.press("Escape").catch(() => {}); await tap(page, '[data-scrim], .scrim', 400).catch(() => {});
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-attend"]', 900);
      const pick = sheet(page).locator("button", { hasText: "Cian Murphy" }).first();
      if (await pick.count()) { await pick.click(); await page.waitForTimeout(700); }
      const submit = page.getByRole("button", { name: /Submit register/ }).first();
      const r2 = (await submit.count()) ? await styleOf(submit, "borderRadius") : "none";
      check("(b) the register's Submit is the Button too (16px corners)", r2 === "16px", r2);
      await shot("b-register");
      await ctx.close();
    }

    /* ---------- (c) the search fields ---------- */
    {
      const { ctx, page } = await boot();
      await tap(page, '[aria-label="Players"], [aria-label="Roster"]', 900);
      await searchField(page, null, "(c) the roster");
      await openSettings(page);
      await searchField(page, null, "(c) Settings");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[data-tour="today-archive"]', 1000);
      await searchField(page, null, "(c) the archive");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
      await searchField(page, null, "(c) the log's Who page");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Chat"]', 900); await tap(page, '[data-tour="chat-new"]', 900);
      await searchField(page, sheet(page), "(c) New message");
      await ctx.close();
    }

    /* ---------- (d) Hours' and EditDay's tiles ---------- */
    for (const width of [320, 390]) {
      const { ctx, page, shot } = await boot({ width });
      await openSettings(page); await tap(page, '[data-tour="settings-availability"]', 900);
      if (!(await page.locator('[data-tour="avail-times"]').count())) { await page.locator("button", { hasText: "Slots and lesson length" }).first().click().catch(() => {}); await page.waitForTimeout(600); }
      const tiles = await page.locator('[data-tour="avail-times"] button').evaluateAll((els) => els.map((e) => ({ t: (e.textContent || "").trim(), h: e.getBoundingClientRect().height, over: Math.max(...Array.from(e.querySelectorAll("span")).map((s) => s.scrollWidth - s.clientWidth), 0) })));
      const times = tiles.filter((x) => x.t !== "Add a time");
      await shot(`d-hours-${width}`);
      check(`(d${width}) Hours' tiles carry the start time alone, one line each; Add a time stacks and never breaks mid-phrase`,
        times.length === 4 && times.every((x) => /^\d{1,2}:\d{2} (am|pm)$/.test(x.t) && x.h <= 48) && tiles.some((x) => x.t === "Add a time" && x.over <= 1 && x.h <= 60), JSON.stringify(tiles));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Diary"]', 1000);
      const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      await page.locator('[data-tour="agenda-edit"]').first().dispatchEvent("click"); await page.waitForTimeout(900);
      const ed = await page.locator('[data-tour="editday-times"] [data-time]').evaluateAll((els) => els.map((e) => { const spans = Array.from(e.querySelectorAll("span")); return { t: spans[0] ? spans[0].textContent.trim() : "", who: spans[1] ? spans[1].textContent.trim() : "", h: e.getBoundingClientRect().height, truncate: spans.some((s) => s.classList.contains("truncate")) }; }));
      const add = page.locator('[data-tour="editday-add"]');
      const addOver = (await add.count()) ? await add.evaluate((e) => Math.max(...Array.from(e.querySelectorAll("span")).map((s) => s.scrollWidth - s.clientWidth), 0)) : 0;
      await shot(`d-editday-${width}`);
      check(`(d${width}) EditDay's tiles: the start time alone, a booked tile's long name on two lines rather than cut, Add a time whole`,
        ed.length >= 3 && ed.every((x) => /^\d{1,2}:\d{2} (am|pm)$/.test(x.t) && !x.truncate) && ed.some((x) => /Maximiliano/.test(x.who) && x.h <= 90) && addOver <= 1, JSON.stringify(ed).slice(0, 300));
      await ctx.close();
    }

    /* ---------- (e) the recurring manager at 320 ---------- */
    {
      const { ctx, page, shot } = await boot({ width: 320 });
      await tap(page, '[aria-label="Diary"]', 1000);
      const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      if (await page.locator('[data-tour="cal-recurring"]').count()) await tap(page, '[data-tour="cal-recurring"]', 1000);
      const chip = page.locator('button[aria-label="Monday"]').first();
      const chipH = (await boxOf(chip)).height, chipR = (await chip.count()) ? await styleOf(chip, "borderRadius") : "none";
      const segs = await page.locator('button[aria-pressed]').filter({ hasText: /^(Weekly|Fortnightly|Monthly)$/ }).evaluateAll((els) => els.map((e) => ({ t: e.textContent, over: e.scrollWidth - e.clientWidth, y: e.getBoundingClientRect().bottom })));
      const end = page.locator('[data-tour="recur-end"]').first();
      const endBox = await boxOf(end);
      await shot("e-manager-320");
      check("(e) the manager's day chips are 44 tall on the control's corner", chipH >= 44 && chipR === "10px", `${chipH} ${chipR}`);
      check("(e) Weekly · Fortnightly · Monthly keep their air at 320, and End sits on a line of its own under them", segs.length === 3 && segs.every((s) => s.over <= 1) && endBox.height >= 40 && endBox.y >= Math.max(...segs.map((s) => s.y)) - 1, JSON.stringify({ segs, end: endBox }));
      await ctx.close();
    }

    /* ---------- (f) the Add player sheet's routes; the group page's members ---------- */
    {
      const { ctx, page, shot } = await boot();
      await tap(page, '[aria-label="Players"], [aria-label="Roster"]', 900);
      await tap(page, '[data-tour="roster-invite"]', 900);
      const routes = await sheet(page).locator("button").filter({ hasText: /^(WhatsApp|Messages|Email|Copy link)$/ }).evaluateAll((els) => els.map((e) => { const svg = e.querySelector("svg"); const f = e.querySelector("[data-face]"); return { t: e.textContent.trim(), round: !!f && parseFloat(getComputedStyle(f).borderTopLeftRadius) >= 999, r: getComputedStyle(f || e).borderRadius, h: e.getBoundingClientRect().height, stroke: svg ? getComputedStyle(svg).stroke || svg.getAttribute("stroke") : null }; }));
      await shot("f-add-player");
      /* since 18 November a key with a glyph two to a row is a tile — the glyph over the word, Lares's lists — where a circle floated in the cell */
      check("(f) the four routes are the app's keys — tiles two to a row, 90 tall — the glyph in ink, no accent among them", routes.length === 4 && routes.every((x) => !x.round && x.h >= 90 && x.stroke !== ACCENT && !/rgb\(47, 107, 58\)/.test(x.stroke || "")), JSON.stringify(routes));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Players"], [aria-label="Roster"]', 900);
      await tap(page, '[data-tour="roster-tab"] [aria-label="Groups"], [data-tour="roster-tab"] button:has-text("Groups")', 700);
      await page.locator('[data-tour="roster-group"]', { hasText: "Saturday clinic" }).first().click(); await page.waitForTimeout(900);
      const members = await page.locator('[data-tour="group-members"] [data-person-row]').evaluateAll((els) => els.map((e) => ({ h: e.getBoundingClientRect().height, face: (e.querySelector("span, img, div") || {}).getBoundingClientRect ? e.firstElementChild.getBoundingClientRect().width : 0, t: e.textContent.trim() })));
      await shot("f-group-page");
      check("(f) the group's members are person rows: 64 tall, the face 40", members.length === 2 && members.every((m) => m.h >= 64 && Math.round(m.face) === 40), JSON.stringify(members));
      await ctx.close();
    }

    /* ---------- (g) the second batch: "45 min", the outlined red, one outlined size, the log's title, Drifting's day ---------- */
    {
      const { ctx, page, shot } = await boot({ width: 320 });
      await openSettings(page); await tap(page, '[data-tour="settings-availability"]', 900);
      if (!(await page.locator('[data-tour="avail-times"]').count())) { await page.locator("button", { hasText: "Slots and lesson length" }).first().click().catch(() => {}); await page.waitForTimeout(600); }
      const lengths = await page.locator('button[aria-pressed]').filter({ hasText: /^\d+ ?m(in)?$/ }).allInnerTexts();
      check("(g) Hours' length tiles read \"45 min\", never \"45m\"", lengths.length >= 3 && lengths.every((x) => / min$/.test(x)), lengths.join(", "));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Diary"]', 1000);
      const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      await page.locator('[data-tour="agenda-edit"]').first().dispatchEvent("click"); await page.waitForTimeout(900);
      const off = page.locator('[data-tour="editday-calloff"]').first();
      const offR = (await off.count()) ? await styleOf(off, "borderRadius") : "none", offC = (await off.count()) ? await styleOf(off, "color") : "none", offB = (await off.count()) ? await styleOf(off, "borderTopWidth") : "none";
      check("(g) EditDay's Call off is the outlined red Button, not a bare word", offR === "16px" && offC === DANGER && px(offB) >= 1, `${offR} ${offC} ${offB}`);
      await shot("g-editday-calloff-320");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[data-tour="today-archive"]', 1000);
      await page.locator('[data-tour="lesson-row"], [data-lesson-row], button:has-text("Short game")').first().click().catch(() => {}); await page.waitForTimeout(900);
      const outlined = await page.locator("button").evaluateAll((els) => els.filter((e) => /^(Message|Log|Mark it up|Study|Compare)$/.test((e.textContent || "").trim()) && getComputedStyle(e).borderTopWidth !== "0px").map((e) => ({ t: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height), fs: getComputedStyle(e).fontSize })));
      check("(g) the lesson page's outlined controls are one size", outlined.length >= 2 && outlined.every((x) => x.h >= 46 && x.fs === outlined[0].fs), JSON.stringify(outlined));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
      await page.locator('button[aria-label]').filter({ hasText: /Maximiliano/ }).first().click(); await page.waitForTimeout(900);
      const hero = await page.evaluate(() => { const el = [...document.querySelectorAll("span")].find((x) => /^Maximiliano Ó Súilleabháin$/.test(x.textContent.trim()) && getComputedStyle(x).fontSize === "24px"); return el ? { trunc: el.classList.contains("truncate"), h: el.getBoundingClientRect().height, over: el.scrollWidth - el.clientWidth } : null; });
      check("(g) the log's title takes a second line for a long name rather than cutting it", !!hero && !hero.trunc && hero.over <= 1 && hero.h > 26 && hero.h <= 60, JSON.stringify(hero));
      await shot("g-log-hero-320");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      const drift = page.locator("button", { hasText: /Drifting/ }).first();
      if (await drift.count()) {
        await drift.click(); await page.waitForTimeout(900);
        const row = page.locator("[data-person-row]").filter({ hasText: "Dara Ryan" }).first();
        const sub = (await row.count()) ? await row.locator("[data-sub]").first().innerText() : "";
        const msg = row.locator("button", { hasText: /^Message$/ }).first();
        const msgColor = (await msg.count()) ? await styleOf(msg, "color") : "none";
        check("(g) Drifting reads the day of the last lesson, never an age, and Message is in ink", /^Last lesson · (Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d/.test(sub.replace(/\s+/g, " ")) && msgColor !== ACCENT, `${sub} · ${msgColor}`);
        await shot("g-drifting-320");
      } else check("(g) Drifting reads the day of the last lesson, never an age, and Message is in ink", false, "no Drifting row on Today");
      await ctx.close();
    }

    /* ---------- (h) 16 November: Move's sub, the Calendar view's empty day, the Diary's foot box, Set drills' head, the register's way back ---------- */
    {
      const { ctx, page, shot } = await boot();
      /* the peek's Move: who, then when, on two lines */
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      if (await page.locator('[data-tour="peek-move"]').count()) {
        await tap(page, '[data-tour="peek-move"]', 900);
        const subs = await page.locator('[data-tour="move-sheet"] h2 ~ p').evaluateAll((els) => els.slice(0, 2).map((e) => e.textContent.trim()));
        check("(h) Move's head: the person on one line, the day and time on the next", subs.length === 2 && subs[0] === "Cian Murphy" && /\d:\d\d (am|pm)/.test(subs[1]) && !subs[0].includes("·"), JSON.stringify(subs));
      } else check("(h) Move's head: the person on one line, the day and time on the next", false, "no Move on the peek");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      /* the Diary's List foot: Recurring lessons is a box of its own, the column's width */
      await tap(page, '[aria-label="Diary"]', 1000);
      const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      const foot = await page.locator('[data-tour="cal-recurring"]').first().evaluate((el) => { const r = el.getBoundingClientRect(); const day = document.querySelector(".nsc-day"); const d = day ? day.getBoundingClientRect() : null; return { bg: getComputedStyle(el).backgroundColor, l: Math.round(r.left), w: Math.round(r.width), dl: d ? Math.round(d.left) : null, dw: d ? Math.round(d.width) : null, rule: getComputedStyle(el).borderTopWidth }; });
      check("(h) the Diary's Recurring lessons is a wash box lined up with the day boxes above it", foot.bg === "rgb(235, 243, 234)" && foot.dl != null && Math.abs(foot.l - foot.dl) <= 1 && Math.abs(foot.w - foot.dw) <= 1, JSON.stringify(foot));
      await shot("h-diary-foot");
      /* the Calendar view on a day with hours and nothing booked: a line, no Set hours */
      await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 700);
      const nextDay = await page.evaluate(() => { const b = [...document.querySelectorAll("[data-day]")].map((x) => Number(x.getAttribute("data-day"))); const today = new Date().getDate(); return b.find((d) => d > today + 1) || null; });
      if (nextDay) await tap(page, `[data-day="${nextDay}"]`, 700);
      check("(h) a day with hours and nothing booked reads Nothing booked and offers no Set hours", (await page.locator('[data-tour="cal-nothing"]').count()) === 1 && (await page.locator("button", { hasText: /^Set hours$/ }).count()) === 0, String(nextDay));
      /* Set drills from the player file: the title on the ladder */
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Players"], [aria-label="Roster"]', 900);
      await page.locator('[data-tour="roster-row"]').filter({ hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await M.click(page, "Drills", 900);
      const h2 = page.locator("[data-sheet] h2", { hasText: /^Drills for Cian/ }).first();
      check("(h) Set drills' title is TYPE.title (19px), not a 23px literal", (await h2.count()) === 1 && (await styleOf(h2, "fontSize")) === "19px", (await h2.count()) ? await styleOf(h2, "fontSize") : "none");
      await ctx.close();
    }

    /* ---------- (i) 17 November: the peek (A2, A14, A15), the month grid (B11), the group page (C7), Set drills' who (C13) ---------- */
    {
      const { ctx, page, shot } = await boot();
      /* the peek's lessons: rows with a chevron, All lessons the home's grey row */
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const all = page.locator('[data-tour="peek-all"]');
      const allColor = (await all.count()) ? await styleOf(all.locator("span").last(), "color") : "none";
      const rowsChev = await page.locator('[data-tour="peek-lessons"] > *').evaluateAll((els) => els.map((e) => e.querySelectorAll("svg").length > 0));
      const accentLink = await sheet(page).locator("button", { hasText: /^All \d+ lessons$/ }).count();
      await shot("i-peek");
      check("(i) the peek's All lessons is a grey row with its chevron inside the list, not an accent link", (await all.count()) === 1 && allColor !== ACCENT && /^All lessons\s*\d+$/.test((await all.innerText()).replace(/\n/g, " ").trim()) && accentLink === 0, `${allColor} ${accentLink}`);
      check("(i) every row of the peek's lessons says it opens something (a chevron)", rowsChev.length >= 2 && rowsChev.every(Boolean), JSON.stringify(rowsChev));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      /* a clinic's peek: no Move that opens the Cancel sheet */
      await page.locator("button", { hasText: "Saturday clinic" }).first().click(); await page.waitForTimeout(900);
      const acts = await page.locator('[data-tour="peek-actions"] > button').allInnerTexts();
      check("(i) a group's peek has no Move (it opened Cancel beside Cancel)", (await page.locator('[data-tour="peek-move"]').count()) === 0 && acts.length >= 4 && acts.some((x) => /Cancel/.test(x)), JSON.stringify(acts));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      /* the month grid: a booked day carries the ink dot, a day gone is legible */
      await tap(page, '[aria-label="Diary"]', 1000);
      await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 700);
      const today = new Date(`${TODAY}T12:00:00`).getDate();
      const other = await page.evaluate((td) => { const b = [...document.querySelectorAll("[data-day]")].map((x) => Number(x.getAttribute("data-day"))); return b.find((d) => d > td) || null; }, today);
      if (other) await tap(page, `[data-day="${other}"]`, 600);
      const mark = await page.locator(`[data-day="${today}"] [data-mark]`).evaluate((el) => ({ m: el.getAttribute("data-mark"), bg: el.firstElementChild ? getComputedStyle(el.firstElementChild).backgroundColor : null, w: el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width : 0 })).catch(() => null);
      check("(i) the month grid marks a coach's day with lessons with the ink dot, 4px, as the List view's ticker", !!other && !!mark && mark.m === "booked" && mark.w === 4 && mark.bg !== "rgb(228, 236, 225)", JSON.stringify({ other, mark }));
      if (today > 1) {
        const pastColor = await styleOf(page.locator('[data-day="1"] span').first(), "color");
        check("(i) a day gone is the trace grey, not the 1.2:1 hairline", pastColor !== "rgb(228, 236, 225)", pastColor);
      }
      await shot("i-month");
      /* the group page: each session is a lesson row that opens the write-up */
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Players"], [aria-label="Roster"]', 900);
      await page.locator("button", { hasText: /^Groups$/ }).first().click(); await page.waitForTimeout(700);
      await page.locator('[data-tour="roster-group"]').first().click(); await page.waitForTimeout(1000);
      const ses = page.locator('[data-tour="group-sessions"] > *');
      const sesText = (await ses.count()) ? (await ses.first().innerText()).replace(/\n/g, " ") : "";
      const sesFs = (await ses.count()) ? await styleOf(ses.first().locator("span", { hasText: /^Bunker play$/ }), "fontSize") : "none";
      await shot("i-group-page");
      check("(i) a group session is the app's lesson row: the focus at the body size, the day on the grey line", (await ses.count()) === 1 && /Bunker play/.test(sesText) && /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}/.test(sesText) && sesFs !== "18px", `${sesText} ${sesFs}`);
      if (await ses.count()) { await ses.first().locator("button").first().click(); await page.waitForTimeout(1200); }
      check("(i) …and opens the session's write-up", /Splash, not dig/.test(M.norm(await M.rootText(page))), (await M.rootText(page)).slice(0, 200));
      /* Set drills from the library: Who, person rows, Show more in ink, the verb asleep */
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Your profile"]', 900); await tap(page, '[data-tour="settings-library"]', 900);
      await page.locator('[data-scroll="screen"] .nsc-list button[aria-expanded]').first().click(); await page.waitForTimeout(500);
      await page.locator('[data-scroll="screen"] button', { hasText: /^Set drills$/ }).first().click(); await page.waitForTimeout(900);
      const h2 = await sheet(page).locator("h2").first().innerText().catch(() => "");
      const who = await sheet(page).locator('[data-tour="assign-who"] [data-person-row]').count();
      check("(i) Set drills' first stage is titled Who over person rows (it was \"Who's playing\")", h2.trim() === "Who" && who >= 9, `${h2} ${who}`);
      await shot("i-assign-who");
      if (who) { await sheet(page).locator('[data-tour="assign-who"] [data-person-row]').first().click(); await page.waitForTimeout(800); }
      const more = sheet(page).locator('[data-tour="assign-more"]');
      const moreColor = (await more.count()) ? await styleOf(more, "color") : null;
      check("(i) Show N more is in ink — the accent is Set's", moreColor === null || moreColor !== ACCENT, String(moreColor));
      const set = sheet(page).locator("button", { hasText: /^(Set drills|Pick or write a drill)$/ }).first();
      check("(i) the asleep button reads the verb, Set drills, never an instruction", (await set.count()) === 1 && (await set.innerText()).trim() === "Set drills" && (await set.isDisabled()), (await set.count()) ? await set.innerText() : "none");
      await ctx.close();
    }
    /* ---------- (j) 18 November: the register (A19, A20), Cancel's copy (A21), the recurring manager and Set up (B8, B20), the Book sheet's head (B21) ---------- */
    {
      const { ctx, page, shot } = await boot();
      /* A20: a fresh register is "N to mark", the figure only with the first mark */
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-attend"]', 900);
      await shot("j-register-pick");
      await sheet(page).locator('button', { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(800);
      const tally0 = M.norm(await page.locator('[data-tour="register-tally"]').innerText().catch(() => ""));
      await shot("j-register-fresh");
      check("(j) a fresh register reads how many to mark, never a nought of N present", /^\d+ to mark$/.test(tally0), tally0);
      await sheet(page).locator('[data-tour="register-in"]').first().click(); await page.waitForTimeout(400);
      const tally1 = M.norm(await page.locator('[data-tour="register-tally"]').innerText().catch(() => ""));
      check("(j) …and the first mark brings the figure and of N present", /^1\s*of \d+ present/.test(tally1), tally1);
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      /* A21: the coach's Cancel sheet carries no box of copy (the password step says it) */
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.locator('[data-tour="peek-actions"] button', { hasText: /^Cancel$/ }).first().click(); await page.waitForTimeout(900);
      const ct = M.norm(await sheet(page).innerText());
      check("(j) the coach's Cancel sheet has no wash box of promises (We'll tell…, not counted)", /Cancel lesson/.test(ct) && !/We'll tell|not counted/.test(ct) && (await page.locator('[data-tour="cancel-promise"]').count()) === 0, ct.slice(0, 200));
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      /* B21: the coach's Book sheet: the day as the title, the time under it */
      await tap(page, '[aria-label="Diary"]', 1000);
      const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      await page.locator('[data-tour="agenda-book"]').first().click(); await page.waitForTimeout(900);
      const bh = await sheet(page).locator("h2").first().innerText().catch(() => "");
      const bt = await page.locator('[data-tour="book-who-time"]').innerText().catch(() => "");
      await shot("j-book-who");
      check("(j) the coach's Book sheet is headed with the day alone, the time on the line under it, as the player's request sheet", /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}$/.test(bh.trim()) && /\d:\d\d/.test(bt) && !bh.includes("·"), `${bh} | ${bt}`);
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      /* B8: the manager's head — two facts, no cadence */
      await tap(page, '[aria-label="Diary"]', 1000);
      if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      await tap(page, '[data-tour="cal-recurring"]', 1000);
      const line = M.norm(await page.locator('[data-tour="recur-line"]').first().innerText().catch(() => ""));
      check("(j) a recurring arrangement's grey line is the day and the time, two facts — Tuesdays · 10:30 am", /^[A-Z][a-z]+days · \d{1,2}:\d\d (am|pm)$/.test(line), line);
      /* B20: the Set up sheet — the Segmented, a 44 stepper, one grey line for the first lesson */
      await tap(page, '[data-tour="recur-add"]', 1000);
      const who = page.locator('[data-tour="recur-who"] button').first(); if (await who.count()) { await who.click(); await page.waitForTimeout(700); }
      const segs = await sheet(page).locator('[data-tour="recur-freq"] button[aria-pressed]').count();
      const step = await sheet(page).locator('[aria-label="Fewer"], [aria-label="More"]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), r: getComputedStyle(e).borderRadius }; }));
      const first = M.norm(await page.locator('[data-tour="recur-first"]').innerText().catch(() => ""));
      const st = M.norm(await sheet(page).innerText());
      await shot("j-recur-setup");
      check("(j) Set up's cadence is the manager's Segmented", segs === 3, String(segs));
      check("(j) the stepper's two controls are 44 square on the control's corner, not 34px pills", step.length === 2 && step.every((x) => x.w >= 44 && x.h >= 44 && parseFloat(x.r) < 22), JSON.stringify(step));
      check("(j) the preview is one grey line, First · the day in the one form — no box of sentences", /^First · (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}$/.test(first) && !/First three/.test(st), first);
      await ctx.close();
    }
    /* ---------- (j0) A19: the register with nothing booked today heads the roster Not in the diary, as person rows ---------- */
    {
      const { ctx, page, shot } = await boot({ mod: (db) => { db.bookings = (db.bookings || []).filter((b) => b.booking_date !== TODAY); } });
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-attend"]', 900);
      const head = await page.locator('[data-tour="register-walkin-head"]').count();
      const rows = await sheet(page).locator('[data-tour="register-walkin"] [data-person-row]').count();
      await shot("j0-register-empty");
      check("(j0) with nothing booked the roster is headed Not in the diary, as the app's person rows", head === 1 && rows >= 9, `${head} ${rows}`);
      await ctx.close();
    }
    /* ---------- (i320) the peek at 320: the whole name, the actions in two rows of three ---------- */
    {
      const { ctx, page, shot } = await boot({ width: 320 });
      await page.locator("button", { hasText: "Maximiliano" }).first().click(); await page.waitForTimeout(900);
      const title = await page.locator('[data-tour="peek-title"]').evaluate((el) => ({ t: el.textContent, whole: el.scrollHeight <= el.clientHeight + 1, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || "24")) })).catch(() => null);
      const labels = await page.locator('[data-tour="peek-actions"] > button').evaluateAll((bs) => bs.map((b) => { const sp = b.querySelector("span:last-child"); const br = b.getBoundingClientRect(); return { t: sp.textContent, fit: sp.scrollWidth <= br.width + 0.5, top: Math.round(br.top) }; }));
      await shot("i320-peek");
      check("(i320) the peek's title is the whole long name, on two lines rather than cut", !!title && title.t === "Maximiliano Ó Súilleabháin" && title.whole, JSON.stringify(title));
      check("(i320) the peek's actions sit three to a row, every label whole in its column", labels.length >= 5 && labels.every((l) => l.fit) && new Set(labels.map((l) => l.top)).size === 2, JSON.stringify(labels));
      await ctx.close();
    }

    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
