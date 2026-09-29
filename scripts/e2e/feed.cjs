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
const L = { one: "10000000-0000-4000-8000-0000000fe001", two: "10000000-0000-4000-8000-0000000fe002", five: "10000000-0000-4000-8000-0000000fe005" };
const FIVE = "Full swing · Chipping · Bunker play · Course management · Mental game";
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
  /* the oldest: five areas worked on in one lesson */
  M.addLesson(db, { id: L.five, coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: FIVE });
  M.addMedia(db, { lessonId: L.five, kind: "video", path: `${IDS.coach}/${L.five}/clip-5.mp4` });
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
        (await page.locator("[data-feed-card]").count()) === 3, `cards=${await page.locator("[data-feed-card]").count()} · ${t0.slice(0, 160)}`);

      /* the real file, not the drawn field. GeneratedField is the
         harness's; a real account seeing it means the clip did not load */
      const vids = page.locator("[data-feed-card] video");
      const srcs = await vids.evaluateAll((els) => els.map((v) => v.currentSrc || v.src || ""));
      check("(a) the first card plays the coach's own file", srcs.length > 0 && srcs.some((s) => /object\/sign|blob:|http/.test(s)), JSON.stringify(srcs).slice(0, 220));
      check("(a) a real account is never shown the harness's drawn field",
        (await page.locator("[data-feed-card] svg[data-generated-field]").count()) === 0 && !/GeneratedField/.test(t0), t0.slice(0, 120));

      /* the panel: what the lesson was */
      check("(a) the panel names the focus and the day, and not the coach — a player has one", t0.includes("Short game") && /18 SEP|SEP/i.test(t0) && !t0.includes("Niamh Byrne"), t0.slice(0, 240));
      /* five areas in one lesson read whole, on at most two lines, none cut mid-word */
      await page.locator("[data-feed-card]").nth(2).scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
      const five = await page.locator('[data-feed-card="2"] [data-tour="feed-focus"]').evaluate((el) => { const cs = getComputedStyle(el); return { text: el.innerText.replace(/\s+/g, " "), lines: Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight)), size: parseFloat(cs.fontSize), cutDown: el.scrollHeight > el.clientHeight + 2, cutAcross: el.scrollWidth > el.clientWidth + 1 }; });
      check("(a) five areas worked on read whole — every word there, on two lines, at a smaller size, nothing cut down or across", ["Full swing", "Chipping", "Bunker play", "Course management", "Mental game"].every((w) => five.text.includes(w)) && five.lines === 2 && five.size < 27 && !five.cutDown && !five.cutAcross, JSON.stringify(five));
      /* the dots between areas sit on the same line as the word after them: a line never ends on a dot */
      const seps = await page.locator('[data-feed-card="2"] [data-tour="feed-focus"] [data-sep]').evaluateAll((els) => els.map((d) => { const w = d.parentElement.getBoundingClientRect(); const r = d.getBoundingClientRect(); return Math.abs(r.top - w.top) < 1.5 && r.right < w.right; }));
      check("(a) every dot between areas rides with the word after it, never left at the end of a line", seps.length === 4 && seps.every(Boolean), JSON.stringify(seps));
      await page.screenshot({ path: path.join(outDir, "00-feed-five-areas.png") });
      await page.locator("[data-feed-card]").nth(0).scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
      check("(a) and the level it was logged at", t0.includes("HI 18.4"), t0.slice(0, 240));
      check("(a) a long note offers a way to open it out", t0.includes("more") && (await byText(page, "more").count()) === 1, t0.slice(0, 260));

      /* the right-hand column */
      const sndBtn = page.locator('[data-feed-card] [aria-label="Sound"], [data-feed-card] [aria-label="Mute"]');
      check("(a) the column offers a sound button on a video", (await sndBtn.count()) >= 1, `sound=${await sndBtn.count()}`);
      check("(a) and an open button", (await page.locator('[data-tour="feed-open"]').count()) >= 1, "no open button");
      check("(a) no coach's face on the card, and the way in says View lesson", (await page.locator('[data-feed-card] [aria-label="Niamh Byrne"]').count()) === 0 && (await page.locator('[data-feed-card] button[data-tour="feed-open"]', { hasText: "View lesson" }).count()) >= 1, "coach avatar present or no View lesson");
      check("(a) the header's controls ride on the feed", (await page.locator('[data-tour="feed-header"] [aria-label="Alerts"]').count()) === 1 && (await page.locator('[data-tour="feed-header"] [aria-label="Search"]').count()) === 1 && (await page.locator('[data-tour="feed-header"] [aria-label="Your profile"]').count()) === 1, "");

      /* two files on one lesson: the dots, and a second frame to swipe to */
      check("(a) two files on a lesson are two segments of the strip, counted", (await page.locator('[data-tour="feed-strip"][aria-label*="of 2"]').count()) >= 1, "no frame counter");

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
      /* the sound on and ½× on, then into the lesson and back: both kept */
      await page.locator('[data-feed-card="0"] [aria-label="Sound"]').click(); await page.waitForTimeout(400);
      await page.locator('[data-feed-card="0"] [aria-label="Slow motion"]').click(); await page.waitForTimeout(400);
      await tap(page, '[data-tour="feed-open"]', 1400);
      const t0 = await text(); await shot("04-lesson-from-feed");
      check("(c) the open button lands on that lesson", t0.includes("Short game") && t0.includes("Download"), t0.slice(0, 220));
      await M.back(page); await page.waitForTimeout(1500);
      const kept = await page.locator('[data-feed-card="0"] video').evaluate((v) => ({ muted: v.muted, rate: v.playbackRate, paused: v.paused }));
      check("(c) back on the feed the sound is still on and ½× still set — the feed remembers for the sitting", kept.muted === false && kept.rate === 0.5 && !kept.paused && (await page.locator('[data-feed-card="0"] [aria-label="Mute"]').count()) === 1 && (await page.locator('[data-feed-card="0"] [aria-label="Normal speed"]').count()) === 1, JSON.stringify(kept));
      await page.locator('[data-feed-card="0"] [aria-label="Normal speed"]').click(); await page.locator('[data-feed-card="0"] [aria-label="Mute"]').click(); await page.waitForTimeout(300);

      await tap(page, 'button[aria-label="List"]', 1200);
      const t1 = await text(); await shot("05-list");
      check("(c) the list view shows every lesson as a row", t1.includes("Short game") && t1.includes("Putting") && (await page.locator("[data-feed-card]").count()) === 0, t1.slice(0, 220));
      check("(c) there is no third view to choose between", !/Cards/.test(t1), t1.slice(0, 200));
      await tap(page, 'button[aria-label="Feed"]', 1400);
      check("(c) and back to the feed", (await page.locator("[data-feed-card]").count()) === 3, "feed did not come back");
      await ctx.close();
    }

    /* ---------- (e) one clip plays: a scroll moves the sound, never adds to it ---------- */
    {
      const { ctx, page, shot } = await boot("adult");
      await tap(page, '[aria-label="Home"], [aria-label="Lessons"]', 1600); await page.waitForTimeout(1200);
      const vids = page.locator("[data-feed-card] video");
      const state = () => vids.evaluateAll((els) => els.map((v) => ({ paused: v.paused, muted: v.muted, t: +v.currentTime.toFixed(2), d: +(v.duration || 0).toFixed(2), rate: v.playbackRate, fit: getComputedStyle(v).objectFit })));
      const card = (i) => page.locator("[data-feed-card]").nth(i);
      await page.locator('[data-feed-card] [aria-label="Sound"]').first().click(); await page.waitForTimeout(900);
      const s0 = await state();
      check("(e) with the sound on, the first clip plays with sound and the next waits silent on its first frame", s0.length >= 2 && !s0[0].paused && !s0[0].muted && s0[1].paused && s0[1].muted && s0[1].t === 0, JSON.stringify(s0));
      await card(1).scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
      const s1 = await state();
      check("(e) a scroll to the next lesson stops the first clip and plays the second with the sound — one clip at a time", s1.filter((v) => !v.paused).length === 1 && !s1[1].paused && !s1[1].muted && s1[0].paused && s1[0].muted && s1[0].t === 0, JSON.stringify(s1));
      await card(0).scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
      const s2 = await state();
      check("(e) scrolling back plays the first again, from its start, and the second falls silent", s2.filter((v) => !v.paused).length === 1 && !s2[0].paused && !s2[0].muted && s2[1].paused && s2[1].muted && s2[1].t === 0, JSON.stringify(s2));

      /* ---------- (f) the picture is the pause button ---------- */
      const pauseBtn = page.locator('[data-feed-card="0"] [aria-label="Pause"]');
      check("(f) the picture is the pause button while the clip plays", (await pauseBtn.count()) === 1);
      await pauseBtn.click(); await page.waitForTimeout(450);
      const p0 = (await state())[0];
      check("(f) a tap on the picture pauses the clip and shows Play", p0.paused && (await page.locator('[data-feed-card="0"] [aria-label="Play"]').count()) === 1, JSON.stringify(p0));
      await shot("07-feed-paused");
      await page.locator('[data-feed-card="0"] [aria-label="Play"]').click(); await page.waitForTimeout(600);
      check("(f) and a tap resumes it", !(await state())[0].paused && (await pauseBtn.count()) === 1);

      /* ---------- (g) half speed, and it stays on ---------- */
      await page.locator('[data-feed-card="0"] [aria-label="Slow motion"]').click(); await page.waitForTimeout(400);
      check("(g) ½× halves the speed and the button reads Normal speed", (await state())[0].rate === 0.5 && (await page.locator('[data-feed-card="0"] [aria-label="Normal speed"]').count()) === 1, JSON.stringify(await state()));
      await card(1).scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
      check("(g) and it stays on for the next clip", (await state())[1].rate === 0.5 && (await page.locator('[data-feed-card="1"] [aria-label="Normal speed"]').count()) === 1, JSON.stringify(await state()));
      await shot("08-feed-slow");
      await page.locator('[data-feed-card="1"] [aria-label="Normal speed"]').click(); await page.waitForTimeout(300);
      await card(0).scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
      check("(g) Normal speed puts it back", (await state())[0].rate === 1);

      /* ---------- (h) the strip: which file, how far, and where to scrub ---------- */
      const strip0 = page.locator('[data-feed-card="0"] [data-tour="feed-strip"]');
      check("(h) the first lesson's strip is two segments for its two files, and there are no dots", (await strip0.locator(":scope > span").count()) === 2 && /1 of 2/.test(await strip0.getAttribute("aria-label") || ""), await strip0.getAttribute("aria-label"));
      const sb = await strip0.boundingBox(); const y = sb.y + sb.height / 2;
      await page.mouse.move(sb.x + sb.width * 0.25, y); await page.mouse.down(); await page.waitForTimeout(200);
      await page.mouse.move(sb.x + sb.width * 0.35, y, { steps: 5 }); await page.waitForTimeout(300);
      const mid = (await state())[0]; const pill = page.locator('[data-tour="feed-scrub-time"]');
      const where = mid.d ? mid.t / mid.d : -1;
      check("(h) a thumb on the playing segment holds the clip and scrubs it, the time on a pill above", mid.paused && (await pill.count()) === 1 && where > 0.58 && where < 0.82 && /\d:\d\d · \d:\d\d/.test(await pill.innerText()), `${JSON.stringify(mid)} · at ${where.toFixed(2)}`);
      await shot("09-feed-scrub");
      await page.mouse.up(); await page.waitForTimeout(500);
      check("(h) letting go plays on from there, the pill gone", !(await state())[0].paused && (await pill.count()) === 0, JSON.stringify(await state()));
      await page.mouse.click(sb.x + sb.width * 0.75, y); await page.waitForTimeout(700);
      check("(h) a tap on the other segment goes to that file, and the clip behind it stops", /2 of 2/.test(await strip0.getAttribute("aria-label") || "") && (await state())[0].paused, `${await strip0.getAttribute("aria-label")} · ${JSON.stringify(await state())}`);
      await page.mouse.click(sb.x + sb.width * 0.25, y); await page.waitForTimeout(700);

      /* ---------- (i) every clip fills the screen, landscape too ---------- */
      const fit = await page.evaluate(() => new Promise((res) => {
        const v = document.querySelector('[data-feed-card="0"] video');
        const before = getComputedStyle(v).objectFit;
        Object.defineProperty(v, "videoWidth", { get: () => 1280, configurable: true });
        Object.defineProperty(v, "videoHeight", { get: () => 720, configurable: true });
        v.dispatchEvent(new Event("loadedmetadata"));
        setTimeout(() => res({ before, after: getComputedStyle(v).objectFit, pos: getComputedStyle(v).objectPosition }), 300);
      }));
      check("(i) a portrait clip fills the screen, and so does a landscape one — the lesson page is where it takes its own shape", fit.before === "cover" && fit.after === "cover", JSON.stringify(fit));

      /* ---------- (j) leaving the app stops the clip and lets it go ---------- */
      const setVis = (v) => page.evaluate((v) => { Object.defineProperty(document, "visibilityState", { get: () => v, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }, v);
      const before = (await state())[0];
      await setVis("hidden"); await page.waitForTimeout(400);
      const away = await page.evaluate(() => [...document.querySelectorAll("video[data-feed-video]")].map((v) => ({ paused: v.paused, muted: v.muted, src: v.getAttribute("src") })));
      check("(j) putting the app away stops the clip: paused, muted, and its source let go so nothing offers to play it on", !before.paused && away.every((v) => v.paused && v.muted && !v.src), JSON.stringify(away));
      await setVis("visible"); await page.waitForTimeout(1500);
      const back = (await state())[0]; const srcBack = await page.evaluate(() => !!document.querySelector('[data-feed-card="0"] video').getAttribute("src"));
      check("(j) coming back, the card on screen picks its clip up again", srcBack && !back.paused, JSON.stringify(back));
      await ctx.close();
    }

    /* ---------- (k) a star on a lesson, and the Starred section ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Home"], [aria-label="Lessons"]', 1600); await page.waitForTimeout(1000);
      const starBtn = page.locator('[data-feed-card="0"] [data-tour="feed-star"]');
      check("(k) the card carries a Star beside View lesson, unpressed", (await starBtn.count()) === 1 && (await starBtn.getAttribute("aria-pressed")) === "false" && (await starBtn.getAttribute("aria-label")) === "Star");
      await starBtn.click(); await page.waitForTimeout(800);
      const pref = db.prefs[IDS.adult];
      check("(k) a tap stars it: the button reads Starred, and the lesson id is on the person's own preferences row", (await starBtn.getAttribute("aria-pressed")) === "true" && (await starBtn.getAttribute("aria-label")) === "Starred" && !!pref && Array.isArray(pref.starred) && pref.starred.includes(L.one), JSON.stringify(pref && pref.starred));
      await shot("10-feed-starred");
      await tap(page, 'button[aria-label="List"]', 1200);
      const t0 = (await text()).replace(/\s+/g, " ");
      check("(k) the list carries a Starred row with the count, above the lessons", (await page.locator('[data-tour="log-starred"]').count()) === 1 && /Starred 1/.test(t0), t0.slice(0, 200));
      check("(k) and the starred lesson's row carries the star", (await page.locator('[data-tour="log-row"] [aria-label="Starred"]').count()) === 1);
      await tap(page, '[data-tour="log-starred"]', 1200);
      const t1 = await text(); await shot("11-starred");
      check("(k) Starred lists that lesson alone, under its own title", /Starred/.test(t1) && t1.includes("Short game") && !t1.includes("Putting"), t1.slice(0, 200));
      await page.locator(".nsc-list button", { hasText: "Short game" }).first().click(); await page.waitForTimeout(1200);
      const pageStar = page.locator('[data-tour="lesson-star"]');
      check("(k) the lesson page's header carries the star, pressed", (await pageStar.count()) === 1 && (await pageStar.getAttribute("aria-pressed")) === "true");
      await pageStar.click(); await page.waitForTimeout(700);
      check("(k) a tap there unstars it, on the preferences row too", (await pageStar.getAttribute("aria-pressed")) === "false" && !((db.prefs[IDS.adult] || {}).starred || []).includes(L.one), JSON.stringify((db.prefs[IDS.adult] || {}).starred));
      await M.back(page); await page.waitForTimeout(900); await M.back(page); await page.waitForTimeout(900);
      check("(k) with nothing starred the Starred row is gone and the list is whole", (await page.locator('[data-tour="log-starred"]').count()) === 0 && (await page.locator('[data-tour="log-row"]').count()) === 1, (await text()).slice(0, 160));
      await ctx.close();
    }

    /* ---------- (l) a coach stars from the lesson page; the home says so ---------- */
    {
      const { ctx, page, text } = await boot("coach");
      check("(l) a coach with nothing starred has no Starred row on the home", (await page.locator('[data-tour="today-starred"]').count()) === 0);
      await tap(page, '[data-tour="today-archive"]', 1200);
      await page.locator(".nsc-list button", { hasText: "Putting" }).first().click(); await page.waitForTimeout(1200);
      await page.locator('[data-tour="lesson-star"]').click(); await page.waitForTimeout(700);
      check("(l) the coach's star lands on the coach's own preferences, never the player's", ((db.prefs[IDS.coach] || {}).starred || []).includes(L.two) && !((db.prefs[IDS.adult] || {}).starred || []).includes(L.two), JSON.stringify((db.prefs[IDS.coach] || {}).starred));
      await M.back(page); await page.waitForTimeout(800); await M.back(page); await page.waitForTimeout(800);
      const home = (await text()).replace(/\s+/g, " ");
      check("(l) the home carries a Starred row under All lessons, with the count", (await page.locator('[data-tour="today-starred"]').count()) === 1 && /Starred 1/.test(home), home.slice(0, 200));
      await tap(page, '[data-tour="today-starred"]', 1200);
      const t2 = await text();
      check("(l) Starred shows the putting lesson with the player's name, and not the other", t2.includes("Putting") && t2.includes("Cian Murphy") && !t2.includes("Short game"), t2.slice(0, 200));
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
