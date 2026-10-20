/* THE DRILL LIBRARY AND THE REMINDER HOUR. The Drills tab is what is to
   do plus the latest set; "All N drills" under it opens every drill ever
   set, by the day it was set, newest day first, done ones ticked, with a
   search above eight. A drill ticked on the tab stays on it for the
   sitting. The Reminder row at the foot of Drills (and in Settings) sets
   preferences.reminder_time on the hour; a project without the column
   shows no row anywhere; a coach without a coach of their own has none.
   The coach's own library (Settings › Drills): the starter set while
   nothing is saved, and the first change writes that list with the
   change in it — a drill written joins the twelve, the bin leaves
   eleven, Saved and Removed only once the preferences hold it, a
   refused write said and undone, the last drill without a bin, a name
   already there said rather than Saved, the Set-drills sheet saying a
   refused write, a drill binned on another phone staying gone, and the
   log taking a typed name it already has as that drill.
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
    /* ---------- THE COACH'S LIBRARY: nothing toasts and pretends ----------
       A coach with nothing saved reads the sport's twelve starter drills.
       The first change writes that list with the change in it: a drill
       written joins the twelve, a drill binned leaves eleven, and Saved or
       Removed is said only once the coach's preferences hold it. */
    {
      const GOLF = 12;
      const stored = (d) => (((d.prefs[IDS.coach] || {}).custom_drills) || {}).golf || null;
      const libRows = (page) => page.evaluate(() => [...document.querySelectorAll(".nsc-list > div > button[aria-expanded]")].map((b) => ((b.querySelector("span span") || b).innerText || "").trim()));
      const openLibrary = async (page) => { await tap(page, '[aria-label="Your profile"]', 900); await tap(page, '[data-tour="settings-library"]', 900); };
      const bin = async (page, name) => {
        const row = page.locator(".nsc-list > div > button[aria-expanded]", { hasText: name });
        if (!(await row.count())) return false;
        await row.first().click(); await page.waitForTimeout(350);
        const del = page.locator('[aria-label="Delete"]');
        if (!(await del.count())) return false;
        await del.first().click(); await page.waitForTimeout(450); return true;
      };
      const writeOne = async (page, name) => {
        await tap(page, '[data-tour="library-new"]', 500);
        await page.locator('input[placeholder="Drill name"]').first().fill(name); await page.waitForTimeout(200);
        await page.getByRole("button", { name: "Save", exact: true }).first().click(); await page.waitForTimeout(450);
      };

      /* a drill written first, then a starter drill binned, then a reload */
      const dbA = freshDb();
      {
        const { ctx, page, text, shot } = await boot(dbA, "coach");
        await openLibrary(page);
        const r0 = await libRows(page);
        check("(c1) Settings › Drills opens a coach with nothing saved on the sport's twelve starter drills, and writes nothing",
              r0.length === GOLF && r0.includes("Gate drill") && /12 drills/.test(await text()) && stored(dbA) === null, JSON.stringify({ n: r0.length, stored: stored(dbA) }));
        await writeOne(page, "Wedge ladder");
        const saidSaved = /Saved/.test(await text());
        await page.waitForTimeout(1200);
        const r1 = await libRows(page), s1 = stored(dbA) || [];
        check("(c2) the first drill a coach writes joins the twelve — Wedge ladder first, Gate drill still there, 13 drills",
              r1.length === GOLF + 1 && r1[0] === "Wedge ladder" && r1.includes("Gate drill") && /13 drills/.test(await text()), JSON.stringify(r1));
        check("(c3) …Saved is said, and the coach's preferences hold all thirteen, with no session counts in them",
              saidSaved && s1.length === GOLF + 1 && s1[0].t === "Wedge ladder" && s1.some((d) => d.t === "Gate drill") && s1.every((d) => !("uses" in d)), JSON.stringify({ saidSaved, n: s1.length, first: s1[0] }));
        await shot("10-coach-library-written");
        const binned = await bin(page, "Gate drill");
        const saidRemoved = /Removed/.test(await text());
        await page.waitForTimeout(1200);
        const r2 = await libRows(page), s2 = stored(dbA) || [];
        check("(c4) the bin on a starter drill takes it away for real: Removed, twelve left, Gate drill gone from the screen and the preferences",
              binned && saidRemoved && r2.length === GOLF && !r2.includes("Gate drill") && s2.length === GOLF && !s2.some((d) => d.t === "Gate drill"), JSON.stringify({ binned, saidRemoved, rows: r2.length, stored: s2.length }));
        await ctx.close();
      }
      {
        const { ctx, page } = await boot(dbA, "coach");
        await openLibrary(page);
        const r3 = await libRows(page);
        check("(c5) signed in again, the library is what was left: Wedge ladder there, Gate drill not, twelve in all",
              r3.length === GOLF && r3.includes("Wedge ladder") && !r3.includes("Gate drill") && r3.includes("Step drill"), JSON.stringify(r3));
        await ctx.close();
      }

      /* the bin before anything is written */
      {
        const dbB = freshDb();
        const { ctx, page, text } = await boot(dbB, "coach");
        await openLibrary(page);
        const binned = await bin(page, "Gate drill");
        const said = /Removed/.test(await text());
        await page.waitForTimeout(1200);
        const r = await libRows(page), s = stored(dbB) || [];
        check("(c6) the bin on a starter drill with nothing saved writes the other eleven — never Removed over an untouched list",
              binned && said && r.length === GOLF - 1 && !r.includes("Gate drill") && s.length === GOLF - 1 && !s.some((d) => d.t === "Gate drill"), JSON.stringify({ binned, said, rows: r, stored: s.length }));
        await ctx.close();
      }

      /* the Set-drills sheet writes into the same list */
      {
        const dbC = freshDb();
        const { ctx, page, text } = await boot(dbC, "coach");
        await tap(page, '[aria-label="Roster"]', 900);
        await page.locator('[data-tour="roster-row"]').first().click(); await page.waitForTimeout(900);
        const drillsTile = '[data-tour="player-actions"] button[aria-label="Drills"]';
        await tap(page, drillsTile, 900);
        await page.locator('input[placeholder="Drill name"]').first().fill("Wall drill"); await page.waitForTimeout(250);
        await page.locator("button", { hasText: /^Set 1 drill/ }).first().click(); await page.waitForTimeout(1500);
        const s = stored(dbC) || [];
        await tap(page, drillsTile, 900);
        const more = page.locator("button", { hasText: /^Show \d+ more/ });
        if (await more.count()) { await more.first().click(); await page.waitForTimeout(300); }
        const t = M.norm(await text());
        check("(c7) a drill written in the Set-drills sheet joins the library: the sheet opened again offers it and every starter drill",
              s.length === GOLF + 1 && s[0].t === "Wall drill" && /Wall drill/.test(t) && /Gate drill/.test(t) && /Step drill/.test(t) && /3-6-9 putting/.test(t), JSON.stringify({ stored: s.map((d) => d.t), sheet: t.slice(0, 200) }));
        await ctx.close();
      }

      /* the log's drill list */
      {
        const dbD = freshDb();
        const { ctx, page } = await boot(dbD, "coach");
        await tap(page, '[data-tour="quick"]', 900);
        await tap(page, '[data-tour="quick-log"]', 900);
        const who = page.locator('input[aria-label="Search"]').first();
        await who.fill("Cian"); await page.waitForTimeout(300); await who.press("Enter"); await page.waitForTimeout(700);
        await tap(page, '[data-tour="wiz-drills"]', 600);
        const listed = () => page.evaluate(() => { const tile = document.querySelector('[data-tour="wiz-drills"]'); const box = tile && tile.closest(".px-6"); return box ? [...box.querySelectorAll("button[aria-pressed]")].map((b) => ({ t: (b.innerText || "").trim(), on: b.getAttribute("aria-pressed") === "true" })).filter((x) => x.t) : []; });
        const before = await listed();
        const add = page.locator('input[placeholder="Add a drill"]').first();
        await add.fill("Wall drill"); await add.press("Enter"); await page.waitForTimeout(1500);
        const after = await listed(), s = stored(dbD) || [];
        const walls = after.filter((x) => x.t === "Wall drill");
        check("(c8) a drill added on the log sits under the eight once, ticked — the eight stay — and joins the library",
              before.length === 8 && after.length === 9 && JSON.stringify(after.slice(0, 8).map((x) => x.t)) === JSON.stringify(before.map((x) => x.t)) && walls.length === 1 && walls[0].on && s.length === GOLF + 1,
              JSON.stringify({ before: before.map((x) => x.t), after: after.map((x) => x.t), stored: s.length }));
        await ctx.close();
      }

      /* a refused write pretends nothing */
      {
        const dbE = freshDb(); dbE.missingColumns = { preferences: ["custom_drills"] };
        const { ctx, page, text } = await boot(dbE, "coach");
        await openLibrary(page);
        await writeOne(page, "Wedge ladder");
        const t1 = await text();
        await page.waitForTimeout(1200);
        const r1 = await libRows(page);
        const kept = await page.locator('input[placeholder="Drill name"]').first().inputValue().catch(() => "");
        check("(c9) a refused write is said and pretends nothing: no Saved, no Wedge ladder in the list, the name still in the field",
              !/Saved/.test(t1) && /does not exist/.test(t1) && !r1.includes("Wedge ladder") && r1.length === GOLF && kept === "Wedge ladder", JSON.stringify({ toast: t1.match(/Saved|column[^.]*exist/), rows: r1.length, kept }));
        await ctx.close();
      }
      {
        const dbE2 = freshDb(); dbE2.missingColumns = { preferences: ["custom_drills"] };
        const { ctx, page, text } = await boot(dbE2, "coach");
        await openLibrary(page);
        const binned = await bin(page, "Gate drill");
        const t2 = await text();
        await page.waitForTimeout(1200);
        const r2 = await libRows(page);
        check("(c10) a refused bin is said and leaves the drill where it was — no Removed", binned && !/Removed/.test(t2) && /does not exist/.test(t2) && r2.includes("Gate drill") && r2.length === GOLF, JSON.stringify({ binned, toast: t2.match(/Removed|column[^.]*exist/), rows: r2.length }));
        await ctx.close();
      }

      /* the last drill keeps no bin */
      {
        const dbF = freshDb();
        M.setPrefs(dbF, IDS.coach, { custom_drills: { golf: [{ t: "Only drill", d: "Ten balls, one target.", focus: "swing" }] } });
        const { ctx, page, text } = await boot(dbF, "coach");
        await openLibrary(page);
        const r = await libRows(page);
        await page.locator(".nsc-list > div > button[aria-expanded]", { hasText: "Only drill" }).first().click(); await page.waitForTimeout(350);
        const t = M.norm(await text());
        check("(c11) a library of one reads 1 drill, offers Set drills on it, and no bin — an empty list would put the twelve back",
              r.length === 1 && /1 drill\b/.test(t) && !/1 drills/.test(t) && /Set drills/.test(t) && (await page.locator('[aria-label="Delete"]').count()) === 0, JSON.stringify({ rows: r, meta: t.slice(0, 80) }));
        await ctx.close();
      }

      /* a name already in the library is said, never Saved over nothing */
      {
        const dbG = freshDb();
        const { ctx, page, text } = await boot(dbG, "coach");
        await openLibrary(page);
        await writeOne(page, "gate drill");
        const t = await text();
        const kept = await page.locator('input[placeholder="Drill name"]').first().inputValue().catch(() => "");
        check("(c12) a drill written under a name already there says so — no Saved, nothing written, the name still in the field",
              /Gate drill is already in your drills/.test(t) && !/Saved/.test(t) && stored(dbG) === null && kept === "gate drill", JSON.stringify({ toast: t.match(/already in your drills|Saved/), stored: stored(dbG), kept }));
        await ctx.close();
      }

      /* the Set-drills sheet: a refused library write is said with the drills */
      {
        const dbH = freshDb(); dbH.missingColumns = { preferences: ["custom_drills"] };
        const { ctx, page, text } = await boot(dbH, "coach");
        await tap(page, '[aria-label="Roster"]', 900);
        await page.locator('[data-tour="roster-row"]').first().click(); await page.waitForTimeout(900);
        await tap(page, '[data-tour="player-actions"] button[aria-label="Drills"]', 900);
        await page.locator('input[placeholder="Drill name"]').first().fill("Wall drill"); await page.waitForTimeout(250);
        await page.locator("button", { hasText: /^Set 1 drill/ }).first().click();
        let seen = "";
        for (let i = 0; i < 25 && !seen; i++) { await page.waitForTimeout(80); const t = M.norm(await text()); if (/drill set for Cian/.test(t)) seen = t; }
        check("(c13) a drill written in the Set-drills sheet whose library write is refused is still set, and the toast says it was not added",
              /1 drill set for Cian · not added to your drills/.test(seen) && (dbH.drills || []).some((d) => d.title === "Wall drill"), JSON.stringify({ toast: (seen.match(/1 drill set[^\n]{0,60}/) || [""])[0], drills: (dbH.drills || []).map((d) => d.title) }));
        await ctx.close();
      }

      /* two phones: a drill binned on one never comes back from the other */
      {
        const dbI = freshDb();
        const { ctx: cA, page: A } = await boot(dbI, "coach");
        await openLibrary(A);
        await writeOne(A, "Wedge ladder"); await A.waitForTimeout(900);
        const { ctx: cB, page: B } = await boot(dbI, "coach");   // B opens on the thirteen
        await bin(A, "Gate drill"); await A.waitForTimeout(1200);
        /* B sets a drill, which loads its data again with A's twelve */
        await tap(B, '[aria-label="Roster"]', 900);
        await B.locator('[data-tour="roster-row"]').first().click(); await B.waitForTimeout(900);
        await tap(B, '[data-tour="player-actions"] button[aria-label="Drills"]', 900);
        const more = B.locator("button", { hasText: /^Show \d+ more/ }); if (await more.count()) { await more.first().click(); await B.waitForTimeout(300); }
        await B.locator("button", { hasText: "Step drill" }).first().click(); await B.waitForTimeout(200);
        await B.locator("button", { hasText: /^Set 1 drill/ }).first().click(); await B.waitForTimeout(2000);
        await tap(B, '[aria-label="Roster"]', 900); await tap(B, '[aria-label="Roster"]', 900);
        await openLibrary(B);
        const rb = await libRows(B);
        await writeOne(B, "Wall drill"); await B.waitForTimeout(1200);
        const sI = stored(dbI) || [];
        check("(c14) a drill binned on one phone stays gone: the other phone reads the twelve left, and its next drill writes thirteen without it",
              !rb.includes("Gate drill") && rb.includes("Wedge ladder") && sI.length === GOLF + 1 && sI[0].t === "Wall drill" && !sI.some((d) => d.t === "Gate drill") && sI.some((d) => d.t === "Wedge ladder"),
              JSON.stringify({ B: rb.length, gateOnB: rb.includes("Gate drill"), stored: sI.length, gate: sI.some((d) => d.t === "Gate drill") }));
        await cB.close(); await cA.close();
      }

      /* the log: a drill typed under a name on the list is that drill */
      {
        const dbJ = freshDb();
        const { ctx, page } = await boot(dbJ, "coach");
        await tap(page, '[data-tour="quick"]', 900);
        await tap(page, '[data-tour="quick-log"]', 900);
        const who = page.locator('input[aria-label="Search"]').first();
        await who.fill("Cian"); await page.waitForTimeout(300); await who.press("Enter"); await page.waitForTimeout(700);
        await tap(page, '[data-tour="wiz-drills"]', 600);
        const listed = () => page.evaluate(() => { const tile = document.querySelector('[data-tour="wiz-drills"]'); const box = tile && tile.closest(".px-6"); return box ? [...box.querySelectorAll("button[aria-pressed]")].map((b) => ({ t: (b.innerText || "").trim(), on: b.getAttribute("aria-pressed") === "true" })).filter((x) => x.t) : []; });
        const gate = (await listed()).find((x) => /^Gate drill$/.test(x.t));
        if (gate) { await page.locator("button[aria-pressed]", { hasText: /^Gate drill$/ }).first().click(); await page.waitForTimeout(300); }
        const add = page.locator('input[placeholder="Add a drill"]').first();
        await add.fill("gate drill"); await add.press("Enter"); await page.waitForTimeout(1200);
        const rows = (await listed()).filter((x) => /^gate drill$/i.test(x.t));
        /* the tile counts what Log it will send: one drill, not the same one twice */
        const count = ((await page.locator('[data-tour="wiz-drills"]').first().innerText()) || "").replace(/\D+/g, " ").trim();
        check("(c15) on the log, a drill typed under a name already ticked is that drill — one row, ticked, the tile counting 1, nothing written",
              !!gate && rows.length === 1 && rows[0].on && count === "1" && stored(dbJ) === null, JSON.stringify({ gate, rows, count, stored: stored(dbJ) && stored(dbJ).length }));
        await ctx.close();
      }
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
