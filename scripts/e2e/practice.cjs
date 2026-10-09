/* A PRACTICE THE PLAYER LOGS FOR THEMSELVES. Log a practice sits under the
   Drills tab's list; the sheet is the sport's areas as tiles, a note and
   Save; the row is the player's own (kind practice, sent_by them, to their
   coach), reads Practice in their list, is told to the coach once as
   "Cian practised", never joins To review, and Progress counts it apart
   from the lessons on both sides. A junior logs their own; a parent is
   not offered it; nor is a player with no coach; nor a project whose SQL
   has no sent_by.
   Usage: node practice.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", loner: "00000000-0000-4000-8000-00000010ne00" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("loner", "loner@t.ie", { role: "player", name: "Rory Nolan", type: "adult", dob: "1988-01-01" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-20", focus: "Short game", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Gate drill" });
  return db;
}

const { check, results, summary } = M.checker("practice");
const until = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 300)); } return !!(await fn()); };

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
  const logOne = async (page, areas, note) => {
    await tap(page, '[data-tour="drills-log-practice"]', 900);
    const sheet = (await page.locator('[data-tour="practice-log"]').count()) === 1;
    const save = page.locator('[data-tour="practice-save"]');
    const asleep = (await save.count()) === 1 && (await save.isDisabled());
    for (const a of areas) await page.locator('[data-tour="practice-focus"] button', { hasText: a }).first().click();
    if (note) await page.locator("textarea").last().fill(note);
    const awake = !(await save.isDisabled());
    await save.click(); await page.waitForTimeout(1400);
    return { sheet, asleep, awake };
  };

  try {
    /* ---------- the player ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Drills"]', 900);
      check("(a) the Drills tab carries Log a practice under the drills", (await page.locator('[data-tour="drills-log-practice"]').count()) === 1 && /Log a practice/.test(await text()), (await text()).slice(-200));
      await shot("01-drills");
      const r = await logOne(page, ["Chipping", "Putting"], "Twenty minutes on the gate");
      check("(b) the sheet is Practice · Today, the sport's areas as tiles and a note, Save asleep until there is something to save", r.sheet && r.asleep && r.awake, JSON.stringify(r));
      const row = db.lessons.find((l) => l.kind === "practice");
      check("(c) Save writes the player's own row: kind practice, sent by them, for them, to their coach, the areas joined the log's way, the note", !!row && row.sent_by === IDS.adult && row.player_id === IDS.adult && row.coach_id === IDS.coach && row.focus === "Chipping · Putting" && row.notes === "Twenty minutes on the gate", JSON.stringify(row));
      const t1 = await text();
      check("(c2) the toast says Logged with the areas, and the sheet is gone", /Logged/.test(t1) && /Chipping · Putting/.test(t1) && (await page.locator('[data-tour="practice-log"]').count()) === 0, t1.slice(-200));
      await shot("02-logged");
      const told = db.notifications.filter((n) => n.data && n.data.id === (row && row.id));
      check("(d) the coach is told once — Cian practised · Chipping · Putting, landing on the lesson — nobody else, and not that a clip was sent", told.length === 1 && told[0].user_id === IDS.coach && told[0].kind === "practice" && told[0].title === "Cian practised" && told[0].body === "Chipping · Putting" && told[0].data.screen === "lesson", JSON.stringify(told.map((n) => [n.kind, n.title])));
      /* the row in the player's own list */
      await tap(page, '[aria-label="Home"]', 900);
      const listBtn = page.getByRole("button", { name: "List", exact: true });
      if (await listBtn.count()) { await listBtn.first().click(); await page.waitForTimeout(800); }
      const t2 = await text();
      check("(e) the practice sits in the player's own list, dated today, with the lesson beside it", /Chipping · Putting/.test(t2) && /Short game/.test(t2), t2.slice(0, 300));
      /* Progress counts it apart */
      await tap(page, '[aria-label="Your profile"]', 900); await tap(page, '[data-tour="sheet-progress"]', 1000);
      const t3 = await text();
      check("(f) Progress keeps the lesson count to the lessons — 1 lesson — and carries Practice · 1 session with the areas", /1 lesson\b/.test(t3) && (await page.locator('[data-progress="practice"]').count()) === 1 && /1 session/.test(t3) && /Chipping · Putting/.test(t3), t3.slice(0, 300));
      await shot("03-progress");
      await ctx.close();
    }

    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      check("(g) To review does not count a practice — it is not a clip to mark up", (await page.locator('[data-tour="today-review"]').count()) === 0, (await text()).slice(0, 200));
      await tap(page, '[aria-label="Alerts"]', 900);
      const line = page.locator("button").filter({ hasText: "Cian practised" }).first();
      check("(h) the bell carries Cian practised with the areas", (await line.count()) === 1 && /Chipping · Putting/.test(await line.innerText()), (await line.count()) ? await line.innerText() : (await text()).slice(0, 200));
      await line.click(); await page.waitForTimeout(1200);
      const t4 = await text();
      check("(h2) …landing on the coach's page for it, reading Sent by Cian Murphy with the note", /Chipping · Putting/.test(t4) && /Sent by Cian Murphy/.test(t4) && /Twenty minutes on the gate/.test(t4), t4.slice(0, 220));
      await shot("04-coach-practice");
      await tap(page, '[aria-label="Back"]', 900);
      await tap(page, '[aria-label="Roster"]', 900);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1000);
      await tap(page, '[data-tour="player-progress"]', 1000);
      const t5 = await text();
      check("(i) the coach's Progress for Cian reads the same: 1 lesson, Practice · 1 session", /1 lesson\b/.test(t5) && (await page.locator('[data-progress="practice"]').count()) === 1 && /1 session/.test(t5), t5.slice(0, 260));
      await ctx.close();
    }

    /* ---------- a junior logs their own; a parent and a player with no coach are not offered it ---------- */
    {
      const j = await boot("junior");
      await tap(j.page, '[aria-label="Drills"]', 900);
      check("(j) a junior has Log a practice too — the journal is their own", (await j.page.locator('[data-tour="drills-log-practice"]').count()) === 1, (await j.text()).slice(-200));
      const rj = await logOne(j.page, ["Putting"], null);
      const rowJ = db.lessons.find((l) => l.kind === "practice" && l.player_id === IDS.junior);
      check("(j2) …and their row is theirs: sent by the child, to the child's coach, with no note needed", rj.sheet && !!rowJ && rowJ.sent_by === IDS.junior && rowJ.coach_id === IDS.coach && rowJ.focus === "Putting", JSON.stringify(rowJ));
      await j.ctx.close();
      const p = await boot("parent");
      await tap(p.page, '[aria-label="Drills"]', 900).catch(() => {});
      check("(k) a parent with no coach of their own is not offered it", (await p.page.locator('[data-tour="drills-log-practice"]').count()) === 0, (await p.text()).slice(0, 160));
      await p.ctx.close();
      const l = await boot("loner");
      await tap(l.page, '[aria-label="Drills"]', 900).catch(() => {});
      check("(l) a player with no coach is not offered it", (await l.page.locator('[data-tour="drills-log-practice"]').count()) === 0, (await l.text()).slice(0, 160));
      await l.ctx.close();
    }

    /* ---------- a project whose SQL has not been re-run ---------- */
    {
      db.missingColumns = { lessons: ["sent_by"] };
      const { ctx, page, text } = await boot("adult");
      await tap(page, '[aria-label="Drills"]', 900);
      check("(m) without lessons.sent_by nothing is offered", (await page.locator('[data-tour="drills-log-practice"]').count()) === 0, (await text()).slice(-160));
      await ctx.close();
      db.missingColumns = null;
    }

    check("(n) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
