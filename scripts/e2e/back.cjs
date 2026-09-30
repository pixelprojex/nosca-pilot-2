/* BACK PUTS YOU WHERE YOU WERE. A screen you come back to — under a
   pushed screen, or a tab away — is where you left it: the scroll, the
   card the feed was on, the filter and the List · Feed choice; a fresh
   open starts at the top. Also: the default view (a coach's List, a
   player's Feed, changed in Settings) and the tab bar's plus never
   opening on a swipe up.
   Usage: node back.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4360), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
const TODAY = M.ymd(new Date());
const FOCI = ["Short game", "Putting", "Driving", "Full swing", "Chipping", "Bunker play", "Course management", "Mental game", "Iron play", "Wedges", "Pitching", "Lag putting"];
function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  /* a dozen lessons, every one with a clip, so lists and feeds are long enough to be somewhere in */
  FOCI.forEach((focus, i) => {
    const d = new Date(2026, 8, 25 - i); const iso = M.ymd(d);
    const l = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: iso, focus, notes: `${focus} notes.` , unread: false });
    M.addMedia(db, { lessonId: l.id, kind: "video", path: `${IDS.coach}/${l.id}/clip-${i}.mp4`, createdAt: `${iso}T10:01:00Z` });
  });
  for (let i = 0; i < 6; i++) M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(new Date(Date.now() + 86400000 * (i + 1))), time: "10:00 am", status: "confirmed" });
  /* a full day today, so the coach's home is long enough to be somewhere in */
  ["10:00 am", "11:00 am", "12:00 pm", "1:00 pm", "2:00 pm", "3:00 pm", "4:00 pm", "5:00 pm", "6:00 pm"].forEach((time) => M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time, status: "confirmed" }));
  return db;
}

const { check, results, summary } = M.checker("back");
const near = (a, b, tol) => Math.abs(a - b) <= tol;

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
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* the screen's own scroll box */
  const scrollTo = (page, y) => page.evaluate((v) => { const el = document.querySelector('[data-scroll="screen"]'); if (!el) return null; el.scrollTop = v; el.dispatchEvent(new Event("scroll", { bubbles: true })); return el.scrollTop; }, y);
  const scrollOf = (page) => page.evaluate(() => { const el = document.querySelector('[data-scroll="screen"]'); return el ? el.scrollTop : null; });
  /* the feed scrolls smoothly, so the jump is made with that off and the card read back after a beat */
  const feedTo = async (page, i) => { await page.evaluate((k) => { const cards = document.querySelectorAll("[data-feed-card]"); const el = cards[0] && cards[0].closest(".overflow-y-auto"); if (!el) return null; el.style.scrollBehavior = "auto"; el.scrollTop = k * el.clientHeight; el.style.scrollBehavior = ""; el.dispatchEvent(new Event("scroll", { bubbles: true })); return true; }, i); await page.waitForTimeout(700); return feedAt(page); };
  const feedAt = (page) => page.evaluate(() => { const cards = document.querySelectorAll("[data-feed-card]"); const el = cards[0] && cards[0].closest(".overflow-y-auto"); return el ? Math.round(el.scrollTop / (el.clientHeight || 1)) : null; });
  const pointer = (page, sel, type, dx, dy) => page.evaluate(([q, t, x, y]) => {
    const el = document.querySelector(q); if (!el) return false; const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, composed: true, pointerId: 3, pointerType: "touch", isPrimary: true, clientX: r.left + r.width / 2 + x, clientY: r.top + r.height / 2 + y, button: 0, buttons: t === "pointerup" || t === "pointercancel" ? 0 : 1 }));
    return true;
  }, [sel, type, dx, dy]);

  try {
    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      /* a list, scrolled, left, and come back to */
      await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const s1 = await scrollTo(page, 260); await page.waitForTimeout(200);
      await page.locator('[data-tour="player-all-lessons"]').first().click(); await page.waitForTimeout(900);
      check("(a) the player file scrolls (a dozen lessons), and All lessons opens the archive", s1 >= 80 && /Lessons|lessons/.test(await text()), `${s1}`);
      const s2 = await scrollTo(page, 420); await page.waitForTimeout(200);
      await page.locator(".nsc-list button", { hasText: "Wedges" }).first().click(); await page.waitForTimeout(1000);
      check("(b) a lesson opened from deep in the archive", /Wedges notes/.test(await text()), (await text()).slice(0, 120));
      await tap(page, '[aria-label="Back"]', 900);
      const back1 = await scrollOf(page);
      check("(c) Back lands on the archive exactly where it was", back1 != null && near(back1, s2, 30), `${back1} vs ${s2}`);
      await tap(page, '[aria-label="Back"]', 900);
      const back2 = await scrollOf(page);
      check("(d) …and Back again lands on the player file where it was", back2 != null && near(back2, s1, 30), `${back2} vs ${s1}`);
      await shot("01-back-to-file");

      /* a fresh open starts at the top */
      await page.locator('[data-tour="player-all-lessons"]').first().click(); await page.waitForTimeout(900);
      const fresh = await scrollOf(page);
      check("(e) opening the archive again starts at the top", fresh === 0, String(fresh));

      /* a filter and the feed, kept across a lesson */
      await page.getByText("Filter", { exact: true }).first().click(); await page.waitForTimeout(500);
      await page.locator("button", { hasText: /^Kind/ }).first().click(); await page.waitForTimeout(400);
      await page.locator("button", { hasText: /^Private$/ }).first().click(); await page.waitForTimeout(500);
      const filtered = /Private/.test(await text());
      await page.locator('[data-tour="archive-view"] button', { hasText: "Feed" }).first().click(); await page.waitForTimeout(1400);
      const at = await feedTo(page, 2);
      await page.locator('[data-feed-card="2"] [data-tour="feed-open"]').first().click(); await page.waitForTimeout(1000);
      const opened = await text();
      await tap(page, '[aria-label="Back"]', 1200);
      const feedBack = await feedAt(page);
      check("(f) the archive comes back as the feed, on the card it was on", at === 2 && (await page.locator("[data-feed-card]").count()) > 2 && feedBack === 2 && /Driving/.test(opened), `at ${at} · back ${feedBack} · ${opened.slice(0, 40)}`);
      await shot("02-back-to-feed-card");
      await tap(page, 'button[aria-label="List"]', 900);
      check("(f2) …and the filter set before the feed is still set", filtered && /Private/.test(await text()), (await text()).slice(0, 160));

      /* a tab away and back keeps the home's scroll */
      await tap(page, '[aria-label="Today"]', 900);
      const h1 = await scrollTo(page, 180); await page.waitForTimeout(200);
      await tap(page, '[aria-label="Diary"]', 900);
      await tap(page, '[aria-label="Today"]', 900);
      const h2 = await scrollOf(page);
      check("(g) a tab away and back keeps the home's scroll", h1 >= 100 && h2 != null && near(h2, h1, 30), `${h2} vs ${h1}`);
      /* the tab you are on goes to its top */
      await tap(page, '[aria-label="Today"]', 1200);
      const h3 = await scrollOf(page);
      check("(g2) a tap on the tab you are on goes back to its top", h3 != null && h3 < 4, `${h3}`);

      /* the plus never opens on a swipe up */
      await scrollTo(page, 0); await page.waitForTimeout(300);
      await pointer(page, '[data-tour="quick"]', "pointerdown", 0, 0);
      await page.waitForTimeout(30);
      for (let i = 1; i <= 6; i++) { await pointer(page, '[data-tour="quick"]', "pointermove", 0, -14 * i); await page.waitForTimeout(16); }
      await pointer(page, '[data-tour="quick"]', "pointercancel", 0, -90);
      await page.evaluate(() => document.querySelector('[data-tour="quick"]').dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
      await page.waitForTimeout(700);
      check("(h) a swipe up over the plus, taken by the phone, opens nothing", (await page.locator('[data-tour="quick-log"]').count()) === 0, (await text()).slice(-120));
      /* a held finger that then goes up: nothing either */
      await pointer(page, '[data-tour="quick"]', "pointerdown", 0, 0);
      await page.waitForTimeout(220);
      for (let i = 1; i <= 5; i++) { await pointer(page, '[data-tour="quick"]', "pointermove", 0, -16 * i); await page.waitForTimeout(16); }
      await pointer(page, '[data-tour="quick"]', "pointercancel", 0, -80);
      await page.waitForTimeout(700);
      check("(h2) a hold that turns into a swipe up opens nothing, and the pill stays on the tab it was on", (await page.locator('[data-tour="quick-log"]').count()) === 0 && (await page.locator('[data-tour="tab-today"][aria-current="page"]').count()) === 1, (await text()).slice(-120));
      /* a real tap still does */
      await page.waitForTimeout(500);
      await pointer(page, '[data-tour="quick"]', "pointerdown", 0, 0); await page.waitForTimeout(40);
      await pointer(page, '[data-tour="quick"]', "pointerup", 0, 0);
      await page.evaluate(() => document.querySelector('[data-tour="quick"]').dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
      await page.waitForTimeout(800);
      check("(i) a tap on the plus opens it", (await page.locator('[data-tour="quick-log"]').count()) === 1, (await text()).slice(-120));
      await page.keyboard.press("Escape").catch(() => {});
      await page.evaluate(() => { const s = document.querySelector('[data-tour="quick-log"]'); if (s) { const scrim = s.closest("[data-sheet]") || null; } });
      await page.mouse.click(195, 60).catch(() => {}); await page.waitForTimeout(600);

      /* the coach's default view is List, and Settings changes it */
      await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const listFirst = (await page.locator('[data-tour="player-view"] button[aria-label="List"]').getAttribute("aria-pressed")) === "true";
      check("(j) a coach's player file opens on List", listFirst);
      await tap(page, '[aria-label="Back"]', 600); await tap(page, '[aria-label="Your profile"]', 900);
      const row = page.locator('[data-tour="settings-view"]');
      check("(k) Settings carries Default view as the first row of Coaching, reading List", (await row.count()) === 1 && /List/.test(M.norm(await row.innerText())), M.norm((await row.count()) ? await row.innerText() : "none"));
      await row.locator("button").first().click(); await page.waitForTimeout(400);
      await row.getByRole("button", { name: /^Feed$/ }).first().click(); await page.waitForTimeout(700);
      check("(l) choosing Feed writes preferences.default_view and the phone's own copy", (db.prefs[IDS.coach] || {}).default_view === "feed" && (await page.evaluate((id) => localStorage.getItem(`nosca.view.${id}`), IDS.coach)) === "feed", JSON.stringify((db.prefs[IDS.coach] || {}).default_view));
      await tap(page, '[aria-label="Back"]', 600); await tap(page, '[aria-label="Roster"]', 700);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1200);
      check("(m) …and the player file now opens on Feed", (await page.locator("[data-feed-card]").count()) > 0, (await text()).slice(0, 100));
      await ctx.close();
    }

    /* ---------- the player ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      check("(n) a player's home opens on the feed", (await page.locator("[data-feed-card]").count()) > 0);
      const at = await feedTo(page, 3);
      await page.locator('[data-feed-card="3"] [data-tour="feed-open"]').first().click(); await page.waitForTimeout(1000);
      const t1 = await text();
      await tap(page, '[aria-label="Back"]', 1200);
      const back = await feedAt(page);
      check("(o) View lesson from the fourth card and Back lands on the fourth card", at === 3 && /Full swing/.test(t1) && back === 3, `at ${at} · back ${back} · ${t1.slice(0, 40)}`);
      await shot("03-player-back-to-card");
      /* the list for the sitting, scrolled, kept through a lesson and a tab away */
      await tap(page, 'button[aria-label="List"]', 1000);
      const s1 = await scrollTo(page, 300); await page.waitForTimeout(200);
      await page.locator('.nsc-list button', { hasText: "Wedges" }).first().click(); await page.waitForTimeout(1000);
      await tap(page, '[aria-label="Back"]', 1000);
      const s2 = await scrollOf(page);
      check("(p) Back from a lesson lands on the list where it was", (await page.locator('[data-tour="log-view"] button[aria-label="List"]').getAttribute("aria-pressed")) === "true" && s2 != null && near(s2, s1, 30), `${s2} vs ${s1}`);
      await tap(page, '[aria-label="Drills"]', 800); await tap(page, '[aria-label="Home"]', 1000);
      const s3 = await scrollOf(page);
      await tap(page, '[aria-label="Home"]', 1200);
      check("(q3) a tap on Home while on it goes back to the top of the list", (await scrollOf(page)) < 4, String(await scrollOf(page)));
      check("(q) a tab away and back keeps the list and its scroll for the sitting", (await page.locator('[data-tour="log-view"] button[aria-label="List"]').getAttribute("aria-pressed")) === "true" && s3 != null && near(s3, s1, 30), `${s3} vs ${s1}`);
      /* the Diary keeps Calendar, the month and the day across a tab away */
      await tap(page, '[aria-label="Diary"]', 900);
      await page.locator('[data-tour="cal-view"] button[aria-label="Calendar"]').first().click(); await page.waitForTimeout(700);
      /* next month, so a day ahead exists whatever today's date is */
      await page.locator('button[aria-label="Next month"]').first().click(); await page.waitForTimeout(500);
      const days = page.locator('[data-day]:not([disabled]):not([aria-pressed="true"])');
      const nDays = await days.count();
      const pickDay = nDays ? await days.nth(nDays - 1).getAttribute("data-day") : null;
      if (pickDay) { await days.nth(nDays - 1).click(); await page.waitForTimeout(500); }
      await tap(page, '[aria-label="Home"]', 900); await tap(page, '[aria-label="Diary"]', 900);
      const monthAfter = (await text()).match(/(January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d/);
      check("(q2) the Diary comes back on Calendar, in the month and on the day that were picked", !!pickDay && (await page.locator(`[data-day="${pickDay}"][aria-pressed="true"]`).count()) === 1 && (await page.locator('[data-tour="cal-view"] button[aria-label="Calendar"]').first().getAttribute("aria-pressed")) === "true" && !!monthAfter && monthAfter[0] !== `${["January","February","March","April","May","June","July","August","September","October","November","December"][new Date().getMonth()]} ${new Date().getFullYear()}`, `day ${pickDay} · ${monthAfter && monthAfter[0]} · ${(await text()).slice(0, 80)}`);
      await shot("04-diary-kept");
      /* the setting: List as the default, and the home opens on it after a reload */
      await tap(page, '[aria-label="Your profile"]', 800);
      if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 800);
      const row = page.locator('[data-tour="settings-view"]');
      check("(r) a player's Settings carries Default view first, reading Feed", (await row.count()) === 1 && /Feed/.test(M.norm(await row.innerText())), M.norm((await row.count()) ? await row.innerText() : "none"));
      await row.locator("button").first().click(); await page.waitForTimeout(400);
      await row.getByRole("button", { name: /^List$/ }).first().click(); await page.waitForTimeout(700);
      await page.reload({ waitUntil: "networkidle" }); await M.settle(page);
      check("(s) after a reload the home opens on the list, as set", (await page.locator('[data-tour="log-view"] button[aria-label="List"]').getAttribute("aria-pressed")) === "true" && (await page.locator("[data-feed-card]").count()) === 0 && (db.prefs[IDS.adult] || {}).default_view === "list", (await text()).slice(0, 100));
      await ctx.close();
    }
    check("(t) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
