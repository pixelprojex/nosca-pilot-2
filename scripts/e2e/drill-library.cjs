/* THE DRILL LIBRARY AND THE REMINDER HOUR. The Drills tab is what is to
   do plus the latest set; "All N drills" under it opens every drill ever
   set, by the day it was set, newest day first, done ones ticked, with a
   search above eight. A drill ticked on the tab stays on it for the
   sitting. The Reminder row at the foot of Drills (and in Settings) sets
   preferences.reminder_time on the hour; a project without the column
   shows no row anywhere; a coach without a coach of their own has none.
   Usage: node drill-library.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4397), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
const at = (daysAgo, hour = 10) => { const d = new Date(Date.now() - daysAgo * 86400000); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const nice = (daysAgo) => { const d = new Date(Date.now() - daysAgo * 86400000); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`; };
const SET = [
  /* ten days ago: four, three done */
  ["Gate drill", 10, true], ["Towel drill", 10, true], ["Clock drill", 10, true], ["Ladder drill", 10, false],
  /* three days ago: three, all done */
  ["Alignment-stick drill", 3, true], ["Feet-together drill", 3, true], ["Step drill", 3, true],
  /* today: two, one done */
  ["Headcover drill", 0, true], ["Tee-peg drill", 0, false],
];
function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  SET.forEach(([title, ago, done], i) => { const r = M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title, done }); r.created_at = at(ago, 9 + i); r.due = null; });
  return db;
}

const { check, results, summary } = M.checker("drill-library");

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
  const rowsOn = async (page) => (await page.locator(".nsc-list button[aria-pressed]").allInnerTexts()).map((s) => M.norm(s).split(" By ")[0]);
  const openSettings = async (page) => { await tap(page, '[data-tour="profile-pill"]', 800); if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900); };

  try {
    const db = freshDb();
    /* ---------- the tab: to do, and the latest set ---------- */
    {
      const { ctx, page, text, shot } = await boot(db, "adult");
      await tap(page, '[aria-label="Drills"]', 900);
      const names = await rowsOn(page);
      check("(a) the Drills tab is what is to do plus today's set — the older done ones are not on it",
            names.length === 3 && names.slice(0, 2).sort().join("|") === "Ladder drill|Tee-peg drill" && names[2] === "Headcover drill", JSON.stringify(names));
      const t0 = M.norm(await text());
      check("(b) the subtitle counts what is to do, and the door under the list counts every drill ever set", /2 to do/.test(t0) && /All 9 drills/.test(t0), t0.slice(0, 160));
      check("(c) the Reminder row sits at the foot, reading eight in the morning", (await page.locator('[data-tour="drills-reminder"]').count()) === 1 && /Reminder 8:00 am/.test(M.norm(await page.locator('[data-tour="drills-reminder"]').innerText())), M.norm(await page.locator('[data-tour="drills-reminder"]').innerText().catch(() => "none")));
      await shot("01-drills-tab");

      /* a drill ticked from an older set stays on the tab for the sitting */
      await page.locator(".nsc-list button[aria-pressed]", { hasText: "Ladder drill" }).first().click(); await page.waitForTimeout(1200);
      const after = await rowsOn(page);
      const ladder = db.drills.find((d) => d.title === "Ladder drill");
      check("(d) ticking an older drill writes it done and keeps it on the tab, struck through", ladder.done === true && after.includes("Ladder drill") && (await page.locator('.nsc-list button[data-drill-done]', { hasText: "Ladder drill" }).count()) === 1, JSON.stringify({ done: ladder.done, after }));

      /* ---------- the library ---------- */
      await tap(page, '[data-tour="drills-all"]', 1000);
      const t1 = M.norm(await text());
      check("(e) All drills opens, counting the drills and the done", /All drills/.test(t1) && /9 drills · 8 done/.test(t1), t1.slice(0, 120));
      const heads = (await page.locator('[data-tour="drills-day"], .nsc-list').evaluateAll((els) => els.map((el) => el.previousElementSibling && el.previousElementSibling.innerText).filter(Boolean))).map(M.norm);
      const allHeads = (await page.evaluate(() => [...document.querySelectorAll("div.px-6 > *:first-child")].map((el) => (el.innerText || "").trim()))).filter((x) => /^(Today|Yesterday|[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2})$/.test(x));
      check("(f) the days head the list, newest first: Today, then three days ago, then ten", JSON.stringify(allHeads) === JSON.stringify(["Today", nice(3), nice(10)]), JSON.stringify({ allHeads, heads }));
      const lib = await rowsOn(page);
      check("(g) every drill is there, nine rows, under the day it was set", lib.length === 9 && lib.slice(0, 2).includes("Headcover drill") && lib.slice(0, 2).includes("Tee-peg drill") && lib.slice(-4).includes("Gate drill"), JSON.stringify(lib));
      check("(h) the done ones are ticked, the one to do is not", (await page.locator(".nsc-list button[data-drill-done]").count()) === 8 && (await page.locator('.nsc-list button[aria-pressed="false"]').count()) === 1);
      const search = page.locator('input[aria-label="Search"]');
      check("(i) a search sits above the list past eight drills", (await search.count()) === 1);
      await shot("02-library");
      await search.fill("gate"); await page.waitForTimeout(400);
      const found = await rowsOn(page);
      check("(j) the search narrows the library and keeps the day heading", found.length === 1 && found[0] === "Gate drill" && /Gate drill/.test(M.norm(await text())), JSON.stringify(found));
      await search.fill(""); await page.waitForTimeout(300);
      /* a done drill unticked here is unticked for real */
      await page.locator(".nsc-list button[aria-pressed]", { hasText: "Step drill" }).first().click(); await page.waitForTimeout(1200);
      const step = db.drills.find((d) => d.title === "Step drill");
      check("(k) a tap in the library toggles the drill in the database", step.done === false, JSON.stringify({ done: step.done }));
      await M.back(page); await page.waitForTimeout(800);
      const t2 = M.norm(await text());
      check("(l) Back lands on the Drills tab, with the unticked drill now to do", /Drills/.test(t2) && /2 to do/.test(t2) && !/All drills/.test(t2) && (await rowsOn(page)).includes("Step drill"), t2.slice(0, 120));

      /* ---------- the reminder hour ---------- */
      const rem = page.locator('[data-tour="drills-reminder"]');
      await rem.locator("button").first().click(); await page.waitForTimeout(400);
      const opts = (await rem.locator("button[aria-pressed]").allInnerTexts()).map(M.norm);
      check("(m) the row unfolds six in the morning to nine at night, on the hour", opts.length === 16 && opts[0] === "6:00 am" && opts[15] === "9:00 pm" && opts.includes("12:00 pm"), JSON.stringify(opts));
      await rem.getByRole("button", { name: "7:00 pm", exact: true }).first().click(); await page.waitForTimeout(1200);
      const pref = db.prefs[IDS.adult];
      check("(n) picking an hour writes preferences.reminder_time on the hour", !!pref && pref.reminder_time === "19:00" && /Reminder 7:00 pm/.test(M.norm(await rem.innerText())), JSON.stringify(pref && { reminder_time: pref.reminder_time }));
      await shot("03-reminder");

      /* Settings carries the same row, and a Drills row to the library */
      await openSettings(page);
      const srow = page.locator('[data-tour="settings-reminder"]');
      check("(o) Settings › Reminder reads the chosen hour", (await srow.count()) === 1 && /Reminder 7:00 pm/.test(M.norm(await srow.innerText())), M.norm(await srow.innerText().catch(() => "none")));
      await srow.locator("button").first().click(); await page.waitForTimeout(400);
      await srow.getByRole("button", { name: "6:00 am", exact: true }).first().click(); await page.waitForTimeout(1200);
      check("(p) …and changing it there writes the hour too", db.prefs[IDS.adult].reminder_time === "06:00", String(db.prefs[IDS.adult].reminder_time));
      const drow = page.locator('[data-tour="settings-drills"]');
      check("(q) Settings › Drills carries the count and opens the library", (await drow.count()) === 1 && /9 drills/.test(M.norm(await drow.innerText())), M.norm(await drow.innerText().catch(() => "none")));
      await drow.click(); await page.waitForTimeout(900);
      check("(r) …the library", /All drills/.test(M.norm(await text())));
      await ctx.close();
    }
    /* ---------- a project whose table has no reminder column ---------- */
    {
      const db2 = freshDb(); db2.missingColumns = { preferences: ["reminder_time"] };
      const { ctx, page } = await boot(db2, "adult");
      await tap(page, '[aria-label="Drills"]', 900);
      check("(s) with no reminder column the Drills tab shows no Reminder row", (await page.locator('[data-tour="drills-reminder"]').count()) === 0);
      await openSettings(page);
      check("(t) …and Settings has none either", (await page.locator('[data-tour="settings-reminder"]').count()) === 0 && (await page.locator('[data-tour="settings-view"]').count()) === 1);
      await ctx.close();
    }
    /* ---------- a coach with no coach of their own ---------- */
    {
      const db3 = freshDb();
      const { ctx, page } = await boot(db3, "coach");
      await tap(page, '[aria-label="Your profile"]', 900);
      check("(u) a coach who takes no lessons is offered no reminder hour", (await page.locator('[data-tour="settings-reminder"]').count()) === 0 && (await page.locator('[data-tour="settings-view"]').count()) === 1);
      await ctx.close();
    }
    check("(v) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
