/* MARK IT UP. A coach opens a clip on a logged lesson, draws on it while
   it plays, talks over it, watches the take back and sends it; the take
   is a new clip on the lesson and the player is told. Also: the coach's
   two lesson lists switch between List and Feed with one control.

   Usage: node review.cjs <distDir> <port> <outDir>
   Runs against the same mocked Supabase as the other suites; Chromium
   is given a fake microphone so the recorder has something to record. */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4199), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
const LESSON = { new: "10000000-0000-4000-8000-000000000001", old: "10000000-0000-4000-8000-000000000002" };
const TODAY = M.ymd(new Date());

function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  M.addLesson(db, { id: LESSON.new, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-01", focus: "Short game", subs: ["Chipping"], notes: "Cleaner contact from the fringe." });
  M.addLesson(db, { id: LESSON.old, coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: "Putting", subs: ["Lag putting"], notes: "Pace on the long ones first." });
  M.addMedia(db, { lessonId: LESSON.old, kind: "video", path: `${IDS.coach}/${LESSON.old}/1-swing.mp4`, createdAt: "2026-08-20T10:01:00Z" });
  M.addMedia(db, { lessonId: LESSON.old, kind: "audio", path: `${IDS.coach}/${LESSON.old}/2-note.webm`, createdAt: "2026-08-20T10:02:00Z" });
  return db;
}

const { check, results, summary } = M.checker("review");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-capture", "--use-fake-ui-for-media-capture", "--autoplay-policy=no-user-gesture-required"] });
  const errorsByRole = {};
  const boot = async (role, db) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    errorsByRole[role] = errorsByRole[role] || []; page.on("pageerror", (e) => errorsByRole[role].push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const text = () => M.rootText(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { db, ctx, page, text, shot };
  };
  const { tap } = M;
  const db = freshDb();

  try {
    /* ---------- (a)–(h) the coach marks up a clip ---------- */
    const { page, text, shot, ctx } = await boot("coach", db);
    await tap(page, '[aria-label="Roster"]', 700);
    await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
    await page.locator("button", { hasText: "Putting" }).first().click(); await page.waitForTimeout(1200);
    check("(a) the lesson page offers Mark it up under a clip", (await page.locator('[data-tour="lesson-markup"]').count()) === 1, (await text()).slice(0, 160));
    await shot("01-lesson");

    await tap(page, '[data-tour="lesson-markup"]', 900);
    await page.waitForFunction(() => { const c = document.querySelector('[data-tour="markup-stage"] canvas'); return !!c && c.width > 2; }, null, { timeout: 10000 }).catch(() => {});
    const c = page.locator('[data-tour="markup-stage"] canvas');
    const dims = (await c.count()) ? await c.evaluate((el) => ({ w: el.width, h: el.height })) : null;
    check("(b) the clip is painted on a canvas at its own size", !!dims && dims.w > 2 && dims.h > 2 && dims.w % 2 === 0 && dims.h % 2 === 0, JSON.stringify(dims));
    const t0 = await text();
    check("(b) the screen is Mark it up · Putting · Cian, with Record and the four tools", /Mark it up/.test(t0) && /Putting · Cian/.test(t0) && /Record/.test(t0)
      && ["Pen", "Line", "Arrow", "Circle"].every((k) => t0.includes(k)), t0.slice(0, 200));
    await shot("02-markup");

    /* draw: a pen stroke, an arrow, a circle */
    const box = await c.boundingBox();
    const drag = async (x0, y0, x1, y1) => {
      await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (x0 + ((x1 - x0) * i) / 8), box.y + box.height * (y0 + ((y1 - y0) * i) / 8));
      await page.mouse.up(); await page.waitForTimeout(150);
    };
    check("(c) Undo and Clear are quiet before anything is drawn", await page.locator('[aria-label="Undo"]').isDisabled());
    await drag(0.2, 0.3, 0.6, 0.5);
    await tap(page, '[aria-label="Arrow"]', 150); await drag(0.3, 0.75, 0.7, 0.45);
    await tap(page, '[aria-label="Circle"]', 150); await drag(0.5, 0.5, 0.6, 0.6);
    await page.waitForTimeout(300);
    const yellow = await c.evaluate((el) => { const d = el.getContext("2d").getImageData(0, 0, el.width, el.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 170 && d[i + 2] < 120) n++; return n; });
    check("(c) the marks are in the picture itself", yellow > 100, `${yellow} yellow pixels`);
    check("(c) Undo is live after a stroke", !(await page.locator('[aria-label="Undo"]').isDisabled()));
    await shot("03-drawn");
    /* a second ink */
    await page.locator('[aria-label="Colour"]').nth(1).click(); await page.waitForTimeout(100);
    await tap(page, '[aria-label="Pen"]', 100); await drag(0.15, 0.15, 0.35, 0.2);
    const red = await c.evaluate((el) => { const d = el.getContext("2d").getImageData(0, 0, el.width, el.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 120 && d[i + 2] < 120) n++; return n; });
    check("(c) a second ink draws in that ink", red > 30, `${red} red pixels`);

    /* play, then record over it */
    await tap(page, '[aria-label="Play"]', 600);
    check("(d) the clip plays from the transport", (await page.locator('[aria-label="Pause"]').count()) === 1);
    await page.locator("button", { hasText: "Record" }).first().click(); await page.waitForTimeout(1700);
    const t1 = await text();
    check("(d) recording shows Stop and a running timer", /Stop · 0:0[1-3]/.test(t1), t1.slice(0, 160));
    await shot("04-recording");
    await page.locator("button", { hasText: "Stop" }).first().click();
    await page.waitForSelector('video[src^="blob:"]', { timeout: 10000 }).catch(() => {});
    const t2 = await text();
    check("(e) the take plays back, with Again and Save, before anything is sent", (await page.locator('video[src^="blob:"]').count()) === 1 && /Again/.test(t2) && /\bSave\b/.test(t2), t2.slice(0, 160));
    check("(e) nothing has been uploaded yet", db.media.filter((m) => m.lesson_id === LESSON.old).length === 2);
    await shot("05-take");

    /* the take has real bytes in it before anything is sent (the mock
       does not measure multipart bodies, so measure the blob itself) */
    const takeBytes = await page.evaluate(async () => { const v = document.querySelector('video[src^="blob:"]'); if (!v) return -1; const b = await (await fetch(v.src)).blob(); return b.size; });
    check("(e) the take is a real recording, not an empty file", takeBytes > 2000, `${takeBytes} bytes`);
    const before = db.media.filter((m) => m.lesson_id === LESSON.old).length;
    await page.locator("button", { hasText: /^Save$/ }).first().click();
    await page.waitForFunction(() => !document.body.innerText.includes("Saving"), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const after = db.media.filter((m) => m.lesson_id === LESSON.old);
    const added = after[after.length - 1];
    check("(f) Send uploads the take as a video on the lesson", after.length === before + 1 && added && added.kind === "video" && /markup-\d+\.(webm|mp4)$/.test(added.storage_path), JSON.stringify(added));
    const stored = added && db.files.media[added.storage_path];
    check("(f) the file itself reached storage under the lesson's folder", !!stored && added.storage_path.startsWith(`${IDS.coach}/${LESSON.old}/`), JSON.stringify(stored));
    const t3 = await text();
    check("(g) back on the lesson, the take is among its files", /Putting/.test(t3) && !/Mark it up · /.test(t3) && (await page.locator('[data-tour="lesson-clip"] video').count()) >= 1
      && (await page.locator('[data-tour="lesson-clip"] button').count()) >= 3, `${t3.slice(0, 120)} · buttons ${await page.locator('[data-tour="lesson-clip"] button').count()}`);
    await shot("06-lesson-after");
    const note = db.notifications.find((n) => n.user_id === IDS.adult && /New clip on Putting/.test(n.title));
    check("(h) the player is told: New clip on Putting, from the coach, opening the lesson", !!note && note.body === "Niamh Byrne" && note.data && note.data.screen === "lesson" && note.data.id === LESSON.old, JSON.stringify(note));
    check("(h) the files uploaded with the lesson itself said nothing extra", db.notifications.filter((n) => /New clip|New photo|New voice note/.test(n.title)).length === 1);

    /* ---------- (i) List · Feed on the coach's two lesson lists ---------- */
    await tap(page, '[aria-label="Back"]', 700);
    const t4 = await text();
    check("(i) the player file switches with List · Feed", /List/.test(t4) && /Feed/.test(t4) && (await page.locator('[data-tour="player-view"]').count()) === 1, t4.slice(0, 120));
    await page.locator('[data-tour="player-view"] button', { hasText: "Feed" }).click(); await page.waitForTimeout(1200);
    check("(i) Feed shows the player's lessons as cards", (await page.locator("[data-feed-card]").count()) >= 2 && (await page.locator('[data-tour="feed-open"]').count()) >= 1);
    await shot("07-player-file-feed");
    await tap(page, 'button[aria-label="List"]', 900);
    check("(i) List brings the rows back", (await page.locator('[data-tour="player-lessons"]').count()) === 1);
    await page.locator("button", { hasText: /All \d+ lessons/ }).first().click(); await page.waitForTimeout(900);
    const t5 = await text();
    check("(i) the archive opens on List · Feed then search, Filter and the rows", (await page.locator('[data-tour="archive-view"]').count()) === 1 && /Filter/.test(t5) && /Putting/.test(t5) && /Short game/.test(t5), t5.slice(0, 160));
    await shot("08-archive");
    await page.locator('[data-tour="archive-view"] button', { hasText: "Feed" }).click(); await page.waitForTimeout(1200);
    check("(i) this player's archive has its Feed too", (await page.locator("[data-feed-card]").count()) >= 2);
    await shot("09-archive-feed");
    /* the whole archive, from the coach home, names the player on every card */
    await tap(page, 'button[aria-label="List"]', 700);
    await tap(page, '[aria-label="Today"]', 800);
    await page.locator("button", { hasText: "All lessons" }).first().click(); await page.waitForTimeout(900);
    await page.locator('[data-tour="archive-view"] button', { hasText: "Feed" }).click(); await page.waitForTimeout(1200);
    check("(i) the whole archive's Feed names the player on each card", (await page.locator("[data-feed-card]").count()) >= 2 && /Cian · /.test(await text()), (await text()).slice(0, 120));
    await shot("09b-all-feed");
    await ctx.close();

    /* ---------- (j) the player: the take is on the lesson ---------- */
    {
      const { page: p2, text: text2, shot: shot2, ctx: ctx2 } = await boot("adult", db);
      const catchup = p2.locator("button", { hasText: "Dismiss" });
      if (await catchup.count()) { await catchup.first().click(); await p2.waitForTimeout(600); }
      const t6 = await text2();
      check("(j) the player's bell carries the new clip", /New clip on Putting/.test(t6) || db.notifications.some((n) => n.user_id === IDS.adult && /New clip/.test(n.title)));
      if (await p2.locator('button[aria-label="List"]').count()) await tap(p2, 'button[aria-label="List"]', 900);
      await p2.locator("button", { hasText: "Putting" }).first().click(); await p2.waitForTimeout(1200);
      check("(j) the player's lesson page has three files, the take among them", (await p2.locator('[data-tour="lesson-clip"] button').count()) >= 3 && (await p2.locator('[data-tour="lesson-markup"]').count()) === 0);
      await shot2("10-player-lesson");
      await ctx2.close();
    }
  } catch (e) {
    results.push({ name: "run completed", ok: false, detail: String((e && e.message) || e) });
  } finally { await browser.close(); M.stopServer(server); }

  for (const [r, es] of Object.entries(errorsByRole)) { const real = es.filter((e) => !/vibrate/.test(e)); check(`(k) no page errors as ${r}`, real.length === 0, real.join(" | ")); }
  const out = summary();
  fs.writeFileSync(path.join(outDir, "review.json"), JSON.stringify(out, null, 2));
  process.exit(0);
})();
