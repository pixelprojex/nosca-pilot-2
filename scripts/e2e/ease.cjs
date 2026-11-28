/* VISUAL EASE. The founder's ask of 13 November: people found the app
   too much at once — a rimmed box per row, every list a column of
   outlined boxes — and could not find their way to the features. A row
   of content now sits on the sport's wash with no edge, so a screen
   reads as paper with a few objects on it; the sport's edge stays on
   what is chosen from or acted on — tiles, cards, the sheet, the one
   action — and a container of rows (the Diary's day box) keeps its
   edge. The home and the roster breathe: SPACE.section (40) where the
   screen changes subject. This suite reads the fill and the edges of
   every list row on the coach's home, the roster, Chat, Settings and
   the Diary, the tiles beside them, and the air between the subjects.
   21 November, the afternoon: the founder asked for white throughout,
   Duolingo's keys and Apple's lists, and "maybe it's all the tinted
   boxes". A row is Duolingo's card now — white on one light grey line,
   #E4E0D7, with a ledge of it, 14px corners — a day's box the same line;
   Settings' groups white boxes; Chat Messages' plain list, a separator
   inset from the face and no box per thread. The air stays.
   Usage: node ease.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4363), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", eoin: "00000000-0000-4000-8000-000000e01e01", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
const CARD = "rgb(255, 255, 255)", EDGE = "rgb(228, 224, 215)", NONE = "rgba(0, 0, 0, 0)";
/* the white card's warm ring and ledge (Settings' groups, CARD_WHITE) since 28 November */
const WHITE_RING = "rgb(230, 226, 217)", WHITE_LEDGE = "rgb(218, 213, 201)";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Doyle", type: "adult", coachId: IDS.coach, dob: "1993-03-03" });
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]),
    groups: [{ id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], day: 5, time: "9:00 am", weeks: 8, sport: "golf" }] });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(2)), time: "10:30 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.aoife, date: M.ymd(dayFrom(1)), time: "9:00 am", status: "requested" });
  M.addRequest(db, { playerId: IDS.eoin, coachId: IDS.coach, notify: true });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-5)), focus: "Short game", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.adult, body: "Grand, see you at four." });
  return db;
}

const { check, results, summary } = M.checker("ease");
/* every list row on the screen (or in a scope): its fill, its four edges, its corner, and whether it sits in a list or a day box */
const rows = (page, scope) => page.evaluate((scope) => {
  const root = scope ? document.querySelector(scope) : document; if (!root) return null;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const out = [];
  root.querySelectorAll(".nsc-list > *").forEach((el) => { if (!vis(el)) return; const cs = getComputedStyle(el);
    /* the day's one coloured card (the lesson on now, or next — 22 November, art direction) is a box of the list and not a white row */
    out.push({ kind: el.hasAttribute("data-next-card") ? "card" : "row", text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 24), bg: cs.backgroundColor, radius: cs.borderTopLeftRadius,
               edges: ["Top", "Right", "Bottom", "Left"].map((k) => `${cs[`border${k}Width`]} ${cs[`border${k}Color`]}`) }); });
  root.querySelectorAll(".nsc-day").forEach((el) => { if (!vis(el)) return; const cs = getComputedStyle(el);
    out.push({ kind: "day", text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 24), bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, edges: [`${cs.borderTopWidth} ${cs.borderTopColor}`] }); });
  return out;
}, scope);
/* a list row is a Lares card (28 November): filled, one 2px ring on every side a step deeper than the fill, 18px
   corners (it was the white card on the light grey line at 14px from 21 November, the wash with no edge before) */
const soft = (r) => r.bg !== NONE && r.radius === "18px" && r.edges.every((e) => e === r.edges[0] && parseFloat(e) >= 2) && !r.edges[0].endsWith(r.bg);
const say = (rs) => rs ? `${rs.length}: ` + rs.filter((r) => r.kind === "row" && !soft(r)).slice(0, 3).map((r) => `"${r.text}" ${r.bg} ${r.edges[0]} r${r.radius}`).join(" | ") : "no scope";
/* Chat's rows: Messages' plain list — no fill of its own, no border, a 1px separator (::after) inset from the face under every row but the last */
const plainRows = (page) => page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] .nsc-plain > *')].filter((el) => el.getBoundingClientRect().height > 0).map((el, i, all) => {
  const cs = getComputedStyle(el), sep = getComputedStyle(el, "::after"), box = el.getBoundingClientRect(), face = el.querySelector("span.rounded-full");
  return { text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 20), bg: cs.backgroundColor, border: ["Top", "Right", "Bottom", "Left"].map((k) => parseFloat(cs[`border${k}Width`])).reduce((a, b) => a + b, 0),
           sep: sep.display !== "none" && sep.content !== "none" ? Math.round(parseFloat(sep.left)) : null, last: i === all.length - 1, faceRight: face ? Math.round(face.getBoundingClientRect().right - box.left) : null };
}));
const messages = (rs) => !!rs && rs.length >= 1 && rs.every((r) => (r.bg === NONE || r.bg === CARD) && r.border === 0 && (r.last ? r.sep === null : r.sep != null && r.faceRight != null && r.sep >= r.faceRight));
/* a tile's own edge, by its label */
const tile = (page, label) => page.evaluate((label) => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || x.textContent.trim()) === label && x.getBoundingClientRect().width > 0); if (!b) return null; const cs = getComputedStyle(b.querySelector("[data-face]") || b); return { label, bg: cs.backgroundColor, edge: `${cs.borderTopWidth} ${cs.borderTopColor}` }; }, label);   // a round key (18 Nov) draws its fill and edge on its face
/* the home's Actions: whether the filter is there, its tiles, and the rows under the heading — a request is a person row, everything else a kind of its own */
const actionsOf = (page) => page.evaluate(() => {
  const head = [...document.querySelectorAll('[data-scroll="screen"] h2')].find((h) => h.textContent.trim() === "Actions"); if (!head) return null;
  const filter = document.querySelector('[data-tour="today-actions-filter"]');
  const list = [...document.querySelectorAll('[data-scroll="screen"] .nsc-ruled')].find((l) => l.getBoundingClientRect().top > head.getBoundingClientRect().bottom - 1);
  const kids = list ? [...list.children] : [], asks = kids.filter((k) => k.hasAttribute("data-person-row")).length, jobs = kids.length - asks;
  return { filter: !!filter, tiles: filter ? filter.querySelectorAll("button").length : 0, asks, jobs, rows: kids.length, kinds: (asks ? 1 : 0) + jobs,
           gap: list ? Math.round(list.getBoundingClientRect().top - head.getBoundingClientRect().bottom) : null };
});
/* (l1) SETTINGS › NOTIFICATIONS, WHOLE (24 November). The switch's row was the sentence "Tell me even when Nosca is
   closed", cut at 390; it is named Push, the sentence the caption under it as every row of the screen carries one.
   No label and no caption on the screen is cut (Only urgent's read "Cancellations, bookings, requests and messa…") */
const notifications = async (page, who, shotName, shot) => {
  await M.tap(page, '[data-tour="settings-notifications"]', 900);
  const nf = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] [data-row]')].filter((r) => r.getBoundingClientRect().height > 0).map((r) => {
    const lab = r.querySelector("[data-row-label]"), sub = r.querySelector("[data-row-sub]");
    const cut = (e) => !!e && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1);
    return { label: lab ? lab.textContent.trim() : null, sub: sub ? sub.textContent.trim() : null, labelCut: cut(lab), subCut: cut(sub), toggle: !!r.querySelector("button[aria-pressed]") };
  }));
  if (shotName) await shot(shotName);
  const sw = nf.find((r) => r.label === "Push");
  check(`(l1) ${who}: Notifications' switch is the Push row, its sentence the caption under it, and no label or caption on the screen is cut`,
    !!sw && sw.sub === "Tell me even when Nosca is closed" && sw.toggle && nf.length >= 4 && nf.every((r) => !r.labelCut && !r.subCut)
    && nf.some((r) => r.sub === "Cancellations, bookings, requests and messages") && !nf.some((r) => r.label === "Tell me even when Nosca is closed"), JSON.stringify(nf));
  await M.back(page);
};
/* (l3) DATA & PERMISSIONS SAYS ONLY WHAT THE APP DOES (24 November, e242853): it promised notices for payments (there
   are none), pointed to a messaging privacy note nobody can open, and said a coach must ask before recording injury
   or fitness details (the coach's own notes ask nobody, and nobody else reads them) */
const dataPage = async (page, who) => {
  await M.tap(page, '[data-tour="settings-data"]', 900);
  const dp = await M.rootText(page);
  check(`(l3) ${who}: Data & permissions says only what is true — no payments, no separate messaging privacy note, no "must ask before recording injury"`,
    /Data & permissions/.test(dp) && /Notes on a player/.test(dp) && /Messaging/.test(dp) && !/payment/i.test(dp) && !/separate messaging privacy note/i.test(dp) && !/must ask before recording injury/i.test(dp), dp.slice(0, 300));
  await M.back(page);
};
const gap = (page, fromSel, toText) => page.evaluate(([fromSel, toText]) => {
  const from = document.querySelector(fromSel); if (!from) return null;
  /* a section's head is an h2 since 21 November (the display face in ink, Lares's "Later") */
  const to = [...document.querySelectorAll('[data-scroll="screen"] div, [data-scroll="screen"] span, [data-scroll="screen"] h2')].find((d) => d.children.length === 0 && d.textContent.trim() === toText && d.getBoundingClientRect().top > from.getBoundingClientRect().bottom - 1);
  if (!to) return null; return Math.round(to.getBoundingClientRect().top - from.getBoundingClientRect().bottom);
}, [fromSel, toText]);

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
    return { ctx, page, shot };
  };
  const { tap } = M;
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 4000 }).catch(() => {}); await page.waitForTimeout(600); };

  try {
    /* ---------- the coach ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "coach");
      await tap(page, '[aria-label="Today"]', 900);
      const home = await rows(page, '[data-scroll="screen"]'); await shot("01-today");
      check("(a) the coach's home: every row — the day's lessons, the folded next day, the Actions rows, All lessons — is a Lares card, filled on its 2px ring, 18px corners", !!home && home.filter((r) => r.kind === "row").length >= 5 && home.filter((r) => r.kind === "row").every(soft), say(home));
      /* …but one: the lesson next is the day's coloured card, filled, on its own colour's line, 16px corners — one a screen at most */
      const cards = home ? home.filter((r) => r.kind === "card") : [];
      check("(a0) …and exactly one box is deep: the day's next lesson, filled and ringed in its own colour, 18px corners", cards.length === 1 && cards[0].bg !== CARD && cards[0].bg !== NONE && cards[0].radius === "18px" && cards[0].edges.every((e) => e.endsWith(cards[0].bg)), JSON.stringify(cards));
      /* since 18 November the home carries no board: the six verbs were every one on the plus already, and the founder asked for the duplicate gone */
      const board = await page.locator('[data-tour="today-board"]').count();
      await tap(page, '[data-tour="quick"]', 900);
      const add = await tile(page, "Add player");
      /* the plus's eight are filled keys since 23 November (white keys with a small coloured square before): each its
         function's light colour — Add player the olive's cloth, #B9C3A3 — with no rim at all */
      check("(b) the home has no board of actions — they live on the plus, whose eight are filled keys in their functions' light colours, no rim", board === 0 && !!add && add.bg === "rgb(185, 195, 163)" && /rgba\(0, 0, 0, 0\)/.test(add.edge) && !/40, 89, 55/.test(add.edge), JSON.stringify({ board, add }));
      await page.keyboard.press("Escape"); await page.mouse.click(20, 120); await page.waitForTimeout(700);
      await tap(page, '[aria-label="Today"]', 900);
      const g1 = await gap(page, '[data-scroll="screen"] h1', "Today");
      const g2 = await gap(page, '[data-tour="today-nextday"]', "Actions");
      check("(c) the home breathes: SPACE.section (40) from the date to Today's head and from the folded next day to Actions", g1 !== null && g1 >= 40 && g2 !== null && g2 >= 40, JSON.stringify({ dateToToday: g1, nextDayToActions: g2 }));
      /* (c2) A FILTER IS FOR A LIST THAT NEEDS ONE (22 November, art direction): the Actions tiles appear past two
         kinds AND past six rows shown; here three kinds stand over a handful of rows, so the rows sit straight under
         the heading (four tiles naming Requests · Join requests · Messages stood over rows that named themselves) */
      const act1 = await actionsOf(page);
      check("(c2) Actions with more than two kinds but a handful of rows carries no filter — the rows sit straight under the heading", !!act1 && act1.kinds > 2 && act1.rows <= 6 && !act1.filter && act1.gap !== null && act1.gap <= 16, JSON.stringify(act1));
      /* 28 November: the home's Actions carry no Messages row — the Chat tab's badge says it — and a count of what
         waits is the level's chip (the CountPill); All lessons keeps its plain figure.
         23 November: a row of words carries no icon. An Actions row is its word, its count in the sub grey and the
         chevron, on the box's 16 inset, 60 tall — each led with a glyph on a coloured tile for two days (a pencil, a
         person-and-plus, a bubble, an hourglass, a trophy, a camera) — and All lessons under them the same door */
      const nJobs = await page.locator('[data-scroll="screen"] .nsc-ruled > [data-row-door]').count(), jobs = [];
      for (let i = 0; i < nJobs; i++) jobs.push(await M.rowLead(page, '[data-scroll="screen"] .nsc-ruled > [data-row-door]', i));
      check("(c2b) the home's Actions rows and All lessons lead with their word: no glyph before any, the chevron after, 60 tall on the box's inset",
        jobs.length >= 3 && jobs.every((j) => M.plainRow(j) && j.h === 60 && j.inset === 15 && j.color === "rgb(29, 27, 23)") && jobs.some((j) => j.label === "Join requests") && !jobs.some((j) => j.label === "Messages") && jobs[jobs.length - 1].label === "All lessons",
        JSON.stringify(jobs.map((j) => j && `${j.label} lead ${j.lead} before ${j.before} [${j.glyphs}] h${j.h}`)));
      {
        /* the same coach on a heavy morning: three requests, a join request, a message, a lesson to log, somebody drifting */
        const db2 = freshDb();
        M.addBooking(db2, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(3)), time: "9:00 am", status: "requested" });
        M.addBooking(db2, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(4)), time: "4:00 pm", status: "requested" });
        M.addBooking(db2, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-1)), time: "9:00 am" });
        /* a clip to review, so the morning still runs past six rows now the Messages row is gone (28 November) —
           sent on another day than yesterday's lesson, which a lesson on its own day would mark as logged */
        M.addLesson(db2, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-3)), focus: "Chipping", sentBy: IDS.adult, unread: true });
        for (const [id, email, name] of [["00000000-0000-4000-8000-0000000da2a0", "dara@t.ie", "Dara Quinn"], ["00000000-0000-4000-8000-0000000f1011", "fionn@t.ie", "Fionn Daly"]]) {
          M.addUser(db2, { id, email }); M.addProfile(db2, { id, role: "player", name, type: "adult", coachId: IDS.coach, dob: "1990-02-02" });
        }
        const busy = await boot(db2, "coach");
        await tap(busy.page, '[aria-label="Today"]', 900);
        const act2 = await actionsOf(busy.page); await busy.shot("01c-actions-filter");
        check("(c3) …and past two kinds and past six rows the filter is there: All and a tile a kind", !!act2 && act2.kinds > 2 && act2.rows > 6 && act2.filter && act2.tiles === act2.kinds + 1, JSON.stringify(act2));
        await busy.ctx.close();
      }
      await tap(page, '[aria-label="Roster"]', 900);
      const ros = await rows(page, '[data-scroll="screen"]'); await shot("02-roster");
      const g3 = await page.evaluate(() => { const t = document.querySelector('[data-tour="roster-invite"]'), s = document.querySelector('[data-tour="roster-tab"]'); return t && s ? Math.round(s.getBoundingClientRect().top - t.getBoundingClientRect().bottom) : null; });
      const inv = await tile(page, "Add player");
      check("(d) the roster: the players' rows and All lessons Lares cards, the two action tiles keys, SPACE.section between the tiles and the list", !!ros && ros.filter((r) => r.kind === "row").length >= 3 && ros.filter((r) => r.kind === "row").every(soft) && !!inv && inv.bg !== NONE && g3 !== null && g3 >= 40, `${say(ros)} · gap ${g3} · ${JSON.stringify(inv)}`);
      await tap(page, '[aria-label="Chat"]', 900);
      await shot("03-chat");
      const chat = await plainRows(page);
      check("(e) Chat is Messages' plain list: a row per thread, no box, a separator inset from the face under every row but the last", messages(chat), JSON.stringify(chat));
      await tap(page, '[data-tour="profile-pill"]', 900);
      if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
      const set = await rows(page, '[data-scroll="screen"]'); await shot("04-settings");
      /* since 21 November Settings' rows sit in groups: one soft box on the wash per group, the rows inside
         on a fine rule — iOS's grouped list and Lares's More sheet — where it was twenty slabs */
      const groups = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] .nsc-group')].filter((g) => g.getBoundingClientRect().height > 0).map((g) => {
        const cs = getComputedStyle(g), kids = [...g.children].filter((k) => k.getBoundingClientRect().height > 0);
        return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, n: kids.length,
                 own: kids.filter((k) => getComputedStyle(k).backgroundColor !== "rgba(0, 0, 0, 0)").length,
                 rules: kids.slice(0, -1).filter((k) => getComputedStyle(k).borderBottomWidth === "1px").length, lastRule: kids.length ? getComputedStyle(kids[kids.length - 1]).borderBottomWidth : null }; }));
      check("(f) Settings' rows sit in groups: each a white box at 18px, iOS's grouped list, the rows inside on a fine rule, the last with none",
        groups.length >= 3 && groups.reduce((n, g) => n + g.n, 0) >= 8 && groups.every((g) => g.bg === CARD && g.radius === "18px" && g.own === 0 && g.rules === g.n - 1 && g.lastRule === "0px"), JSON.stringify(groups).slice(0, 300));
      /* 23 November: "I don't want you to have the icons in the settings, as it makes it look very tacky." A Settings row
         is label · value · chevron and nothing leading it: the label on the group's 16 inset with nothing before it, 56
         tall, the only glyph a chevron (none beside a switch or a value that opens nothing); what a row holds is its
         value, whole, in the sub grey on the label's line at the right — never a small line under the label on some rows
         and a value on the right on others */
      const nRows = await page.locator('[data-scroll="screen"] .nsc-group > *').count(), srows = [];
      for (let i = 0; i < nRows; i++) srows.push(await M.rowLead(page, '[data-scroll="screen"] .nsc-group > *', i));
      const badLead = srows.filter((r) => !r || r.lead !== 0 || r.before !== 0 || r.inset !== 16 || r.h !== 56 || r.glyphs.some((g) => g !== "chevron-right") || r.glyphs.length > 1 || r.size !== "16px");
      check("(f2) no Settings row leads with a glyph: every row is its label on the group's 16 inset, 56 tall, and its only glyph a chevron",
        srows.length >= 8 && badLead.length === 0 && srows.filter((r) => r.glyphs.length === 1).length >= 6, `${srows.length} rows · ` + JSON.stringify(badLead.slice(0, 3)));
      const valued = srows.filter((r) => r && r.value), subs = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] .nsc-group [data-row] span')].filter((s) => s.children.length === 0 && s.textContent.trim() && getComputedStyle(s).fontSize === "13px").map((s) => s.textContent.trim()));
      check("(f3) a Settings row's value sits on the label's line at the right, whole, in the sub grey — Default view, the invite code, the build — and no row carries a small line under its label",
        valued.length >= 3 && valued.every((r) => r.valueLine === "beside" && !r.valueCut && r.valueColor === "rgb(93, 89, 80)") && valued.some((r) => r.label === "Invite code" && r.value === "QW7X2M") && subs.length === 0, JSON.stringify({ valued: valued.map((r) => `${r.label}: ${r.value} ${r.valueLine} ${r.valueColor}`), subs }));
      const view = page.locator('[data-tour="settings-view"]');
      if (await view.count()) {
        await view.first().click(); await page.waitForTimeout(600);
        /* the options start where the label does: with the tile gone they are no longer pushed 44 further in */
        const lined = await page.evaluate(() => { const r = document.querySelector('[data-tour="settings-view"]'); if (!r) return null; const lab = r.querySelector("[data-row-label]"), opts = [...r.querySelectorAll("[data-row-option]")];
          return { label: Math.round(lab.getBoundingClientRect().left), options: opts.map((o) => Math.round(o.getBoundingClientRect().left)), glyphs: opts.map((o) => o.parentElement.querySelectorAll("svg").length), box: Math.round(r.getBoundingClientRect().left) }; });
        check("(g0) the unfolded options line up with the row's label, 16 in from the group's edge, and carry no glyph but the chosen one's tick",
          !!lined && lined.options.length === 2 && lined.options.every((x) => x === lined.label) && lined.label - lined.box === 16 && lined.glyphs.filter((n) => n === 1).length === 1 && lined.glyphs.filter((n) => n === 0).length === 1, JSON.stringify(lined));
        const open = await page.evaluate(() => { const r = document.querySelector('[data-tour="settings-view"]'); if (!r) return null; const inner = [...r.querySelectorAll("div")].find((d) => getComputedStyle(d).backgroundColor === "rgb(255, 255, 255)"); const g = r.closest(".nsc-group"); return { row: getComputedStyle(g || r).backgroundColor, options: inner ? "surface" : null }; });
        await shot("05-settings-open");
        check("(g) a Settings row that unfolds stays in its white group and lays its options on the surface, so the open list reads inside the row", !!open && open.row === CARD && open.options === "surface", JSON.stringify(open));
        await view.first().click(); await page.waitForTimeout(400);
      }
      /* the profile behind Settings' head: its Sign-in rows are the words alone (an envelope, a padlock and a red bin
         led them) — Email with the address as its value, Change password and its chevron, Delete account told by its
         red word, with no bin and no tick box */
      if (await page.locator('[data-tour="settings-profile"]').count()) {
        await tap(page, '[data-tour="settings-profile"]', 1000);
        const acct = [];
        for (let i = 0; i < await page.locator('[data-tour="profile-account"] > [data-row]').count(); i++) acct.push(await M.rowLead(page, '[data-tour="profile-account"] > [data-row]', i));
        const [em, pw, del] = acct;
        check("(g3) the profile's Sign-in rows carry no glyph: Email and its address, Change password and a chevron, Delete account in the family's red — nothing before any word",
          acct.length === 3 && M.plainRow(em, { glyphs: [] }) && em.label === "Email" && em.value === "coach@t.ie" && !em.valueCut && M.plainRow(pw) && pw.label === "Change password"
          && M.plainRow(del, { glyphs: [] }) && del.label === "Delete account" && del.color === "rgb(154, 50, 42)", JSON.stringify(acct.map((r) => r && `${r.label} lead ${r.lead} before ${r.before} [${r.glyphs}] ${r.color}`)));
        await M.back(page);
      }
      await tap(page, '[aria-label="Diary"]', 1000);
      const onList = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await onList.count()) && (await onList.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      const diary = await rows(page, '[data-scroll="screen"]'); await shot("06-diary-list");
      check("(h) the Diary's List view: a day's box — a card of chips — stands on its own 2px ring; any list row beside it is a Lares card", !!diary && diary.some((r) => r.kind === "day") && diary.filter((r) => r.kind === "day").every((r) => !r.edges[0].endsWith(r.bg) && parseFloat(r.edges[0]) >= 2 && r.radius === "20px") && diary.filter((r) => r.kind === "row").every(soft), say(diary));
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-group"]', 1000);
      await shot("07-sheet-people");
      /* since 24 November New group's people — several are chosen — are the rows of ONE grouped box (Settings' own),
         where they were a white card each: the box is the white card on its line and ledge, and the ground it sits
         on, the first painted ancestor, is the panel, never the wash */
      const grp = await page.evaluate(() => { const g = document.querySelector("[data-sheet] .nsc-group"); if (!g) return null; const cs = getComputedStyle(g);
        let el = g.parentElement; while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
        return { rows: g.querySelectorAll("[data-person-row]").length, bg: cs.backgroundColor, edge: cs.borderTopColor, bw: cs.borderTopWidth, ledge: cs.boxShadow, ground: el ? getComputedStyle(el).backgroundColor : null }; });
      check("(i) inside a sheet the people are one white box on its line and ledge, the rows inside it — an object on the white sheet",
        !!grp && grp.rows >= 3 && grp.bg === CARD && grp.edge === WHITE_RING && parseFloat(grp.bw) >= 2 && grp.ledge.includes(WHITE_LEDGE) && grp.ground === CARD, JSON.stringify(grp));
      await closeSheet(page);
      await ctx.close();
    }
    /* ---------- a player, and 320 ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "adult", 320);
      await tap(page, '[aria-label="Diary"]', 1000);
      const onList = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await onList.count()) && (await onList.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      const d = await rows(page, '[data-scroll="screen"]'); await shot("08-player-diary-320");
      check("(j) a player at 320: the Diary's day boxes stand on the light grey line and every list row is the white card; nothing scrolls sideways", !!d && d.some((r) => r.kind === "day") && d.filter((r) => r.kind === "row").every(soft) && (await page.evaluate(() => document.documentElement.scrollWidth)) <= 320, say(d));
      await tap(page, '[aria-label="Chat"]', 900);
      const c = await plainRows(page);
      check("(k) the player's Chat is Messages' plain list too: no box per thread", messages(c), JSON.stringify(c));
      await ctx.close();
    }
    /* ---------- (l) Settings as the player, the parent and the junior ---------- */
    /* 23 November: no Settings row leads with a glyph, whoever is signed in and at either width — the label on the
       group's 16 inset with nothing before it, a chevron the only glyph, the value whole in the sub grey: beside the
       label, or on the line under it where the row cannot hold both (never an ellipsis) */
    for (const [role, width] of [["adult", 390], ["parent", 390], ["junior", 390], ["adult", 320], ["parent", 320]]) {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, role, width);
      await tap(page, '[data-tour="profile-pill"]', 900);
      if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
      const n = await page.locator('[data-scroll="screen"] .nsc-group > *').count(), rs = [];
      for (let i = 0; i < n; i++) rs.push(await M.rowLead(page, '[data-scroll="screen"] .nsc-group > *', i));
      const bad = rs.filter((r) => !r || r.lead !== 0 || r.before !== 0 || r.inset !== 16 || r.glyphs.length > 1 || r.glyphs.some((g) => g !== "chevron-right") || r.labelCut || r.valueCut
        || (r.value && r.valueColor !== "rgb(93, 89, 80)") || (r.value ? (r.valueLine === "beside" ? r.h !== 56 : r.valueLine !== "under") : r.h !== 56));
      if (width === 320) await shot(`09-settings-${role}-320`);
      check(`(l) ${role} at ${width}: every Settings row is label · value · chevron — nothing before the label, no glyph but the chevron, nothing cut`,
        rs.length >= 8 && bad.length === 0 && rs.some((r) => r.label === "Default view" && r.value === "Feed") && rs.some((r) => r.label === "Sign out"), `${rs.length} rows · ` + JSON.stringify(bad.slice(0, 3)));
      await notifications(page, `${role} at ${width}`, width === 320 ? `10-notifications-${role}-320` : null, shot);
      await dataPage(page, `${role} at ${width}`);
      await ctx.close();
    }
    /* ---------- (l2) a coach's Lessons as a player has a way back ---------- */
    /* (24 November, e242853) it opened the player's code screen with six code boxes and nothing else — no Back, no
       close, no tab bar — and a coach who tapped it to look could leave only by closing the app. It carries the
       pushed screen's Back, 44 to a finger, and the edge swipe; either lands on Settings. The coach's Notifications
       and Data & permissions are read as the other roles' are */
    for (const width of [390, 320]) {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "coach", width);
      await tap(page, '[data-tour="profile-pill"]', 900);
      if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
      const row = page.locator('[data-scroll="screen"] .nsc-group [data-row]', { hasText: /^Lessons as a player$/ });
      const onSettings = async () => (await row.count()) === 1 && (await M.codeBoxes(page).count()) === 0;
      await row.first().dispatchEvent("click"); await page.waitForTimeout(900);
      const codes = await M.codeBoxes(page).count(), back = await M.fingerFit(page, '[data-tour="nocoach-back"]');
      await shot(`13-coach-lessons-as-player-${width}`);
      check(`(l2) the coach at ${width}: Lessons as a player opens the code screen with the pushed screen's Back, top left, on the screen and 44 to a finger`,
        codes === 6 && !!back && back.onScreen && back.missed.length === 0 && back.left <= 16 && back.top <= 80, JSON.stringify({ codes, back }));
      await tap(page, '[data-tour="nocoach-back"]', 900);
      const viaBack = await onSettings();
      await row.first().dispatchEvent("click"); await page.waitForTimeout(900);
      /* the edge swipe: a thumb from the left edge across */
      await page.mouse.move(6, 420); await page.mouse.down();
      for (let k = 1; k <= 8; k++) await page.mouse.move(6 + k * 25, 422);
      await page.mouse.up(); await page.waitForTimeout(900);
      const viaSwipe = await onSettings();
      check(`(l2) …Back returns to Settings, and so does the edge swipe`, viaBack && viaSwipe, JSON.stringify({ viaBack, viaSwipe }));
      await notifications(page, `the coach at ${width}`, null, shot);
      await dataPage(page, `the coach at ${width}`);
      await ctx.close();
    }
    /* ---------- (m) a first-run empty root tab has presence ---------- */
    /* (22 November, art direction) the coach's day before a player, a player's Lessons and Drills before anything
       is logged or set, Chat before anything is said: the screen's glyph on an 88px disc of the wash, the line as a
       heading (20/700) centred under it, the one next step where there is one — never the faint line, never a box.
       Every other empty list stays the line (sprint-3 (l) reads Saved's and the roster's search) */
    {
      const E = { coach: "00000000-0000-4000-8000-0000000c0ac2", coachF: "00000000-0000-4000-8000-0000000c0ac3", fia: "00000000-0000-4000-8000-0000000f1a01" };
      const db = M.emptyDb();
      M.addUser(db, { id: E.coach, email: "new@t.ie" }); M.addProfile(db, { id: E.coach, role: "coach", name: "Aoife Daly", inviteCode: "ZX9K4P" });
      M.addUser(db, { id: E.coachF, email: "other@t.ie" }); M.addProfile(db, { id: E.coachF, role: "coach", name: "Ruth Hayes", inviteCode: "MN4T7R" });
      M.addUser(db, { id: E.fia, email: "fia@t.ie" }); M.addProfile(db, { id: E.fia, role: "player", name: "Fia Nolan", type: "adult", coachId: E.coachF, dob: "1995-05-05" });
      const bootAs = async (id) => {
        const u = Object.values(db.users).find((x) => x.id === id);
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); page.setDefaultTimeout(8000);
        page.on("pageerror", (e) => errors.push(`empty ${id.slice(-4)}: ${String(e.message || e)}`));
        await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
        await M.injectSession(page, M.session(u, db));
        await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
        return { ctx, page, shot: (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) }) };
      };
      /* 28 November, the design render: the disc is 96, the lead's pale on its ledge, and the line the titles'
         serif at 24/700 — it was 88 on the wash with the line in TYPE.section's 20 */
      const heroOf = (page) => page.evaluate(() => {
        const hs = [...document.querySelectorAll('[data-scroll="screen"] [data-empty-hero]')], h = hs[0]; if (!h) return { n: 0 };
        const disc = h.querySelector("[data-hero-disc]"), line = h.querySelector("[data-hero-line]"), dr = disc.getBoundingClientRect(), lr = line.getBoundingClientRect(), ls = getComputedStyle(line), ds = getComputedStyle(disc), glyph = disc.querySelector("svg");
        return { n: hs.length, disc: [Math.round(dr.width), Math.round(dr.height)], round: parseFloat(ds.borderTopLeftRadius) >= 44, discBg: ds.backgroundColor, glyph: glyph ? Math.round(glyph.getBoundingClientRect().width) : 0,
                 line: line.textContent.trim(), size: ls.fontSize, weight: ls.fontWeight, under: lr.top >= dr.bottom, centred: Math.abs((dr.left + dr.width / 2) - (lr.left + lr.width / 2)) <= 1, boxed: !!h.closest(".nsc-list, .nsc-day"),
                 buttons: [...h.querySelectorAll("button")].map((b) => ({ tour: b.getAttribute("data-tour"), text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) })) };
      });
      const hero = (o, words) => !!o && o.n === 1 && o.disc[0] === 96 && o.disc[1] === 96 && o.round && o.discBg !== NONE && o.discBg !== CARD && o.glyph >= 36 && o.line === words && o.size === "24px" && o.weight === "700" && o.under && o.centred && !o.boxed;
      const c = await bootAs(E.coach);
      await tap(c.page, '[aria-label="Today"]', 900);
      const h1 = await heroOf(c.page); await c.shot("09-empty-coach-home");
      check("(m) a coach with nobody yet: No players yet as a heading under the sport's glyph on its 88px disc, and the one next step — Add player, the app's Button",
        hero(h1, "No players yet") && h1.buttons.length === 1 && h1.buttons[0].tour === "today-add-player" && h1.buttons[0].text === "Add player" && h1.buttons[0].h >= 50, JSON.stringify(h1));
      await tap(c.page, '[aria-label="Chat"]', 900);
      const h2 = await heroOf(c.page); await c.shot("10-empty-coach-chat");
      check("(m1) the coach's Chat with nothing said: No conversations yet under Chat's own glyph, and no second action — the header's plus is the screen's", hero(h2, "No conversations yet") && h2.buttons.length === 0 && (await c.page.locator('[data-tour="chat-new"]').count()) === 1, JSON.stringify(h2));
      await c.ctx.close();
      const f = await bootAs(E.fia);
      const h3 = await heroOf(f.page); await f.shot("11-empty-player-lessons");
      check("(m2) a player with no lesson yet: No lessons yet under the sport's glyph, nothing to tap", hero(h3, "No lessons yet") && h3.buttons.length === 0, JSON.stringify(h3));
      await tap(f.page, '[aria-label="Drills"]', 900);
      const h4 = await heroOf(f.page); await f.shot("12-empty-player-drills");
      check("(m3) the Drills tab with none set: No drills yet under the tab's own glyph", hero(h4, "No drills yet") && h4.buttons.length === 0, JSON.stringify(h4));
      await f.ctx.close();
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
