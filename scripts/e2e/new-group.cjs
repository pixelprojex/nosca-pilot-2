/* ONE NEW GROUP SHEET. New group is one sheet whichever control opens it
   — the roster's tile, the roster's Groups-half row, the plus — headed
   "New group", a "Group name" field, the people as rows of one grouped
   box with a tick box each (PersonPicker; since 24 November — they were a
   box a person with a round radio ring), the week as a day row with the
   chosen day Duolingo's chosen answer, the coach's own times (since 24
   November — it offered a fixed eight, so a coach whose hours are 9:00,
   10:30, 12:00, 2:00, 4:00 and 5:00 could pick two of them), the weeks,
   Create group. For a long time the roster's foot row ("Create a group")
   opened a second sheet of round chips with "e.g. Saturday clinic", four
   times in a grid and a "Create · 8 Fridays from now" button — one thing
   drawn two ways under two names.
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
/* the coach's own start times; the fixed eight the sheet offered whatever they were */
const OWN = ["9:00 am", "10:30 am", "12:00 pm", "2:00 pm", "4:00 pm", "5:00 pm"];
const FIXED_EIGHT = ["8:00 am", "9:00 am", "10:00 am", "11:00 am", "2:00 pm", "3:30 pm", "4:30 pm", "5:30 pm"];
/* nine to eight on the hour: the pool a coach with no hours set has */
const NINE_TO_EIGHT = ["9:00 am", "10:00 am", "11:00 am", "12:00 pm", "1:00 pm", "2:00 pm", "3:00 pm", "4:00 pm", "5:00 pm", "6:00 pm", "7:00 pm", "8:00 pm"];

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
  /* one group already, so the roster's Groups half — and its foot row — is there; the coach's
     hours are the class study's coach's own six, Monday to Saturday */
  M.setPrefs(db, IDS.coach, { availability: { ...M.weekOf(OWN, [0, 1, 2, 3, 4, 5]), slots: OWN },
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
  const people = btns.filter((b) => b.hasAttribute("aria-pressed") && b.getAttribute("aria-label")).map((b) => {
    const tick = b.querySelector("[data-tick-box]"), g = b.closest(".nsc-group");
    return { name: b.getAttribute("aria-label"), on: b.getAttribute("aria-pressed") === "true", grouped: !!g, inList: !!b.closest(".nsc-list"), edge: getComputedStyle(b).borderTopColor,
             tick: tick ? { state: tick.getAttribute("data-tick-box"), r: parseFloat(getComputedStyle(tick).borderTopLeftRadius), w: Math.round(tick.getBoundingClientRect().width), right: Math.round(b.getBoundingClientRect().right - tick.getBoundingClientRect().right) } : null };
  });
  const groups = [...s.querySelectorAll(".nsc-group")].filter((g) => g.querySelector("button[aria-pressed][aria-label]")).map((g) => {
    const cs = getComputedStyle(g); const rows = [...g.children];
    return { rows: rows.length, edge: cs.borderTopColor, radius: cs.borderTopLeftRadius, rules: rows.slice(0, -1).map((r) => getComputedStyle(r).borderBottomWidth), last: rows.length ? getComputedStyle(rows[rows.length - 1]).borderBottomWidth : null,
             rowBorders: rows.map((r) => getComputedStyle(r).borderTopWidth) };
  });
  /* a round ring of the radio's kind anywhere among the people */
  const rings = [...s.querySelectorAll("button[aria-pressed][aria-label] span")].filter((x) => { const c = getComputedStyle(x); return Math.round(x.getBoundingClientRect().width) === 22 && parseFloat(c.borderTopLeftRadius) >= 11 && parseFloat(c.borderTopWidth) > 0; }).length;
  const days = btns.filter((b) => /^(Mo|Tu|We|Th|Fr|Sa|Su)$/.test(txt(b))).map((b) => { const r = b.getBoundingClientRect(); return { d: txt(b), bg: getComputedStyle(b).backgroundColor, fg: getComputedStyle(b).color, right: Math.round(r.right), h: Math.round(r.height) }; });
  const times = btns.filter((b) => /^\d{1,2}:\d{2} [ap]m$/.test(txt(b))).map((b) => { const r = b.getBoundingClientRect(); return { x: txt(b), on: b.getAttribute("aria-pressed") === "true", right: Math.round(r.right) }; });
  const create = btns.filter((b) => /^Create/.test(txt(b))).map((b) => ({ label: txt(b), disabled: b.disabled }));
  return { title: h ? txt(h) : null, ph: inp ? inp.placeholder : null, ink: h ? getComputedStyle(h).color : null, people, groups, rings, days, times, create,
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
      check("(b) the row opens the New group sheet: \"New group\", a \"Group name\" field, the four players, seven days, the coach's six times, Create group asleep",
        !!A && A.title === "New group" && A.ph === "Group name" && A.people.length === 4 && A.days.length === 7 && A.times.length === OWN.length && A.create.length === 1 && A.create[0].label === "Create group" && A.create[0].disabled,
        brief(A));
      /* (b3) 24 November: several are chosen, so the people are rows of ONE grouped box, each with a square
         tick box on its right — they were a box a person, each with a round ring, a radio's mark for a choice of one */
      check("(b3) the people are the rows of one grouped box on the card's line — four rows, the group's rule between them and none under the last — never a box a person",
        !!A && A.groups.length === 1 && A.groups[0].rows === 4 && A.people.every((p) => p.grouped && !p.inList) && A.groups[0].rules.every((w) => parseFloat(w) >= 1) && parseFloat(A.groups[0].last) === 0 && A.groups[0].edge === "rgb(226, 226, 231)",
        JSON.stringify(A && { groups: A.groups, people: A.people.map((p) => [p.name, p.grouped, p.inList]) }));
      check("(b4) …each row ends on a square tick box, empty at rest, 22 across at the row's right — no round radio ring anywhere among them",
        !!A && A.people.every((p) => p.tick && p.tick.state === "off" && p.tick.w === 22 && p.tick.r > 0 && p.tick.r < 11 && p.tick.right <= 20) && A.rings === 0,
        JSON.stringify(A && { ticks: A.people.map((p) => p.tick), rings: A.rings }));
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

      /* every key is filled since 23 November: the chosen day is golf's cloth tone with the hue's ink, the six others
         the quiet key in golf's pale (it was the pale face on a white key, and the ink before that); never the success green */
      const SEL_FACE = "rgb(148, 189, 158)", SEL_FG = "rgb(22, 49, 30)";   // fairway's cloth #94BD9E; its ink
      const QUIET = "rgb(219, 238, 223)";                                     // fairway's pale #DBEEDF
      const on = C ? C.days.filter((d) => d.bg === SEL_FACE) : [], off = C ? C.days.filter((d) => d.bg !== SEL_FACE) : [];
      check("(e) the chosen day is the chosen answer, golf's light colour filling it with the word in its ink; the six others are the quiet key in golf's pale; none is the success green",
        !!C && on.length === 1 && on[0].d === "Sa" && on[0].fg === SEL_FG && off.length === 6 && new Set(off.map((d) => d.bg)).size === 1 && off[0].bg === QUIET && !C.days.some((d) => d.bg === STEADY),
        C ? JSON.stringify(C.days.map((d) => `${d.d} ${d.bg}`)) : "no sheet");
      await page.locator("[data-sheet] button", { hasText: /^Th$/ }).first().click(); await page.waitForTimeout(300);
      const C2 = await shape(page);
      check("(e2) tapping Thursday moves the chosen answer to it", !!C2 && C2.days.filter((d) => d.bg === SEL_FACE).map((d) => d.d).join() === "Th", C2 ? JSON.stringify(C2.days.map((d) => `${d.d} ${d.bg}`)) : "no sheet");
      /* the coach's own times, every one: a junior clinic is after school. Two o'clock opens picked, as it always did,
         where two is one of them; five, the last, takes the pick */
      const C2b = await shape(page);
      check("(f0) the times are the coach's own six, in order, two o'clock picked — not the fixed eight (8:00, 10:00, 11:00, 3:30, 4:30 and 5:30 are none of hers)",
        !!C2b && C2b.times.map((x) => x.x).join("|") === OWN.join("|") && C2b.times.filter((x) => x.on).map((x) => x.x).join() === "2:00 pm" && !C2b.times.some((x) => FIXED_EIGHT.includes(x.x) && !OWN.includes(x.x)),
        C2b ? JSON.stringify(C2b.times) : "no sheet");
      const late = page.locator("[data-sheet] button", { hasText: /^5:00 pm$/ });
      await late.first().click(); await page.waitForTimeout(300);
      const C3 = await shape(page);
      check("(f) five in the afternoon, the coach's last, is offered and takes the pick", !!C3 && C3.times.map((x) => x.x).join("|") === OWN.join("|") && C3.times.filter((x) => x.on).map((x) => x.x).join() === "5:00 pm", C3 ? JSON.stringify(C3.times) : "no sheet");

      /* and it creates the group by id, on the day and at the time picked */
      await page.locator('[data-sheet] input[placeholder="Group name"]').fill("Thursday juniors");
      await page.locator('[data-sheet] button[aria-label="Saoirse Kelly"]').click(); await page.waitForTimeout(200);
      await page.locator('[data-sheet] button[aria-label="Eoin Breathnach"]').click(); await page.waitForTimeout(200);
      const C4 = await shape(page);
      check("(g) two people picked read as pressed rows and Create group wakes", !!C4 && C4.people.filter((p) => p.on).map((p) => p.name).sort().join("|") === "Eoin Breathnach|Saoirse Kelly" && C4.create[0] && !C4.create[0].disabled && /2 players/.test(C4.text), C4 ? `${C4.people.filter((p) => p.on).length} on · ${C4.create[0] && C4.create[0].disabled}` : "no sheet");
      check("(g2) …their tick boxes are ticked and the other two stay empty", !!C4 && C4.people.filter((p) => p.tick && p.tick.state === "on").map((p) => p.name).sort().join("|") === "Eoin Breathnach|Saoirse Kelly" && C4.people.filter((p) => p.tick && p.tick.state === "off").length === 2,
        C4 ? JSON.stringify(C4.people.map((p) => [p.name, p.tick && p.tick.state])) : "no sheet");
      await shot("04-filled");
      await page.locator("[data-sheet] button", { hasText: /^Create group$/ }).last().click(); await page.waitForTimeout(1300);
      const t1 = await text();   // the toast, while it is up
      await page.waitForTimeout(900);
      const grp = ((db.prefs[IDS.coach] || {}).groups || []).find((g) => g.name === "Thursday juniors");
      const post = db.posts.filter((x) => x.table === "bookings").pop();
      check("(h) the group is saved on the coach's preferences with the two ids, Thursday, five o'clock — and its six weeks booked in one insert under its name",
        !!grp && grp.day === 3 && grp.time === "5:00 pm" && (grp.memberIds || []).slice().sort().join("|") === [IDS.eoin, IDS.junior].sort().join("|") && !!post && post.rows.length === 6 && post.rows.every((r) => r.group_name === "Thursday juniors" && r.start_time === "5:00 pm" && !r.player_id),
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
      check("(i) at 320 the day row's seven and the coach's six times sit inside the sheet, and the page does not scroll sideways",
        !!N && N.scrollW <= 320 && N.days.every((d) => d.right <= N.right + 1) && N.times.every((x) => x.right <= N.right + 1) && N.days.length === 7 && N.times.length === OWN.length,
        N ? JSON.stringify({ scrollW: N.scrollW, right: N.right, days: N.days.map((d) => d.right), times: N.times.map((x) => x.right) }) : "no sheet");
      /* (i2) the times read whole at 320: three across, no "10:30 am" broken over two lines */
      const wrapped = await page.evaluate(() => [...document.querySelectorAll('[data-sheet] [data-tour="group-times"] button')].filter((b) => { const r = document.createRange(); r.selectNodeContents(b); return r.getClientRects().length > 1; }).map((b) => b.textContent));
      const cols = await page.evaluate(() => { const g = document.querySelector('[data-sheet] [data-tour="group-times"]'); return g ? getComputedStyle(g).gridTemplateColumns.split(" ").length : 0; });
      check("(i2) at 320 the six times sit three across, each on one line", cols === 3 && wrapped.length === 0, JSON.stringify({ cols, wrapped }));
      /* (i3) and the people's rows: the long name whole beside the tick box */
      const nameCut = await page.evaluate(() => [...document.querySelectorAll("[data-sheet] .nsc-group [data-name]")].filter((n) => n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent));
      check("(i3) at 320 every name in the group box is whole beside its tick box", nameCut.length === 0, JSON.stringify(nameCut));
      await shot("06b-at-320-people");
      await ctx.close();
    }

    /* ---------- a coach with no hours set: nine to eight on the hour ---------- */
    {
      const db = freshDb(); db.prefs[IDS.coach].availability = {}; db.prefs[IDS.coach].setup_done = true;   // no hours, and past the setup
      const { ctx, page, shot } = await boot(db, "coach");
      await fromPlus(page);
      const E = await shape(page); await shot("07-no-hours");
      check("(j) a coach who has set no hours is offered nine to eight on the hour — the pool a day switched on takes — two o'clock picked",
        !!E && E.times.map((x) => x.x).join("|") === NINE_TO_EIGHT.join("|") && E.times.filter((x) => x.on).map((x) => x.x).join() === "2:00 pm",
        E ? JSON.stringify(E.times.map((x) => x.x)) : "no sheet");
      await ctx.close();
    }

    /* ---------- a coach whose days hold a time outside the pool, and no two o'clock ---------- */
    {
      const db = freshDb();
      const av = db.prefs[IDS.coach].availability;
      av.slots = ["9:00 am", "10:30 am"];
      av.days = { 0: ["9:00 am", "10:30 am"], 1: ["9:00 am", "10:30 am"], 2: [], 3: [], 4: [], 5: ["8:00 am", "9:00 am"], 6: [] };
      const { ctx, page } = await boot(db, "coach");
      await fromPlus(page);
      const F = await shape(page);
      check("(k) the times are the pool and every time a day holds, in order — Saturday's 8:00 am among them — and with no two o'clock the first is picked",
        !!F && F.times.map((x) => x.x).join("|") === "8:00 am|9:00 am|10:30 am" && F.times.filter((x) => x.on).map((x) => x.x).join() === "8:00 am",
        F ? JSON.stringify(F.times) : "no sheet");
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
