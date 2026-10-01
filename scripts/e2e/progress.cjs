/* PROGRESS — a player's journey, read off the lessons, the same screen
   for the coach (the player file), the player (the profile pill) and a
   parent (the child's screen): the level over time as a line where the
   stage is a number and as the ladder where it is a name, what was
   worked on as counts, lessons a month, drills done; nothing where
   there are no lessons.
   Usage: node progress.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4380), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = {
  coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", rory: "00000000-0000-4000-8000-0000000adu19",
  parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d",
  tcoach: "00000000-0000-4000-8000-00000000c0ad", aoife: "00000000-0000-4000-8000-0000000adu18",
};
const FAM = "00000000-0000-4000-8000-00000000fa01";
/* Cian's eight lessons: the handicap coming down, four areas */
const CIAN = [
  ["2026-05-10", "HI 20.1", "Short game"], ["2026-06-02", "HI 19.6", "Putting"], ["2026-06-20", "HI 19.0", "Short game · Driving"], ["2026-07-11", "HI 18.4", "Short game"],
  ["2026-08-01", "HI 17.8", "Full swing"], ["2026-08-22", "HI 17.1", "Putting"], ["2026-09-12", "HI 16.9", "Short game"], ["2026-09-26", "HI 16.4", "Driving"],
];
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, p) => { M.addUser(db, { id: IDS[key], email }); M.addProfile(db, { id: IDS[key], ...p }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("rory", "rory@t.ie", { role: "player", name: "Rory Dunne", type: "adult", coachId: IDS.coach, dob: "1988-02-02" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("tcoach", "tcoach@t.ie", { role: "coach", name: "Tadhg Nolan", sport: "tennis", inviteCode: "TN7X2M" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Brennan", sport: "tennis", type: "adult", coachId: IDS.tcoach, dob: "1995-05-05" });
  CIAN.forEach(([date, hi, focus]) => M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date, focus, subs: [hi], notes: `${focus} notes.`, unread: false }));
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Gate drill", done: true });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Ladder drill", done: true });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Towel drill", done: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-09-05", focus: "Chipping", subs: ["Passport · Learn"], unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-09-19", focus: "Putting", subs: ["Passport · Learn"], unread: false });
  M.addLesson(db, { coachId: IDS.tcoach, playerId: IDS.aoife, date: "2026-07-05", focus: "Serve", subs: ["Red ball · U8"], unread: false });
  M.addLesson(db, { coachId: IDS.tcoach, playerId: IDS.aoife, date: "2026-08-09", focus: "Return", subs: ["Orange ball · U9"], unread: false });
  M.addLesson(db, { coachId: IDS.tcoach, playerId: IDS.aoife, date: "2026-09-13", focus: "Serve", subs: ["Orange ball · U9"], unread: false });
  return db;
}
/* the months of the last six that carry one of Cian's lessons, by today's date */
function monthsWithLessons() {
  const now = new Date(); const set = new Set();
  for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); if (CIAN.some(([iso]) => Number(iso.slice(0, 4)) === d.getFullYear() && Number(iso.slice(5, 7)) - 1 === d.getMonth())) set.add(`${d.getFullYear()}-${d.getMonth()}`); }
  return set.size;
}

const { check, results, summary } = M.checker("progress");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
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

  try {
    /* ---------- the coach, from the player file ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      check("(a) the player file carries a Progress row", (await page.locator('[data-tour="player-progress"]').count()) === 1);
      await tap(page, '[data-tour="player-progress"]', 1000);
      const t1 = await text();
      check("(b) Progress is titled with the player, counts the lessons and reads the level now and the level then", /Cian Murphy/.test(t1) && /8 lessons/.test(t1) && /HI 16\.4/.test(t1) && /from HI 20\.1/.test(t1), t1.slice(0, 200));
      check("(c) the level is a line with a point per reading", (await page.locator('[data-progress="level"] svg circle').count()) === 8, String(await page.locator('[data-progress="level"] svg circle').count()));
      const areas = await page.locator('[data-progress="areas"] > div > div').allInnerTexts();
      check("(d) Worked on counts the areas the log joined, most first", areas.length === 4 && /^Short game\s*4/.test(M.norm(areas[0])), JSON.stringify(areas.map(M.norm)));
      const rects = await page.locator('[data-progress="months"] svg rect').count();
      check("(e) Lessons a month draws a bar for each of the last six months with a lesson", rects === monthsWithLessons(), `${rects} vs ${monthsWithLessons()}`);
      check("(f) Drills reads done of set", /2 of 3 done/.test(t1), "");
      await shot("01-coach-progress");
      await tap(page, '[aria-label="Back"]', 900);
      check("(g) Back lands on the player file", /Cian Murphy/.test(await text()) && (await page.locator('[data-tour="player-progress"]').count()) === 1);
      await ctx.close();
    }
    /* ---------- the player, from the profile pill ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Your profile"]', 900);
      check("(h) the profile pill carries Progress", (await page.locator('[data-tour="sheet-progress"]').count()) === 1);
      await tap(page, '[data-tour="sheet-progress"]', 1000);
      const t2 = await text();
      check("(i) the player reads the same journey the coach does", /Progress/.test(t2) && /8 lessons/.test(t2) && /HI 16\.4/.test(t2) && /2 of 3 done/.test(t2) && (await page.locator('[data-progress="level"] svg circle').count()) === 8, t2.slice(0, 200));
      await shot("02-player-progress");
      await ctx.close();
    }
    /* ---------- a player with nothing yet ---------- */
    {
      const { ctx, page, text } = await boot("rory");
      await tap(page, '[aria-label="Your profile"]', 900); await tap(page, '[data-tour="sheet-progress"]', 1000);
      const t3 = await text();
      check("(j) with no lessons the screen says so and draws nothing", /No lessons yet/.test(t3) && (await page.locator('[data-progress]').count()) === 0, t3.slice(0, 120));
      await ctx.close();
    }
    /* ---------- a parent, the child's journey ---------- */
    {
      const { ctx, page, text, shot } = await boot("parent");
      await tap(page, '[aria-label="Family"]', 900);
      await page.locator("button", { hasText: "Saoirse" }).first().click(); await page.waitForTimeout(900);
      check("(k) the child's screen carries Progress", (await page.locator('[data-tour="kid-progress"]').count()) === 1, (await text()).slice(0, 160));
      await tap(page, '[data-tour="kid-progress"]', 1000);
      const t4 = await text();
      check("(l) the parent reads the child's journey under the child's name", /Saoirse Kelly/.test(t4) && /2 lessons/.test(t4) && /Chipping/.test(t4) && /Putting/.test(t4) && /Passport · Learn/.test(t4), t4.slice(0, 200));
      await shot("03-parent-child-progress");
      await ctx.close();
    }
    /* ---------- tennis: the ladder, not a line ---------- */
    {
      const { ctx, page, text, shot } = await boot("aoife");
      await tap(page, '[aria-label="Your profile"]', 900); await tap(page, '[data-tour="sheet-progress"]', 1000);
      const t5 = await text();
      const ticks = await page.locator('[data-progress="ladder"] svg').count();
      check("(m) a named stage is the ladder: the steps reached ticked, the current one with its date, no line", (await page.locator('[data-progress="level"]').count()) === 0 && (await page.locator('[data-progress="ladder"]').count()) === 1 && ticks === 2 && /Orange ball · U9\s*since Sun 9 Aug/.test(t5) && /Green ball/.test(t5), `${ticks} ticks · ${t5.slice(0, 200)}`);
      await shot("04-tennis-ladder");
      await ctx.close();
    }
    check("(n) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
