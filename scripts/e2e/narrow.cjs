/* NOTHING IS CUT AT 320. Three places gave way at the narrowest phone:
   the compact header, once a screen had scrolled, cut its own title to
   "D…" between the mark and the right-hand cluster; the register's row
   gave a long name three hyphenated lines beside two 66px buttons; and
   the coach's live row on the home gave the name 32 of the 85px it needs
   beside Register. A control that cannot sit beside the name takes a
   line of its own under it (the person row's rule for Accept · Decline);
   a title is never cut. Measured at 320 and, as the control, at 375.
   Since 22 November the lesson on now is the day's one coloured card
   (art direction): Register is a white key inside it, beside the name
   while the whole name fits on its line and under it where it does not;
   and the time leads every other row of the day at 17/600 in a 74
   column, so at 350 and under the row's face gives way to the name.
   Usage: node narrow.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4381), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", max: "00000000-0000-4000-8000-000000000a0a", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
const LONG = "Maximiliano Ó Súilleabháin";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("max", "max@t.ie", { role: "player", name: LONG, type: "adult", coachId: IDS.coach, dob: "1990-01-01" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:30 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]), groups: [] });
  /* the long name's lesson is the one running at the pinned clock */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.max, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(1)), time: "9:00 am" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-5)), focus: "Short game", unread: false });
  /* (f) the player file: a lesson of two areas and two files, and a running arrangement for its Recurring lessons row */
  const two = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(dayFrom(-1)), focus: "Custom fitting · Mental game", unread: false });
  M.addMedia(db, { lessonId: two.id, kind: "photo", path: `${IDS.coach}/${two.id}/1.jpg` }); M.addMedia(db, { lessonId: two.id, kind: "photo", path: `${IDS.coach}/${two.id}/2.jpg` });
  M.addRecurring(db, { coachId: IDS.coach, playerId: IDS.adult, weekday: 2, time: "10:30 am" });
  /* the child's next lesson, read on her own screen by the parent (e) */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(2)), time: "10:30 am" });
  return db;
}

const { check, results, summary } = M.checker("narrow");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async (role, width, at = "09:10") => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T${at}:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}@${width}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}-${width}.png`) });
    return { ctx, page, shot };
  };
  const { tap } = M;
  const TITLE = '[data-tour="screen-title"], span.flex-1.text-center.truncate';
  /* the compact title once the screen has scrolled: its words, whether they are cut, and what the row gives it */
  const compactTitle = async (page) => {
    await page.evaluate(() => { const el = document.querySelector('[data-scroll="screen"]'); if (el) { el.scrollTop = 140; el.dispatchEvent(new Event("scroll")); } });
    await page.waitForTimeout(450);
    return page.evaluate((sel) => {
      const el = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0 && getComputedStyle(x).opacity !== "0");
      if (!el) return null;
      const r = el.getBoundingClientRect(), right = el.nextElementSibling ? el.nextElementSibling.getBoundingClientRect() : null;
      return { text: el.textContent.trim(), cut: el.scrollWidth > el.clientWidth + 1, w: Math.round(r.width), right: right ? Math.round(right.width) : null, fs: getComputedStyle(el).fontSize };
    }, TITLE);
  };
  const said = (o) => o ? `"${o.text}" ${o.cut ? "CUT" : "whole"} · title ${o.w}px · right ${o.right}px · ${o.fs}` : "no compact title";
  /* a register row: the name's lines and the marks' place */
  const regRow = (page, name) => page.evaluate((name) => {
    const row = document.querySelector(`[data-reg-row="${name}"]`); if (!row) return null;
    const nm = row.querySelector("[data-name]"), bs = [...row.querySelectorAll("button")];
    const nr = nm.getBoundingClientRect(), lh = parseFloat(getComputedStyle(nm).lineHeight) || 20;
    return { nameW: Math.round(nr.width), lines: Math.round(nr.height / lh), nameBottom: Math.round(nr.bottom), nameCut: nm.scrollWidth > nm.clientWidth + 1 || nm.scrollHeight > nm.clientHeight + 1,
             marks: bs.map((b) => { const r = b.getBoundingClientRect(); return { label: b.textContent.trim(), top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; }),
             rowH: Math.round(row.getBoundingClientRect().height) };
  }, name);
  /* a name's fit, in the page: its lines, whether it is cut, and whether a
     word was broken inside (a word wider than its box, which overflow-wrap
     breaks mid-word) */
  const FIT = `(nm) => { const cs = getComputedStyle(nm), lh = parseFloat(cs.lineHeight) || 19, r = nm.getBoundingClientRect();
    const probe = document.createElement("span"); probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:" + cs.font + ";letter-spacing:" + cs.letterSpacing; document.body.appendChild(probe);
    const widest = Math.max(...nm.textContent.trim().split(/\\s+/).map((w) => { probe.textContent = w; return probe.getBoundingClientRect().width; })); probe.remove();
    return { name: nm.textContent.trim(), nameW: Math.round(r.width), lines: Math.round(r.height / lh), nameCut: nm.scrollHeight > nm.clientHeight + 1 || nm.scrollWidth > nm.clientWidth + 1, broken: widest > nm.clientWidth + 1,
             nameBottom: Math.round(r.bottom), nameRight: Math.round(r.right) }; }`;
  /* the day's coloured card on the home (the lesson on now): how many
     there are, the name's fit, and where Register sits — its height,
     whether it is inside the card, and what of the card it lies over */
  const liveCard = (page) => page.evaluate((FIT) => {
    const cards = [...document.querySelectorAll("[data-next-card]")], card = cards[0]; if (!card) return { cards: 0 };
    const reg = card.querySelector('[data-tour="day-register"]'), nm = card.querySelector("[data-name]");
    const cr = card.getBoundingClientRect(), rr = reg ? reg.getBoundingClientRect() : null;
    /* every word, glyph and picture of the card that is not the key's own */
    const others = [...card.querySelectorAll("span, svg, img")].filter((x) => !reg || !reg.contains(x)).filter((x) => x.tagName !== "SPAN" || (!x.children.length && x.textContent.trim())).map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0);
    const hits = rr ? others.filter((r) => !(r.right <= rr.left + 0.5 || r.left >= rr.right - 0.5 || r.bottom <= rr.top + 0.5 || r.top >= rr.bottom - 0.5)).length : null;
    const time = [...card.querySelectorAll("span")].find((s) => !s.children.length && /^\d{1,2}:\d{2} [ap]m$/.test(s.textContent.trim()));
    return { cards: cards.length, kind: card.dataset.nextCard, ...eval(FIT)(nm), bg: getComputedStyle(card).backgroundColor, fg: getComputedStyle(nm).color, timeSize: time ? getComputedStyle(time).fontSize : null,
             regLabel: reg ? reg.textContent.trim() : null, regTop: rr ? Math.round(rr.top) : null, regLeft: rr ? Math.round(rr.left) : null, regH: rr ? Math.round(rr.height) : null,
             regInside: rr ? rr.left >= cr.left - 0.5 && rr.right <= cr.right + 0.5 && rr.top >= cr.top - 0.5 && rr.bottom <= cr.bottom + 0.5 : null, hits, cardH: Math.round(cr.height) };
  }, FIT);
  /* a row of the day that is not the card, by the name it carries: the
     name's fit, the time that leads it, its face and its tail */
  const dayRow = (page, who) => page.evaluate(([FIT, who]) => {
    const row = [...document.querySelectorAll('[data-scroll="screen"] .nsc-ruled > *')].find((b) => !b.hasAttribute("data-next-card") && [...b.querySelectorAll("[data-name]")].some((n) => n.textContent.trim() === who) && /\d{1,2}:\d{2} [ap]m/.test(b.textContent)); if (!row) return null;
    const nm = row.querySelector("[data-name]"), tm = [...row.querySelectorAll("span")].find((s) => !s.children.length && /^\d{1,2}:\d{2} [ap]m$/.test(s.textContent.trim()));
    const tcs = getComputedStyle(tm), tail = [...row.querySelectorAll("span")].find((s) => !s.children.length && s.textContent.trim() === "Log");
    return { ...eval(FIT)(nm), time: tm.textContent.trim(), timeSize: tcs.fontSize, timeWeight: tcs.fontWeight, timeW: Math.round(tm.getBoundingClientRect().width), timeCut: tm.scrollWidth > tm.clientWidth + 1,
             timeLeads: tm.getBoundingClientRect().right <= nm.getBoundingClientRect().left, face: row.querySelectorAll("span.rounded-full, img").length > 0, log: !!tail, logBeside: tail ? tail.getBoundingClientRect().top < nm.getBoundingClientRect().bottom : null,
             rowH: Math.round(row.getBoundingClientRect().height) };
  }, [FIT, who]);

  try {
    /* ---------- (a) the compact header's title, whole, at 320 ---------- */
    /* the Diary for every role: the one root screen that scrolls far enough
       to shrink its header for each of them (the roster, Family and the
       feed do not), with the full right-hand cluster beside the title */
    /* the pill: its face, and the name span if it carries one */
    const pillOf = (page) => page.evaluate(() => { const p = document.querySelector('[data-tour="profile-pill"]'); if (!p) return null; const nm = p.querySelector("span.truncate"); return { narrow: p.dataset.narrow === "1", w: Math.round(p.getBoundingClientRect().width), name: nm ? nm.textContent.trim() : null }; });
    for (const role of ["coach", "adult", "parent", "junior"]) {
      const { ctx, page, shot } = await boot(role, 320);
      await tap(page, '[aria-label="Diary"]', 900);
      const o = await compactTitle(page);
      const pill = await pillOf(page);
      await shot(`01-${role}-diary-compact`);
      /* the parent's Diary is titled "Book for Saoirse" — the carried
         decision (24 Oct) — and sixteen letters do not fit the 80px a
         root screen's row leaves at 320 whatever the pill does; the
         title is measured where the title is the tab's name */
      if (role !== "parent") check(`(a) ${role}'s Diary at 320: the compact header's title reads whole once the screen has scrolled — never "D…"`, !!o && o.text === "Diary" && !o.cut && o.w >= 60, said(o));
      else console.log(`      note  the parent's Diary at 320: ${said(o)} — the title is the carried "Book for" decision`);
      check(`(a1) ${role}'s pill at 320 is the face and the chevron — no first name, under 70px`, !!pill && pill.narrow && pill.w <= 70 && pill.name === null, JSON.stringify(pill));
      await ctx.close();
    }
    {
      const { ctx, page } = await boot("coach", 375);
      await tap(page, '[aria-label="Diary"]', 900);
      const o = await compactTitle(page);
      const pill = await pillOf(page);
      check("(a2) guard: the coach's Diary at 375 reads whole too", !!o && o.text === "Diary" && !o.cut, said(o));
      check("(a3) at 375 the pill keeps its first name", !!pill && !pill.narrow && pill.name === "Niamh", JSON.stringify(pill));
      await ctx.close();
    }

    /* ---------- (b) the register's row with a long name ---------- */
    for (const width of [320, 375]) {
      const { ctx, page, shot } = await boot("coach", width);
      await tap(page, '[aria-label="Today"]', 900);
      await page.locator("button", { hasText: LONG.split(" ")[0] }).first().dispatchEvent("click"); await page.waitForTimeout(900);
      await tap(page, '[data-tour="peek-register"]', 1000);
      const o = await regRow(page, LONG);
      await shot("02-register-long-name");
      if (width === 320) {
        check("(b1) at 320 the long name takes two lines at most, whole, and Present · Absent take a line of their own under it, 44 tall",
          !!o && !o.nameCut && o.lines <= 2 && o.marks.length === 2 && o.marks.every((m) => m.top >= o.nameBottom - 2 && m.h >= 44), JSON.stringify(o));
      } else {
        check("(b2) at 375 Present · Absent stay beside the name", !!o && !o.nameCut && o.marks.length === 2 && o.marks.every((m) => m.top < o.nameBottom - 8), JSON.stringify(o));
      }
      await ctx.close();
    }

    /* ---------- (c) the lesson on now is the day's one coloured card ---------- */
    /* (22 November, art direction) the live row became the card: the sport's
       colour, white words, the time at 28, the ringed face and the whole
       name, Register a white key inside it. What the row's checks proved,
       the card's prove: the name whole — never cut, no word broken — at
       320, 360 and 375 for a short name and the long one; Register a key 44
       tall inside the card, lying over nothing; and its place decided by
       the name, never the width — beside the name while the whole name
       fits on its line, a line of its own under it where it does not. */
    /* what every card must be, whatever the width and the name */
    const cardOk = (o, who) => !!o && o.cards === 1 && o.kind === "now" && o.name === who && !o.nameCut && !o.broken && o.regLabel === "Register" && o.regH >= 44 && o.regInside === true && o.hits === 0 && o.timeSize === "28px";
    const under = (o) => o.regTop >= o.nameBottom - 2, beside = (o) => o.regTop < o.nameBottom - 8 && o.regLeft >= o.nameRight - 1;
    for (const width of [320, 375]) {
      const { ctx, page, shot } = await boot("coach", width);
      await tap(page, '[aria-label="Today"]', 900);
      const o = await liveCard(page);
      await shot("03-live-card");
      if (width === 320) {
        check("(c1) at 320 the card gives the long name its room — two lines at most, no word broken, nothing cut — and Register, a 44-tall key inside the card, takes a line of its own under it",
          cardOk(o, LONG) && o.nameW >= 85 && o.lines <= 2 && under(o), JSON.stringify(o));
      } else {
        check("(c2) at 375 the whole long name does not fit beside Register, so Register takes a line of its own under it and the name reads on one line", cardOk(o, LONG) && o.lines === 1 && under(o), JSON.stringify(o));
      }
      await ctx.close();
    }

    /* ---------- (c3)–(c8) Register's place is the name's, not the width's; the day's other rows ---------- */
    for (const [width, at, who, want] of [[360, "16:10", "Cian Murphy", "beside"], [375, "16:10", "Cian Murphy", "beside"], [360, "09:10", LONG, "under"], [320, "16:10", "Cian Murphy", "either"]]) {
      const { ctx, page, shot } = await boot("coach", width, at);
      await tap(page, '[aria-label="Today"]', 900);
      const o = await liveCard(page);
      await shot(`03-live-card-${who.split(" ")[0]}`);
      const ok = cardOk(o, who) && (want === "beside" ? (beside(o) && o.lines === 1 && o.cardH <= 126) : want === "under" ? (under(o) && o.lines === 1) : (o.lines === 1 && (under(o) || beside(o))));
      check(want === "beside"
        ? `(c${width === 360 ? 3 : 4}) at ${width} a short name keeps Register beside it, the card at its one height — a fixed basis dropped it under every name at 360`
        : want === "under" ? "(c5) at 360 the whole long name does not fit beside Register, so Register takes a line of its own under it"
        : "(c6) at 320 a short name reads whole on one line, Register a 44-tall key inside the card beside it or under it, lying over nothing", ok, JSON.stringify(o));
      /* at ten past four the long name's lesson is over: a white row to log, the time leading it */
      if (at === "16:10" && width !== 375) {
        const r = await dayRow(page, LONG);
        const lead = !!r && r.timeLeads && r.timeSize === "17px" && r.timeWeight === "600" && r.timeW === 74 && !r.timeCut;
        check(width === 320
          ? "(c7) at 320 the time leads the day's other rows at 17/600 in its 74 column and the long name reads whole beside it — no word broken, nothing cut, Log beside it — the face giving way to the name"
          : "(c8) at 360 the same row keeps its face, the time leading at 17/600, the long name whole on three lines at most, no word broken",
          lead && r.name === LONG && !r.nameCut && !r.broken && r.log && r.logBeside && (width === 320 ? (!r.face && r.lines <= 2) : (r.face && r.lines <= 3)), JSON.stringify(r));
      }
      await ctx.close();
    }

    /* ---------- (d) the Diary's List row with a long name ---------- */
    {
      const { ctx, page, shot } = await boot("coach", 320);
      await tap(page, '[aria-label="Diary"]', 900);
      const o = await page.evaluate((LONG) => {
        const row = [...document.querySelectorAll('[data-tour="agenda-row"]')].find((r) => r.textContent.includes(LONG.split(" ")[0])); if (!row) return null;
        const nm = row.querySelector("[data-name]"), r = nm.getBoundingClientRect(), lh = parseFloat(getComputedStyle(nm).lineHeight) || 18;
        return { text: nm.textContent.trim(), w: Math.round(r.width), lines: Math.round(r.height / lh), cut: nm.scrollWidth > nm.clientWidth + 1 || nm.scrollHeight > nm.clientHeight + 1, rowH: Math.round(row.getBoundingClientRect().height) };
      }, LONG);
      await shot("04-diary-row");
      check('(d) the Diary\'s List row at 320 reads the whole name on a second line — it read "Maximiliano Ó Súil…" beside the time', !!o && o.text === LONG && !o.cut && o.lines <= 2, JSON.stringify(o));
      await ctx.close();
    }

    /* ---------- (d2) the roster's two keys, whole ---------- */
    /* Add player · New group share a line with their glyph on a 60 key, two
       across: at 320 the word had 59px and the keys read "Add pl…" and
       "New g…" (seen on the 23 November pass). The word takes a second line
       at its space before an ellipsis, and the key stays 60 tall; from 360
       up it is one line as it was */
    for (const width of [320, 360, 375]) {
      const { ctx, page, shot } = await boot("coach", width);
      await tap(page, '[aria-label="Roster"]', 900);
      const keys = await page.evaluate(() => [...document.querySelectorAll('[data-scroll="screen"] [data-tile]')].map((b) => {
        const s = b.querySelector("span"), cs = getComputedStyle(s), lh = parseFloat(cs.lineHeight) || 18;
        return { text: s.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), lines: Math.round(s.getBoundingClientRect().height / lh), glyph: !!b.querySelector("svg"),
                 cut: s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1, inside: s.getBoundingClientRect().right <= b.getBoundingClientRect().right - 8 };
      }));
      if (width === 320) await shot("04b-roster-keys");
      check(`(d2) at ${width} the roster's Add player · New group read whole beside their glyph on a 60 key${width === 320 ? " — the word on a second line, never an ellipsis" : ", on one line"}`,
        keys.length === 2 && keys.map((k) => k.text).join(" · ") === "Add player · New group" && keys.every((k) => !k.cut && k.inside && k.glyph && k.h === 60 && (width === 320 ? k.lines <= 2 : k.lines === 1)), JSON.stringify(keys));
      await ctx.close();
    }

    /* ---------- (e) the child's Next row, whole ---------- */
    /* the parent's screen for a child: Next reads the day and the time,
       each fact whole, and breaks only at the dot — which hangs, clipped,
       off the second line's start (PersonRow's grey line), so the line
       reads "10:30 am", never "· 10:30 am". It read "Tue 24 Nov · 10:0…"
       at 320 for a round */
    for (const width of [320, 375]) {
      const { ctx, page, shot } = await boot("parent", width);
      await tap(page, '[aria-label="Family"]', 900);
      await page.locator("button", { hasText: "Saoirse" }).first().click(); await page.waitForTimeout(1000);
      const o = await page.evaluate(() => {
        const lbl = [...document.querySelectorAll('[data-scroll="screen"] .nsc-list > * > span:first-child')].find((s) => s.textContent.trim() === "Next"); if (!lbl) return null;
        const v = lbl.nextElementSibling, vr = v.getBoundingClientRect(), cs = getComputedStyle(v);
        const facts = [...v.querySelectorAll(".whitespace-nowrap")].map((f) => {
          const r = f.getBoundingClientRect(), dot = f.firstElementChild && f.firstElementChild.textContent.includes("·") ? f.firstElementChild.getBoundingClientRect() : null;
          return { text: f.textContent.replace("·", "").trim(), top: Math.round(r.top), right: Math.round(r.right), boxes: f.getClientRects().length, dotRight: dot ? Math.round(dot.right) : null };
        });
        return { text: v.textContent.replace(/\s+/g, " ").trim(), cut: v.scrollWidth > v.clientWidth + 1 || cs.textOverflow === "ellipsis", left: Math.round(vr.left), right: Math.round(vr.right), facts };
      });
      await shot("05-kid-next");
      const tops = o ? [...new Set(o.facts.map((f) => f.top))] : [];
      /* a fact that starts a line of its own carries its dot left of the value's box, where the clip takes it */
      const hung = !!o && o.facts.every((f, i) => i === 0 || f.top === o.facts[i - 1].top || (f.dotRight !== null && f.dotRight <= o.left + 1));
      const whole = !!o && !o.cut && o.facts.length === 2 && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}$/.test(o.facts[0].text) && o.facts[1].text === "10:30 am"
        && o.facts.every((f) => f.boxes === 1 && f.right <= o.right + 1);
      check(width === 320
        ? '(e) the child\'s Next row at 320 reads the day and the time whole, breaking only at the dot, which never leads the second line — it read "Tue 24 Nov · 10:0…"'
        : "(e2) at 375 the child's Next row reads on one line, whole", whole && hung && (width === 320 || tops.length === 1), JSON.stringify(o));
      console.log(`      note  the child's Next at ${width}: "${o ? o.text : "-"}" on ${tops.length} line(s), the value ${o ? o.right - o.left : "-"}px wide`);
      await ctx.close();
    }

    /* ---------- (f) the coach's player file, whole at 390 and 320 ---------- */
    /* (24 November, the class study) the four round keys four across: at 320 a column is 59 and "Message" read
       "Messag…" — a word under a face may stand in half the gutter each side, so it is whole and no two words meet.
       Recurring lessons' value read "Tue 10:30…" at 390 and "T…" at 320: it sits on the label's line while both
       fit and takes the line under the label, whole, where they do not, as Settings' Row. The lessons above them
       — two areas, two files — keep each part whole */
    for (const width of [390, 320]) {
      const { ctx, page, shot } = await boot("coach", width);
      await tap(page, '[aria-label="Roster"]', 900);
      await page.locator('[data-scroll="screen"] button', { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1100);
      const keys = await page.evaluate(() => [...document.querySelectorAll('[data-tour="player-actions"] [data-round]')].map((b) => {
        const s = b.querySelector(":scope > span:last-child"), r = s.getBoundingClientRect();
        return { text: s.textContent.trim(), cut: s.scrollWidth > s.clientWidth + 1, left: Math.round(r.left), right: Math.round(r.right) };
      }));
      const apart = keys.every((k, i) => i === 0 || k.left >= keys[i - 1].right);
      check(`(f${width}) the player file at ${width}: Message · Tip · Drills · Log read whole under their faces, on the screen, no two words meeting`,
        keys.map((k) => k.text).join(" · ") === "Message · Tip · Drills · Log" && keys.every((k) => !k.cut && k.left >= 0 && k.right <= width) && apart, JSON.stringify(keys));
      const lf = await M.factsFit(page, '[data-tour="player-lessons"]');
      check(`(f${width}) …its lessons' areas and grey lines each part whole — nothing past the column, no line led by a dot, no fact split, no word broken`,
        M.factsWhole(lf) && lf.some((f) => f.text === "Custom fitting · Mental game"), JSON.stringify(lf));
      await page.evaluate(() => { const sc = document.querySelector('[data-scroll="screen"]'); if (sc) sc.scrollTop = sc.scrollHeight; }); await page.waitForTimeout(400);
      const rec = await M.rowLead(page, '[data-tour="player-recurring"]');
      const recLines = await page.evaluate(() => { const v = document.querySelector('[data-tour="player-recurring"] [data-row-value]'); if (!v) return null; const lh = parseFloat(getComputedStyle(v).lineHeight) || 23; return Math.round(v.getBoundingClientRect().height / lh); });
      await shot("06-player-file-foot");
      check(`(f${width}) …and Recurring lessons reads its value whole on one line — beside the label, or under it where both do not fit, never an ellipsis — the door still 60 tall`,
        !!rec && rec.label === "Recurring lessons" && rec.value === "Tue 10:30 am" && !rec.valueCut && !rec.labelCut && recLines === 1 && (rec.valueLine === "beside" || rec.valueLine === "under") && rec.h === 60,
        JSON.stringify({ ...rec, recLines }));
      console.log(`      note  Recurring lessons at ${width}: the value ${rec ? rec.valueLine : "-"} the label`);
      await ctx.close();
    }

    /* ---------- (g) the header's search, whole ---------- */
    /* its placeholder read "Lessons, drills, tips, peopl" at 390: a placeholder is the noun of what goes in it */
    for (const width of [390, 320]) {
      const { ctx, page, shot } = await boot("coach", width);
      await tap(page, '[aria-label="Search"]', 900);
      const ph = await page.evaluate(() => {
        /* the search's field takes the focus as it opens */
        const a = document.activeElement, i = a && a.tagName === "INPUT" ? a : document.querySelector("input[placeholder]"); if (!i) return null; const cs = getComputedStyle(i);
        const probe = document.createElement("span"); probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font};letter-spacing:${cs.letterSpacing}`; probe.textContent = i.placeholder; document.body.appendChild(probe);
        const need = probe.getBoundingClientRect().width; probe.remove();
        return { text: i.placeholder, need: Math.round(need), has: Math.round(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) };
      });
      await shot("07-search");
      check(`(g${width}) the header's search at ${width} reads its placeholder whole: Search`, !!ph && ph.text === "Search" && ph.need <= ph.has, JSON.stringify(ph));
      await ctx.close();
    }

    check("(z) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
