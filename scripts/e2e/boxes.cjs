/* THE APP'S LIST, IN THE SHEETS AND SCREENS THAT KEPT THE OLD ONE.
   Every list is a column of boxes on the sport's edge (`.nsc-list`), or
   one box with rows inside it the way a diary day holds its times
   (`.nsc-day`). The lesson's peek, the register, the Message picker,
   the pick-a-player sheet, the roster's groups and its All lessons,
   Drifting, the player file's foot, the child's screen and the tip
   sheet's prompts drew hairline rows under a section rule — two list
   languages in one app, and a row of the old one inside a box of the
   new on the roster and every lesson list. And one add control in a
   header: four screens drew it four ways, three with an ink plus on the
   accent under the 3:1 a glyph needs.
   Usage: node boxes.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4351), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", eoin: "00000000-0000-4000-8000-000000e01e01", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", rider: "00000000-0000-4000-8000-00000000e9c0", tadhg: "00000000-0000-4000-8000-0000000ta0d6" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
/* every day is counted from the one the page clock is pinned to, so a
   run that starts before midnight and ends after it still agrees */
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nice = (x) => `${DAYS[x.getDay()]} ${x.getDate()} ${MON[x.getMonth()]}`;
const DAY_FORM = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [1-9]\d? (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/;
/* EDGE(t): the sport's mark at 72% — never black, never ink — and the
   theme's hairline for a row inside a box */
const EDGE = { golf: "rgba(47, 107, 58, 0.72)", equestrian: "rgba(122, 59, 74, 0.72)" };
const HAIRLINE = { golf: "rgb(228, 236, 225)" };

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
  person("rider", "rider@t.ie", { role: "coach", name: "Róisín Daly", sport: "equestrian", inviteCode: "RD4K9P" });
  person("tadhg", "tadhg@t.ie", { role: "player", name: "Tadhg Ryan", type: "adult", sport: "equestrian", coachId: IDS.rider, dob: "1988-08-08" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]),
    groups: [{ id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], day: 5, time: "9:00 am", weeks: 8, sport: "golf" }] });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: TODAY, time: "10:30 am" });
  /* a group lesson today: its register holds everyone */
  M.addBooking(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: TODAY, time: "4:00 pm" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-12)), focus: "Short game", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-26)), focus: "Putting", unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(-9)), focus: "Driving", unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(-23)), focus: "Chipping", unread: false });
  /* nothing booked and the last lesson two months gone: Drifting */
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.aoife, date: M.ymd(dayFrom(-60)), focus: "Bunker play", unread: false });
  M.addLesson(db, { coachId: IDS.rider, playerId: IDS.tadhg, date: M.ymd(dayFrom(-5)), focus: "Flatwork", unread: false });
  /* the riding coach's only competition has been: a list with nothing ahead */
  db.competitions.push({ id: M.uuid(), coach_id: IDS.rider, player_id: null, name: "Spring Show", kind: null, venue: null, event_date: M.ymd(dayFrom(-3)), created_at: `${TODAY}T07:00:00Z` });
  /* tomorrow's lesson, for the peek read after midnight */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(1)), time: "9:00 am" });
  db.tips.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, title: "Trust the shallow", body: null, created_at: `${M.ymd(dayFrom(-12))}T10:00:00Z` });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Gate drill" });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.junior, title: "Ladder drill" });
  /* one ahead and one that has been and gone */
  db.competitions.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, name: "Autumn Medal", kind: null, venue: null, event_date: M.ymd(dayFrom(12)), created_at: `${TODAY}T07:00:00Z` });
  db.competitions.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, name: "Club Fourball", kind: null, venue: null, event_date: M.ymd(dayFrom(-6)), created_at: `${TODAY}T07:00:00Z` });
  return db;
}

const { check, results, summary } = M.checker("boxes");

/* every visible box of every `.nsc-list` under `scope`: the edge on all
   four sides in the sport's own colour (Chrome reads EDGE_W's 1.5px back
   snapped to a whole pixel, so the width is held to at least one and
   the colour to the edge exactly), 8px corners; and nothing inside a
   box drawing a rule across it, top or bottom, painted or written
   inline where the box's own !important edge would hide it (a `.nsc-day`
   keeps its own rows) */
const audit = (page, scope, edge) => page.evaluate(([scope, edge]) => {
  const root = scope ? document.querySelector(scope) : document;
  if (!root) return null;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = (el) => (el.innerText || el.tagName).replace(/\s+/g, " ").slice(0, 28);
  const out = { lists: 0, boxes: 0, bad: [], rules: [] };
  root.querySelectorAll(".nsc-list").forEach((list) => {
    if (!vis(list)) return; out.lists++;
    [...list.children].forEach((box) => {
      if (!vis(box)) return; out.boxes++;
      const cs = getComputedStyle(box);
      const sides = ["Top", "Right", "Bottom", "Left"].every((s) => parseFloat(cs[`border${s}Width`]) >= 1 && cs[`border${s}Color`] === edge && cs[`border${s}Style`] === "solid");
      if (!sides || cs.borderTopLeftRadius !== "8px") out.bad.push(`${label(box)} · ${cs.borderTopWidth} ${cs.borderTopColor} (want ${edge}) r${cs.borderTopLeftRadius}`);
      const bw = box.getBoundingClientRect().width;
      [box, ...box.querySelectorAll("*")].forEach((el) => {
        const day = el.closest(".nsc-day"); if (day && box.contains(day) && day !== el) return;
        /* a foot rule written inline: a bottom edge with no top one, across the box */
        const inline = el.style, wide = el === box || el.getBoundingClientRect().width >= 0.6 * bw;
        if (wide && /solid|dashed/.test(inline.borderBottom || "") && !/solid|dashed/.test(inline.borderTop || "")) out.rules.push(`inline ${label(el)} · ${inline.borderBottom}`);
        if (el === box) return;
        const s = getComputedStyle(el);
        for (const side of ["Top", "Bottom"]) {
          if (parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== "none" && !/rgba\(0, 0, 0, 0\)/.test(s[`border${side}Color`]) && vis(el) && el.getBoundingClientRect().width >= 0.6 * bw)
            out.rules.push(`${label(el)} · ${side} ${s[`border${side}Width`]}`);
        }
      });
    });
  });
  return out;
}, [scope, edge]);
/* the list a row sits in */
const holder = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel); if (!el) return null;
  return { parent: el.parentElement.className, kids: el.parentElement.children.length };
}, sel);
const fine = (a) => !!a && a.lists > 0 && a.boxes > 0 && a.bad.length === 0 && a.rules.length === 0;
const said = (a) => a ? `lists ${a.lists} boxes ${a.boxes} bad ${a.bad.slice(0, 3).join(" | ")} rules ${a.rules.slice(0, 3).join(" | ")}` : "no scope";

/* the header's add control: its box, its fill, its glyph */
const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (m) return m[1].split(",").slice(0, 3).map((x) => +x); const h = String(c).replace("#", ""); const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const addCtl = (page, sel) => page.evaluate((sel) => {
  const b = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0); if (!b) return null;
  const cs = getComputedStyle(b), r = b.getBoundingClientRect(), svg = b.querySelector("svg");
  return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, shadow: cs.boxShadow, stroke: svg ? svg.getAttribute("stroke") : null, label: b.getAttribute("aria-label") };
}, sel);
const sameAdd = (c) => !!c && c.w === 40 && c.h === 40 && c.radius === "10px" && c.shadow !== "none" && !!c.stroke && contrast(c.stroke, c.bg) >= 4.5;
const addSaid = (c) => c ? `${c.w}×${c.h} r${c.radius} bg ${c.bg} stroke ${c.stroke} ${c.stroke ? contrast(c.stroke, c.bg).toFixed(2) : "-"}:1 shadow ${c.shadow === "none" ? "none" : "yes"} "${c.label}"` : "missing";
/* the subtitle under a screen's title */
const metaOf = (page, title) => page.evaluate((title) => {
  const h = [...document.querySelectorAll("h1")].find((x) => x.textContent.trim() === title); if (!h) return null;
  const box = h.parentElement; return (box.innerText || "").replace(title, "").replace(/\s+/g, " ").trim();
}, title);

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async (role, d = db) => {
    const u = Object.values(d.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, d);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, d));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 4000 }).catch(() => {}); await page.waitForTimeout(600); };
  const sheetText = async (page) => (await page.locator("[data-sheet]").count()) ? page.locator("[data-sheet]").first().innerText() : "";
  const openPeek = async (page, who) => {
    await tap(page, '[aria-label="Today"]', 900);
    await page.locator("button", { hasText: who }).first().dispatchEvent("click"); await page.waitForTimeout(1000);
    return (await page.locator('[data-tour="peek-log"]').count()) === 1;
  };

  try {
    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      /* the peek: the last lessons and what the player is building towards */
      const peeked = await openPeek(page, "Cian Murphy");
      const st = await sheetText(page);
      const peek = await audit(page, "[data-sheet]", EDGE.golf);
      await shot("01-peek");
      check("(a) the peek's last lessons and competitions are the app's list — a box each on golf's edge, no rule inside", peeked && fine(peek) && peek.boxes === 3 && /Short game/.test(st) && /Autumn Medal/.test(st), said(peek));
      check("(a2) the competition reads its own day, never a countdown, and one that has been is not on it", st.includes(nice(dayFrom(12))) && !/\b\d+d\b/.test(st) && !/Club Fourball/.test(st), st.slice(-220));
      const cols = await page.evaluate(() => [...document.querySelectorAll("[data-sheet] .nsc-list > * > span:first-child")].map((s) => ({ d: s.textContent.trim(), at: Math.round(s.nextElementSibling.getBoundingClientRect().left) })));
      const days = cols.map((c) => c.d);
      check("(a3) every day on the peek is the app's one form, in one column", days.length === 3 && days.every((d) => DAY_FORM.test(d)) && days[0] === nice(dayFrom(-12)) && cols.every((c) => Math.abs(c.at - cols[0].at) <= 1), JSON.stringify(cols));
      await closeSheet(page);
      /* the day's rows on the home: the box pads every row, so a time
         starts where the next day's word does and its chevron ends where
         that row's does — DayRow padded itself 20px in and 16px at the
         right as well, from the days of the hairline list */
      const inset = await page.evaluate(() => {
        const box = (el) => el.getBoundingClientRect();
        const ends = (b) => Math.round(box(b).right - Math.max(...[...b.querySelectorAll("svg, span, button")].filter((x) => x.tagName === "svg" || !x.children.length).map((x) => box(x).right)));
        const next = document.querySelector('[data-tour="today-nextday"]');
        const rows = [...document.querySelectorAll('[data-scroll="screen"] .nsc-list > *')].filter((b) => box(b).width > 0)
          .map((b) => [b, [...b.querySelectorAll("span")].find((s) => !s.children.length && /^\d{1,2}:\d{2} [ap]m$/.test(s.textContent.trim()))]).filter(([, s]) => s)
          .map(([b, s]) => ({ t: s.textContent.trim(), at: Math.round(box(s).left - box(b).left), end: ends(b) }));
        return { next: next ? Math.round(box(next.querySelector("span")).left - box(next).left) : null, nextEnd: next ? ends(next) : null, rows };
      });
      check("(a5) the coach's day starts its times where the next day's row starts its word — the box pads them, the row adds nothing",
            inset.next != null && inset.rows.length === 3 && inset.rows.every((r) => Math.abs(r.at - inset.next) <= 1), JSON.stringify(inset));
      check("(a6) …and ends each row where the next day's row ends, at the box's own padding",
            inset.nextEnd != null && inset.rows.length === 3 && inset.rows.every((r) => Math.abs(r.end - inset.nextEnd) <= 1), JSON.stringify(inset));

      /* the register on the group lesson: one box, everyone as rows inside it, every whole name read at 375 */
      await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(300);
      await openPeek(page, "Saturday clinic");
      await tap(page, '[data-tour="peek-register"]', 1000);
      const reg = await page.evaluate(() => {
        const s = document.querySelector("[data-sheet]"); if (!s) return null;
        const day = s.querySelector(".nsc-day"); if (!day) return { day: false };
        const rows = [...day.children];
        const cs = getComputedStyle(day);
        const names = rows.map((r) => [...r.querySelectorAll("span")].find((x) => /\s/.test(x.textContent) && !x.querySelector("*"))).filter(Boolean);
        return { day: true, n: rows.length, edgeW: cs.borderTopWidth, edge: cs.borderTopColor, radius: cs.borderTopLeftRadius,
                 inner: rows.slice(0, -1).map((r) => `${getComputedStyle(r).borderBottomWidth} ${getComputedStyle(r).borderBottomColor}`),
                 last: rows.length ? getComputedStyle(rows[rows.length - 1]).borderBottomStyle : null,
                 cut: names.filter((x) => x.scrollWidth > x.clientWidth + 1 || /…/.test(x.textContent)).map((x) => x.textContent),
                 names: names.map((x) => x.textContent) };
      });
      await shot("02-register-375");
      check("(b) the group's register is one box on golf's edge with everyone as rows inside it, a 1px hairline between and none under the last", !!reg && reg.day && reg.n >= 3 && parseFloat(reg.edgeW) >= 1 && reg.edge === EDGE.golf && reg.radius === "8px" && reg.inner.length === reg.n - 1 && reg.inner.every((x) => x === `1px ${HAIRLINE.golf}`) && reg.last === "none", JSON.stringify(reg));
      check("(b2) at 375 every name is whole — Eoin Breathnach and Saoirse Kelly are not cut", !!reg && reg.names.includes("Eoin Breathnach") && reg.names.includes("Saoirse Kelly") && reg.cut.length === 0, JSON.stringify(reg && { names: reg.names, cut: reg.cut }));
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      /* the day's lessons, then the walk-ins */
      await page.locator("[data-sheet]").getByText("All lessons", { exact: true }).first().click(); await page.waitForTimeout(900);
      const attend = await audit(page, "[data-sheet]", EDGE.golf);
      const ar = await holder(page, '[data-sheet] [data-tour="attend-row"]');
      check("(c) the day's lessons are boxed rows", fine(attend) && !!ar && /nsc-list/.test(ar.parent), `${said(attend)} · ${JSON.stringify(ar)}`);
      await page.locator("[data-sheet] button", { hasText: /not in the diary/i }).first().click(); await page.waitForTimeout(800);
      const walk = await audit(page, "[data-sheet]", EDGE.golf);
      const walkIn = await page.evaluate(() => { const ls = [...document.querySelectorAll("[data-sheet] .nsc-list")].filter((l) => l.getBoundingClientRect().height > 0); return ls.length >= 2 && /Aoife Doyle/.test(ls[ls.length - 1].innerText); });
      await shot("03-walk-ins");
      check("(c2) …and Not in the diary is a second boxed list, the roster in it", fine(walk) && walk.lists >= 2 && walkIn, said(walk));
      await closeSheet(page);

      /* the Message picker */
      await tap(page, '[aria-label="Chat"]', 900);
      const chatAdd = await addCtl(page, '[data-tour="chat-new"]');
      check("(d) Chat's add control is the app's one: 40 square, the control's corner, the accent, a cast shadow and a white plus", sameAdd(chatAdd) && chatAdd.label === "New message", addSaid(chatAdd));
      await tap(page, '[data-tour="chat-new"]', 900);
      const pick = await audit(page, "[data-sheet]", EDGE.golf);
      const tp = await holder(page, '[data-sheet] [data-tour="thread-person"]');
      await shot("04-new-message");
      check("(e) the Message picker's Everyone, groups and people are boxed rows", fine(pick) && !!tp && /nsc-list/.test(tp.parent) && (await page.locator('[data-sheet] [data-tour="thread-group"]').count()) === 1, `${said(pick)} · ${JSON.stringify(tp)}`);
      await closeSheet(page);

      /* the roster: the players' boxes carry no rule of their own, All lessons a box of its own, the groups boxed */
      await tap(page, '[aria-label="Roster"]', 900);
      const ros = await audit(page, '[data-scroll="screen"]', EDGE.golf);
      const own = await page.evaluate(() => {
        const a = document.querySelector('[data-tour="roster-archive"]'), r = document.querySelector('[data-tour="roster-row"]');
        return a && r ? { apart: a.parentElement !== r.parentElement, list: a.parentElement.classList.contains("nsc-list"), kids: a.parentElement.children.length } : null;
      });
      await shot("05-roster");
      check("(f) the roster's players carry no rule inside their boxes, and All lessons is a box of its own under them", fine(ros) && !!own && own.apart && own.list && own.kids === 1, `${said(ros)} · ${JSON.stringify(own)}`);
      await page.locator('[data-scroll="screen"] button', { hasText: /^Groups$/ }).first().click(); await page.waitForTimeout(700);
      const grp = await audit(page, '[data-scroll="screen"]', EDGE.golf);
      const gr = await holder(page, '[data-tour="roster-group"]');
      check("(f2) the Groups half is boxed rows, Create a group among them", fine(grp) && !!gr && /nsc-list/.test(gr.parent) && (await page.locator('[data-tour="roster-newgroup"]').count()) === 1, `${said(grp)} · ${JSON.stringify(gr)}`);
      await page.locator('[data-scroll="screen"] button', { hasText: /^Players$/ }).first().click(); await page.waitForTimeout(600);

      /* the player file: the tip centred, the foot boxed, the lessons with no rule inside */
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1100);
      const file = await audit(page, '[data-scroll="screen"]', EDGE.golf);
      const pp = await holder(page, '[data-tour="player-progress"]');
      const tip = await page.evaluate(() => {
        const lab = [...document.querySelectorAll('[data-scroll="screen"] .nsc-list span')].find((s) => s.textContent === "Tip"); if (!lab) return null;
        const val = lab.nextElementSibling; const a = lab.getBoundingClientRect(), b = val.getBoundingClientRect(), box = lab.parentElement.getBoundingClientRect();
        return { label: a.top + a.height / 2, value: b.top + b.height / 2, box: box.top + box.height / 2 };
      });
      await shot("06-player-file");
      check("(g) the player file's lessons, tip and foot rows are boxed, with no rule inside a box", fine(file) && !!pp && /nsc-list/.test(pp.parent) && file.boxes >= 6, `${said(file)} · ${JSON.stringify(pp)}`);
      check("(g2) the tip's label and its words sit on one centre line, in the middle of the box", !!tip && Math.abs(tip.label - tip.value) <= 2 && Math.abs(tip.label - tip.box) <= 2, JSON.stringify(tip));
      await M.back(page);
      /* a player with no lessons: the empty line is a line, not a box */
      await page.locator("button", { hasText: "Eoin Breathnach" }).first().click(); await page.waitForTimeout(1000);
      const empty = await page.evaluate(() => { const p = [...document.querySelectorAll('[data-scroll="screen"] p')].find((x) => x.textContent.trim() === "No lessons yet"); return p ? { boxed: !!p.closest(".nsc-list") } : null; });
      check("(g3) a player with no lessons reads No lessons yet as a line, not a box", !!empty && !empty.boxed, JSON.stringify(empty));
      /* Recurring lessons, from the foot of the Diary: the same add control */
      await tap(page, '[aria-label="Diary"]', 900);
      await M.click(page, "Recurring lessons"); await page.waitForTimeout(900);
      const recAdd = await addCtl(page, '[data-tour="recur-add"]');
      check("(h) Recurring lessons' add control is the same one", sameAdd(recAdd) && recAdd.label === "Add", addSaid(recAdd));
      check("(h2) …the same box, corner, fill and glyph as Chat's", !!recAdd && !!chatAdd && recAdd.w === chatAdd.w && recAdd.radius === chatAdd.radius && recAdd.bg === chatAdd.bg && recAdd.stroke === chatAdd.stroke && recAdd.shadow === chatAdd.shadow, `${addSaid(recAdd)} vs ${addSaid(chatAdd)}`);

      /* Drifting and Ahead, from the home's Actions */
      await tap(page, '[aria-label="Today"]', 900);
      await page.locator("button", { hasText: /^Drifting/ }).first().click(); await page.waitForTimeout(900);
      const drift = await audit(page, '[data-scroll="screen"]', EDGE.golf);
      const rows = await page.locator('[data-scroll="screen"] .nsc-list > *').count();
      const dm = await metaOf(page, "Drifting");
      const t1 = await text(); await shot("07-drifting");
      check("(i) Drifting's people are boxed rows, counted as players, never people", fine(drift) && /Aoife Doyle/.test(t1) && dm === `${rows} ${rows === 1 ? "player" : "players"}`, `${said(drift)} · meta "${dm}" rows ${rows}`);
      await M.back(page);
      await page.locator("button", { hasText: /^Competitions/ }).last().click(); await page.waitForTimeout(900);
      const aheadAdd = await addCtl(page, 'button[aria-label="Add"]');
      const am = await metaOf(page, "Ahead");
      const t2 = await text(); await shot("08-ahead");
      check("(j) Ahead's add control is the same one, and its subtitle counts only what is ahead", /Club Fourball/.test(t2) && sameAdd(aheadAdd) && !!chatAdd && aheadAdd.bg === chatAdd.bg && aheadAdd.radius === chatAdd.radius && am === "1 coming up", `${addSaid(aheadAdd)} · meta "${am}"`);
      check("(j2) …what is coming sits above what has been", t2.indexOf("Autumn Medal") > -1 && t2.indexOf("Autumn Medal") < t2.indexOf("Club Fourball"), t2.slice(0, 200));

      /* the pick-a-player sheet, its empty line, then the tip sheet's prompts */
      await tap(page, '[aria-label="Today"]', 900);
      await page.locator('[data-tour="today-board"] button', { hasText: /^Tip$/ }).first().click(); await page.waitForTimeout(900);
      const pw = await audit(page, "[data-sheet]", EDGE.golf);
      check("(k) the pick-a-player sheet is boxed rows", fine(pw), said(pw));
      await page.locator("[data-sheet] input").first().fill("zz"); await page.waitForTimeout(400);
      const none = await page.evaluate(() => { const p = [...document.querySelectorAll("[data-sheet] p")].find((x) => x.textContent.trim() === "Nobody by that name"); return p ? { boxed: !!p.closest(".nsc-list") } : null; });
      check("(k2) a search that finds nobody says so on a line, not in a box", !!none && !none.boxed, JSON.stringify(none));
      await page.locator("[data-sheet] input").first().fill(""); await page.waitForTimeout(400);
      await page.locator("[data-sheet] button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const pr = await page.evaluate(() => {
        const s = document.querySelector("[data-sheet]"); const day = s && s.querySelector(".nsc-day"); if (!day) return null;
        const rows = [...day.children]; return { n: rows.length, edge: getComputedStyle(day).borderTopColor, inner: rows.slice(0, -1).every((r) => getComputedStyle(r).borderBottomWidth === "1px"), last: getComputedStyle(rows[rows.length - 1]).borderBottomStyle };
      });
      await shot("09-tip-prompts");
      check("(k3) the tip sheet's prompts are one box on golf's edge with the prompts as rows inside it", !!pr && pr.n >= 2 && pr.edge === EDGE.golf && pr.inner && pr.last === "none", JSON.stringify(pr));
      await closeSheet(page);
      /* past midnight on data loaded the day before: the competition still reads its own day, never a count from now */
      await page.clock.setFixedTime(new Date(`${M.ymd(dayFrom(1))}T08:00:00`));
      await tap(page, '[aria-label="Diary"]', 900);
      await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).first().dispatchEvent("click"); await page.waitForTimeout(1000);
      const st2 = await sheetText(page);
      check("(a4) after midnight, on the day before's load, the peek reads the competition's own day, not a day late", st2.includes("Autumn Medal") && st2.includes(nice(dayFrom(12))) && !st2.includes(nice(dayFrom(13))), st2.slice(-200));
      await closeSheet(page);
      await ctx.close();
    }

    /* ---------- an equestrian coach: the sport's own edge, and the glyph still reads ---------- */
    {
      const { ctx, page, shot } = await boot("rider");
      await tap(page, '[aria-label="Chat"]', 900);
      const c = await addCtl(page, '[data-tour="chat-new"]');
      check("(l) on the equestrian accent the white plus still reads at 4.5:1 or more", sameAdd(c), addSaid(c));
      await tap(page, '[aria-label="Roster"]', 900);
      const ros = await audit(page, '[data-scroll="screen"]', EDGE.equestrian);
      check("(l2) the riding coach's lists are edged in equestrian's own tone, not golf's", fine(ros) && EDGE.equestrian !== EDGE.golf, said(ros));
      /* Ahead with nothing on it carries no nought */
      await tap(page, '[data-tour="quick"]', 900);
      await page.locator('[data-sheet] button[aria-label="Competition"], [data-sheet] button', { hasText: /^Competition$/ }).first().click(); await page.waitForTimeout(900);
      const am = await metaOf(page, "Ahead");
      const ta = await M.rootText(page);
      await shot("10-rider-ahead");
      check("(l3) Ahead with only what has been carries no subtitle — never \"0 coming up\"", /Spring Show/.test(ta) && am === "", `meta "${am}" · ${ta.slice(0, 120)}`);
      await ctx.close();
    }

    /* ---------- the player: an empty tick box is on the edge ---------- */
    {
      const { ctx, page } = await boot("adult");
      await tap(page, '[aria-label="Drills"]', 1000);
      const tick = await page.evaluate(() => {
        const row = document.querySelector('[data-scroll="screen"] button[aria-pressed="false"]'); if (!row) return null;
        const box = [...row.querySelectorAll("*")].find((el) => { const r = el.getBoundingClientRect(); return Math.round(r.width) === 24 && Math.round(r.height) === 24; }); if (!box) return { box: false };
        return { color: getComputedStyle(box).borderTopColor, w: getComputedStyle(box).borderTopWidth };
      });
      check("(m) an undone drill's tick box is drawn on golf's edge, not the hairline", !!tick && tick.color === EDGE.golf && parseFloat(tick.w) >= 1, JSON.stringify(tick));
      await ctx.close();
    }

    /* ---------- the parent: the child's screen ---------- */
    {
      const { ctx, page, text, shot } = await boot("parent");
      await tap(page, '[aria-label="Family"]', 900);
      await page.locator("button", { hasText: "Saoirse" }).first().click(); await page.waitForTimeout(1000);
      const kid = await audit(page, '[data-scroll="screen"]', EDGE.golf);
      const outlines = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] button')]
        .filter((b) => ["Message coach", "Progress"].includes(b.textContent.trim()))
        .map((b) => `${b.textContent.trim()} ${getComputedStyle(b).borderTopWidth} ${getComputedStyle(b).borderTopColor}`));
      const days = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] .nsc-list > button > span:first-child')].map((s) => s.textContent.trim()));
      const t = await text(); await shot("11-family-kid");
      check("(n) the child's Next and Drills and lessons are boxed rows on the edge", fine(kid) && kid.lists >= 2 && /Next/.test(t) && /Ladder drill|1 drill/.test(t), said(kid));
      check("(n2) Message coach and Progress are both outlined on the edge, not the old hairline", outlines.length === 2 && outlines.every((o) => / 1(\.5)?px rgba\(47, 107, 58, 0\.72\)$/.test(o)), JSON.stringify(outlines));
      check("(n3) the child's lessons read the app's one day form", days.length === 2 && days.every((d) => DAY_FORM.test(d)) && days[0] === nice(dayFrom(-9)), JSON.stringify(days));
      /* Next, Drills and the lessons under them: one value column down the page */
      const vcol = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] .nsc-list > * > span:first-child')]
        .map((s) => ({ l: s.textContent.trim(), at: Math.round(s.nextElementSibling.getBoundingClientRect().left) })));
      check("(n4) the child's Next and Drills put their values in the lessons' column, one line down the page",
            vcol.length === 4 && vcol.every((c) => Math.abs(c.at - vcol[0].at) <= 1), JSON.stringify(vcol));
      await ctx.close();
    }

    /* ---------- the register's controls on the edge ----------
       Present and Absent, before either is chosen, and "Someone not in
       the diary" are controls whose outline is the only thing that says
       where they are. They were a 0.5px hairline of the ink at 20% and
       28% — 1.5:1 and 1.8:1 against the box, under WCAG 1.4.11's 3:1 for
       a control's boundary — and take EDGE(t) at EDGE_W now, on golf and
       on a second sport. A fresh fixture, so no earlier mark is chosen. */
    {
      const dbR = freshDb();
      M.addBooking(dbR, { coachId: IDS.rider, playerId: IDS.tadhg, date: TODAY, time: "9:00 am" });
      const reRgba = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map((x) => +x); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
      const reLum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const reContrast = (a, b) => { const [x, y] = [reLum(a), reLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const flat = (c, ground) => { const p = reRgba(c); return p.rgb.map((v, i) => v * p.a + ground[i] * (1 - p.a)); };
      const outlinesOf = (page, sel, text) => page.evaluate(([sel, src, flags]) => {
        const text = new RegExp(src, flags);
        const ground = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; const m = b.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(",").map((x) => +x); if (p.length < 4 || p[3] === 1) return p.slice(0, 3); } } return [255, 255, 255]; };
        return [...document.querySelectorAll(sel)].filter((b) => b.getBoundingClientRect().width > 0 && text.test(b.textContent.trim()))
          .map((b) => { const cs = getComputedStyle(b);
            return { label: b.textContent.trim(), bg: cs.backgroundColor, ground: ground(b), fg: cs.color, inline: b.style.borderTopWidth,
                     sides: ["Top", "Right", "Bottom", "Left"].map((x) => `${cs[`border${x}Width`]} ${cs[`border${x}Style`]} ${cs[`border${x}Color`]}`) }; });
      }, [sel, text.source, text.flags]).catch(() => []);
      /* Chrome reports a 0.5px border back as 1px, so the width is read
         off the element's own style as well: EDGE_W, 1.5px */
      const edgeOk = (o, edge, style) => o.inline === "1.5px" && o.sides.every((x) => { const [w, st, ...c] = x.split(" "); return parseFloat(w) >= 1 && st === style && c.join(" ") === edge; });
      const edgeRatio = (o) => { const c = o.sides[0].split(" ").slice(2).join(" "); return reContrast(flat(c, o.ground), o.ground); };
      const told = (os) => os.map((o) => `${o.label}: ${o.inline} ${o.sides[0]} ${edgeRatio(o).toFixed(2)}:1 label ${reContrast(flat(o.fg, o.ground), o.ground).toFixed(2)}:1`).join(" | ");
      const MARK = /^(Present|Absent)$/;
      for (const [role, sport, who, minRows] of [["coach", "golf", "Saturday clinic", 3], ["rider", "equestrian", "Tadhg Ryan", 1]]) {
        const { ctx, page, shot } = await boot(role, dbR);
        await openPeek(page, who);
        await tap(page, '[data-tour="peek-register"]', 1000);
        const marks = await outlinesOf(page, "[data-sheet] .nsc-day button", MARK);
        await shot(`12-register-edges-${sport}`);
        check(`(r1 ${sport}) every unchosen Present and Absent is outlined on ${sport}'s edge, at least 1px on all four sides`,
          marks.length >= 2 * minRows && marks.every((o) => edgeOk(o, EDGE[sport], "solid")), `${marks.length} · ${told(marks).slice(0, 400)}`);
        check(`(r2 ${sport}) their outline reads at least 3:1 against the register's box (WCAG 1.4.11), their words 4.5:1`,
          marks.length >= 2 && marks.every((o) => edgeRatio(o) >= 3 && reContrast(flat(o.fg, o.ground), o.ground) >= 4.5), told(marks).slice(0, 400));
        await page.locator("[data-sheet] .nsc-day button", { hasText: /^Present$/ }).first().click(); await page.waitForTimeout(400);
        const on = (await outlinesOf(page, "[data-sheet] .nsc-day button", MARK))[0];
        check(`(r3 ${sport}) guard: a chosen Present is still filled, its edge the fill's own colour`,
          !!on && on.bg !== "rgba(0, 0, 0, 0)" && on.sides.every((x) => x.endsWith(on.bg)), on ? told([on]) + ` bg ${on.bg}` : "none");
        await page.locator("[data-sheet]").getByText("All lessons", { exact: true }).first().click(); await page.waitForTimeout(900);
        const walk = await outlinesOf(page, "[data-sheet] button", /not in the diary/i);
        check(`(r4 ${sport}) "Someone not in the diary" is a dashed outline on ${sport}'s edge, at least 1px, at least 3:1`,
          walk.length === 1 && edgeOk(walk[0], EDGE[sport], "dashed") && edgeRatio(walk[0]) >= 3, told(walk));
        await ctx.close();
      }
    }

    check("(o) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
