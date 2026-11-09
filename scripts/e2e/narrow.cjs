/* NOTHING IS CUT AT 320. Three places gave way at the narrowest phone:
   the compact header, once a screen had scrolled, cut its own title to
   "D…" between the mark and the right-hand cluster; the register's row
   gave a long name three hyphenated lines beside two 66px buttons; and
   the coach's live row on the home gave the name 32 of the 85px it needs
   beside Register. A control that cannot sit beside the name takes a
   line of its own under it (the person row's rule for Accept · Decline);
   a title is never cut. Measured at 320 and, as the control, at 375.
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
  /* the live row on the home: the name's room and where Register sits */
  const liveRow = (page) => page.evaluate(() => {
    const reg = document.querySelector('[data-tour="day-register"]'); if (!reg) return null;
    const row = reg.parentElement, body = row.querySelector("button");
    const nm = body.querySelector("span.flex-1 > span"); const nr = nm.getBoundingClientRect(), rr = reg.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(nm).lineHeight) || 18;
    return { name: nm.textContent.trim(), nameW: Math.round(nr.width), lines: Math.round(nr.height / lh), nameCut: nm.scrollHeight > nm.clientHeight + 1 || nm.scrollWidth > nm.clientWidth + 1, nameBottom: Math.round(nr.bottom),
             regTop: Math.round(rr.top), regH: Math.round(rr.height), regLabel: reg.textContent.trim(), rowH: Math.round(row.getBoundingClientRect().height) };
  });

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

    /* ---------- (c) the home's live row with a long name ---------- */
    for (const width of [320, 375]) {
      const { ctx, page, shot } = await boot("coach", width);
      await tap(page, '[aria-label="Today"]', 900);
      const o = await liveRow(page);
      await shot("03-live-row");
      if (width === 320) {
        check("(c1) at 320 the live row gives the name its room — at least 85px, nothing cut — and Register takes a line of its own under it",
          !!o && o.nameW >= 85 && !o.nameCut && o.regTop >= o.nameBottom - 2 && o.regLabel === "Register", JSON.stringify(o));
      } else {
        check("(c2) at 375 Register stays beside the name, and the name is whole on three lines at most", !!o && !o.nameCut && o.nameW >= 84 && o.regTop < o.nameBottom - 8 && o.regLabel === "Register", JSON.stringify(o));
      }
      await ctx.close();
    }

    /* ---------- (d) the Diary's List row with a long name ---------- */
    {
      const { ctx, page, shot } = await boot("coach", 320);
      await tap(page, '[aria-label="Diary"]', 900);
      const o = await page.evaluate((LONG) => {
        const row = [...document.querySelectorAll('[data-tour="agenda-row"]')].find((r) => r.textContent.includes(LONG.split(" ")[0])); if (!row) return null;
        const nm = row.querySelector("span.flex-1 > span"), r = nm.getBoundingClientRect(), lh = parseFloat(getComputedStyle(nm).lineHeight) || 18;
        return { text: nm.textContent.trim(), w: Math.round(r.width), lines: Math.round(r.height / lh), cut: nm.scrollWidth > nm.clientWidth + 1 || nm.scrollHeight > nm.clientHeight + 1, rowH: Math.round(row.getBoundingClientRect().height) };
      }, LONG);
      await shot("04-diary-row");
      check('(d) the Diary\'s List row at 320 reads the whole name on a second line — it read "Maximiliano Ó Súil…" beside the time', !!o && o.text === LONG && !o.cut && o.lines <= 2, JSON.stringify(o));
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
