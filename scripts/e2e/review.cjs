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
    /* every recorder's slices are kept, so a take can be decoded and read
       back after the app has sent it — the marks must be in the file */
    await page.addInitScript(() => {
      const Orig = window.MediaRecorder; if (!Orig) return;
      const Wrapped = function (stream, opts) {
        const r = new Orig(stream, opts); const chunks = [];
        (window.__takes = window.__takes || []).push({ r, chunks });
        r.addEventListener("dataavailable", (e) => { if (e.data && e.data.size) chunks.push(e.data); });
        return r;
      };
      Wrapped.prototype = Orig.prototype; Wrapped.isTypeSupported = (m) => Orig.isTypeSupported(m);
      window.MediaRecorder = Wrapped;
    });
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
    check("(b) the screen is Mark it up · Cian, with Save and Talk over it, and the five tools as icons", /Mark it up · Cian/.test(t0) && /\bSave\b/.test(t0) && /Talk over it/.test(t0) && !/Record/.test(t0)
      && (await Promise.all(["Pen", "Line", "Arrow", "Circle", "Angle"].map((k) => page.locator(`[aria-label="${k}"]`).count()))).every((n) => n === 1), t0.slice(0, 200));
    const cb = await c.boundingBox();
    check("(b) the clip fills the stage — over 450px tall on a phone — and the tab bar is out of the way", !!cb && cb.height > 450 && (await page.locator('[aria-label="Today"]').count()) === 0, JSON.stringify(cb));
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

    /* a new moment: step on half a second and draw — the marks made at
       0:00 fade, and only the new one stands */
    const count = (kind) => c.evaluate((el, k) => { const d = el.getContext("2d").getImageData(0, 0, el.width, el.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (k === "y" ? (d[i] > 200 && d[i + 1] > 170 && d[i + 2] < 120) : (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) n++; return n; }, kind);
    const wBefore = await count("w");
    for (let k = 0; k < 15; k++) await page.locator('[aria-label="On a frame"]').click();
    await page.waitForTimeout(200);
    await page.locator('[aria-label="Colour"]').nth(2).click(); await page.waitForTimeout(100);
    await tap(page, '[aria-label="Line"]', 100); await drag(0.2, 0.2, 0.8, 0.25);
    await page.waitForTimeout(800);
    const yAfter = await count("y"), wAfter = await count("w");
    check("(c2) pausing on and drawing starts a new moment: the 0:00 marks are gone, the new white line stands", yAfter < yellow * 0.15 && wAfter - wBefore > 40, `yellow ${yellow} → ${yAfter} · white +${wAfter - wBefore}`);
    await shot("03b-second-moment");
    /* back to the start: the first moment is the picture again */
    for (let k = 0; k < 15; k++) await page.locator('[aria-label="Back a frame"]').click();
    await page.waitForTimeout(1900);
    const yBack = await count("y");
    check("(c2) stepping back to 0:00 brings the first moment back", yBack > yellow * 0.6, `yellow ${yBack}`);

    /* pinch: two fingers on the stage zoom the working view; 1× resets */
    const zoomed = await c.evaluate((el) => {
      const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      ev("pointerdown", 1, cx - 30, cy); ev("pointerdown", 2, cx + 30, cy);
      for (let k = 1; k <= 6; k++) { ev("pointermove", 1, cx - 30 - k * 15, cy); ev("pointermove", 2, cx + 30 + k * 15, cy); }
      ev("pointerup", 1, cx - 120, cy); ev("pointerup", 2, cx + 120, cy);
      return new Promise((res) => setTimeout(() => res(new DOMMatrixReadOnly(getComputedStyle(el).transform).a), 250));
    });
    check("(c3) a pinch zooms the working view", zoomed > 1.5 && zoomed <= 4, `scale ${zoomed}`);
    await shot("03c-zoomed");
    await tap(page, '[aria-label="Reset zoom"]', 300);
    const unz = await c.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    check("(c3) 1× brings it back, and the pinch made no mark", unz === 1 && (await count("y")) > yellow * 0.6, `scale ${unz}`);

    /* play, then record over it */
    await tap(page, '[aria-label="Play"]', 600);
    check("(d) the clip plays from the transport", (await page.locator('[aria-label="Pause"]').count()) === 1);
    await page.locator("button", { hasText: "Talk over it" }).first().click(); await page.waitForTimeout(1700);
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
    await page.waitForTimeout(500);
    check("(f) Save leaves the screen at once — the upload follows behind the coach's back", !/Mark it up · /.test(await text()) && !/Saving/.test(await text()), (await text()).slice(0, 120));
    /* the file goes up behind the coach's back; wait for it, then for the clip it stood in for to go */
    for (let i = 0; i < 60 && !(db.media.some((m) => m.lesson_id === LESSON.old && /markup-\d+\.(webm|mp4)$/.test(m.storage_path)) && !db.media.some((m) => m.lesson_id === LESSON.old && /1-swing\.mp4$/.test(m.storage_path))); i++) await page.waitForTimeout(250);
    await page.waitForTimeout(900);
    const after = db.media.filter((m) => m.lesson_id === LESSON.old);
    const added = after[after.length - 1];
    check("(f) Save puts the take on the lesson in place of the clip it was drawn on — one video, not two", after.length === before && added && added.kind === "video" && /markup-\d+\.(webm|mp4)$/.test(added.storage_path) && !after.some((m) => /1-swing\.mp4$/.test(m.storage_path)), JSON.stringify(after.map((m) => m.storage_path.split("/").pop())));
    const stored = added && db.files.media[added.storage_path];
    check("(f) the file itself reached storage under the lesson's folder", !!stored && added.storage_path.startsWith(`${IDS.coach}/${LESSON.old}/`), JSON.stringify(stored));
    const t3 = await text();
    check("(g) back on the lesson, the take is its clip", /Putting/.test(t3) && !/Mark it up · /.test(t3) && (await page.locator('[data-tour="lesson-clip"] video').count()) >= 1
      && (await page.locator('[data-tour="lesson-clip"] button').count()) >= 2, `${t3.slice(0, 120)} · buttons ${await page.locator('[data-tour="lesson-clip"] button').count()}`);
    await shot("06-lesson-after");
    const note = db.notifications.find((n) => n.user_id === IDS.adult && /New clip on Putting/.test(n.title));
    check("(h) the player is told: New clip on Putting, from the coach, opening the lesson", !!note && note.body === "Niamh Byrne" && note.data && note.data.screen === "lesson" && note.data.id === LESSON.old, JSON.stringify(note));
    check("(h) the files uploaded with the lesson itself said nothing extra", db.notifications.filter((n) => /New clip|New photo|New voice note/.test(n.title)).length === 1);

    /* ---------- (h2) Save on its own: no microphone, the marks rendered into the clip ---------- */
    await tap(page, '[data-tour="lesson-markup"]', 900);
    await page.waitForFunction(() => { const c = document.querySelector('[data-tour="markup-stage"] canvas'); return !!c && c.width > 2; }, null, { timeout: 10000 }).catch(() => {});
    const c2 = page.locator('[data-tour="markup-stage"] canvas');
    const box2 = await c2.boundingBox();
    const dragOn = async (bx, x0, y0, x1, y1) => {
      await page.mouse.move(bx.x + bx.width * x0, bx.y + bx.height * y0); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(bx.x + bx.width * (x0 + ((x1 - x0) * i) / 8), bx.y + bx.height * (y0 + ((y1 - y0) * i) / 8));
      await page.mouse.up(); await page.waitForTimeout(150);
    };
    await tap(page, '[aria-label="Circle"]', 100); await dragOn(box2, 0.35, 0.35, 0.65, 0.65);
    await tap(page, '[aria-label="Pen"]', 100); await dragOn(box2, 0.2, 0.7, 0.8, 0.75);
    /* the frame as a photo: this moment, its marks, onto the lesson */
    const stillsBefore = db.media.filter((m) => m.lesson_id === LESSON.old && m.kind === "photo").length;
    await tap(page, '[aria-label="Photo"]', 1600);
    const stills = db.media.filter((m) => m.lesson_id === LESSON.old && m.kind === "photo");
    check("(h2) Photo puts the frame with its marks on the lesson as a still, and the coach stays on the screen", stills.length === stillsBefore + 1 && /markup-still-\d+\.jpg$/.test(stills[stills.length - 1].storage_path) && /Mark it up · Cian/.test(await text()), JSON.stringify(stills.map((m) => m.storage_path.split("/").pop())));
    const takesBefore = await page.evaluate(() => (window.__takes || []).length);
    const mediaBefore2 = db.media.filter((m) => m.lesson_id === LESSON.old).length;
    await page.locator("button", { hasText: /^Save$/ }).first().click();
    await page.waitForTimeout(700);
    const ts = await text();
    /* THE TAP IS THE END OF IT: the coach is back on the lesson at once; the
       take is made off the screen and uploaded behind their back */
    check("(h2) Save leaves the screen at once — no Saving to watch, no microphone asked for", !/Mark it up · /.test(ts) && !/Saving/.test(ts) && !/Allow the microphone/.test(ts) && !/can't record/.test(ts) && /Putting/.test(ts), ts.slice(0, 160));
    check("(h2) …the take is being made off the screen while the coach moves on", (await page.evaluate(() => { const h = document.getElementById("nosca-take-host"); return !!h && h.querySelectorAll("video").length; })) >= 1);
    await shot("05b-after-save");
    for (let i = 0; i < 180 && db.media.filter((m) => m.lesson_id === LESSON.old && /markup-\d+\.(webm|mp4)$/.test(m.storage_path)).length < 2; i++) await page.waitForTimeout(250);
    for (let i = 0; i < 40 && db.media.filter((m) => m.lesson_id === LESSON.old && m.kind === "video").length > 1; i++) await page.waitForTimeout(250);
    await page.waitForTimeout(900);
    const after2 = db.media.filter((m) => m.lesson_id === LESSON.old);
    check("(h2) the take arrives on the lesson in place of the clip it was drawn on, and the host is clear again", after2.length === mediaBefore2 && /markup-\d+\.(webm|mp4)$/.test(after2[after2.length - 1].storage_path) && after2.filter((m) => m.kind === "video").length === 1 && (await page.evaluate(() => { const h = document.getElementById("nosca-take-host"); return !h || h.querySelectorAll("video").length === 0; })), JSON.stringify(after2.map((m) => m.storage_path.split("/").pop())));
    /* the marks are IN the file: decode the take the app sent and read its pixels */
    const probe = await page.evaluate(async (n) => {
      const t = (window.__takes || [])[n]; if (!t) return { none: true, takes: (window.__takes || []).length };
      const blob = new Blob(t.chunks, { type: t.r.mimeType || "video/webm" });
      const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto";
      v.src = URL.createObjectURL(blob); document.body.appendChild(v);
      await new Promise((res) => { v.onloadeddata = res; v.onerror = res; setTimeout(res, 5000); });
      try { await v.play(); } catch (e) { /* fine */ }
      await new Promise((res) => setTimeout(res, 1800));
      const c = document.createElement("canvas"); c.width = v.videoWidth || 2; c.height = v.videoHeight || 2;
      const g = c.getContext("2d"); g.drawImage(v, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data; let y = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i + 1] > 140 && d[i + 2] < 130) y++;
      const at = v.currentTime; v.pause(); v.remove();
      return { size: blob.size, w: c.width, h: c.height, y, at };
    }, takesBefore);
    check("(h2) the marks are in the take itself: yellow pixels decoded from the file the app sent", !probe.none && probe.size > 2000 && probe.y > 60, JSON.stringify(probe));

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

    /* ---------- (l) Mark it up from the log itself, and the pull-through ---------- */
    await tap(page, 'button[aria-label="List"]', 600);
    await tap(page, '[aria-label="Today"]', 800);
    await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
    await page.locator('button[aria-label="Cian Murphy"]').first().click(); await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Chipping", exact: true }).click(); await page.waitForTimeout(300);
    const clip = fs.readFileSync(path.join(__dirname, "fixtures", "clip.webm"));
    await page.locator('input[type="file"]').first().setInputFiles([{ name: "swing.webm", mimeType: "video/webm", buffer: clip }]);
    await page.waitForTimeout(700);
    check("(l) a clip attached to the log carries Mark it up on its row", (await page.locator('[data-tour="wiz-markup"]').count()) === 1 && /Mark it up/.test(await text()), (await text()).slice(0, 200));
    await shot("11-log-clip");
    await tap(page, '[data-tour="wiz-markup"]', 900);
    await page.waitForFunction(() => { const c = document.querySelector('[data-tour="markup-stage"] canvas'); return !!c && c.width > 2; }, null, { timeout: 10000 }).catch(() => {});
    const tl = await text();
    check("(l) it opens Mark it up on that clip, for Cian, with Save and Talk over it", /Mark it up · Cian/.test(tl) && /\bSave\b/.test(tl) && /Talk over it/.test(tl) && (await page.locator('[data-tour="markup-stage"] canvas').count()) === 1, tl.slice(0, 160));
    await page.locator("button", { hasText: "Talk over it" }).first().click(); await page.waitForTimeout(1500);
    await page.locator("button", { hasText: "Stop" }).first().click();
    /* the clip on the stage is itself a blob video, so waiting for one
       matched it at once and the check raced the recorder's stop — which
       lands when its last slice does, past ten seconds on a slow machine.
       Wait for the playback itself: Again appears beside Save. */
    await page.getByRole("button", { name: "Again", exact: true }).waitFor({ timeout: 25000 }).catch(() => {});
    check("(l) the take plays back with Save", (await page.locator('video[src^="blob:"]').count()) === 1 && /\bSave\b/.test(await text()));
    await page.locator("button", { hasText: /^Save$/ }).first().click();
    await page.waitForFunction(() => !document.body.innerText.includes("Saving"), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const tl2 = await text();
    check("(l) Save puts the take on the log in the clip's place — one row, nothing uploaded yet", (await page.locator(".nsc-swipe").count()) === 1 && (await page.locator('[data-tour="wiz-markup"]').count()) === 1 && !/Mark it up · /.test(tl2), `rows ${await page.locator(".nsc-swipe").count()} · ${tl2.slice(0, 160)}`);
    /* a second clip, so there are two rows to pull */
    await page.locator('input[type="file"]').first().setInputFiles([{ name: "swing-2.webm", mimeType: "video/webm", buffer: clip }]);
    await page.waitForTimeout(700);
    await shot("12-log-two-clips");
    /* the pull-through: a short pull rests at Remove, a long one deletes on release */
    const rows = page.locator(".nsc-swipe");
    const pull = async (row, frac) => {
      const b = await row.boundingBox();
      await page.mouse.move(b.x + b.width - 12, b.y + b.height / 2); await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width - 12 - b.width * frac * (i / 10), b.y + b.height / 2);
      await page.waitForTimeout(80);
      return b;
    };
    await pull(rows.nth(0), 0.35); await page.mouse.up(); await page.waitForTimeout(500);
    /* the pull began on the row's Mark it up button: a swipe must not press it */
    const tx = await page.evaluate(() => { const r = document.querySelectorAll(".nsc-swipe")[0]; const d = r && r.querySelector(":scope > div"); return d ? new DOMMatrixReadOnly(getComputedStyle(d).transform).m41 : null; });
    check("(l) a short pull opens Remove and stops there, and does not press the button it began on", (await rows.count()) === 2 && tx != null && Math.round(tx) === -88 && !/Talk over it/.test(await text()), `rows ${await rows.count()} · tx ${tx} · ${(await text()).slice(0, 80)}`);
    const b0 = await pull(rows.nth(1), 0.75);
    const wide = await rows.nth(1).locator('button[aria-label="Remove"]').evaluate((el) => el.getBoundingClientRect().width);
    check("(l) a long pull stretches the red across the row before anything goes", wide > b0.width * 0.6 && (await rows.count()) === 2, `red ${Math.round(wide)} of ${Math.round(b0.width)}`);
    await page.mouse.up(); await page.waitForTimeout(900);
    check("(l) letting go past the mark deletes that row and no other", (await rows.count()) === 1 && (await page.locator('[data-tour="wiz-markup"]').count()) === 1, String(await rows.count()));
    await shot("13-log-after-pull");
    const mediaBefore = db.media.length;
    await page.getByRole("button", { name: "Log it", exact: true }).click();
    await page.waitForTimeout(3000);
    const newLesson = db.lessons.filter((l) => l.coach_id === IDS.coach).pop();
    const newRows = db.media.filter((m) => m.lesson_id === newLesson.id);
    check("(l) Log it writes the lesson with the marked-up take as its one clip", !!newLesson && newRows.length === 1 && /markup-\d+\.(webm|mp4)$/.test(newRows[0].storage_path) && db.media.length === mediaBefore + 1, JSON.stringify(newRows.map((r) => r.storage_path.split("/").pop())));
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
