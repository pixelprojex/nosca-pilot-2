/* A GROUP'S LESSONS REACH ITS MEMBERS. A group booking carries a name
   and no player, and trg_bookings_notify returned at once for it, so a
   clinic called off for rain told no family while the coach's screen
   said "everyone told". The members live on the coach's own preferences
   (the group's memberIds), which only the database's group_members()
   reads. This suite proves: a new group's run of weeks told once per
   member with the count and the first day, a junior member's adult
   told as theirs, nobody else told; a call-off for weather and one with
   a reason reaching every member and a junior member's adult, the
   reason first; a member who has left the roster never told; a group
   nobody saved still called off with nobody told; the member's tap
   landing on the Diary's day and the adult's on Family. Then the
   member's own side (my_group_bookings()): the Diary's List row under
   the group's name for a member, a junior and a parent, the coach's
   taken hour not drawn twice beside it; the Calendar block at the
   group's own length with no Cancel or Reschedule; a junior's never
   "Booked by your parent"; Settings › Calendar exporting it; the
   family's Coming up holding only the household's groups; a non-member's
   own Cancel still working; the clinic and the member's own lesson on
   one day as two blocks; a group lesson logged telling each attendee,
   and a photo added later telling them again; and a project without the
   function drawing the diary as before.
   Usage: node group-notify.cjs <distDir> <port> <outDir> */
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

const { check, results, summary } = M.checker("group-notify");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, { carryOn = true } = {}) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
    /* nine in the morning, so today's four o'clock is still ahead */
    await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T09:00:00`));
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn });
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const pw = (page) => page.locator('input[type="password"]');
  const lastBtn = (page, re) => page.locator("button", { hasText: re }).last();
  const told = (db, who, title) => db.notifications.filter((n) => n.user_id === IDS[who] && (title instanceof RegExp ? title.test(n.title) : n.title === title));
  const callOff = async (page, reason, n) => {
    await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-weather"]', 900);
    await M.click(page, reason, 400); await M.click(page, "Next", 700); await M.click(page, "Next", 700);
    await M.click(page, `Call off ${n} lessons`, 800);
    await pw(page).fill("secret12"); await lastBtn(page, new RegExp(`^Call off ${n} lessons$`)).click(); await page.waitForTimeout(2000);
  };

  try {
    /* ---------- (a) a new group's weeks, told once per member ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach");
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-group"]', 900);
      await page.locator('[data-sheet] input[placeholder="Group name"]').fill("Sunday juniors");
      await page.locator("[data-sheet] button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(200);
      await page.locator("[data-sheet] button", { hasText: "Saoirse Kelly" }).first().click(); await page.waitForTimeout(200);
      for (let i = 0; i < 3; i++) { await page.locator('[data-sheet] [aria-label="Fewer"]').click(); await page.waitForTimeout(120); }
      await lastBtn(page, /^Create group$/).click(); await page.waitForTimeout(2200);
      await shot("01-group-created");
      const post = db.posts.filter((x) => x.table === "bookings").pop();
      check("(a) the group books its three weeks in one insert", !!post && post.rows.length === 3 && post.rows.every((r) => r.group_name === "Sunday juniors" && !r.player_id), JSON.stringify(post && post.rows.map((r) => [r.booking_date, r.group_name])));
      const first = post ? post.rows.slice().sort((x, y) => String(x.booking_date).localeCompare(String(y.booking_date)))[0] : null;
      const ca = told(db, "adult", "Sunday juniors booked"), cs = told(db, "junior", "Sunday juniors booked"), co = told(db, "parent", "Saoirse's Sunday juniors booked");
      check("(a) each member is told once, with the count and the first day, landing on the Diary", ca.length === 1 && /^3 lessons · from \w{3} \d{1,2} \w{3} 2:00 pm$/.test(ca[0].body) && ca[0].data.screen === "calendar" && !!first && ca[0].data.id === first.id && cs.length === 1, JSON.stringify([ca, cs]));
      check("(a) a junior member's adult is told it is the child's, on Family", co.length === 1 && co[0].data.screen === "family" && /^3 lessons · from /.test(co[0].body), JSON.stringify(co));
      check("(a) nobody outside the group is told — not another player, not the coach", ![IDS.aoife, IDS.eoin, IDS.coach].some((id) => db.notifications.some((n) => n.user_id === id && /Sunday juniors/.test(n.title))), JSON.stringify(db.notifications.map((n) => [n.user_id.slice(-4), n.title])));
      void text;
      await ctx.close();
    }
    /* ---------- (b) rained off: every member, and the junior's adult ---------- */
    const dbB = freshDb();
    {
      const { ctx, page, shot } = await boot(dbB, "coach");
      await callOff(page, "Weather", 2); await shot("02-called-off");
      const p = dbB.patches.filter((x) => x.table === "bookings").pop();
      check("(b) the call-off takes the clinic and Aoife's lesson together", !!p && p.body.status === "weather" && p.n === 2, JSON.stringify(p));
      const wa = told(dbB, "adult", "Saturday clinic called off — weather"), wj = told(dbB, "junior", "Saturday clinic called off — weather"), wo = told(dbB, "parent", "Saoirse's Saturday clinic called off");
      check("(b) each member reads the clinic called off for weather, the day and the coach, landing on the Diary", wa.length === 1 && wa[0].kind === "weather" && / · Niamh Byrne$/.test(wa[0].body) && wa[0].data.screen === "calendar" && wa[0].data.id === BK.group && wj.length === 1, JSON.stringify([wa, wj]));
      check("(b) the junior member's adult is told it is the child's clinic, on Family", wo.length === 1 && wo[0].kind === "weather" && / · weather$/.test(wo[0].body) && wo[0].data.screen === "family", JSON.stringify(wo));
      check("(b) Aoife's own lesson still says so; Eoin, gone from the roster, and the coach hear nothing", told(dbB, "aoife", "Called off — weather").length === 1 && !dbB.notifications.some((n) => (n.user_id === IDS.eoin || n.user_id === IDS.coach) && n.data && n.data.id === BK.group), JSON.stringify(dbB.notifications.map((n) => [n.user_id.slice(-4), n.title])));
      await ctx.close();
    }
    /* ---------- (c) a reason leads, and a group nobody saved tells nobody ---------- */
    {
      const db = freshDb({ popup: true });
      const { ctx, page } = await boot(db, "coach");
      await callOff(page, "Course closed", 3);
      const p = db.patches.filter((x) => x.table === "bookings").pop();
      check("(c) Course closed cancels all three, the reason on each row", !!p && p.body.status === "cancelled" && p.body.cancel_reason === "Course closed" && p.n === 3, JSON.stringify(p));
      const ca = told(db, "adult", "Saturday clinic cancelled"), co = told(db, "parent", "Saoirse's Saturday clinic cancelled");
      check("(c) the member and the junior member's adult read the reason first", ca.length === 1 && /^Course closed · /.test(ca[0].body) && co.length === 1 && /^Course closed · /.test(co[0].body), JSON.stringify([ca, co]));
      check("(c) a group nobody saved is called off and tells nobody", db.bookings.find((b) => b.id === BK.popup).status === "cancelled" && !db.notifications.some((n) => n.data && n.data.id === BK.popup), JSON.stringify(db.notifications.filter((n) => n.data && n.data.id === BK.popup)));
      await ctx.close();
    }
    /* ---------- (d) the member's tap lands on the Diary's day; the adult's on Family ---------- */
    {
      const landed = (page) => page.evaluate(() => {
        const on = document.querySelector('[data-day][aria-pressed="true"]');
        const view = document.querySelector('[data-tour="cal-view"] button[aria-pressed="true"]');
        return { day: on ? on.getAttribute("data-day") : null, view: view ? view.getAttribute("aria-label") : null };
      });
      const open = async (page, title) => {
        const cu = page.locator('[data-tour="catchup-list"] button', { hasText: title });
        if (await cu.count()) { await cu.first().click(); }
        else { await tap(page, '[aria-label="Alerts"]', 900); const row = page.locator('[data-tour="alerts-list"] button', { hasText: title }); if (!(await row.count())) return false; await row.first().click(); }
        await page.waitForTimeout(1300); return true;
      };
      {
        const { ctx, page, text, shot } = await boot(dbB, "adult", { carryOn: false });
        const ok = await open(page, "Saturday clinic called off");
        const l = await landed(page), t = await text(); await shot("03-member-lands");
        check("(d) the member's notice opens the Diary on the clinic's day, on the Calendar view", ok && l.day === String(Number(dayPlus(dbB, 0).slice(8, 10))) && l.view === "Calendar", `${ok} ${JSON.stringify(l)} · ${t.slice(0, 160)}`);
        await ctx.close();
      }
      {
        const { ctx, page, text, shot } = await boot(dbB, "parent", { carryOn: false });
        const ok = await open(page, "Saoirse's Saturday clinic called off");
        const t = await text(); await shot("04-adult-lands");
        check("(d) the adult's opens Family", ok && /Orla's family|Saoirse/.test(t) && (await page.locator('[data-tour="family-people"]').count()) >= 1, `${ok} · ${t.slice(0, 160)}`);
        await ctx.close();
      }
    }
    /* ---------- the member's own side ---------- */
    const diaryList = async (page) => {
      await tap(page, '[aria-label="Diary"]', 1500);
      const list = page.locator('[data-tour="cal-view"] button[aria-label="List"]');
      if (await list.count()) { await list.first().click(); await page.waitForTimeout(600); }
    };
    const mineRows = (page) => page.locator('[data-tour="agenda-mine"]').allInnerTexts().then((xs) => xs.map((x) => x.replace(/\s+/g, " ").trim()));
    const ownBlock = (page) => page.evaluate(() => {
      const el = [...document.querySelectorAll("span")].find((x) => /^(Your lesson|Requested — waiting on your coach)$/.test(x.textContent));
      return { text: el ? el.parentElement.innerText.replace(/\s+/g, " ") : null, cancel: document.querySelectorAll('[data-tour="day-cancel"]').length, reschedule: document.querySelectorAll('[data-tour="day-reschedule"]').length };
    });
    const toSettings = async (page) => {
      await tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 900);
      if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 1000);
    };
    const icsOf = async (page) => {
      const row = page.locator('[data-tour="settings-calendar"]');
      if (!(await row.count())) return { row: null, sums: [] };
      const said = (await row.innerText()).replace(/\s+/g, " ");
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 6000 }).catch(() => null), row.click()]);
      const txt = dl ? fs.readFileSync(await dl.path(), "utf8") : "";
      return { row: said, sums: txt.split(/\r?\n/).filter((l) => /^SUMMARY:/.test(l)) };
    };
    /* (e)–(f), (h): Cian, a member */
    {
      const db = memberDb();
      const { ctx, page, shot } = await boot(db, "adult", { carryOn: false });
      await diaryList(page); await shot("05-member-diary");
      const rows = await mineRows(page);
      check("(e) the member's Diary carries the clinic as their own row, under the group's name", rows.filter((r) => /^4:00 pm Saturday clinic/.test(r)).length >= 1, JSON.stringify(rows));
      const today = await page.locator(".nsc-day").first().innerText().then((x) => x.replace(/\s+/g, " "));
      check("(e) …and the coach's taken hour is not drawn beside it a second time", (today.match(/4:00 pm/g) || []).length === 1, today);
      await page.locator('[data-tour="agenda-mine"]', { hasText: "Saturday clinic" }).first().click(); await page.waitForTimeout(1200);
      const b = await ownBlock(page); await shot("06-member-block");
      check("(f) the clinic's block reads its own hour and length, the group and the coach", !!b.text && /4:00–5:00 pm/.test(b.text) && /Saturday clinic/.test(b.text) && /60 min with Niamh Byrne/.test(b.text), JSON.stringify(b));
      check("(f) …and offers no Cancel and no Reschedule — a member cannot call off everyone's clinic", b.cancel === 0 && b.reschedule === 0, JSON.stringify(b));
      await toSettings(page);
      const ics = await icsOf(page);
      check("(h) Settings › Calendar counts the member's two clinics and exports them under the group's name", !!ics.row && /2 lessons/.test(ics.row) && ics.sums.length === 2 && ics.sums.every((x) => x === "SUMMARY:Lesson · Saturday clinic · Niamh Byrne"), JSON.stringify(ics));
      await ctx.close();
    }
    /* (e), (g): Saoirse, a junior member */
    {
      const db = memberDb();
      const { ctx, page, shot } = await boot(db, "junior", { carryOn: false });
      await diaryList(page);
      const rows = await mineRows(page);
      check("(e) a junior member's Diary carries the clinic under the group's name", rows.some((r) => /^4:00 pm Saturday clinic/.test(r)), JSON.stringify(rows));
      await page.locator('[data-tour="cal-view"] button[aria-label="Calendar"]').click(); await page.waitForTimeout(700);
      await page.locator(`[data-day="${String(Number(dayPlus(db, 5).slice(8, 10)))}"]`).first().click(); await page.waitForTimeout(900);
      const b = await ownBlock(page); await shot("07-junior-block");
      check("(g) the junior's block names the group, never \"Booked by your parent\", with nothing to cancel", !!b.text && /Saturday clinic/.test(b.text) && !/Booked by your parent/.test(b.text) && b.cancel === 0 && b.reschedule === 0, JSON.stringify(b));
      await ctx.close();
    }
    /* (e)–(f), (h), (i): Orla, a junior member's parent */
    {
      const db = memberDb();
      const { ctx, page, shot } = await boot(db, "parent", { carryOn: false });
      await shot("08-parent-family");
      const up = (await page.locator('[data-tour="family-upcoming"]').count()) ? (await page.locator('[data-tour="family-upcoming"]').innerText()).replace(/\s+/g, " ") : "";
      const kid = (await page.locator('[data-tour="family-kid"]').count()) ? (await page.locator('[data-tour="family-kid"]').first().innerText()).replace(/\s+/g, " ") : "";
      check("(i) the family's Coming up holds the child's clinic and never a group she is not in", /4:00 pm/.test(up) && !/Tuesday squad/.test(up), up);
      check("(i) …and the child's row carries the clinic, not Nothing booked", /4:00 pm/.test(kid) && !/Nothing booked/.test(kid), kid);
      await diaryList(page);
      const rows = await mineRows(page);
      check("(e) the parent's Diary carries the child's clinic under the group's name", rows.some((r) => /^4:00 pm Saturday clinic/.test(r)), JSON.stringify(rows));
      await page.locator('[data-tour="agenda-mine"]', { hasText: "Saturday clinic" }).first().click(); await page.waitForTimeout(1200);
      const b = await ownBlock(page);
      check("(f) the parent's block is the clinic's, with no Cancel and no Reschedule", !!b.text && /4:00–5:00 pm/.test(b.text) && /Saturday clinic/.test(b.text) && b.cancel === 0 && b.reschedule === 0, JSON.stringify(b));
      await toSettings(page);
      const ics = await icsOf(page);
      check("(h) the parent's calendar names the child, the group and the coach", ics.sums.length === 2 && ics.sums.every((x) => x === "SUMMARY:Lesson · Saoirse · Saturday clinic · Niamh Byrne"), JSON.stringify(ics));
      await ctx.close();
    }
    /* (e), (j): Aoife, not in the clinic */
    {
      const db = memberDb();
      const { ctx, page, shot } = await boot(db, "aoife", { carryOn: false });
      await diaryList(page);
      const rows = await mineRows(page);
      check("(e) somebody not in the clinic never carries it; her own squad and her own lesson are hers", !rows.some((r) => /Saturday clinic/.test(r)) && rows.some((r) => /^5:00 pm/.test(r)) && rows.some((r) => /Tuesday squad/.test(r)), JSON.stringify(rows));
      await page.locator('[data-tour="agenda-mine"]', { hasText: "5:00 pm" }).first().click(); await page.waitForTimeout(1200);
      const b = await ownBlock(page);
      check("(j) her own lesson still offers Cancel and Reschedule", b.cancel === 1 && b.reschedule === 1, JSON.stringify(b));
      await page.locator('[data-tour="day-cancel"]').click(); await page.waitForTimeout(900);
      const why = page.locator("[data-sheet] button", { hasText: /^(Unwell|Away|Busy|Injured)$/ }).first();
      if (await why.count()) { await why.click(); await page.waitForTimeout(300); }
      const before = db.patches.length;
      await lastBtn(page, /^Cancel the lesson$/).click(); await page.waitForTimeout(1600); await shot("09-aoife-cancelled");
      const p = db.patches.slice(before).filter((x) => x.table === "bookings");
      check("(j) …and cancelling it writes her one lesson and tells the coach", p.length === 1 && p[0].n === 1 && db.bookings.find((x) => x.id === MB.aoife).status === "cancelled" && db.bookings.find((x) => x.id === MB.today).status === "confirmed" && told(db, "coach", /^Aoife Doyle cancelled$/).length === 1, JSON.stringify(p));
      await ctx.close();
    }
    /* (k): a group lesson logged, and a photo added to an old one */
    {
      const db = memberDb();
      const { ctx, page, shot } = await boot(db, "coach");
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
      /* the group's own face tile under Groups, not the filter tile of the same name */
      await page.locator('button[aria-label="Saturday clinic"]').last().click(); await page.waitForTimeout(600);
      await page.getByRole("button", { name: "Putting", exact: true }).click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Log it", exact: true }).click(); await page.waitForTimeout(3000);
      await shot("10-group-logged");
      const att = db.posts.filter((x) => x.table === "lesson_attendees").pop();
      const lid = att && att.rows[0] && att.rows[0].lesson_id;
      const la = told(db, "adult", "Lesson logged").filter((n) => n.data.id === lid), lj = told(db, "junior", "Lesson logged").filter((n) => n.data.id === lid);
      const lp = told(db, "parent", "Saoirse's lesson logged").filter((n) => n.data.id === lid);
      check("(k) a group lesson logged tells each person marked there, landing on the lesson", !!lid && la.length === 1 && la[0].body === "Putting · Niamh Byrne" && la[0].data.screen === "lesson" && lj.length === 1, JSON.stringify([att && att.rows, la, lj]));
      check("(k) …a junior's adult reads it as the child's, on Family; nobody else is told", lp.length === 1 && lp[0].data.screen === "family" && !db.notifications.some((n) => (n.user_id === IDS.aoife || n.user_id === IDS.coach) && n.data && n.data.id === lid), JSON.stringify(lp));
      /* the clinic lesson from two days ago: a photo added now is news */
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: true });
      await tap(page, '[data-tour="today-archive"]', 1200);
      await page.locator('[data-scroll="screen"] button', { hasText: "Bunker play" }).first().click(); await page.waitForTimeout(1400);
      await page.locator('button[aria-label="More"]').first().click(); await page.waitForTimeout(400);
      await page.locator("button", { hasText: /^Edit$/ }).first().click(); await page.waitForTimeout(900);
      await page.locator('[data-sheet] input[type="file"]').first().setInputFiles([{ name: "bunker.png", mimeType: "image/png", buffer: M.PNG }]);
      await page.waitForTimeout(2500); await shot("11-photo-added");
      const pa = told(db, "adult", "New photo on Bunker play"), pj = told(db, "junior", "New photo on Bunker play"), pp = told(db, "parent", "New photo on Bunker play for Saoirse");
      check("(k) a photo added to a group lesson later tells everybody marked there, and a junior's adult", pa.length === 1 && pa[0].data.id === GL && pj.length === 1 && pp.length === 1 && pp[0].data.screen === "family", JSON.stringify([pa, pj, pp]));
      await ctx.close();
    }
    /* (m): the clinic and the member's own lesson on one day, the clinic
       booked first — two blocks, and the lesson keeps its Cancel */
    {
      const db = memberDb();
      M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 5), time: "10:00 am", duration: 45 });
      const { ctx, page, shot } = await boot(db, "adult", { carryOn: false });
      await diaryList(page);
      await page.locator('[data-tour="agenda-mine"]', { hasText: "10:00 am" }).first().click(); await page.waitForTimeout(1200);
      const blocks = await page.locator('[data-tour="day-mine"]').allInnerTexts().then((xs) => xs.map((x) => x.replace(/\s+/g, " ")));
      const cancels = await page.locator('[data-tour="day-cancel"]').count();
      await shot("12-same-day");
      check("(m) a clinic and the member's own lesson on one day are two blocks, in time order, and the lesson keeps its Cancel",
            blocks.length === 2 && /10:00/.test(blocks[0]) && /Cancel/.test(blocks[0]) && /Saturday clinic/.test(blocks[1]) && !/Cancel/.test(blocks[1]) && cancels === 1, JSON.stringify({ blocks, cancels }));
      await ctx.close();
    }
    /* (l): a project whose SQL has not been re-run has no my_group_bookings() */
    {
      const db = memberDb(); db.noGroupFn = true;
      const { ctx, page } = await boot(db, "adult", { carryOn: false });
      await diaryList(page);
      const rows = await mineRows(page);
      const today = await page.locator(".nsc-day").first().innerText().then((x) => x.replace(/\s+/g, " "));
      check("(l) without the function the member's Diary is as it was: no clinic row, nothing broken", !rows.some((r) => /Saturday clinic/.test(r)) && /10:00 am/.test(today) && !/Saturday clinic/.test(today), JSON.stringify(rows) + " · " + today);
      await ctx.close();
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
