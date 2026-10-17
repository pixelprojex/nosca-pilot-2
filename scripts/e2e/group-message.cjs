/* MESSAGE A GROUP. A coach's Chat plus offered Everyone and then the
   people; a squad of six meant six threads, one line each. Now each
   saved group with somebody on the roster in it is a row under Everyone
   (its name, how many on the roster), and its sheet names the group and
   who is in it; Send writes the same line into each member's OWN thread
   — never a thread the families share — so a junior's adults read it in
   the child's thread and nobody reads anybody else's. The group's page
   carries Message too. This suite proves the rows (and a group whose
   only member has left the roster offering nothing), the sheet, the
   rows written, the junior's adult told, the coach not told, the group
   page's Message, a coach with no groups, and the parent's own Chat
   preview naming who spoke last.
   Usage: node group-message.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4334), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", eoin: "00000000-0000-4000-8000-0000000e0170" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
function freshDb({ groups = true } = {}) {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Doyle", type: "adult", coachId: IDS.coach, dob: "1993-02-02" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* Eoin was in a group and has left the roster */
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  if (groups) M.setPrefs(db, IDS.coach, { groups: [
    { id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Aoife Doyle", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.aoife, IDS.junior], day: 5, time: "9:00 am", weeks: 8, sport: "golf" },
    { id: "g2", name: "Junior squad", members: ["Saoirse Kelly", "Eoin Walsh"], memberIds: [IDS.junior, IDS.eoin], day: 2, time: "5:00 pm", weeks: 6, sport: "golf" },
    { id: "g3", name: "Winter league", members: ["Eoin Walsh"], memberIds: [IDS.eoin], day: 0, time: "7:00 pm", weeks: 10, sport: "golf" },
  ] });
  return db;
}

const { check, results, summary } = M.checker("group-message");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const msgs = (db) => db.messages;
  const sheetText = async (page) => (await page.locator("[data-sheet]").innerText()).trim();
  const openPicker = async (page) => { await tap(page, '[aria-label="Chat"]', 900); await tap(page, '[data-tour="chat-new"]', 900); };
  const send = async (page, body) => {
    const field = page.locator("[data-sheet] textarea").first();
    await field.fill(body); await page.waitForTimeout(200);
    await page.locator("[data-sheet] button", { hasText: /^Send$/ }).last().click(); await page.waitForTimeout(1600);
  };

  try {
    /* ---------- (a) the picker: Everyone, then the groups, then the people ---------- */
    const db = freshDb();
    {
      const { ctx, page, text, shot } = await boot(db, "coach");
      await openPicker(page);
      const st = await sheetText(page); await shot("01-picker");
      const groupRows = page.locator('[data-tour="thread-group"]');
      check("(a) the picker carries a row per group with somebody on the roster, under Everyone", (await page.locator('[data-tour="thread-everyone"]').count()) === 1 && (await groupRows.count()) === 2, `groups ${await groupRows.count()} · ${st.slice(0, 200)}`);
      const order = st.indexOf("Everyone") < st.indexOf("Saturday clinic") && st.indexOf("Saturday clinic") < st.indexOf("Cian Murphy");
      check("(a) …in that order: Everyone, the groups, the people", order, st.slice(0, 200));
      check("(a) each group reads how many on the roster — Eoin, who left, is not counted", /Saturday clinic\s*3 players/.test(st) && /Junior squad\s*1 player\b/.test(st), st.slice(0, 240));
      check("(a) a group whose only member has left offers nothing", !/Winter league/.test(st), st.slice(0, 240));

      /* ---------- (b) the sheet names the group and who is in it ---------- */
      await groupRows.filter({ hasText: "Saturday clinic" }).first().click(); await page.waitForTimeout(900);
      const s2 = await sheetText(page); await shot("02-group-sheet");
      check("(b) the sheet reads Message Saturday clinic and names Cian · Aoife · Saoirse", /Message Saturday clinic/.test(s2) && (await page.locator('[data-tour="group-message-to"]').innerText()).includes("Cian · Aoife · Saoirse"), s2.slice(0, 200));
      check("(b) Send sleeps until there are words", await page.locator("[data-sheet] button", { hasText: /^Send$/ }).last().isDisabled());
      const before = msgs(db).length; const notesBefore = db.notifications.length;
      await send(page, "Clinic moves to ten on Saturday.");
      const made = msgs(db).slice(before);
      const to = new Set(made.map((m) => m.player_id));
      check("(b) Send writes the line into each member's own thread, and nobody else's", made.length === 3 && to.has(IDS.adult) && to.has(IDS.aoife) && to.has(IDS.junior) && made.every((m) => m.sender_id === IDS.coach && m.coach_id === IDS.coach && m.body === "Clinic moves to ten on Saturday."), JSON.stringify(made.map((m) => m.player_id.slice(-6))));
      check("(b) the toast names the group and the count", /Sent to Saturday clinic · 3 players/.test(await text()), (await text()).slice(0, 160));
      const told = db.notifications.slice(notesBefore);
      check("(b) the junior's adult is told in the child's name, the two adults directly, the coach not at all", told.some((n) => n.user_id === IDS.parent && /messaged Saoirse/.test(n.title)) && told.some((n) => n.user_id === IDS.adult) && told.some((n) => n.user_id === IDS.aoife) && !told.some((n) => n.user_id === IDS.coach), JSON.stringify(told.map((n) => [n.user_id.slice(-6), n.title])));
      check("(b) the sheet closes", (await sheetText(page)).length === 0);

      /* ---------- (c) a group of one ---------- */
      await openPicker(page);
      await page.locator('[data-tour="thread-group"]', { hasText: "Junior squad" }).first().click(); await page.waitForTimeout(900);
      const b2 = msgs(db).length;
      await send(page, "Bring a water bottle.");
      const m2 = msgs(db).slice(b2);
      check("(c) Junior squad writes to Saoirse alone — Eoin has left — and says 1 player", m2.length === 1 && m2[0].player_id === IDS.junior && /Sent to Junior squad · 1 player\b/.test(await text()), JSON.stringify(m2.map((m) => m.player_id.slice(-6))) + " " + (await text()).slice(0, 120));

      /* ---------- (d) the group's own page carries Message ---------- */
      await tap(page, '[aria-label="Roster"]', 900);
      await tap(page, '[data-tour="roster-tab"] [aria-label="Groups"], [data-tour="roster-tab"] button:has-text("Groups")', 700);
      await page.locator('[data-tour="roster-group"]', { hasText: "Saturday clinic" }).first().click(); await page.waitForTimeout(900);
      const gp = page.locator('[data-tour="group-page-message"]'); await shot("03-group-page");
      check("(d) the group's page carries one Message button", (await gp.count()) === 1, (await text()).slice(0, 200));
      if (await gp.count()) { await gp.first().click(); await page.waitForTimeout(900); }
      check("(d) …which opens the same sheet, named", /Message Saturday clinic/.test(await sheetText(page)), (await sheetText(page)).slice(0, 120));
      const b3 = msgs(db).length;
      await send(page, "Well played today.");
      check("(d) …and sends to the three", msgs(db).slice(b3).length === 3);
      check("(a–d) no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 2).join(" | "));
      await ctx.close();
    }
    /* ---------- (e) each thread carries the line — the player sees it from the coach ---------- */
    {
      const { ctx, page, text } = await boot(db, "adult");
      await tap(page, '[aria-label="Chat"]', 900);
      check("(e) Cian's own Chat shows the coach's line, nothing of the families", /Well played today/.test(await text()) && !/Saoirse|Aoife/.test(await text()), (await text()).slice(0, 200));
      await ctx.close();
    }
    /* ---------- (f) the parent's Chat preview names who spoke last ---------- */
    {
      const db2 = freshDb();
      M.addMessage(db2, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.coach, body: "Is Saturday grand for Saoirse?", createdAt: "2026-10-15T09:00:00Z" });
      M.addMessage(db2, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.parent, body: "Thanks Niamh — can she come Friday instead?", createdAt: "2026-10-15T10:00:00Z" });
      const { ctx, page, text, shot } = await boot(db2, "parent");
      await tap(page, '[aria-label="Chat"]', 900);
      const t5 = await text(); await shot("04-parent-chat");
      check("(f) the parent's own last line leads with their own first name, never as the coach's", /Orla: Thanks Niamh/.test(t5), t5.slice(0, 240));
      M.addMessage(db2, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.coach, body: "Friday at four, so.", createdAt: "2026-10-15T11:00:00Z" });
      await page.reload({ waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Chat"]', 900);
      const t6 = await text();
      check("(f) once the coach answers, the row under the coach's name carries no lead", /Friday at four, so\./.test(t6) && !/Orla: Friday/.test(t6) && !/Niamh: Friday/.test(t6), t6.slice(0, 240));
      await ctx.close();
    }
    /* ---------- (g) a coach with no groups ---------- */
    {
      const db3 = freshDb({ groups: false });
      const { ctx, page } = await boot(db3, "coach");
      await openPicker(page);
      check("(g) no groups, no group rows — Everyone and the people as before", (await page.locator('[data-tour="thread-group"]').count()) === 0 && (await page.locator('[data-tour="thread-everyone"]').count()) === 1);
      await ctx.close();
    }
    check("no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
