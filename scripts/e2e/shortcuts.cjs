/* SHORTCUTS. The board on Today and the plus menu are one list of nine
   actions, and a coach decides what is on each, in what order, and how
   big the board sits. This proves the choices take effect, that they are
   written to the coach's preferences, that a coach cannot leave
   themselves an empty board, and that the default can be had back.
   Usage: node shortcuts.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4312), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  return db;
}
const { check, results, summary } = M.checker("shortcuts");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async () => {
    const u = Object.values(db.users).find((x) => x.id === IDS.coach);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false });
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap, byText } = M;
  /* the labels on the board, in the order they are drawn */
  const boardLabels = (page) => page.locator('[data-tour="today-board"] button').evaluateAll((els) => els.map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()));
  const boardCols = (page) => page.locator('[data-tour="today-board"] > div').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  const savedLayout = () => (db.prefs[IDS.coach] || {}).layout || null;

  try {
    const { ctx, page, text, shot } = await boot();
    await shot("01-board-default");
    const d0 = await boardLabels(page);
    check("(a) the board starts on the six defaults, three across",
      d0.join("|") === "Log|Register|Capture|Tip|Drills|Add player" && (await boardCols(page)) === 3, `${d0.join("|")} · cols=${await boardCols(page)}`);

    /* --- into the editor from the home screen --- */
    await page.locator('[data-tour="today-board"] ~ * button, button', { hasText: /^Edit$/ }).first().click(); await page.waitForTimeout(1000);
    const t1 = await text(); await shot("02-editor");
    /* the board is the editor now — the real grid, arranged by moving
       it, with a size control and the ones not showing underneath */
    check("(b) Edit shortcuts opens the board itself, arrangeable, with a size and what is not showing",
      t1.includes("Shortcuts") && /HOLD A TILE AND MOVE IT/i.test(t1) && /SIZE/i.test(t1) && /NOT SHOWING/i.test(t1)
      && (await page.locator('[data-arrange="grid"]').count()) === 1, t1.slice(0, 240));
    check("(b) what is not on the board is offered", /New group/.test(t1) && /Competition/.test(t1), t1.slice(0, 220));
    check("(b) every tile on the board is a handle, and carries its own way off",
      (await page.locator('[data-arrange-id]').count()) === 6
      && (await page.locator('button[aria-label="Remove Drills"]').count()) === 1, String(await page.locator('[data-arrange-id]').count()));

    /* --- take one off --- */
    await page.locator('button[aria-label="Remove Drills"]').first().click(); await page.waitForTimeout(700);
    check("(c) removing writes it to the coach's preferences", !!savedLayout() && Array.isArray(savedLayout().board) && !savedLayout().board.includes("drills"), JSON.stringify(savedLayout()));

    /* --- add one that was not there --- */
    await page.locator('button[aria-label="Add New group"]').first().click(); await page.waitForTimeout(700);
    check("(c) adding puts it at the end", savedLayout().board[savedLayout().board.length - 1] === "group", JSON.stringify(savedLayout().board));

    /* --- MOVE IT BY DRAGGING IT. A real pointer drag: press on the
       tile, cross the 9px threshold, travel a whole cell back, let go. --- */
    const before = savedLayout().board.slice();
    const last = before[before.length - 1];
    const from = await page.locator(`[data-arrange-id="${last}"] button`).first().boundingBox();
    const target = await page.locator(`[data-arrange-id="${before[before.length - 2]}"] button`).first().boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 14, from.y + from.height / 2, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.waitForTimeout(160);
    await page.mouse.up();
    await page.waitForTimeout(800);
    const b2 = savedLayout().board;
    check("(c) dragging a tile onto another moves it there",
      b2.length === before.length && b2[b2.length - 2] === last && b2.join("|") !== before.join("|"),
      `${before.join("|")}  ->  ${b2.join("|")}`);
    await shot("03-dragged");

    /* --- and a keyboard reaches the same place --- */
    const kbBefore = savedLayout().board.slice();
    await page.locator(`[data-arrange-id="${kbBefore[0]}"] button`).first().focus();
    await page.keyboard.press("ArrowRight"); await page.waitForTimeout(700);
    const kb = savedLayout().board;
    check("(c) an arrow key moves a tile too, for anyone who cannot drag",
      kb[1] === kbBefore[0] && kb[0] === kbBefore[1], `${kbBefore.join("|")}  ->  ${kb.join("|")}`);
    await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(700);

    /* --- two across --- */
    await byText(page, "Two across").first().click(); await page.waitForTimeout(700);
    check("(c) the size is stored", savedLayout().boardCols === 2, JSON.stringify(savedLayout()));
    await shot("03-editor-changed");

    /* --- and the board itself has changed --- */
    await M.back(page); await page.waitForTimeout(1200);
    const d1 = await boardLabels(page); await shot("04-board-changed");
    check("(d) the board drops what was removed and keeps what was added",
      !d1.includes("Drills") && d1.includes("New group"), d1.join("|"));
    check("(d) …in the order the editor left it in",
      d1.map((x) => x.toLowerCase().replace(/[^a-z]/g, "")).join("|")
        === savedLayout().board.map((id) => ({ log: "log", attend: "register", capture: "capture", tip: "tip",
             drills: "drills", player: "addplayer", group: "newgroup", message: "message", comp: "competition" })[id]).join("|"),
      `${d1.join("|")} · ${savedLayout().board.join("|")}`);
    check("(d) and is two across", (await boardCols(page)) === 2, `cols=${await boardCols(page)}`);
    check("(d) the added action still does its job", (await page.locator('button[aria-label="New group"]').count()) === 1, d1.join("|"));

    /* --- the plus menu is its own list --- */
    await tap(page, '[data-tour="quick"]', 900);
    const t2 = await text(); await shot("05-plus");
    check("(e) the plus menu is untouched by the board's edits", /Drills/.test(t2) && /Log a lesson/.test(t2), t2.slice(-260));
    await page.locator('[data-sheet] button', { hasText: /^Edit$/ }).first().click(); await page.waitForTimeout(1200);
    await byText(page, "Plus").first().click(); await page.waitForTimeout(700);
    await page.locator('button[aria-label="Remove Competition"]').first().click(); await page.waitForTimeout(700);
    check("(e) editing the plus writes a separate list", Array.isArray(savedLayout().quick) && !savedLayout().quick.includes("comp") && savedLayout().board.includes("log"), JSON.stringify(savedLayout()));

    /* --- a coach cannot leave themselves nothing --- */
    await byText(page, "Home").first().click(); await page.waitForTimeout(700);
    for (const id of ["Log", "Register", "Capture", "Tip", "Add player", "New group"]) {
      const b = page.locator(`button[aria-label="Remove ${id}"]`).first();
      if (await b.count() && await b.isEnabled()) { await b.click(); await page.waitForTimeout(350); }
    }
    const left = savedLayout().board;
    check("(f) the last one on the board cannot be taken off", left.length === 1, JSON.stringify(left));
    /* and it says so before you try: the last tile's minus is dead, not
       a button that refuses after the fact */
    const lastMinus = page.locator("button[aria-label^='Remove ']").first();
    check("(f) …and its minus is disabled rather than refusing after the tap",
      (await lastMinus.count()) === 1 && !(await lastMinus.isEnabled()), String(await lastMinus.count()));
    await shot("06-one-left");

    /* --- and the default can be had back --- */
    await byText(page, "Back to the default").first().click(); await page.waitForTimeout(900);
    check("(g) Back to the default restores the six and the size",
      savedLayout().board.join("|") === "log|attend|capture|tip|drills|player" && savedLayout().boardCols === 3, JSON.stringify(savedLayout()));
    await M.back(page); await page.waitForTimeout(1200);
    const d2 = await boardLabels(page); await shot("07-board-restored");
    check("(g) …and the board is itself again", d2.join("|") === "Log|Register|Capture|Tip|Drills|Add player", d2.join("|"));

    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
    await ctx.close();
  } catch (e) {
    check("RUN ERROR", false, String(e && e.stack ? e.stack : e).slice(0, 400));
  } finally { await browser.close(); M.stopServer(server); }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  summary();
})();
