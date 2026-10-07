/* LESSONS IN THE PHONE'S CALENDAR. Settings › Calendar carries the count
   of confirmed lessons ahead and hands them out as one iCalendar file —
   a VEVENT per booking, named for the other person, the booking's id as
   the UID — through the share sheet where there is one (here, a
   download). The coach's names the player or the group; a player's names
   their coach, with the club; a parent's names the child and the child's
   coach. Nothing requested and nothing past goes in; a person with
   nothing booked has no row. The search finds it by "ical".
   Usage: node calendar.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", idle: "00000000-0000-4000-8000-0000000id1e0" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const BK = { cian: "b0000000-0000-4000-8000-00000000ca01", kid: "b0000000-0000-4000-8000-00000000ca02", squad: "b0000000-0000-4000-8000-00000000ca03", asked: "b0000000-0000-4000-8000-00000000ca04", gone: "b0000000-0000-4000-8000-00000000ca05" };

const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("idle", "idle@t.ie", { role: "player", name: "Fionn Walsh", type: "adult", coachId: IDS.coach, dob: "1989-01-01" });
  M.addBooking(db, { id: BK.cian, coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 1), time: "10:00 am", duration: 45 });
  M.addBooking(db, { id: BK.kid, coachId: IDS.coach, playerId: IDS.junior, date: dayPlus(db, 3), time: "11:00 am", duration: 60 });
  M.addBooking(db, { id: BK.squad, coachId: IDS.coach, groupName: "Saturday squad", date: dayPlus(db, 5), time: "2:00 pm", duration: 60 });
  M.addBooking(db, { id: BK.asked, coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, 2), time: "4:00 pm", duration: 45, status: "requested" });
  M.addBooking(db, { id: BK.gone, coachId: IDS.coach, playerId: IDS.adult, date: dayPlus(db, -1), time: "9:00 am", duration: 45 });
  return db;
}

const { check, results, summary } = M.checker("calendar");
const stampOf = (iso, h, m) => `${iso.replace(/-/g, "")}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
const events = (ics) => (ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []).map((ev) => Object.fromEntries(ev.split(/\r?\n/).filter((l) => /^[A-Z]+:/.test(l)).map((l) => { const i = l.indexOf(":"); return [l.slice(0, i), l.slice(i + 1)]; })));

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  /* Settings, then the Calendar row, then the file it hands out */
  const openSettings = async (page) => {
    await tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 800);
    if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
  };
  const fetchIcs = async (page) => {
    const row = page.locator('[data-tour="settings-calendar"]');
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), row.click()]);
    await page.waitForTimeout(600);
    return { dl, ics: dl ? fs.readFileSync(await dl.path(), "utf8") : "", name: dl ? dl.suggestedFilename() : "" };
  };

  try {
    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await openSettings(page);
      const row = page.locator('[data-tour="settings-calendar"]');
      check("(a) Settings carries a Calendar row counting the confirmed lessons ahead — three, not the one asked for nor the one gone", (await row.count()) === 1 && /Calendar/.test(await row.innerText()) && /3 lessons/.test(await row.innerText()), (await row.count()) ? await row.innerText() : (await text()).slice(0, 200));
      await shot("01-coach-settings");
      const { dl, ics, name } = await fetchIcs(page);
      const evs = events(ics);
      check("(b) the tap hands out one iCalendar file named for the day, with a VEVENT per lesson", !!dl && /^nosca-lessons-\d{4}-\d\d-\d\d\.ics$/.test(name) && /BEGIN:VCALENDAR/.test(ics) && evs.length === 3, `${name} events=${evs.length}`);
      const cian = evs.find((e) => e.UID === `nosca-${BK.cian}@nosca.ie`);
      const kid = evs.find((e) => e.UID === `nosca-${BK.kid}@nosca.ie`);
      const squad = evs.find((e) => e.UID === `nosca-${BK.squad}@nosca.ie`);
      check("(c) each is named for the player or the group, keyed by the booking's id", !!cian && cian.SUMMARY === "Lesson · Cian Murphy" && !!kid && kid.SUMMARY === "Lesson · Saoirse Kelly" && !!squad && squad.SUMMARY === "Lesson · Saturday squad", JSON.stringify(evs.map((e) => [e.UID, e.SUMMARY])));
      check("(d) …at the booking's day and time, for its length, in the phone's own clock", !!cian && cian.DTSTART === stampOf(dayPlus(db, 1), 10, 0) && cian.DTEND === stampOf(dayPlus(db, 1), 10, 45) && !!squad && squad.DTSTART === stampOf(dayPlus(db, 5), 14, 0) && squad.DTEND === stampOf(dayPlus(db, 5), 15, 0), JSON.stringify(evs.map((e) => [e.DTSTART, e.DTEND])));
      check("(d2) nothing asked for and nothing gone is in it", !ics.includes(BK.asked) && !ics.includes(BK.gone), ics.slice(0, 200));
      const t1 = await text();
      check("(d3) the download is said", /Saved/.test(t1), t1.slice(-160));
      /* the search */
      await page.getByPlaceholder(/Search/i).first().fill("ical"); await page.waitForTimeout(500);
      check("(e) the search finds the row by ical", (await page.locator('[data-tour="settings-calendar"]').count()) === 1 && (await page.locator('[data-tour="settings-downloads"]').count()) === 0, (await text()).slice(0, 200));
      await shot("02-coach-search");
      await ctx.close();
    }

    /* ---------- the player ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await openSettings(page);
      const row = page.locator('[data-tour="settings-calendar"]');
      check("(f) a player's row counts their own confirmed lessons — one; the one asked for is not a lesson yet", (await row.count()) === 1 && /1 lesson\b/.test(await row.innerText()), (await row.count()) ? await row.innerText() : (await text()).slice(0, 200));
      await shot("03-player-settings");
      const { ics } = await fetchIcs(page);
      const evs = events(ics);
      check("(g) their file names the coach and carries the coach's club", evs.length === 1 && evs[0].SUMMARY === "Lesson · Niamh Byrne" && evs[0].LOCATION === "Portmarnock" && evs[0].UID === `nosca-${BK.cian}@nosca.ie`, JSON.stringify(evs));
      await ctx.close();
    }

    /* ---------- a parent, for a child ---------- */
    {
      const { ctx, page, text } = await boot("parent");
      await openSettings(page);
      const row = page.locator('[data-tour="settings-calendar"]');
      check("(h) a parent's row counts the child's lesson", (await row.count()) === 1 && /1 lesson\b/.test(await row.innerText()), (await row.count()) ? await row.innerText() : (await text()).slice(0, 200));
      const { ics } = await fetchIcs(page);
      const evs = events(ics);
      check("(h2) …named for the child and the child's coach", evs.length === 1 && evs[0].SUMMARY === "Lesson · Saoirse · Niamh Byrne" && evs[0].DTSTART === stampOf(dayPlus(db, 3), 11, 0) && evs[0].DTEND === stampOf(dayPlus(db, 3), 12, 0), JSON.stringify(evs));
      await ctx.close();
    }

    /* ---------- the child ---------- */
    {
      const { ctx, page, text } = await boot("junior");
      await openSettings(page);
      const row = page.locator('[data-tour="settings-calendar"]');
      check("(i) the child has the same row for their own lesson", (await row.count()) === 1 && /1 lesson\b/.test(await row.innerText()), (await row.count()) ? await row.innerText() : (await text()).slice(0, 200));
      const { ics } = await fetchIcs(page);
      const evs = events(ics);
      check("(i2) …naming their coach", evs.length === 1 && evs[0].SUMMARY === "Lesson · Niamh Byrne", JSON.stringify(evs));
      await ctx.close();
    }

    /* ---------- nothing booked ---------- */
    {
      const { ctx, page, text } = await boot("idle");
      await openSettings(page);
      check("(j) a player with nothing booked has no Calendar row — never a nought", (await page.locator('[data-tour="settings-calendar"]').count()) === 0 && /Downloads|Lesson logs/.test(await text()), (await text()).slice(0, 200));
      await ctx.close();
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
