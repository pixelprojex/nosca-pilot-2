/* ASK FOR A RATING, FROM THE LOGGED BURST. The tap answers on the burst
   itself — the button turns into Asked — the lesson is marked, the player
   is told by name and lands on the lesson, where the ask sits and opens
   the rating sheet; the burst clears itself once asked. A project whose
   lessons table has no rating_requested column says why on the burst
   and offers the tap again. Usage: node rating.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4398), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  return db;
}

const { check, results, summary } = M.checker("rating");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* the coach logs Chipping for Cian and lands on the burst */
  const logOne = async (page) => {
    await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 900);
    await page.locator('button[aria-label="Cian Murphy"]').first().click(); await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Chipping", exact: true }).click(); await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Log it", exact: true }).click(); await page.waitForTimeout(1600);
  };
  const burst = (page) => page.locator('[aria-live="polite"]').first();

  try {
    const db = freshDb();
    /* ---------- the coach asks ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "coach");
      await logOne(page);
      const ask = burst(page).locator('button[data-ask]');
      check("(a) the burst carries Ask for a rating", (await ask.count()) === 1 && /Ask for a rating/.test(M.norm(await ask.innerText())), M.norm(await text()).slice(0, 160));
      await shot("01-burst");
      await ask.click(); await page.waitForTimeout(1000);
      const lesson = db.lessons.find((l) => l.player_id === IDS.adult);
      check("(b) the tap answers on the burst: the button reads Asked", (await burst(page).locator('button[data-ask="done"]').count()) === 1 && /Asked/.test(M.norm(await burst(page).innerText())), M.norm(await burst(page).innerText().catch(() => "gone")).slice(0, 160));
      await shot("02-asked");
      check("(c) the lesson is marked rating_requested", !!lesson && lesson.rating_requested === true, JSON.stringify(lesson && { rating_requested: lesson.rating_requested }));
      const n = db.notifications.find((x) => x.user_id === IDS.adult && x.kind === "rating");
      check("(d) the player is told, by the coach's first name, and the tap lands on the lesson", !!n && n.title === "Niamh asked for a rating" && n.body === "Chipping" && n.data.screen === "lesson" && n.data.id === lesson.id, JSON.stringify(n));
      await page.waitForTimeout(1800);
      const t1 = M.norm(await text());
      check("(e) once asked, with nothing else to offer, the burst clears itself and the coach is on Today", (await burst(page).count()) === 0 && /Today/.test(t1), t1.slice(0, 120));
      await ctx.close();
    }
    /* ---------- the player is asked ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "adult");
      await tap(page, '[aria-label="Alerts"]', 900);
      const tb = M.norm(await text());
      check("(f) the bell carries the ask, named", /Niamh asked for a rating/.test(tb) && /Chipping/.test(tb), tb.slice(0, 200));
      await page.getByText("Niamh asked for a rating").first().click(); await page.waitForTimeout(1400);
      const tl = M.norm(await text());
      check("(g) it lands on the lesson, where the ask sits as a line", /Chipping/.test(tl) && /Niamh asked for a rating/.test(tl), tl.slice(0, 200));
      await shot("03-player-lesson");
      await page.getByRole("button", { name: /asked for a rating/ }).first().click(); await page.waitForTimeout(900);
      const ts = M.norm(await text());
      /* the review is the real one — per coach, written by submitReview on
         the coach's profile — not a sheet that thanks and forgets */
      check("(h) the line opens the coach's profile, where the review is left for real", /Niamh Byrne/.test(ts) && /Leave a review/.test(ts) && /Submit review/.test(ts) && (await page.locator('[data-tour="coach-review"] button').count()) >= 6, ts.slice(0, 200));
      await shot("04-leave-review");
      await ctx.close();
    }
    /* ---------- a project whose table cannot take the ask ---------- */
    {
      const db2 = freshDb(); db2.missingColumns = { lessons: ["rating_requested"] };
      const { ctx, page, shot } = await boot(db2, "coach");
      await logOne(page);
      await burst(page).locator('button[data-ask]').click(); await page.waitForTimeout(1000);
      const err = burst(page).locator('[data-tour="burst-ask-error"]');
      check("(i) a refused ask is said on the burst, and the tap is offered again", (await err.count()) === 1 && /rating_requested/.test(M.norm(await err.innerText())) && (await burst(page).locator('button[data-ask="error"]').count()) === 1 && /Try again/.test(M.norm(await burst(page).innerText())), M.norm(await burst(page).innerText().catch(() => "gone")).slice(0, 200));
      check("(j) …and no notification went out", !db2.notifications.some((x) => x.kind === "rating"));
      await shot("05-refused");
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
