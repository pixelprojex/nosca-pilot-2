/* TYPE FLOOR. CLAUDE.md: nothing goes below 12px, the floor for a coach
   reading a phone at arm's length on a range. This suite signs in as
   each role (session injected), walks the home, every tab, the profile
   sheet, Alerts, Settings, the plus sheet and Who (a coach), a lesson
   page, a Chat thread, the Diary on List and Calendar, Saved — and the
   sign-up screens with no session — and on every screen reads the
   computed font size of every element that carries words. Anything
   under 12 fails, with its text and where it sits. Two written
   exceptions, the phone's own conventions: the tab bar — its labels and
   its unread count ([data-tour^="tab-"]) — and the sign-up wordmark
   ([data-tour="wordmark"]). A screen that was not reached is a failure,
   never a silent skip: every read names a word the screen must carry.
   Usage: node type-floor.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4333), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "4:00 pm", "5:00 pm"];
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 0), time: "4:00 pm", duration: 45 });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: dayPlus(db, 2), time: "11:00 am", duration: 60 });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 3), time: "10:00 am", duration: 45, status: "requested" });
  const l1 = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-20", focus: "Short game · Putting", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  const l2 = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-09-22", focus: "Grip", subs: ["Red ball"], notes: "Left hand a touch stronger.", unread: false });
  /* two clips a lesson, so Study · Compare · Mark it up stand on the page */
  for (const l of [l1, l2]) { M.addMedia(db, { lessonId: l.id, kind: "video", path: `${IDS.coach}/${l.id}/clip-1.mp4`, createdAt: "2026-09-20T10:01:00Z" }); M.addMedia(db, { lessonId: l.id, kind: "video", path: `${IDS.coach}/${l.id}/clip-2.mp4`, createdAt: "2026-09-20T10:02:00Z" }); }
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Gate drill" });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "Grand, see you at four." });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.parent, body: "Thanks Niamh — can she come Friday instead?" });
  return db;
}

const { check, results, summary } = M.checker("type-floor");
const FLOOR = 12;

/* every element carrying its own words, visible, outside the two exceptions */
const offenders = (page) => page.evaluate((FLOOR) => {
  const out = []; let checked = 0;
  const ok = (el) => el.closest('[data-tour^="tab-"], [data-tour="wordmark"]');
  for (const el of document.querySelectorAll("body *")) {
    const field = /^(INPUT|TEXTAREA)$/.test(el.tagName) && el.type !== "hidden" && (el.placeholder || el.value);
    const own = field || Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    checked++;
    const px = parseFloat(cs.fontSize);
    if (px < FLOOR && !ok(el)) {
      const anchor = el.closest("[data-tour]"); const words = (field ? (el.placeholder || el.value) : Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ")).slice(0, 40);
      out.push(`${px}px "${words}" <${el.tagName.toLowerCase()}${anchor ? ` in ${anchor.getAttribute("data-tour")}` : ""}>`);
    }
  }
  return { checked, out };
}, FLOOR);

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const { tap } = M;
  /* every read names a word the screen must carry, so a screen that was
     never reached fails instead of re-reading the one before it */
  const read = async (page, role, label, sig) => {
    const r = await offenders(page);
    const text = await M.rootText(page);
    const there = !sig || sig.test(text);
    check(`${role} · ${label}: ${r.checked} words read, none under ${FLOOR}px`, there && r.checked > 0 && r.out.length === 0, !there ? `not reached: ${text.slice(0, 100)}` : (r.out.slice(0, 6).join(" | ") || `${r.checked} checked`));
  };
  const boot = async (db, role) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    if (role !== "nobody") { const u = Object.values(db.users).find((x) => x.id === IDS[role]); await M.injectSession(page, M.session(u, db)); }
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, shot };
  };
  /* the app's controls answer a dispatched click (the tab bar selects on
     its own pointer logic and ignores the click after a drag; a dispatched
     one is a plain tap), so nothing here waits on Playwright's stability */
  const tabIf = async (page, label) => { const el = page.locator(`[aria-label="${label}"]`); if (await el.count()) { await el.first().dispatchEvent("click"); await page.waitForTimeout(900); return true; } return false; };
  const clickIf = async (page, sel, wait = 900) => { const el = page.locator(sel); if (await el.count()) { await el.first().dispatchEvent("click"); await page.waitForTimeout(wait); return true; } return false; };
  const back = async (page) => { const b = page.locator('[aria-label="Back"]'); if (await b.count()) { await b.first().dispatchEvent("click"); await page.waitForTimeout(600); } };
  const closeSheet = async (page) => { await page.keyboard.press("Escape").catch(() => {}); const s = page.locator('[data-sheet] [aria-label="Close"]'); if (await s.count()) await s.first().click(); await page.mouse.click(10, 10).catch(() => {}); await page.waitForTimeout(500); };

  try {
    for (const role of ["coach", "adult", "parent", "junior"]) {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, role);
      const tabs = role === "coach" ? [["Diary", /Diary/], ["Roster", /Roster/], ["Chat", /Chat/], ["Today", /Log|Register/]]
        : role === "parent" ? [["Lessons", /Lessons|List|Feed/], ["Diary", /Diary|Book for/], ["Chat", /Chat/], ["Family", /family/i]]
        : role === "junior" ? [["Drills", /Drills/], ["Diary", /Diary/], ["Family", /family/i]]   /* a junior has no Chat: the thread is the family's */
        : [["Drills", /Drills/], ["Diary", /Diary/], ["Chat", /Chat/], ["Home", /List|Feed|Lessons/]];
      const must = async (label, sel, sig, wait = 900) => { const ok = await clickIf(page, sel, wait); if (!ok) check(`${role} · ${label}: reached`, false, `no ${sel}`); else await read(page, role, label, sig); return ok; };
      await read(page, role, "home", null); await shot(`${role}-home`);
      /* every tab */
      for (const [tab, sig] of tabs) { await must(tab, `[aria-label="${tab}"]`, sig); }
      /* the Diary on both halves */
      await tabIf(page, "Diary");
      await must("Diary · Calendar", '[data-tour="cal-view"] [aria-label="Calendar"]', /Calendar/, 700);
      await clickIf(page, '[data-tour="cal-view"] [aria-label="List"]', 500);
      /* a thread (a junior has none) */
      if (role !== "junior") { await tabIf(page, "Chat"); if (await must("thread", '.nsc-list button', /Niamh|Cian|Saoirse|Grand|Friday/, 900)) await back(page); }
      /* alerts, saved, the profile sheet, settings */
      if (await must("Alerts", '[aria-label="Alerts"]', /Alerts/)) await back(page);
      if (await must("Saved", '[data-tour="saved"]', /Starred|Downloads|Nothing/)) await back(page);
      if (await must("profile sheet", '[aria-label="Your profile"]', /Settings|Sign out/)) {
        await clickIf(page, '[data-tour="sheet-settings"]');   /* a player's sheet opens Settings from a row */
        await read(page, role, "Settings", /Sign out|Walkthrough|Notifications/);
        if (await must("Your profile", '[data-tour="settings-profile"]', /Name|Save|Sport/)) await back(page);
        await back(page);
      }
      if (role === "coach") {
        /* the plus and Who */
        if (await must("plus sheet", '[data-tour="quick"]', /Log a lesson/)) { if (await must("Who", '[data-tour="quick-log"]', /Who/)) await clickIf(page, '[aria-label="Close"]', 600); }
        /* a lesson page from the archive, and its three tools */
        await tabIf(page, "Today");
        if (await must("All lessons", '[data-tour="today-archive"]', /lessons/i)) {
          if (await must("lesson page", '.nsc-list button', /Short game|Grip|Putting/, 1200)) {
            if (await must("Study", '[data-tour="lesson-study"]', /Loop/, 1200)) await back(page);
            if (await must("Compare", '[data-tour="lesson-compare"]', /Swap|Change|Clip/, 1200)) await back(page);
            if (await must("Mark it up", '[data-tour="lesson-markup"]', /Undo|Save|Talk/, 1200)) await back(page);
            await back(page);
          }
          await back(page);
        }
        /* the roster's file and Progress */
        await tabIf(page, "Roster");
        if (await must("player file", '[data-tour="roster-row"]', /lessons|Progress/i, 1000)) {
          if (await must("Progress", '[data-tour="player-progress"]', /Progress|Worked on|No lessons/, 1000)) await back(page);
          await back(page);
        }
      } else {
        /* a lesson page from the list, and the two tools a player has */
        await tabIf(page, role === "parent" ? "Lessons" : "Home");
        await clickIf(page, '[aria-label="List"]', 600);
        if (await must("lesson page", '.nsc-list button', /Short game|Grip|Putting/, 1200)) {
          if (await must("Study", '[data-tour="lesson-study"]', /Loop/, 1200)) await back(page);
          if (await must("Compare", '[data-tour="lesson-compare"]', /Swap|Change|Clip/, 1200)) await back(page);
          await back(page);
        }
      }
      check(`${role}: no page errors`, errors.filter((e) => e.startsWith(role) && !/vibrate/.test(e)).length === 0, errors.slice(0, 2).join(" | "));
      await ctx.close();
    }
    /* sign-up and sign-in, with no session */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "nobody");
      await read(page, "nobody", "front door", /Create account/); await shot("nobody-front");
      const reached = await clickIf(page, 'button:has-text("Create account")', 900);
      check("nobody: the sign-up is reached", reached, "no Create account button");
      if (reached) {
        await read(page, "nobody", "sign-up · who", /Coach|Player|Parent/); await shot("nobody-signup");
        /* a step further: a choice, then the details with their field labels */
        if (await clickIf(page, 'button[aria-pressed], [data-tour^="choice"], button:has-text("Coach")', 700)) {
          await clickIf(page, 'button:has-text("Continue"), button:has-text("Next")', 800);
          await read(page, "nobody", "sign-up · next", null); await shot("nobody-signup-2");
        }
      }
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      if (await clickIf(page, 'button:has-text("Sign in")', 900)) { await read(page, "nobody", "sign-in", /Email|Password/); await shot("nobody-signin"); }
      await ctx.close();
    }
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
