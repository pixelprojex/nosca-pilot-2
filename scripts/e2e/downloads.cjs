/* DOWNLOADS. A lesson saved whole onto the phone from its disc — the
   clip, the photo, the voice note, the note, the tip, the drills — a
   tick when it is there, the Downloads screen with the size and the
   poster from the phone, the lesson page playing from the phone, a
   failed file said with Retry, Update, Share as a file, a swipe to
   remove and Remove all; and the app opening with no network at all on
   its kept shell and last load, the downloaded lesson playing and a
   lesson never downloaded saying so.
   Usage: node downloads.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4340), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const L = { new: "10000000-0000-4000-8000-00000000dd01", old: "10000000-0000-4000-8000-00000000dd02", drive: "10000000-0000-4000-8000-00000000dd03", kid: "10000000-0000-4000-8000-00000000dd04" };
const TODAY = M.ymd(new Date());
const NOTE = "Cleaner contact from the fringe. Two clips of the low runner.";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* the whole log on one lesson: a clip, a photo, a voice note, a note, a tip and two drills set alongside it */
  M.addLesson(db, { id: L.new, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-18", focus: "Short game", subs: ["HI 18.4"], notes: NOTE });
  M.addMedia(db, { lessonId: L.new, kind: "video", path: `${IDS.coach}/${L.new}/clip-1.mp4`, createdAt: "2026-09-18T10:01:00Z" });
  M.addMedia(db, { lessonId: L.new, kind: "photo", path: `${IDS.coach}/${L.new}/still-1.jpg`, createdAt: "2026-09-18T10:02:00Z" });
  M.addMedia(db, { lessonId: L.new, kind: "audio", path: `${IDS.coach}/${L.new}/note-1.webm`, createdAt: "2026-09-18T10:03:00Z" });
  db.tips.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, title: "Trust the shallow", body: "Let the bounce do the work.", created_at: "2026-09-18T10:05:00Z" });
  ["Gate drill", "Towel under the arms"].forEach((title, i) => {
    const d = M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title });
    d.created_at = `2026-09-18T10:0${6 + i}:00Z`;
  });
  M.addLesson(db, { id: L.old, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-04", focus: "Putting", notes: "Pace first." });
  M.addMedia(db, { lessonId: L.old, kind: "video", path: `${IDS.coach}/${L.old}/clip-2.mp4`, createdAt: "2026-09-04T10:01:00Z" });
  M.addLesson(db, { id: L.drive, coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: "Driving", notes: "Tempo over speed." });
  M.addMedia(db, { lessonId: L.drive, kind: "video", path: `${IDS.coach}/${L.drive}/clip-3.mp4`, createdAt: "2026-08-20T10:01:00Z" });
  M.addLesson(db, { id: L.kid, coachId: IDS.coach, playerId: IDS.junior, date: "2026-09-12", focus: "Chipping" });
  M.addMedia(db, { lessonId: L.kid, kind: "video", path: `${IDS.coach}/${L.kid}/clip-k.mp4`, createdAt: "2026-09-12T10:01:00Z" });
  return db;
}

const { check, results, summary } = M.checker("downloads");
const JS_ASSET = (() => { try { return JSON.parse(fs.readFileSync(path.join(distDir, "precache.json"), "utf8")).files.find((f) => /\/assets\/.*\.js$/.test(f)); } catch (e) { return null; } })();

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
  const db = freshDb();
  const errors = [];
  const boot = async (role, { ctx: given } = {}) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = given || await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* the worker has the shell when the cache holds index.html and the app's script */
  const shellCached = (page) => page.waitForFunction(async (js) => {
    if (!("caches" in window)) return false;
    const keys = await caches.keys(); const k = keys.find((x) => x.startsWith("nosca-shell-")); if (!k) return false;
    const c = await caches.open(k);
    return !!(await c.match("/index.html")) && (!js || !!(await c.match(js)));
  }, JS_ASSET, { timeout: 20000 }).then(() => true).catch(() => false);
  const discState = (page, focus) => page.evaluate((f) => {
    const b = [...document.querySelectorAll("button[data-download]")].find((x) => (x.getAttribute("aria-label") || "").endsWith(` ${f}`) || (x.getAttribute("aria-label") || "").includes(` ${f} · `));
    return b ? b.getAttribute("data-download") : null;
  }, focus);
  const untilDisc = (page, focus, state, ms = 20000) => page.waitForFunction(([f, st]) => {
    const b = [...document.querySelectorAll("button[data-download]")].find((x) => (x.getAttribute("aria-label") || "").endsWith(` ${f}`) || (x.getAttribute("aria-label") || "").includes(` ${f} · `));
    return !!b && b.getAttribute("data-download") === st;
  }, [focus, state], { timeout: ms }).then(() => true).catch(() => false);
  /* the iPhone's swipe on a row: pull left past the mark, let go */
  const swipeAway = async (page, sel) => {
    const box = await page.locator(sel).first().boundingBox(); if (!box) return false;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x + box.width - 20 - (box.width * 0.75 * i) / 12, y); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(700);
    return true;
  };

  try {
    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      const cached = await shellCached(page);
      check("(a) the worker keeps this build's shell for the plane: index.html and the script in its cache", cached, JS_ASSET || "no precache.json");

      await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      check("(b) every lesson row carries the disc, none of them on the phone yet", (await page.locator('[data-tour="player-lessons"] button[data-download="none"]').count()) === 3, String(await page.locator('[data-tour="player-lessons"] button[data-download]').count()));
      await page.getByRole("button", { name: "Download Short game" }).click();
      const saved = await untilDisc(page, "Short game", "saved");
      check("(c) a tap saves the lesson onto the phone and the disc becomes a tick", saved && /Downloaded/.test(await text()), (await text()).slice(0, 160));
      await shot("01-saved-disc");
      /* the record on the phone: the lesson, the tip, the drills, the three files as blobs, and whose it is */
      const rec = await page.evaluate(async (id) => new Promise((res) => {
        const r = indexedDB.open("nosca-offline"); r.onerror = () => res({ error: String(r.error) });
        r.onsuccess = () => { const db = r.result; const t = db.transaction(["lessons", "files"], "readonly");
          const g = t.objectStore("lessons").get(id); const f = t.objectStore("files").index("lessonId").getAll(id);
          t.oncomplete = () => res({ rec: g.result ? { owner: g.result.owner, focus: g.result.lesson && g.result.lesson.focus, note: g.result.lesson && g.result.lesson.note, tip: g.result.tip && g.result.tip.title, drills: (g.result.drills || []).map((d) => d.t), files: (g.result.files || []).length, bytes: g.result.bytes, coach: g.result.coach, who: g.result.who } : null,
                                     files: (f.result || []).map((x) => ({ type: x.type, size: x.size, blob: !!(x.blob && x.blob.size) })) }); };
      }), L.new);
      check("(d) the phone holds every part of the log: the lesson, its note, the tip, both drills, whose it is, and three files as blobs", !!rec.rec && rec.rec.owner === IDS.coach && rec.rec.focus === "Short game" && rec.rec.note === NOTE && rec.rec.tip === "Trust the shallow" && rec.rec.drills.length === 2 && rec.rec.coach === "Niamh Byrne" && rec.rec.who === "Cian Murphy" && rec.rec.files === 3 && rec.files.length === 3 && rec.files.every((f) => f.blob) && rec.rec.bytes > 1000, JSON.stringify(rec).slice(0, 400));

      /* the home's own row, and Settings */
      await tap(page, '[aria-label="Today"]', 900);
      const homeRow = page.locator('[data-tour="today-downloads"]');
      check("(e) the coach's home carries a Downloads row under All lessons, with the count", (await homeRow.count()) === 1 && /Downloads\s*1/.test(M.norm(await homeRow.innerText())), M.norm((await homeRow.count()) ? await homeRow.innerText() : "none"));
      await tap(page, '[aria-label="Your profile"]', 900);
      const row = page.locator('[data-tour="settings-downloads"]');
      check("(f) Settings › Downloads reads the count and the room they take", (await row.count()) === 1 && /1 lesson · \d+ (KB|MB)/.test(M.norm(await row.innerText())), M.norm((await row.count()) ? await row.innerText() : "none"));
      await row.click(); await page.waitForTimeout(900);
      const t1 = await text();
      const poster = page.locator('[data-tour="downloads-row"] video, [data-tour="downloads-row"] img').first();
      const psrc = (await poster.count()) ? await poster.getAttribute("src") : "";
      check("(g) the Downloads screen: one row, the size on it, the poster from the phone", (await page.locator('[data-tour="downloads-row"]').count()) === 1 && t1.includes("Short game") && /\d+ (KB|MB)/.test(t1) && /^blob:/.test(psrc || ""), `${t1.slice(0, 120)} · ${psrc}`);
      await shot("02-downloads");

      /* open it: everything plays and reads from the phone */
      await page.locator('[data-tour="downloads-row"] button').first().click(); await page.waitForTimeout(1200);
      const t2 = await text();
      const vsrc = await page.locator('[data-tour="lesson-clip"] video').first().getAttribute("src").catch(() => null);
      const thumbs = await page.locator('[data-tour="lesson-clip"] button[aria-pressed]').count();
      check("(h) the lesson page plays the clip from the phone, with the photo and the voice note, the note, the tip and the drills", /^blob:/.test(vsrc || "") && thumbs === 3 && t2.includes(NOTE) && t2.includes("Trust the shallow") && t2.includes("Gate drill") && t2.includes("Towel under the arms"), `${vsrc} · ${thumbs} · ${t2.slice(0, 200)}`);
      const foot = page.locator('[data-tour="lesson-save"]');
      check("(i) the foot reads Downloaded with the size", /Downloaded · \d+ (KB|MB)/.test(await foot.innerText()), await foot.innerText());
      await foot.click(); await page.waitForTimeout(600);
      const sheet = page.locator('[data-tour="download-sheet"]');
      check("(j) its sheet: Downloaded, the size and the day; Update, Share as a file and Remove; no Open on the lesson itself", (await sheet.count()) === 1 && /Downloaded · \d+ (KB|MB) · \w{3} \d{1,2} \w{3}/.test(M.norm(await sheet.innerText())) && (await sheet.getByRole("button", { name: "Open" }).count()) === 0 && (await sheet.getByRole("button", { name: "Update" }).count()) === 1, M.norm((await sheet.count()) ? await sheet.innerText() : "none"));
      await shot("03-sheet");
      const savedAt = (id) => page.evaluate((k) => new Promise((res) => { const r = indexedDB.open("nosca-offline"); r.onerror = () => res(null); r.onsuccess = () => { const t = r.result.transaction("lessons", "readonly"); const g = t.objectStore("lessons").get(k); t.oncomplete = () => res(g.result ? g.result.savedAt : null); }; }), id);
      const at0 = await savedAt(L.new);
      await page.waitForTimeout(1100);
      await sheet.getByRole("button", { name: "Update" }).click();
      const updated = await page.waitForFunction(() => /Downloaded · /.test((document.querySelector('[data-tour="lesson-save"]') || {}).innerText || "") && !document.querySelector('[data-tour="download-sheet"]'), null, { timeout: 15000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(800);
      const at1 = await savedAt(L.new);
      check("(k) Update saves it again — a newer copy, still on the phone", updated && !!at0 && !!at1 && at1 > at0, `${at0} → ${at1} · ${await foot.innerText()}`);
      await foot.click(); await page.waitForTimeout(500);
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), sheet.getByRole("button", { name: "Share as a file" }).click()]);
      const html = dl ? fs.readFileSync(await dl.path(), "utf8") : "";
      check("(l) Share as a file: the log as a file, with the note, the tip and the drills in it", !!dl && /\.html$/.test(dl.suggestedFilename()) && html.includes(NOTE) && html.includes("Trust the shallow") && html.includes("Gate drill"), dl ? `${dl.suggestedFilename()} · ${html.length}` : "no download");

      /* a file that will not come down: said, kept in the list, retried */
      db.failFetch = (p) => /clip-2\.mp4/.test(p);
      await tap(page, '[aria-label="Back"]', 500); await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.getByRole("button", { name: "Download Putting" }).click();
      const failed = await untilDisc(page, "Putting", "failed");
      const t3 = await text();
      check("(m) a file that will not fetch fails the download: the disc in red, the reason said", failed && /Couldn't download · A file could not be fetched/.test(t3), t3.slice(0, 200));
      await shot("04-failed");
      await tap(page, '[aria-label="Today"]', 800); await tap(page, '[data-tour="today-downloads"]', 900);
      const t4 = await text();
      check("(n) the Downloads screen lists the failed one first with its reason, the saved one under it", /Putting.*A file could not be fetched.*Short game/.test(t4) && (await page.locator('[data-download-row="failed"]').count()) === 1, t4.slice(0, 200));
      db.failFetch = null;
      await page.locator('[data-download-row="failed"] button[data-download="failed"]').first().click();
      const retried = await untilDisc(page, "Putting", "saved");
      check("(o) Retry from the failed row saves it", retried && (await page.locator('[data-download-row="saved"]').count()) === 2, (await text()).slice(0, 160));

      /* ---------- no network at all ---------- */
      db.offline = true;
      await ctx.setOffline(true);
      let opened = true;
      try { await page.reload({ waitUntil: "load", timeout: 30000 }); } catch (e) { opened = false; errors.push(`reload offline: ${e.message.slice(0, 120)}`); }
      await M.settle(page, { wait: 8000 });
      const t5 = await text();
      check("(p) with no network the app opens on its kept shell and last load: the coach's home, Offline said", opened && /Offline/.test(t5) && (await page.locator('[data-tour="today-downloads"]').count()) === 1, `${opened} · ${t5.slice(0, 200)}`);
      await shot("05-offline-home");
      await tap(page, '[data-tour="today-downloads"]', 900);
      check("(q) Downloads lists both, offline", (await page.locator('[data-download-row="saved"]').count()) === 2, (await text()).slice(0, 160));
      await page.locator('[data-tour="downloads-row"]', { hasText: "Short game" }).locator("button").first().click(); await page.waitForTimeout(1200);
      const t6 = await text();
      const vsrc2 = await page.locator('[data-tour="lesson-clip"] video').first().getAttribute("src").catch(() => null);
      check("(r) a downloaded lesson plays from the phone offline, note and tip and drills with it", /^blob:/.test(vsrc2 || "") && t6.includes(NOTE) && t6.includes("Trust the shallow"), `${vsrc2} · ${t6.slice(0, 160)}`);
      await shot("06-offline-lesson");
      /* one never downloaded */
      await tap(page, '[aria-label="Back"]', 500); await tap(page, '[aria-label="Back"]', 500);
      await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.locator('[data-tour="player-lessons"] button', { hasText: "Driving" }).first().click();
      await page.waitForFunction(() => /Not downloaded/.test((document.getElementById("root") || {}).innerText || ""), null, { timeout: 10000 }).catch(() => {});
      const t7 = await text();
      check("(s) a lesson never downloaded says Not downloaded offline, and keeps its note", t7.includes("Not downloaded") && t7.includes("Tempo over speed.") && (await page.locator('[data-tour="lesson-clip"] video').count()) === 0, t7.slice(0, 200));
      /* back on the network */
      db.offline = false;
      await ctx.setOffline(false);
      await page.waitForFunction(() => !/(^|\s)Offline(\s|$)/.test((document.getElementById("root") || {}).innerText || ""), null, { timeout: 20000 }).catch(() => {});
      check("(t) back on a network the app loads for real and Offline goes", !/Offline/.test(await text()), (await text()).slice(0, 120));

      /* remove: a swipe on the row, then Remove all */
      await tap(page, '[aria-label="Back"]', 500); await tap(page, '[aria-label="Today"]', 800); await tap(page, '[data-tour="today-downloads"]', 900);
      await swipeAway(page, '[data-tour="downloads-row"]');
      check("(u) a swipe takes one off the phone", (await page.locator('[data-tour="downloads-row"]').count()) === 1, String(await page.locator('[data-tour="downloads-row"]').count()));
      const left = await page.evaluate(async () => new Promise((res) => { const r = indexedDB.open("nosca-offline"); r.onsuccess = () => { const t = r.result.transaction(["lessons", "files"], "readonly"); const a = t.objectStore("lessons").count(); const b = t.objectStore("files").count(); t.oncomplete = () => res({ lessons: a.result, files: b.result }); }; r.onerror = () => res(null); }));
      check("(v) …and its files with it", !!left && left.lessons === 1 && left.files === (left.lessons === 1 ? 3 : 0) || (!!left && left.lessons === 1 && left.files === 1), JSON.stringify(left));
      await page.getByRole("button", { name: "Download Putting" }).count();
      /* two again, then Remove all */
      await tap(page, '[aria-label="Back"]', 500); await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.getByRole("button", { name: /^Download (Short game|Putting|Driving)$/ }).first().click();
      await page.waitForFunction(() => document.querySelectorAll('[data-tour="player-lessons"] button[data-download="saved"]').length === 2, null, { timeout: 20000 }).catch(() => {});
      await tap(page, '[aria-label="Today"]', 800); await tap(page, '[data-tour="today-downloads"]', 900);
      await page.getByRole("button", { name: "Remove all" }).click(); await page.waitForTimeout(900);
      const t8 = await text();
      check("(w) Remove all empties the phone: Nothing downloaded, and the home row goes", t8.includes("Nothing downloaded") && (await page.locator('[data-tour="downloads-row"]').count()) === 0, t8.slice(0, 120));
      await tap(page, '[aria-label="Back"]', 700);
      check("(w2) the home row is gone", (await page.locator('[data-tour="today-downloads"]').count()) === 0);
      await ctx.close();
    }

    /* ---------- the player ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      const card = page.locator("[data-feed-card]").first();
      const disc = card.getByRole("button", { name: /^Download / });
      check("(x) the feed card's disc, not yet on the phone", (await disc.count()) === 1, String(await disc.count()));
      await disc.click();
      const ok = await page.waitForSelector('[data-feed-card] button[aria-label^="Downloaded Short game"]', { timeout: 20000 }).then(() => true).catch(() => false);
      check("(y) the player saves it from the feed and the card's disc becomes a tick", ok, (await text()).slice(0, 120));
      await shot("07-player-card");
      await tap(page, '[data-tour="feed-open"]', 1200);
      const vsrc = await page.locator('[data-tour="lesson-clip"] video').first().getAttribute("src").catch(() => null);
      check("(z) the lesson page plays the player's copy from the phone", /^blob:/.test(vsrc || ""), String(vsrc));
      await tap(page, '[aria-label="Back"]', 700);
      /* the list view carries the Downloads row */
      await page.locator('[data-tour="feed-view"] button, [data-tour="log-view"] button', { hasText: "List" }).first().click().catch(() => {}); await page.waitForTimeout(800);
      check("(z2) the player's list carries a Downloads row with the count", (await page.locator('[data-tour="log-downloads"]').count()) === 1, (await text()).slice(0, 160));
      await ctx.close();
    }

    /* ---------- a parent, a child's lesson ---------- */
    {
      const { ctx, page, text } = await boot("parent");
      await tap(page, '[aria-label="Lessons"]', 900);
      await page.locator("[data-feed-card]").first().getByRole("button", { name: /^Download / }).click();
      const ok = await page.waitForSelector('[data-feed-card] button[aria-label^="Downloaded Chipping"]', { timeout: 20000 }).then(() => true).catch(() => false);
      check("(aa) a parent saves the child's lesson", ok, (await text()).slice(0, 120));
      await tap(page, '[aria-label="Your profile"]', 800);
      if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 800);
      await page.locator('[data-tour="settings-downloads"]').click(); await page.waitForTimeout(900);
      const t = await text();
      check("(ab) the parent's Downloads names the child on the row", /Saoirse Kelly/.test(t) && (await page.locator('[data-tour="downloads-row"]').count()) === 1, t.slice(0, 160));
      await ctx.close();
    }

    check("(ac) no page errors", errors.length === 0, errors.join(" | ").slice(0, 400));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
