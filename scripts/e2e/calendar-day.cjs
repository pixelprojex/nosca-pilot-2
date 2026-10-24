/* THE DIARY'S CALENDAR VIEW, AND THE SHEETS IT OPENS, BOXED ON THE
   SPORT'S EDGE.

   The selected day and the three sheets that take a lesson away from
   somebody were the last of the Diary drawn the old way: a player's own
   lessons sat between hairlines with a 20px Cancel that ran into the time
   at 320; the coach's lessons were pale 16px accent cards and a clinic of
   an hour read the diary's 45 minutes there; the call-off row was a 0.5px
   rule with a rain glyph; the day's name was said twice; a span lost its
   am across noon ("11:00–12:00 pm"); and the reasons on Cancel, Call off
   and End sat on a 1.2:1 hairline, the chosen one a 1.09:1 tint, green on
   one sheet and red on two. This suite proves each is a box on the sport's
   edge with nothing inside on the hairline, the actions 44 tall and clear
   of the time at 320, the clinic 11:00 am–12:00 pm and an hour on both
   sides, the day heading said once in the List view's form, and the
   reasons boxed with the chosen one in ink — for the coach, a player
   cancelling their own, and a riding coach on equestrian's edge.
   Usage: node calendar-day.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4338), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", rider: "00000000-0000-4000-8000-00000000e9c0", tadhg: "00000000-0000-4000-8000-0000000ta0d6" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const REC = "c0000000-0000-4000-8000-00000000ca01";
const EDGE = { golf: "rgba(47, 107, 58, 0.72)", equestrian: "rgba(122, 59, 74, 0.72)" };
const HAIRLINE = "rgb(228, 236, 225)";
const GROUP = "rgb(110, 90, 147)";
const WEEK = ["9:00 am", "10:00 am", "11:00 am", "11:30 am", "4:00 pm", "5:00 pm"];
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("rider", "rider@t.ie", { role: "coach", name: "Róisín Daly", sport: "equestrian", inviteCode: "RD4K9P" });
  person("tadhg", "tadhg@t.ie", { role: "player", name: "Tadhg Ryan", type: "adult", sport: "equestrian", coachId: IDS.rider, dob: "1988-08-08" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]), groups: [
    { id: "g1", name: "Saturday clinic", members: ["Cian Murphy", "Saoirse Kelly"], memberIds: [IDS.adult, IDS.junior], sport: "golf" },
  ] });
  M.setPrefs(db, IDS.rider, { availability: M.weekOf(WEEK, [0, 1, 2, 3, 4, 5, 6]) });
  /* today: Cian at nine, the clinic at eleven for an hour (Cian and Saoirse in it), Cian again at four */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "9:00 am", duration: 45 });
  M.addBooking(db, { coachId: IDS.coach, groupName: "Saturday clinic", date: TODAY, time: "11:00 am", duration: 60 });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm", duration: 45 });
  M.addBooking(db, { coachId: IDS.rider, playerId: IDS.tadhg, date: TODAY, time: "10:00 am", duration: 45 });
  /* a weekly run for Saoirse, two lessons of it ahead, for End */
  M.addRecurring(db, { id: REC, coachId: IDS.coach, playerId: IDS.junior, weekday: (dayFrom(3).getDay() + 6) % 7, time: "5:00 pm", cadence: "weekly", createdAt: `${M.ymd(dayFrom(-20))}T09:00:00Z` });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(3)), time: "5:00 pm", duration: 45, recurringId: REC });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: M.ymd(dayFrom(10)), time: "5:00 pm", duration: 45, recurringId: REC });
  return db;
}

const { check, results, summary } = M.checker("calendar-day");
const lum = (c) => { const v = String(c).match(/[\d.]+/g); if (!v) return 1; const [r, g, b] = v.slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, { w = 390, h = 844 } = {}) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000); await M.attach(page, db);
    /* eight in the morning: every lesson today is still ahead */
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`));
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: true });
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, shot };
  };
  const { tap } = M;
  const calendar = async (page) => {
    await tap(page, '[aria-label="Diary"]', 1200);
    const on = page.locator('[data-tour="cal-view"] button[aria-pressed="true"]');
    if ((await on.count()) && (await on.getAttribute("aria-label")) !== "Calendar") await tap(page, '[data-tour="cal-view"] [aria-label="Calendar"]', 800);
  };
  /* the reasons on whichever sheet is open: every row of the list that holds `first` */
  const reasons = (page, tour) => page.evaluate((tour) => [...document.querySelectorAll(`[data-tour="${tour}"]`)].map((x) => {
    const s = getComputedStyle(x), w = x.querySelector("span") || x;
    return { t: x.textContent.trim(), border: s.borderTopColor, bw: parseFloat(s.borderTopWidth), radius: s.borderTopLeftRadius, bg: s.backgroundColor, fg: getComputedStyle(w).color, inList: !!(x.parentElement && x.parentElement.classList.contains("nsc-list")) };
  }), tour);
  const reasonChecks = async (page, id, tour, pick, edge) => {
    const rs = await reasons(page, tour);
    check(`(${id}) the reasons are boxes of one list on the sport's edge, 8px corners — never the hairline`,
          rs.length >= 3 && rs.every((r) => r.inList && r.border === edge && r.bw >= 1 && r.radius === "8px"), JSON.stringify(rs.slice(0, 3)));
    await page.locator(`[data-tour="${tour}"]`, { hasText: new RegExp(`^${pick}$`) }).first().click(); await page.waitForTimeout(500);
    const on = (await reasons(page, tour)).find((r) => r.t === pick);
    check(`(${id}) …and the chosen one is ink with white words, not a 6% tint`, !!on && lum(on.bg) < 0.03 && lum(on.fg) > 0.8, JSON.stringify(on));
  };

  try {
    /* ---------- the coach: the day, the blocks, the call-off row, the sheets ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "coach");
      await calendar(page); await shot("01-coach-day");
      const head = await page.evaluate(() => { const d = document.querySelector("[data-cal-day]"); if (!d) return null; const s = d.querySelector("span"); return { head: s.textContent.trim(), all: d.innerText }; });
      check("(c7) the selected day's heading is the List view's form, said once — never a long date with an eyebrow repeating it",
            !!head && /^(Today|Tomorrow|\w{3} \d{1,2} \w{3})$/.test(head.head) && !/Today's schedule/.test(head.all) && (head.all.match(/\bToday\b/g) || []).length === 1, JSON.stringify(head && { head: head.head, all: head.all.slice(0, 160) }));
      const blocks = await page.evaluate(() => [...document.querySelectorAll('[data-tour="cal-block"]')].map((b) => {
        const s = getComputedStyle(b);
        const bar = [...b.querySelectorAll("span")].find((x) => getComputedStyle(x).width === "3px");
        return { t: b.innerText.replace(/\s+/g, " ").slice(0, 80), border: s.borderTopColor, bw: parseFloat(s.borderTopWidth), radius: s.borderTopLeftRadius, bar: bar ? getComputedStyle(bar).backgroundColor : null };
      }));
      check("(c5) each of the coach's lessons is a box on the sport's edge at 8px — not a pale 16px accent card", blocks.length === 3 && blocks.every((b) => b.border === EDGE.golf && b.bw >= 1 && b.radius === "8px"), JSON.stringify(blocks));
      const clinic = blocks.find((b) => /Saturday clinic/.test(b.t));
      check("(c5) …a group keeps the List view's 3px bar in its own colour", !!clinic && clinic.bar === GROUP, JSON.stringify(clinic));
      check("(c3) the coach reads the clinic at its own hour, 11:00 am–12:00 pm — not the diary's 45 minutes, not an am stripped across noon", !!clinic && /11:00 am–12:00 pm/.test(clinic.t), JSON.stringify(clinic));
      check("(c4) a span inside one half of the day stays short: 4:00–4:45 pm", blocks.some((b) => /4:00–4:45 pm/.test(b.t)), JSON.stringify(blocks.map((b) => b.t)));
      await page.locator('[data-tour="cal-block"]', { hasText: "Saturday clinic" }).locator("button").first().click(); await page.waitForTimeout(700);
      const opened = await page.evaluate((hair) => {
        const b = [...document.querySelectorAll('[data-tour="cal-block"]')].find((x) => /Saturday clinic/.test(x.innerText)); if (!b) return null;
        const onHair = [...b.querySelectorAll("*")].filter((el) => { const s = getComputedStyle(el); return ["Top", "Bottom", "Left", "Right"].some((k) => parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== "none" && s[`border${k}Color`] === hair); }).length;
        return { len: (b.innerText.match(/(\d+)m\b/) || [])[1] || null, onHair };
      }, HAIRLINE);
      await shot("02-coach-block-open");
      check("(c3) …and opened, its Length reads 60m", !!opened && opened.len === "60", JSON.stringify(opened));
      check("(c5) …with nothing inside it on the hairline", !!opened && opened.onHair === 0, JSON.stringify(opened));
      const weather = await page.evaluate(() => { const b = document.querySelector('[data-tour="cal-weather"]'); if (!b) return null; const s = getComputedStyle(b); const svg = b.querySelector("svg"); return { border: s.borderTopColor, bw: parseFloat(s.borderTopWidth), radius: s.borderTopLeftRadius, cls: svg ? svg.getAttribute("class") : "" }; });
      check("(c6) the call-off row is on the sport's edge at 8px, with the calendar-and-X glyph — never the rain", !!weather && weather.border === EDGE.golf && weather.bw >= 1 && weather.radius === "8px" && /calendar-x/.test(weather.cls) && !/cloud-rain/.test(weather.cls), JSON.stringify(weather));
      /* (w2) Call off, from that row */
      await tap(page, '[data-tour="cal-weather"]', 1000);
      await reasonChecks(page, "w2", "calloff-why", "Weather", EDGE.golf); await shot("03-calloff-why");
      await page.keyboard.press("Escape").catch(() => {}); await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600);
      /* (w1) Cancel, from the peek on Today */
      await tap(page, '[aria-label="Today"]', 1000);
      await page.locator('[data-scroll="screen"] button', { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      await page.locator("[data-sheet] button", { hasText: /^Cancel$/ }).first().click(); await page.waitForTimeout(900);
      await reasonChecks(page, "w1", "cancel-why", "Unwell", EDGE.golf); await shot("04-cancel-why");
      await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 }, timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600);
      /* (w3) End, from the Recurring manager */
      await tap(page, '[aria-label="Diary"]', 1000);
      const list = page.locator('[data-tour="cal-view"] [aria-label="List"]'); if (await list.count()) await tap(page, '[data-tour="cal-view"] [aria-label="List"]', 700);
      if (await page.locator('[data-tour="cal-recurring"]').count()) await tap(page, '[data-tour="cal-recurring"]', 1000);
      await page.locator('[data-tour="recur-end"]').first().click(); await page.waitForTimeout(1500);
      await reasonChecks(page, "w3", "end-why", "Unwell", EDGE.golf); await shot("05-end-why");
      await ctx.close();
    }
    /* ---------- Cian, a player: his own lessons and the clinic ---------- */
    for (const [w, h] of [[390, 844], [320, 640]]) {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "adult", { w, h });
      await calendar(page); await shot(`06-player-day-${w}`);
      const mine = await page.evaluate((hair) => [...document.querySelectorAll('[data-tour="day-mine"]')].map((b) => {
        const s = getComputedStyle(b);
        const r = (el) => el && el.getBoundingClientRect();
        const time = [...b.querySelectorAll("span")].find((x) => /\d:\d\d/.test(x.textContent) && /–/.test(x.textContent));
        const len = [...b.querySelectorAll("div")].find((x) => / min with /.test(x.textContent) && !x.querySelector("div"));
        const cancel = b.querySelector('[data-tour="day-cancel"]'), resched = b.querySelector('[data-tour="day-reschedule"]');
        const hit = (a, c) => !!(a && c) && !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top);
        const onHair = [...b.querySelectorAll("*")].filter((el) => { const st = getComputedStyle(el); return ["Top", "Bottom", "Left", "Right"].some((k) => parseFloat(st[`border${k}Width`]) > 0 && st[`border${k}Style`] !== "none" && st[`border${k}Color`] === hair); }).length;
        return { time: time ? time.textContent.trim() : null, inList: b.parentElement.classList.contains("nsc-list"), border: [s.borderTopColor, s.borderBottomColor, s.borderLeftColor, s.borderRightColor], onHair,
                 cancelH: cancel ? Math.round(r(cancel).height) : null, reschedH: resched ? Math.round(r(resched).height) : null,
                 clear: cancel ? !hit(r(cancel), r(time)) && !hit(r(resched), r(time)) : null, below: cancel && len ? r(cancel).top >= r(len).bottom - 1 : null, text: b.innerText.replace(/\s+/g, " ") };
      }), HAIRLINE);
      if (w === 390) {
        check("(c1) every lesson of the player's day is its own box of one list, on the sport's edge all round, nothing inside on the hairline",
              mine.length === 3 && mine.every((m) => m.inList && m.border.every((c) => c === EDGE.golf) && m.onHair === 0), JSON.stringify(mine.map((m) => ({ t: m.time, inList: m.inList, border: m.border[2], onHair: m.onHair }))));
        const clinic = mine.find((m) => /Saturday clinic/.test(m.text));
        check("(c3) the member reads the clinic as the coach does: 11:00 am–12:00 pm, an hour", !!clinic && clinic.time === "11:00 am–12:00 pm" && /60 min with/.test(clinic.text), JSON.stringify(clinic));
        const free = await page.evaluate(() => [...document.querySelectorAll("[data-cal-day] .nsc-day button, [data-cal-day] .nsc-day span")].map((x) => x.textContent.trim()).filter((x) => /–/.test(x)));
        check("(c4) a free time across noon keeps its am: 11:30 am–12:15 pm", free.includes("11:30 am–12:15 pm"), JSON.stringify(free.slice(0, 6)));
      }
      const own = mine.filter((m) => m.cancelH != null);
      check(`(c2) at ${w}, Cancel and Reschedule are 44 tall, clear of the time and under the length line`,
            own.length === 2 && own.every((m) => m.cancelH >= 44 && m.reschedH >= 44 && m.clear && m.below), JSON.stringify(own.map((m) => ({ t: m.time, c: m.cancelH, r: m.reschedH, clear: m.clear, below: m.below }))));
      if (w === 320) {
        const hd = await page.evaluate(() => { const d = document.querySelector("[data-cal-day]"); const row = d && d.firstElementChild; return row ? { h: Math.round(row.getBoundingClientRect().height), kids: [...row.children].map((c) => Math.round(c.getBoundingClientRect().height)) } : null; });
        check("(c7) at 320 the day's heading and its count sit on one line", !!hd && hd.h < 40 && hd.kids.every((x) => x < 40), JSON.stringify(hd));
      }
      if (w === 390) {
        /* (w4) his own Cancel opens the same boxed reasons, the player's own */
        await page.locator('[data-tour="day-mine"]', { hasText: "4:00" }).locator('[data-tour="day-cancel"]').click(); await page.waitForTimeout(900);
        await reasonChecks(page, "w4", "cancel-why", "Unwell", EDGE.golf); await shot("07-player-cancel-why");
      }
      await ctx.close();
    }
    /* ---------- a riding coach: equestrian's own edge on the reasons ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "rider");
      await tap(page, '[data-tour="quick"]', 900);
      await page.locator("[data-sheet] button", { hasText: /Call off/ }).first().click(); await page.waitForTimeout(900);
      await reasonChecks(page, "w5", "calloff-why", "Weather", EDGE.equestrian); await shot("08-rider-calloff-why");
      await ctx.close();
    }
    check("no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
