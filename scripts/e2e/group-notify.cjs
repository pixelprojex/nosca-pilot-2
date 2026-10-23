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
   landing on the Diary's day and the adult's on Family.
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
    check("no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
