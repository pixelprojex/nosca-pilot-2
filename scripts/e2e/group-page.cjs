/* A GROUP'S PAGE OPENS ITS GROUP'S WORK (24 November). The group's page
   carried Message alone; logging the clinic, taking its register and
   changing who is in it were all somewhere else. Now:
   (a) the page leads with Message · Log · Register as the app's round
       keys, three across — Log the accent, the others filled with their
       function's colour — before anything that grows with the data;
   (b) Register opens the register on the group's lesson today, its own
       roll (the members still on the roster), and a group keeps Submit;
   (c) Log opens the log with the group already picked — its name the
       log's title, its members the people — and Log it writes a group
       lesson with every member at it;
   (d) a group with no lesson today offers no Register: Message · Log are
       two tiles; a group nobody on the roster is in offers no key at all;
   (e) Edit, a row of words under the keys, opens a sheet of the roster as
       New group's picker, the members ticked, and no name field — a
       group's bookings carry its name, so it is never renamed; Save, asleep
       until something changed, writes the members by id to the coach's
       preferences, and the page reads them;
   (f) a group with lessons ahead says so in one line ("3 lessons ahead —
       End them first") and offers no removal; a group with none ahead has
       Remove group, the red quiet key, then a plain confirm (Keep it the
       way back), and Remove takes it off the coach's groups, says Removed
       and lands on the roster without it;
   (g) at 320 the keys' words, the Edit row and the sheet are whole.
   Usage: node group-page.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 5753), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", fionn: "00000000-0000-4000-8000-0000000f1047",
              parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", eoin: "00000000-0000-4000-8000-0000000e0170" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const ACCENT = "rgb(40, 89, 55)";   /* golf's fairway, #285937 */
const dayPlus = (db, n) => M.ymd(new Date(db.now() + n * 86400000));
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Doyle", type: "adult", coachId: IDS.coach, dob: "1993-02-02" });
  person("fionn", "fionn@t.ie", { role: "player", name: "Fionn Walsh", type: "adult", coachId: IDS.coach, dob: "1990-03-03" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* Eoin was in two groups and has left the roster */
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(), groups: [
    { id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Aoife Doyle", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.aoife, IDS.junior], day: 5, time: "4:00 pm", weeks: 8, sport: "golf" },
    { id: "g2", name: "Junior squad", members: ["Saoirse Kelly", "Eoin Walsh"], memberIds: [IDS.junior, IDS.eoin], day: 2, time: "5:00 pm", weeks: 6, sport: "golf" },
    { id: "g3", name: "Winter league", members: ["Eoin Walsh"], memberIds: [IDS.eoin], day: 0, time: "7:00 pm", weeks: 10, sport: "golf" },
  ] });
  /* the clinic today at four and twice more ahead; the squad's one session gone by, logged */
  M.addBooking(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: dayPlus(db, 0), time: "4:00 pm", duration: 60 });
  M.addBooking(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: dayPlus(db, 7), time: "4:00 pm", duration: 60 });
  M.addBooking(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: dayPlus(db, 14), time: "4:00 pm", duration: 60 });
  M.addBooking(db, { coachId: IDS.coach, groupName: "Junior squad", date: dayPlus(db, -7), time: "5:00 pm", duration: 60 });
  /* and one forty days back — last month or the one before, outside the calendar's six months, where a
     day key with no year would read as next year's and count as ahead */
  M.addBooking(db, { coachId: IDS.coach, groupName: "Junior squad", date: dayPlus(db, -40), time: "5:00 pm", duration: 60 });
  M.addLesson(db, { coachId: IDS.coach, groupName: "Junior squad", date: dayPlus(db, -7), focus: "Putting", unread: false });
  return db;
}

const { check, results, summary } = M.checker("group-page");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, width = 390) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    await page.clock.setFixedTime(new Date(`${dayPlus(db, 0)}T09:00:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") { const tx = m.text(); if (!/vibrate|Failed to load resource|favicon/i.test(tx)) errors.push(`${role} console: ${tx.slice(0, 160)}`); } });
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const sheetText = async (page) => M.norm(await page.locator("[data-sheet]").innerText().catch(() => ""));
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").dispatchEvent("click"); await page.waitForTimeout(700); };
  const groupsTab = async (page) => {
    await tap(page, '[aria-label="Roster"]', 900);
    await tap(page, '[data-tour="roster-tab"] button:has-text("Groups")', 700);
  };
  const openGroup = async (page, name) => { await groupsTab(page); await page.locator('[data-tour="roster-group"]', { hasText: name }).first().click(); await page.waitForTimeout(1000); };
  /* the keys at the top of the page, in order, and what they are drawn as */
  const keysOf = (page) => page.evaluate(() => {
    const box = document.querySelector('[data-tour="group-page-keys"]'); if (!box) return [];
    return [...box.querySelectorAll("button")].map((b) => {
      const face = b.querySelector("[data-face]") || b, word = [...b.querySelectorAll("span")].reverse().find((s) => !s.children.length && s.textContent.trim());
      return { tour: b.getAttribute("data-tour"), round: b.hasAttribute("data-round"), tile: b.hasAttribute("data-tile"), fill: face.hasAttribute("data-fill"), bg: getComputedStyle(face).backgroundColor,
               word: word ? word.textContent.trim() : b.textContent.trim(), cut: word ? word.scrollWidth > word.clientWidth + 1 : false };
    });
  });
  const roll = (page) => page.evaluate(() => [...document.querySelectorAll("[data-sheet] [data-reg-row]")].map((r) => r.getAttribute("data-reg-row")).sort());
  const groupOf = (db, id) => ((db.prefs[IDS.coach] || {}).groups || []).find((g) => g.id === id) || null;

  try {
    /* ---------- (a)–(c) Saturday clinic: Message · Log · Register ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openGroup(page, "Saturday clinic");
      const k = await keysOf(page);
      await shot("01-clinic-page");
      check("(a1) the clinic's page leads with three round keys, Message · Log · Register, in that order",
        k.length === 3 && k.map((x) => x.tour).join(",") === "group-page-message,group-page-log,group-page-register" && k.every((x) => x.round) && k.map((x) => x.word).join(",") === "Message,Log,Register",
        JSON.stringify(k));
      check("(a2) Log is the one action, the accent; Message and Register are filled with their function's colour", k.length === 3 && k[1].bg === ACCENT && k[0].fill && k[2].fill, JSON.stringify(k.map((x) => `${x.word}:${x.bg}:${x.fill}`)));
      const order = await page.evaluate(() => { const ks = document.querySelector('[data-tour="group-page-keys"]'), ed = document.querySelector('[data-tour="group-page-edit"]'), mem = document.querySelector('[data-tour="group-members"]');
        return ks && ed && mem ? { keysAboveEdit: ks.getBoundingClientRect().bottom <= ed.getBoundingClientRect().top, editAboveMembers: ed.getBoundingClientRect().bottom <= mem.getBoundingClientRect().top } : null; });
      check("(a3) the keys stand at the top, the Edit row under them, before the members", !!order && order.keysAboveEdit && order.editAboveMembers, JSON.stringify(order));
      /* (b) the register on today's clinic */
      await page.locator('[data-tour="group-page-register"]').first().click(); await page.waitForTimeout(1000);
      const s1 = await sheetText(page), r1 = await roll(page);
      await shot("02-clinic-register");
      check("(b1) Register opens the register on the clinic's lesson today: its own roll, the three members, 4:00 pm",
        JSON.stringify(r1) === JSON.stringify(["Aoife Doyle", "Cian Murphy", "Saoirse Kelly"]) && /Saturday clinic/.test(s1) && /4:00 pm · 3 people/.test(s1), `${JSON.stringify(r1)} · ${s1.slice(0, 120)}`);
      check("(b2) …and a group's register keeps its Submit", (await page.locator("[data-sheet] button", { hasText: /Submit register/ }).count()) === 1, s1.slice(0, 200));
      await closeSheet(page);
      /* (c) the log with the group picked, and Log it */
      await page.locator('[data-tour="group-page-log"]').first().click(); await page.waitForTimeout(1200);
      const t2 = await text();
      await shot("03-clinic-log");
      check("(c1) Log opens the log with the clinic picked: its name the title, straight to what was worked on, no Who page",
        /Saturday clinic/.test(t2) && (await page.locator('[data-tour="wiz-focus"]').count()) === 1 && (await page.locator('[data-tour="wiz-who-search"]').count()) === 0, t2.slice(0, 200));
      await page.locator('[data-tour="wiz-focus"] button').first().click(); await page.waitForTimeout(300);
      const lessonsBefore = db.lessons.length;
      await page.locator('[data-tour="wiz-next"] button').first().click(); await page.waitForTimeout(2200);
      const made = db.lessons.slice(lessonsBefore)[0];
      const at = made ? db.attendees.filter((a) => a.lesson_id === made.id).map((a) => a.player_id).sort() : [];
      check("(c2) Log it writes a group lesson for the clinic with each of its three members at it",
        !!made && made.group_name === "Saturday clinic" && made.kind === "group" && JSON.stringify(at) === JSON.stringify([IDS.adult, IDS.aoife, IDS.junior].sort()), JSON.stringify({ made: made && { g: made.group_name, k: made.kind }, at }));
      await ctx.close();
    }

    /* ---------- (d) no lesson today, and nobody on the roster ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openGroup(page, "Junior squad");
      const k = await keysOf(page);
      await shot("04-squad-page");
      check("(d1) a group with no lesson today offers no Register: Message · Log, two tiles two to a row", k.length === 2 && k.map((x) => x.tour).join(",") === "group-page-message,group-page-log" && k.every((x) => x.tile && !x.round) && (await page.locator('[data-tour="group-page-register"]').count()) === 0, JSON.stringify(k));
      await M.back(page, 800);
      await page.locator('[data-tour="roster-group"]', { hasText: "Winter league" }).first().click(); await page.waitForTimeout(1000);
      check("(d2) a group nobody on the roster is in offers no key at all — and still its Edit row", (await page.locator('[data-tour="group-page-keys"]').count()) === 0 && (await page.locator('[data-tour="group-page-edit"]').count()) === 1, (await text()).slice(0, 160));
      await ctx.close();
    }

    /* ---------- (e) Edit: who is in it, never its name ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openGroup(page, "Saturday clinic");
      const edit = await M.rowLead(page, '[data-tour="group-page-edit"]');
      check("(e1) Edit is a row of words: the word first on the box's inset, nothing before it, the chevron after", M.plainRow(edit) && edit.label === "Edit" && edit.boxed, JSON.stringify(edit));
      await page.locator('[data-tour="group-page-edit"]').first().click(); await page.waitForTimeout(900);
      const s0 = await sheetText(page);
      const people = await page.evaluate(() => [...document.querySelectorAll('[data-sheet] [data-tour="group-edit-people"] [aria-label]')].map((b) => [b.getAttribute("aria-label"), b.getAttribute("aria-pressed")]));
      await shot("05-clinic-edit");
      const on = people.filter(([, p]) => p === "true").map(([n]) => n).sort();
      check("(e2) the sheet is headed with the group, counts its three, and ticks them among the roster — Fionn unticked",
        /^Saturday clinic/.test(s0) && /3 players/.test(s0) && JSON.stringify(on) === JSON.stringify(["Aoife Doyle", "Cian Murphy", "Saoirse Kelly"]) && people.some(([n, p]) => n === "Fionn Walsh" && p === "false"), `${s0.slice(0, 80)} · ${JSON.stringify(people)}`);
      check("(e3) no name field anywhere on the sheet — a group is never renamed", (await page.locator("[data-sheet] input, [data-sheet] textarea").count()) === 0, "");
      const save = page.locator('[data-tour="group-edit-save"]');
      check("(e4) Save sleeps until something changed", await save.isDisabled(), "");
      /* (f) lessons ahead: one line, no removal */
      const ahead = page.locator('[data-tour="group-edit-ahead"]');
      check("(f1) with the clinic booked ahead the sheet says so in one line and offers no removal: 3 lessons ahead — End them first",
        (await ahead.count()) === 1 && M.norm(await ahead.innerText()) === "3 lessons ahead — End them first" && (await page.locator('[data-tour="group-edit-remove"]').count()) === 0, (await ahead.count()) ? await ahead.innerText() : s0.slice(-120));
      await page.locator('[data-sheet] [data-tour="group-edit-people"] [aria-label="Aoife Doyle"]').click(); await page.waitForTimeout(200);
      await page.locator('[data-sheet] [data-tour="group-edit-people"] [aria-label="Fionn Walsh"]').click(); await page.waitForTimeout(200);
      check("(e5) …and wakes once it has", !(await save.isDisabled()), "");
      await save.click(); await page.waitForTimeout(1300);
      const g1 = groupOf(db, "g1");
      const toast = M.norm(await page.locator("[data-toast]").innerText().catch(() => ""));
      check("(e6) Save writes the members by id to the coach's groups — Cian, Saoirse and Fionn — its name, day and time untouched, and says Saved",
        !!g1 && JSON.stringify([...g1.memberIds].sort()) === JSON.stringify([IDS.adult, IDS.junior, IDS.fionn].sort()) && JSON.stringify([...g1.members].sort()) === JSON.stringify(["Cian Murphy", "Fionn Walsh", "Saoirse Kelly"]) && g1.name === "Saturday clinic" && g1.day === 5 && g1.time === "4:00 pm" && /Saved\s*Saturday clinic · 3 players/.test(toast),
        JSON.stringify({ g1, toast }));
      const mem = M.norm(await page.locator('[data-tour="group-members"]').innerText().catch(() => ""));
      check("(e7) the sheet goes and the page reads the members as saved", (await page.locator('[data-sheet] [data-tour="group-edit"]').count()) === 0 && /Fionn Walsh/.test(mem) && !/Aoife Doyle/.test(mem) && /Cian Murphy/.test(mem), mem.slice(0, 160));
      await ctx.close();
    }

    /* ---------- (f) remove: nothing ahead, the red quiet key, a plain confirm ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openGroup(page, "Junior squad");
      await page.locator('[data-tour="group-page-edit"]').first().click(); await page.waitForTimeout(900);
      const rm = page.locator('[data-tour="group-edit-remove"]');
      const rmKey = (await rm.count()) ? await rm.evaluate((b) => { const cs = getComputedStyle(b); return { word: b.textContent.trim(), fg: cs.color, bg: cs.backgroundColor }; }) : null;
      check("(f2) with nothing booked ahead — its sessions a week and forty days gone — Remove group is the red quiet key, the brick's pale face, its word in the brick, and no line about lessons ahead",
        !!rmKey && rmKey.word === "Remove group" && rmKey.fg === "rgb(154, 50, 42)" && rmKey.bg !== "rgb(154, 50, 42)" && (await page.locator('[data-tour="group-edit-ahead"]').count()) === 0, JSON.stringify(rmKey));
      await rm.click(); await page.waitForTimeout(700);
      const c1 = await sheetText(page);
      await shot("06-squad-remove-confirm");
      check("(f3) Remove group asks once, plainly: Remove Junior squad, what stays, Remove and Keep it — no password", /^Remove Junior squad/.test(c1) && /1 session stays in All lessons/.test(c1) && /Keep it/.test(c1) && (await page.locator('[data-sheet] input[type="password"]').count()) === 0, c1.slice(0, 160));
      await page.locator("[data-sheet] button", { hasText: /^Keep it$/ }).click(); await page.waitForTimeout(600);
      check("(f4) Keep it is the way back to the sheet, the group untouched", (await page.locator('[data-sheet] [data-tour="group-edit"]').count()) === 1 && !!groupOf(db, "g2"), "");
      await rm.click(); await page.waitForTimeout(600);
      await page.locator('[data-tour="group-remove-go"]').click(); await page.waitForTimeout(1400);
      const toast = M.norm(await page.locator("[data-toast]").innerText().catch(() => ""));
      const t3 = await text();
      await shot("07-squad-removed");
      check("(f5) Remove takes it off the coach's groups — the others kept — says Removed, and lands on the roster without it",
        !groupOf(db, "g2") && !!groupOf(db, "g1") && !!groupOf(db, "g3") && /Removed\s*Junior squad/.test(toast) && (await page.locator('[data-tour="roster-group"]').count()) === 2 && !/Junior squad/.test(t3.replace(toast, "")),
        JSON.stringify({ groups: ((db.prefs[IDS.coach] || {}).groups || []).map((g) => g.name), toast, t3: t3.slice(0, 160) }));
      await ctx.close();
    }

    /* ---------- (g) 320: nothing cut ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "coach", 320);
      await openGroup(page, "Saturday clinic");
      const k = await keysOf(page);
      const edit = await M.rowLead(page, '[data-tour="group-page-edit"]');
      await shot("08-clinic-320");
      check("(g1) at 320 the three keys' words are whole and the Edit row is whole", k.length === 3 && k.every((x) => !x.cut) && !!edit && !edit.labelCut, JSON.stringify({ k: k.map((x) => `${x.word}:${x.cut}`), edit }));
      await page.locator('[data-tour="group-page-edit"]').first().click(); await page.waitForTimeout(900);
      await shot("09-clinic-edit-320");
      const cut = await page.evaluate(() => [...document.querySelectorAll("[data-sheet] [data-name], [data-sheet] [data-tour='group-edit-ahead'], [data-sheet] h2")].filter((e) => e.scrollWidth > e.clientWidth + 1 || /…/.test(e.textContent)).map((e) => e.textContent));
      check("(g2) at 320 the sheet's title, every name and the line about lessons ahead are whole", cut.length === 0, JSON.stringify(cut));
      await ctx.close();
    }
    check("(z) no page errors or console warnings", errors.length === 0, errors.slice(0, 4).join(" | "));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
