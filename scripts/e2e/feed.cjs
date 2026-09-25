/* LESSONS. What a player opens the tab to see: their coach's lessons,
   newest first, each row a poster of its first file; the lesson page is
   the player. This suite proves nothing plays until it is tapped, that
   the poster and the player are the coach's real files — not the
   harness's drawn clip — that the viewer shows no browser chrome at
   rest and plays with sound on a tap, and that a player with nothing
   yet is told so under the same heading.
   Usage: node feed.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4308), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", fresh: "00000000-0000-4000-8000-00000000f9e5" };
const L = { one: "10000000-0000-4000-8000-0000000fe001", two: "10000000-0000-4000-8000-0000000fe002" };
const LONG = "Cleaner contact from the fringe all session, and the low runner is starting to look like a shot he trusts under pressure.";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("fresh", "fresh@t.ie", { role: "player", name: "Dara Ryan", type: "adult", coachId: IDS.coach, dob: "1990-02-02" });
  /* newest first: the short game lesson with a clip and a photo, then putting with one clip */
  M.addLesson(db, { id: L.one, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-18", focus: "Short game", subs: ["HI 18.4"], notes: LONG });
  M.addMedia(db, { lessonId: L.one, kind: "video", path: `${IDS.coach}/${L.one}/clip-1.mp4` });
  M.addMedia(db, { lessonId: L.one, kind: "photo", path: `${IDS.coach}/${L.one}/still-1.jpg` });
  M.addLesson(db, { id: L.two, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-04", focus: "Putting", notes: "Pace first." });
  M.addMedia(db, { lessonId: L.two, kind: "video", path: `${IDS.coach}/${L.two}/clip-2.mp4` });
  return db;
}

const { check, results, summary } = M.checker("feed");
const squash = (s) => (s || "").replace(/\s+/g, " ").trim();

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
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: false });
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const playingCount = (page) => page.evaluate(() => Array.from(document.querySelectorAll("video")).filter((v) => !v.paused).length);

  try {
    /* ---------- (a) the list is what Lessons opens on ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Lessons"]', 1600);
      await page.waitForTimeout(1200);
      const t0 = await text(); await shot("01-list");
      check("(a) Lessons opens on the list under its own heading",
        (await page.locator("h1", { hasText: "Lessons" }).count()) === 1 && t0.includes("Short game") && t0.includes("Putting"), t0.slice(0, 200));
      check("(a) there is no feed, and no switch to one",
        (await page.locator("[data-feed-card]").count()) === 0 && (await page.locator('button[aria-label="Feed"], button[aria-label="List"]').count()) === 0, t0.slice(0, 200));
      const rows = page.locator(".nsc-list > button");
      const rowTexts = (await rows.allInnerTexts()).map(squash);
      check("(a) a row is the focus and one grey line — the day, and the files when there is more than one",
        rowTexts.length === 2 && /^Short game Fri 18 Sep · 2 files$/.test(rowTexts[0]) && /^Putting Fri 4 Sep$/.test(rowTexts[1]), JSON.stringify(rowTexts));
      const posterSrc = await rows.first().locator("video").getAttribute("src");
      check("(a) the poster is the coach's own file", !!posterSrc && /object\/sign\/.*clip-1\.mp4/.test(posterSrc), String(posterSrc));
      check("(a) the first row is the walkthrough's row", (await page.locator('[data-tour="log-row"]').count()) === 1, "");
      check("(a) nothing plays until it is tapped", (await playingCount(page)) === 0, `${await playingCount(page)} playing`);
      check("(a) a real account is never shown the harness's drawn clip or its test control",
        !t0.includes("Test media") && (await rows.locator('[aria-label="Clip"]').count()) === 0, t0.slice(0, 200));
      check("(a) the tab bar sits on the same paper as the list",
        await page.evaluate(() => { const b = document.querySelector('[aria-label="Lessons"]'); const bg = (el) => getComputedStyle(el).backgroundColor; let e = b; while (e && bg(e) === "rgba(0, 0, 0, 0)") e = e.parentElement; const bar = e ? bg(e) : ""; const list = document.querySelector(".nsc-list"); let f = list; while (f && bg(f) === "rgba(0, 0, 0, 0)") f = f.parentElement; const page_ = f ? bg(f) : ""; const lum = (c) => { const m = c.match(/\d+/g) || [0, 0, 0]; return (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3; }; return lum(bar) > 200 && lum(page_) > 200; }),
        "dark surface under a light bar");

      /* ---------- (b) the lesson page is the player ---------- */
      await rows.first().click(); await page.waitForTimeout(1400);
      const t1 = await text(); await shot("02-lesson");
      check("(b) the row opens the lesson", t1.includes("Short game") && t1.includes("Fri 18 Sep · Niamh Byrne") && t1.includes(LONG), t1.slice(0, 240));
      const stage = page.locator('[data-tour="lesson-clip"]');
      const vid = stage.locator("video").first();
      check("(b) the clip rests without the browser's controls, under one play disc",
        (await vid.count()) === 1 && (await vid.getAttribute("controls")) === null && (await stage.locator('button[aria-label="Play"]').count()) === 1, "");
      check("(b) the clip is the coach's real file", /object\/sign\/.*clip-1\.mp4/.test((await vid.getAttribute("src")) || ""), String(await vid.getAttribute("src")));
      check("(b) it is not letterboxed: the frame is the clip's own shape",
        await vid.evaluate((v) => { const r = v.getBoundingClientRect(); const box = v.parentElement.getBoundingClientRect(); const wide = v.videoWidth >= v.videoHeight; return wide ? Math.abs(r.width - box.width) < 2 : r.width < box.width - 40; }), "");
      check("(b) the note carries no label", !/Niamh's notes/i.test(t1) && t1.includes(LONG), t1.slice(-260));
      check("(b) two files are two thumbnails, the first chosen",
        (await stage.locator("button[aria-pressed]").count()) === 2 && (await stage.locator('button[aria-pressed="true"]').count()) === 1, "");
      await stage.locator('button[aria-label="Play"]').click(); await page.waitForTimeout(350);
      const state = await vid.evaluate((v) => ({ paused: v.paused, muted: v.muted, controls: v.controls, ended: v.ended, t: v.currentTime }));
      check("(b) a tap plays it with sound, and only then hands over the controls",
        (state.ended || !state.paused || state.t > 0) && state.muted === false && (state.controls === true || state.ended), JSON.stringify(state));
      await stage.locator("button[aria-pressed]").nth(1).click(); await page.waitForTimeout(600);
      check("(b) the second thumbnail shows the photo",
        (await stage.locator(":scope > div").first().locator("img").count()) === 1 && (await stage.locator(":scope > div").first().locator("video").count()) === 0
          && (await stage.locator('button[aria-pressed="true"]').count()) === 1, "");
      check("(b) Download is offered", (await page.locator("button", { hasText: "Download" }).count()) === 1, t1.slice(-200));
      check("(b) the page names the level it was logged at", t1.includes("HI 18.4"), t1.slice(0, 240));
      await shot("03-lesson-photo");

      /* ---------- (c) and back ---------- */
      await M.back(page); await page.waitForTimeout(1000);
      const t2 = await text(); await shot("04-back");
      check("(c) back lands on the list, and nothing is playing", t2.includes("Putting") && (await page.locator(".nsc-list > button").count()) === 2 && (await playingCount(page)) === 0, t2.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (d) nothing logged yet ---------- */
    {
      const { ctx, page, text, shot } = await boot("fresh");
      await tap(page, '[aria-label="Lessons"]', 1400);
      const t0 = await text(); await shot("05-empty");
      check("(d) a player with no lessons is told so under the same heading",
        t0.includes("No lessons yet") && !t0.includes("No lessons yet.") && (await page.locator("h1", { hasText: "Lessons" }).count()) === 1, t0.slice(0, 200));
      check("(d) and is offered no switch to use on nothing", (await page.locator('button[aria-label="Feed"], button[aria-label="List"]').count()) === 0, t0.slice(0, 200));
      await ctx.close();
    }

    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("RUN ERROR", false, String(e && e.stack ? e.stack : e).slice(0, 400));
  } finally {
    await browser.close(); M.stopServer(server);
  }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  summary();
})();
