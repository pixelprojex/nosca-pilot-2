/* SYNC. Settings › Version says which build this phone is running, and
   Sync beneath it asks the server (/version.json) by hand: the newest
   build loads, or the toast says Up to date with the build it has, or
   why the server could not be asked. The auto check on every return to
   the front is the same function; this is the one the person taps.
   Usage: node sync.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  return db;
}

const { check, results, summary } = M.checker("sync");
const near = (x, y, tol) => Math.abs(x - y) <= tol;
const built = (() => { try { return JSON.parse(fs.readFileSync(path.join(distDir, "version.json"), "utf8")).built; } catch (e) { return null; } })();

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  /* what the "server" says it is serving: the build itself, a newer one, or nothing useful */
  const serve = { mode: "same" };
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.route("**/version.json*", (r) => {
      if (serve.mode === "same") return r.continue();
      if (serve.mode === "newer") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ built: "2999-01-01T00:00:00.000Z" }) });
      return r.fulfill({ status: 500, contentType: "text/plain", body: "" });
    });
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const rows = (page) => ({ version: page.locator('[data-tour="settings-version"]'), sync: page.locator('[data-tour="settings-sync"]') });
  const openSettings = async (page) => {
    await tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 800);
    if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
  };

  try {
    check("(0) the build wrote /version.json with its stamp", typeof built === "string" && built.length > 10, String(built));

    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await openSettings(page);
      const { version, sync } = rows(page);
      await sync.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const vt = M.norm((await version.count()) ? await version.innerText() : "");
      const value = vt.replace(/^Version\s*/, "");
      check("(a) Settings › Version reads the build's day and time", (await version.count()) === 1 && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) · \d{1,2}:\d{2} (am|pm)$/.test(value), vt);
      const [bv, bs] = await Promise.all([version.boundingBox(), sync.boundingBox()]);
      /* the next box down: the list's own 10px between two boxes, nothing else */
      check("(a2) Sync sits directly beneath it as the next box, one row, a chevron and no sub", (await sync.count()) === 1 && !!bv && !!bs && near(bs.x, bv.x, 1) && near(bs.width, bv.width, 1) && bs.y - (bv.y + bv.height) >= 0 && bs.y - (bv.y + bv.height) <= 12 && M.norm(await sync.innerText()) === "Sync" && (await sync.locator("svg").count()) === 1, JSON.stringify({ bv, bs, t: (await sync.count()) ? await sync.innerText() : "" }));
      await shot("01-version-sync");

      /* the server has this very build: Up to date, naming it */
      serve.mode = "same";
      await tap(page, '[data-tour="settings-sync"]', 700);
      const t1 = await text();
      check("(b) the server serving this build: Sync says Up to date and names the build it has", /Up to date/.test(t1) && t1.includes(value), t1.slice(-160));
      await shot("02-up-to-date");
      await page.waitForTimeout(1500);
      check("(b2) …and the toast has gone, the row still there", !/Up to date/.test(await text()) && (await sync.count()) === 1, (await text()).slice(-120));

      /* the server cannot be asked */
      serve.mode = "fail";
      await tap(page, '[data-tour="settings-sync"]', 700);
      check("(c) a server that cannot be asked says so", /Couldn't reach the server/.test(await text()), (await text()).slice(-120));
      await page.waitForTimeout(1600);

      /* no connection */
      await ctx.setOffline(true);
      await tap(page, '[data-tour="settings-sync"]', 700);
      check("(d) with no connection Sync says No connection", /No connection/.test(await text()), (await text()).slice(-120));
      await ctx.setOffline(false);
      await page.waitForTimeout(1800);

      /* the search finds both rows */
      await page.locator('input[aria-label="Search settings"]').fill("update"); await page.waitForTimeout(400);
      check("(e) searching Settings for \"update\" finds Version and Sync", (await version.count()) === 1 && (await sync.count()) === 1 && (await page.locator('[data-tour="settings-tour"]').count()) === 0, (await text()).slice(0, 160));
      await page.locator('input[aria-label="Search settings"]').fill(""); await page.waitForTimeout(300);

      /* a newer build on the server: Sync loads it — the app reloads and comes back on its feet */
      serve.mode = "newer";
      const reloaded = page.waitForEvent("load", { timeout: 6000 }).then(() => true).catch(() => false);
      await page.evaluate(() => { window.__nosca_alive = 1; });
      await tap(page, '[data-tour="settings-sync"]', 300);
      const did = await reloaded;
      serve.mode = "same";
      const alive = await page.evaluate(() => window.__nosca_alive === 1).catch(() => false);
      check("(f) a newer build on the server: Sync reloads the app", did && !alive, JSON.stringify({ did, alive }));
      await M.settle(page);
      const t2 = await text();
      check("(f2) …which comes back on its feet, on the coach's home", /Today/.test(t2) && !/Settings/.test(t2.slice(0, 40)), t2.slice(0, 120));
      await shot("03-after-reload");
      await ctx.close();
    }

    /* ---------- the player: the same two rows ---------- */
    {
      const { ctx, page, text } = await boot("adult");
      await openSettings(page);
      const { version, sync } = rows(page);
      await sync.scrollIntoViewIfNeeded().catch(() => {});
      check("(g) a player's Settings carries Version and Sync too", (await version.count()) === 1 && (await sync.count()) === 1, (await text()).slice(-200));
      serve.mode = "same";
      await tap(page, '[data-tour="settings-sync"]', 700);
      check("(g2) …and Sync answers them the same way", /Up to date/.test(await text()), (await text()).slice(-120));
      await ctx.close();
    }

    check("(h) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
