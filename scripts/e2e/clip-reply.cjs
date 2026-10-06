/* A SENT CLIP IS ANSWERED. The coach's reply in words on a clip a player
   sent: Reply is the one action on the coach's page for it, the line lands
   in the thread tied to the clip (drawn with the clip's poster) and on both
   lesson pages under the player's question, and the player is told
   "<Coach> replied" and lands on the clip. Until the coach's words or their
   take land, the player's page reads "Waiting on <Coach>". A parent's child
   is answered the same way: the adult told on the thread, the junior on the
   clip. A logged lesson's page is unchanged.
   Usage: node clip-reply.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const CLIP = { a: "1e000000-0000-4000-8000-00000000c1a0", t: "1e000000-0000-4000-8000-00000000c1a1", k: "1e000000-0000-4000-8000-00000000c1a2", l: "1e000000-0000-4000-8000-00000000c1a3" };
const WORDS = "Weight is fine, hands ahead at impact";
const WORDS_K = "Toss a touch further forward";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  const today = M.ymd(new Date(db.now()));
  const ago = (h) => new Date(db.now() - h * 3600000).toISOString();
  /* Cian's clip, waiting: his own file, his own line in the thread */
  M.addLesson(db, { id: CLIP.a, coachId: IDS.coach, playerId: IDS.adult, date: today, focus: "Chipping", notes: "Is my weight too far back?", sentBy: IDS.adult, createdAt: ago(3) });
  M.addMedia(db, { lessonId: CLIP.a, kind: "video", path: `${IDS.adult}/${CLIP.a}/swing.mp4`, createdAt: ago(3) });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "Send me a swing when you get a chance.", createdAt: ago(30) });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.adult, body: "Sent a clip", lessonId: CLIP.a, createdAt: ago(3) });
  /* Cian's other clip, already answered with a take under the coach's folder */
  M.addLesson(db, { id: CLIP.t, coachId: IDS.coach, playerId: IDS.adult, date: today, focus: "Driving", sentBy: IDS.adult, unread: false, createdAt: ago(2) });
  M.addMedia(db, { lessonId: CLIP.t, kind: "video", path: `${IDS.adult}/${CLIP.t}/drive.mp4`, createdAt: ago(2) });
  M.addMedia(db, { lessonId: CLIP.t, kind: "video", path: `${IDS.coach}/${CLIP.t}/markup-1.webm`, createdAt: ago(1) });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.adult, body: "Sent a clip", lessonId: CLIP.t, createdAt: ago(2) });
  /* Saoirse's clip, sent by her mother */
  M.addLesson(db, { id: CLIP.k, coachId: IDS.coach, playerId: IDS.junior, date: today, focus: "Putting", sentBy: IDS.parent, createdAt: ago(2) });
  M.addMedia(db, { lessonId: CLIP.k, kind: "video", path: `${IDS.parent}/${CLIP.k}/putt.mp4`, createdAt: ago(2) });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.coach, body: "Well done today.", createdAt: ago(40) });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.junior, senderId: IDS.parent, body: "Sent a clip", lessonId: CLIP.k, createdAt: ago(2) });
  /* and a lesson the coach logged, which must read as it always did */
  M.addLesson(db, { id: CLIP.l, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-28", focus: "Bunker play", notes: "Open the face more." });
  return db;
}

const { check, results, summary } = M.checker("clip-reply");
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 300)); } return !!(await fn()); };

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
  const db = freshDb();
  const errors = [];
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const cards = (page) => page.locator('[data-tour="thread-clip-card"]');
  const standing = (page) => page.locator('[data-tour="clip-standing"]');
  const replyBlock = (page) => page.locator('[data-tour="lesson-reply"]');
  /* the coach writes back from the clip's page */
  const replyWith = async (page, words) => {
    await tap(page, '[data-tour="clip-reply"]', 900);
    const sheet = (await page.locator('[data-tour="clip-reply-sheet"]').count()) === 1;
    const t = await M.rootText(page);
    const sendBtn = page.locator('[data-tour="clip-reply-send"]');
    const emptyDisabled = (await sendBtn.count()) === 1 && (await sendBtn.isDisabled());
    await page.locator("textarea").last().fill(words);
    const filledEnabled = !(await sendBtn.isDisabled());
    await sendBtn.click(); await page.waitForTimeout(1500);
    return { sheet, t, emptyDisabled, filledEnabled };
  };

  try {
    /* ---------- the player, before any answer ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Chat"]', 900);
      await page.locator("button", { hasText: "Niamh Byrne" }).first().click(); await page.waitForTimeout(1200);
      await until(async () => (await page.locator('[data-tour="thread-clip-card"] video').count()) >= 1, 6000);
      check("(a) the two Sent a clip lines in the thread are drawn as cards with the clip's poster", (await cards(page).count()) === 2 && (await page.locator('[data-tour="thread-clip-card"] video').count()) >= 1, `cards=${await cards(page).count()} video=${await page.locator('[data-tour="thread-clip-card"] video').count()}`);
      await shot("01-player-thread");
      await cards(page).first().click(); await page.waitForTimeout(1500);
      await until(async () => (await standing(page).count()) === 1, 5000);
      const t1 = await text();
      check("(b) the clip the coach has not answered reads Waiting on Niamh, under Sent to Niamh Byrne", /Chipping/.test(t1) && /Sent to Niamh Byrne/.test(t1) && (await standing(page).count()) === 1 && /Waiting on Niamh/.test(t1), t1.slice(0, 220));
      check("(b2) …and carries no reply yet", (await replyBlock(page).count()) === 0, "");
      await shot("02-player-waiting");
      await tap(page, '[aria-label="Back"]', 900);
      await cards(page).nth(1).click(); await page.waitForTimeout(1800);
      const t2 = await text();
      check("(c) the clip the coach already marked up (a take under the coach's folder) says nothing about waiting", /Driving/.test(t2) && (await standing(page).count()) === 0, t2.slice(0, 200));
      await ctx.close();
    }

    /* ---------- the coach ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await tap(page, '[data-tour="today-review"]', 1200);
      await page.locator("[data-clip-row]").filter({ hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1500);
      const t3 = await text();
      const replyBtn = page.locator('[data-tour="clip-reply"]');
      check("(d) the sent clip's page offers Reply as the one action, with Set drills and Message beside it and no Log", /Sent by Cian Murphy/.test(t3) && (await replyBtn.count()) === 1 && /Reply/.test(await replyBtn.innerText()) && /Set drills/.test(t3) && /Message/.test(t3) && (await page.getByRole("button", { name: "Log", exact: true }).count()) === 0, t3.slice(-260));
      await shot("03-coach-clip");
      const r = await replyWith(page, WORDS);
      check("(e) Reply opens the sheet — Reply · To Cian Murphy · Chipping — with Send asleep until there are words", r.sheet && /Reply/.test(r.t) && /To Cian Murphy/.test(r.t) && /Chipping/.test(r.t) && r.emptyDisabled && r.filledEnabled, JSON.stringify({ sheet: r.sheet, t: r.t.slice(-200), e: r.emptyDisabled, f: r.filledEnabled }));
      const msg = db.messages.find((m) => m.sender_id === IDS.coach && m.lesson_id === CLIP.a);
      check("(f) Send writes the coach's line into Cian's thread, tied to the clip", !!msg && msg.player_id === IDS.adult && msg.body === WORDS, JSON.stringify(msg));
      const t4 = await text();
      check("(f2) the toast says Sent, naming Cian, and the clip's page is back with the reply under his question, headed Replied and the day", /Sent/.test(t4) && /Cian Murphy/.test(t4) && (await page.locator('[data-tour="clip-reply-sheet"]').count()) === 0 && (await replyBlock(page).count()) === 1 && /Replied/.test(await replyBlock(page).innerText()) && new RegExp(WORDS).test(await replyBlock(page).innerText()), t4.slice(-300));
      await shot("04-coach-replied");
      const told = db.notifications.filter((n) => n.title === "Niamh Byrne replied");
      check("(g) Cian is told Niamh Byrne replied, with the words, landing on the clip — and nobody else is", told.length === 1 && told[0].user_id === IDS.adult && told[0].kind === "message" && told[0].body === WORDS && told[0].data.screen === "lesson" && told[0].data.id === CLIP.a && db.notifications.filter((n) => n.user_id === IDS.coach && n.kind === "message").length === 0, JSON.stringify(told.map((n) => [n.user_id, n.title, n.body, n.data])));
      /* the thread carries the reply as a card too */
      await tap(page, '[aria-label="Back"]', 700); await tap(page, '[aria-label="Back"]', 900);
      await tap(page, '[aria-label="Chat"]', 900);
      await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1500);
      await until(async () => (await page.locator('[data-tour="thread-clip-card"] video').count()) >= 2, 6000);
      const t5 = await text();
      check("(h) in Chat the reply is a bubble of the coach's own carrying the words and Open the clip, the clip's poster on it like the player's lines", new RegExp(WORDS).test(t5) && (await cards(page).count()) === 3 && (await page.locator('[data-tour="thread-clip-card"] video').count()) >= 2, `cards=${await cards(page).count()} video=${await page.locator('[data-tour="thread-clip-card"] video').count()} ${t5.slice(-200)}`);
      await shot("05-coach-thread");
      await cards(page).last().click(); await page.waitForTimeout(1500);
      check("(h2) …and the card on the reply opens the clip", /Chipping/.test(await text()) && /Sent by Cian Murphy/.test(await text()), (await text()).slice(0, 160));
      await tap(page, '[aria-label="Back"]', 700); await tap(page, '[aria-label="Back"]', 900);
      /* a lesson the coach logged is as it was */
      await tap(page, '[aria-label="Today"]', 900);
      await tap(page, '[data-tour="today-archive"]', 1200);
      await page.locator("button").filter({ hasText: "Bunker play" }).first().click(); await page.waitForTimeout(1500);
      const t6 = await text();
      check("(i) a logged lesson's page still leads with Set drills, Message and Log beside it, and offers no Reply", /Bunker play/.test(t6) && (await page.locator('[data-tour="clip-reply"]').count()) === 0 && (await page.getByRole("button", { name: "Set drills", exact: true }).count()) === 1 && (await page.getByRole("button", { name: "Log", exact: true }).count()) === 1 && (await standing(page).count()) === 0, t6.slice(-220));
      await tap(page, '[aria-label="Back"]', 700); await tap(page, '[aria-label="Back"]', 900);
      /* Saoirse's clip, sent by her mother */
      await tap(page, '[data-tour="today-review"]', 1200);
      await page.locator("[data-clip-row]").filter({ hasText: "Saoirse Kelly" }).first().click(); await page.waitForTimeout(1500);
      const rk = await replyWith(page, WORDS_K);
      const toldK = db.notifications.filter((n) => /replied/.test(n.title) && n.body === WORDS_K);
      const toP = toldK.find((n) => n.user_id === IDS.parent), toJ = toldK.find((n) => n.user_id === IDS.junior);
      check("(j) a reply on a child's clip tells the adult who looks after her — Niamh Byrne replied to Saoirse, on the thread — and the child herself on the clip", rk.sheet && /To Saoirse Kelly/.test(rk.t) && toldK.length === 2 && !!toP && toP.title === "Niamh Byrne replied to Saoirse" && toP.data.screen === "thread" && toP.data.id === IDS.junior && !!toJ && toJ.title === "Niamh Byrne replied" && toJ.data.screen === "lesson" && toJ.data.id === CLIP.k, JSON.stringify(toldK.map((n) => [n.user_id, n.title, n.data])));
      await ctx.close();
    }

    /* ---------- the player, answered ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await tap(page, '[aria-label="Alerts"]', 1000);
      const line = page.locator("button").filter({ hasText: "Niamh Byrne replied" }).first();
      check("(k) the bell carries Niamh Byrne replied with the words, wearing the coach's face", (await line.count()) === 1 && new RegExp(WORDS).test(await line.innerText()) && /NB/.test(M.norm(await line.innerText())), (await line.count()) ? await line.innerText() : (await text()).slice(0, 200));
      await shot("06-player-bell");
      await line.click(); await page.waitForTimeout(1800);
      await until(async () => (await replyBlock(page).count()) === 1, 6000);
      const t7 = await text();
      check("(k2) …and the tap lands on the clip, the reply under the question headed Niamh and the day, Waiting on gone", /Chipping/.test(t7) && (await replyBlock(page).count()) === 1 && /Niamh ·/.test(await replyBlock(page).innerText()) && new RegExp(WORDS).test(await replyBlock(page).innerText()) && (await standing(page).count()) === 0, t7.slice(0, 260));
      await shot("07-player-answered");
      await ctx.close();
    }

    /* ---------- the child ---------- */
    {
      const { ctx, page, text, shot } = await boot("junior");
      await tap(page, '[aria-label="Alerts"]', 1000);
      const line = page.locator("button").filter({ hasText: "Niamh Byrne replied" }).first();
      check("(l) the junior's bell carries Niamh Byrne replied", (await line.count()) === 1 && new RegExp(WORDS_K).test(await line.innerText()), (await line.count()) ? await line.innerText() : (await text()).slice(0, 200));
      await line.click(); await page.waitForTimeout(1800);
      await until(async () => (await replyBlock(page).count()) === 1, 6000);
      const t8 = await text();
      check("(l2) …landing on her clip with the coach's words on it", /Putting/.test(t8) && (await replyBlock(page).count()) === 1 && new RegExp(WORDS_K).test(await replyBlock(page).innerText()) && (await standing(page).count()) === 0, t8.slice(0, 220));
      await shot("08-junior-answered");
      await ctx.close();
    }

    /* ---------- the parent ---------- */
    {
      const { ctx, page, text, shot } = await boot("parent");
      await tap(page, '[aria-label="Alerts"]', 1000);
      const line = page.locator("button").filter({ hasText: "Niamh Byrne replied to Saoirse" }).first();
      check("(m) the parent's bell carries Niamh Byrne replied to Saoirse with the words", (await line.count()) === 1 && new RegExp(WORDS_K).test(await line.innerText()), (await line.count()) ? await line.innerText() : (await text()).slice(0, 200));
      await line.click(); await page.waitForTimeout(1800);
      await until(async () => (await page.locator('[data-tour="thread-clip-card"] video').count()) >= 1, 6000);
      const t9 = await text();
      check("(m2) …landing on the child's thread, where the reply is the coach's bubble with the words and the clip's card", /For Saoirse|Saoirse/.test(t9) && new RegExp(WORDS_K).test(t9) && (await cards(page).count()) === 2, `cards=${await cards(page).count()} ${t9.slice(-220)}`);
      await shot("09-parent-thread");
      await cards(page).last().click(); await page.waitForTimeout(1800);
      const t10 = await text();
      check("(m3) …and the card opens the child's clip with the reply on it", /Putting/.test(t10) && (await replyBlock(page).count()) === 1, t10.slice(0, 200));
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
