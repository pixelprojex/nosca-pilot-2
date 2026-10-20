/* A CHAT THREAD DRAWN IN RUNS.

   Consecutive lines from one person within five minutes of the first
   of them are one run: they sit close, the time is under the last one
   only, and the tail (the small corner on the sender's side) is on the
   last bubble only. A run is one PERSON, never one side: in a child's
   thread the coach and two adults can all be "not me", and a run keyed
   on the side would fold a parent's line under the coach's tail. A
   parent's label stays on every bubble of a parent's run. Seen stays
   under the last line of mine. A day divider ends a run. A line that
   carries a clip sits inside a run like any other. The coach's
   broadcast lines are the coach's lines. The harness thread runs too.

   Everything is measured off what is drawn — the bubbles found by their
   words, the times by their shape, the gaps and the corners by the
   layout — so nothing here depends on how the markup is nested.

   Usage: node thread-runs.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4471), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = {
  coach:  "00000000-0000-4000-8000-00000000c0ac",
  adult:  "00000000-0000-4000-8000-0000000adu17",
  parent: "00000000-0000-4000-8000-000000pa4e07",
  dad:    "00000000-0000-4000-8000-000000da4d07",
  junior: "00000000-0000-4000-8000-00000000c41d",
};
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const CLIP = "1e000000-0000-4000-8000-00000000c1a2";
/* Ireland's clock, so 09:00Z is 10:00 am and 23:01Z is past midnight */
const Z = (hm, day = "02") => `2026-10-${day}T${hm}:00Z`;
const READ = "2026-10-04T08:00:00Z";

/* Saoirse's thread, in the order it was written */
const J = [
  ["a1", "coach",  Z("09:00"),    "Saoirse hit the ball beautifully today."],
  ["a2", "coach",  Z("09:02"),    "Her grip is much better."],
  ["a3", "coach",  "2026-10-02T09:04:30Z", "Same time next week?"],
  ["a4", "parent", Z("09:10"),    "Thanks Niamh."],
  ["a5", "parent", Z("09:11"),    "Can she come Friday instead?"],
  ["a6", "dad",    Z("09:12"),    "Friday suits me too."],
  /* to Orla, Dara and the coach are both "not me", two minutes apart */
  ["a6b", "coach", Z("09:14"),    "Lovely, Friday it is."],
  ["a7", "coach",  Z("09:30"),    "Friday at four, then."],
  ["a8", "coach",  Z("09:36"),    "Bring the seven iron."],
  ["a9", "coach",  Z("10:00"),    "Line one of four."],
  ["a10", "coach", Z("10:03"),    "Line two of four."],
  ["a11", "coach", Z("10:06"),    "Line three of four."],
  ["a12", "coach", Z("10:09"),    "Line four of four."],
  ["a13", "coach", Z("22:58"),    "Course is closed in the morning."],
  ["a14", "coach", Z("23:01"),    "Afternoon is fine."],
  ["b1", "parent", Z("14:00", "03"), "Sent a clip"],
  ["b2", "parent", Z("14:01", "03"), "It's her putting."],
];
const TXT = Object.fromEntries(J.map(([k, , , body]) => [k, body]));

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach",  "coach@t.ie",  { role: "coach",  name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult",  "adult@t.ie",  { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly",  type: "parent", familyId: FAM });
  person("dad",    "dad@t.ie",    { role: "player", name: "Dara Kelly",  type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.addLesson(db, { id: CLIP, coachId: IDS.coach, playerId: IDS.junior, date: "2026-10-03", focus: "Putting", sentBy: IDS.parent, unread: false, createdAt: Z("14:00", "03") });
  M.addMedia(db, { lessonId: CLIP, kind: "video", path: `${IDS.parent}/${CLIP}/putt.mp4`, createdAt: Z("14:00", "03") });
  J.forEach(([k, who, at, body]) => M.addMessage(db, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS[who], body, createdAt: at, readAt: READ, lessonId: k === "b1" ? CLIP : null }));
  /* Cian's own thread, old; the broadcasts land under it today */
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "See you Tuesday.", createdAt: Z("09:00"), readAt: READ });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.adult, body: "Grand.", createdAt: Z("09:20"), readAt: READ });
  return db;
}

const { check, results, summary } = M.checker("thread-runs");
const TIME = /^\d{1,2}:\d{2}( [ap]m)?( · Seen)?$/;

/* Every bubble the thread draws, found by its words, and every time
   line, found by its shape; positions in the feed's own coordinates. */
const layout = (page, texts) => page.evaluate(({ texts, timeSrc }) => {
  const TIME = new RegExp(timeSrc);
  const root = document.getElementById("root");
  const ps = [...root.querySelectorAll("p")];
  const bubbles = {};
  for (const [k, txt] of Object.entries(texts)) {
    const p = ps.find((x) => x.textContent.trim() === txt);
    if (!p) { bubbles[k] = null; continue; }
    const b = p.parentElement, r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    const label = [...b.children].filter((c) => c !== p && c.tagName === "SPAN").map((c) => c.textContent.trim()).join(" ");
    bubbles[k] = { top: r.top, bottom: r.bottom, left: r.left, right: r.right, bl: parseFloat(cs.borderBottomLeftRadius), br: parseFloat(cs.borderBottomRightRadius), label, card: !!b.querySelector('[data-tour="thread-clip-card"]') };
  }
  const times = [...root.querySelectorAll("span")].filter((s) => !s.children.length && TIME.test(s.textContent.trim()))
    .map((s) => { const r = s.getBoundingClientRect(); return { text: s.textContent.trim(), top: r.top, bottom: r.bottom, seen: s.getAttribute("data-tour") === "msg-seen" }; });
  const dividers = [...root.querySelectorAll("p")].filter((p) => p.classList.contains("text-center")).map((p) => { const r = p.getBoundingClientRect(); return { text: p.textContent.trim(), top: r.top }; });
  return { bubbles, times, dividers };
}, { texts, timeSrc: TIME.source });

/* the time line drawn under bubble k: between its foot and the next bubble */
const timeUnder = (L, order, k) => {
  const i = order.indexOf(k), b = L.bubbles[k]; if (!b) return null;
  const nextTop = order.slice(i + 1).map((x) => L.bubbles[x]).filter(Boolean).map((x) => x.top)[0] ?? Infinity;
  return L.times.find((tm) => tm.top >= b.bottom - 1 && tm.top < nextTop) || null;
};
const gap = (L, a, b) => (L.bubbles[a] && L.bubbles[b] ? Math.round(L.bubbles[b].top - L.bubbles[a].bottom) : null);
const fmt = (o) => JSON.stringify(o);

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
  const db = freshDb();
  const errors = [];
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: "Europe/Dublin" });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    return { ctx, page, text: () => M.rootText(page), shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`), fullPage: true }) };
  };
  /* the thread's scroll box grows to its content, so every bubble is measured in one frame */
  const unclip = (page) => page.evaluate(() => { const b = document.querySelector(".overflow-y-auto.px-4"); if (b) { b.style.overflow = "visible"; b.style.flex = "none"; let p = b.parentElement; while (p && p !== document.body) { p.style.height = "auto"; p.style.overflow = "visible"; p = p.parentElement; } } });
  const order = J.map(([k]) => k);

  try {
    /* ---------- (a) the coach reads Saoirse's thread ---------- */
    {
      const { ctx, page, shot } = await boot("coach");
      await M.tap(page, '[aria-label="Chat"]', 1000);
      await M.click(page, "Saoirse Kelly", 1500);
      await page.waitForSelector('[data-tour="thread-clip-card"]', { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(600);
      await shot("01-coach-thread");
      await page.evaluate(() => { const b = document.querySelector(".overflow-y-auto.px-4"); if (b) b.scrollTop = 0; }); await page.waitForTimeout(200); await shot("01b-coach-thread-top");
      await unclip(page); await page.waitForTimeout(200);
      const L = await layout(page, TXT);
      check("(a0) every line of the thread is drawn", order.every((k) => L.bubbles[k]), order.filter((k) => !L.bubbles[k]).join(","));
      /* one time per run: [a1-a3] [a4-a5] [a6] [a6b] [a7] [a8] [a9-a10] [a11-a12] [a13] [a14] [b1-b2] */
      check("(a1) one time per run — eleven runs, eleven times, for seventeen lines", L.times.length === 11, `${L.times.length} times: ${L.times.map((x) => x.text).join(" | ")}`);
      check("(a2) the coach's run of three carries one time, under the last, its own (10:04 am)", !timeUnder(L, order, "a1") && !timeUnder(L, order, "a2") && (timeUnder(L, order, "a3") || {}).text === "10:04 am", fmt([timeUnder(L, order, "a1"), timeUnder(L, order, "a2"), timeUnder(L, order, "a3")]));
      check("(a3) inside a run the bubbles sit close (6px, the scale's knit)", [gap(L, "a1", "a2"), gap(L, "a2", "a3"), gap(L, "a4", "a5")].every((g) => g != null && g <= 8), fmt([gap(L, "a1", "a2"), gap(L, "a2", "a3"), gap(L, "a4", "a5")]));
      check("(a4) between runs the old air stays (a time and its margin)", [gap(L, "a3", "a4"), gap(L, "a7", "a8"), gap(L, "a5", "a6")].every((g) => g != null && g >= 24), fmt([gap(L, "a3", "a4"), gap(L, "a7", "a8"), gap(L, "a5", "a6")]));
      /* the coach's own lines are on the right: the tail is the bottom-right corner */
      check("(a5) the tail is on the last bubble of the coach's run only", L.bubbles.a1.br > 8 && L.bubbles.a2.br > 8 && L.bubbles.a3.br === 8, fmt(["a1", "a2", "a3"].map((k) => L.bubbles[k].br)));
      /* the parent's lines are on the left: the tail is the bottom-left corner */
      check("(a6) …and on the last bubble of a parent's run only", L.bubbles.a4.bl > 8 && L.bubbles.a5.bl === 8, fmt(["a4", "a5"].map((k) => L.bubbles[k].bl)));
      check("(a7) the parent's label stays on every bubble of the parent's run", /parent/i.test(L.bubbles.a4.label) && /parent/i.test(L.bubbles.a5.label), fmt([L.bubbles.a4.label, L.bubbles.a5.label]));
      /* the coach reads a junior's guardians (my_players_guardian_ids), and Chat's list already names her */
      check("(a7b) …and it names her — Orla · parent on both, Dara · parent on his — as the coach's Chat list does", L.bubbles.a4.label === "Orla · parent" && L.bubbles.a5.label === "Orla · parent" && L.bubbles.a6.label === "Dara · parent", fmt([L.bubbles.a4.label, L.bubbles.a5.label, L.bubbles.a6.label]));
      /* two adults are one side to the coach, and two people: the run is the person */
      check("(a8) another adult straight after is a run of their own — labelled, timed, tailed", /parent/i.test(L.bubbles.a6.label) && !!timeUnder(L, order, "a5") && !!timeUnder(L, order, "a6") && L.bubbles.a5.bl === 8 && L.bubbles.a6.bl === 8, fmt({ a5: timeUnder(L, order, "a5"), a6: timeUnder(L, order, "a6"), bl: [L.bubbles.a5.bl, L.bubbles.a6.bl] }));
      check("(a9) six minutes apart is two runs, each with its own time", (timeUnder(L, order, "a7") || {}).text === "10:30 am" && (timeUnder(L, order, "a8") || {}).text === "10:36 am", fmt([timeUnder(L, order, "a7"), timeUnder(L, order, "a8")]));
      /* a run is five minutes from its FIRST line, so the time under it is never more than five minutes off any line in it */
      check("(a10) lines three minutes apart for nine minutes are two runs, not one: 11:03 am and 11:09 am", !timeUnder(L, order, "a9") && (timeUnder(L, order, "a10") || {}).text === "11:03 am" && !timeUnder(L, order, "a11") && (timeUnder(L, order, "a12") || {}).text === "11:09 am", fmt(["a9", "a10", "a11", "a12"].map((k) => timeUnder(L, order, k))));
      const div = L.dividers.find((d) => /Sat 3 Oct/.test(d.text));
      check("(a11) a day divider ends a run: 11:58 pm and 12:01 am three minutes apart are two runs with the day between", !!div && (timeUnder(L, order, "a13") || {}).text === "11:58 pm" && /^12:01 am/.test((timeUnder(L, order, "a14") || {}).text || "") && L.bubbles.a13.br === 8 && div.top > L.bubbles.a13.bottom && div.top < L.bubbles.a14.top, fmt({ div, a13: timeUnder(L, order, "a13"), a14: timeUnder(L, order, "a14") }));
      check("(a12) a line that carries a clip sits inside the run: its card in the bubble, no time under it, no tail", L.bubbles.b1.card && !timeUnder(L, order, "b1") && L.bubbles.b1.bl > 8 && gap(L, "b1", "b2") <= 8 && (timeUnder(L, order, "b2") || {}).text === "3:01 pm" && /parent/i.test(L.bubbles.b1.label) && /parent/i.test(L.bubbles.b2.label), fmt({ b1: L.bubbles.b1, under: timeUnder(L, order, "b1"), gap: gap(L, "b1", "b2"), b2: timeUnder(L, order, "b2") }));
      check("(a13) Seen is under the coach's own last line (12:01 am · Seen), once", L.times.filter((x) => x.seen).length === 1 && (timeUnder(L, order, "a14") || {}).text === "12:01 am · Seen", fmt(L.times.filter((x) => x.seen)));
      await ctx.close();
    }

    /* ---------- (b) Orla reads the same thread ---------- */
    {
      const { ctx, page, shot } = await boot("parent");
      await M.tap(page, '[aria-label="Chat"]', 1000);
      await page.locator('[data-tour="chat-row"]').first().dispatchEvent("click"); await page.waitForTimeout(1500);
      await page.waitForSelector('[data-tour="thread-clip-card"]', { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(600);
      await shot("02-parent-thread");
      await page.evaluate(() => { const b = document.querySelector(".overflow-y-auto.px-4"); if (b) b.scrollTop = 0; }); await page.waitForTimeout(200); await shot("02b-parent-thread-top");
      await unclip(page); await page.waitForTimeout(200);
      const L = await layout(page, TXT);
      check("(b1) to the parent the coach's run of three is one run too: on the left, one time, the tail last", !timeUnder(L, order, "a1") && !timeUnder(L, order, "a2") && !!timeUnder(L, order, "a3") && L.bubbles.a1.bl > 8 && L.bubbles.a2.bl > 8 && L.bubbles.a3.bl === 8, fmt({ bl: ["a1", "a2", "a3"].map((k) => L.bubbles[k].bl), under: ["a1", "a2", "a3"].map((k) => timeUnder(L, order, k)) }));
      check("(b2) her own run is on the right, close, the tail last", gap(L, "a4", "a5") <= 8 && L.bubbles.a4.br > 8 && L.bubbles.a5.br === 8 && !timeUnder(L, order, "a4"), fmt({ gap: gap(L, "a4", "a5"), br: [L.bubbles.a4.br, L.bubbles.a5.br] }));
      /* Dara is "not me" to Orla, like the coach — he is not the coach */
      check("(b3) the other adult's line is his own run with his name on it — never folded under the coach's line two minutes later, though both are \"not me\"", /Dara/.test(L.bubbles.a6.label) && (timeUnder(L, order, "a6") || {}).text === "10:12 am" && L.bubbles.a6.bl === 8 && (timeUnder(L, order, "a6b") || {}).text === "10:14 am" && !L.bubbles.a6b.label, fmt({ label: L.bubbles.a6.label, under: timeUnder(L, order, "a6"), a6b: timeUnder(L, order, "a6b"), bl: L.bubbles.a6.bl }));
      check("(b4) Seen sits under the last line of hers, the clip's run, and the clip line above it carries no time", L.times.filter((x) => x.seen).length === 1 && (timeUnder(L, order, "b2") || {}).text === "3:01 pm · Seen" && !timeUnder(L, order, "b1"), fmt({ seen: L.times.filter((x) => x.seen), b1: timeUnder(L, order, "b1") }));
      check("(b5) one time per run here too", L.times.length === 11, `${L.times.length}: ${L.times.map((x) => x.text).join(" | ")}`);
      /* typing is not a reason to draw the thread again from nothing:
         the clip's poster is the same element before and after a key */
      const v0 = await page.locator('[data-tour="thread-clip-card"]').first().elementHandle();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByPlaceholder("Message").first().type("ok", { delay: 30 }); await page.waitForTimeout(300);
      const kept = v0 ? await v0.evaluate((el) => el.isConnected) : false;
      check("(b6) typing in the composer keeps every bubble mounted — the clip card is the same element", kept, `connected=${kept}`);
      await ctx.close();
    }

    /* ---------- (c) two broadcasts in a row are one run in each thread ---------- */
    {
      const { ctx, page } = await boot("coach");
      for (const words of ["Range is closed Saturday.", "Back on Sunday."]) {
        await M.tap(page, '[aria-label="Chat"]', 900);
        await M.tap(page, '[data-tour="chat-new"]', 900);
        await M.click(page, "Everyone", 1000);
        const field = page.getByPlaceholder("Message").first();
        const composer = (await field.count()) ? field : page.locator("textarea, input[type=text]").first();
        await composer.fill(words);
        await M.click(page, "Send", 1600);
      }
      const made = db.messages.filter((m) => /Range is closed Saturday\.|Back on Sunday\./.test(m.body));
      check("(c0) the two broadcasts reached both threads", made.length === 4, String(made.length));
      await ctx.close();
      const a = await boot("adult");
      await M.tap(a.page, '[aria-label="Chat"]', 1000); await M.click(a.page, "Niamh Byrne", 1500);
      await a.shot("03-adult-broadcasts"); await unclip(a.page); await a.page.waitForTimeout(200);
      const T2 = { c1: "See you Tuesday.", c2: "Grand.", d1: "Range is closed Saturday.", d2: "Back on Sunday." };
      const L = await layout(a.page, T2); const o2 = ["c1", "c2", "d1", "d2"];
      check("(c1) the coach's two broadcast lines read as one run in Cian's thread: close, one time, the tail last", !timeUnder(L, o2, "d1") && !!timeUnder(L, o2, "d2") && gap(L, "d1", "d2") <= 8 && L.bubbles.d1.bl > 8 && L.bubbles.d2.bl === 8, fmt({ gap: gap(L, "d1", "d2"), d1: timeUnder(L, o2, "d1"), bl: [L.bubbles.d1 && L.bubbles.d1.bl, L.bubbles.d2 && L.bubbles.d2.bl] }));
      check("(c2) …under a day divider of their own, apart from Cian's old line", !!timeUnder(L, o2, "c2") && L.dividers.length === 2, fmt(L.dividers));
      await a.ctx.close();
    }

    /* ---------- (d) the harness thread ---------- */
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: "Europe/Dublin" });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(`harness: ${String(e.message || e)}`));
      await page.goto(`${BASE}/?demo`, { waitUntil: "load" });
      await page.waitForSelector("text=Scenarios", { timeout: 15000 });
      /* the harness's Coach persona: seeded threads, no account */
      await page.getByRole("button", { name: "Coach", exact: true }).first().click(); await page.waitForTimeout(M.SPLASH_MS);
      await M.tap(page, '[aria-label="Chat"]', 1000);
      await M.click(page, "Priya Ellis", 1200);
      await page.screenshot({ path: path.join(outDir, "04-harness-thread.png") });
      const T3 = { m4: "Hi Ray — something's come up Wednesday afternoon.", m5: "Could we move Wednesday to six?" };
      const L = await layout(page, T3); const o3 = ["m4", "m5"];
      check("(d1) the harness's two lines from Priya three minutes apart are one run: one time, close, the tail last", !!L.bubbles.m4 && !timeUnder(L, o3, "m4") && !!timeUnder(L, o3, "m5") && gap(L, "m4", "m5") <= 8 && L.bubbles.m4.bl > 8 && L.bubbles.m5.bl === 8, fmt({ m4: L.bubbles.m4, gap: gap(L, "m4", "m5"), u4: timeUnder(L, o3, "m4"), u5: timeUnder(L, o3, "m5") }));
      await ctx.close();
    }
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    results.push({ name: "run completed", ok: false, detail: String(e && e.message || e) });
  } finally { await browser.close(); M.stopServer(server); }

  const real = errors.filter((e) => !/vibrate/.test(e));
  check("no page errors", real.length === 0, real.slice(0, 3).join(" | "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(out, null, 2));
  process.exit(0);
})();
