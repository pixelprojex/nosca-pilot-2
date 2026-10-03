/* THE WHO PAGE. Log a lesson opens on Who: the search at the top whatever
   the roster's size, a row of filter tiles — All, the age bands somebody
   is in (U10 … U18), Adults, each group — and everyone as a grid of face
   tiles with the surname under the first name, never a list. A filter
   narrows the grid to its people and names itself; the search narrows
   it further; Return picks the top match. Two of a name are two tiles.
   Usage: node who.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4396), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = {
  coach: "00000000-0000-4000-8000-00000000c0ac",
  cian: "00000000-0000-4000-8000-0000000adu17", dan: "00000000-0000-4000-8000-0000000adu18",
  aoife: "00000000-0000-4000-8000-00000000ju12", tom: "00000000-0000-4000-8000-00000000ju16", sinead: "00000000-0000-4000-8000-00000000ju99",
  twin: "00000000-0000-4000-8000-00000000tw1n",
};
const yearsAgo = (n) => { const d = new Date(); return `${d.getFullYear() - n}-01-01`; };
function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  const player = (id, name, type, dob) => { M.addUser(db, { id, email: `${id.slice(-4)}@t.ie` }); M.addProfile(db, { id, role: "player", name, type, coachId: IDS.coach, dob }); };
  player(IDS.cian, "Cian Murphy", "adult", yearsAgo(35));
  player(IDS.dan, "Dan Okafor", "adult", null);
  player(IDS.aoife, "Aoife Nolan", "junior", yearsAgo(11));      // U12
  player(IDS.tom, "Tom Beckett", "junior", yearsAgo(16));         // U18
  player(IDS.sinead, "Sinead Walsh", "junior", null);             // under 18 by her own word
  player(IDS.twin, "Cian Murphy", "adult", yearsAgo(22));         // the second Cian
  M.setPrefs(db, IDS.coach, { groups: [{ id: "g1", name: "Tuesday squad", members: ["Aoife Nolan", "Tom Beckett"], memberIds: [IDS.aoife, IDS.tom], day: "Tue", time: "4:00 pm" }] });
  return db;
}

const { check, results, summary } = M.checker("who");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db) => {
    const u = Object.values(db.users).find((x) => x.id === IDS.coach);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, shot };
  };
  const { tap } = M;
  const openWho = async (page) => { await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900); };
  const tiles = (page) => page.locator('button[aria-label]').filter({ has: page.locator("span") });
  const faceTiles = async (page) => {
    /* a face tile is at least 100px tall; a row never was */
    return page.locator("button[aria-label]").evaluateAll((els) => els
      .filter((el) => el.getBoundingClientRect().height >= 100 && /Murphy|Okafor|Nolan|Beckett|Walsh/.test(el.getAttribute("aria-label") || ""))
      .map((el) => ({ name: el.getAttribute("aria-label"), text: (el.innerText || "").replace(/\s+/g, " ").trim(), h: Math.round(el.getBoundingClientRect().height) })));
  };
  const filterTiles = async (page) => (await page.locator('[data-tour="wiz-who-filter"] button').allInnerTexts()).map(M.norm);

  try {
    const db = freshDb();
    const { ctx, page, shot } = await boot(db);
    await openWho(page);
    const search = page.locator('input[aria-label="Search"]');
    check("(a) Who opens with the search at the top, under eight people too", (await search.count()) === 1 && (await search.first().boundingBox()).y < 200, String(await search.count()));
    const f = await filterTiles(page);
    check("(b) the filters are All, the age bands somebody is in, Adults and the group — and no band nobody is in",
          JSON.stringify(f) === JSON.stringify(["All", "U12", "U18", "Adults", "Tuesday squad"]), JSON.stringify(f));
    const faces = await faceTiles(page);
    check("(c) everyone is a face tile, not a row — all six, at least 100px tall", faces.length === 6 && faces.every((x) => x.h >= 100), JSON.stringify(faces.map((x) => [x.name, x.h])));
    check("(d) the surname rides under the first name on every tile", faces.every((x) => x.text.includes(x.name.split(" ")[0]) && x.text.includes(x.name.split(" ").slice(1).join(" "))), JSON.stringify(faces.map((x) => x.text)));
    const rows = await page.locator("button[aria-label]").evaluateAll((els) => els.filter((el) => /Murphy|Okafor|Nolan|Beckett|Walsh/.test(el.getAttribute("aria-label") || "") && el.getBoundingClientRect().height < 100).length);
    check("(e) no list rows left under the tiles", rows === 0, String(rows));
    check("(f) two of a name are two tiles", (await page.locator('button[aria-label="Cian Murphy"]').count()) === 2);
    await shot("01-who");

    /* a band narrows the grid to its people and names itself */
    await page.locator('[data-tour="wiz-who-filter"] button', { hasText: /^U12$/ }).first().click(); await page.waitForTimeout(500);
    let shown = (await faceTiles(page)).map((x) => x.name);
    const label = M.norm(await page.locator('[data-tour="wiz-who-filter"] ~ *').first().innerText().catch(() => ""));
    check("(g) U12 shows the one under-twelve, under a label naming the band", shown.length === 1 && shown[0] === "Aoife Nolan" && /U12/.test(label), JSON.stringify({ shown, label: label.slice(0, 40) }));
    await page.locator('[data-tour="wiz-who-filter"] button', { hasText: /^U18$/ }).first().click(); await page.waitForTimeout(500);
    shown = (await faceTiles(page)).map((x) => x.name).sort();
    check("(h) U18 is the sixteen-year-old and the junior with no date of birth", JSON.stringify(shown) === JSON.stringify(["Sinead Walsh", "Tom Beckett"]), JSON.stringify(shown));
    await page.locator('[data-tour="wiz-who-filter"] button', { hasText: /^Adults$/ }).first().click(); await page.waitForTimeout(500);
    shown = (await faceTiles(page)).map((x) => x.name).sort();
    check("(i) Adults is the three adults, the one with no date of birth among them", JSON.stringify(shown) === JSON.stringify(["Cian Murphy", "Cian Murphy", "Dan Okafor"]), JSON.stringify(shown));
    await shot("02-who-adults");

    /* a group narrows to its members */
    await page.locator('[data-tour="wiz-who-filter"] button', { hasText: /^Tuesday squad$/ }).first().click(); await page.waitForTimeout(500);
    shown = (await faceTiles(page)).map((x) => x.name).sort();
    check("(j) the group tile narrows to the group's members", JSON.stringify(shown) === JSON.stringify(["Aoife Nolan", "Tom Beckett"]), JSON.stringify(shown));

    /* the search narrows further, and Return picks the top match */
    await page.locator('[data-tour="wiz-who-filter"] button', { hasText: /^Adults$/ }).first().click(); await page.waitForTimeout(300);
    await search.first().fill("dan"); await page.waitForTimeout(400);
    shown = (await faceTiles(page)).map((x) => x.name);
    check("(k) the search narrows the filtered grid", shown.length === 1 && shown[0] === "Dan Okafor", JSON.stringify(shown));
    await search.first().press("Enter"); await page.waitForTimeout(700);
    const main = M.norm(await M.rootText(page));
    check("(l) Return picks the top match and the log opens on them", /Dan Okafor/.test(main) && /Log it/.test(main), main.slice(0, 160));
    await shot("03-picked");

    /* All puts everyone back */
    await page.locator('button[aria-label="Dan Okafor"], button', { hasText: /^Dan Okafor/ }).first().click().catch(() => {});
    await ctx.close();

    /* a roster of adults alone: no age bands, no filter row without a group */
    {
      const db2 = M.emptyDb();
      M.addUser(db2, { id: IDS.coach, email: "coach@t.ie" }); M.addProfile(db2, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
      [[IDS.cian, "Cian Murphy"], [IDS.dan, "Dan Okafor"]].forEach(([id, name]) => { M.addUser(db2, { id, email: `${id.slice(-4)}@t.ie` }); M.addProfile(db2, { id, role: "player", name, type: "adult", coachId: IDS.coach, dob: null }); });
      const { ctx: c2, page: p2 } = await boot(db2);
      await openWho(p2);
      check("(m) two adults and no group: the search, the tiles, and no filter row to read first", (await p2.locator('[data-tour="wiz-who-filter"]').count()) === 0 && (await faceTiles(p2)).length === 2 && (await p2.locator('input[aria-label="Search"]').count()) === 1);
      await c2.close();
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
