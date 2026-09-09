/* POLISH SHOTS. One screenshot of every screen named in the final
   pass, as the role that uses it, against the mocked database — so the
   pass is made on what is actually rendered rather than on memory.
   Usage: node polish-shots.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4212), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const today = new Date(); const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return ymd(d); };
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Hollow Lane GC" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  const l1 = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: ago(1), focus: "Short game", subs: ["Chipping", "Distance control"], notes: "Cleaner contact from the fringe. Two clips of the low runner.", unread: true });
  M.addMedia(db, { lessonId: l1.id, kind: "video", path: `${IDS.coach}/${l1.id}/clip-1.mp4` }); M.addMedia(db, { lessonId: l1.id, kind: "photo", path: `${IDS.coach}/${l1.id}/photo-1.jpg` });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: ago(8), focus: "Putting", notes: "Pace on the long ones first." });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: ago(3), focus: "Driving", notes: "Tempo over speed." });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Gate drill" });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.junior, title: "Ladder drill" });
  db.tips.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, title: "Trust the shallow", body: null, created_at: `${ago(2)}T10:00:00Z` });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"], [0, 1, 2, 3, 4, 5]) });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: ymd(today), time: "4:00 pm", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: ago(-2), time: "10:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: ago(-3), time: "9:00 am", status: "requested" });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.adult, body: "Grand, see you at four." });
  return db;
}

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) });
    const tap = async (sel, ms = 800) => { const el = page.locator(sel).first(); if (await el.count()) { await el.dispatchEvent("click"); await page.waitForTimeout(ms); return true; } return false; };
    const text = async (t, ms = 800) => { const el = page.getByText(t, { exact: false }).first(); if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(ms); return true; } return false; };
    return { ctx, page, shot, tap, text };
  };
  const notes = [];
  try {
    { const { ctx, page, shot, tap, text } = await boot("coach");
      await shot("c1-today");
      await tap('[aria-label="Diary"]'); await shot("c2-diary");
      await tap('[data-tour="cal-hours"]', 700); await shot("c3-hours"); await tap('[aria-label="Back"]');
      await tap('[aria-label="Roster"]'); await shot("c4-roster");
      await tap('[data-tour="roster-row"]'); await shot("c5-player-file");
      await text("Set tip", 700) || await tap('[data-tour="player-actions"] button:nth-child(2)', 700); await shot("c6-tip-sheet");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap('[aria-label="Your profile"]'); await shot("c7-you");
      await page.getByRole("button", { name: /^Drills/ }).first().click(); await page.waitForTimeout(800); await shot("c8-drill-library");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap('[aria-label="Add"]', 700); await shot("c9-plus");
      await page.locator("[data-sheet]").getByRole("button", { name: /log a lesson|log lesson/i }).first().click(); await page.waitForTimeout(800); await shot("c10-wizard-1");
      await text("Cian Murphy", 300); await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(600); await shot("c11-wizard-2");
      await text("Short game", 300); await page.getByRole("button", { name: "Continue" }).first().click().catch(() => {}); await page.waitForTimeout(600); await shot("c12-wizard-3");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap('[aria-label="Roster"]'); await tap('[data-tour="roster-row"]'); await tap('[data-tour="player-lessons"] button', 900); await shot("c13-lesson-view-coach");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap('[aria-label="Diary"]'); await tap('[data-tour="agenda-book"], [data-tour="cal-open"]', 700); await shot("c14-book-sheet");
      await ctx.close(); }
    { const { ctx, page, shot, tap } = await boot("adult");
      await shot("a1-home");
      await tap('[aria-label="Lessons"]'); await shot("a2-lessons");
      await tap('[data-tour="lesson-card"], [data-tour="lesson-row"], [data-tour="lesson-clip"]', 900); await shot("a3-lesson-view");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap('[aria-label="Diary"]'); await shot("a4-diary");
      await tap('[data-tour="agenda-book"]', 700); await shot("a5-request-sheet");
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap('[aria-label="Drills"]'); await shot("a6-drills");
      await ctx.close(); }
    { const { ctx, page, shot, tap } = await boot("parent");
      await shot("p1-family"); await tap('[aria-label="Lessons"]'); await shot("p2-lessons"); await tap('[aria-label="Diary"]'); await shot("p3-diary");
      await ctx.close(); }
    { const { ctx, page, shot, tap } = await boot("junior");
      await shot("j1-home"); await tap('[aria-label="Family"]'); await shot("j2-family");
      await ctx.close(); }
  } finally { await browser.close(); M.stopServer(server); }
  console.log("polish shots written to", outDir, notes.join(" "));
})();
