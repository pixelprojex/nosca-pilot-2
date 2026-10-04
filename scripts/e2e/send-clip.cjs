/* A CLIP FROM THE PLAYER TO THE COACH. The camera in the thread's
   composer films a clip; Send puts it to the coach as a lesson row of
   the player's own (sent_by), the file uploaded behind their back, and
   one line in the thread that opens it. The coach is told once and the
   player not at all; it waits on the coach's home as To review until the
   coach opens it. A parent sends for a child. A project whose SQL has no
   sent_by column offers no camera.
   Usage: node send-clip.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* a word from the coach each way, so Chat lists the conversations */
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "Send me a swing when you get a chance.", createdAt: "2026-10-02T15:00:00Z" });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.coach, body: "Well done today.", createdAt: "2026-10-02T16:00:00Z" });
  return db;
}

const { check, results, summary } = M.checker("send-clip");
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 300)); } return !!(await fn()); };

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-capture", "--use-fake-ui-for-media-capture", "--autoplay-policy=no-user-gesture-required"] });
  const db = freshDb();
  const errors = [];
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    /* the fake camera: a live canvas stream and an oscillator, the same as capture.cjs */
    await page.addInitScript(() => {
      const make = () => {
        const c = document.createElement("canvas"); c.width = 720; c.height = 1280;
        const g = c.getContext("2d"); let n = 0;
        const draw = () => { n++; g.fillStyle = `hsl(${n % 360}, 55%, 38%)`; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#fff"; g.fillRect(200 + (n % 200), 420, 140, 140); requestAnimationFrame(draw); };
        draw();
        const vs = c.captureStream(30);
        let audio = [];
        try { const AC = window.AudioContext || window.webkitAudioContext; const ctx = new AC(); const osc = ctx.createOscillator(); const dest = ctx.createMediaStreamDestination(); osc.connect(dest); osc.start(); audio = dest.stream.getAudioTracks(); } catch (e) { /* silent */ }
        return { vs, audio };
      };
      const gum = async (c) => {
        const f = make();
        const tracks = [...(c && c.video ? f.vs.getVideoTracks() : []), ...(c && c.audio ? f.audio : [])];
        if (!tracks.length) { const e = new Error("none"); e.name = "NotFoundError"; throw e; }
        return new MediaStream(tracks);
      };
      const md = { getUserMedia: gum, enumerateDevices: async () => [{ kind: "videoinput", deviceId: "fake-cam" }, { kind: "audioinput", deviceId: "fake-mic" }] };
      try { if (navigator.mediaDevices) { navigator.mediaDevices.getUserMedia = gum; navigator.mediaDevices.enumerateDevices = md.enumerateDevices; } else Object.defineProperty(navigator, "mediaDevices", { value: md, configurable: true }); }
      catch (e) { Object.defineProperty(navigator, "mediaDevices", { value: md, configurable: true }); }
    });
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* film one clip and send it, from an open thread */
  const filmAndSend = async (page, text, shot, tag, { area, note } = {}) => {
    await tap(page, '[data-tour="thread-clip"]', 1200);
    await page.waitForFunction(() => { const v = document.querySelector('[data-tour="capture"] video'); return !!v && !!v.srcObject; }, null, { timeout: 8000 }).catch(() => {});
    const live = await page.evaluate(() => { const v = document.querySelector('[data-tour="capture"] video'); return !!v && !!v.srcObject; });
    await tap(page, '[data-tour="capture-shutter"]', 1500);
    await tap(page, '[data-tour="capture-shutter"]', 1500);
    const sheet = (await page.locator('[data-tour="clip-send"]').count()) === 1;
    const t = await text();
    await shot(`${tag}-send-sheet`);
    if (area) await page.locator('[data-tour="clip-focus"] button', { hasText: area }).first().click().catch(() => {});
    if (note) await page.locator("textarea").last().fill(note).catch(() => {});
    await page.getByRole("button", { name: "Send", exact: true }).last().click(); await page.waitForTimeout(1200);
    return { live, sheet, t };
  };

  try {
    const lessonsBefore = db.lessons.length;
    /* ---------- the player ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Chat"]', 900);
      await page.locator("button", { hasText: "Niamh Byrne" }).first().click(); await page.waitForTimeout(900);
      check("(a) the thread with the coach carries a camera beside the message field", (await page.locator('[data-tour="thread-clip"]').count()) === 1, (await text()).slice(-120));
      await shot("01-thread");
      const r = await filmAndSend(page, text, shot, "02", { area: "Chipping", note: "Is my weight too far back?" });
      check("(b) the camera comes up live; Stop opens the send sheet naming the coach and the clip", r.live && r.sheet && /Send to Niamh Byrne/.test(r.t) && /Clip/.test(r.t), r.t.slice(0, 120));
      const sent = db.lessons.slice(lessonsBefore).find((l) => l.sent_by === IDS.adult);
      check("(c) Send writes the player's own lesson row: sent_by them, for them, to their coach, about Chipping, with the note", !!sent && sent.player_id === IDS.adult && sent.coach_id === IDS.coach && sent.focus === "Chipping" && sent.notes === "Is my weight too far back?" && sent.kind === "private", JSON.stringify(sent));
      const t3 = await text();
      check("(c2) the toast says Sent, naming the coach, and the thread is back", /Sent/.test(t3) && /Niamh/.test(t3) && (await page.locator('[data-tour="clip-send"]').count()) === 0, t3.slice(-160));
      const upOk = await until(() => sent && db.uploads.some((u) => u.bucket === "media" && u.path.startsWith(`${IDS.adult}/${sent.id}/`) && !u.refused) && db.media.some((m) => m.lesson_id === sent.id && m.kind === "video"));
      check("(d) the clip uploads behind the player's back, under their own folder, and is attached to the lesson", upOk, JSON.stringify(db.uploads.map((u) => [u.path, u.refused])));
      const msg = db.messages.find((m) => m.lesson_id === (sent && sent.id));
      check("(e) one line in the thread carries the clip", !!msg && msg.sender_id === IDS.adult && msg.player_id === IDS.adult && /clip/i.test(msg.body), JSON.stringify(msg));
      await page.waitForTimeout(900);
      const card = page.locator('[data-tour="thread-clip-card"]');
      check("(e2) …drawn in the bubble as Open the clip", (await card.count()) >= 1 && /Open the clip/.test(await text()), (await text()).slice(-200));
      await shot("03-thread-card");
      await card.first().click(); await page.waitForTimeout(1200);
      const t4 = await text();
      check("(e3) …which opens the clip as a lesson of theirs, with the note and the coach named", /Chipping/.test(t4) && /Niamh Byrne/.test(t4) && /weight too far back/.test(t4), t4.slice(0, 200));
      await shot("04-player-lesson");
      const told = db.notifications.filter((n) => n.data && n.data.id === (sent && sent.id));
      check("(f) the coach is told once — Cian sent a clip · Chipping, landing on the lesson — and the player is not", told.length === 1 && told[0].user_id === IDS.coach && told[0].kind === "clip" && told[0].title === "Cian sent a clip" && told[0].body === "Chipping" && told[0].data.screen === "lesson", JSON.stringify(told.map((n) => [n.user_id === IDS.coach ? "coach" : "other", n.kind, n.title])));
      await ctx.close();
    }

    /* ---------- a parent, for a child ---------- */
    {
      const { ctx, page, text, shot } = await boot("parent");
      await tap(page, '[aria-label="Chat"]', 900);
      const row = page.locator("button", { hasText: "For Saoirse" }).first();
      check("(g) the child's thread is listed for the parent", (await row.count()) === 1, (await text()).slice(0, 200));
      await row.click(); await page.waitForTimeout(900);
      check("(g2) …and carries the camera", (await page.locator('[data-tour="thread-clip"]').count()) === 1, (await text()).slice(-120));
      const r = await filmAndSend(page, text, shot, "05", {});
      const sentK = db.lessons.find((l) => l.sent_by === IDS.parent);
      check("(h) the parent's send is the child's lesson, sent by the parent, named for the child on the sheet", r.sheet && /for Saoirse/.test(r.t) && !!sentK && sentK.player_id === IDS.junior && sentK.coach_id === IDS.coach && sentK.focus === "Practice", JSON.stringify({ t: r.t.slice(0, 100), sentK }));
      const toldK = db.notifications.filter((n) => n.data && n.data.id === (sentK && sentK.id));
      check("(h2) the coach is told Saoirse sent a clip; neither the child nor the parent is", toldK.length === 1 && toldK[0].user_id === IDS.coach && toldK[0].title === "Saoirse sent a clip", JSON.stringify(toldK.map((n) => n.title)));
      await ctx.close();
    }

    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      const job = page.locator('[data-tour="today-review"]');
      check("(i) the coach's home carries To review · 2 under Actions", (await job.count()) === 1 && /2/.test(M.norm(await job.innerText())), (await job.count()) ? await job.innerText() : (await text()).slice(0, 200));
      await shot("06-coach-home");
      await tap(page, '[data-tour="today-review"]', 900);
      const rows = page.locator("[data-clip-row]");
      const rt = []; for (let i = 0; i < await rows.count(); i++) rt.push(M.norm(await rows.nth(i).innerText()));
      check("(j) To review lists both clips with the player's name and what they are about", rt.length === 2 && rt.some((x) => /Cian Murphy.*Chipping/.test(x)) && rt.some((x) => /Saoirse Kelly.*Practice/.test(x)), JSON.stringify(rt));
      await shot("07-to-review");
      await rows.filter({ hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1500);
      const t5 = await text();
      check("(k) the clip opens as a lesson page with Mark it up on offer", /Chipping/.test(t5) && (await page.locator('[data-tour="lesson-markup"]').count()) >= 1, t5.slice(0, 200));
      await shot("08-coach-lesson");
      const sent = db.lessons.find((l) => l.sent_by === IDS.adult);
      const seen = await until(() => sent && sent.unread === false, 6000);
      check("(k2) opening it marks it seen", seen, JSON.stringify({ unread: sent && sent.unread }));
      await tap(page, '[aria-label="Back"]', 700); await tap(page, '[aria-label="Back"]', 900);
      const job2 = page.locator('[data-tour="today-review"]');
      check("(k3) …so To review now counts one", (await job2.count()) === 1 && /1/.test(M.norm(await job2.innerText())), (await job2.count()) ? await job2.innerText() : "gone");
      await tap(page, '[aria-label="Alerts"]', 900);
      const line = page.locator("button").filter({ hasText: "Cian sent a clip" }).first();
      check("(l) the bell carries Cian sent a clip with Cian's initials as the face", (await line.count()) === 1 && /CM/.test(M.norm(await line.innerText())), (await line.count()) ? await line.innerText() : (await text()).slice(0, 160));
      await line.click(); await page.waitForTimeout(1200);
      check("(l2) …and the tap lands on the coach's own lesson page", /Chipping/.test(await text()) && (await page.locator('[data-tour="lesson-markup"]').count()) >= 1, (await text()).slice(0, 120));
      await ctx.close();
    }

    /* ---------- a project whose SQL has not been re-run ---------- */
    {
      db.missingColumns = { lessons: ["sent_by"] };
      const { ctx, page, text } = await boot("adult");
      await tap(page, '[aria-label="Chat"]', 900);
      await page.locator("button", { hasText: "Niamh Byrne" }).first().click(); await page.waitForTimeout(900);
      check("(m) without the column the thread offers no camera, and nothing else changes", (await page.locator('[data-tour="thread-clip"]').count()) === 0 && (await page.locator('[data-tour="thread-send"]').count()) === 1, (await text()).slice(-120));
      await ctx.close();
      db.missingColumns = null;
    }

    check("(n) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
