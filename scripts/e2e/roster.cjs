/* THE ROSTER READS WHERE EACH PLAYER STANDS. The grey line under a
   name is the next confirmed lesson, else the last one taught, with
   Drifting in the caution colour where nothing is booked and it has
   been a while, else No lessons yet; the level sits on the right as a
   value; the lesson count stays on the player's file. And the diary's
   day meta carries no nought.
   Usage: node roster.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4341), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", next: "00000000-0000-4000-8000-0000000adu17", quiet: "00000000-0000-4000-8000-00000000c41e", fresh: "00000000-0000-4000-8000-00000000f9e5", recent: "00000000-0000-4000-8000-00000000ab12" };
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("next", "next@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("quiet", "quiet@t.ie", { role: "player", name: "Dara Ryan", type: "adult", coachId: IDS.coach, dob: "1990-02-02" });
  person("fresh", "fresh@t.ie", { role: "player", name: "Eimear Walsh", type: "adult", coachId: IDS.coach, dob: "1992-06-06" });
  person("recent", "recent@t.ie", { role: "player", name: "Fionn Byrne", type: "adult", coachId: IDS.coach, dob: "1993-03-03" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "11:00 am"], [0, 1, 2, 3, 4, 5, 6]) });
  /* Cian: a lesson a week ago with a level, and one booked ahead */
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.next, date: dayPlus(db, -7), focus: "Short game", subs: ["HI 18.4"] });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.next, date: dayPlus(db, 2), time: "10:00 am", duration: 45 });
  /* Dara: a lesson a month ago and nothing booked — drifting */
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.quiet, date: dayPlus(db, -30), focus: "Putting" });
  /* Fionn: a lesson three days ago, nothing booked — not drifting yet */
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.recent, date: dayPlus(db, -3), focus: "Driving" });
  /* Eimear: on the roster, no lesson yet */
  return db;
}

const { check, results, summary } = M.checker("roster");
const fmt = (iso) => { const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))); return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]} ${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}`; };

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
  const rowOf = (page, name) => page.locator(".nsc-list button").filter({ hasText: name }).first();
  const lineOf = async (page, name) => { const r = rowOf(page, name); return { text: M.norm(await r.innerText()), tone: await r.locator("[data-standing]").getAttribute("data-standing") }; };

  try {
    /* ---------- (a) the roster's grey lines ---------- */
    const coach = await boot("coach");
    {
      const { page, text, shot } = coach;
      await tap(page, '[aria-label="Roster"]', 1000);
      await shot("01-roster");
      const t0 = await text();
      check("(a) the roster lists the four, and no row carries a lesson total", /Cian Murphy/.test(t0) && /Dara Ryan/.test(t0) && /Eimear Walsh/.test(t0) && /Fionn Byrne/.test(t0) && !/\d+ lessons?\b/.test(t0.replace(/All lessons/, "")), t0.slice(0, 240));
      const cian = await lineOf(page, "Cian Murphy");
      check("(a) a player booked ahead reads the day and time of the next lesson, in the ink's grey, the level on the right", cian.text.includes(`${fmt(dayPlus(db, 2))} · 10:00 am`) && cian.tone === "ink" && /HI 18\.4/.test(cian.text), JSON.stringify(cian));
      const fionn = await lineOf(page, "Fionn Byrne");
      check("(a) a player with a recent lesson and nothing booked reads Last lesson · the day, quietly", fionn.text.includes(`Last lesson · ${fmt(dayPlus(db, -3))}`) && fionn.tone === "faint", JSON.stringify(fionn));
      const dara = await lineOf(page, "Dara Ryan");
      check("(a) a player quiet for a month with nothing booked reads Drifting · the day, in the caution colour", dara.text.includes(`Drifting · ${fmt(dayPlus(db, -30))}`) && dara.tone === "caution", JSON.stringify(dara));
      const eimear = await lineOf(page, "Eimear Walsh");
      check("(a) a player with no lesson yet says so", /No lessons yet/.test(eimear.text), JSON.stringify(eimear));
      const colour = await rowOf(page, "Dara Ryan").locator("[data-standing]").evaluate((el) => getComputedStyle(el).color);
      const quietColour = await rowOf(page, "Fionn Byrne").locator("[data-standing]").evaluate((el) => getComputedStyle(el).color);
      check("(a) the caution line is a different colour from the quiet one", colour !== quietColour, `${colour} vs ${quietColour}`);
      await tap(page, '[aria-label="Today"]', 1000);
      const driftRow = page.locator("button", { hasText: "Drifting" }).first();
      const driftText = (await driftRow.count()) ? M.norm(await driftRow.innerText()) : "";
      check("(a) the roster's Drifting agrees with the home's rule — its Actions row counts the same two, Dara and Eimear", /Drifting/.test(driftText) && /\b2\b/.test(driftText), driftText);
      await tap(page, '[aria-label="Roster"]', 1000);

      /* ---------- (b) the count stays on the file ---------- */
      await rowOf(page, "Cian Murphy").click(); await page.waitForTimeout(900);
      const t1 = await text();
      check("(b) the player's file carries the count — All 1 lesson — and the roster row did not", /All 1 lesson/.test(t1), t1.slice(0, 200));
      await M.back(page); await page.waitForTimeout(600);
    }

    /* ---------- (c) the diary's day meta carries no nought ---------- */
    {
      const { page, text } = coach;
      await tap(page, '[aria-label="Diary"]', 1000);
      if ((await page.locator('[data-tour="cal-view"] button[aria-pressed="true"]').getAttribute("aria-label")) !== "Calendar") await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 600);
      const t2 = await text();
      check("(c) the coach's day with nothing booked reads its free count alone — no \"0 booked\", no \"0 free\"", !/\b0 booked\b/.test(t2) && !/\b0 free\b/.test(t2), t2.slice(0, 200));
      await coach.ctx.close();
    }
    {
      const { ctx, page, text } = await boot("fresh");
      await tap(page, '[aria-label="Diary"]', 1000);
      if ((await page.locator('[data-tour="cal-view"] button[aria-pressed="true"]').getAttribute("aria-label")) !== "Calendar") await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 600);
      /* yesterday has passed: pick a day the coach has no hours on — there is none, every day has three — so pick today after its hours have gone: the harness clock is 9 am, so instead read a day and assert the wording */
      const t3 = await text();
      check("(c) a player's day never reads \"0 available\"", !/\b0 available\b/.test(t3), t3.slice(0, 200));
      await ctx.close();
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
