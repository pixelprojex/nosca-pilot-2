/* THE CAMERA. Capture opens the phone's own kind of camera: the live
   picture filling the screen with no tap to start it, PHOTO · VIDEO ·
   VOICE swiped or tapped along the bottom, a shutter that becomes the
   stop, the last capture bottom-left with the roll behind it, a file
   bottom-right, and what it files under as a pill up top. Whatever is
   captured is on the lesson when it is logged.

   Usage: node capture.cjs <distDir> <port> <outDir>
   Chromium is given a fake camera and microphone. */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4230), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
const TODAY = M.ymd(new Date());

function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm", status: "confirmed" });
  return db;
}

const { check, results, summary } = M.checker("capture");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-capture", "--use-fake-ui-for-media-capture", "--autoplay-policy=no-user-gesture-required"] });
  const errors = [];
  const db = freshDb();
  const u = Object.values(db.users).find((x) => x.id === IDS.coach);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await M.injectSession(page, M.session(u, db));
  /* THE FAKE CAMERA. The test container has no media devices at all —
     Chromium's fake-device flags give it nothing, enumerateDevices() is
     empty — so getUserMedia is answered in-page with a live canvas
     stream (a moving picture, so frames flow) and an oscillator's audio
     track. The app runs its real path: stream → <video> → MediaRecorder
     or a canvas still, exactly as on a phone. */
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
  const text = () => M.rootText(page);
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
  const { tap } = M;
  const cam = page.locator('[data-tour="capture"]');
  const modeOn = async () => page.locator('[data-tour="capture-modes"] button[aria-pressed="true"]').getAttribute("aria-label");
  const stage = () => cam.locator("> div").first();
  const swipeStage = async (dx) => {
    const b = await stage().boundingBox();
    const x0 = b.x + b.width / 2 - dx / 2, y = b.y + b.height / 2;
    await page.mouse.move(x0, y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x0 + (dx * i) / 6, y);
    await page.mouse.up(); await page.waitForTimeout(250);
  };

  try {
    /* ---------- (a) the plus opens the camera, live, full screen ---------- */
    await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-capture"]', 1400);
    await page.waitForFunction(() => { const v = document.querySelector('[data-tour="capture"] video'); return !!v && !!v.srcObject; }, null, { timeout: 8000 }).catch(() => {});
    const cb = await cam.boundingBox();
    const liveNow = await page.evaluate(() => { const v = document.querySelector('[data-tour="capture"] video'); return !!v && !!v.srcObject; });
    const t0 = await text(); await shot("01-camera");
    check("(a) Capture opens the camera on the whole screen, already live, with no tap to start it", !!cb && cb.height > 800 && liveNow && !/Tap to use/.test(t0), JSON.stringify({ cb, liveNow }));
    check("(a) PHOTO · VIDEO · VOICE along the bottom, Video first; the shutter; the file; no sheet title", (await page.locator('[data-tour="capture-modes"] button').count()) === 3 && (await modeOn()) === "Video"
      && (await page.locator('[data-tour="capture-shutter"]').count()) === 1 && (await page.locator('[aria-label="Choose a file"]').count()) === 1 && !/^Capture/m.test(t0), t0.slice(0, 160));

    /* ---------- (b) what it files under ---------- */
    const pill = page.locator('[aria-label="Filing under"]');
    check("(b) the pill up top says who it files under — nobody, with no lesson on now", (await pill.count()) === 1 && /Nobody yet/.test(await pill.innerText()), await pill.innerText());
    await pill.click(); await page.waitForTimeout(300);
    check("(b) a tap cycles it to today's booking", /Cian · 4:00 pm/.test(await pill.innerText()), await pill.innerText());

    /* ---------- (c) a clip: the shutter records, the stop keeps it ---------- */
    await tap(page, '[data-tour="capture-shutter"]', 1500);
    const t1 = await text();
    check("(c) the shutter starts a clip: a red timer, Stop, the modes and the pill held", (await page.locator('[data-tour="capture-shutter"][aria-label="Stop"]').count()) === 1 && /0:0[1-3]/.test(t1)
      && (await page.locator('[data-tour="capture-modes"]').evaluate((el) => getComputedStyle(el.parentElement).pointerEvents)) === "none", t1.slice(0, 120));
    await shot("02-recording");
    await tap(page, '[data-tour="capture-shutter"]', 1500);
    check("(c) Stop keeps it: the roll bottom-left counts one", (await page.locator('[aria-label="Captured · 1"]').count()) === 1 && (await page.locator('[data-tour="capture-shutter"][aria-label="Record"]').count()) === 1);

    /* ---------- (d) a photo, by the word ---------- */
    await tap(page, '[data-tour="capture-modes"] [aria-label="Photo"]', 400);
    check("(d) tapping PHOTO switches the mode; the shutter reads Take photo", (await modeOn()) === "Photo" && (await page.locator('[data-tour="capture-shutter"][aria-label="Take photo"]').count()) === 1);
    await tap(page, '[data-tour="capture-shutter"]', 1500);
    check("(d) the shutter takes a still: the roll counts two", (await page.locator('[aria-label="Captured · 2"]').count()) === 1);
    await shot("03-photo");

    /* ---------- (e) a swipe across the picture changes the mode ---------- */
    await swipeStage(-140);
    check("(e) a swipe left moves on a mode: Photo → Video", (await modeOn()) === "Video");
    await swipeStage(-140);
    check("(e) …and again: Video → Voice, the picture dimmed behind the microphone", (await modeOn()) === "Voice" && /Voice note/.test(await text()) && (await page.locator('[data-tour="capture-shutter"][aria-label="Record voice note"]').count()) === 1);
    await shot("04-voice");
    await swipeStage(140);
    check("(e) a swipe right goes back: Voice → Video", (await modeOn()) === "Video");
    await swipeStage(-140);

    /* ---------- (f) a voice note ---------- */
    await tap(page, '[data-tour="capture-shutter"]', 1300);
    check("(f) the shutter records a voice note: Listening, Stop", /Listening/.test(await text()) && (await page.locator('[data-tour="capture-shutter"][aria-label="Stop"]').count()) === 1);
    await tap(page, '[data-tour="capture-shutter"]', 1500);
    check("(f) Stop keeps it: the roll counts three", (await page.locator('[aria-label="Captured · 3"]').count()) === 1);

    /* ---------- (g) the roll ---------- */
    await tap(page, '[aria-label="Captured · 3"]', 600);
    const t2 = await text(); await shot("05-roll");
    check("(g) the thumbnail opens the roll: Clip, Photo, Voice note, each with Remove", /Captured · 3/.test(t2) && /Clip/.test(t2) && /Photo/.test(t2) && /Voice note/.test(t2) && (await page.locator('[aria-label="Remove"]').count()) === 3, t2.slice(0, 160));
    await page.locator('[aria-label="Remove"]').nth(1).click(); await page.waitForTimeout(500);
    check("(g) Remove takes one off", (await page.locator('[aria-label="Remove"]').count()) === 2 && /Captured · 2/.test(await text()));
    await page.locator('[data-tour="capture"] [aria-label="Close"]').last().click(); await page.waitForTimeout(400);

    /* ---------- (h) close, then log: what was captured is on the lesson ---------- */
    await page.locator('[data-tour="capture"] [aria-label="Close"]').first().click(); await page.waitForTimeout(700);
    check("(h) X closes the camera", (await cam.count()) === 0);
    await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
    await page.locator('button[aria-label="Cian Murphy"]').first().click(); await page.waitForTimeout(700);
    const t3 = await text(); await shot("06-log");
    check("(h) logging Cian's lesson finds the clip and the voice note already attached, the clip with Mark it up", (await page.locator(".nsc-swipe").count()) === 2 && /Video/.test(t3) && /Voice/.test(t3)
      && (await page.locator('[data-tour="wiz-markup"]').count()) === 1, `rows ${await page.locator(".nsc-swipe").count()} · ${t3.slice(0, 160)}`);
  } catch (e) {
    results.push({ name: "run completed", ok: false, detail: String((e && e.stack) || e) });
  } finally { await browser.close(); M.stopServer(server); }

  const real = errors.filter((e) => !/vibrate/.test(e));
  check("(i) no page errors as coach", real.length === 0, real.slice(0, 3).join(" | "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "capture.json"), JSON.stringify(out, null, 2));
  process.exit(0);
})();
