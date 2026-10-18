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

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", aoife: "00000000-0000-4000-8000-0000000a01fe", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", rider: "00000000-0000-4000-8000-00000000e9c0", tadhg: "00000000-0000-4000-8000-0000000ta0d6" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + n); return x; };

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Doyle", type: "adult", coachId: IDS.coach, dob: "1993-03-03" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("rider", "rider@t.ie", { role: "coach", name: "Róisín Daly", sport: "equestrian", inviteCode: "RD4K9P" });
  person("tadhg", "tadhg@t.ie", { role: "player", name: "Tadhg Ryan", type: "adult", sport: "equestrian", coachId: IDS.rider, dob: "1988-08-08" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]),
    groups: [{ id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], day: 5, time: "9:00 am", weeks: 8, sport: "golf" }] });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: TODAY, time: "10:30 am" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-12)), focus: "Short game", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-26)), focus: "Putting", unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(-9)), focus: "Driving", unread: false });
  /* nothing booked and the last lesson two months gone: Drifting */
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.aoife, date: M.ymd(dayFrom(-60)), focus: "Bunker play", unread: false });
  M.addLesson(db, { coachId: IDS.rider, playerId: IDS.tadhg, date: M.ymd(dayFrom(-5)), focus: "Flatwork", unread: false });
  db.tips.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, title: "Trust the shallow", body: null, created_at: `${M.ymd(dayFrom(-12))}T10:00:00Z` });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.adult, title: "Gate drill" });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.junior, title: "Ladder drill" });
  db.competitions.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, name: "Autumn Medal", kind: null, venue: null, event_date: M.ymd(dayFrom(12)), created_at: `${TODAY}T07:00:00Z` });
  return db;
}

const { check, results, summary } = M.checker("boxes");

/* every visible box of every `.nsc-list` under `scope`: the edge on all
   four sides in the colour `var(--edge)` resolves to there, 8px corners
   (Chrome reads EDGE_W's 1.5px back snapped to a whole pixel, so the
   width is held to at least one and the colour to the edge exactly);
   and nothing inside a box drawing a rule across it (a `.nsc-day` keeps
   its own rows) */
const audit = (page, scope) => page.evaluate((scope) => {
  const root = scope ? document.querySelector(scope) : document;
  if (!root) return null;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const edgeAt = (host) => { const p = document.createElement("div"); p.style.cssText = "position:absolute;visibility:hidden;border:1px solid var(--edge)"; host.appendChild(p); const c = getComputedStyle(p).borderTopColor; p.remove(); return c; };
  const out = { lists: 0, boxes: 0, bad: [], rules: [] };
  root.querySelectorAll(".nsc-list").forEach((list) => {
    if (!vis(list)) return; out.lists++;
    const edge = edgeAt(list);
    [...list.children].forEach((box) => {
      if (!vis(box)) return; out.boxes++;
      const cs = getComputedStyle(box);
      const sides = ["Top", "Right", "Bottom", "Left"].every((s) => parseFloat(cs[`border${s}Width`]) >= 1 && cs[`border${s}Color`] === edge && cs[`border${s}Style`] === "solid");
      if (!sides || cs.borderTopLeftRadius !== "8px") out.bad.push(`${(box.innerText || "").replace(/\s+/g, " ").slice(0, 28)} · ${cs.borderTopWidth} ${cs.borderTopColor} (edge ${edge}) r${cs.borderTopLeftRadius}`);
      const bw = box.getBoundingClientRect().width;
      box.querySelectorAll("*").forEach((el) => {
        const day = el.closest(".nsc-day"); if (day && box.contains(day)) return;
        const s = getComputedStyle(el);
        if (parseFloat(s.borderBottomWidth) > 0 && s.borderBottomStyle !== "none" && !/rgba\(0, 0, 0, 0\)/.test(s.borderBottomColor) && vis(el) && el.getBoundingClientRect().width >= 0.6 * bw)
          out.rules.push(`${(el.innerText || el.tagName).replace(/\s+/g, " ").slice(0, 28)} · ${s.borderBottomWidth}`);
      });
    });
  });
  return out;
}, scope);
/* the list a row sits in: its parent's classes */
const holder = (page, sel, nth = 0) => page.evaluate(([sel, nth]) => {
  const el = document.querySelectorAll(sel)[nth]; if (!el) return null;
  return { parent: el.parentElement.className, foot: getComputedStyle(el).borderBottomWidth, footColor: getComputedStyle(el).borderBottomColor };
}, [sel, nth]);
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

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 4000 }).catch(() => {}); await page.waitForTimeout(600); };
  const sheetText = async (page) => (await page.locator("[data-sheet]").count()) ? page.locator("[data-sheet]").first().innerText() : "";

  try {
    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      /* the peek: the last lessons and what the player is building towards */
      await page.locator('[data-tour="agenda-row"], button', { hasText: "Cian Murphy" }).first().dispatchEvent("click"); await page.waitForTimeout(1000);
      let st = await sheetText(page);
      if (!/peek|Log/.test(st) || !(await page.locator('[data-tour="peek-log"]').count())) {
        await tap(page, '[aria-label="Diary"]', 900);
        await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).first().dispatchEvent("click"); await page.waitForTimeout(1000);
        st = await sheetText(page);
      }
      const peek = await audit(page, "[data-sheet]");
      await shot("01-peek");
      check("(a) the peek's last lessons and competitions are the app's list — a box each on the sport's edge, no rule inside", fine(peek) && peek.boxes >= 3 && /Short game/.test(st) && /Autumn Medal/.test(st), said(peek));
      const day = dayFrom(12), DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const want = `${DAYS[day.getDay()]} ${day.getDate()} ${MON[day.getMonth()]}`;
      check("(a2) a competition reads its day, never a countdown", st.includes(want) && !/\b12d\b/.test(st), st.slice(-200));
      /* the register: one box, the people as rows inside it */
      await tap(page, '[data-tour="peek-register"]', 1000);
      const reg = await page.evaluate(() => {
        const s = document.querySelector("[data-sheet]"); if (!s) return null;
        const day = s.querySelector(".nsc-day"); if (!day) return { day: false };
        const rows = [...day.children];
        const cs = getComputedStyle(day);
        return { day: true, n: rows.length, edge: cs.borderTopWidth, radius: cs.borderTopLeftRadius,
                 inner: rows.slice(0, -1).every((r) => getComputedStyle(r).borderBottomWidth === "1px"), last: rows.length ? getComputedStyle(rows[rows.length - 1]).borderBottomStyle : null,
                 present: /Present/.test(day.innerText) };
      });
      await shot("02-register");
      check("(b) the register is one box with the people as rows inside it, the last row open", !!reg && reg.day && reg.n >= 1 && parseFloat(reg.edge) >= 1 && reg.radius === "8px" && reg.inner && reg.last === "none" && reg.present, JSON.stringify(reg));
      /* the day's lessons and the walk-ins */
      await page.locator("[data-sheet]").getByText("All lessons", { exact: true }).first().click(); await page.waitForTimeout(900);
      const attend = await audit(page, "[data-sheet]");
      const ar = await holder(page, '[data-sheet] [data-tour="attend-row"]');
      check("(c) the day's lessons and Not in the diary are boxed rows", fine(attend) && !!ar && /nsc-list/.test(ar.parent), `${said(attend)} · ${JSON.stringify(ar)}`);
      await closeSheet(page);

      /* the Message picker */
      await tap(page, '[aria-label="Chat"]', 900);
      const chatAdd = await addCtl(page, '[data-tour="chat-new"]');
      check("(d) Chat's add control is the app's one: 40 square, the control's corner, the accent, a cast shadow and a white plus", sameAdd(chatAdd) && chatAdd.label === "New message", addSaid(chatAdd));
      await tap(page, '[data-tour="chat-new"]', 900);
      const pick = await audit(page, "[data-sheet]");
      const tp = await holder(page, '[data-sheet] [data-tour="thread-person"]');
      await shot("03-new-message");
      check("(e) the Message picker's Everyone, groups and people are boxed rows", fine(pick) && !!tp && /nsc-list/.test(tp.parent) && (await page.locator('[data-sheet] [data-tour="thread-group"]').count()) === 1, `${said(pick)} · ${JSON.stringify(tp)}`);
      await closeSheet(page);

      /* the roster: the players' boxes carry no rule of their own, All lessons a box of its own, the groups boxed */
      await tap(page, '[aria-label="Roster"]', 900);
      const ros = await audit(page, '[data-scroll="screen"]');
      const arch = await holder(page, '[data-tour="roster-archive"]');
      await shot("04-roster");
      check("(f) the roster's players carry no hairline inside their boxes, and All lessons is a box of its own", fine(ros) && !!arch && /nsc-list/.test(arch.parent), `${said(ros)} · ${JSON.stringify(arch)}`);
      await page.locator('[data-scroll="screen"] button', { hasText: /^Groups$/ }).first().click(); await page.waitForTimeout(700);
      const grp = await audit(page, '[data-scroll="screen"]');
      const gr = await holder(page, '[data-tour="roster-group"]');
      check("(f2) the Groups half is boxed rows, Create a group among them", fine(grp) && !!gr && /nsc-list/.test(gr.parent) && (await page.locator('[data-tour="roster-newgroup"]').count()) === 1, `${said(grp)} · ${JSON.stringify(gr)}`);
      await page.locator('[data-scroll="screen"] button', { hasText: /^Players$/ }).first().click(); await page.waitForTimeout(600);

      /* the player file: the tip centred, the foot boxed, the lessons with no rule inside */
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1100);
      const file = await audit(page, '[data-scroll="screen"]');
      const pp = await holder(page, '[data-tour="player-progress"]');
      const tip = await page.evaluate(() => {
        const lab = [...document.querySelectorAll('[data-scroll="screen"] .nsc-list span')].find((s) => s.textContent === "Tip"); if (!lab) return null;
        const val = lab.nextElementSibling; const a = lab.getBoundingClientRect(), b = val.getBoundingClientRect(), box = lab.parentElement.getBoundingClientRect();
        return { label: a.top + a.height / 2, value: b.top + b.height / 2, box: box.top + box.height / 2 };
      });
      await shot("05-player-file");
      check("(g) the player file's lessons, tip and foot rows are boxed, with no rule inside a box", fine(file) && !!pp && /nsc-list/.test(pp.parent) && file.boxes >= 5, `${said(file)} · ${JSON.stringify(pp)}`);
      check("(g2) the tip's label and its words sit on one centre line, in the middle of the box", !!tip && Math.abs(tip.label - tip.value) <= 2 && Math.abs(tip.label - tip.box) <= 2, JSON.stringify(tip));
      /* Recurring lessons, from the foot of the Diary: the same add control */
      await tap(page, '[aria-label="Diary"]', 900);
      await M.click(page, "Recurring lessons"); await page.waitForTimeout(900);
      const recAdd = await addCtl(page, '[data-tour="recur-add"]');
      check("(h) Recurring lessons' add control is the same one", sameAdd(recAdd) && recAdd.label === "Add", addSaid(recAdd));
      check("(h2) …the same box, corner, fill and glyph as Chat's", !!recAdd && !!chatAdd && recAdd.w === chatAdd.w && recAdd.radius === chatAdd.radius && recAdd.bg === chatAdd.bg && recAdd.stroke === chatAdd.stroke && recAdd.shadow === chatAdd.shadow, `${addSaid(recAdd)} vs ${addSaid(chatAdd)}`);

      /* Drifting and Ahead, from the home's Actions */
      await tap(page, '[aria-label="Today"]', 900);
      await page.locator("button", { hasText: /^Drifting/ }).first().click(); await page.waitForTimeout(900);
      const drift = await audit(page, '[data-scroll="screen"]');
      const t1 = await text(); await shot("06-drifting");
      check("(i) Drifting's people are boxed rows", fine(drift) && /Aoife Doyle/.test(t1), `${said(drift)} · ${t1.slice(0, 120)}`);
      await M.back(page);
      await page.locator("button", { hasText: /^Competitions/ }).last().click(); await page.waitForTimeout(900);
      const aheadAdd = await addCtl(page, '[data-scroll="screen"] ~ * button[aria-label="Add"], button[aria-label="Add"]');
      const t2 = await text(); await shot("07-ahead");
      check("(j) Ahead's add control is the same one, and its subtitle carries a count", /Ahead/.test(t2) && sameAdd(aheadAdd) && !!chatAdd && aheadAdd.bg === chatAdd.bg && aheadAdd.radius === chatAdd.radius && /1 coming up/.test(t2), `${addSaid(aheadAdd)} · ${t2.slice(0, 120)}`);

      /* the tip sheet's prompts: one box, rows inside */
      await tap(page, '[aria-label="Today"]', 900);
      await page.locator('[data-tour="today-board"] button', { hasText: /^Tip$/ }).first().click(); await page.waitForTimeout(900);
      const pw = await audit(page, "[data-sheet]");
      check("(k) the pick-a-player sheet is boxed rows", fine(pw), said(pw));
      await page.locator("[data-sheet] button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const pr = await page.evaluate(() => {
        const s = document.querySelector("[data-sheet]"); const day = s && s.querySelector(".nsc-day"); if (!day) return null;
        const rows = [...day.children]; return { n: rows.length, edge: getComputedStyle(day).borderTopWidth, inner: rows.slice(0, -1).every((r) => getComputedStyle(r).borderBottomWidth === "1px"), last: getComputedStyle(rows[rows.length - 1]).borderBottomStyle };
      });
      await shot("08-tip-prompts");
      check("(k2) the tip sheet's prompts are one box with the prompts as rows inside it", !!pr && pr.n >= 2 && parseFloat(pr.edge) >= 1 && pr.inner && pr.last === "none", JSON.stringify(pr));
      await closeSheet(page);
      await ctx.close();
    }

    /* ---------- an equestrian coach: the add control's glyph still reads ---------- */
    {
      const { ctx, page } = await boot("rider");
      await tap(page, '[aria-label="Chat"]', 900);
      const c = await addCtl(page, '[data-tour="chat-new"]');
      check("(l) on the equestrian accent the white plus still reads at 4.5:1 or more", sameAdd(c), addSaid(c));
      await ctx.close();
    }

    /* ---------- the player: an empty tick box is on the edge ---------- */
    {
      const { ctx, page } = await boot("adult");
      await tap(page, '[aria-label="Drills"]', 1000);
      const tick = await page.evaluate(() => {
        const row = document.querySelector('[data-scroll="screen"] button[aria-pressed="false"]'); if (!row) return null;
        const box = [...row.querySelectorAll("*")].find((el) => { const r = el.getBoundingClientRect(); return Math.round(r.width) === 24 && Math.round(r.height) === 24; }); if (!box) return { box: false };
        const p = document.createElement("div"); p.style.cssText = "position:absolute;visibility:hidden;border:1px solid var(--edge)"; row.appendChild(p); const edge = getComputedStyle(p).borderTopColor; p.remove();
        return { color: getComputedStyle(box).borderTopColor, edge, w: getComputedStyle(box).borderTopWidth };
      });
      check("(m) an undone drill's tick box is drawn on the sport's edge, not the hairline", !!tick && tick.color === tick.edge && parseFloat(tick.w) >= 1, JSON.stringify(tick));
      await ctx.close();
    }

    /* ---------- the parent: the child's screen ---------- */
    {
      const { ctx, page, text, shot } = await boot("parent");
      await tap(page, '[aria-label="Family"]', 900);
      await page.locator("button", { hasText: "Saoirse" }).first().click(); await page.waitForTimeout(1000);
      const kid = await audit(page, '[data-scroll="screen"]');
      const mc = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent === "Message coach"); if (!b) return null; const p = document.createElement("div"); p.style.cssText = "position:absolute;visibility:hidden;border:1px solid var(--edge)"; b.parentElement.appendChild(p); const edge = getComputedStyle(p).borderTopColor; p.remove(); return getComputedStyle(b).borderTopColor === edge ? getComputedStyle(b).borderTopWidth : `colour ${getComputedStyle(b).borderTopColor} vs ${edge}`; });
      const t = await text(); await shot("09-family-kid");
      check("(n) the child's Next and Drills are boxed rows, and Message coach is outlined on the edge", fine(kid) && /Next/.test(t) && /Ladder drill|1 drill/.test(t) && parseFloat(mc) >= 1, `${said(kid)} · ${mc}`);
      await ctx.close();
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
