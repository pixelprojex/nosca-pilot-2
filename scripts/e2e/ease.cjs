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
const WASH = "rgb(235, 243, 234)", EDGE = "rgba(47, 107, 58, 0.72)", NONE = "rgba(0, 0, 0, 0)";

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
const soft = (r) => r.bg === WASH && r.radius === "8px" && r.edges.every((e) => e.endsWith(NONE) || e.startsWith("0px"));
const say = (rs) => rs ? `${rs.length}: ` + rs.filter((r) => r.kind === "row" && !soft(r)).slice(0, 3).map((r) => `"${r.text}" ${r.bg} ${r.edges[0]} r${r.radius}`).join(" | ") : "no scope";
/* a tile's own edge, by its label */
const tile = (page, label) => page.evaluate((label) => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || x.textContent.trim()) === label && x.getBoundingClientRect().width > 0); if (!b) return null; const cs = getComputedStyle(b); return { label, bg: cs.backgroundColor, edge: `${cs.borderTopWidth} ${cs.borderTopColor}` }; }, label);
const gap = (page, fromSel, toText) => page.evaluate(([fromSel, toText]) => {
  const from = document.querySelector(fromSel); if (!from) return null;
  const to = [...document.querySelectorAll('[data-scroll="screen"] div, [data-scroll="screen"] span')].find((d) => d.children.length === 0 && d.textContent.trim() === toText && d.getBoundingClientRect().top > from.getBoundingClientRect().bottom - 1);
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
      check("(a) the coach's home: every row — the day's lessons, the folded next day, the Actions rows, All lessons — sits on golf's wash with no edge, 8px corners", !!home && home.filter((r) => r.kind === "row").length >= 5 && home.filter((r) => r.kind === "row").every(soft), say(home));
      const log = await tile(page, "Log"), add = await tile(page, "Add player");
      check("(b) …while the board's tiles keep the sport's edge (the one filled in the accent, the rest outlined)", !!add && add.edge.endsWith(EDGE) && parseFloat(add.edge) >= 1 && !!log && log.bg !== NONE, JSON.stringify({ log, add }));
      const g1 = await gap(page, 'button[aria-label="Add player"]', "Today");
      const g2 = await gap(page, '[data-tour="today-nextday"]', "Actions");
      check("(c) the home breathes: SPACE.section (40) from the board to Today's head and from the folded next day to Actions", g1 !== null && g1 >= 40 && g2 !== null && g2 >= 40, JSON.stringify({ boardToToday: g1, nextDayToActions: g2 }));
      await tap(page, '[aria-label="Roster"]', 900);
      const ros = await rows(page, '[data-scroll="screen"]'); await shot("02-roster");
      const g3 = await page.evaluate(() => { const t = document.querySelector('[data-tour="roster-invite"]'), s = document.querySelector('[data-tour="roster-tab"]'); return t && s ? Math.round(s.getBoundingClientRect().top - t.getBoundingClientRect().bottom) : null; });
      const inv = await tile(page, "Add player");
      check("(d) the roster: the players' rows and All lessons on the wash, the two action tiles on the edge, SPACE.section between the tiles and the list", !!ros && ros.filter((r) => r.kind === "row").length >= 3 && ros.filter((r) => r.kind === "row").every(soft) && !!inv && inv.bg !== NONE && g3 !== null && g3 >= 40, `${say(ros)} · gap ${g3} · ${JSON.stringify(inv)}`);
      await tap(page, '[aria-label="Chat"]', 900);
      const chat = await rows(page, '[data-scroll="screen"]'); await shot("03-chat");
      check("(e) Chat's rows on the wash", !!chat && chat.filter((r) => r.kind === "row").length >= 1 && chat.filter((r) => r.kind === "row").every(soft), say(chat));
      await tap(page, '[data-tour="profile-pill"]', 900);
      if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
      const set = await rows(page, '[data-scroll="screen"]'); await shot("04-settings");
      check("(f) Settings' rows on the wash, every shape of them", !!set && set.filter((r) => r.kind === "row").length >= 8 && set.filter((r) => r.kind === "row").every(soft), say(set));
      const view = page.locator('[data-tour="settings-view"]');
      if (await view.count()) {
        await view.first().click(); await page.waitForTimeout(600);
        const open = await page.evaluate(() => { const r = document.querySelector('[data-tour="settings-view"]'); if (!r) return null; const inner = [...r.querySelectorAll("div")].find((d) => getComputedStyle(d).backgroundColor === "rgb(255, 255, 255)"); return { row: getComputedStyle(r).backgroundColor, options: inner ? "surface" : null }; });
        await shot("05-settings-open");
        check("(g) a Settings row that unfolds keeps the wash and lays its options on the surface, so the open list reads inside the row", !!open && open.row === WASH && open.options === "surface", JSON.stringify(open));
        await view.first().click(); await page.waitForTimeout(400);
      }
      await tap(page, '[aria-label="Diary"]', 1000);
      const onList = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
      if ((await onList.count()) && (await onList.getAttribute("aria-label")) !== "List") await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      const diary = await rows(page, '[data-scroll="screen"]'); await shot("06-diary-list");
      check("(h) the Diary's List view: a day's box — a container of times — keeps the sport's edge; any list row beside it is on the wash", !!diary && diary.some((r) => r.kind === "day") && diary.filter((r) => r.kind === "day").every((r) => r.edges[0].endsWith(EDGE) && parseFloat(r.edges[0]) >= 1) && diary.filter((r) => r.kind === "row").every(soft), say(diary));
      await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-group"]', 1000);
      const pick = await rows(page, "[data-sheet]"); await shot("07-sheet-people");
      const sheet = await page.evaluate(() => { const s = document.querySelector("[data-sheet]"); if (!s) return null; const el = [s, ...s.querySelectorAll("*")].find((x) => getComputedStyle(x).backgroundColor === "rgb(255, 255, 255)" && x.getBoundingClientRect().width > 300); return el ? "rgb(255, 255, 255)" : getComputedStyle(s).backgroundColor; });
      check("(i) inside a sheet the people rows are on the wash and the sheet itself stays the surface, so the rows read as objects on it", !!pick && pick.filter((r) => r.kind === "row").length >= 3 && pick.filter((r) => r.kind === "row").every(soft) && sheet === "rgb(255, 255, 255)", `${say(pick)} · sheet ${sheet}`);
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
      check("(j) a player at 320: the Diary's day boxes keep their edge and every list row is on the wash; nothing scrolls sideways", !!d && d.some((r) => r.kind === "day") && d.filter((r) => r.kind === "row").every(soft) && (await page.evaluate(() => document.documentElement.scrollWidth)) <= 320, say(d));
      await tap(page, '[aria-label="Chat"]', 900);
      const c = await rows(page, '[data-scroll="screen"]');
      check("(k) the player's Chat rows on the wash", !!c && c.filter((r) => r.kind === "row").length >= 1 && c.filter((r) => r.kind === "row").every(soft), say(c));
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
