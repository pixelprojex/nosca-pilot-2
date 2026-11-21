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
   #E2E2E7, with a ledge of it, 14px corners — a day's box the same line;
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
const CARD = "rgb(255, 255, 255)", EDGE = "rgb(226, 226, 231)", NONE = "rgba(0, 0, 0, 0)";

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
    out.push({ kind: "row", text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 24), bg: cs.backgroundColor, radius: cs.borderTopLeftRadius,
               edges: ["Top", "Right", "Bottom", "Left"].map((k) => `${cs[`border${k}Width`]} ${cs[`border${k}Color`]}`) }); });
  root.querySelectorAll(".nsc-day").forEach((el) => { if (!vis(el)) return; const cs = getComputedStyle(el);
    out.push({ kind: "day", text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 24), bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, edges: [`${cs.borderTopWidth} ${cs.borderTopColor}`] }); });
  return out;
}, scope);
/* a list row is the white card on the light grey line, every side, 14px corners (the wash with no edge from 14 November) */
const soft = (r) => r.bg === CARD && r.radius === "14px" && r.edges.every((e) => e.endsWith(EDGE) && parseFloat(e) >= 1);
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
      check("(a) the coach's home: every row — the day's lessons, the folded next day, the Actions rows, All lessons — is the white card on the light grey line, 14px corners", !!home && home.filter((r) => r.kind === "row").length >= 5 && home.filter((r) => r.kind === "row").every(soft), say(home));
      /* since 18 November the home carries no board: the six verbs were every one on the plus already, and the founder asked for the duplicate gone */
      const board = await page.locator('[data-tour="today-board"]').count();
      await tap(page, '[data-tour="quick"]', 900);
      const add = await tile(page, "Add player");
      /* the plus's eight are Duolingo's white keys since the afternoon of 21 November (stone that morning): white,
         a light grey ring, a grey ledge — no green rim */
      check("(b) the home has no board of actions — they live on the plus, whose eight are calm white keys, no green rim", board === 0 && !!add && add.bg === "rgb(255, 255, 255)" && /rgb\(226, 226, 231\)/.test(add.edge) && !/32, 122, 48/.test(add.edge), JSON.stringify({ board, add }));
      await page.keyboard.press("Escape"); await page.mouse.click(20, 120); await page.waitForTimeout(700);
      await tap(page, '[aria-label="Today"]', 900);
      const g1 = await gap(page, '[data-scroll="screen"] h1', "Today");
      const g2 = await gap(page, '[data-tour="today-nextday"]', "Actions");
      check("(c) the home breathes: SPACE.section (40) from the date to Today's head and from the folded next day to Actions", g1 !== null && g1 >= 40 && g2 !== null && g2 >= 40, JSON.stringify({ dateToToday: g1, nextDayToActions: g2 }));
      await tap(page, '[aria-label="Roster"]', 900);
      const ros = await rows(page, '[data-scroll="screen"]'); await shot("02-roster");
      const g3 = await page.evaluate(() => { const t = document.querySelector('[data-tour="roster-invite"]'), s = document.querySelector('[data-tour="roster-tab"]'); return t && s ? Math.round(s.getBoundingClientRect().top - t.getBoundingClientRect().bottom) : null; });
      const inv = await tile(page, "Add player");
      check("(d) the roster: the players' rows and All lessons the white card, the two action tiles keys, SPACE.section between the tiles and the list", !!ros && ros.filter((r) => r.kind === "row").length >= 3 && ros.filter((r) => r.kind === "row").every(soft) && !!inv && inv.bg !== NONE && g3 !== null && g3 >= 40, `${say(ros)} · gap ${g3} · ${JSON.stringify(inv)}`);
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
      check("(f) Settings' rows sit in groups: each a white box at 16px, iOS's grouped list, the rows inside on a fine rule, the last with none",
        groups.length >= 3 && groups.reduce((n, g) => n + g.n, 0) >= 8 && groups.every((g) => g.bg === CARD && g.radius === "16px" && g.own === 0 && g.rules === g.n - 1 && g.lastRule === "0px"), JSON.stringify(groups).slice(0, 300));
      const view = page.locator('[data-tour="settings-view"]');
      if (await view.count()) {
        await view.first().click(); await page.waitForTimeout(600);
        const open = await page.evaluate(() => { const r = document.querySelector('[data-tour="settings-view"]'); if (!r) return null; const inner = [...r.querySelectorAll("div")].find((d) => getComputedStyle(d).backgroundColor === "rgb(255, 255, 255)"); const g = r.closest(".nsc-group"); return { row: getComputedStyle(g || r).backgroundColor, options: inner ? "surface" : null }; });
        await shot("05-settings-open");
        check("(g) a Settings row that unfolds stays in its white group and lays its options on the surface, so the open list reads inside the row", !!open && open.row === CARD && open.options === "surface", JSON.stringify(open));
        await view.first().click(); await page.waitForTimeout(400);
      }
      await tap(page, '[aria-label="Diary"]', 1000);
      const onList = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await onList.count()) && (await onList.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      const diary = await rows(page, '[data-scroll="screen"]'); await shot("06-diary-list");
      check("(h) the Diary's List view: a day's box — a container of times — stands on the light grey line; any list row beside it is the white card", !!diary && diary.some((r) => r.kind === "day") && diary.filter((r) => r.kind === "day").every((r) => r.edges[0].endsWith(EDGE) && parseFloat(r.edges[0]) >= 1) && diary.filter((r) => r.kind === "row").every(soft), say(diary));
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-group"]', 1000);
      const pick = await rows(page, "[data-sheet]"); await shot("07-sheet-people");
      /* the ground the rows sit on: the first painted ancestor of a row inside the sheet — the panel, never the wash */
      const sheet = await page.evaluate(() => { const row = document.querySelector("[data-sheet] .nsc-list > *"); let el = row && row.parentElement; while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement; return el ? getComputedStyle(el).backgroundColor : null; });
      check("(i) inside a sheet the people rows are white cards on their line and ledge, so the rows read as objects on the white sheet", !!pick && pick.filter((r) => r.kind === "row").length >= 3 && pick.filter((r) => r.kind === "row").every(soft) && !!sheet && sheet === CARD, `${say(pick)} · ground ${sheet}`);
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
    check("(n) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
