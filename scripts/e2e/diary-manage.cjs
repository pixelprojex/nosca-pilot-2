/* THE COACH'S DIARY HAS ONE DOOR TO WHAT RUNS IT (24 November). Recurring
   lessons sat at the foot of the Diary's List, a fortnight of days down;
   Hours and Away lived in Settings and Call off on the plus, so a coach in
   the Diary could not find what runs it. Manage — one word in the
   Diary's head — opens the app's one sheet of rows of words:
   (a) the coach's Diary carries Manage: one word beside the title, in ink,
       no glyph, 44 to a finger; a player's Diary and a parent's carry none;
   (b) the sheet reads Hours · Away · Recurring lessons · Call off · Add to
       phone calendar — each a row of words (nothing before the word, the
       chevron after), its value in the sub grey: the week's days ("5
       days"), the next span away, the arrangements running ("1 running"),
       nothing on Call off (its word the red), the confirmed lessons ahead
       ("3 lessons" — not the one asked for, not the one gone);
   (c) each row does what its Settings row or the plus does: Hours opens
       Hours, Away opens Away, Recurring lessons the manager, Call off the
       call-off sheet on its Why, Add to phone calendar the iCalendar file
       of the three lessons ahead;
   (d) a coach with nothing to say: Hours, Away and Recurring lessons with
       no value — never a nought — and no Add to phone calendar row;
   (e) at 320 nothing is cut: every word and value whole, the span away on
       one line (under its word where it cannot sit beside), Manage clear
       of the title.
   Usage: node diary-manage.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 5751), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", bare: "00000000-0000-4000-8000-00000000c0ae", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
const dayWord = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${DAYS[d.getDay()]} ${d.getDate()} ${M.MON[d.getMonth()]}`; };
const INK = "rgb(28, 28, 30)", SUB = "rgb(95, 95, 101)", RED = "rgb(154, 50, 42)";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("bare", "bare@t.ie", { role: "coach", name: "Fionn Doyle", inviteCode: "FD7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* five weekdays of hours, a span away ten days out, one arrangement running */
  const week = M.weekOf(WEEK, [0, 1, 2, 3, 4]);
  week.away = [{ from: dayPlus(db, 10), to: dayPlus(db, 14) }];
  M.setPrefs(db, IDS.coach, { availability: week });
  M.addRecurring(db, { coachId: IDS.coach, playerId: IDS.adult, weekday: 2, time: "10:00 am" });
  /* three confirmed lessons ahead, one only asked for, one gone */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 1), time: "10:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: dayPlus(db, 2), time: "11:00 am", duration: 60 });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 3), time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 2), time: "4:00 pm", status: "requested" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, -1), time: "9:00 am" });
  return db;
}

const { check, results, summary } = M.checker("diary-manage");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const SPAN = `${dayWord(dayPlus(db, 10))} – ${dayWord(dayPlus(db, 14))}`;
  const boot = async (role, width = 390) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") { const tx = m.text(); if (!/vibrate|Failed to load resource|favicon/i.test(tx)) errors.push(`${role} console: ${tx.slice(0, 160)}`); } });
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const diary = async (page) => { await tap(page, '[aria-label="Diary"]', 1000); };
  const manage = async (page) => { await page.locator('[data-tour="diary-manage"]').first().click(); await page.waitForTimeout(900); };
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").dispatchEvent("click"); await page.waitForTimeout(700); };
  const rows = (page) => page.evaluate(() => [...document.querySelectorAll('[data-sheet] [data-tour="manage-row"]')].map((b) => b.getAttribute("data-manage")));
  const row = (page, id) => page.locator(`[data-sheet] [data-tour="manage-row"][data-manage="${id}"]`).first();
  const look = async (page, id) => { const n = (await rows(page)).indexOf(id); return n < 0 ? null : M.rowLead(page, '[data-sheet] [data-tour="manage-row"]', n); };
  const h1 = async (page) => M.norm(await page.locator('[data-scroll="screen"] h1').first().innerText().catch(() => ""));

  try {
    /* ---------- (a) the word in the coach's Diary, and in nobody else's ---------- */
    {
      const { ctx, page, shot } = await boot("coach");
      await diary(page);
      const w = page.locator('[data-tour="diary-manage"]');
      const said = (await w.count()) ? await w.first().evaluate((el) => {
        const cs = getComputedStyle(el), h = document.querySelector('[data-scroll="screen"] h1'), r = el.getBoundingClientRect(), hr = h ? h.getBoundingClientRect() : null;
        return { text: el.textContent.trim(), glyphs: el.querySelectorAll("svg").length, color: cs.color, bg: cs.backgroundColor, size: cs.fontSize,
                 besideTitle: !!hr && r.left >= hr.right - 1 && r.top < hr.bottom && r.bottom > hr.top, right: Math.round(r.right) };
      }) : null;
      const fit = await M.fingerFit(page, '[data-tour="diary-manage"]');
      await shot("01-coach-diary");
      check("(a1) the coach's Diary carries one Manage: the word beside the title, in ink at 16 — no glyph, no fill, never the accent",
        (await w.count()) === 1 && !!said && said.text === "Manage" && said.glyphs === 0 && said.color === INK && said.size === "16px" && /rgba\(0, 0, 0, 0\)|transparent/.test(said.bg) && said.besideTitle && said.right <= 390 - 20,
        JSON.stringify(said));
      check("(a2) …and answers a finger 44 tall", !!fit && fit.missed.length === 0 && fit.drawn[1] >= 44, JSON.stringify(fit));
      await ctx.close();
    }
    for (const role of ["adult", "parent"]) {
      const { ctx, page } = await boot(role);
      await diary(page);
      check(`(a3 ${role}) a ${role === "adult" ? "player's" : "parent's"} Diary carries no Manage`, (await page.locator('[data-tour="diary-manage"]').count()) === 0 && /Diary|Book for/.test(await h1(page)), await h1(page));
      await ctx.close();
    }

    /* ---------- (b) the sheet: rows of words, each with its value ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await diary(page); await manage(page);
      await shot("02-manage-sheet");
      const order = await rows(page);
      const head = M.norm(await page.locator('[data-sheet] [data-tour="manage-sheet"]').innerText().catch(() => ""));
      check("(b1) Manage opens the app's one sheet, headed Manage: Hours · Away · Recurring lessons · Call off · Add to phone calendar",
        head === "Manage" && order.join(",") === "hours,away,recurring,calloff,calendar", `${head} · ${order.join(",")}`);
      const L = {}; for (const id of order) L[id] = await look(page, id);
      check("(b2) every row is a row of words: the word first on the box's inset, nothing before it, the chevron after, 60 tall in a box of its own",
        order.every((id) => M.plainRow(L[id]) && L[id].h >= 60 && L[id].boxed), JSON.stringify(Object.values(L).map((o) => o && `${o.label}/${o.lead}/${o.before}/${o.glyphs}/${o.h}/${o.boxed}`)));
      check("(b3) Hours reads the week's days, 5 days", !!L.hours && L.hours.label === "Hours" && L.hours.value === "5 days" && L.hours.valueColor === SUB, JSON.stringify(L.hours));
      check("(b4) Away reads the next span ahead, the app's way", !!L.away && L.away.label === "Away" && L.away.value === SPAN && L.away.valueColor === SUB, `${JSON.stringify(L.away)} vs ${SPAN}`);
      check("(b5) Recurring lessons reads the arrangements running, 1 running", !!L.recurring && L.recurring.label === "Recurring lessons" && L.recurring.value === "1 running", JSON.stringify(L.recurring));
      check("(b6) Call off carries no value and its word is the red", !!L.calloff && L.calloff.label === "Call off" && L.calloff.value === null && L.calloff.color === RED, JSON.stringify(L.calloff));
      check("(b7) Add to phone calendar counts the confirmed lessons ahead — three, not the one asked for nor the one gone", !!L.calendar && L.calendar.label === "Add to phone calendar" && L.calendar.value === "3 lessons", JSON.stringify(L.calendar));
      check("(b8) no row's word is in the accent: Manage's sheet spends no colour but Call off's red", order.every((id) => id === "calloff" ? L[id].color === RED : L[id].color === INK), JSON.stringify(order.map((id) => L[id] && L[id].color)));

      /* ---------- (c) each row does what its Settings row or the plus does ---------- */
      await row(page, "hours").click(); await page.waitForTimeout(1100);
      const t1 = await h1(page); await shot("03-hours");
      check("(c1) Hours opens Hours", t1 === "Hours" && (await page.locator("[data-sheet] *").count()) === 0, t1);
      await M.back(page, 1000);
      check("(c1b) Back lands on the Diary", (await h1(page)) === "Diary", await h1(page));
      await manage(page); await row(page, "away").click(); await page.waitForTimeout(1100);
      const t2 = await text();
      check("(c2) Away opens Away, its span listed", (await h1(page)) === "Away" && t2.includes(SPAN), `${await h1(page)} · ${t2.slice(0, 160)}`);
      await M.back(page, 1000);
      await manage(page); await row(page, "recurring").click(); await page.waitForTimeout(1100);
      const t3 = await text();
      check("(c3) Recurring lessons opens the manager, the one arrangement in it", (await h1(page)) === "Recurring lessons" && /1 running/.test(t3) && /Cian Murphy/.test(t3), `${await h1(page)} · ${t3.slice(0, 160)}`);
      await M.back(page, 1000);
      await manage(page); await row(page, "calloff").click(); await page.waitForTimeout(900);
      const s4 = M.norm(await page.locator("[data-sheet]").innerText().catch(() => ""));
      await shot("04-call-off");
      check("(c4) Call off opens the call-off on its Why, as the plus does", /^Call off/.test(s4) && /\bWhy\b/.test(s4) && /Weather/.test(s4), s4.slice(0, 160));
      await closeSheet(page);
      await manage(page);
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), row(page, "calendar").click()]);
      await page.waitForTimeout(700);
      const ics = dl ? fs.readFileSync(await dl.path(), "utf8") : "";
      const evs = (ics.match(/BEGIN:VEVENT/g) || []).length;
      check("(c5) Add to phone calendar hands out the iCalendar file of the three lessons ahead, as Settings › Calendar does, and the sheet goes",
        !!dl && /\.ics$/.test(dl.suggestedFilename()) && evs === 3 && /SUMMARY:Lesson · Cian Murphy/.test(ics) && (await page.locator('[data-sheet] [data-tour="manage-sheet"]').count()) === 0,
        dl ? `${dl.suggestedFilename()} · ${evs}` : "no download");
      await ctx.close();
    }

    /* ---------- (d) nothing to say: no value, and no calendar row ---------- */
    {
      const { ctx, page, shot } = await boot("bare");
      await diary(page); await manage(page);
      await shot("05-bare-coach");
      const order = await rows(page);
      const L = {}; for (const id of order) L[id] = await look(page, id);
      check("(d1) a coach with no hours, no days away, nothing running and nothing booked: Hours, Away and Recurring lessons carry no value — never a nought — and there is no Add to phone calendar",
        order.join(",") === "hours,away,recurring,calloff" && ["hours", "away", "recurring", "calloff"].every((id) => L[id] && L[id].value === null) && !/\b0\b/.test(M.norm(await page.locator("[data-sheet]").innerText())),
        `${order.join(",")} · ${JSON.stringify(Object.values(L).map((o) => o && o.value))}`);
      await ctx.close();
    }

    /* ---------- (e) 320: nothing cut ---------- */
    {
      const { ctx, page, shot } = await boot("coach", 320);
      await diary(page);
      const head = await page.evaluate(() => {
        const h = document.querySelector('[data-scroll="screen"] h1'), w = document.querySelector('[data-tour="diary-manage"]'); if (!h || !w) return null;
        const hr = h.getBoundingClientRect(), wr = w.getBoundingClientRect();
        return { gap: Math.round(wr.left - hr.right), right: Math.round(wr.right), titleCut: h.scrollWidth > h.clientWidth + 1, wordCut: w.scrollWidth > w.clientWidth + 1 };
      });
      await shot("06-diary-320");
      check("(e1) at 320 the title and Manage stand apart on their line, neither cut, Manage inside the page's gutter", !!head && head.gap >= 8 && head.right <= 320 - 20 && !head.titleCut && !head.wordCut, JSON.stringify(head));
      await manage(page);
      await shot("07-manage-320");
      const order = await rows(page);
      const L = {}; for (const id of order) L[id] = await look(page, id);
      check("(e2) at 320 every row's word and value are whole", order.length === 5 && order.every((id) => L[id] && !L[id].labelCut && !L[id].valueCut), JSON.stringify(Object.values(L).map((o) => o && `${o.label}:${o.labelCut}/${o.valueCut}`)));
      const awayLine = await page.evaluate(() => {
        const r = document.querySelector('[data-sheet] [data-manage="away"]'); const v = r && r.querySelector("[data-row-value]"), l = r && r.querySelector("[data-row-label]"); if (!v || !l) return null;
        const vr = v.getBoundingClientRect(), lr = l.getBoundingClientRect(), rr = r.getBoundingClientRect();
        return { under: vr.top >= lr.bottom - 2, lines: Math.round(vr.height / parseFloat(getComputedStyle(v).lineHeight)), inside: vr.right <= rr.right - 1 };
      });
      check("(e3) the span away is whole on one line — beside its word where both fit, on the line under it where they do not — inside its box", !!awayLine && awayLine.lines === 1 && awayLine.inside, JSON.stringify(awayLine));
      await ctx.close();
    }
    check("(z) no page errors or console warnings", errors.length === 0, errors.slice(0, 4).join(" | "));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
