/* A REQUEST CARRIES WORDS BOTH WAYS.

   The player's note on the ask: the request sheet carries a field for
   the coach ("Note for Niamh", with dictation), the words ride on the
   booking row (`bookings.note`) and the coach reads them on Today's
   request row, on the bell's asking line, on the decline sheet and on
   the lesson's peek once it is accepted ("Asked for · …"). The coach's
   reason on the no: the decline sheet asks Why — the coach's own
   reasons, optional — and the chosen one leads the player's "Request
   declined", as a cancellation's reason does. A project whose bookings
   do not carry the column offers no field and takes the request as
   before.

   a1-a4  the player's note: the field, the row, the coach's Today row and bell
   b1-b3  the decline: the note on the sheet, Why, the reason leading the notice
   c1     Something else, in the coach's words
   d1     accepted: the peek reads what was asked for
   e1     a parent asking for a child: Note for the child's coach
   f1-f2  a project without the column: no field, the request still saved

   Usage: node request-note.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4493), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", junior: "00000000-0000-4000-8000-00000000c41d", parent: "00000000-0000-4000-8000-00000000c0a7" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const NOTE = "Bunker play before the medal";
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
const { check, summary } = M.checker("request-note");

function freshDb({ family = false } = {}) {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  if (family) M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  if (family) person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, dob: "2013-09-09", ...(family ? { familyId: FAM } : {}) });
  M.setPrefs(db, IDS.coach, { setup_done: true, availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) });
  return db;
}

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, hm = "09:00") => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T${hm}:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    return { ctx, page, shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) }) };
  };
  const sheetText = async (page) => M.norm(await page.locator("[data-sheet]").innerText());
  const toldFor = (db, uid, id) => db.notifications.filter((n) => n.user_id === uid && n.data && n.data.id === id).map((n) => `${n.title} · ${n.body}`);
  /* the player's Diary: the first free hour's Plus opens the request sheet */
  const openAsk = async (page) => {
    await M.tap(page, '[aria-label="Diary"]', 1000);
    const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
    if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await M.tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
    await page.locator('[data-tour="agenda-book"]').first().click(); await page.waitForTimeout(900);
  };
  const askWith = async (page, note) => {
    await openAsk(page);
    const field = page.locator('[data-tour="ask-note"] textarea');
    if (note != null && await field.count()) { await field.fill(note); await page.waitForTimeout(200); }
    await page.locator("[data-sheet] button", { hasText: /^Request/ }).last().click(); await page.waitForTimeout(1500);
  };
  const requestOf = (db) => db.bookings.find((b) => b.status === "requested");

  try {
    /* ---------- (a) the player's note ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "adult");
      await openAsk(page);
      const t = await sheetText(page);
      const field = page.locator('[data-tour="ask-note"] textarea');
      check("(a1) the request sheet carries a note for the coach, by their first name, before the Request button",
            (await field.count()) === 1 && (await field.getAttribute("placeholder")) === "Note for Niamh" && /Request/.test(t), `${t.slice(0, 160)} · ph=${await field.getAttribute("placeholder").catch(() => "-")}`);
      await field.fill(NOTE); await shot("01-ask-note");
      await page.locator("[data-sheet] button", { hasText: /^Request/ }).last().click(); await page.waitForTimeout(1500);
      const req = requestOf(db);
      check("(a2) the request is written with the note on its row, and nothing else changed about it",
            !!req && req.note === NOTE && req.player_id === IDS.adult && req.coach_id === IDS.coach && req.booking_date === dayPlus(db, 0),
            JSON.stringify(req && { note: req.note, status: req.status, date: req.booking_date, time: req.start_time }));
      const told = req ? toldFor(db, IDS.coach, req.id) : [];
      check("(a3) the coach's asking line carries the note after the day and the time",
            told.length === 1 && new RegExp(`^Cian Murphy asked for a lesson · .* ${req && req.start_time} · ${NOTE}$`).test(told[0]), JSON.stringify(told));
      await ctx.close();
      /* the coach reads it on Today and in the bell */
      const c = await boot(db, "coach");
      const row = M.norm(await c.page.locator('[data-tour="today-asks"]').innerText());
      await c.shot("02-today-ask");
      await M.tap(c.page, '[aria-label="Alerts"]', 1000);
      const bell = M.norm(await c.page.locator("[data-person-row]").filter({ hasText: "Cian Murphy" }).first().innerText());
      await c.shot("03-bell-ask");
      /* the words take the row's width: nothing cut, Accept · Decline on a line of their own under the name */
      const fit = await c.page.evaluate(() => [...document.querySelectorAll("[data-person-row]")].filter((r) => /Cian Murphy/.test(r.textContent) && r.querySelector(":scope > .ml-auto")).map((r) => {
        const sub = r.querySelector("[data-sub]"), name = r.querySelector("[data-name]"), acts = r.querySelector(":scope > .ml-auto");
        return { cut: sub.scrollHeight > sub.clientHeight + 1 || sub.scrollWidth > sub.clientWidth + 1, under: acts.getBoundingClientRect().top >= name.getBoundingClientRect().bottom - 1 }; }));
      check("(a4) Today's request row and the bell's carry the note under the name, after the day and the time — nothing cut, Accept · Decline on a line of their own",
            row.includes(NOTE) && /\d{1,2}:\d\d [ap]m/.test(row) && bell.includes(NOTE) && /Accept/.test(bell) && fit.length >= 1 && fit.every((f) => !f.cut && f.under), JSON.stringify({ row: row.slice(0, 120), bell: bell.slice(0, 120), fit }));
      await c.ctx.close();
    }

    /* ---------- (b) the decline: the note on the sheet, Why, the reason on the notice ---------- */
    {
      const db = freshDb();
      const a = await boot(db, "adult"); await askWith(a.page, NOTE); await a.ctx.close();
      const req = requestOf(db);
      const { ctx, page, shot } = await boot(db, "coach");
      await page.locator("button", { hasText: /^Decline$/ }).first().click(); await page.waitForTimeout(800);
      const t = await sheetText(page);
      const whys = await page.locator('[data-tour="decline-why"]').allInnerTexts();
      await shot("04-decline");
      check("(b1) the decline sheet reads Decline request, the player's words, then Why with the coach's own reasons, then the times",
            /^Decline request/.test(t) && (await page.locator('[data-tour="decline-note"]').innerText()).trim() === NOTE
            && whys.map(M.norm).join("|") === "Unwell|Course closed|Double booked|Family reasons|Something else"
            && t.indexOf("Why") < t.indexOf("Offer another time") && (await page.locator('[data-tour="decline-why"][aria-pressed="true"]').count()) === 0,
            `${t.slice(0, 200)} · ${whys.join(",")}`);
      await page.locator('[data-tour="decline-why"]', { hasText: /^Double booked$/ }).click(); await page.waitForTimeout(300);
      check("(b2) a tap picks a reason, in ink; the times are still offered beside it",
            (await page.locator('[data-tour="decline-why"][aria-pressed="true"]').innerText()).trim() === "Double booked" && (await page.locator('[data-tour="decline-offer"] button').count()) > 0);
      await page.locator("[data-sheet] button", { hasText: /^Just decline$/ }).first().click(); await page.waitForTimeout(1200);
      const told = toldFor(db, IDS.adult, req.id);
      const row = db.bookings.find((b) => b.id === req.id);
      check("(b3) Just decline writes the reason on the row, and the player reads Request declined · Double booked · the day",
            row.status === "cancelled" && row.cancel_reason === "Double booked" && told.length === 1 && /^Request declined · Double booked · .* 10:00 am$/.test(told[0]), JSON.stringify({ status: row.status, why: row.cancel_reason, told }));
      await ctx.close();
    }

    /* ---------- (c) Something else, in the coach's words ---------- */
    {
      const db = freshDb();
      const a = await boot(db, "adult"); await askWith(a.page, null); await a.ctx.close();
      const req = requestOf(db);
      const { ctx, page } = await boot(db, "coach");
      await page.locator("button", { hasText: /^Decline$/ }).first().click(); await page.waitForTimeout(800);
      const noteOnSheet = await page.locator('[data-tour="decline-note"]').count();
      await page.locator('[data-tour="decline-why"]', { hasText: /^Something else$/ }).click(); await page.waitForTimeout(400);
      const field = page.locator('[data-tour="decline-why-note"] textarea');
      const hadField = await field.count();
      if (hadField) { await field.fill("Away at the Irish Open that week"); await page.waitForTimeout(200); }
      await page.locator("[data-sheet] button", { hasText: /^Just decline$/ }).first().click(); await page.waitForTimeout(1200);
      const told = toldFor(db, IDS.adult, req.id);
      check("(c1) a request without a note shows none; Something else opens a field with dictation, and the words lead the player's notice",
            noteOnSheet === 0 && hadField === 1 && told.length === 1 && /^Request declined · Away at the Irish Open that week · /.test(told[0]), JSON.stringify({ noteOnSheet, hadField, told }));
      await ctx.close();
    }

    /* ---------- (d) accepted: the peek reads what was asked for ---------- */
    {
      const db = freshDb();
      const a = await boot(db, "adult"); await askWith(a.page, NOTE); await a.ctx.close();
      const req = requestOf(db);
      const { ctx, page, shot } = await boot(db, "coach");
      await page.locator("button", { hasText: /^Accept$/ }).first().click(); await page.waitForTimeout(1500);
      const row = db.bookings.find((b) => b.id === req.id);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const peek = await page.locator('[data-tour="peek-note"]').count() ? M.norm(await page.locator('[data-tour="peek-note"]').innerText()) : "";
      await shot("05-peek-note");
      check("(d1) once accepted the lesson keeps the note, and its peek reads Asked for · the words",
            !!row && row.status === "confirmed" && row.note === NOTE && peek === `Asked for · ${NOTE}`, JSON.stringify({ status: row && row.status, note: row && row.note, peek }));
      await ctx.close();
    }

    /* ---------- (e) a parent asking for a child ---------- */
    {
      const db = freshDb({ family: true });
      const { ctx, page } = await boot(db, "parent");
      await openAsk(page);
      const field = page.locator('[data-tour="ask-note"] textarea');
      const ph = await field.getAttribute("placeholder").catch(() => null);
      await field.fill("Short game, she has a competition Sunday");
      await page.locator("[data-sheet] button", { hasText: /^Request for Saoirse$/ }).last().click(); await page.waitForTimeout(1500);
      const req = requestOf(db);
      const told = req ? toldFor(db, IDS.coach, req.id) : [];
      check("(e1) a parent's request for a child carries a note for the child's coach, and the coach reads it on the asking line",
            ph === "Note for Niamh" && !!req && req.player_id === IDS.junior && req.note === "Short game, she has a competition Sunday" && told.length === 1 && /· Short game, she has a competition Sunday$/.test(told[0]),
            JSON.stringify({ ph, req: req && { who: req.player_id === IDS.junior ? "junior" : req.player_id, note: req.note }, told }));
      await ctx.close();
    }

    /* ---------- (f) a project without the column ---------- */
    {
      const db = freshDb(); db.missingColumns = { bookings: ["note"] };
      const { ctx, page } = await boot(db, "adult");
      await openAsk(page);
      const fields = await page.locator('[data-tour="ask-note"]').count();
      check("(f1) where the project's bookings carry no note, no field is offered", fields === 0, `fields ${fields}`);
      await page.locator("[data-sheet] button", { hasText: /^Request/ }).last().click(); await page.waitForTimeout(1500);
      const req = requestOf(db);
      const post = db.posts.find((x) => x.table === "bookings");
      check("(f2) …and the request is still written, with no note in the insert", !!req && req.status === "requested" && !!post && !post.refused && !post.rows.some((r) => "note" in r && r.note), JSON.stringify({ req: !!req, post: post && { refused: post.refused, keys: Object.keys(post.rows[0] || {}) } }));
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
