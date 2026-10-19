/* RECURRING LESSONS, the coach's side. An arrangement is a row of
   `recurring` and the lessons it booked carry it (bookings.recurring_id,
   on delete set null). Changing one changes the row in place — one
   PATCH, the same id, the lessons left as they are and the toast saying
   so. Ending one is the lessons too: why, which of the lessons still
   ahead (asked of the server, so a monthly run past the diary's 200
   days is all there), the coach's password, ONE bookings PATCH with the
   reason on every row and only then the row's DELETE — and each player
   (and a junior's adults) told, with the reason leading the line. An
   arrangement with nothing ahead ends on one tap. The Diary's Calendar
   view lists the arrangements as boxed rows that open the arrangement
   itself, never a blank "Set up". A project without the column books a
   run with no link and still ends it, by the player, the weekday and
   the time; one without cancel_reason cancels on the status alone.
   Usage: node recurring.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 5411), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
/* the three arrangements: Saoirse weekly at nine, Cian with nothing
   ahead, Saoirse monthly at four */
const REC = { R: "7e000000-0000-4000-8000-0000000000a1", S: "7e000000-0000-4000-8000-0000000000b1", M: "7e000000-0000-4000-8000-0000000000c1" };
const bid = (tag, k) => `b0000000-0000-4000-8000-0000${tag}${String(k).padStart(4, "0")}`;
const BK = { past: bid("aaff", 0), oneOff: bid("ee00", 1), cian: bid("cc00", 1), slot: bid("ee00", 2) };
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const PASSWORD = "secret12";
/* the coach's reasons, CANCEL_REASONS.coach in src/Nosca.jsx */
const COACH_REASONS = ["Unwell", "Course closed", "Double booked", "Family reasons", "Something else"];

/* every day is counted from the one the page clock is pinned to */
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
const iso = (n) => M.ymd(dayFrom(n));
const dow = (n) => dayFrom(n).getDay();
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const nice = (x) => `${DAYS[x.getDay()]} ${x.getDate()} ${MON[x.getMonth()]}`;
/* "Thu 22 Oct" wherever it sits in a row's words (a year after it is allowed) */
const DATE_RE = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) ([1-9]\d?) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;

/* R: Saoirse, weekly, nine o'clock, ten lessons ahead and one gone */
const R_OFF = Array.from({ length: 10 }, (_, k) => 3 + 7 * k);
const R_IDS = R_OFF.map((_, k) => bid("aa00", k));
/* M: Saoirse, monthly (every fourth week, so the weekday holds), four
   o'clock — the last three past the diary's 200 days */
const M_OFF = Array.from({ length: 10 }, (_, k) => 5 + 28 * k);
const M_IDS = M_OFF.map((_, k) => bid("cc11", k));
const R_DAY = dow(3), S_DAY = dow(6), M_DAY = dow(5);

/* links: the project has bookings.recurring_id; legacy: it has, but R was
   booked before it did, so R's lessons carry nothing */
function freshDb({ links = true, reasons = true, legacy = false } = {}) {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) });
  const created = `${iso(-60)}T10:00:00Z`;
  M.addRecurring(db, { id: REC.R, coachId: IDS.coach, playerId: IDS.junior, weekday: R_DAY, time: "9:00 am", cadence: "weekly", createdAt: created });
  M.addRecurring(db, { id: REC.S, coachId: IDS.coach, playerId: IDS.adult, weekday: S_DAY, time: "11:00 am", cadence: "fortnightly", createdAt: created });
  M.addRecurring(db, { id: REC.M, coachId: IDS.coach, playerId: IDS.junior, weekday: M_DAY, time: "4:00 pm", cadence: "monthly", createdAt: created });
  /* a project without the column has no link on any row */
  const link = (id) => (links && !(legacy && id === REC.R) ? id : null);
  R_OFF.forEach((n, k) => M.addBooking(db, { id: R_IDS[k], coachId: IDS.coach, playerId: IDS.junior, date: iso(n), time: "9:00 am", duration: 45, recurringId: link(REC.R) }));
  M.addBooking(db, { id: BK.past, coachId: IDS.coach, playerId: IDS.junior, date: iso(-4), time: "9:00 am", duration: 45, recurringId: link(REC.R) });
  M_OFF.forEach((n, k) => M.addBooking(db, { id: M_IDS[k], coachId: IDS.coach, playerId: IDS.junior, date: iso(n), time: "4:00 pm", duration: 45, recurringId: link(REC.M) }));
  /* a one-off for Saoirse at nine on another weekday, and Cian on R's weekday at ten */
  M.addBooking(db, { id: BK.oneOff, coachId: IDS.coach, playerId: IDS.junior, date: iso(4), time: "9:00 am", duration: 45 });
  M.addBooking(db, { id: BK.cian, coachId: IDS.coach, playerId: IDS.adult, date: iso(3), time: "10:00 am", duration: 45 });
  /* a one-off on R's own weekday and hour, after its run: where R's lessons
     carry it, this one is not R's and End must not take it */
  if (links && !legacy) M.addBooking(db, { id: BK.slot, coachId: IDS.coach, playerId: IDS.junior, date: iso(3 + 7 * 12), time: "9:00 am", duration: 45 });
  const gone = [...(links ? [] : ["recurring_id"]), ...(reasons ? [] : ["cancel_reason"])];
  if (gone.length) db.missingColumns = { bookings: gone };
  return db;
}

const { check, results, summary } = M.checker("recurring");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    /* a missing control fails its check, not the run */
    page.setDefaultTimeout(4000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) }).catch(() => {});
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const norm = M.norm;
  const lastBtn = (page, re) => page.locator("button", { hasText: re }).last();
  const sheet = (page) => page.locator("[data-sheet]");
  const sheetText = async (page) => ((await sheet(page).count()) ? norm(await sheet(page).first().innerText()) : "");
  const pw = (page) => page.locator('[data-sheet] input[type="password"]');
  const heading = (page, name) => sheet(page).getByRole("heading", { name, exact: true });
  const clickIf = async (loc, wait = 700) => { if (await loc.count()) { await loc.first().click().catch(() => {}); await loc.page().waitForTimeout(wait); return true; } return false; };
  const txt = async (loc) => ((await loc.count()) ? norm(await loc.first().innerText()) : "");
  const disabled = async (loc) => ((await loc.count()) ? (await loc.first().isDisabled()) || (await loc.first().getAttribute("aria-disabled")) === "true" : null);
  /* the toast strip is the one layer at z-index 90 with taps let through */
  const toastNow = (page) => page.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => d.style && d.style.zIndex === "90" && d.style.pointerEvents === "none"); return el ? (el.innerText || "").replace(/\s+/g, " ").trim() : null; });
  const waitToast = async (page, re, ms = 7000) => { const seen = []; const t0 = Date.now();
    while (Date.now() - t0 < ms) { const x = await toastNow(page).catch(() => null); if (x && !seen.includes(x)) seen.push(x); if (x && re.test(x)) return { hit: x, seen }; await page.waitForTimeout(70); }
    return { hit: null, seen }; };
  const since = (arr, n, table) => arr.slice(n).filter((x) => x.table === table);
  const idsOf = (q) => { const v = new URLSearchParams(q || "").get("id") || ""; const m = /^in\.\((.*)\)$/.exec(v); return m ? m[1].split(",").map((s) => s.replace(/^"|"$/g, "")) : /^eq\./.test(v) ? [v.slice(3)] : []; };
  const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const mark = (db) => ({ posts: db.posts.length, patches: db.patches.length, deletes: db.deletes.length, notes: db.notifications.length, log: db.log.length });

  const openCalendar = async (page) => {
    await tap(page, '[aria-label="Diary"]', 1000);
    const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
    if ((await on.count()) && (await on.getAttribute("aria-label")) !== "Calendar") await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 700);
  };
  const openManager = async (page) => {
    await tap(page, '[aria-label="Diary"]', 1000);
    const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
    if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
    if (await page.locator('[data-tour="cal-recurring"]').count()) await tap(page, '[data-tour="cal-recurring"]', 1000);
  };
  const calRow = (page, name, time) => page.locator('[data-tour="cal-series"]').filter({ hasText: name }).filter({ hasText: time });
  /* the manager's tile for one arrangement: the innermost box holding the
     name, the time and its End */
  const tile = (page, name, time) => { let l = page.locator("div").filter({ hasText: name }); if (time) l = l.filter({ hasText: time }); return l.filter({ has: page.locator('[data-tour="recur-end"]') }).last(); };
  const endRows = (page) => page.locator('[data-tour="end-row"]');
  const rowFacts = (page) => page.evaluate(() => [...document.querySelectorAll('[data-tour="end-row"]')].map((r) => ({ text: (r.innerText || "").replace(/\s+/g, " ").trim(), on: r.getAttribute("aria-pressed") })));
  const datesIn = (facts) => facts.map((f) => { const m = DATE_RE.exec(f.text); return m ? `${m[1]} ${m[2]} ${m[3]}` : null; });
  /* stage one, a reason, then Next */
  const pickReason = async (page, reason) => {
    await clickIf(page.locator('[data-tour="end-why"]').filter({ hasText: reason }), 400);
    await clickIf(page.locator('[data-tour="end-next"]'), 800);
  };
  const confirmBtn = (page) => page.locator('[data-tour="end-confirm"]');

  try {
    /* ================= the Calendar view's rows, Update, the manager's chips ================= */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openCalendar(page);
      await shot("01-calendar-recurring");
      const rows = page.locator('[data-tour="cal-series"]');
      const section = norm(await page.evaluate(() => { const r = document.getElementById("root"); const t = (r && r.innerText) || ""; const i = t.lastIndexOf("Recurring"); return i >= 0 ? t.slice(i, i + 260) : "(no Recurring section)"; }));
      const rRow = calRow(page, "Saoirse Kelly", "9:00");
      const nRows = await rows.count();
      await clickIf(rRow, 900);
      const s1 = await sheetText(page); await shot("02-series-sheet");
      /* (a) the row opens that arrangement: the player's whole name, Update and End */
      check("(a) the Calendar view's Recurring row for Saoirse at nine opens a sheet headed Saoirse Kelly, with Update and End",
        nRows === 3 && (await rRow.count()) === 1 && (await heading(page, "Saoirse Kelly").count()) >= 1
          && (await sheet(page).locator("button", { hasText: /^Update$/ }).count()) === 1 && (await txt(page.locator('[data-tour="series-end"]'))) === "End",
        `cal-series rows ${nRows} · R row ${await rRow.count()} · sheet: ${s1.slice(0, 160)} · section: ${section.slice(0, 160)}`);
      check("(a) …never the blank Set up: no Set up, no Book 10 lessons, no Lessons stepper",
        s1.length > 0 && !/Set up/.test(s1) && !/Book \d+ lessons/.test(s1) && (await sheet(page).locator('[aria-label="Fewer"], [aria-label="More"]').count()) === 0,
        s1.slice(0, 200) || "no sheet open");

      /* (a2) the rows are boxes on golf's edge, nothing ruled inside */
      const boxes = await page.evaluate((edge) => [...document.querySelectorAll('[data-tour="cal-series"]')].map((row) => {
        const label = (row.innerText || "").replace(/\s+/g, " ").slice(0, 30);
        const list = row.closest(".nsc-list");
        if (!list) return { label, ok: false, why: "not in a .nsc-list" };
        const box = [...list.children].find((c) => c === row || c.contains(row));
        const cs = getComputedStyle(box);
        const sides = ["Top", "Right", "Bottom", "Left"].every((s) => parseFloat(cs[`border${s}Width`]) >= 1 && cs[`border${s}Color`] === edge && cs[`border${s}Style`] === "solid");
        const bw = box.getBoundingClientRect().width; const rules = [];
        [box, ...box.querySelectorAll("*")].forEach((el) => {
          const wide = el === box || el.getBoundingClientRect().width >= 0.6 * bw;
          if (wide && /solid|dashed/.test(el.style.borderBottom || "") && !/solid|dashed/.test(el.style.borderTop || "")) rules.push(`inline ${el.style.borderBottom}`);
          if (el === box) return;
          const s = getComputedStyle(el);
          for (const side of ["Top", "Bottom"]) if (wide && parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== "none" && !/rgba\(0, 0, 0, 0\)/.test(s[`border${side}Color`])) rules.push(`${side} ${s[`border${side}Width`]}`);
        });
        const ok = sides && cs.borderTopLeftRadius === "8px" && rules.length === 0;
        return { label, ok, why: `${cs.borderTopWidth} ${cs.borderTopColor} r${cs.borderTopLeftRadius} rules[${rules.slice(0, 2).join(" | ")}]` };
      }), "rgba(47, 107, 58, 0.72)");
      check("(a2) each Recurring row is its own box in a .nsc-list: golf's edge on four sides, 8px corners, no rule inside",
        boxes.length === 3 && boxes.every((b) => b.ok), boxes.length ? boxes.map((b) => `${b.label}: ${b.ok ? "ok" : b.why}`).join(" || ") : "no cal-series rows");

      /* (b) Update after another time: the same row, changed in place */
      const m0 = mark(db);
      await clickIf(sheet(page).locator("button", { hasText: /^11:00/ }), 300);
      const upd = sheet(page).locator("button", { hasText: /^Update$/ });
      const hadUpdate = (await upd.count()) === 1;
      if (hadUpdate) await upd.first().click().catch(() => {});
      const tb = hadUpdate ? await waitToast(page, /^Updated/) : { hit: null, seen: [] };
      await page.waitForTimeout(1200); await shot("03-updated");
      const rp = since(db.patches, m0.patches, "recurring");
      const rNow = db.recurring.find((r) => r.id === REC.R);
      check("(b) Update sends exactly one PATCH to recurring id=eq.R with the new time — the same row",
        rp.length === 1 && idsOf(rp[0].query).join() === REC.R && rp[0].body.start_time === "11:00 am" && (rp[0].body.weekday == null || rp[0].body.weekday === R_DAY)
          && (rp[0].body.cadence == null || rp[0].body.cadence === "weekly") && rp[0].n === 1 && !!rNow && rNow.start_time === "11:00 am",
        JSON.stringify(rp) + ` · Update button ${hadUpdate}`);
      check("(b) …no DELETE and no POST on recurring, and the booked lessons untouched",
        hadUpdate && since(db.deletes, m0.deletes, "recurring").length === 0 && since(db.posts, m0.posts, "recurring").length === 0
          && since(db.patches, m0.patches, "bookings").length === 0 && since(db.posts, m0.posts, "bookings").length === 0 && since(db.deletes, m0.deletes, "bookings").length === 0,
        JSON.stringify({ update: hadUpdate, del: since(db.deletes, m0.deletes, "recurring").map((x) => x.query), post: since(db.posts, m0.posts, "recurring").length, bpatch: since(db.patches, m0.patches, "bookings").length }));
      check("(b) the toast reads Updated · 10 booked lessons stay as they are",
        tb.hit === "Updated 10 booked lessons stay as they are", `seen ${JSON.stringify(tb.seen)}`);

      /* (c) a day chip on the manager: a PATCH on the same id, nothing deleted */
      await openManager(page);
      const tm = await text(); await shot("04-manager");
      const toDay = (S_DAY + 1) % 7, chipLabel = DAYS_FULL[toDay].slice(0, 2);
      const chipSel = `button:text-is("${chipLabel}"), button[aria-label="${DAYS_FULL[toDay]}"]`;
      /* the smallest box holding Cian's name and the day chips: his tile
         (Cian has one arrangement, S) */
      const sTile = page.locator("div").filter({ hasText: "Cian Murphy" }).filter({ has: page.locator('[data-tour="recur-end"]') }).filter({ has: page.locator(chipSel) }).last();
      const chip = sTile.locator(chipSel);
      const m1 = mark(db);
      const chipThere = await chip.count();
      if (chipThere) await chip.first().click().catch(() => {});
      const tc = chipThere ? await waitToast(page, /^Updated/) : { hit: null, seen: [] };
      await page.waitForTimeout(1200); await shot("05-manager-chip");
      const cp = since(db.patches, m1.patches, "recurring");
      check("(c) a day chip on Cian's tile sends one PATCH to recurring id=eq.S with the new weekday, no DELETE, no POST",
        cp.length === 1 && idsOf(cp[0].query).join() === REC.S && cp[0].body.weekday === toDay && cp[0].n === 1
          && since(db.deletes, m1.deletes, "recurring").length === 0 && since(db.posts, m1.posts, "recurring").length === 0 && db.recurring.some((r) => r.id === REC.S && r.weekday === toDay),
        `chip "${chipLabel}" found ${chipThere} · ${JSON.stringify(cp)} · deletes ${JSON.stringify(since(db.deletes, m1.deletes, "recurring").map((x) => x.query))} · ${tm.slice(0, 160)}`);
      check("(c) …and with nothing booked ahead the toast is Updated alone", tc.hit === "Updated", `seen ${JSON.stringify(tc.seen)}`);
      await ctx.close();
    }

    /* ================= (d) a new arrangement links its lessons ================= */
    {
      const db = freshDb();
      db.recurring = db.recurring.filter((r) => r.id !== REC.S);   // Cian is free to be given one
      const { ctx, page, shot } = await boot(db, "coach");
      await openManager(page);
      await tap(page, '[data-tour="recur-add"]', 900);
      await clickIf(sheet(page).locator("button", { hasText: "Cian Murphy" }), 900);
      const m0 = mark(db);
      await clickIf(page.locator("button", { hasText: /^Book \d+ lessons$/ }), 2500);
      await shot("06-new-arrangement");
      const rc = since(db.posts, m0.posts, "recurring").filter((x) => !x.refused);
      const rb = since(db.posts, m0.posts, "bookings").filter((x) => !x.refused);
      const newId = rc.length ? rc[0].rows[0].id : null;
      const at = (re) => db.log.slice(m0.log).findIndex((l) => re.test(l));
      check("(d) a new arrangement POSTs recurring, then its lessons, each carrying recurring_id = the new row's id",
        rc.length === 1 && rc[0].rows[0].player_id === IDS.adult && rb.length === 1 && rb[0].rows.length >= 1 && rb[0].rows.every((r) => r.player_id === IDS.adult && r.status === "confirmed" && !!newId && r.recurring_id === newId)
          && at(/^POST \/rest\/v1\/recurring/) >= 0 && at(/^POST \/rest\/v1\/recurring/) < at(/^POST \/rest\/v1\/bookings/),
        JSON.stringify({ recurring: rc.map((x) => x.rows[0]), bookings: rb.map((x) => x.rows.map((r) => r.recurring_id)) }).slice(0, 300));
      await ctx.close();
    }

    /* ================= End on R: why, which, the password, one write ================= */
    const db = freshDb();
    {
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openCalendar(page);
      await clickIf(calRow(page, "Saoirse Kelly", "9:00"), 900);
      await clickIf(page.locator('[data-tour="series-end"]'), 900);
      const e1 = await sheetText(page); await shot("07-end-why");
      const why = page.locator('[data-tour="end-why"]');
      const whyTexts = await why.evaluateAll((els) => els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()));
      const whyPressed = await why.evaluateAll((els) => els.map((e) => e.getAttribute("aria-pressed")));
      const next = page.locator('[data-tour="end-next"]');
      /* (e) why first: the coach's reasons, Next asleep until one is picked */
      check("(e) End on R opens one sheet headed End, naming Saoirse Kelly and the standing slot",
        (await page.locator('[data-tour="end-series"]').count()) === 1 && (await heading(page, "End").count()) >= 1 && e1.includes(`Saoirse Kelly · ${DAYS_FULL[R_DAY]}s 9:00 am`),
        `end-series ${await page.locator('[data-tour="end-series"]').count()} · ${e1.slice(0, 200)}`);
      check("(e) …with the coach's cancel reasons as rows, none pressed, and Next disabled",
        JSON.stringify(whyTexts) === JSON.stringify(COACH_REASONS) && whyPressed.every((p) => p === "false") && (await disabled(next)) === true,
        `${JSON.stringify(whyTexts)} · pressed ${JSON.stringify(whyPressed)} · next disabled ${await disabled(next)}`);
      const fields = page.locator('[data-tour="end-series"] textarea, [data-tour="end-series"] input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])');
      const f0 = await fields.count();
      await clickIf(why.filter({ hasText: "Something else" }), 400);
      check("(e) Something else opens a field to say it in", f0 === 0 && (await fields.count()) >= 1 && (await why.filter({ hasText: "Something else" }).getAttribute("aria-pressed").catch(() => null)) === "true", `fields before ${f0} after ${await fields.count()}`);
      await clickIf(why.filter({ hasText: "Unwell" }), 400);
      check("(e) picking Unwell presses it alone and wakes Next",
        (await why.filter({ hasText: "Unwell" }).getAttribute("aria-pressed").catch(() => null)) === "true" && (await why.evaluateAll((els) => els.filter((e) => e.getAttribute("aria-pressed") === "true").length)) === 1 && (await disabled(next)) === false,
        `next disabled ${await disabled(next)}`);
      await clickIf(next, 900);

      /* (f) which lessons: exactly R's ten ahead */
      const e2 = await sheetText(page); await shot("08-end-which");
      const facts = await rowFacts(page);
      const dates = datesIn(facts);
      const wantR = R_OFF.map((n) => nice(dayFrom(n)));
      check("(f) Which lessons, Untick any that still go ahead", (await heading(page, "Which lessons").count()) >= 1 && e2.includes("Untick any that still go ahead"), e2.slice(0, 200));
      check("(f) …lists exactly R's ten ahead, all ticked: not the one gone, not the one-off at nine on another day, not the unlinked one-off on R's own slot, not Cian's at ten",
        facts.length === 10 && sameSet(dates.filter(Boolean), wantR) && facts.every((f) => f.on === "true" && /9:00/.test(f.text) && !/10:00|4:00/.test(f.text)) && !dates.includes(nice(dayFrom(-4))) && !dates.includes(nice(dayFrom(4))) && !dates.includes(nice(dayFrom(3 + 7 * 12))),
        `${facts.length} rows: ${facts.map((f) => `${f.text}[${f.on}]`).join(" | ").slice(0, 300)}`);
      check("(f) the button reads Cancel 10 lessons", (await txt(confirmBtn(page))) === "Cancel 10 lessons", await txt(confirmBtn(page)));
      /* untick the second, which goes ahead */
      const keepDate = nice(dayFrom(R_OFF[1])), keepId = R_IDS[1];
      const keepRow = endRows(page).filter({ hasText: keepDate });
      await clickIf(keepRow, 400);
      check("(f) unticking one leaves nine and the button says so",
        (await keepRow.count()) === 1 && (await keepRow.getAttribute("aria-pressed")) === "false" && (await txt(confirmBtn(page))) === "Cancel 9 lessons",
        `row ${await keepRow.count()} · ${await txt(confirmBtn(page))}`);

      /* (g) the password: a wrong one writes nothing */
      await clickIf(confirmBtn(page), 900);
      const e3 = await sheetText(page); await shot("09-end-password");
      const act = lastBtn(page, /^Cancel 9 lessons$/);
      check("(g) the third stage is the coach's password: the field, Cancel 9 lessons, and Back",
        (await pw(page).count()) === 1 && (await act.count()) >= 1 && (await sheet(page).locator("button", { hasText: /^Back$/ }).count()) >= 1, e3.slice(0, 200));
      check("(g) …promising the reason travels", /with the reason/.test(e3), e3.slice(0, 200));
      const m0 = mark(db);
      if (await pw(page).count()) { await pw(page).fill("wrongone"); await act.click().catch(() => {}); await page.waitForTimeout(1400); }
      const e4 = await sheetText(page); await shot("10-end-wrong-password");
      check("(g) a wrong password is refused with a line, and nothing is written: no bookings PATCH, R still there",
        /That password isn't right\./.test(e4) && since(db.patches, m0.patches, "bookings").length === 0 && since(db.deletes, m0.deletes, "recurring").length === 0 && db.recurring.some((r) => r.id === REC.R) && (await pw(page).count()) === 1,
        `${e4.slice(0, 160)} · bookings patches ${since(db.patches, m0.patches, "bookings").length} · recurring deletes ${since(db.deletes, m0.deletes, "recurring").length}`);

      /* (h) the right one: one PATCH of the nine, then the DELETE */
      const m1 = mark(db);
      let tj = { hit: null, seen: [] };
      if (await pw(page).count()) { await pw(page).fill(PASSWORD); await act.click().catch(() => {}); tj = await waitToast(page, /^Ended/, 8000); }
      await page.waitForTimeout(1500); await shot("11-ended");
      const bp = since(db.patches, m1.patches, "bookings");
      const rd = since(db.deletes, m1.deletes, "recurring");
      const ticked = R_IDS.filter((id) => id !== keepId);
      const log = db.log.slice(m1.log);
      const pAt = log.findIndex((l) => /^PATCH \/rest\/v1\/bookings/.test(l)), dAt = log.findIndex((l) => /^DELETE \/rest\/v1\/recurring/.test(l));
      check("(h) one bookings PATCH of exactly the nine ticked ids, {status: cancelled, cancel_reason: Unwell}",
        bp.length === 1 && sameSet(idsOf(bp[0].query), ticked) && bp[0].n === 9 && !bp[0].refused && bp[0].body.status === "cancelled" && bp[0].body.cancel_reason === "Unwell" && Object.keys(bp[0].body).length === 2,
        JSON.stringify(bp.map((x) => ({ ids: idsOf(x.query).length, body: x.body, n: x.n }))));
      check("(h) …made before the DELETE of R, which goes",
        rd.length === 1 && idsOf(rd[0].query).join() === REC.R && rd[0].rows.length === 1 && pAt >= 0 && dAt > pAt && !db.recurring.some((r) => r.id === REC.R),
        `patch at ${pAt} · delete at ${dAt} · ${JSON.stringify(rd.map((x) => x.query))}`);
      const st = (id) => (db.bookings.find((b) => b.id === id) || {}).status;
      check("(h) the unticked lesson is still confirmed, the nine cancelled, the past one and the others untouched",
        st(keepId) === "confirmed" && ticked.every((id) => st(id) === "cancelled") && st(BK.past) === "confirmed" && st(BK.oneOff) === "confirmed" && st(BK.cian) === "confirmed" && M_IDS.every((id) => st(id) === "confirmed"),
        JSON.stringify({ keep: st(keepId), ticked: ticked.map(st), past: st(BK.past), oneOff: st(BK.oneOff), cian: st(BK.cian) }));

      /* (i) each told, with the reason first */
      const notes = db.notifications.slice(m1.notes);
      const kid = notes.filter((n) => n.user_id === IDS.junior && n.title === "Lesson cancelled");
      const orla = notes.filter((n) => n.user_id === IDS.parent && n.title === "Saoirse's lesson cancelled");
      check("(i) Saoirse is told nine times, Lesson cancelled · Unwell · the day 9:00 am",
        kid.length === 9 && kid.every((n) => /^Unwell · .* 9:00 am$/.test(n.body || "")), JSON.stringify(kid.map((n) => n.body)).slice(0, 300));
      check("(i) Orla nine times, Saoirse's lesson cancelled · Unwell · …",
        orla.length === 9 && orla.every((n) => /^Unwell · /.test(n.body || "")), JSON.stringify(orla.map((n) => n.body)).slice(0, 300));
      check("(i) the coach (and Cian) are told nothing", notes.filter((n) => n.user_id === IDS.coach || n.user_id === IDS.adult).length === 0 && notes.length > 0,
        JSON.stringify(notes.filter((n) => n.user_id === IDS.coach || n.user_id === IDS.adult).map((n) => n.title)) + ` · ${notes.length} new`);

      /* (j) the toast */
      check("(j) the toast reads Ended · Saoirse Kelly · 9 lessons cancelled", tj.hit === "Ended Saoirse Kelly · 9 lessons cancelled", `seen ${JSON.stringify(tj.seen)}`);

      /* (l) S has nothing ahead: one tap, no password, the DELETE alone */
      await openManager(page);
      const tl = await text(); await shot("12-manager-after");
      await clickIf(tile(page, "Cian Murphy").locator('[data-tour="recur-end"]'), 900);
      const l1 = await sheetText(page); await shot("13-end-nothing-ahead");
      check("(l) End on S: End, Nothing booked ahead, End it and Keep it — no reasons, no password",
        (await heading(page, "End").count()) >= 1 && /Nothing booked ahead/.test(l1) && (await txt(confirmBtn(page))) === "End it" && (await sheet(page).locator("button", { hasText: /^Keep it$/ }).count()) === 1
          && (await page.locator('[data-tour="end-why"]').count()) === 0 && (await pw(page).count()) === 0,
        `${l1.slice(0, 200) || "no sheet"} · manager: ${tl.slice(0, 120)}`);
      const m2 = mark(db);
      const hadEndIt = await clickIf(confirmBtn(page), 1600);
      check("(l) …End it DELETEs S and writes nothing else, asking no password",
        hadEndIt && (await pw(page).count()) === 0 && since(db.deletes, m2.deletes, "recurring").length === 1 && idsOf(since(db.deletes, m2.deletes, "recurring")[0].query).join() === REC.S
          && since(db.patches, m2.patches, "bookings").length === 0 && !db.recurring.some((r) => r.id === REC.S),
        JSON.stringify({ deletes: since(db.deletes, m2.deletes, "recurring").map((x) => x.query), bpatch: since(db.patches, m2.patches, "bookings").length, pw: await pw(page).count() }));

      /* (o) M runs past the diary's 200 days: every lesson ahead is listed */
      await openManager(page);
      await clickIf(tile(page, "Saoirse Kelly", "4:00").locator('[data-tour="recur-end"]'), 900);
      await pickReason(page, "Unwell");
      const of = await rowFacts(page); await shot("14-end-monthly");
      const od = datesIn(of);
      const wantM = M_OFF.map((n) => nice(dayFrom(n)));
      const beyond = M_OFF.filter((n) => n > 200).map((n) => nice(dayFrom(n)));
      check(`(o) End on the monthly run lists all ten, ${beyond.length} of them past 200 days (${beyond.join(", ")})`,
        of.length === 10 && sameSet(od.filter(Boolean), wantM) && beyond.length >= 1 && beyond.every((d) => od.includes(d)) && of.every((f) => f.on === "true" && /4:00/.test(f.text)),
        `${of.length} rows: ${of.map((f) => f.text).join(" | ").slice(0, 300)}`);
      /* every row unticked: End, and no password */
      for (let i = 0; i < of.length; i++) { await endRows(page).nth(i).click().catch(() => {}); await page.waitForTimeout(120); }
      const allOff = (await endRows(page).evaluateAll((els) => els.filter((e) => e.getAttribute("aria-pressed") === "true").length)) === 0;
      const lbl = await txt(confirmBtn(page));
      const m3 = mark(db);
      const hadEnd = await clickIf(confirmBtn(page), 1600); await shot("15-end-monthly-none");
      check("(o) with every row unticked the button reads End, and ends M with no password and no bookings write",
        of.length === 10 && allOff && lbl === "End" && hadEnd && (await pw(page).count()) === 0 && since(db.deletes, m3.deletes, "recurring").length === 1
          && idsOf(since(db.deletes, m3.deletes, "recurring")[0].query).join() === REC.M && since(db.patches, m3.patches, "bookings").length === 0 && M_IDS.every((id) => st(id) === "confirmed"),
        JSON.stringify({ allOff, lbl, pw: await pw(page).count(), deletes: since(db.deletes, m3.deletes, "recurring").map((x) => x.query), bpatch: since(db.patches, m3.patches, "bookings").length }));
      await ctx.close();
    }
    /* (k) the family's Diary: the nine gone, the one kept */
    {
      const { ctx, page, shot } = await boot(db, "parent");
      await tap(page, '[aria-label="Diary"]', 1000);
      const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await on.count()) && (await on.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      await page.waitForTimeout(600); await shot("16-parent-list");
      const days = await page.evaluate(() => [...document.querySelectorAll(".nsc-day")].map((box) => ({
        head: box.previousElementSibling ? (box.previousElementSibling.innerText || "").replace(/\s+/g, " ").trim() : "",
        mine: [...box.querySelectorAll('[data-tour="agenda-mine"]')].map((r) => (r.innerText || "").replace(/\s+/g, " ").trim()) })));
      const at = (n) => days.find((d) => d.head === nice(dayFrom(n)));
      const nineOn = (n) => { const d = at(n); return d ? d.mine.filter((x) => /^9:00 am/.test(x)).length : -1; };
      const seen = [R_OFF[0], R_OFF[1], R_OFF[2], 4, 5].map((n) => `${nice(dayFrom(n))}: ${JSON.stringify(at(n) ? at(n).mine : null)}`).join(" | ");
      check("(k) Orla's Diary (for Saoirse) no longer shows the cancelled lessons as hers, and still shows the one kept",
        nineOn(R_OFF[0]) === 0 && nineOn(R_OFF[2]) === 0 && nineOn(R_OFF[1]) === 1 && nineOn(4) === 1 && !!at(5) && at(5).mine.some((x) => /^4:00 pm/.test(x)),
        seen);
      await ctx.close();
    }

    /* ================= (m) a project without bookings.recurring_id ================= */
    {
      const dbm = freshDb({ links: false });
      dbm.recurring = dbm.recurring.filter((r) => r.id !== REC.S);
      const { ctx, page, shot } = await boot(dbm, "coach");
      await openManager(page);
      await tap(page, '[data-tour="recur-add"]', 900);
      await clickIf(sheet(page).locator("button", { hasText: "Cian Murphy" }), 900);
      const m0 = mark(dbm);
      await clickIf(page.locator("button", { hasText: /^Book \d+ lessons$/ }), 2500);
      const all = since(dbm.posts, m0.posts, "bookings");
      const rb = all.filter((x) => !x.refused);
      check("(m) without the column a new arrangement still books its run, the rows carrying no recurring_id",
        since(dbm.posts, m0.posts, "recurring").filter((x) => !x.refused).length === 1 && all.length === 1 && rb.length === 1 && rb[0].rows.length >= 1 && rb[0].rows.every((r) => !("recurring_id" in r) || r.recurring_id === null),
        JSON.stringify(all.map((x) => ({ refused: !!x.refused, n: x.rows.length, keys: Object.keys(x.rows[0] || {}) }))));
      /* wait out the toast and the reload, then End R, found by its slot */
      await page.waitForTimeout(1200);
      await openManager(page);
      await clickIf(tile(page, "Saoirse Kelly", "9:00").locator('[data-tour="recur-end"]'), 900);
      await pickReason(page, "Unwell");
      const mf = await rowFacts(page); const md = datesIn(mf); await shot("17-nolink-which");
      check("(m) …and End still lists R's ten ahead by Saoirse, the weekday and nine o'clock",
        mf.length === 10 && sameSet(md.filter(Boolean), R_OFF.map((n) => nice(dayFrom(n)))) && mf.every((f) => f.on === "true" && /9:00/.test(f.text)),
        `${mf.length} rows: ${mf.map((f) => f.text).join(" | ").slice(0, 300)}`);
      await clickIf(confirmBtn(page), 900);
      const m1 = mark(dbm);
      if (await pw(page).count()) { await pw(page).fill(PASSWORD); await lastBtn(page, /^Cancel 10 lessons$/).click().catch(() => {}); await page.waitForTimeout(2500); }
      const bp = since(dbm.patches, m1.patches, "bookings"), rd = since(dbm.deletes, m1.deletes, "recurring");
      check("(m) …and cancels exactly those ten in one PATCH, then DELETEs R",
        bp.length === 1 && !bp[0].refused && sameSet(idsOf(bp[0].query), R_IDS) && bp[0].n === 10 && bp[0].body.status === "cancelled" && bp[0].body.cancel_reason === "Unwell"
          && rd.length === 1 && idsOf(rd[0].query).join() === REC.R,
        JSON.stringify({ patches: bp.map((x) => ({ ids: idsOf(x.query).length, body: x.body, n: x.n, refused: !!x.refused })), deletes: rd.map((x) => x.query) }));
      await ctx.close();
    }

    /* ================= (n) a project without bookings.cancel_reason ================= */
    {
      const dbn = freshDb({ reasons: false });
      const { ctx, page, shot } = await boot(dbn, "coach");
      await openManager(page);
      await clickIf(tile(page, "Saoirse Kelly", "9:00").locator('[data-tour="recur-end"]'), 900);
      await pickReason(page, "Unwell");
      const nf = await rowFacts(page);
      await clickIf(confirmBtn(page), 900);
      const n3 = await sheetText(page); await shot("18-noreason-password");
      check("(n) without cancel_reason the password stage promises no reason", nf.length === 10 && (await pw(page).count()) === 1 && !/with the reason/.test(n3), `${nf.length} rows · ${n3.slice(0, 200)}`);
      const m1 = mark(dbn);
      if (await pw(page).count()) { await pw(page).fill(PASSWORD); await lastBtn(page, /^Cancel 10 lessons$/).click().catch(() => {}); await page.waitForTimeout(2500); }
      const bp = since(dbn.patches, m1.patches, "bookings"), rd = since(dbn.deletes, m1.deletes, "recurring");
      check("(n) …and cancels the ten on the status alone, never refused, then DELETEs R",
        bp.length === 1 && !bp[0].refused && sameSet(idsOf(bp[0].query), R_IDS) && bp[0].n === 10 && JSON.stringify(bp[0].body) === JSON.stringify({ status: "cancelled" }) && rd.length === 1 && idsOf(rd[0].query).join() === REC.R,
        JSON.stringify({ patches: bp.map((x) => ({ body: x.body, n: x.n, refused: !!x.refused })), deletes: rd.map((x) => x.query) }));
      await ctx.close();
    }
    /* ================= (q) a run booked before its lessons carried it, moved, then ended ================= */
    {
      const db = freshDb({ legacy: true });
      const { ctx, page, shot } = await boot(db, "coach");
      await openCalendar(page);
      await clickIf(calRow(page, "Saoirse Kelly", "9:00"), 900);
      await clickIf(sheet(page).locator("button", { hasText: /^11:00/ }), 300);
      const m0 = mark(db);
      await clickIf(sheet(page).locator("button", { hasText: /^Update$/ }), 0);
      const tq = await waitToast(page, /^Updated/);
      await page.waitForTimeout(1200); await shot("19-legacy-moved");
      const ps = db.patches.slice(m0.patches);
      const link = ps.findIndex((x) => x.table === "bookings"), move = ps.findIndex((x) => x.table === "recurring");
      check("(q) moving a run whose lessons carry nothing links its ten first, then moves it — the lessons stay on their day",
        link >= 0 && move > link && sameSet(idsOf(ps[link].query), R_IDS) && ps[link].n === 10 && JSON.stringify(ps[link].body) === JSON.stringify({ recurring_id: REC.R })
          && idsOf(ps[move].query).join() === REC.R && db.bookings.filter((b) => R_IDS.includes(b.id)).every((b) => b.start_time === "9:00 am" && b.status === "confirmed")
          && !!tq.hit && /10 booked lessons stay as they are/.test(tq.hit),
        JSON.stringify({ patches: ps.map((x) => ({ t: x.table, ids: idsOf(x.query).length, body: x.body, n: x.n })), toast: tq.seen }));
      await openManager(page);
      await clickIf(tile(page, "Saoirse Kelly", "11:00").locator('[data-tour="recur-end"]'), 900);
      await pickReason(page, "Unwell");
      const qf = await rowFacts(page); const qd = datesIn(qf);
      check("(q) …and End, after the move, still lists those ten at nine",
        qf.length === 10 && sameSet(qd.filter(Boolean), R_OFF.map((n) => nice(dayFrom(n)))) && qf.every((f) => /9:00/.test(f.text)),
        `${qf.length} rows: ${qf.map((f) => f.text).join(" | ").slice(0, 300)}`);
      await ctx.close();
    }

    /* ================= (r) without the column, such a run does not move ================= */
    {
      const db = freshDb({ links: false });
      const { ctx, page } = await boot(db, "coach");
      await openCalendar(page);
      await clickIf(calRow(page, "Saoirse Kelly", "9:00"), 900);
      await clickIf(sheet(page).locator("button", { hasText: /^11:00/ }), 300);
      const m0 = mark(db);
      await clickIf(sheet(page).locator("button", { hasText: /^Update$/ }), 0);
      const tr2 = await waitToast(page, /database needs updating/i);
      await page.waitForTimeout(800);
      check("(r) where the column is not there yet, moving a run with lessons ahead is refused with a line, and nothing is written",
        !!tr2.hit && since(db.patches, m0.patches, "recurring").length === 0 && since(db.patches, m0.patches, "bookings").length === 0 && db.recurring.some((r) => r.id === REC.R && r.start_time === "9:00 am"),
        JSON.stringify({ toast: tr2.seen, patches: db.patches.slice(m0.patches).map((x) => x.table) }));
      await ctx.close();
    }

    /* ================= (s) a linked run with none of its own ahead takes nothing on its slot ================= */
    {
      const db = freshDb();
      db.bookings.forEach((b) => { if (R_IDS.includes(b.id)) b.status = "cancelled"; });
      const { ctx, page } = await boot(db, "coach");
      await openManager(page);
      await clickIf(tile(page, "Saoirse Kelly", "9:00").locator('[data-tour="recur-end"]'), 1200);
      const s3 = await sheetText(page);
      check("(s) a run whose own lessons are all cancelled reads Nothing booked ahead — the one-off on its weekday and hour is not its",
        /Nothing booked ahead/.test(s3) && (await endRows(page).count()) === 0 && (await txt(confirmBtn(page))) === "End it",
        s3.slice(0, 200));
      await ctx.close();
    }

    /* ================= (t) the Diary row opens that arrangement, not the player's first ================= */
    {
      const db = freshDb();
      const { ctx, page } = await boot(db, "coach");
      await openCalendar(page);
      await clickIf(calRow(page, "Saoirse Kelly", "4:00"), 900);
      const m0 = mark(db);
      await clickIf(sheet(page).locator("button", { hasText: /^Update$/ }), 0);
      await waitToast(page, /^Updated/);
      const rp = since(db.patches, m0.patches, "recurring");
      check("(t) Saoirse's four o'clock row opens the monthly arrangement: its Update changes M, never R",
        rp.length === 1 && idsOf(rp[0].query).join() === REC.M && rp[0].body.start_time === "4:00 pm" && rp[0].body.cadence === "monthly",
        JSON.stringify(rp.map((x) => ({ ids: idsOf(x.query), body: x.body }))));
      await ctx.close();
    }
    check("(p) no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
