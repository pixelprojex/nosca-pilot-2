/* FACES. One face per person, everywhere — and on the player's side the
   person seen most is the coach. The coach's picture used to be initials
   on every player surface (the lookup looked for a `data.coach` the hook
   never gave it, under the harness's coach name); this walks every place
   a player, a junior and a parent meet their coach's face, the coach's
   own roster for parity, and a picture that will not load.
   Usage: node faces.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`, SB = M.SB;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", coach2: "00000000-0000-4000-8000-00000000c0b2", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", other: "00000000-0000-4000-8000-00000000ab1e" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const PIC = (id) => `${id}/avatar-1725000000000.jpg`;
const URL_OF = (id) => `${SB}/storage/v1/object/public/avatars/${PIC(id)}`;

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock", avatar: PIC(IDS.coach) });
  person("coach2", "coach2@t.ie", { role: "coach", name: "Tomás Walsh", sport: "tennis", inviteCode: "TN5P2Q", avatar: PIC(IDS.coach2) });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04", avatar: PIC(IDS.adult) });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach2, familyId: FAM, dob: "2013-09-09" });
  /* a player whose picture is gone from the bucket */
  person("other", "other@t.ie", { role: "player", name: "Dara Ryan", type: "adult", coachId: IDS.coach, dob: "1990-02-02", avatar: `${IDS.other}/avatar-1700000000000.jpg` });
  [IDS.coach, IDS.coach2, IDS.adult].forEach((id) => { db.files.avatars[PIC(id)] = { size: 10 }; });
  db.failPublic = (p) => p === `avatars/${IDS.other}/avatar-1700000000000.jpg`;
  /* a thread each way, so Chat lists the conversations */
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "See you at four.", createdAt: "2026-10-02T15:00:00Z" });
  M.addMessage(db, { coachId: IDS.coach2, playerId: IDS.junior, senderId: IDS.coach2, body: "Bring the green balls.", createdAt: "2026-10-02T16:00:00Z" });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.other, senderId: IDS.other, body: "Thanks.", createdAt: "2026-10-02T17:00:00Z" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-18", focus: "Short game", subs: ["HI 18.4"] });
  M.addLesson(db, { coachId: IDS.coach2, playerId: IDS.junior, date: "2026-09-12", focus: "Forehand" });
  /* a tip and a lesson told to the player: the kinds that wear the coach's face */
  M.notify(db, IDS.adult, "tip", "Trust the shallow", null, { screen: "tips" });
  M.notify(db, IDS.junior, "tip", "Watch the ball onto the strings", null, { screen: "tips" });
  return db;
}

const { check, results, summary } = M.checker("faces");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
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
  /* the picture inside the first element on the page whose text carries the name */
  const faceIn = async (page, scope, name) => {
    const box = page.locator(scope).filter({ hasText: name }).first();
    if (!(await box.count())) return { found: false };
    const img = box.locator("img").first();
    return { found: true, src: (await img.count()) ? await img.getAttribute("src") : null };
  };
  const isCoachPic = (f, id) => !!f && f.found && f.src === URL_OF(id);

  try {
    /* ---------- the player: their coach, everywhere ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      /* the switcher: Your coaches carries the coach's face */
      await tap(page, '[data-tour="profile-pill"]', 900);
      const sw = await faceIn(page, "[data-sheet] button, [data-sheet] div", "Niamh Byrne");
      check("(a) the switcher's coach row carries the coach's picture", isCoachPic(sw, IDS.coach), JSON.stringify(sw));
      await shot("01-switcher");
      await tap(page, '[data-tour="sheet-settings"]', 900);
      /* Settings › Your coach → the coach's profile, their picture at the top */
      await tap(page, '[data-tour="settings-family"]', 900);
      const prof = await faceIn(page, "#root", "Niamh Byrne");
      check("(b) the coach's profile page opens on the coach's picture", /Niamh Byrne/.test(await text()) && isCoachPic(prof, IDS.coach), JSON.stringify(prof));
      await shot("02-coach-profile");
      /* Chat: the row, then the thread's header */
      await tap(page, '[aria-label="Chat"]', 900);
      const row = await faceIn(page, "button", "Niamh Byrne");
      check("(c) the Chat list's row for the coach carries their picture", isCoachPic(row, IDS.coach), JSON.stringify(row));
      await page.locator("button", { hasText: "Niamh Byrne" }).first().click(); await page.waitForTimeout(900);
      const hdr = page.locator("img").first();
      check("(c2) the thread's header carries it too", (await hdr.count()) > 0 && (await hdr.getAttribute("src")) === URL_OF(IDS.coach), String(await hdr.count() ? await hdr.getAttribute("src") : null));
      await shot("03-thread");
      /* the bell: a tip wears the coach's face */
      await tap(page, '[aria-label="Back"]', 600); await tap(page, '[aria-label="Home"]', 800);
      await tap(page, '[aria-label="Alerts"]', 900);
      const bell = await faceIn(page, "button", "Trust the shallow");
      check("(d) a tip on the bell wears the coach's face", isCoachPic(bell, IDS.coach), JSON.stringify(bell));
      await shot("04-bell");
      await ctx.close();
    }

    /* ---------- the junior: their own coach on the bell (a junior has no Chat; a parent writes for them) ---------- */
    {
      const { ctx, page, shot } = await boot("junior");
      await tap(page, '[aria-label="Alerts"]', 900);
      const bell = await faceIn(page, "button", "Watch the ball");
      check("(e) a junior's tip on the bell wears their own coach's face", isCoachPic(bell, IDS.coach2), JSON.stringify(bell));
      await shot("05-junior-bell");
      await ctx.close();
    }

    /* ---------- the parent: the child's coach, who is not their own ---------- */
    {
      const { ctx, page, shot } = await boot("parent");
      await tap(page, '[aria-label="Chat"]', 900);
      const row = await faceIn(page, "button", "Tomás Walsh");
      check("(f) a parent's Chat row for the child's coach carries that coach's picture", isCoachPic(row, IDS.coach2), JSON.stringify(row));
      await shot("06-parent-chat");
      await ctx.close();
    }

    /* ---------- the coach: a player's picture, and a picture that will not load ---------- */
    {
      const { ctx, page, shot } = await boot("coach");
      await tap(page, '[aria-label="Roster"]', 900);
      const cian = await faceIn(page, "button", "Cian Murphy");
      check("(g) the roster carries a player's picture", isCoachPic(cian, IDS.adult), JSON.stringify(cian));
      /* Dara's file is gone from the bucket: initials, never a broken picture */
      await page.waitForTimeout(1200);
      const dara = page.locator("button").filter({ hasText: "Dara Ryan" }).first();
      const daraImgs = await dara.locator("img").count();
      const daraText = M.norm(await dara.innerText());
      check("(h) a picture that will not load falls back to initials — no broken image in the disc", daraImgs === 0 && /^DR\b/.test(daraText), JSON.stringify({ daraImgs, daraText }));
      await shot("07-roster");
      await ctx.close();
    }

    check("(i) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
