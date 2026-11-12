/* A LESSON MOVES IN ONE WRITE, AND THE OTHER SIDE IS TOLD. The coach's
   Move on the peek and a player's Reschedule on their block open one sheet
   — the days ahead with an open time, then the times — and one write moves
   the row: the coach's keeps the lesson's status and the player reads
   "Lesson moved · the new time · was the old"; a player's, or a parent's
   for a child, asks: the row goes to the new time as a request, the coach
   reads "asked to move a lesson" on Today and accepts it as any ask. It
   was a cancel with a reason, an offered time and the password for the
   coach, and a cancel with "Rescheduling" and "Pick a new time" for the
   player; a project without move_booking() keeps both.
   Usage: node move.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4391), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", max: "00000000-0000-4000-8000-000000000a0a", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return M.ymd(x); };
const D1 = dayFrom(1), D2 = dayFrom(2), D3 = dayFrom(3);
/* the app's one date form, as nice_date() and the mock's niceDate write it */
const nice = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`; };

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("max", "max@t.ie", { role: "player", name: "Max Walsh", type: "adult", coachId: IDS.coach, dob: "1990-01-01" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]), groups: [] });
  /* Cian's lesson is today at four (the clock is pinned to ten past nine);
     Max holds tomorrow's half ten, so that time is never offered */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.max, date: D1, time: "10:30 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: D2, time: "9:00 am" });
  return db;
}
const bookingOf = (db, pid) => db.bookings.filter((b) => b.player_id === pid && ["requested", "confirmed"].includes(b.status)).sort((a, b) => (a.booking_date < b.booking_date ? -1 : 1))[0];
const notes = (db, uid) => db.notifications.filter((n) => n.user_id === uid).map((n) => `${n.title} · ${n.body || ""}`);

const { check, results, summary } = M.checker("move");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, at = "09:10") => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T${at}:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, shot };
  };
  const { tap } = M;
  const sheet = async (page) => page.evaluate(() => {
    const sh = document.querySelector('[data-tour="move-sheet"]'); if (!sh) return null;
    return { title: (sh.querySelector("h2") || {}).textContent, days: [...sh.querySelectorAll('[data-tour="move-day"]')].map((b) => b.textContent.trim()),
             times: [...sh.querySelectorAll('[data-tour="move-time"] button')].map((b) => b.textContent.trim()), go: (sh.querySelector('[data-tour="move-go"]') || {}).textContent, disabled: !!(sh.querySelector('[data-tour="move-go"]') || {}).disabled,
             foot: (sh.querySelector('[data-tour="move-foot"]') || {}).textContent || "" };
  });
  const pickDay = async (page, label) => { await page.locator('[data-tour="move-day"]', { hasText: label }).first().dispatchEvent("click"); await page.waitForTimeout(350); };
  const pickTime = async (page, label) => { await page.locator('[data-tour="move-time"] button', { hasText: label }).first().dispatchEvent("click"); await page.waitForTimeout(350); };
  const toast = (page) => page.evaluate(() => { const el = document.querySelector('[data-tour="toast"], [role="status"]'); return el ? el.textContent : document.body.innerText.slice(0, 0); });

  try {
    /* ---------- (a) the coach moves a lesson from the peek ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "coach");
      await tap(page, '[aria-label="Today"]', 900);
      await page.locator("button", { hasText: "Cian" }).first().dispatchEvent("click"); await page.waitForTimeout(900);
      const hasMove = await page.locator('[data-tour="peek-move"]').count();
      check("(a1) the lesson's peek carries Move", hasMove === 1, `${hasMove}`);
      await tap(page, '[data-tour="peek-move"]', 900);
      const s1 = await sheet(page);
      await shot("01-coach-move-days");
      check("(a2) Move opens the Move sheet: Cian Murphy · the day · 4:00 pm, the fortnight's days with an open time as tiles, the button asleep",
        !!s1 && s1.title === "Move" && s1.days.length >= 2 && s1.days.includes(nice(D1)) && s1.disabled, JSON.stringify(s1));
      await pickDay(page, nice(D1));
      const s2 = await sheet(page);
      check("(a3) tomorrow's times leave out the half ten Max holds and offer nine and four",
        !!s2 && s2.times.includes("9:00 am") && s2.times.includes("4:00 pm") && !s2.times.includes("10:30 am"), JSON.stringify(s2 && s2.times));
      await pickTime(page, "9:00 am");
      const s3 = await sheet(page);
      await shot("02-coach-move-picked");
      check("(a4) with a day and a time the button wakes and the grey line says Cian is told", !!s3 && !s3.disabled && s3.go === "Move" && /Cian is told/.test(s3.foot), JSON.stringify(s3));
      await tap(page, '[data-tour="move-go"]', 1200);
      const bk = bookingOf(db, IDS.adult);
      const told = notes(db, IDS.adult);
      await shot("03-coach-moved");
      check("(a5) one write: the same row at tomorrow 9:00 am, still confirmed",
        !!bk && bk.booking_date === D1 && bk.start_time === "9:00 am" && bk.status === "confirmed" && db.bookings.filter((b) => b.player_id === IDS.adult).length === 1, JSON.stringify(bk));
      check("(a6) the player reads Lesson moved · the new time · was the old, and never Lesson cancelled",
        told.some((x) => x === `Lesson moved · ${nice(D1)} 9:00 am · was ${nice(TODAY)} 4:00 pm`) && !told.some((x) => /cancelled/.test(x)), told.join(" | "));
      const open = await page.locator('[data-tour="move-sheet"]').count();
      const toastText = await page.evaluate(() => document.body.innerText);
      check("(a7) the sheet closes and the toast says Moved", open === 0 && /Moved/.test(toastText), `sheet=${open}`);
      await ctx.close();
    }

    /* ---------- (b) the player asks to move, the coach accepts ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "adult");
      await tap(page, '[aria-label="Diary"]', 900);
      await page.locator('[data-tour="agenda-mine"]').first().dispatchEvent("click"); await page.waitForTimeout(900);
      const has = await page.locator('[data-tour="day-reschedule"]').count();
      check("(b1) the player's lesson block carries Reschedule", has >= 1, `${has}`);
      await tap(page, '[data-tour="day-reschedule"]', 900);
      const s1 = await sheet(page);
      await shot("04-player-ask-days");
      check("(b2) Reschedule opens Ask to move: Niamh · the day · 4:00 pm, days ahead as tiles, the grey line saying Niamh confirms and the old time is given up",
        !!s1 && s1.title === "Ask to move" && s1.days.length >= 2 && /Niamh confirms the new time/.test(s1.foot) && /is given up/.test(s1.foot), JSON.stringify(s1));
      await pickDay(page, nice(D1));
      const s2 = await sheet(page);
      check("(b3) tomorrow's times leave out the half ten another player holds, read as busy", !!s2 && s2.times.includes("9:00 am") && !s2.times.includes("10:30 am"), JSON.stringify(s2 && s2.times));
      await pickTime(page, "9:00 am");
      await tap(page, '[data-tour="move-go"]', 1200);
      const bk = bookingOf(db, IDS.adult);
      const coachNotes = notes(db, IDS.coach), mineNotes = notes(db, IDS.adult);
      await shot("05-player-asked");
      check("(b4) one write: the row at tomorrow 9:00 am as a request", !!bk && bk.booking_date === D1 && bk.start_time === "9:00 am" && bk.status === "requested", JSON.stringify(bk));
      check("(b5) the coach reads Cian Murphy asked to move a lesson · the new time · was the old; the player hears nothing of their own ask",
        coachNotes.some((x) => x === `Cian Murphy asked to move a lesson · ${nice(D1)} 9:00 am · was ${nice(TODAY)} 4:00 pm`) && !mineNotes.some((x) => /moved|asked/.test(x)), coachNotes.join(" | "));
      const text = await page.evaluate(() => document.body.innerText);
      check("(b6) the toast says Asked · Niamh confirms, and the block reads Requested at the new time", /Asked/.test(text) && /Niamh confirms/.test(text), text.slice(0, 120));
      await ctx.close();
      /* the coach's yes */
      const c = await boot(db, "coach");
      await tap(c.page, '[aria-label="Today"]', 900);
      const acc = c.page.locator("button", { hasText: /^Accept$/ }).first();
      const accCount = await acc.count();
      if (accCount) { await acc.dispatchEvent("click"); await c.page.waitForTimeout(1000); }
      const bk2 = bookingOf(db, IDS.adult);
      check("(b7) the request sits on the coach's Today with Accept, and the yes confirms it at the new time — Lesson confirmed to the player",
        accCount >= 1 && !!bk2 && bk2.status === "confirmed" && bk2.booking_date === D1 && notes(db, IDS.adult).some((x) => /^Lesson confirmed · /.test(x)), `accept=${accCount} ${JSON.stringify(bk2)} ${notes(db, IDS.adult).join(" | ")}`);
      await c.shot("06-coach-accepts-move");
      await c.ctx.close();
    }

    /* ---------- (c) a parent asks for a child's lesson to move ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "parent");
      await tap(page, '[aria-label="Diary"]', 900);
      await page.locator('[data-tour="agenda-mine"]').first().dispatchEvent("click"); await page.waitForTimeout(900);
      await tap(page, '[data-tour="day-reschedule"]', 900);
      const s1 = await sheet(page);
      await shot("07-parent-ask");
      check("(c1) a parent's Reschedule on the child's block opens Ask to move headed with the child's name", !!s1 && s1.title === "Ask to move" && s1.days.length >= 1, JSON.stringify(s1));
      await pickDay(page, nice(D3));
      await pickTime(page, "9:00 am");
      await tap(page, '[data-tour="move-go"]', 1200);
      const bk = bookingOf(db, IDS.junior);
      check("(c2) the child's row moves as a request; the coach reads Saoirse Kelly asked to move a lesson; the child reads Move asked for in their own diary",
        !!bk && bk.booking_date === D3 && bk.status === "requested"
        && notes(db, IDS.coach).some((x) => x.startsWith(`Saoirse Kelly asked to move a lesson · ${nice(D3)} 9:00 am · was ${nice(D2)} 9:00 am`))
        && notes(db, IDS.junior).some((x) => x.startsWith("Move asked for · ")), `${JSON.stringify(bk)} ${notes(db, IDS.coach).join(" | ")} ${notes(db, IDS.junior).join(" | ")}`);
      await ctx.close();
    }

    /* ---------- (d) a project whose SQL has not been re-run keeps the old paths ---------- */
    {
      const db = freshDb(); db.noMove = true;
      const c = await boot(db, "coach");
      await tap(c.page, '[aria-label="Today"]', 900);
      await c.page.locator("button", { hasText: "Cian" }).first().dispatchEvent("click"); await c.page.waitForTimeout(900);
      await tap(c.page, '[data-tour="peek-move"]', 900);
      const txt = await c.page.evaluate(() => document.body.innerText);
      check("(d1) without move_booking() the coach's Move is the Cancel sheet it was", /Cancel lesson/.test(txt) && !/Which day/.test(txt), txt.slice(0, 160));
      await c.ctx.close();
      const p = await boot(db, "adult");
      await tap(p.page, '[aria-label="Diary"]', 900);
      await p.page.locator('[data-tour="agenda-mine"]').first().dispatchEvent("click"); await p.page.waitForTimeout(900);
      await tap(p.page, '[data-tour="day-reschedule"]', 900);
      const txt2 = await p.page.evaluate(() => document.body.innerText);
      check("(d2) without it the player's Reschedule is the cancel with Pick a new time it was", /Pick a new time|Cancel lesson/.test(txt2) && !/Which day/.test(txt2), txt2.slice(0, 160));
      await p.ctx.close();
    }

    check("(z) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
