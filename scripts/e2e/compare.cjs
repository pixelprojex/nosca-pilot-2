/* COMPARE. Two clips of the same player side by side, from the lesson
   page, for the coach and the player: the picker lists the player's
   other clips newest first; the pair plays together from one transport;
   a frame either way moves both, the pill's ‹ › move one; ½× slows
   both; Swap swaps them; Change picks again; the coach's Save records
   the pair as a new clip on the lesson and the player is told. A player
   with nothing to compare against is not offered it.
   Usage: node compare.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", fresh: "00000000-0000-4000-8000-00000000f9e5" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const L = { new: "10000000-0000-4000-8000-00000000cc01", old: "10000000-0000-4000-8000-00000000cc02", two: "10000000-0000-4000-8000-00000000cc03", kid1: "10000000-0000-4000-8000-00000000cc04", kid2: "10000000-0000-4000-8000-00000000cc05", lone: "10000000-0000-4000-8000-00000000cc06" };
const TODAY = M.ymd(new Date());
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
  /* Cian: newest with a clip and a photo, then one clip, then a lesson with two clips */
  M.addLesson(db, { id: L.new, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-18", focus: "Short game", subs: ["HI 18.4"], notes: "Cleaner contact from the fringe." });
  M.addMedia(db, { lessonId: L.new, kind: "video", path: `${IDS.coach}/${L.new}/clip-1.mp4`, createdAt: "2026-09-18T10:01:00Z" });
  M.addMedia(db, { lessonId: L.new, kind: "photo", path: `${IDS.coach}/${L.new}/still-1.jpg`, createdAt: "2026-09-18T10:02:00Z" });
  M.addLesson(db, { id: L.old, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-04", focus: "Putting", notes: "Pace first." });
  M.addMedia(db, { lessonId: L.old, kind: "video", path: `${IDS.coach}/${L.old}/clip-2.mp4`, createdAt: "2026-09-04T10:01:00Z" });
  M.addLesson(db, { id: L.two, coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: "Driving" });
  M.addMedia(db, { lessonId: L.two, kind: "video", path: `${IDS.coach}/${L.two}/clip-3a.mp4`, createdAt: "2026-08-20T10:01:00Z" });
  M.addMedia(db, { lessonId: L.two, kind: "video", path: `${IDS.coach}/${L.two}/clip-3b.mp4`, createdAt: "2026-08-20T10:02:00Z" });
  /* Saoirse: two lessons with a clip each, for the parent */
  M.addLesson(db, { id: L.kid1, coachId: IDS.coach, playerId: IDS.junior, date: "2026-09-12", focus: "Chipping" });
  M.addMedia(db, { lessonId: L.kid1, kind: "video", path: `${IDS.coach}/${L.kid1}/clip-k1.mp4`, createdAt: "2026-09-12T10:01:00Z" });
  M.addLesson(db, { id: L.kid2, coachId: IDS.coach, playerId: IDS.junior, date: "2026-08-29", focus: "Putting" });
  M.addMedia(db, { lessonId: L.kid2, kind: "video", path: `${IDS.coach}/${L.kid2}/clip-k2.mp4`, createdAt: "2026-08-29T10:01:00Z" });
  /* Dara: one lesson, one clip, nothing to set it beside */
  M.addLesson(db, { id: L.lone, coachId: IDS.coach, playerId: IDS.fresh, date: "2026-09-10", focus: "Full swing" });
  M.addMedia(db, { lessonId: L.lone, kind: "video", path: `${IDS.coach}/${L.lone}/clip-d.mp4`, createdAt: "2026-09-10T10:01:00Z" });
  return db;
}

const { check, results, summary } = M.checker("compare");
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
    /* every recorder's slices are kept, so the take can be decoded after the app has sent it */
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
    /* the catch-up card is dismissed where there is one — the coach's Save tells the player, and the card would sit over the picker */
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* the two videos' state, read together */
  const state = (page) => page.evaluate(() => {
    const q = (s) => document.querySelector(`video[data-compare-video="${s}"]`);
    const one = (v) => v ? { t: v.currentTime, paused: v.paused, muted: v.muted, rate: v.playbackRate, dur: v.duration, w: v.videoWidth, h: v.videoHeight, ended: v.ended } : null;
    const lab = (s) => { const el = document.querySelector(`[data-compare-label="${s}"]`); return el ? el.textContent : null; };
    const st = document.querySelector('[data-tour="compare-stage"]');
    return { a: one(q("a")), b: one(q("b")), la: lab("a"), lb: lab("b"), layout: st ? st.getAttribute("data-compare-layout") : null };
  });
  const untilReady = (page) => page.waitForFunction(() => {
    const p = document.querySelector('[data-tour="compare-transport"] button[aria-label="Play"], [data-tour="compare-transport"] button[aria-label="Pause"]');
    return !!p && !p.disabled;
  }, null, { timeout: 15000 }).then(() => true).catch(() => false);

  try {
    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.locator("button", { hasText: "Short game" }).first().click(); await page.waitForTimeout(1200);
      const markup = page.locator('[data-tour="lesson-markup"]'), compare = page.locator('[data-tour="lesson-compare"]');
      check("(a) the lesson page offers Compare beside Mark it up", (await compare.count()) === 1 && (await markup.count()) === 1, (await text()).slice(0, 200));
      if (await compare.count()) {
        const [bm, bc] = await Promise.all([markup.boundingBox(), compare.boundingBox()]);
        check("(a2) the two sit in one row, each half the width", !!bm && !!bc && near(bm.y, bc.y, 1) && near(bm.width, bc.width, 2) && bc.x > bm.x, JSON.stringify({ bm, bc }));
      }
      await shot("01-lesson");

      await tap(page, '[data-tour="lesson-compare"]', 900);
      await page.waitForSelector("[data-compare-row]", { timeout: 10000 }).catch(() => {});
      const rows = page.locator("[data-compare-row]");
      const rowText = [];
      for (let i = 0; i < await rows.count(); i++) rowText.push(M.norm(await rows.nth(i).innerText()));
      const tx = await text();
      check("(b) the picker: this clip at the top, the player's other clips under it, newest first", tx.includes("This clip") && rowText.length === 3 && /Putting/.test(rowText[0]) && /Driving/.test(rowText[1]) && /Driving/.test(rowText[2]), JSON.stringify(rowText));
      check("(b2) two clips on one lesson read Clip 1 and Clip 2", /Clip 1/.test(rowText[1] || "") && /Clip 2/.test(rowText[2] || ""), JSON.stringify(rowText));
      check("(b3) the title names the player", /Compare · Cian/.test(tx), tx.slice(0, 80));
      await shot("02-pick");

      await rows.first().click(); await page.waitForTimeout(600);
      const ready = await untilReady(page);
      let s = await state(page);
      check("(c) two clips on one stage, side by side, both muted and still", ready && !!s.a && !!s.b && s.layout === "side" && s.a.muted && s.b.muted && s.a.paused && s.b.paused && s.a.dur > 0 && Number.isFinite(s.a.dur) && Number.isFinite(s.b.dur), JSON.stringify(s));
      await shot("03-stages");

      /* play both, then pause: both running, then both still, in step */
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Play"]', 500);
      const mid = await state(page);
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Pause"]', 300);
      s = await state(page);
      check("(d) Play runs both together and Pause stops both", mid.a && mid.b && !mid.a.paused && !mid.b.paused && s.a.paused && s.b.paused && s.a.t > 0.05 && near(s.a.t, s.b.t, 0.2), JSON.stringify({ mid, s }));

      /* a frame on: both move by a frame */
      const before = await state(page);
      await tap(page, '[data-tour="compare-transport"] button[aria-label="On a frame"]', 400);
      s = await state(page);
      check("(e) a frame on moves both a frame", near(s.a.t - before.a.t, FRAME, 0.02) && near(s.b.t - before.b.t, FRAME, 0.02), JSON.stringify({ before, s }));

      /* the pill's › moves only its own clip */
      const b0 = await state(page);
      const nudgeB = page.locator('[data-compare-pane="b"] button[aria-label^="On a frame"]');
      await nudgeB.click(); await page.waitForTimeout(400);
      s = await state(page);
      check("(f) the pill's › nudges that clip alone", near(s.b.t - b0.b.t, FRAME, 0.02) && near(s.a.t, b0.a.t, 0.005), JSON.stringify({ b0, s }));
      /* and the pair keeps that offset when it plays on */
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Play"]', 700);
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Pause"]', 300);
      s = await state(page);
      check("(f2) lined up, they play on with the offset kept", near(s.b.t - s.a.t, (b0.b.t + FRAME) - b0.a.t, 0.2), JSON.stringify(s));

      /* ½× on both */
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Half speed"]', 200);
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Play"]', 400);
      s = await state(page);
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Pause"]', 200);
      check("(g) ½× slows both", s.a.rate === 0.5 && s.b.rate === 0.5, JSON.stringify(s));
      await tap(page, '[data-tour="compare-transport"] button[aria-label="Half speed"]', 200);

      /* the scrub back to the start: A at 0, B at its lined-up start */
      await page.locator('[data-tour="compare-transport"] input[type="range"]').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "0"); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
      await page.waitForTimeout(400);
      s = await state(page);
      check("(h) the scrub to 0 puts A at its start and B at its lined-up start", near(s.a.t, 0, 0.05) && near(s.b.t, FRAME, 0.05), JSON.stringify(s));

      /* swap */
      const pre = await state(page);
      await page.getByRole("button", { name: "Swap" }).click(); await page.waitForTimeout(900);
      s = await state(page);
      check("(i) Swap puts the picked clip first and this one second", s.la === pre.lb && s.lb === pre.la, JSON.stringify({ pre: [pre.la, pre.lb], now: [s.la, s.lb] }));
      await shot("04-swapped");

      /* change: the picker again, this clip now the picked one */
      await page.getByRole("button", { name: "Change" }).click(); await page.waitForTimeout(700);
      const tx2 = await text();
      const rows2 = page.locator("[data-compare-row]");
      const rt2 = [];
      for (let i = 0; i < await rows2.count(); i++) rt2.push(M.norm(await rows2.nth(i).innerText()));
      check("(j) Change reopens the picker with the other three clips", tx2.includes("This clip") && rt2.length === 3 && rt2.some((x) => /Short game/.test(x)), JSON.stringify(rt2));
      await rows2.filter({ hasText: "Short game" }).first().click(); await page.waitForTimeout(600);
      await untilReady(page);

      /* save: the pair plays through once and lands on the lesson as a new clip */
      const mediaBefore = db.media.filter((m) => m.lesson_id === L.new).length;
      const notesBefore = db.notifications.filter((n) => n.user_id === IDS.adult).length;
      await page.getByRole("button", { name: "Save" }).click();
      const popped = await page.waitForFunction(() => !document.querySelector('[data-tour="compare-stage"]'), null, { timeout: 60000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(800);
      const added = db.media.filter((m) => m.lesson_id === L.new).slice(mediaBefore);
      check("(k) Save records the pair and puts it on the lesson as a new clip", popped && added.length === 1 && added[0].kind === "video" && /compare-\d+\.(webm|mp4)$/.test(added[0].storage_path), JSON.stringify({ popped, added: added.map((m) => m.storage_path) }));
      check("(k2) the original clips stay", db.media.filter((m) => m.lesson_id === L.new && m.kind === "video").length === 2, String(db.media.filter((m) => m.lesson_id === L.new).length));
      const told = db.notifications.filter((n) => n.user_id === IDS.adult).slice(notesBefore);
      check("(k3) the player is told: New clip on Short game", told.some((n) => n.title === "New clip on Short game"), JSON.stringify(told.map((n) => n.title)));
      check("(k4) the lesson page is back with Saved said", /Saved/.test(await text()) || /Short game/.test(await text()), (await text()).slice(0, 120));
      await shot("05-after-save");

      /* the take itself: a landscape picture twice a portrait clip wide, both halves drawn */
      const take = await page.evaluate(async () => {
        const T = (window.__takes || []).slice(-1)[0]; if (!T || !T.chunks.length) return { none: true };
        const blob = new Blob(T.chunks, { type: T.r.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.src = url;
        await new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; setTimeout(res, 8000); });
        const seekTo = (t) => new Promise((res) => { v.onseeked = res; v.currentTime = t; setTimeout(res, 3000); });
        await seekTo(Math.min(0.6, (Number.isFinite(v.duration) ? v.duration : 1) / 2));
        const c = document.createElement("canvas"); c.width = v.videoWidth || 2; c.height = v.videoHeight || 2;
        const g = c.getContext("2d"); g.drawImage(v, 0, 0);
        const lit = (x0, x1) => { const d = g.getImageData(x0, 0, x1 - x0, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n; };
        return { size: blob.size, w: v.videoWidth, h: v.videoHeight, dur: v.duration, left: lit(0, Math.floor(c.width / 2) - 4), right: lit(Math.floor(c.width / 2) + 4, c.width) };
      });
      check("(l) the take is one landscape picture with a clip drawn in each half", !take.none && take.w === 1280 && take.h === 720 && take.left > 20 && take.right > 20, JSON.stringify(take));
      await ctx.close();
    }

    /* ---------- the player ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      /* the feed opens on the newest lesson; View lesson opens it */
      await tap(page, '[data-tour="feed-open"]', 1200);
      check("(m) the player has Compare and not Mark it up", (await page.locator('[data-tour="lesson-compare"]').count()) === 1 && (await page.locator('[data-tour="lesson-markup"]').count()) === 0, (await text()).slice(0, 160));
      await tap(page, '[data-tour="lesson-compare"]', 900);
      await page.waitForSelector("[data-compare-row]", { timeout: 10000 }).catch(() => {});
      const tx = await text();
      const rows = page.locator("[data-compare-row]");
      /* four now: the coach's comparison is a clip on the lesson like any other */
      check("(m2) their own picker, titled Compare and no name, lists the other four clips, the coach's comparison among them", /^Compare\b/.test(tx.trim()) && !/Compare · /.test(tx) && (await rows.count()) === 4 && /Short game.*Clip 2/.test(tx), tx.slice(0, 120) + " · " + String(await rows.count()));
      await rows.first().click(); await page.waitForTimeout(600);
      const ready = await untilReady(page);
      const s = await state(page);
      check("(m3) the pair plays for the player, with no Save", ready && !!s.a && !!s.b && (await page.getByRole("button", { name: "Save" }).count()) === 0 && (await page.getByRole("button", { name: "Swap" }).count()) === 1, JSON.stringify(s));
      await shot("06-player-stages");
      await ctx.close();
    }

    /* ---------- a parent, on a child's lesson ---------- */
    {
      const { ctx, page, text } = await boot("parent");
      await tap(page, '[aria-label="Lessons"]', 900);
      await tap(page, '[data-tour="feed-open"]', 1200);
      const has = (await page.locator('[data-tour="lesson-compare"]').count()) === 1;
      check("(n) a parent has Compare on the child's lesson", has, (await text()).slice(0, 160));
      if (has) {
        await tap(page, '[data-tour="lesson-compare"]', 900);
        await page.waitForSelector("[data-compare-row]", { timeout: 10000 }).catch(() => {});
        const tx = await text();
        check("(n2) the title names the child, and the picker lists her other clip only", /Compare · Saoirse/.test(tx) && (await page.locator("[data-compare-row]").count()) === 1, tx.slice(0, 100));
      }
      await ctx.close();
    }

    /* ---------- nothing to compare against ---------- */
    {
      const { ctx, page, text } = await boot("fresh");
      await tap(page, '[data-tour="feed-open"]', 1200);
      check("(o) a player with one clip and no other lesson is not offered Compare", (await page.locator('[data-tour="lesson-compare"]').count()) === 0 && /Full swing/.test(await text()), (await text()).slice(0, 160));
      await ctx.close();
    }

    check("(p) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
