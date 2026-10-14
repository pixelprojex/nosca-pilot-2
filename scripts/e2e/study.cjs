/* STUDY. One clip on the dark stage with the whole transport, for both
   sides from one clip: Study beside Mark it up and Compare under a video
   on the lesson page (three words fitting one row), play, a frame either
   way, 1× · ½× · ¼×, the scrub, and a loop between two points that holds
   the head inside them; a player on their own lesson, a parent on a
   child's (the title names the child), a player with one clip and
   nothing to compare, nothing for a photo, and Back.
   Usage: node study.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4351), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", fresh: "00000000-0000-4000-8000-00000000f9e5" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const L = { new: "10000000-0000-4000-8000-00000000dd01", old: "10000000-0000-4000-8000-00000000dd02", photo: "10000000-0000-4000-8000-00000000dd03", kid1: "10000000-0000-4000-8000-00000000dd04", lone: "10000000-0000-4000-8000-00000000dd06" };
const FRAME = 1 / 30;

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("fresh", "fresh@t.ie", { role: "player", name: "Dara Ryan", type: "adult", coachId: IDS.coach, dob: "1990-02-02" });
  /* Cian: the newest with a clip and a photo (so Compare is offered too), an older clip, and one with a photo alone */
  M.addLesson(db, { id: L.new, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-18", focus: "Short game", subs: ["HI 18.4"], notes: "Cleaner contact from the fringe." });
  M.addMedia(db, { lessonId: L.new, kind: "video", path: `${IDS.coach}/${L.new}/clip-1.mp4`, createdAt: "2026-09-18T10:01:00Z" });
  M.addMedia(db, { lessonId: L.new, kind: "photo", path: `${IDS.coach}/${L.new}/still-1.jpg`, createdAt: "2026-09-18T10:02:00Z" });
  M.addLesson(db, { id: L.old, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-04", focus: "Putting", notes: "Pace first." });
  M.addMedia(db, { lessonId: L.old, kind: "video", path: `${IDS.coach}/${L.old}/clip-2.mp4`, createdAt: "2026-09-04T10:01:00Z" });
  M.addLesson(db, { id: L.photo, coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: "Driving" });
  M.addMedia(db, { lessonId: L.photo, kind: "photo", path: `${IDS.coach}/${L.photo}/still-3.jpg`, createdAt: "2026-08-20T10:01:00Z" });
  /* Saoirse: one lesson with a clip, for the parent */
  M.addLesson(db, { id: L.kid1, coachId: IDS.coach, playerId: IDS.junior, date: "2026-09-12", focus: "Chipping" });
  M.addMedia(db, { lessonId: L.kid1, kind: "video", path: `${IDS.coach}/${L.kid1}/clip-k1.mp4`, createdAt: "2026-09-12T10:01:00Z" });
  /* Dara: one lesson, one clip, nothing to compare — still something to study */
  M.addLesson(db, { id: L.lone, coachId: IDS.coach, playerId: IDS.fresh, date: "2026-09-10", focus: "Full swing" });
  M.addMedia(db, { lessonId: L.lone, kind: "video", path: `${IDS.coach}/${L.lone}/clip-d.mp4`, createdAt: "2026-09-10T10:01:00Z" });
  return db;
}

const { check, results, summary } = M.checker("study");
const near = (x, y, tol) => Math.abs(x - y) <= tol;

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
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
  const vstate = (page) => page.evaluate(() => { const v = document.querySelector("video[data-study-video]"); return v ? { t: v.currentTime, paused: v.paused, rate: v.playbackRate, dur: v.duration, src: v.currentSrc || v.src } : null; });
  const setT = (page, x) => page.evaluate((x) => { const v = document.querySelector("video[data-study-video]"); if (v) { v.pause(); v.currentTime = x; } }, x);
  const untilReady = (page) => page.waitForFunction(() => { const p = document.querySelector('[data-tour="study-play"]'); return !!p && !p.disabled; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  /* every label in the row fits its button: nothing cut to an ellipsis */
  const labelsFit = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[data-tour="lesson-ways"] button span')).map((el) => ({ t: el.textContent, fits: el.scrollWidth <= el.clientWidth + 1 })));

  try {
    /* ---------- (a) the coach: three ways in one row ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.locator("button", { hasText: "Short game" }).first().click(); await page.waitForTimeout(1200);
      const markup = page.locator('[data-tour="lesson-markup"]'), compare = page.locator('[data-tour="lesson-compare"]'), study = page.locator('[data-tour="lesson-study"]');
      await shot("01-lesson-three-ways");
      check("(a) the coach's lesson page offers Study beside Mark it up and Compare", (await study.count()) === 1 && (await compare.count()) === 1 && (await markup.count()) === 1, (await text()).slice(0, 200));
      const [bm, bc, bs] = await Promise.all([markup.boundingBox(), compare.boundingBox(), study.boundingBox()]);
      const fit = await labelsFit(page);
      check("(a2) the three sit in one row at equal widths, and every word fits whole", !!bm && !!bc && !!bs && near(bm.y, bs.y, 1) && near(bm.width, bs.width, 2) && bs.x > bc.x && fit.length === 3 && fit.every((f) => f.fits), JSON.stringify({ bm, bc, bs, fit }));

      /* ---------- (b) the stage ---------- */
      await study.click(); await page.waitForTimeout(800);
      const ready = await untilReady(page);
      const s0 = await vstate(page); const t0 = await text(); await shot("02-study");
      check("(b) Study opens the clip on its own stage, titled with the player's name, the transport ready, paused at the start", ready && !!s0 && s0.paused && s0.t < 0.05 && /Study · Cian/.test(t0) && (await page.locator('[data-tour="study"]').count()) === 1, JSON.stringify(s0) + " · " + t0.slice(0, 60));
      check("(b2) no tab bar sits under the stage", (await page.locator('[aria-label="Roster"]').count()) === 0);

      /* ---------- (c) a frame either way ---------- */
      await tap(page, '[data-tour="study-fwd"]', 300); await tap(page, '[data-tour="study-fwd"]', 300);
      const s1 = await vstate(page);
      check("(c) On a frame moves the head a thirtieth, twice", !!s1 && s1.paused && near(s1.t, 2 * FRAME, FRAME / 2), JSON.stringify(s1));
      await tap(page, '[data-tour="study-back"]', 300);
      const s2 = await vstate(page);
      check("(c2) Back a frame brings it back one", !!s2 && near(s2.t, FRAME, FRAME / 2), JSON.stringify(s2));

      /* ---------- (d) the speed ---------- */
      const rate = page.locator('[data-tour="study-rate"]');
      await rate.click(); await page.waitForTimeout(200);
      const r1 = await vstate(page);
      check("(d) one tap on the speed pill is half speed, the pill filled and reading ½×", !!r1 && r1.rate === 0.5 && (await rate.getAttribute("data-rate")) === "0.5" && (await rate.innerText()).includes("½×") && (await rate.getAttribute("aria-pressed")) === "true", JSON.stringify(r1));
      await rate.click(); await page.waitForTimeout(200);
      const r2 = await vstate(page);
      check("(d2) the next is quarter speed, ¼×", !!r2 && r2.rate === 0.25 && (await rate.innerText()).includes("¼×"), JSON.stringify(r2));
      await rate.click(); await page.waitForTimeout(200);
      const r3 = await vstate(page);
      check("(d3) and the third is full speed again, the pill quiet", !!r3 && r3.rate === 1 && (await rate.getAttribute("aria-pressed")) === "false", JSON.stringify(r3));

      /* ---------- (e) the loop ---------- */
      const loop = page.locator('[data-tour="study-loop"]');
      const dur = (s0 && s0.dur) || 1;
      const A = Math.min(0.2, dur * 0.2), B = Math.min(0.6, dur * 0.6);
      check("(e0) the loop reads Loop and is off", (await loop.getAttribute("data-loop")) === "off" && /Loop/.test(await loop.innerText()));
      await setT(page, A); await page.waitForTimeout(250);
      await loop.click(); await page.waitForTimeout(200);
      check("(e) From here marks the start: the button now asks for the end", (await loop.getAttribute("data-loop")) === "from" && /To here/.test(await loop.innerText()), await loop.innerText());
      await setT(page, B); await page.waitForTimeout(250);
      await loop.click(); await page.waitForTimeout(300);
      const e1 = await vstate(page);
      check("(e2) To here closes it: the pill reads the span, filled, and the head goes back to the start", (await loop.getAttribute("data-loop")) === "on" && new RegExp(`Loop · ${(B - A).toFixed(1)}s`).test(await loop.innerText()) && !!e1 && near(e1.t, A, 0.08), `${await loop.innerText()} · ${JSON.stringify(e1)}`);
      await shot("03-study-loop");
      await tap(page, '[data-tour="study-play"]', 200);
      const samples = [];
      for (let i = 0; i < 8; i++) { await page.waitForTimeout(220); const st = await vstate(page); samples.push(st ? +st.t.toFixed(3) : null); }
      const e2 = await vstate(page);
      check("(e3) playing, the head stays between the two points and never runs past the end", !!e2 && !e2.paused && samples.every((x) => x != null && x >= A - 0.08 && x <= B + 0.15), JSON.stringify({ samples, A, B }));
      await loop.click(); await page.waitForTimeout(200);
      check("(e4) a third tap clears the loop", (await loop.getAttribute("data-loop")) === "off" && /^Loop$/.test((await loop.innerText()).trim()), await loop.innerText());
      await tap(page, '[data-tour="study-play"]', 200);

      /* ---------- (f) Back ---------- */
      await M.back(page); await page.waitForTimeout(900);
      check("(f) Back returns to the lesson page, Study still there", (await page.locator('[data-tour="lesson-study"]').count()) === 1 && (await page.locator('[data-tour="study"]').count()) === 0, (await text()).slice(0, 120));

      /* ---------- (g) a photo alone offers nothing ---------- */
      await M.back(page); await page.waitForTimeout(900);
      await page.locator("button", { hasText: "Driving" }).first().click(); await page.waitForTimeout(1200);
      check("(g) a lesson with a photo and no clip offers no Study, no Compare, no Mark it up", (await page.locator('[data-tour="lesson-study"]').count()) === 0 && (await page.locator('[data-tour="lesson-ways"]').count()) === 0, (await text()).slice(0, 120));
      await ctx.close();
    }

    /* ---------- (h) the player ---------- */
    {
      const { ctx, page, text } = await boot("adult");
      await tap(page, '[data-tour="feed-open"]', 1200);
      check("(h) the player has Study beside Compare, and no Mark it up", (await page.locator('[data-tour="lesson-study"]').count()) === 1 && (await page.locator('[data-tour="lesson-compare"]').count()) === 1 && (await page.locator('[data-tour="lesson-markup"]').count()) === 0, (await text()).slice(0, 160));
      await tap(page, '[data-tour="lesson-study"]', 900);
      const ready = await untilReady(page); const tx = await text();
      check("(h2) their own Study is titled Study and no name, and plays", ready && /^Study\b/.test(tx.trim()) && !/Study · /.test(tx), tx.slice(0, 60));
      await ctx.close();
    }

    /* ---------- (i) a parent on the child's lesson ---------- */
    {
      const { ctx, page, text } = await boot("parent");
      await tap(page, '[aria-label="Lessons"]', 900);
      await tap(page, '[data-tour="feed-open"]', 1200);
      const has = (await page.locator('[data-tour="lesson-study"]').count()) === 1;
      check("(i) a parent has Study on the child's lesson", has, (await text()).slice(0, 160));
      if (has) {
        await tap(page, '[data-tour="lesson-study"]', 900);
        await untilReady(page);
        check("(i2) the title names the child", /Study · Saoirse/.test(await text()), (await text()).slice(0, 80));
      }
      await ctx.close();
    }

    /* ---------- (j) one clip, nothing to compare, still something to study ---------- */
    {
      const { ctx, page, text } = await boot("fresh");
      await tap(page, '[data-tour="feed-open"]', 1200);
      check("(j) a player with one clip and nothing to set it beside has Study and no Compare", (await page.locator('[data-tour="lesson-study"]').count()) === 1 && (await page.locator('[data-tour="lesson-compare"]').count()) === 0, (await text()).slice(0, 160));
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
