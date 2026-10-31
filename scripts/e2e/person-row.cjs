/* ONE PERSON ROW. A face, a name, one grey line and what sits on the
   right was drawn about ten ways — faces from 30 to 46, the name 57 to
   73px in, 13.5 to 15px at 400 or 600, rows 56 to 76 tall — and at 320
   the item on the right cut the name or the time on Today's request
   row, the bell's request row, the roster's standing line and the
   family's child row, and Chat cut every long name. Every one of those
   is PersonRow now: one face (40), one inset, TYPE.body for the name
   and TYPE.caption for the line under it, the name never cut (a second
   and a third line before an ellipsis, as the register's), a value kept
   and a pair of actions dropping under the name when a narrow phone
   cannot hold both. This walks the coach and a parent at 375 and 320
   and measures every row that carries data-person-row; an adult and a
   junior, whose screens carry none, prove nothing else took the shape.
   node scripts/e2e/person-row.cjs <dist> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4339), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", max: "00000000-0000-4000-8000-0000000a01fe", parent: "00000000-0000-4000-8000-0000000pa12", junior: "00000000-0000-4000-8000-00000000ju01", kid2: "00000000-0000-4000-8000-00000000ju02" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const LONG = "Maximiliano Ó Súilleabháin", LONG_KID = "Caoimhe Ní Shúilleabháin-Kelly";
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("max", "max@t.ie", { role: "player", name: LONG, type: "adult", coachId: IDS.coach, dob: "1993-03-03" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("kid2", "kid2@t.ie", { role: "player", name: LONG_KID, type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2012-02-02" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]),
    groups: [{ id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], day: 5, time: "9:00 am", weeks: 8, sport: "golf" }] });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(2)), time: "10:30 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.kid2, date: M.ymd(dayFrom(3)), time: "4:00 pm" });
  /* the requests: a long name on a dated hour, and a short one */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.max, date: M.ymd(dayFrom(4)), time: "10:00 am", status: "requested" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(5)), time: "10:00 am", status: "requested" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-12)), focus: "Short game", subs: ["HI 16.4"], notes: "Keep it low.", unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.max, date: M.ymd(dayFrom(-60)), focus: "Bunker play", subs: ["HI 12.1"], unread: false });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(-9)), focus: "Driving", unread: false });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.junior, title: "Ladder drill" });
  M.addDrill(db, { coachId: IDS.coach, playerId: IDS.kid2, title: "Gate drill" });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.max, senderId: IDS.max, body: "Can we look at the bunker shots again next week please?", createdAt: `${TODAY}T07:30:00Z` });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "See you at nine.", createdAt: `${TODAY}T07:00:00Z`, readAt: `${TODAY}T07:10:00Z` });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.kid2, senderId: IDS.parent, body: "Can she come Friday instead?", createdAt: `${TODAY}T06:30:00Z` });
  /* somebody asking to join: the bell's request row */
  M.addRequest(db, { playerId: IDS.max, coachId: IDS.coach, status: "pending", notify: true });
  M.addNotification(db, { userId: IDS.coach, kind: "calendar", title: `${LONG} asked for a lesson`, body: "Wed 4 Nov 10:00 am", createdAt: `${TODAY}T07:40:00Z` });
  M.addNotification(db, { userId: IDS.max, kind: "lesson", title: "Lesson logged", body: "Bunker play", createdAt: `${TODAY}T07:40:00Z` });
  M.addNotification(db, { userId: IDS.parent, kind: "booking", title: "Caoimhe's lesson tomorrow · 4:00 pm", body: null, createdAt: `${TODAY}T07:40:00Z` });
  return db;
}

/* every PersonRow on the screen: its face, name, grey line, value and actions */
const rows = (page, where) => page.evaluate((where) => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cut = (e) => { if (!e) return false; const s = getComputedStyle(e);
    return (s.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1) || (s.webkitLineClamp && s.webkitLineClamp !== "none" && e.scrollHeight > e.clientHeight + 1); };
  return [...document.querySelectorAll("[data-person-row]")].filter(vis).map((row) => {
    const rr = row.getBoundingClientRect();
    const face = row.children[0], fr = face.getBoundingClientRect();
    const col = [...row.children].find((c) => c !== face && /min-w-0/.test(c.className));
    const nameEl = row.querySelector("[data-name]"), subEl = row.querySelector("[data-sub]");
    const nr = nameEl ? nameEl.getBoundingClientRect() : null, cs = nameEl ? getComputedStyle(nameEl) : null;
    const trailing = [...row.children].filter((c) => c !== face && c !== col && vis(c));
    const acts = row.querySelector(":scope > .ml-auto");
    const btnH = acts ? [...acts.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().height)) : [];
    const faceText = face.textContent.trim();
    const trailCut = trailing.some((c) => [c, ...c.querySelectorAll("*")].some(cut));
    /* where a wrapped name breaks: the character before the second line's first — a space or a hyphen, never inside a word */
    let breakAt = null;
    if (nameEl && nameEl.firstChild && nameEl.firstChild.nodeType === 3) {
      const tn = nameEl.firstChild, rg = document.createRange(); rg.setStart(tn, 0); rg.setEnd(tn, 1); const top0 = rg.getBoundingClientRect().top;
      for (let i = 1; i < tn.length; i++) { rg.setStart(tn, i); rg.setEnd(tn, i + 1); if (rg.getBoundingClientRect().top > top0 + 2) { breakAt = i; break; } }
    }
    const txt = nameEl ? nameEl.textContent : "";
    const breakOk = breakAt == null ? true : /[\s-]/.test(txt[breakAt - 1]) || /\s/.test(txt[breakAt]);
    const boxed = !!row.closest(".nsc-list");
    return { where, tour: row.getAttribute("data-tour") || "", name: nameEl ? nameEl.textContent.trim() : "", face: Math.round(fr.width),
      inset: nr ? Math.round(nr.left - fr.left) : null, fs: cs ? cs.fontSize : null, fw: cs ? cs.fontWeight : null, bold: row.hasAttribute("data-bold"),
      actsH: acts ? Math.round(acts.getBoundingClientRect().height) : null, btnH, faceText,
      sub: subEl ? { fs: getComputedStyle(subEl).fontSize, t: subEl.textContent.trim(), cut: cut(subEl) } : null,
      nameCut: cut(nameEl), trailCut, wrapped: breakAt != null, breakOk, rowH: Math.round(rr.height), tag: row.tagName,
      border: getComputedStyle(row).borderBottomWidth, boxed,
      acts: acts ? { top: Math.round(acts.getBoundingClientRect().top), under: nr ? acts.getBoundingClientRect().top >= nr.bottom - 1 : null } : null };
  });
}, where);

const { check, results, summary } = M.checker("person-row");
(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [], all = [];
  const boot = async (db, role, width) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => errors.push(`${role}@${width}: ${String(e.message || e)}`));
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const grab = async (where, shot) => { const r = await rows(page, `${role}@${width} ${where}`); all.push(...r); if (shot) await page.screenshot({ path: path.join(outDir, `${role}-${width}-${where}.png`) }); return r; };
    return { ctx, page, grab };
  };
  const { tap } = M;
  try {
    for (const width of [375, 320]) {
      {
        const db = freshDb();
        const { ctx, page, grab } = await boot(db, "coach", width);
        await grab("today", true);
        await tap(page, '[aria-label="Roster"]', 1000); await grab("roster", true);
        const g = page.locator('button[aria-label="Groups"]'); if (await g.count()) { await g.first().dispatchEvent("click"); await page.waitForTimeout(700); await grab("roster-groups", true); }
        await tap(page, '[aria-label="Chat"]', 1000); await grab("chat", true);
        await tap(page, '[aria-label="Today"]', 800);
        /* the Actions row, not the filter tile of the same word above it */
        const dr = page.locator('button:not([aria-label="Drifting"])', { hasText: /^Drifting/ }); if (await dr.count()) { await dr.last().dispatchEvent("click"); await page.waitForTimeout(900); await grab("drifting", true); await tap(page, '[aria-label="Back"]', 700); }
        await tap(page, '[aria-label="Alerts"]', 1000); await grab("alerts", true);
        await ctx.close();
      }
      {
        const db = freshDb();
        const { ctx, page, grab } = await boot(db, "parent", width);
        await grab("family", true);
        await tap(page, '[aria-label="Chat"]', 1000); await grab("chat", true);
        await ctx.close();
      }
      for (const role of ["adult", "junior"]) {
        const db = freshDb();
        const { ctx, page, grab } = await boot(db, role, width);
        await grab("home");
        await tap(page, '[aria-label="Alerts"]', 900); await grab("alerts");
        await ctx.close();
      }
    }
    fs.writeFileSync(path.join(outDir, "rows.json"), JSON.stringify(all, null, 1));
    const at = (w, where) => all.filter((r) => r.where === `${w} ${where}`);
    const line = (r) => `${r.where} ${r.tour || "-"} face ${r.face} in${r.inset} ${r.fs}/${r.fw} h${r.rowH} ${r.name.slice(0, 22)}${r.nameCut ? " [NAME CUT]" : ""}${r.sub && r.sub.cut ? " [SUB CUT]" : ""}${r.trailCut ? " [TRAIL CUT]" : ""}`;
    const found = { asks375: at("coach@375", "today").filter((r) => r.tour === "today-asks" || r.acts), roster375: at("coach@375", "roster"), groups375: at("coach@375", "roster-groups"), ask375: at("coach@375", "alerts"), kids375: at("parent@375", "family"), drift375: at("coach@375", "drifting"),
                    asks320: at("coach@320", "today").filter((r) => r.acts), roster320: at("coach@320", "roster"), ask320: at("coach@320", "alerts"), kids320: at("parent@320", "family"), drift320: at("coach@320", "drifting") };
    const chat = { at375: at("coach@375", "chat").concat(at("parent@375", "chat")), at320: at("coach@320", "chat").concat(at("parent@320", "chat")) };
    check("(a) the seven surfaces carry the one row, at 375 and at 320: Today's requests, the roster's players and groups, Chat, Drifting, the bell's requests, the family's children",
      found.asks375.length >= 2 && found.roster375.length >= 3 && found.groups375.length >= 2 && found.ask375.length >= 1 && found.kids375.length >= 2 && found.drift375.length >= 1 && chat.at375.length >= 4
      && found.asks320.length >= 2 && found.roster320.length >= 3 && found.ask320.length >= 1 && found.kids320.length >= 2 && found.drift320.length >= 1 && chat.at320.length >= 4,
      JSON.stringify(Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.length]))));
    const faces = [...new Set(all.map((r) => r.face))];
    check("(b) one face: every row's face is 40", all.length > 0 && faces.length === 1 && faces[0] === 40, JSON.stringify(faces) + " " + all.filter((r) => r.face !== 40).slice(0, 3).map(line).join(" | "));
    const insets = [...new Set(all.map((r) => r.inset))];
    check("(c) one inset: the name starts 54px from the face's left on every row — the face and the 14px gap", insets.length === 1 && insets[0] === 54, JSON.stringify(insets) + " " + all.filter((r) => r.inset !== 54).slice(0, 3).map(line).join(" | "));
    const type = [...new Set(all.map((r) => `${r.fs}/${r.fw}${r.bold ? " unread" : ""}`))], subs = [...new Set(all.filter((r) => r.sub).map((r) => r.sub.fs))];
    check("(d) one type: the name 14.5px at 400 everywhere, 600 only on an unread thread, the grey line 12px", type.every((x) => x === "14.5px/400" || x === "14.5px/600 unread") && type.includes("14.5px/400") && all.some((r) => r.bold && /chat/.test(r.where)) && subs.length === 1 && subs[0] === "12px", JSON.stringify({ type, subs }));
    const cutRows = all.filter((r) => r.nameCut || (r.sub && r.sub.cut) || r.trailCut);
    check("(e) nothing is cut on any row at 375 or 320 — the name, the grey line, the value", cutRows.length === 0, cutRows.slice(0, 4).map(line).join(" | "));
    const longRows = all.filter((r) => r.name === LONG);
    check("(f) the long name is drawn whole, on two lines where it must be, on Today's request, the roster and the bell at both widths", longRows.length >= 6 && longRows.every((r) => !r.nameCut), `${longRows.length} ${longRows.slice(0, 3).map(line).join(" | ")}`);
    const asks375 = found.asks375.concat(found.ask375), asks320 = found.asks320.concat(found.ask320);
    check("(g) Accept · Decline sit beside a short name at 375 and drop under the name at 320, on Today and in the bell, 44 tall either way",
      asks375.some((r) => r.acts && r.acts.under === false) && asks320.length >= 2 && asks320.every((r) => r.acts && r.acts.under === true) && asks375.concat(asks320).every((r) => r.btnH.length === 2 && r.btnH.every((h) => h >= 44)),
      JSON.stringify({ at375: asks375.map((r) => [r.name.slice(0, 12), r.acts && r.acts.under, r.btnH]), at320: asks320.map((r) => [r.name.slice(0, 12), r.acts && r.acts.under, r.btnH]) }));
    const short = all.filter((r) => r.rowH < 64);
    check("(h) every row is at least 64 tall at rest", short.length === 0, short.slice(0, 3).map(line).join(" | "));
    const wrapped = all.filter((r) => r.wrapped), split = wrapped.filter((r) => !r.breakOk);
    check("(i) a name that takes a second line breaks at a space or a hyphen, never inside a word — the 30-letter double-barrelled name at 320 among them", wrapped.some((r) => r.name === LONG_KID && /@320/.test(r.where)) && split.length === 0, `${wrapped.length} wrapped · ${split.slice(0, 3).map(line).join(" | ")}`);
    const tappable = all.filter((r) => r.tag === "BUTTON"), inert = all.filter((r) => r.tag !== "BUTTON");
    check("(j) a row that opens something is a button; a row whose actions are its buttons is not", tappable.length > 0 && inert.every((r) => r.acts), JSON.stringify({ tappable: tappable.length, inert: inert.map((r) => r.tour || r.name.slice(0, 10)) }));
    const kidFaces = found.kids375.concat(found.kids320).map((r) => r.faceText);
    check("(k) the family's child row carries the child's two initials, as the strip under it does — the face is the whole name's, the label the first name", kidFaces.length >= 4 && kidFaces.every((x) => x.length === 2), JSON.stringify(kidFaces));
    const players = all.filter((r) => /^(adult|junior)@/.test(r.where));
    check("(l) a player's home and bell carry no person row", players.length === 0, players.slice(0, 3).map(line).join(" | "));
    check("no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
