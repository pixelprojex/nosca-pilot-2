/* FAMILIES AND COACH REQUESTS. One database shared across every role,
   so what one person does is what the next one sees: a player withdraws
   a request; the coach sees who is asking on Today, accepts one and
   declines another; the accepted and declined players open to the
   right screens; an adult starts a family, another joins it by code and
   later leaves; a parent lands on the family dashboard, books a lesson
   for their child into the child's coach's hours and writes to that
   coach; the child sees the family and nothing they cannot do.
   Usage: node families-requests.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4302), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = {
  coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", dara: "00000000-0000-4000-8000-00000000da4a",
  parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d",
  eoin: "00000000-0000-4000-8000-000000e01e01", aoife: "00000000-0000-4000-8000-00000000a01f", tadhg: "00000000-0000-4000-8000-0000000ad4a6",
};
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return M.ymd(d); };

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("dara", "dara@t.ie", { role: "player", name: "Dara Kelly", type: "adult", dob: "1989-02-02" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Nolan", type: "adult", dob: "1990-03-02" });
  person("tadhg", "tadhg@t.ie", { role: "player", name: "Tadhg Ryan", type: "adult", dob: "1992-01-01" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "11:00 am", "2:00 pm", "3:00 pm", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]) });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-08-28", focus: "Grip", notes: "Left hand a touch stronger." });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.junior, title: "Grip pressure check" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: plusDays(3), time: "10:00 am" });
  /* two players asking; the requests are what the trigger would have written, notifications included */
  M.addRequest(db, { playerId: IDS.eoin, coachId: IDS.coach, notify: true });
  M.addRequest(db, { playerId: IDS.tadhg, coachId: IDS.coach, notify: true });
  return db;
}

const allowedFor = {
  coach: ["Niamh Byrne", "Cian Murphy", "Saoirse Kelly", "Orla Kelly", "Eoin Walsh", "Aoife Nolan", "Tadhg Ryan", "QW7X2M"],
  adult: ["Cian Murphy", "Niamh Byrne", "Dara Kelly"], dara: ["Dara Kelly", "Cian Murphy"],
  parent: ["Orla Kelly", "Saoirse Kelly", "Niamh Byrne"], junior: ["Saoirse Kelly", "Orla Kelly", "Niamh Byrne"],
  eoin: ["Eoin Walsh", "Niamh Byrne"], aoife: ["Aoife Nolan", "Niamh Byrne"], tadhg: ["Tadhg Ryan", "Niamh Byrne"],
};
const { check, results, summary } = M.checker("families-requests");
const leaks = [];

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();                        // one database, every role
  const errorsByRole = {};
  const boot = async (role, { carryOn = true, pinClock = false } = {}) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage();
    /* booking needs open slots today whatever the hour the script runs at */
    if (pinClock) await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`));
    await M.attach(page, db);
    errorsByRole[role] = errorsByRole[role] || []; page.on("pageerror", (e) => errorsByRole[role].push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn });
    const text = () => M.rootText(page);
    const leak = async (label) => { const tx = await text(); for (const s of M.SEEDED) if (tx.includes(s) && !(allowedFor[role] || []).includes(s)) leaks.push({ role, screen: label, seeded: s }); return tx; };
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text, leak, shot };
  };
  const { tap, byText, click } = M;
  const rpc = (fn) => db.rpcs.filter((x) => x.fn === fn);

  try {
    /* ---------- (a) a player withdraws the request they have out ---------- */
    {
      const { ctx, page, leak, shot } = await boot("tadhg");
      const t0 = await leak("tadhg request sent"); await shot("01-tadhg-request-sent");
      check("(a) a player with a request out opens on Request sent, not Home", (await page.locator('[data-tour="nocoach-pending"]').count()) === 1 && t0.includes("Niamh Byrne will accept you from their app"), t0.slice(0, 200));
      await click(page, "Withdraw the request", 1500);
      const c = rpc("cancel_request")[0]; const req = db.requests.find((r) => r.player_id === IDS.tadhg);
      check("(a) Withdraw calls cancel_request with the request's id and the row is cancelled", !!c && c.args.p_id === req.id && req.status === "cancelled", JSON.stringify({ call: c && c.args, status: req.status }));
      const t1 = await leak("tadhg after withdraw"); await shot("02-tadhg-withdrawn");
      check("(a) the screen returns to Add your coach with Ask to join", t1.includes("Add your coach") && (await page.getByRole("button", { name: "Ask to join", exact: true }).count()) === 1, t1.slice(0, 160));
      await ctx.close();
    }

    /* ---------- (b) the coach: who is asking, accept, decline ---------- */
    {
      const { ctx, page, leak, shot } = await boot("coach", { carryOn: false });
      const cu = await leak("coach catch-up"); await shot("03-coach-catchup");
      check("(b) the request landed under the coach's catch-up on opening", (await page.locator('[data-tour="catchup-list"]').count()) === 1 && cu.includes("Eoin Walsh asked to join"), cu.slice(0, 200));
      await click(page, "Carry on", 900);
      const t0 = await leak("coach today"); await shot("04-coach-today");
      const strip = page.locator('[data-tour="today-requests"]');
      check("(b) Today says who asked to join", (await strip.count()) === 1 && M.norm(await strip.innerText()).includes("Eoin Walsh asked to join"), t0.slice(0, 200));
      await strip.click(); await page.waitForTimeout(900);
      const t1 = await leak("coach requests"); await shot("05-coach-requests");
      check("(b) Requests lists the one waiting, with Accept and Decline", t1.includes("Requests") && t1.includes("1 waiting") && t1.includes("Eoin Walsh") && (await byText(page, "Accept").count()) === 1 && (await byText(page, "Decline").count()) === 1, t1.slice(0, 200));
      await click(page, "Accept", 1800);
      const acc = rpc("respond_to_request")[0]; const eoinReq = db.requests.find((r) => r.player_id === IDS.eoin);
      check("(b) Accept calls respond_to_request with p_accept true", !!acc && acc.args.p_id === eoinReq.id && acc.args.p_accept === true, JSON.stringify(acc && acc.args));
      check("(b) …which sets the player's coach_id and tells the player (kind accepted)", db.profiles[IDS.eoin].coach_id === IDS.coach && eoinReq.status === "accepted" && db.notifications.some((n) => n.user_id === IDS.eoin && n.kind === "accepted"), JSON.stringify({ coach: db.profiles[IDS.eoin].coach_id, status: eoinReq.status }));
      const t2 = await leak("coach after accept"); await shot("06-coach-accepted");
      check("(b) the request leaves the list and the coach is told", t2.includes("Nothing waiting") || t2.includes("added to your roster"), t2.slice(0, 200));
      /* Roster carries the new player and, for the junior, who looks after her */
      await tap(page, '[aria-label="Roster"]');
      const t3 = await leak("coach roster"); await shot("07-coach-roster");
      check("(b) the accepted player is on the roster", t3.includes("Eoin Walsh") && t3.includes("Saoirse Kelly") && t3.includes("Cian Murphy"), t3.slice(0, 240));
      await page.locator('[data-tour="roster-row"], button', { hasText: "Saoirse Kelly" }).first().click(); await page.waitForTimeout(900);
      const t4 = await leak("coach junior file"); await shot("08-coach-junior-file");
      check("(b) a junior's file names the adult in her family messages go to", t4.includes("Messages go to Orla Kelly."), t4.slice(0, 200));
      /* a second request lands while the coach is elsewhere; the app is reopened */
      M.addRequest(db, { playerId: IDS.aoife, coachId: IDS.coach, notify: true });
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      const t5 = await leak("coach today again"); await shot("09-coach-today-aoife");
      check("(b) Today now names the new asker", (await page.locator('[data-tour="today-requests"]').count()) === 1 && t5.includes("Aoife Nolan asked to join"), t5.slice(0, 200));
      await page.locator('[data-tour="today-requests"]').click(); await page.waitForTimeout(900);
      await click(page, "Decline", 1800);
      const dec = rpc("respond_to_request")[1]; const aoifeReq = db.requests.find((r) => r.player_id === IDS.aoife);
      check("(b) Decline calls respond_to_request with p_accept false; no link is made; the player is told", !!dec && dec.args.p_id === aoifeReq.id && dec.args.p_accept === false && aoifeReq.status === "declined" && !db.profiles[IDS.aoife].coach_id && db.notifications.some((n) => n.user_id === IDS.aoife && n.kind === "declined"), JSON.stringify({ call: dec && dec.args, status: aoifeReq.status }));
      await shot("10-coach-declined");
      await ctx.close();
    }

    /* ---------- (c) the accepted and the declined player ---------- */
    {
      const { ctx, page, leak, shot } = await boot("eoin", { carryOn: false });
      const t0 = await leak("eoin catch-up"); await shot("11-eoin-catchup");
      check("(c) the accepted player is told on opening: '<coach> accepted you'", t0.includes("Niamh Byrne accepted you"), t0.slice(0, 200));
      await click(page, "Carry on", 900);
      const t1 = await leak("eoin home"); await shot("12-eoin-home");
      check("(c) …and opens on Home with the coach named, not the coachless screen", !t1.includes("Add your coach") && !t1.includes("Request sent") && t1.includes("Niamh Byrne"), t1.slice(0, 200));
      await ctx.close();
    }
    {
      const { ctx, page, leak, shot } = await boot("aoife", { carryOn: false });
      const c0 = await leak("aoife catch-up"); await shot("13-aoife-catchup");
      check("(c) the declined player is told on opening: '<coach> couldn't take you on'", c0.includes("Niamh Byrne couldn't take you on"), c0.slice(0, 200));
      await click(page, "Carry on", 900);
      const t0 = await leak("aoife declined"); await shot("14-aoife-declined");
      check("(c) …and opens on Add your coach with the code boxes ready", t0.includes("Add your coach") && (await M.codeBoxes(page).count()) >= 6, t0.slice(0, 200));
      /* the home screen's own line about the decline reads the coach's row, which the
         profiles policy stops sharing once the request is no longer pending */
      check("(c) the coachless screen names who couldn't take them on (declinedBy)", t0.includes("Niamh Byrne couldn't take you on"), t0.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (d) an adult starts a family ---------- */
    let famCode = null;
    {
      const { ctx, page, leak, shot } = await boot("adult");
      /* the header is the person's own now: the pill opens You, and Family
         is a row there until there is one, when it becomes its own tab */
      await tap(page, '[data-tour="profile-pill"]', 900);
      const t0 = await leak("cian you"); await shot("14-cian-you");
      check("(d) the header pill opens the person's own account, not a family", t0.includes("Cian Murphy") && (await page.locator('[data-tour="settings-dashboard"]').count()) === 1 && t0.includes("Sign out"), t0.slice(0, 200));
      await tap(page, '[data-tour="settings-dashboard"]', 900);
      const t1 = await leak("cian family screen"); await shot("15-cian-family-screen");
      check("(d) the Family screen offers Start a family and Join a family", t1.includes("Start a family") && t1.includes("Join a family") && (await page.locator('[data-tour="family-join"] input').count()) >= 6, t1.slice(0, 200));
      await page.locator('[data-tour="family-create"] input').fill("The Murphys");
      await click(page, "Create a family code", 1800);
      const cf = rpc("create_family")[0]; const fam = Object.values(db.families).find((f) => f.created_by === IDS.adult);
      famCode = fam && fam.code;
      check("(d) Create a family code calls create_family with the name and the caller joins it", !!cf && cf.args.p_name === "The Murphys" && !!fam && db.profiles[IDS.adult].family_id === fam.id, JSON.stringify({ call: cf && cf.args, code: famCode }));
      const t2 = await leak("cian family made"); await shot("16-cian-family-made");
      check("(d) the code is shown large with Copy and Share, and the maker is listed", !!famCode && t2.includes(famCode) && (await byText(page, "Copy").count()) === 1 && (await page.locator('[data-tour="family-share"]').count()) === 1 && t2.includes("The Murphys") && t2.includes("Cian Murphy (you)"), t2.slice(0, 240));
      await byText(page, "Copy").click(); await page.waitForTimeout(500);
      const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
      check("(d) Copy puts the family code on the clipboard", clip === famCode, String(clip));
      await ctx.close();
    }

    /* ---------- (e) a second adult joins with the code, then leaves ---------- */
    {
      const { ctx, page, leak, shot } = await boot("dara");
      /* no coach yet, so no tabs and no pill: You → Family is the way in */
      const t00 = await leak("dara coachless");
      check("(e) an adult with neither coach nor family opens on Add your coach, with You reachable", t00.includes("Add your coach") && (await page.locator('[aria-label="You"]').count()) === 1, t00.slice(0, 160));
      await tap(page, '[aria-label="You"]', 900);
      const youRow = page.locator('[data-tour="settings-dashboard"]');
      check("(e) You carries a Family row that says none yet", (await youRow.count()) === 1 && /Family/.test(await youRow.innerText()) && /Start or join one/.test(await youRow.innerText()), (await youRow.count()) ? await youRow.innerText() : "no row");
      /* with no family yet the row goes straight to the screen that starts or
         joins one — a dashboard of nobody helps no one */
      await youRow.click(); await page.waitForTimeout(900);
      await page.locator('[data-tour="family-join"] input').first().fill(famCode); await page.waitForTimeout(1000);
      const t0 = await leak("dara code checked"); await shot("17-dara-code-checked");
      check("(e) the code is looked up live and shows the family's name and size", t0.includes("The Murphys · 1 person") && rpc("find_family_by_code").some((x) => x.args.p_code === famCode), t0.slice(0, 200));
      await click(page, "Join The Murphys", 1800);
      const jf = rpc("join_family")[0];
      check("(e) Join calls join_family with the code and the caller is in", !!jf && jf.args.p_code === famCode && db.profiles[IDS.dara].family_id === db.profiles[IDS.adult].family_id, JSON.stringify(jf && jf.args));
      check("(e) the family trigger told the other member (kind family)", db.notifications.some((n) => n.user_id === IDS.adult && n.kind === "family" && /Dara Kelly joined your family/.test(n.title)), JSON.stringify(db.notifications.filter((n) => n.kind === "family").map((n) => n.title)));
      const t1 = await leak("dara family screen"); await shot("18-dara-joined");
      check("(e) the Family screen lists both adults", t1.includes("Cian Murphy") && t1.includes("Dara Kelly (you)") && t1.includes("2 people"), t1.slice(0, 240));
      await click(page, "Dashboard", 900);
      const people = page.locator('[data-tour="family-people"]');
      const t2 = await leak("dara dashboard"); await shot("19-dara-dashboard");
      check("(e) the dashboard shows both faces under In the family and has no young players", (await people.count()) === 1 && /Cian/.test(await people.innerText()) && /You/.test(await people.innerText()) && t2.includes("No young players yet"), t2.slice(0, 240));
      await tap(page, '[data-tour="family-settings"]', 900);
      await click(page, "Leave the family", 500);
      await page.getByRole("button", { name: "Leave", exact: true }).click(); await page.waitForTimeout(1800);
      const t3 = await leak("dara left"); await shot("20-dara-left");
      check("(e) Leave the family calls leave_family; the family stays for the one still in it", rpc("leave_family").length === 1 && !db.profiles[IDS.dara].family_id && !!db.profiles[IDS.adult].family_id && !!db.families[db.profiles[IDS.adult].family_id], JSON.stringify({ dara: db.profiles[IDS.dara].family_id, cian: db.profiles[IDS.adult].family_id }));
      check("(e) …and the screen offers to start or join one again", t3.includes("Start a family") && t3.includes("Join a family"), t3.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (f) a parent: the dashboard, booking for the child, writing to her coach ---------- */
    {
      const { ctx, page, text, leak, shot } = await boot("parent", { pinClock: true });
      const t0 = await leak("parent family home"); await shot("21-parent-family");
      const has = async (sel) => (await page.locator(sel).count()) > 0;
      check("(f) a parent lands on the Family tab", (await page.locator('[data-tour="tab-family"][aria-current="page"]').count()) === 1 && t0.includes("Orla's family"), t0.slice(0, 200));
      check("(f) the parent's tabs are Family / Lessons / Diary / Chat", (await has('[data-tour="tab-family"]')) && (await has('[data-tour="tab-log"]')) && (await has('[data-tour="tab-calendar"]')) && (await has('[data-tour="tab-messages"]')) && !(await has('[data-tour="tab-home"]')) && !(await has('[data-tour="tab-practice"]')));
      /* the dashboard is a glance — one line each, with everything about a
         child (and every action for them) one tap in on their own screen */
      const kid = page.locator('[data-tour="family-kid"]');
      const kt = (await kid.count()) ? M.norm(await kid.innerText()) : "";
      check("(f) the junior's row shows her name and her next lesson from the database", kt.includes("Saoirse") && /10:00 am/.test(kt), kt);
      await kid.click(); await page.waitForTimeout(900);
      const kidScreen = M.norm(await M.rootText(page));
      check("(f) her own screen carries the coach, Next, Last lesson and To practise", kidScreen.includes("with Niamh Byrne") && /NEXT .*10:00 am/i.test(kidScreen) && kidScreen.includes("Grip · 28 AUG") && kidScreen.includes("1 drill"), kidScreen.slice(0, 260));
      check("(f) Book a lesson is live because her coach has hours", await page.getByRole("button", { name: "Book a lesson", exact: true }).isEnabled(), kidScreen.slice(0, 160));
      await page.getByRole("button", { name: "Book a lesson", exact: true }).click(); await page.waitForTimeout(900);
      const t1 = await leak("parent book for"); await shot("22-parent-book-for");
      check("(f) the diary opens as Book for <first name>", t1.startsWith("Book for Saoirse") || t1.includes("Book for Saoirse"), t1.slice(0, 200));
      check("(f) the open slots are the child's coach's hours", (await page.locator('[data-tour="agenda-book"]').count()) > 0 && rpc("coach_availability").some((x) => x.args && x.args.p_player === IDS.junior), t1.slice(0, 200));
      await tap(page, '[data-tour="agenda-book"]');
      await click(page, "Request it", 1800);
      const bk = db.posts.filter((x) => x.table === "bookings").pop(); const brow = bk && bk.rows[0];
      /* the row must be the child's, to the child's coach — the Confirm sheet reached from an open
         slot must honour "Book for", not book the parent themselves */
      check("(f) picking a time posts a booking for the junior, requested, to her coach", !!brow && brow.player_id === IDS.junior && brow.coach_id === IDS.coach && brow.status === "requested" && bk.by === IDS.parent && !bk.refused, JSON.stringify({ row: brow, refused: bk && bk.refused }));
      check("(f) the booking trigger asked the coach (kind booking)", db.notifications.some((n) => n.user_id === IDS.coach && n.kind === "booking" && /Saoirse Kelly asked for a lesson/.test(n.title)), JSON.stringify(db.notifications.filter((n) => n.kind === "booking").map((n) => n.title)));
      await page.waitForTimeout(1500); await shot("22b-parent-after-request");
      await tap(page, '[data-tour="tab-family"]', 900);
      const t2 = await leak("parent family after booking"); await shot("23-parent-family-after");
      const upcoming = M.norm(await page.locator('[data-tour="family-upcoming"]').innerText());
      check("(f) Coming up lists the child's confirmed lesson", upcoming.includes("Saoirse") && upcoming.includes("10:00 am"), upcoming);
      await page.locator('[data-tour="family-kid"]').click(); await page.waitForTimeout(900);
      await page.getByRole("button", { name: "Message coach", exact: true }).click(); await page.waitForTimeout(900);
      const t3 = await leak("parent thread"); await shot("24-parent-thread");
      check("(f) Message coach opens the child's thread with her coach", t3.includes("Saoirse Kelly") && (await page.locator('input[placeholder="Message"]').count()) === 1, t3.slice(0, 200));
      await page.fill('input[placeholder="Message"]', "Can Saoirse move to Thursday?");
      await tap(page, '[aria-label="Send"]', 1500);
      const msg = db.posts.filter((x) => x.table === "messages").pop(); const mrow = msg && msg.rows[0];
      check("(f) the message is written in the child's thread, from the parent", !!mrow && mrow.coach_id === IDS.coach && mrow.player_id === IDS.junior && mrow.sender_id === IDS.parent && mrow.body === "Can Saoirse move to Thursday?", JSON.stringify(mrow));
      check("(f) the message trigger told the coach", db.notifications.some((n) => n.user_id === IDS.coach && n.kind === "message" && n.title === "Orla Kelly"), JSON.stringify(db.notifications.filter((n) => n.kind === "message").map((n) => [n.user_id.slice(-4), n.title])));
      const t4 = await text();
      check("(f) the sent message appears in the thread", t4.includes("Can Saoirse move to Thursday?"), t4.slice(-200));
      await ctx.close();
    }

    /* ---------- (g) the junior's view of the family ---------- */
    {
      const { ctx, page, leak, shot } = await boot("junior");
      const t0 = await leak("junior home"); await shot("25-junior-home");
      check("(g) the junior opens on Home, with Family as its own tab", (await page.locator('[data-tour="tab-family"]').count()) === 1 && (await page.locator('[data-tour="profile-pill"]').count()) === 1, t0.slice(0, 160));
      await tap(page, '[data-tour="tab-family"]', 900);
      const t1 = await leak("junior family"); await shot("26-junior-family");
      const people = page.locator('[data-tour="family-people"]');
      check("(g) the junior's dashboard shows who is in it and nothing to book", (await people.count()) === 1 && /Orla/.test(await people.innerText()) && /You/.test(await people.innerText()) && (await page.locator('[data-tour="family-kid"]').count()) === 0 && (await byText(page, "Book a lesson").count()) === 0 && !t1.includes("Message coach"), t1.slice(0, 240));
      check("(g) …and says what the adults can do", t1.includes("The adults here can see your lessons"), t1.slice(0, 240));
      await tap(page, '[data-tour="family-settings"]', 900);
      const t2 = await leak("junior family screen"); await shot("27-junior-family-screen");
      check("(g) the junior's Family screen has no code, no rename and no Leave", !t2.includes("Family code") && !t2.includes("KEL7Y2") && !t2.includes("Leave the family") && !t2.includes("Name the family") && t2.includes("Who's in it") && t2.includes("Ask an adult in your family to change anything here"), t2.slice(0, 240));
      await ctx.close();
    }
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    results.push({ name: "run completed", ok: false, detail: String(e && e.message || e) });
  } finally { await browser.close(); M.stopServer(server); }

  for (const [r, es] of Object.entries(errorsByRole)) { const real = es.filter((e) => !/vibrate/.test(e)); check(`no page errors as ${r}`, real.length === 0, real.slice(0, 3).join(" | ")); }
  check("no seeded string on any screen touched", leaks.length === 0, leaks.map((l) => `${l.role}:${l.screen}:${l.seeded}`).join(" ; "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ ...out, leaks, log: db.log.slice(-300) }, null, 2));
  process.exit(0);
})();
