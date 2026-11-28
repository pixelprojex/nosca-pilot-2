#!/usr/bin/env node
/* THE FEED, IN USE: a player scrolling their lessons on a phone, the website's centrepiece film. One command:

     node website/tools/feed-demo.cjs [--dist <build>] [--port 5851] [--sport golf] [--frames <dir>] [--out <dir>]

   It builds the app against the mocked Supabase (unless --dist names a build: see lib.cjs), seeds Cian Murphy's
   lessons with real coaching clips and photographs (fixtures/: a full swing, a chip, a putt; a forehand for tennis, a
   rider over a pole for equestrian), signs in as Cian on a 390 x 844 phone with the iPhone's safe areas, and films the
   screen through the DevTools screencast while real touch gestures play the app's own feed: the lesson on screen
   plays, ½× slows it, the star fills, a swipe across the picture goes to the lesson's next file (a photo, then the
   chip), a swipe up goes to the next lesson, the sound is tried, and a swipe back down ends where it began, so the
   film loops. It writes website/assets/feed-demo.mp4 (H.264, about 19 s, under 3 MB) and feed-demo-poster.webp.
   Run it again after the app changes: the website's "Every lesson, kept." plays whatever it makes.
   Needs Playwright (PLAYWRIGHT_MODULE, else the global one) and ffmpeg. */
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");
if (!process.env.PLAYWRIGHT_MODULE) { try { process.env.PLAYWRIGHT_MODULE = path.join(execFileSync("npm", ["root", "-g"]).toString().trim(), "playwright"); } catch (e) { /* the default */ } }
const L = require("./lib.cjs");
const { M, D } = L;

const ROOT = path.resolve(__dirname, "../.."), FIX = path.join(__dirname, "fixtures");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const SPORT = opt("sport", "golf"), PORT = +opt("port", "5851"), OUT = path.resolve(opt("out", path.join(ROOT, "website", "assets")));
const FRAMES = path.resolve(opt("frames", path.join(os.tmpdir(), "nosca-feed-demo")));
const W = 390, H = 844, SCALE = +opt("scale", "1.5");

/* each sport's three newest lessons and what the coach filmed at them, newest first: [kind, fixture] */
const PLAN = {
  golf: [
    { focus: "Full swing", notes: "Tempo held all the way to the top. Feel the left side lead the way down.", files: [["video", "swing"], ["photo", "swing"], ["video", "chip"]] },
    { focus: "Chipping · Putting", notes: "Let the putter swing; never hit at it. Pace first, then line.", files: [["video", "putt"], ["photo", "putt"], ["video", "chip"]] },
    { focus: "Short game", notes: "Land it on the towel and let it run.", files: [["photo", "chip"], ["video", "chip"]] },
  ],
  tennis: [
    { focus: "Forehand", notes: "Earlier preparation and a full finish over the shoulder.", files: [["video", "forehand"], ["photo", "forehand"]] },
    { focus: "Forehand · Movement", notes: "Split step as the ball leaves their racket.", files: [["photo", "forehand"], ["video", "forehand"]] },
    { focus: "Rally", files: [["video", "forehand"]] },
  ],
  equestrian: [
    { focus: "Pole work", notes: "Rhythm held all the way down the line. Look up to the next pole.", files: [["video", "rider"], ["photo", "rider"]] },
    { focus: "Gridwork · Showjumping", notes: "Sit up through the turn and keep the leg on.", files: [["photo", "rider"], ["video", "rider"]] },
    { focus: "Flatwork", files: [["video", "rider"]] },
  ],
};
if (!PLAN[SPORT]) { console.error(`--sport ${Object.keys(PLAN).join("|")}`); process.exit(2); }

function seed() {
  const db = D.buildDb(SPORT);
  const mine = db.lessons.filter((l) => l.player_id === D.IDS.cian).sort((a, b) => b.lesson_date.localeCompare(a.lesson_date));
  const ids = new Set(mine.map((l) => l.id));
  db.media = db.media.filter((m) => !ids.has(m.lesson_id));
  PLAN[SPORT].forEach((p, i) => {
    const l = mine[i]; if (!l) return;
    l.focus = p.focus; if (p.notes) l.notes = p.notes;
    p.files.forEach(([kind, name], k) => M.addMedia(db, { lessonId: l.id, kind, path: `${D.IDS.coach}/${l.id}/${name}-${k + 1}.${kind === "video" ? "mp4" : "jpg"}`, createdAt: `${l.lesson_date}T11:${String(40 + k)}:00Z` }));
  });
  /* only what the film is about: the other lessons carry no file, and nothing on the bell */
  mine.slice(PLAN[SPORT].length).forEach((l) => { db.media = db.media.filter((m) => m.lesson_id !== l.id); });
  return db;
}

async function main() {
  let dist = opt("dist");
  if (!dist) {
    dist = path.join(os.tmpdir(), "nosca-site-mock");
    fs.rmSync(dist, { recursive: true, force: true });
    console.log(`building the app against the mock into ${dist}`);
    execFileSync("npx", ["vite", "build", "--outDir", dist], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "https://mock.supabase.co", VITE_SUPABASE_ANON_KEY: "mock", VITE_SUPPORT_EMAIL: "help@nosca.ie" } });
  }
  const server = await L.serve(path.resolve(dist), PORT);
  const browser = await L.launch();
  const db = seed();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "en-IE", timezoneId: "Europe/Dublin" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
  await page.clock.setFixedTime(new Date(D.FIXED));
  await M.attach(page, db);
  /* the coach's files: registered after the mock's own route, so it is asked first */
  await page.route(`${M.SB}/storage/v1/object/sign/**`, (route) => {
    const r = route.request(), m = new URL(r.url()).pathname.match(/\/(swing|chip|putt|forehand|rider)-\d+\.(mp4|jpg)$/);
    if (r.method() !== "GET" || !m) return route.fallback();
    const video = m[2] === "mp4";
    return route.fulfill({ status: 200, contentType: video ? "video/webm" : "image/jpeg", headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes" }, body: fs.readFileSync(path.join(FIX, m[1] + (video ? ".webm" : ".jpg"))) });
  });
  const u = Object.values(db.users).find((x) => x.id === D.IDS.cian);
  await M.injectSession(page, M.session(u, db));
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await M.settle(page, { carryOn: true });
  await page.waitForSelector('[data-feed-card="0"] video, [data-feed-card="0"] img', { timeout: 20000 });
  await page.waitForTimeout(2600);

  if (argv.includes("--probe")) return probe(page, cdp, browser, server);
  /* the film: every frame the compositor paints, with its time */
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    const file = path.join(FRAMES, `f${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });

  const hold = (s) => page.waitForTimeout(s * 1000);
  /* a thumb across the picture (clear of the glass panel and its strip, which would take the touch as a scrub), as real touch events: the app's own scroll-snap and momentum take it from there
     (the DevTools' synthetic scroll gesture lands on the picture's pause button and moves nothing) */
  const swipe = async (dx, dy, ms = 180) => {
    const x0 = dx ? W * 0.74 : W * 0.5, y0 = dy ? H * 0.56 : H * 0.36, n = 14, ease = (k) => 0.35 * k + 0.65 * k * k;   /* a flick: the thumb gathers speed and lifts while moving, so the snap carries on to the next */
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= n; i++) { const k = ease(i / n); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + dx * k, y: y0 + dy * k }] }); await page.waitForTimeout(ms / n); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  /* a tap is a touch where the control stands on the screen now (Playwright's own tap would scroll the card into view
     first, a jump no thumb makes) */
  const tapIn = async (card, sel) => {
    const b = await page.locator(`[data-feed-card="${card}"] ${sel}`).first().boundingBox({ timeout: 600 }).catch(() => null);
    if (!b || b.y < 0 || b.y + b.height > H) { console.warn(`  no ${sel} on screen on card ${card}`); return; }
    const pt = [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt }); await page.waitForTimeout(60);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  /* where each gesture left the feed (the lesson on screen) and that lesson's rail (the file on screen) */
  const where = (label) => page.evaluate(() => {
    const c = document.querySelector('[data-feed-card="0"]'); let sc = c && c.parentElement;
    while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const i = sc ? Math.round(sc.scrollTop / sc.clientHeight) : -1, card = document.querySelector(`[data-feed-card="${i}"]`);
    const rail = card && [...card.querySelectorAll("div")].find((d) => /auto|scroll/.test(getComputedStyle(d).overflowX) && d.scrollWidth > d.clientWidth + 4);
    return `lesson ${i + 1}, file ${rail ? Math.round(rail.scrollLeft / rail.clientWidth) + 1 : 1}`;
  }).then((w) => console.log(`  ${label}: ${w}`));

  await hold(1.3);
  await tapIn(0, 'button[aria-label="Slow motion"]'); await hold(1.4);           /* half speed */
  await tapIn(0, '[data-tour="feed-star"]'); await hold(1.0);                   /* starred */
  await swipe(-220, 0); await hold(1.4); await where("the lesson's photo");
  await swipe(-220, 0); await hold(1.4); await where("its second clip");
  await swipe(0, -455); await hold(1.3); await where("the next lesson");
  await tapIn(1, 'button[aria-label="Sound"]'); await hold(0.8);                /* the sound tried */
  await tapIn(1, 'button[aria-label="Mute"]'); await hold(0.5);
  await swipe(-220, 0); await hold(1.3); await where("its photo");
  await swipe(0, -455); await hold(1.3); await where("the third lesson");
  await swipe(-220, 0); await hold(1.6); await where("its clip");

  await cdp.send("Page.stopScreencast");
  await page.waitForTimeout(300);
  await browser.close(); server.close();
  if (errors.length) console.warn("page errors:", errors.slice(0, 3).join(" | "));
  if (frames.length < 60) throw new Error(`only ${frames.length} frames were painted`);

  /* each frame held until the next one, then a steady 30 a second, H.264 for every browser */
  const list = path.join(FRAMES, "list.txt");
  fs.writeFileSync(list, frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, ((frames[i + 1] || f).t - f.t) || 1 / 30).toFixed(4)}`).join("\n") + `\nfile '${frames[frames.length - 1].file}'\n`);
  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join(OUT, "feed-demo.mp4"), poster = path.join(OUT, "feed-demo-poster.webp");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,scale=600:1298:flags=lanczos,format=yuv420p",
    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-maxrate", "1500k", "-bufsize", "3000k", "-profile:v", "high", "-g", "60", "-movflags", "+faststart", mp4], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp4, "-vf", "select=eq(n\\,0)", "-frames:v", "1", "-c:v", "libwebp", "-quality", "70", poster], { stdio: "inherit" });
  const secs = (frames[frames.length - 1].t - frames[0].t).toFixed(1);
  console.log(`${frames.length} frames over ${secs} s -> ${path.relative(ROOT, mp4)} (${(fs.statSync(mp4).size / 1048576).toFixed(2)} MB), ${path.relative(ROOT, poster)} (${Math.round(fs.statSync(poster).size / 1024)} KB)`);
}
/* --probe: try the gestures and say where each one left the feed and the card's rail, filming nothing */
async function probe(page, cdp, browser, server) {
  const where = () => page.evaluate(() => {
    const c0 = document.querySelector('[data-feed-card="0"]'); const feed = c0 && c0.parentElement;
    let sc = feed; while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const rails = [...document.querySelectorAll('[data-feed-card]')].map((c) => { const r = [...c.querySelectorAll('div')].find((d) => /auto|scroll/.test(getComputedStyle(d).overflowX) && d.scrollWidth > d.clientWidth + 4); return r ? r.scrollLeft : null; });
    return { top: sc ? Math.round(sc.scrollTop) : null, ta: sc ? getComputedStyle(sc).touchAction : null, rails, hit: (document.elementFromPoint(255, 354) || {}).tagName };
  });
  console.log('start', JSON.stringify(await where()));
  await cdp.send("Input.synthesizeScrollGesture", { x: 255, y: 354, xDistance: -260, yDistance: 0, speed: 1500, gestureSourceType: "touch" }); await page.waitForTimeout(900);
  console.log('scrollGesture x', JSON.stringify(await where()));
  const drag = async (x0, y0, x1, y1, ms = 220) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
    const n = 12; for (let i = 1; i <= n; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await page.waitForTimeout(ms / n); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await drag(300, 354, 90, 360); await page.waitForTimeout(900);
  console.log('touch drag x', JSON.stringify(await where()));
  await drag(200, 560, 205, 260); await page.waitForTimeout(1200);
  console.log('touch drag y', JSON.stringify(await where()));
  await cdp.send("Input.synthesizeScrollGesture", { x: 195, y: 354, xDistance: 0, yDistance: -560, speed: 1500, gestureSourceType: "touch" }); await page.waitForTimeout(1200);
  console.log('scrollGesture y', JSON.stringify(await where()));
  await browser.close(); server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
