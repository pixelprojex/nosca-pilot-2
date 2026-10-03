/* MARK IT UP FROM THE LOG, MADE BEHIND THE COACH'S BACK. Save on a clip
   attached to the log leaves the screen at once; the clip's row reads
   Mark-up · Making… while the take is rendered off the screen, carries
   Mark it up again once the take has taken the clip's place, and Log it
   uploads the take with the lesson. Log it before the take is ready logs
   the lesson at once and the take follows it up when it is done.
   Usage: node markup-log.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4404), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  return db;
}
const clip = fs.readFileSync(path.join(__dirname, "fixtures", "clip.webm"));
const { check, results, summary } = M.checker("markup-log");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-capture", "--use-fake-ui-for-media-capture", "--autoplay-policy=no-user-gesture-required"] });
  const errors = [];
  const boot = async (db) => {
    const u = Object.values(db.users).find((x) => x.id === IDS.coach);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* the log for Cian, Chipping, a clip attached, Mark it up opened, one line drawn, Save */
  const toSave = async (page) => {
    await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
    await page.locator('button[aria-label="Cian Murphy"]').first().click(); await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Chipping", exact: true }).click(); await page.waitForTimeout(300);
    await page.locator('input[type="file"]').first().setInputFiles([{ name: "swing.webm", mimeType: "video/webm", buffer: clip }]);
    await page.waitForTimeout(700);
    await tap(page, '[data-tour="wiz-markup"]', 900);
    await page.waitForFunction(() => { const c = document.querySelector('[data-tour="markup-stage"] canvas'); return !!c && c.width > 2; }, null, { timeout: 10000 }).catch(() => {});
    const bx = await page.locator('[data-tour="markup-stage"] canvas').boundingBox();
    await page.mouse.move(bx.x + bx.width * 0.2, bx.y + bx.height * 0.7); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(bx.x + bx.width * (0.2 + 0.6 * (i / 8)), bx.y + bx.height * (0.7 + 0.05 * (i / 8)));
    await page.mouse.up(); await page.waitForTimeout(200);
    await page.locator("button", { hasText: /^Save$/ }).first().click(); await page.waitForTimeout(500);
  };
  const hostVideos = (page) => page.evaluate(() => { const h = document.getElementById("nosca-take-host"); return h ? h.querySelectorAll("video").length : 0; });
  const until = async (fn, tries = 240) => { for (let i = 0; i < tries && !(await fn()); i++) await new Promise((r) => setTimeout(r, 250)); return fn(); };

  try {
    /* ---------- the take arrives before Log it ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db);
      await toSave(page);
      const t0 = M.norm(await text());
      check("(a) Save leaves Mark it up at once, back on the log, and the clip's row reads Mark-up · Making…", !/Mark it up · /.test(t0) && /Log it/.test(t0) && (await page.locator('[data-tour="wiz-making"]').count()) === 1 && (await page.locator(".nsc-swipe").count()) === 1 && (await page.locator('[data-tour="wiz-markup"]').count()) === 0, t0.slice(0, 160));
      check("(b) …while the take is made off the screen", (await hostVideos(page)) >= 1);
      await shot("01-making");
      const arrived = await until(async () => (await page.locator('[data-tour="wiz-making"]').count()) === 0 && (await page.locator('[data-tour="wiz-markup"]').count()) === 1);
      check("(c) the take arrives and takes the clip's place on the log — one row, Mark it up on it again, the host clear", arrived && (await hostVideos(page)) === 0 && (await page.locator(".nsc-swipe").count()) === 1, M.norm(await text()).slice(0, 160));
      check("(d) nothing has been uploaded yet", db.media.length === 0);
      await shot("02-arrived");
      await page.getByRole("button", { name: "Log it", exact: true }).click(); await page.waitForTimeout(1600);
      const les = db.lessons.find((l) => l.player_id === IDS.adult);
      const got = await until(async () => db.media.some((m) => m.lesson_id === (les && les.id) && /markup-\d+\.(webm|mp4)$/.test(m.storage_path)), 60);
      const files = db.media.filter((m) => m.lesson_id === (les && les.id)).map((m) => m.storage_path.split("/").pop());
      check("(e) Log it writes the lesson and the take goes up with it, as its one clip", !!les && got && files.length === 1 && !files.some((f) => /swing\.webm$/.test(f)), JSON.stringify(files));
      await ctx.close();
    }
    /* ---------- Log it before the take is ready ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db);
      await toSave(page);
      check("(f) the row reads Making…, and Log it is there to tap", (await page.locator('[data-tour="wiz-making"]').count()) === 1 && (await page.getByRole("button", { name: "Log it", exact: true }).count()) === 1);
      await page.getByRole("button", { name: "Log it", exact: true }).click(); await page.waitForTimeout(1600);
      const les = db.lessons.find((l) => l.player_id === IDS.adult);
      check("(g) the lesson is written at once, without waiting for the take", !!les && /Logged/.test(M.norm(await text())), M.norm(await text()).slice(0, 120));
      /* the burst waits for a tap; away from it, Today carries the making */
      await page.locator('[aria-live="polite"]').first().dispatchEvent("click"); await page.waitForTimeout(900);
      const banner = page.locator('[data-tour="upload-status"]');
      const tb = M.norm((await banner.count()) ? await banner.innerText() : "");
      const already = db.media.some((m) => m.lesson_id === les.id && /markup-/.test(m.storage_path));
      check("(h) Today's banner carries it — Making 1 clip, then Uploading — until the take is on the lesson", already || /Making 1 clip|Uploading 1 file/.test(tb), tb || "no banner");
      await shot("03-today-making");
      const got = await until(async () => db.media.some((m) => m.lesson_id === les.id && /markup-\d+\.(webm|mp4)$/.test(m.storage_path)));
      const files = db.media.filter((m) => m.lesson_id === les.id).map((m) => m.storage_path.split("/").pop());
      check("(i) the take follows the lesson up when it is done — its one clip, the one it was drawn on not sent twice", got && files.length === 1, JSON.stringify(files));
      const n = db.notifications.find((x) => x.user_id === IDS.adult && /New clip on Chipping/.test(x.title));
      check("(j) a take that lands after the lesson is said to the player only if it is late news — within the half hour it rides on Lesson logged", !n, JSON.stringify(n || null));
      await until(async () => !(await banner.count()) || /attached|in\b/.test(M.norm(await banner.innerText())), 40);
      await shot("04-today-after");
      await ctx.close();
    }
    check("(k) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
