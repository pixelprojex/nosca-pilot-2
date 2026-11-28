/* The website's stills of the app, shot from a mock build at 3x (1170 x 2532). One browser, one phone a step, every
   step from a fresh open. Each PNG is named for the still it becomes; stills.py turns them into assets/*.webp.
   node website/tools/shoot.cjs <dist> <port> <outDir> [step,step,...]   (a step ending in * takes every step it starts)
   Steps: home peek diary chat settings tools tools-green calloff player-golf player-tennis player-green parent
          junior junior-green import (and import-start, only when named) sport-<sport> (tennis rowing squash padel
          equestrian; golf's are home's)
          splash-<sport> (golf tennis rowing squash padel equestrian) */
const path = require("path"), fs = require("fs");
const L = require("./lib.cjs");
const [dist, portArg, outDir, only] = process.argv.slice(2);
if (!dist || !outDir) { console.error("node website/tools/shoot.cjs <dist> <port> <outDir> [steps]"); process.exit(2); }
const PORT = Number(portArg || 5850);
fs.mkdirSync(outDir, { recursive: true });
const SPORTS = ["golf", "tennis", "rowing", "squash", "padel", "equestrian"];
/* the two areas the log page shows chosen, in each sport's own words */
const FOCUS2 = { golf: ["Chipping", "Putting"], tennis: ["Serve", "Forehand"], rowing: ["Technique", "Rhythm & rating"], squash: ["Drives", "Volleys"], padel: ["Net game", "Overheads"], equestrian: ["Flatwork", "Pole work"] };
/* Mark it up, on the putt (filmed facing the player, the target to the right): the Angle along the shaft at address,
   a ring round the ball, an arrow along the start line (fractions of the video's own frame; a circle is drawn from
   its centre; ink 0 is the first colour, 2 the white) */
const MARKUP = JSON.parse(fs.readFileSync(path.join(__dirname, "markup-plan.json"), "utf8"));

(async () => {
  const server = await L.serve(dist, PORT);
  const browser = await L.launch();
  const log = [];
  const want = (name) => !only || only.split(",").some((o) => name === o || (o.endsWith("*") && name.startsWith(o.slice(0, -1))));
  const step = async (name, fn) => {
    if (!want(name)) return; const t0 = Date.now();
    try { const errors = await fn(); const e = L.noise(errors || []); log.push(`${name} ok ${Date.now() - t0}ms${e.length ? " · console: " + e.slice(0, 4).join(" | ").slice(0, 600) : ""}`); }
    catch (e) { log.push(`${name} FAILED ${String(e).slice(0, 400)}`); }
    console.log(log[log.length - 1]);
  };
  const shot = (page, n) => page.screenshot({ path: path.join(outDir, n + ".png") });
  const boot = (db, role, opts = {}) => L.boot(browser, db, role, { port: PORT, ...opts });
  /* a tile by its whole word (Putting, not Putting green) */
  const tile = async (page, word) => {
    const el = page.locator("button", { hasText: new RegExp(`^\\s*${word.replace(/[&]/g, "\\$&")}\\s*$`) }).first();
    if (await el.count()) { await el.dispatchEvent("click"); await L.wait(page, 450); return true; }
    return L.tapText(page, word, 450);
  };
  /* the coach's log page for Cian, the sport's two areas chosen */
  const logPage = async (page, sport) => {
    await L.tap(page, '[data-tour="quick-log"]', 1300);
    await L.tapText(page, "Cian", 1000);
    for (const w of FOCUS2[sport]) await tile(page, w);
    await L.wait(page, 600);
  };
  /* Who, scrolled until the group's tile stands whole 18 points over the foot of the screen, unless that would leave
     the page's title cut at the top (the new title is taller): then the title stands whole and the tile runs on under
     the foot, as a list does */
  const whoToGroup = (page) => page.evaluate(() => {
    const g = [...document.querySelectorAll("button")].filter((b) => /Thursday\s*clinic/.test(b.innerText)).pop();
    let n = g; while (n && !(/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1)) n = n.parentElement;
    if (!n) return "no scroller"; const need = g.getBoundingClientRect().bottom - (window.innerHeight - 18);
    const h = n.querySelector("h1,h2"), cut = h ? h.getBoundingClientRect().bottom - n.getBoundingClientRect().top : 0;
    n.scrollTop += need > 0 && need < cut ? 0 : Math.max(0, need); return n.scrollTop;
  });
  /* the home scrolled to its foot: the afternoon's rows, Tomorrow, Actions and All lessons */
  const toFoot = (page) => page.evaluate(() => { const s = [...document.querySelectorAll('[data-scroll="screen"]')].pop(); if (!s) return null; s.scrollTop = s.scrollHeight; return s.scrollTop; });

  /* ---------------- the coach, in golf ---------------- */
  await step("home", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "coach");
    await L.wait(page, 900); await shot(page, "coach-today-golf");
    log.push("home foot at " + (await toFoot(page))); await L.wait(page, 900); await shot(page, "coach-today-actions");
    await L.scrollTo(page, 0); await L.wait(page, 500);
    await L.tap(page, '[data-tour="quick"]', 1200); await shot(page, "coach-plus-golf");
    await L.tap(page, '[data-tour="quick-log"]', 1300);
    log.push("who scrolled to " + (await whoToGroup(page))); await L.wait(page, 800); await shot(page, "coach-log-who");
    await L.tapText(page, "Cian", 1000);
    for (const w of FOCUS2.golf) await tile(page, w);
    await L.wait(page, 600); await shot(page, "coach-log-golf");
    await ctx.close(); return errors;
  });
  await step("peek", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "coach");
    await page.locator("button", { hasText: "Róisín Walsh" }).first().dispatchEvent("click"); await L.wait(page, 1300); await shot(page, "coach-peek");
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" }); await L.M.settle(page, { carryOn: true });
    await page.locator("button", { hasText: "Thursday clinic" }).first().dispatchEvent("click"); await L.wait(page, 1300);
    await L.tap(page, '[data-tour="peek-register"]', 1300);
    const pres = page.locator("button", { hasText: /^\s*Present\s*$/ }), abs = page.locator("button", { hasText: /^\s*Absent\s*$/ });
    const n = await pres.count(); log.push("register rows " + n);
    /* Cian, Saoirse and Ellie present, Aoife absent, Darragh present, the rest not yet marked */
    const plan = [pres, pres, pres, abs, pres];
    for (let i = 0; i < Math.min(n, plan.length); i++) { await plan[i].nth(i).dispatchEvent("click"); await L.wait(page, 260); }
    await L.wait(page, 700); await shot(page, "coach-register");
    await ctx.close(); return errors;
  });
  await step("diary", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "coach");
    await L.tap(page, '[aria-label="Diary"]', 1500);
    await L.scrollTo(page, 0); await L.wait(page, 900); await shot(page, "product-diary-list");
    /* scrolled until the List · Calendar switch has gone wholly under the compact header (at 96 it stood cut) */
    await L.scrollTo(page, 150); await L.wait(page, 800); await shot(page, "coach-diary-list");
    await L.scrollTo(page, 0); await L.wait(page, 400);
    await page.locator('[data-tour="cal-view"] button', { hasText: "Calendar" }).first().dispatchEvent("click").catch(() => {}); await L.wait(page, 1300);
    await L.scrollTo(page, 60); await L.wait(page, 800); await shot(page, "coach-diary-calendar");
    await ctx.close(); return errors;
  });
  await step("chat", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "coach");
    await L.tap(page, '[aria-label="Chat"]', 1300); await shot(page, "coach-chat");
    await page.locator("[data-person-row]", { hasText: "Cian Murphy" }).first().click().catch(() => {}); await L.wait(page, 1300); await shot(page, "coach-thread");
    await L.tap(page, '[aria-label="Back"]', 900);
    await page.locator("[data-person-row]", { hasText: "Saoirse Kelly" }).first().click().catch(() => {}); await L.wait(page, 1300); await shot(page, "coach-thread-junior");
    await ctx.close(); return errors;
  });
  await step("settings", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "coach");
    await L.tap(page, '[data-tour="profile-pill"]', 1300); await shot(page, "coach-settings");
    await ctx.close(); return errors;
  });
  /* the player's file, a lesson, Mark it up and Compare, on the real coaching clips (the product-* pair is the same screens, kept by name) */
  const tools = (clip, names) => async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "coach", { clip });
    await L.tap(page, '[aria-label="Roster"]', 1300);
    await page.locator("[data-person-row]", { hasText: "Cian Murphy" }).first().click().catch(() => {}); await L.wait(page, 1300);
    if (names.file) await shot(page, names.file);
    await page.locator("button", { hasText: "Chipping" }).first().click().catch(() => {}); await L.wait(page, 1500);
    await L.tap(page, '[data-tour="lesson-markup"]', 1300);
    await page.waitForFunction(() => { const c = document.querySelector('[data-tour="markup-stage"] canvas'); return !!c && c.width > 2; }, null, { timeout: 10000 }).catch(() => {});
    await L.wait(page, 900);
    const box = await page.locator('[data-tour="markup-stage"] canvas').boundingBox();
    const at = ([x, y]) => [box.x + box.width * x, box.y + box.height * y];
    for (const s of MARKUP) {
      await L.tap(page, `[aria-label="${s.tool}"]`, 250);
      await page.locator('[aria-label="Colour"]').nth(s.ink).dispatchEvent("click"); await L.wait(page, 200);
      const pts = s.pts || Array.from({ length: 13 }, (_, i) => [s.from[0] + (s.to[0] - s.from[0]) * i / 12, s.from[1] + (s.to[1] - s.from[1]) * i / 12]);
      const [x0, y0] = at(pts[0]); await page.mouse.move(x0, y0); await page.mouse.down();
      for (const p of pts.slice(1)) { const [x, y] = at(p); await page.mouse.move(x, y, { steps: 2 }); }
      await page.mouse.up(); await L.wait(page, 700);
    }
    await L.wait(page, 900); await shot(page, names.markup);
    await L.tap(page, '[aria-label="Back"]', 1300);
    await L.tap(page, '[data-tour="lesson-compare"]', 1300);
    await page.waitForSelector("[data-compare-row]", { timeout: 10000 }).catch(() => {});
    const row = page.locator("[data-compare-row]", { hasText: "Pitching" });
    if (await row.count()) await row.first().click(); else await page.locator("[data-compare-row]").first().click();
    await L.wait(page, 2200);
    await L.tap(page, '[data-tour="compare-transport"] button[aria-label="Play"]', 650);
    await L.tap(page, '[data-tour="compare-transport"] button[aria-label="Pause"]', 500);
    /* the second clip nudged on its own, so the two sit a few frames apart */
    const nb = page.locator('[data-compare-pane="b"] button[aria-label^="On a frame"]');
    for (let i = 0; i < 9; i++) { if (await nb.count()) { await nb.first().click().catch(() => {}); await L.wait(page, 120); } }
    await L.wait(page, 900); await shot(page, names.compare);
    await ctx.close(); return errors;
  };
  await step("tools", tools("real", { file: "coach-player-file", markup: "coach-markup", compare: "coach-compare" }));
  await step("tools-green", tools("real", { markup: "product-markup", compare: "product-compare" }));
  await step("calloff", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "coach");
    await L.tap(page, '[data-tour="quick"]', 1200);
    await L.tap(page, '[data-tour="quick-weather"]', 1400);
    await page.locator('[data-tour="calloff-why"]', { hasText: "Weather" }).first().dispatchEvent("click").catch(() => {}); await L.wait(page, 800); await shot(page, "coach-calloff");
    await ctx.close(); return errors;
  });

  /* ---------------- the player ---------------- */
  for (const sport of ["golf", "tennis"]) {
    await step("player-" + sport, async () => {
      const { ctx, page, errors } = await boot(L.D.buildDb(sport), "cian");
      const tag = sport === "golf" ? "" : "-" + sport;
      await L.wait(page, 1500); await shot(page, `player-feed${tag}`);
      await L.tap(page, '[data-tour="feed-open"]', 1500); if (sport === "golf") await shot(page, "player-lesson");
      await L.tap(page, '[aria-label="Drills"]', 1300); await shot(page, `player-drills${tag}`);
      if (sport === "golf") {
        await L.tap(page, '[aria-label="Home"]', 1100);
        await L.tap(page, '[data-tour="profile-pill"]', 1100);
        await L.tap(page, '[data-tour="sheet-progress"]', 1500); await shot(page, "player-progress");
        await L.scrollTo(page, 735); await L.wait(page, 800); await shot(page, "player-progress-attendance");
      }
      await ctx.close(); return errors;
    });
  }
  await step("player-green", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "cian", { clip: "green" });
    await L.wait(page, 1800); await shot(page, "product-feed");
    await L.tap(page, '[data-tour="feed-open"]', 1600); await shot(page, "product-lesson");
    await ctx.close(); return errors;
  });

  /* ---------------- the family ---------------- */
  await step("parent", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "orla");
    await L.wait(page, 900); await shot(page, "parent-family");
    await ctx.close(); return errors;
  });
  await step("junior", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "saoirse");
    await L.wait(page, 1300); await shot(page, "junior-home");
    await L.tap(page, '[aria-label="Drills"]', 1300); await shot(page, "junior-drills");
    await ctx.close(); return errors;
  });
  await step("junior-green", async () => {
    const { ctx, page, errors } = await boot(L.D.buildDb("golf"), "saoirse", { clip: "green" });
    await L.wait(page, 1800); await shot(page, "product-junior-home");
    await ctx.close(); return errors;
  });

  /* ---------------- the WhatsApp import, as the coach ----------------
     A season of Niamh's chat with Cian (fixtures/import-chat.cjs: the real clips and stills, zipped as an iPhone
     exports it) chosen in Settings › Import, the player's label and For set as a coach sets them, sorted by the
     mock's plain reading of her words; then the Review list (the days newest first, ticked or not), A day (its
     files, the note in her own lines, the day's messages) and the List · Feed preview (the drafts' own files, played
     from the zip; nothing has been added yet). The import's opening page (Start) is not taken here: it is being
     redesigned (feat/import-launch); `import-start` takes it once that lands, and only when asked by name. */
  const CHAT = require("./fixtures/import-chat.cjs").write(path.join(outDir, "chats"));
  const importTo = async (page) => {
    await L.tap(page, '[data-tour="profile-pill"]', 1000);
    await L.tap(page, '[data-tour="settings-import"]', 1400);
    await page.setInputFiles('[data-tour="import-file"]', CHAT);
    await page.waitForSelector('[data-tour="import-found"]', { timeout: 15000 });
    await L.wait(page, 600);
    return page;
  };
  const toReview = async (page) => {
    if (await page.locator('[data-label="Cian M"][data-role=""]').count()) {
      await page.locator('[data-label="Cian M"]').click(); await L.wait(page, 500);
      await page.locator('[data-import-role="player"]').click(); await L.wait(page, 600);
    }
    await page.locator('[data-tour="import-for"]').click(); await L.wait(page, 600);
    await page.locator(`[data-person="${L.D.IDS.cian}"]`).click(); await L.wait(page, 700);
    await page.locator('[data-tour="import-sort"]').click();
    await page.waitForFunction(() => { const p = document.querySelector('[data-tour="import-progress"]'); return !!document.querySelector('[data-tour="import-review"]') && (!p || p.dataset.status !== "running"); }, null, { timeout: 60000 });
    await L.wait(page, 900);
  };
  /* every poster on the screen drawn (each row's first picture, made on the phone) */
  const posters = (page) => page.waitForFunction(() => { const rows = [...document.querySelectorAll('[data-tour="import-row"]')].filter((r) => { const b = r.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0 && r.querySelector("img,[data-poster]"); }); return rows.every((r) => r.querySelector('[data-poster="1"]') || !r.querySelector("[data-poster]")); }, null, { timeout: 15000 }).catch(() => {});
  await step("import", async () => {
    const db = L.D.buildDb("golf"); db.importReady = true;
    const { ctx, page, errors } = await boot(db, "coach");
    await importTo(page); await toReview(page);
    await L.scrollTo(page, 0); await posters(page); await L.wait(page, 800); await shot(page, "coach-import-review");
    await page.locator('[data-tour="import-row"][data-day="2025-11-06"] button').first().click(); await L.wait(page, 1200);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-tour="import-day"] img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
    /* scrolled to what the day carries: her words as the note, the day's files, the messages they came from */
    const dayAt = await page.evaluate(() => { const s = [...document.querySelectorAll('[data-scroll="screen"]')].pop(), n = document.querySelector('[data-tour="import-day-note"]'); if (!s || !n) return null; s.scrollTop += n.getBoundingClientRect().top - 126; return s.scrollTop; });
    log.push("day scrolled to " + dayAt);
    await L.wait(page, 900); await shot(page, "coach-import-day");
    await page.locator('[aria-label="Back"]').first().dispatchEvent("click"); await L.wait(page, 900);
    await page.locator('[data-tour="import-view"] button', { hasText: "Feed" }).first().click(); await L.wait(page, 1200);
    await page.waitForFunction(() => { const v = document.querySelector('[data-tour="import-feed"] video[src^="blob:"]'); return !!v && v.readyState >= 2; }, null, { timeout: 15000 }).catch(() => {});
    await L.wait(page, 1600); await shot(page, "coach-import-feed");
    await ctx.close(); return errors;
  });
  /* the import's opening page, once feat/import-launch's redesign is in the build: `shoot.cjs … import-start` */
  if (only && only.split(",").includes("import-start")) await step("import-start", async () => {
    const db = L.D.buildDb("golf"); db.importReady = true;
    const { ctx, page, errors } = await boot(db, "coach");
    await L.tap(page, '[data-tour="profile-pill"]', 1000); await L.tap(page, '[data-tour="settings-import"]', 1600);
    await shot(page, "coach-import-start");
    await ctx.close(); return errors;
  });

  /* ---------------- six sports: the home, the log page, the opening ---------------- */
  for (const sport of SPORTS) {
    /* golf's are the home step's */
    if (sport !== "golf") await step("sport-" + sport, async () => {
      const { ctx, page, errors } = await boot(L.D.buildDb(sport), "coach");
      await L.wait(page, 1000); await shot(page, `coach-today-${sport}`);
      await L.tap(page, '[data-tour="quick"]', 1200);
      await logPage(page, sport); await shot(page, `coach-log-${sport}`);
      await ctx.close(); return errors;
    });
    await step("splash-" + sport, async () => {
      const { ctx, page, errors } = await boot(L.D.buildDb(sport), "coach", { settle: false });
      /* at rest: everything landed, before the lift at 4 s */
      await L.wait(page, 3350); await shot(page, `splash-${sport}`);
      await ctx.close(); return errors;
    });
  }
  await browser.close(); server.close();
  console.log("\n" + log.join("\n")); process.exit(log.some((l) => / FAILED /.test(l)) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
