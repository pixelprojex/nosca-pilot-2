/* THE WEEKLY LISTS, BOXED.

   boxes.cjs walks the lists a coach and a parent open every day; this
   walks the ones opened every week that were still text between
   hairlines: the group page's sessions (and their day, Thu 15 Oct), the
   Hours screen (its days stay one Card with the days as rows on the
   hairline, Slots and lesson length on the edge above it, and Add a
   time the app's tiles — it was round pills), the profile's Remove
   <sport> rows (rows of the profile's own card, never a box inside a
   box), the setup's Drills and Tips (and the plus in the middle of Your
   own's add button), New group's people (PersonPicker),
   the push prompt over the alerts (only on a build with a push key —
   run with VAPID=1 against one), the Compare picker, the lesson page's
   drills (an undone tick on the edge), the Calendar view's free times
   (one .nsc-day, as the List view's day) and the attendance record
   (its day Thu 8 Oct, never "08 Oct"). Guards: the register's walk-in
   stays dashed on the edge, and the log's drill rows stay hairline —
   the log is the founder's.

   Usage: node lists.cjs <distDir> <port> <outDir>   (VAPID=1 for (y)) */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 5320), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", eoin: "00000000-0000-4000-8000-000000e01e01", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const L = { two: "10000000-0000-4000-8000-00000000dd01", one: "10000000-0000-4000-8000-00000000dd02", drills: "10000000-0000-4000-8000-00000000dd03", grp: "10000000-0000-4000-8000-00000000dd04" };
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
const EDGE = { golf: "rgba(47, 107, 58, 0.72)" };
const HAIRLINE = { golf: "rgb(228, 236, 225)" };
const DAY_FORM = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [1-9]\d? (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/;

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
  M.setPrefs(db, IDS.coach, { availability: { ...M.weekOf(["9:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]), slots: ["9:00 am", "10:30 am", "12:00 pm", "2:00 pm", "4:00 pm", "5:00 pm"] }, extra_sports: ["tennis"],
    groups: [{ id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], day: 5, time: "9:00 am", weeks: 8, sport: "golf" }] });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: TODAY, time: "10:30 am" });
  /* the group's sessions: two logged group lessons */
  M.addLesson(db, { id: L.grp, coachId: IDS.coach, groupName: "Saturday clinic", date: M.ymd(dayFrom(-7)), focus: "Putting", subs: ["Lag putting"], unread: false });
  M.addLesson(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: M.ymd(dayFrom(-14)), focus: "Bunker play · Course management · Putting", unread: false });
  /* Compare: one lesson with two clips, one with one */
  M.addLesson(db, { id: L.two, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-12)), focus: "Short game", unread: false });
  M.addMedia(db, { lessonId: L.two, kind: "video", path: `${IDS.coach}/${L.two}/clip-1.mp4`, createdAt: `${M.ymd(dayFrom(-12))}T10:01:00Z` });
  M.addMedia(db, { lessonId: L.two, kind: "video", path: `${IDS.coach}/${L.two}/clip-2.mp4`, createdAt: `${M.ymd(dayFrom(-12))}T10:02:00Z` });
  M.addLesson(db, { id: L.one, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-26)), focus: "Putting", unread: false });
  M.addMedia(db, { lessonId: L.one, kind: "video", path: `${IDS.coach}/${L.one}/clip-3.mp4`, createdAt: `${M.ymd(dayFrom(-26))}T10:01:00Z` });
  /* the lesson page's drills: a lesson logged now, two drills set with it */
  M.addLesson(db, { id: L.drills, coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-1)), focus: "Driving", unread: false, createdAt: new Date().toISOString() });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Gate drill" });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Towel drill", done: true });
  /* the attendance record: three registers for Cian */
  [[-3, "in"], [-10, "out"], [-17, "in"]].forEach(([n, state], i) => {
    const sid = `5e000000-0000-4000-8000-0000000000b${i}`, date = M.ymd(dayFrom(n));
    db.sessions.push({ id: sid, coach_id: IDS.coach, label: "Cian Murphy", session_date: date, created_at: `${date}T10:00:00Z` });
    db.marks.push({ id: `6e000000-0000-4000-8000-0000000000b${i}`, session_id: sid, player_id: IDS.adult, state });
  });
  return db;
}

const { check, results, summary } = M.checker("lists");

/* the same audit as boxes.cjs */
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
      if (!sides || cs.borderTopLeftRadius !== "8px") out.bad.push(`${label(box)} · ${cs.borderTopWidth} ${cs.borderTopColor} r${cs.borderTopLeftRadius}`);
      const bw = box.getBoundingClientRect().width;
      [box, ...box.querySelectorAll("*")].forEach((el) => {
        const day = el.closest(".nsc-day"); if (day && box.contains(day) && day !== el) return;
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
const fine = (a) => !!a && a.lists > 0 && a.boxes > 0 && a.bad.length === 0 && a.rules.length === 0;
const said = (a) => a ? `lists ${a.lists} boxes ${a.boxes} bad ${a.bad.slice(0, 2).join(" | ")} rules ${a.rules.slice(0, 2).join(" | ")}` : "no scope";

/* the rows a predicate picks inside `scope`: where they sit and what they draw */
const rowsOf = (page, scope, js) => page.evaluate(([scope, js]) => {
  const root = document.querySelector(scope); if (!root) return null;
  const pick = new Function("root", js);
  const rows = (pick(root) || []).filter(Boolean);
  return rows.map((r) => {
    const cs = getComputedStyle(r), p = r.parentElement;
    return { text: (r.innerText || "").replace(/\s+/g, " ").slice(0, 24), parent: p.className.slice(0, 40), inList: p.classList.contains("nsc-list"), inDay: !!r.closest(".nsc-day"),
             top: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, bottom: `${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`, left: `${cs.borderLeftWidth} ${cs.borderLeftColor}`, radius: cs.borderTopLeftRadius };
  });
}, [scope, js]);
/* the one .nsc-day under `scope`: its edge, corners, and the rows' rules inside */
const dayBox = (page, scope) => page.evaluate((scope) => {
  const root = document.querySelector(scope); const day = root && root.querySelector(".nsc-day"); if (!day) return null;
  const rows = [...day.children]; const cs = getComputedStyle(day);
  return { n: rows.length, edge: cs.borderTopColor, w: cs.borderTopWidth, radius: cs.borderTopLeftRadius,
           inner: rows.slice(0, -1).map((r) => `${getComputedStyle(r).borderBottomWidth} ${getComputedStyle(r).borderBottomColor}`), last: rows.length ? getComputedStyle(rows[rows.length - 1]).borderBottomStyle : null };
}, scope);
const dayFine = (d, edge, hair) => !!d && d.n >= 2 && d.edge === edge && parseFloat(d.w) >= 1 && d.radius === "8px" && d.inner.every((x) => x === `1px ${hair}`) && d.last === "none";
/* boxed: each row its own box in an .nsc-list on the edge, or a row inside an .nsc-day */
const boxedRows = (rows, edge) => !!rows && rows.length > 0 && rows.every((r) => (r.inList && r.left.endsWith(edge) && r.radius === "8px") || r.inDay);
const rowSaid = (rows) => rows ? `${rows.length} rows · ${rows.slice(0, 2).map((r) => `"${r.text}" parent[${r.parent}] list=${r.inList} day=${r.inDay} bottom ${r.bottom} left ${r.left}`).join(" | ")}` : "no scope";

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    if (process.env.VAPID) await page.addInitScript(() => { try { Object.defineProperty(window.Notification, "permission", { get: () => "default", configurable: true }); } catch (e) {} });
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, shot };
  };
  const { tap } = M;
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 4000 }).catch(() => {}); await page.waitForTimeout(600); };
  const openSettings = async (page, root = '[aria-label="Today"]') => {
    await tap(page, root, 900);
    await tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 900);
    if (await page.locator('[data-tour="sheet-settings"]').count()) await tap(page, '[data-tour="sheet-settings"]', 900);
  };
  const SCREEN = '[data-scroll="screen"]';

  try {
    /* ---------- the coach ---------- */
    {
      const { ctx, page, shot } = await boot("coach");

      /* (aa) the register's Someone not in the diary: dashed on the edge */
      await tap(page, '[aria-label="Today"]', 900);
      await page.locator("button", { hasText: "Cian Murphy" }).first().dispatchEvent("click"); await page.waitForTimeout(1000);
      await tap(page, '[data-tour="peek-register"]', 1000);
      await page.locator("[data-sheet]").getByText("All lessons", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(900);
      const dash = await page.evaluate(() => {
        const b = [...document.querySelectorAll("[data-sheet] button")].find((x) => /Someone not in the diary/.test(x.textContent)); if (!b) return null;
        const cs = getComputedStyle(b); return { w: cs.borderTopWidth, style: cs.borderTopStyle, color: cs.borderTopColor };
      });
      await shot("aa-register-walkin");
      check("(aa) guard: the register's Someone not in the diary is dashed on the sport's edge, 1px or more — not the 0.5px hairline", !!dash && dash.style === "dashed" && parseFloat(dash.w) >= 1 && dash.color === EDGE.golf, JSON.stringify(dash));
      await closeSheet(page);

      /* (p) the group page's sessions */
      await tap(page, '[aria-label="Roster"]', 900);
      await page.locator(`${SCREEN} button`, { hasText: /^Groups$/ }).first().click(); await page.waitForTimeout(700);
      await page.locator('[data-tour="roster-group"]').first().click(); await page.waitForTimeout(1000);
      const ses = await rowsOf(page, SCREEN, `return [...root.querySelectorAll("span")].filter((s) => s.textContent === "Putting" || s.textContent === "Bunker play · Course management · Putting").map((s) => s.parentElement.parentElement);`);
      const sesA = await audit(page, SCREEN, EDGE.golf);
      await shot("p-group-sessions");
      check("(p) the group page's sessions are boxed rows on golf's edge, no rule inside", boxedRows(ses, EDGE.golf) && ses.length === 2 && fine(sesA), `${rowSaid(ses)} · ${said(sesA)}`);
      const sesDays = await page.evaluate(() => { const g = document.querySelector('[data-tour="group-sessions"]'); return g ? [...g.children].map((c) => { const sp = c.querySelectorAll("span"); return sp[1] ? sp[1].textContent.trim() : ""; }) : []; });
      check("(p2) each session reads the app's one day (Thu 15 Oct), never \"15 Oct\"", sesDays.length === 2 && sesDays.every((d) => DAY_FORM.test(d)), JSON.stringify(sesDays));
      /* at 360 a three-area session still keeps its day on one line */
      await page.setViewportSize({ width: 360, height: 780 }); await page.waitForTimeout(400);
      const dayLines = await page.evaluate(() => { const g = document.querySelector('[data-tour="group-sessions"]'); return g ? [...g.children].map((c) => { const sp = c.querySelectorAll("span"); if (!sp[1]) return null; const r0 = sp[0].getBoundingClientRect(), r1 = sp[1].getBoundingClientRect(); return { lines: sp[1].getClientRects().length, h: Math.round(r1.height), gap: Math.round(r1.left - r0.right) }; }) : []; });
      await shot("p3-group-sessions-360");
      check("(p3) at 360 every session's day stays whole on one line, clear of a three-area focus", dayLines.length === 2 && dayLines.every((x) => x && x.lines === 1 && x.h <= 18 && x.gap >= 8), JSON.stringify(dayLines));
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);

      /* (s) the hours' days */
      await openSettings(page);
      await tap(page, '[data-tour="settings-availability"]', 1000);
      /* the days stay one Card — the edge, the surface's corner — with the
         days as rows inside on the 1px hairline; Slots and lesson length
         above it on the same edge and corner */
      const daysC = await page.evaluate(() => { const c = document.querySelector('[data-tour="avail-days"]'); if (!c) return null; const cs = getComputedStyle(c); const rows = [...c.children];
        return { n: rows.length, edge: cs.borderTopColor, w: cs.borderTopWidth, r: cs.borderTopLeftRadius, inner: rows.slice(0, -1).map((x) => `${getComputedStyle(x).borderBottomWidth} ${getComputedStyle(x).borderBottomColor}`) }; });
      const disc = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-scroll="screen"] button')].find((x) => /Slots and lesson length/.test(x.textContent)); if (!b) return null; const cs = getComputedStyle(b); return { c: cs.borderTopColor, w: b.style.borderTopWidth || cs.borderTopWidth, r: cs.borderTopLeftRadius }; });
      await shot("s-hours-days");
      check("(s) guard: the hours' seven days are one Card on golf's edge, the days as rows inside on the 1px hairline", !!daysC && daysC.n === 7 && daysC.edge === EDGE.golf && parseFloat(daysC.w) >= 1 && daysC.inner.every((x) => x === `1px ${HAIRLINE.golf}`), JSON.stringify(daysC));
      check("(s2) Slots and lesson length is on golf's edge at the edge's width, the Card's corner", !!disc && disc.c === EDGE.golf && disc.w === "1.5px" && !!daysC && disc.r === daysC.r, JSON.stringify(disc));
      await page.locator(`${SCREEN} button`, { hasText: /Slots and lesson length/ }).first().click(); await page.waitForTimeout(500);
      await page.locator('[aria-label="Add a time"]').first().click(); await page.waitForTimeout(500);
      const addR = await page.locator('[data-tour="avail-add"] button').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).borderRadius)));
      await shot("s3-hours-add");
      const addCols = await page.locator('[data-tour="avail-add"]').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length).catch(() => 0);
      check("(s3) Hours' Add a time is the app's tiles — the control's corner, never a pill — three across, as its Start times, so no time wraps at 320", addR.length > 6 && addR.every((r) => r > 0 && r < 20) && addCols === 3, JSON.stringify({ r: addR.slice(0, 4), cols: addCols }));
      await M.back(page);

      /* (w) the profile's remove-sport rows */
      await tap(page, '[data-tour="settings-profile"]', 1100);
      const rem = await rowsOf(page, SCREEN, `return [...root.querySelectorAll("button")].filter((b) => /^Remove Tennis/.test(b.textContent.trim()));`);
      await shot("w-profile-remove-sport");
      check("(w) Remove Tennis is a row of the profile's card on its 1px hairline — no 0.5px ink rule, no section rule", !!rem && rem.length === 1 && rem[0].top === `1px solid ${HAIRLINE.golf}` && parseFloat(rem[0].bottom) === 0, `${rowSaid(rem)} · top ${rem && rem[0] && rem[0].top}`);
      const nest = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-scroll="screen"] button')].find((x) => /^Remove Tennis/.test(x.textContent.trim())); if (!b) return null;
        const own = getComputedStyle(b); let el = b.parentElement, edged = 0;
        while (el && el !== document.body) { const cs = getComputedStyle(el); if (parseFloat(cs.borderLeftWidth) >= 1 && cs.borderLeftStyle === "solid") edged++; el = el.parentElement; }
        return { ownLeft: own.borderLeftWidth, inList: !!b.closest(".nsc-list"), edged, wrapTop: getComputedStyle(b.parentElement).borderTopWidth }; });
      check("(w2) it draws no box of its own: no side edge, no list around it, one edged card around it, no rule over the rows", !!nest && parseFloat(nest.ownLeft) === 0 && !nest.inList && nest.edged === 1 && parseFloat(nest.wrapTop) === 0, JSON.stringify(nest));
      await M.back(page);

      /* (z) the setup's lists — Drills, then Tips */
      await page.locator(`${SCREEN} button`, { hasText: /^Setup$/ }).first().click(); await page.waitForTimeout(1000);
      await page.locator("button", { hasText: /^Continue$/ }).first().click(); await page.waitForTimeout(800);
      const sd = await rowsOf(page, "body", `return [...root.querySelectorAll("button[aria-pressed]")].filter((b) => /drill|putting|chipping/i.test(b.textContent));`);
      await shot("z1-setup-drills");
      check("(z) the setup's Drills are boxed rows on golf's edge", boxedRows(sd, EDGE.golf) && sd.length >= 6, rowSaid(sd));
      await page.locator("button", { hasText: /^Continue$/ }).first().click(); await page.waitForTimeout(800);
      const st = await rowsOf(page, "body", `return [...root.querySelectorAll("button[aria-pressed]")].filter((b) => b.textContent.trim().length > 12);`);
      await shot("z2-setup-tips");
      check("(z2) the setup's Tips are boxed rows on golf's edge", boxedRows(st, EDGE.golf) && st.length >= 3, rowSaid(st));
      const tipPad = await page.evaluate(() => [...document.querySelectorAll("button[aria-pressed]")].filter((b) => b.textContent.trim().length > 12).map((b) => parseFloat(getComputedStyle(b).paddingTop)));
      check("(z3) a tip's box keeps air above its words, so a tip that wraps never touches the edge", tipPad.length >= 3 && tipPad.every((x) => x >= 8), JSON.stringify(tipPad));
      const addPlus = await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="Add"]')].find((x) => x.offsetParent && x.querySelector("svg")); if (!b) return null;
        const r = b.getBoundingClientRect(), g = b.querySelector("svg").getBoundingClientRect();
        return { dx: Math.round((g.left + g.width / 2) - (r.left + r.width / 2)), dy: Math.round((g.top + g.height / 2) - (r.top + r.height / 2)) }; });
      check("(z4) the plus on Your own's add button sits in the middle of its box", !!addPlus && Math.abs(addPlus.dx) <= 1 && Math.abs(addPlus.dy) <= 1, JSON.stringify(addPlus));
      await page.locator("button", { hasText: /^Skip$/ }).first().click().catch(() => {}); await page.waitForTimeout(900);

      /* (t) PersonPicker, on New group */
      await tap(page, '[aria-label="Today"]', 900);
      await tap(page, '[data-tour="quick"]', 900);
      await page.locator("[data-sheet] button", { hasText: /^New group$/ }).first().click(); await page.waitForTimeout(900);
      const pp = await rowsOf(page, "[data-sheet]", `return [...root.querySelectorAll('button[aria-pressed][aria-label]')].filter((b) => ["Cian Murphy", "Aoife Doyle", "Eoin Breathnach", "Saoirse Kelly"].includes(b.getAttribute("aria-label")));`);
      const ppA = await audit(page, "[data-sheet]", EDGE.golf);
      await shot("t-new-group-people");
      check("(t) New group's people (PersonPicker) are boxed rows on golf's edge, no rule inside", boxedRows(pp, EDGE.golf) && pp.length === 4 && fine(ppA), `${rowSaid(pp)} · ${said(ppA)}`);
      await closeSheet(page);

      /* (y) the push prompt at the head of the alerts */
      await tap(page, '[aria-label="Today"]', 900);
      await tap(page, '[aria-label="Alerts"]', 1200);
      await page.waitForSelector('[data-tour="push-prompt"]', { timeout: 3000 }).catch(() => {});
      const pushRow = await rowsOf(page, SCREEN, `const r = root.querySelector('[data-tour="push-prompt"]'); return r ? [r.parentElement.classList.contains("nsc-list") ? r : r] : [];`);
      const pushA = await audit(page, SCREEN, EDGE.golf);
      await shot("y-push-prompt");
      if (process.env.VAPID) check("(y) the push prompt is a boxed row on golf's edge, like the alert rows under it, no rule inside", boxedRows(pushRow, EDGE.golf) && pushRow.length === 1 && fine(pushA), `${rowSaid(pushRow)} · ${said(pushA)}`);
      await M.back(page);

      /* (v) the Compare picker */
      await tap(page, '[aria-label="Roster"]', 900);
      await page.locator(`${SCREEN} button`, { hasText: /^Players$/ }).first().click().catch(() => {}); await page.waitForTimeout(600);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1000);
      await page.locator("button", { hasText: "Short game" }).first().click(); await page.waitForTimeout(1300);
      await tap(page, '[data-tour="lesson-compare"]', 1200);
      await page.waitForSelector("[data-compare-row]", { timeout: 8000 }).catch(() => {});
      const cmp = await rowsOf(page, SCREEN, `const p = root.querySelector('[data-tour="compare-pick"]'); return p ? [...p.querySelectorAll("[data-compare-row]")] : [];`);
      const cmpA = await audit(page, SCREEN, EDGE.golf);
      await shot("v-compare-picker");
      check("(v) the Compare picker's clips are boxed rows on golf's edge, This clip among them", boxedRows(cmp, EDGE.golf) && cmp.length >= 2 && fine(cmpA), `${rowSaid(cmp)} · ${said(cmpA)}`);

      /* (bb) not on the list: the log's drills (DrillPicker) — informational */
      await M.back(page); await M.back(page); await M.back(page);
      await tap(page, '[aria-label="Today"]', 900);
      await tap(page, '[data-tour="quick"]', 900);
      await page.locator("[data-sheet] button", { hasText: /^Log a lesson$/ }).first().click().catch(() => {}); await page.waitForTimeout(1000);
      await page.locator("button", { hasText: "Aoife" }).first().click().catch(() => {}); await page.waitForTimeout(1000);
      await tap(page, '[data-tour="wiz-drills"]', 700);
      const wd = await rowsOf(page, "body", `return [...root.querySelectorAll("button[aria-pressed]")].filter((b) => /drill/i.test(b.textContent) && !b.closest('[data-tour="wiz-drills"]') && b.getAttribute("data-tour") !== "wiz-drills");`);
      await shot("bb-log-drills");
      check("(bb) guard: the log's drill rows stay hairline (DrillPicker without boxed; the log is the founder's)", !!wd && wd.length > 0 && !boxedRows(wd, EDGE.golf), rowSaid(wd));
      await ctx.close();
    }

    /* ---------- the player ---------- */
    {
      const { ctx, page, shot } = await boot("adult");
      /* (x) the lesson page's drills */
      const viewList = page.locator('[aria-label="List"]').first();
      if (await viewList.count()) { await viewList.dispatchEvent("click"); await page.waitForTimeout(700); }
      await page.locator("button", { hasText: "Driving" }).first().click().catch(() => {}); await page.waitForTimeout(1300);
      const ld = await rowsOf(page, SCREEN, `const s = root.querySelector('[data-tour="lesson-drills"]'); return s ? [...s.querySelectorAll("div, button")].filter((r) => /Gate drill|Towel drill/.test(r.textContent) && r.children.length >= 2 && r.parentElement && !/Gate drill.*Towel drill/.test(r.textContent)) : [];`);
      const tick = await page.evaluate(() => {
        const s = document.querySelector('[data-tour="lesson-drills"]'); if (!s) return null;
        const row = [...s.querySelectorAll("div, button")].find((r) => r.children.length >= 2 && /^Gate drill/.test(r.textContent.trim())); const c = row && [...row.querySelectorAll("span")].find((x) => Math.round(x.getBoundingClientRect().width) === 22); return c ? getComputedStyle(c).borderTopColor : null;
      });
      await shot("x-lesson-drills");
      check("(x) the lesson page's drills are boxed rows on golf's edge, the way the Drills tab draws them", boxedRows(ld, EDGE.golf) && ld.length === 2, rowSaid(ld));
      check("(x2) an undone drill's tick on the lesson page is on golf's edge, not the hairline", tick === EDGE.golf, String(tick));
      const drillPad = await page.evaluate(() => { const s = document.querySelector('[data-tour="lesson-drills"] .nsc-list'); return s ? [...s.children].map((r) => parseFloat(getComputedStyle(r).paddingTop)) : []; });
      check("(x3) a drill's box keeps air above its name, so a drill that wraps never touches the edge", drillPad.length === 2 && drillPad.every((x) => x >= 8), JSON.stringify(drillPad));

      /* (r) the Calendar view's free hours, two days out */
      await tap(page, '[aria-label="Diary"]', 1000);
      await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 700);
      const d2 = dayFrom(2);
      if (d2.getMonth() !== new Date(`${TODAY}T12:00:00`).getMonth()) await tap(page, '[aria-label="Next month"]', 600);
      await tap(page, `[data-day="${d2.getDate()}"]`, 800);
      const fr = await rowsOf(page, "[data-cal-day]", `return [...root.querySelectorAll("button")].filter((b) => /^\\d{1,2}:\\d\\d/.test(b.textContent.trim()));`);
      await shot("r-calendar-free");
      const frD = await dayBox(page, "[data-cal-day]");
      check("(r) the Calendar view's free hours (TimeList) are rows in one box on golf's edge, as the List view's day", boxedRows(fr, EDGE.golf) && fr.length >= 2 && dayFine(frD, EDGE.golf, HAIRLINE.golf), `${rowSaid(fr)} · ${JSON.stringify(frD)}`);

      /* (u) the attendance record */
      await openSettings(page, '[aria-label="Home"]');
      await tap(page, '[data-tour="settings-attendance"]', 1000);
      const at = await rowsOf(page, SCREEN, `return [...root.querySelectorAll("span")].filter((s) => /^\\d{2} [A-Z][a-z]{2}$|^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \\d/.test(s.textContent.trim()) && s.parentElement.querySelector("svg")).map((s) => s.parentElement);`);
      const atDays = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] span')].map((s) => s.textContent.trim()).filter((x) => /^\d{2} [A-Z][a-z]{2}$|^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/.test(x)));
      await shot("u-attendance");
      check("(u) the attendance record is boxed rows on golf's edge", boxedRows(at, EDGE.golf) && at.length === 3, rowSaid(at));
      check("(u2) its days read the app's one form (Thu 8 Oct), not '08 Oct'", atDays.length === 3 && atDays.every((d) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [1-9]\d? [A-Z][a-z]{2}$/.test(d)), JSON.stringify(atDays));
      await ctx.close();
    }

    check("(o) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(xx) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
