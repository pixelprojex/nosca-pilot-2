/* ONE NEW GROUP SHEET. New group is one sheet whichever control opens it
   — the roster's tile, the roster's Groups-half row, the plus — headed
   "New group", a "Group name" field, the people as the app's boxed person
   rows (PersonPicker), the week as a day row with the chosen day in ink,
   every time, the weeks, Create group. For a long time the roster's foot
   row ("Create a group") opened a second sheet of round chips with
   "e.g. Saturday clinic", four times in a grid and a "Create · 8 Fridays
   from now" button — one thing drawn two ways under two names.
   Usage: node new-group.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4361), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", eoin: "00000000-0000-4000-8000-000000e01e01", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const STEADY = "rgb(46, 125, 75)";   // the success green the chosen day was filled with

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Doyle", type: "adult", coachId: IDS.coach, dob: "1993-03-03" });
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Breathnach", type: "adult", coachId: IDS.coach, dob: "1995-05-05" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* one group already, so the roster's Groups half — and its foot row — is there */
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]),
    groups: [{ id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], day: 5, time: "9:00 am", weeks: 8, sport: "golf" }] });
  return db;
}

const { check, results, summary } = M.checker("new-group");

/* what the open sheet is: its title, its field, its people, its days (with their fill), its times, its button */
const shape = (page) => page.evaluate(() => {
  const s = document.querySelector("[data-sheet]"); if (!s) return null;
  const txt = (b) => b.textContent.replace(/\s+/g, " ").trim();
  const btns = [...s.querySelectorAll("button")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const h = s.querySelector("h2"), inp = s.querySelector("input");
  const sr = s.getBoundingClientRect();
  const people = btns.filter((b) => b.hasAttribute("aria-pressed") && b.getAttribute("aria-label")).map((b) => ({ name: b.getAttribute("aria-label"), on: b.getAttribute("aria-pressed") === "true", boxed: !!b.closest(".nsc-list"), edge: getComputedStyle(b).borderTopColor }));
  const days = btns.filter((b) => /^(Mo|Tu|We|Th|Fr|Sa|Su)$/.test(txt(b))).map((b) => { const r = b.getBoundingClientRect(); return { d: txt(b), bg: getComputedStyle(b).backgroundColor, fg: getComputedStyle(b).color, right: Math.round(r.right), h: Math.round(r.height) }; });
  const times = btns.filter((b) => /^\d{1,2}:\d{2} [ap]m$/.test(txt(b))).map((b) => { const r = b.getBoundingClientRect(); return { x: txt(b), on: b.getAttribute("aria-pressed") === "true", right: Math.round(r.right) }; });
  const create = btns.filter((b) => /^Create/.test(txt(b))).map((b) => ({ label: txt(b), disabled: b.disabled }));
  return { title: h ? txt(h) : null, ph: inp ? inp.placeholder : null, ink: h ? getComputedStyle(h).color : null, people, days, times, create,
           right: Math.round(sr.right), scrollW: document.documentElement.scrollWidth, text: s.innerText.replace(/\s+/g, " ") };
});
/* the same sheet: the same title, field, people, days, times and button */
const print = (sh) => sh ? JSON.stringify({ title: sh.title, ph: sh.ph, people: sh.people.map((p) => p.name), days: sh.days.map((d) => d.d), times: sh.times.map((x) => x.x), create: sh.create.map((c) => c.label) }) : "none";
const brief = (sh) => sh ? `${sh.title} · "${sh.ph}" · ${sh.people.length} people · ${sh.days.length} days · ${sh.times.length} times · ${sh.create.map((c) => c.label).join("/")}` : "no sheet";

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, width = 390) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => errors.push(`${role}@${width}: ${String(e.message || e)}`));
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 4000 }).catch(() => {}); await page.waitForTimeout(700); };
  const fromRow = async (page) => { await tap(page, '[aria-label="Roster"]', 900); await tap(page, '[data-tour="roster-tab"] button:has-text("Groups")', 700); await tap(page, '[data-tour="roster-newgroup"]', 1000); };
  const fromTile = async (page) => { await tap(page, '[aria-label="Roster"]', 900); await tap(page, '[data-tour="roster-tab"] button:has-text("Players")', 600); await page.getByRole("button", { name: "New group", exact: true }).first().click(); await page.waitForTimeout(1000); };
  const fromPlus = async (page) => { await tap(page, '[aria-label="Today"]', 900); await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-group"]', 1000); };

  try {
    /* ---------- the three ways in open one sheet ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach");
      await tap(page, '[aria-label="Roster"]', 900); await tap(page, '[data-tour="roster-tab"] button:has-text("Groups")', 700);
      const rowText = M.norm(await page.locator('[data-tour="roster-newgroup"]').innerText());
      check("(a) the Groups half's foot row reads New group — the one name the tile and the plus carry (it read \"Create a group\")", rowText === "New group", rowText);
      await tap(page, '[data-tour="roster-newgroup"]', 1000);
      const A = await shape(page); await shot("01-from-row");
      check("(b) the row opens the New group sheet: \"New group\", a \"Group name\" field, the four players as boxed rows, seven days, every one of the eight times, Create group asleep",
        !!A && A.title === "New group" && A.ph === "Group name" && A.people.length === 4 && A.people.every((p) => p.boxed) && A.days.length === 7 && A.times.length === 8 && A.create.length === 1 && A.create[0].label === "Create group" && A.create[0].disabled,
        brief(A));
      check("(b2) no second sheet: nothing of the chips' sheet is on it — no \"e.g. Saturday clinic\", no \"picked\", no \"Name it and pick members\", no \"Show N more\"",
        !!A && !/e\.g\. Saturday clinic|Name it and pick|\bpicked\b|Show \d+ more/.test(A.text), A ? A.text.slice(0, 200) : "no sheet");
      await closeSheet(page);
      await fromPlus(page);
      const B = await shape(page); await shot("02-from-plus");
      check("(c) the plus opens the same sheet", !!B && print(B) === print(A), `${print(B)} vs ${print(A)}`);
      await closeSheet(page);
      await fromTile(page);
      const C = await shape(page); await shot("03-from-tile");
      check("(d) the roster's New group tile opens the same sheet", !!C && print(C) === print(A), `${print(C)} vs ${print(A)}`);

      /* the chosen day in ink, as a chosen tile is; the others on the wash; never the success green */
      const on = C ? C.days.filter((d) => d.bg === C.ink) : [], off = C ? C.days.filter((d) => d.bg !== C.ink) : [];
      check("(e) the chosen day is filled with the ink and reads white; the six others share one quiet fill; none is the success green",
        !!C && on.length === 1 && on[0].d === "Sa" && on[0].fg === "rgb(255, 255, 255)" && off.length === 6 && new Set(off.map((d) => d.bg)).size === 1 && !C.days.some((d) => d.bg === STEADY),
        C ? JSON.stringify(C.days.map((d) => `${d.d} ${d.bg}`)) : "no sheet");
      await page.locator("[data-sheet] button", { hasText: /^Th$/ }).first().click(); await page.waitForTimeout(300);
      const C2 = await shape(page);
      check("(e2) tapping Thursday moves the ink to it", !!C2 && C2.days.filter((d) => d.bg === C2.ink).map((d) => d.d).join() === "Th", C2 ? JSON.stringify(C2.days.map((d) => `${d.d} ${d.bg}`)) : "no sheet");
      /* every time: a junior clinic is after school */
      const late = page.locator("[data-sheet] button", { hasText: /^4:30 pm$/ });
      await late.first().click(); await page.waitForTimeout(300);
      const C3 = await shape(page);
      check("(f) half four in the afternoon is offered and takes the pick (the sheet offered the first six times, ending at half three)", !!C3 && C3.times.map((x) => x.x).join("|") === "8:00 am|9:00 am|10:00 am|11:00 am|2:00 pm|3:30 pm|4:30 pm|5:30 pm" && C3.times.filter((x) => x.on).map((x) => x.x).join() === "4:30 pm", C3 ? JSON.stringify(C3.times) : "no sheet");

      /* and it creates the group by id, on the day and at the time picked */
      await page.locator('[data-sheet] input[placeholder="Group name"]').fill("Thursday juniors");
      await page.locator('[data-sheet] button[aria-label="Saoirse Kelly"]').click(); await page.waitForTimeout(200);
      await page.locator('[data-sheet] button[aria-label="Eoin Breathnach"]').click(); await page.waitForTimeout(200);
      const C4 = await shape(page);
      check("(g) two people picked read as pressed rows and Create group wakes", !!C4 && C4.people.filter((p) => p.on).map((p) => p.name).sort().join("|") === "Eoin Breathnach|Saoirse Kelly" && C4.create[0] && !C4.create[0].disabled && /2 players/.test(C4.text), C4 ? `${C4.people.filter((p) => p.on).length} on · ${C4.create[0] && C4.create[0].disabled}` : "no sheet");
      await shot("04-filled");
      await page.locator("[data-sheet] button", { hasText: /^Create group$/ }).last().click(); await page.waitForTimeout(1300);
      const t1 = await text();   // the toast, while it is up
      await page.waitForTimeout(900);
      const grp = ((db.prefs[IDS.coach] || {}).groups || []).find((g) => g.name === "Thursday juniors");
      const post = db.posts.filter((x) => x.table === "bookings").pop();
      check("(h) the group is saved on the coach's preferences with the two ids, Thursday, half four — and its six weeks booked in one insert under its name",
        !!grp && grp.day === 3 && grp.time === "4:30 pm" && (grp.memberIds || []).slice().sort().join("|") === [IDS.eoin, IDS.junior].sort().join("|") && !!post && post.rows.length === 6 && post.rows.every((r) => r.group_name === "Thursday juniors" && r.start_time === "4:30 pm" && !r.player_id),
        JSON.stringify({ grp: grp && { day: grp.day, time: grp.time, ids: grp.memberIds }, rows: post && post.rows.map((r) => [r.booking_date, r.start_time]) }));
      check("(h2) the toast says it is created with the lessons scheduled, and the sheet is gone", /Thursday juniors created/.test(t1) && /6 lessons scheduled/.test(t1) && (await page.locator('[data-sheet] input[placeholder="Group name"]').count()) === 0, `${t1.slice(-160)} · fields ${await page.locator('[data-sheet] input[placeholder="Group name"]').count()}`);   // the sheet stays mounted while idle; its body is what goes
      await shot("05-created");
      await ctx.close();
    }

    /* ---------- 320: the sheet fits ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "coach", 320);
      await fromRow(page);
      const N = await shape(page); await shot("06-at-320");
      check("(i) at 320 the day row's seven and the eight times sit inside the sheet, and the page does not scroll sideways",
        !!N && N.scrollW <= 320 && N.days.every((d) => d.right <= N.right + 1) && N.times.every((x) => x.right <= N.right + 1) && N.days.length === 7 && N.times.length === 8,
        N ? JSON.stringify({ scrollW: N.scrollW, right: N.right, days: N.days.map((d) => d.right), times: N.times.map((x) => x.right) }) : "no sheet");
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
