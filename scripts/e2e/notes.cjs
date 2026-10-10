/* A COACH'S OWN NOTE ON A PLAYER. Notes is a row at the foot of the player
   file; the sheet is one field and Save; the note rides on the coach's
   preferences row keyed by the player's id, the row carries its first line,
   the player's side never shows it, and a project without the column keeps
   it on the phone and still says Saved.
   Usage: node notes.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", second: "00000000-0000-4000-8000-00000000sec0" };
const NOTE = "Left-handed. Hates bunker drills, loves a wager on the putting green.";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("second", "second@t.ie", { role: "player", name: "Aoife Nolan", type: "adult", coachId: IDS.coach, dob: "1990-02-02" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-20", focus: "Short game", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  return db;
}

const { check, results, summary } = M.checker("notes");
const until = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 250)); } return !!(await fn()); };

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
  const openFile = async (page, who) => { await tap(page, '[aria-label="Roster"]', 900); await page.locator("button", { hasText: who }).first().click(); await page.waitForTimeout(1000); };

  try {
    /* ---------- the coach writes one ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await openFile(page, "Cian Murphy");
      const row = page.locator('[data-tour="player-notes"]');
      check("(a) the player file carries a Notes row at its foot, empty, beside Progress", (await row.count()) === 1 && /^Notes$/.test(M.norm(await row.innerText())) && (await page.locator('[data-tour="player-progress"]').count()) === 1, (await row.count()) ? await row.innerText() : (await text()).slice(-200));
      await row.click(); await page.waitForTimeout(900);
      const sheet = page.locator('[data-tour="player-note"]');
      const save = page.locator('[data-tour="player-note-save"]');
      check("(b) the sheet is Notes · Cian Murphy · Private, one field, Save asleep until something changes", (await sheet.count()) === 1 && /Cian Murphy · Private/.test(await text()) && (await save.isDisabled()), (await text()).slice(-200));
      await shot("01-note-sheet");
      await page.locator("textarea").last().fill(NOTE);
      check("(b2) …and awake once there is", !(await save.isDisabled()), "");
      await save.click(); await page.waitForTimeout(1200);
      const prefs = db.prefs[IDS.coach];
      check("(c) Save writes the note onto the coach's own preferences row, keyed by the player's id", !!prefs && prefs.player_notes && prefs.player_notes[IDS.adult] === NOTE, JSON.stringify(prefs && prefs.player_notes));
      const t1 = await text();
      check("(c2) the toast says Saved for Cian and the sheet is gone", /Saved/.test(t1) && /Cian Murphy/.test(t1) && (await sheet.count()) === 0, t1.slice(-200));
      check("(d) the row carries the note's first line", /Left-handed\. Hates bunker drills/.test(await row.innerText()), await row.innerText());
      await shot("02-file-with-note");
      await row.click(); await page.waitForTimeout(800);
      check("(d2) opening it again reads the whole note back", (await page.locator("textarea").last().inputValue()) === NOTE, await page.locator("textarea").last().inputValue());
      await page.locator("textarea").last().fill(""); await save.click(); await page.waitForTimeout(1000);
      check("(e) clearing the field and saving takes the note off the row and off the preferences", /^Notes$/.test(M.norm(await row.innerText())) && !(IDS.adult in ((db.prefs[IDS.coach] || {}).player_notes || {})), JSON.stringify((db.prefs[IDS.coach] || {}).player_notes));
      /* a note on one player is on that player only */
      await row.click(); await page.waitForTimeout(600); await page.locator("textarea").last().fill("Nerves on the first tee."); await save.click(); await page.waitForTimeout(1000);
      await tap(page, '[aria-label="Back"]', 800);
      await page.locator("button", { hasText: "Aoife Nolan" }).first().click(); await page.waitForTimeout(1000);
      check("(f) another player's file carries no note of Cian's", /^Notes$/.test(M.norm(await page.locator('[data-tour="player-notes"]').innerText())) && !/first tee/.test(await text()), (await text()).slice(-200));
      await ctx.close();
    }

    /* ---------- the player never sees it ---------- */
    {
      const { ctx, page, text } = await boot("adult");
      const seen = [];
      for (const sel of ['[aria-label="Home"]', '[aria-label="Drills"]', '[aria-label="Diary"]', '[aria-label="Chat"]']) { await tap(page, sel, 700).catch(() => {}); seen.push(await text()); }
      await tap(page, '[aria-label="Your profile"]', 800).catch(() => {}); seen.push(await text());
      check("(g) nothing of the coach's note reaches the player's screens — the coach's preferences row is not theirs to read", !seen.some((s) => /first tee|Nerves/.test(s)), seen.map((s) => s.slice(0, 80)).join(" | "));
      await ctx.close();
    }

    /* ---------- a project whose SQL has not been re-run ---------- */
    {
      db.missingColumns = { preferences: ["player_notes"] };
      const { ctx, page, text } = await boot("coach");
      await openFile(page, "Aoife Nolan");
      await tap(page, '[data-tour="player-notes"]', 800);
      await page.locator("textarea").last().fill("Shortens the backswing under pressure.");
      await page.locator('[data-tour="player-note-save"]').click(); await page.waitForTimeout(1200);
      const t2 = await text();
      check("(h) without the column the note is kept on the phone: the row carries it, the toast says Saved, nothing errors", /Saved/.test(t2) && /Shortens the backswing/.test(await page.locator('[data-tour="player-notes"]').innerText()), t2.slice(-200));
      check("(h2) …and the refused write was the column's, not a policy's", db.posts.some((p) => p.table === "preferences" && p.refused) || db.patches.some((p) => p.table === "preferences" && p.refused), "");
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
