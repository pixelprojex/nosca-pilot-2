/* SHORTCUTS. The plus menu is the one list of the coach's actions, and
   a coach decides what is on it and in what order. The home carried a
   board of six of them as well until 18 November, every one already on
   the plus, and the founder asked for the duplicate gone: this proves
   the home carries no board, that the choices take effect on the plus,
   that they are written to the coach's preferences, that a coach cannot
   leave themselves an empty plus, and that the default can be had back.
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
  /* the labels on the plus, in the order they are drawn (Log a lesson heads it, outside the list) */
  const plusLabels = async (page) => {
    await tap(page, '[data-tour="quick"]', 900);
    const ls = await page.locator('[data-sheet] button[data-tour^="quick-"]:not([data-tour="quick-log"])').evaluateAll((els) => els.map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()));
    await page.keyboard.press("Escape"); await page.mouse.click(20, 120); await page.waitForTimeout(700);
    return ls;
  };
  const savedLayout = () => (db.prefs[IDS.coach] || {}).layout || null;
  const EIGHT = "Register|Capture|Tip|Drills|Add player|New group|Call off|Competition";
  const NAME = { attend: "register", capture: "capture", tip: "tip", drills: "drills", player: "addplayer", group: "newgroup", weather: "calloff", comp: "competition" };

  try {
    const { ctx, page, text, shot } = await boot();
    await shot("01-home");
    check("(a) the home carries no board — the actions are the plus's alone", (await page.locator('[data-tour="today-board"]').count()) === 0
      && (await page.locator('[data-scroll="screen"] button[data-round], [data-scroll="screen"] button[data-tile]').count()) === 0, "board on the home");
    const d0 = await plusLabels(page);
    check("(a) the plus starts on the eight defaults under Log a lesson", d0.join("|") === EIGHT, d0.join("|"));

    /* --- into the editor from the plus --- */
    await tap(page, '[data-tour="quick"]', 900); await page.locator('[data-sheet] button', { hasText: /^Edit$/ }).first().click(); await page.waitForTimeout(1000);
    const t1 = await text(); await shot("02-editor");
    check("(b) Edit opens the plus itself, arrangeable — no Home · Plus switch and no size, there being one list",
      t1.includes("Shortcuts") && /Drag to arrange/i.test(t1) && !/SIZE/i.test(t1) && !/Three across/.test(t1)
      && (await page.locator('[data-arrange="grid"]').count()) === 1, t1.slice(0, 240));
    check("(b) every tile is a handle, and carries its own way off",
      (await page.locator('[data-arrange-id]').count()) === 8
      && (await page.locator('button[aria-label="Remove Drills"]').count()) === 1, String(await page.locator('[data-arrange-id]').count()));

    /* --- take one off --- */
    await page.locator('button[aria-label="Remove Drills"]').first().click(); await page.waitForTimeout(700);
    check("(c) removing writes it to the coach's preferences", !!savedLayout() && Array.isArray(savedLayout().quick) && !savedLayout().quick.includes("drills"), JSON.stringify(savedLayout()));
    const t1b = await text();
    check("(c) …and what is not on the plus is offered under Hidden", /Hidden/i.test(t1b) && (await page.locator('button[aria-label="Add Drills"]').count()) === 1, t1b.slice(0, 260));

    /* --- put it back: it goes on the end --- */
    await page.locator('button[aria-label="Add Drills"]').first().click(); await page.waitForTimeout(700);
    check("(c) adding puts it at the end", savedLayout().quick[savedLayout().quick.length - 1] === "drills", JSON.stringify(savedLayout().quick));

    /* --- MOVE IT BY DRAGGING IT. A real pointer drag: press on the
       tile, cross the 9px threshold, travel a whole cell back, let go. --- */
    const before = savedLayout().quick.slice();
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
    const b2 = savedLayout().quick;
    check("(c) dragging a tile onto another moves it there",
      b2.length === before.length && b2[b2.length - 2] === last && b2.join("|") !== before.join("|"),
      `${before.join("|")}  ->  ${b2.join("|")}`);
    await shot("03-dragged");

    /* --- and a keyboard reaches the same place --- */
    const kbBefore = savedLayout().quick.slice();
    await page.locator(`[data-arrange-id="${kbBefore[0]}"] button`).first().focus();
    await page.keyboard.press("ArrowRight"); await page.waitForTimeout(700);
    const kb = savedLayout().quick;
    check("(c) an arrow key moves a tile too, for anyone who cannot drag",
      kb[1] === kbBefore[0] && kb[0] === kbBefore[1], `${kbBefore.join("|")}  ->  ${kb.join("|")}`);

    /* --- and the plus itself has changed, in the editor's order --- */
    await M.back(page); await page.waitForTimeout(1200);
    const d1 = await plusLabels(page); await shot("04-plus-changed");
    check("(d) the plus is in the order the editor left it in",
      d1.map((x) => x.toLowerCase().replace(/[^a-z]/g, "")).join("|") === savedLayout().quick.map((id) => NAME[id]).join("|"),
      `${d1.join("|")} · ${savedLayout().quick.join("|")}`);

    /* --- a coach cannot leave themselves nothing --- */
    await tap(page, '[data-tour="quick"]', 900); await page.locator('[data-sheet] button', { hasText: /^Edit$/ }).first().click(); await page.waitForTimeout(1000);
    for (const id of ["Register", "Capture", "Tip", "Drills", "Add player", "New group", "Call off", "Competition"]) {
      const b = page.locator(`button[aria-label="Remove ${id}"]`).first();
      if (await b.count() && await b.isEnabled()) { await b.click(); await page.waitForTimeout(350); }
    }
    const left = savedLayout().quick;
    check("(f) the last one on the plus cannot be taken off", left.length === 1, JSON.stringify(left));
    const lastMinus = page.locator("button[aria-label^='Remove ']").first();
    check("(f) …and its minus is disabled rather than refusing after the tap",
      (await lastMinus.count()) === 1 && !(await lastMinus.isEnabled()), String(await lastMinus.count()));
    await shot("06-one-left");

    /* --- and the default can be had back --- */
    await byText(page, "Reset").first().click(); await page.waitForTimeout(900);
    check("(g) Reset restores the eight", savedLayout().quick.join("|") === "attend|capture|tip|drills|player|group|weather|comp", JSON.stringify(savedLayout()));
    await M.back(page); await page.waitForTimeout(1200);
    const d2 = await plusLabels(page); await shot("07-plus-restored");
    check("(g) …and the plus is itself again", d2.join("|") === EIGHT, d2.join("|"));

    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
    await ctx.close();
  } catch (e) {
    check("RUN ERROR", false, String(e && e.stack ? e.stack : e).slice(0, 400));
  } finally { await browser.close(); M.stopServer(server); }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  summary();
})();
