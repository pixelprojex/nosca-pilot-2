/* THE FEED. What a player opens Lessons to see: their coach's clips,
   full bleed, one lesson a screen. This suite proves the real files are
   what is played — not the harness's drawn field — that the panel says
   what the lesson was, that the right-hand column works, that the next
   lesson is a scroll away, and that a player with nothing yet is told
   so rather than shown a black screen.
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
  const { tap, byText } = M;

  try {
    /* ---------- (a) the feed is what Lessons opens on ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Home"], [aria-label="Lessons"]', 1600);
      await page.waitForTimeout(1200);
      const t0 = await text(); await shot("01-feed");
      check("(a) Lessons opens on the feed, one card a lesson",
        (await page.locator("[data-feed-card]").count()) === 2, `cards=${await page.locator("[data-feed-card]").count()} · ${t0.slice(0, 160)}`);

      /* the real file, not the drawn field. GeneratedField is the
         harness's; a real account seeing it means the clip did not load */
      const vids = page.locator("[data-feed-card] video");
      const srcs = await vids.evaluateAll((els) => els.map((v) => v.currentSrc || v.src || ""));
      check("(a) the first card plays the coach's own file", srcs.length > 0 && srcs.some((s) => /object\/sign|blob:|http/.test(s)), JSON.stringify(srcs).slice(0, 220));
      check("(a) a real account is never shown the harness's drawn field",
        (await page.locator("[data-feed-card] svg[data-generated-field]").count()) === 0 && !/GeneratedField/.test(t0), t0.slice(0, 120));

      /* the panel: what the lesson was */
      check("(a) the panel names the focus, the day and the coach", t0.includes("Short game") && /18 SEP|SEP/i.test(t0) && t0.includes("Niamh Byrne"), t0.slice(0, 240));
      check("(a) and the level it was logged at", t0.includes("HI 18.4"), t0.slice(0, 240));
      check("(a) a long note offers a way to open it out", t0.includes("more") && (await byText(page, "more").count()) === 1, t0.slice(0, 260));

      /* the right-hand column */
      const sndBtn = page.locator('[data-feed-card] [aria-label="Sound"], [data-feed-card] [aria-label="Mute"]');
      check("(a) the column offers a sound button on a video", (await sndBtn.count()) >= 1, `sound=${await sndBtn.count()}`);
      check("(a) and an open button", (await page.locator('[data-tour="feed-open"]').count()) >= 1, "no open button");
      check("(a) no coach's face on the card, and the way in says View lesson", (await page.locator('[data-feed-card] [aria-label="Niamh Byrne"]').count()) === 0 && (await page.locator('[data-feed-card] button[data-tour="feed-open"]', { hasText: "View lesson" }).count()) >= 1, "coach avatar present or no View lesson");
      check("(a) the header's controls ride on the feed", (await page.locator('[data-tour="feed-header"] [aria-label="Alerts"]').count()) === 1 && (await page.locator('[data-tour="feed-header"] [aria-label="Search"]').count()) === 1 && (await page.locator('[data-tour="feed-header"] [aria-label="Your profile"]').count()) === 1, "");

      /* two files on one lesson: the dots, and a second frame to swipe to */
      check("(a) two files on a lesson are two dots", (await page.locator('[aria-label*="of 2"], [aria-label*=" of "]').count()) >= 1, "no frame counter");

      /* the note opens out */
      await byText(page, "more").first().click(); await page.waitForTimeout(500);
      const t1 = await text(); await shot("02-feed-note-open");
      check("(a) tapping more shows the whole note", t1.includes(LONG.slice(0, 60)) && t1.includes("less"), t1.slice(0, 260));

      /* sound is off until asked — autoplay only works muted */
      const muted = await vids.first().evaluate((v) => v.muted);
      check("(a) it starts muted, which is the only way it plays by itself", muted === true, String(muted));
      await page.locator('[data-feed-card] [aria-label="Sound"]').first().click(); await page.waitForTimeout(600);
      const unmuted = await vids.first().evaluate((v) => v.muted);
      const nowMute = await page.locator('[data-feed-card] [aria-label="Mute"]').count();
      check("(a) and the sound button turns it on", unmuted === false && nowMute >= 1, `muted=${unmuted} · mute buttons=${nowMute}`);
      await ctx.close();
    }

    /* ---------- (b) the next lesson is a scroll away ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Home"], [aria-label="Lessons"]', 1600); await page.waitForTimeout(1000);
      await page.locator("[data-feed-card]").nth(1).scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
      const t0 = await text(); await shot("03-feed-second");
      check("(b) scrolling on reaches the older lesson", t0.includes("Putting") && t0.includes("Pace first."), t0.slice(0, 200));
      /* both cards live in the one scroller, so the count is scoped to
         the card being looked at rather than the whole page */
      const moreOnSecond = await page.locator('[data-feed-card="1"]').getByText("more", { exact: true }).count();
      check("(b) a short note is not given a 'more' it does not need", moreOnSecond === 0, `more on card 2 = ${moreOnSecond}`);
      await ctx.close();
    }

    /* ---------- (c) the open button, and the two views ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Home"], [aria-label="Lessons"]', 1600); await page.waitForTimeout(1000);
      await tap(page, '[data-tour="feed-open"]', 1400);
      const t0 = await text(); await shot("04-lesson-from-feed");
      check("(c) the open button lands on that lesson", t0.includes("Short game") && t0.includes("Download"), t0.slice(0, 220));
      await M.back(page); await page.waitForTimeout(1000);

      await tap(page, 'button[aria-label="List"]', 1200);
      const t1 = await text(); await shot("05-list");
      check("(c) the list view shows every lesson as a row", t1.includes("Short game") && t1.includes("Putting") && (await page.locator("[data-feed-card]").count()) === 0, t1.slice(0, 220));
      check("(c) there is no third view to choose between", !/Cards/.test(t1), t1.slice(0, 200));
      await tap(page, 'button[aria-label="Feed"]', 1400);
      check("(c) and back to the feed", (await page.locator("[data-feed-card]").count()) === 2, "feed did not come back");
      await ctx.close();
    }

    /* ---------- (d) nothing logged yet ---------- */
    {
      const { ctx, page, text, shot } = await boot("fresh");
      await tap(page, '[aria-label="Home"], [aria-label="Lessons"]', 1400);
      const t0 = await text(); await shot("06-empty");
      check("(d) a player with no lessons is told so, not shown a black screen",
        t0.includes("No lessons yet") && (await page.locator("[data-feed-card]").count()) === 0, t0.slice(0, 200));
      check("(d) and is offered no view switch to use on nothing", !/Feed/.test(t0) && !/List/.test(t0), t0.slice(0, 200));
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
