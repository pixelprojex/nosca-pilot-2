/* MESSAGING, END TO END.

   Chat lists conversations that have happened; who you may WRITE to is
   a different question. A coach writes to anyone on their roster, a
   player to their coach, an adult on behalf of a child in their
   family, and a junior not at all. Every one of those must reach the
   database as a real row with the right coach_id, player_id and
   sender_id — the thread screen used to look the person up in the list
   of threads that already had messages, so a coach who had never
   messaged anybody found every conversation "not available" and the
   composer's send did nothing at all.

   Usage: node messaging.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4404), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = {
  coach:  "00000000-0000-4000-8000-00000000c0ac",
  adult:  "00000000-0000-4000-8000-0000000adu17",
  second: "00000000-0000-4000-8000-00000000cec0",
  parent: "00000000-0000-4000-8000-000000pa4e07",
  junior: "00000000-0000-4000-8000-00000000c41d",
};
const FAM = "fa000000-0000-4000-8000-00000000fa01";

/* Nobody has written a word yet: this is the state a new coach is in,
   and the state in which messaging was completely dead. */
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach",  "coach@t.ie",  { role: "coach",  name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult",  "adult@t.ie",  { role: "player", name: "Cian Murphy",   type: "adult",  coachId: IDS.coach, dob: "1991-04-04" });
  person("second", "second@t.ie", { role: "player", name: "Saoirse Kelly", type: "adult",  coachId: IDS.coach, dob: "1990-02-02" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly",    type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Fionn Kelly",   type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  return db;
}

const { check, results, summary } = M.checker("messaging");
const msgs = (db) => db.messages || [];
const between = (db, coachId, playerId) => msgs(db).filter((m) => m.coach_id === coachId && m.player_id === playerId);

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];

  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" });
    /* the catch-up card covers the app on opening when something landed
       while you were away; a person taps it away, so the script does */
    await M.settle(page, { carryOn: true });
    return { ctx, page, text: () => M.rootText(page), shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) }) };
  };

  /* type into the composer and press the send button */
  const write = async (page, body, wait = 1400) => {
    const field = page.getByPlaceholder("Message").first();
    if (!(await field.count())) return false;
    await field.fill(body);
    const send = page.locator('[data-tour="thread-send"]').first();
    if (!(await send.count())) return false;
    await send.click();
    await page.waitForTimeout(wait);
    return true;
  };
  const openChat = async (page) => { await M.tap(page, '[aria-label="Chat"]', 1100); };

  try {
    /* ---------- (a) a coach who has never messaged anybody ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await openChat(page); await shot("01-coach-chat-empty");
      const t0 = await text();
      check("(a) a coach with no messages yet sees an empty Chat, not an error", !/isn't available/i.test(t0), t0.slice(0, 160));
      check("(a) the plus to start one is on the screen", (await page.locator('[data-tour="chat-new"]').count()) === 1, t0.slice(0, 160));

      await M.tap(page, '[data-tour="chat-new"]', 900); await shot("02-coach-picker");
      const t1 = await text();
      check("(a) the picker lists the whole roster, not only people already messaged",
        /Cian Murphy/.test(t1) && /Saoirse Kelly/.test(t1), t1.slice(0, 220));

      await M.click(page, "Cian Murphy", 1200); await shot("03-coach-thread-new");
      const t2 = await text();
      check("(a) picking somebody opens their conversation", /Cian Murphy/.test(t2) && !/isn't available/i.test(t2), t2.slice(0, 200));
      check("(a) …with a composer, not a dead end", (await page.getByPlaceholder("Message").count()) === 1, t2.slice(0, 200));

      const sent = await write(page, "See you Tuesday at nine.");
      check("(a) the composer sends", sent, "no composer or no send button");
      const row = between(db, IDS.coach, IDS.adult)[0];
      check("(a) the message reached the database as a real row", !!row, JSON.stringify(msgs(db)).slice(0, 220));
      check("(a) …in the right thread, written by the coach",
        !!row && row.coach_id === IDS.coach && row.player_id === IDS.adult && row.sender_id === IDS.coach && row.body === "See you Tuesday at nine.",
        JSON.stringify(row || {}));
      const t3 = await text();
      check("(a) it appears in the thread straight away", /See you Tuesday at nine/.test(t3), t3.slice(0, 220));

      await M.back(page, 1000); await shot("04-coach-chat-one");
      const t4 = await text();
      check("(a) and the conversation is now in the list", /Cian Murphy/.test(t4) && /See you Tuesday/.test(t4), t4.slice(0, 220));
      await ctx.close();
    }

    /* ---------- (b) the player gets it and replies ---------- */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await openChat(page); await shot("05-player-chat");
      const t0 = await text();
      check("(b) the player's conversation with their coach is listed", /Niamh Byrne/.test(t0), t0.slice(0, 200));

      await M.click(page, "Niamh Byrne", 1200);
      const t1 = await text();
      check("(b) the coach's message is in it", /See you Tuesday at nine/.test(t1), t1.slice(0, 220));

      await write(page, "Grand, see you then.");
      const mine = between(db, IDS.coach, IDS.adult).find((m) => m.sender_id === IDS.adult);
      check("(b) the reply is written as the player, in the same thread",
        !!mine && mine.player_id === IDS.adult && mine.coach_id === IDS.coach && mine.body === "Grand, see you then.",
        JSON.stringify(mine || {}));
      await shot("06-player-replied");
      await ctx.close();
    }

    /* ---------- (c) a player who has NOT yet been written to ---------- */
    {
      const { ctx, page, text, shot } = await boot("second");
      await openChat(page); await shot("07-second-chat");
      const t0 = await text();
      check("(c) a player nobody has messaged can still reach their coach", /Niamh Byrne/.test(t0), t0.slice(0, 200));
      await M.click(page, "Niamh Byrne", 1200);
      const ok = await write(page, "Could we move Thursday?");
      const row = between(db, IDS.coach, IDS.second)[0];
      check("(c) …and write the first message in the thread",
        ok && !!row && row.sender_id === IDS.second && row.player_id === IDS.second, JSON.stringify(row || {}));
      await shot("08-second-sent");
      await ctx.close();
    }

    /* ---------- (d) an adult on a child's behalf ---------- */
    {
      const { ctx, page, text, shot } = await boot("parent");
      await openChat(page); await shot("09-parent-chat");
      const t0 = await text();
      check("(d) the child's conversation is listed under the coach's name, marked for the child",
        /Niamh Byrne/.test(t0) && /Fionn/.test(t0), t0.slice(0, 240));

      await M.click(page, "Niamh Byrne", 1200);
      const ok = await write(page, "Fionn will be five minutes late.");
      const row = between(db, IDS.coach, IDS.junior)[0];
      check("(d) it is the child's thread, written by the parent",
        ok && !!row && row.player_id === IDS.junior && row.coach_id === IDS.coach && row.sender_id === IDS.parent,
        JSON.stringify(row || {}));
      await shot("10-parent-sent");
      await ctx.close();
    }

    /* ---------- (e) the coach reads the parent's line as the parent's ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await openChat(page);
      const t0 = await text();
      check("(e) the coach now has three conversations", /Cian Murphy/.test(t0) && /Saoirse Kelly/.test(t0) && /Fionn Kelly/.test(t0), t0.slice(0, 260));
      await M.click(page, "Fionn Kelly", 1200); await shot("11-coach-child-thread");
      const t1 = await text();
      /* A coach can read the roster and their own family, and a parent in
         somebody else's family is in neither — so the line is labelled
         "Parent" rather than by name. What must never happen is the line
         reading as the child's or as the coach's own. */
      check("(e) a parent's line on a child's behalf is labelled a parent's, never the child's",
        /Fionn will be five minutes late/.test(t1) && /parent/i.test(t1), t1.slice(0, 300));
      await ctx.close();
    }

    /* ---------- (f) a junior is told, not silently ignored ---------- */
    {
      const { ctx, page, text, shot } = await boot("junior");
      const hasTab = (await page.locator('[aria-label="Chat"]').count()) > 0;
      if (hasTab) await openChat(page);
      await shot("12-junior-chat");
      const t0 = await text();
      /* either there is no way in at all, or the way in says who handles
         it — what there is never is a composer */
      check("(f) a junior is never given a composer of their own",
        (await page.getByPlaceholder("Message").count()) === 0 && (!hasTab || /parent|guardian/i.test(t0)),
        `chat tab: ${hasTab} · ${t0.slice(0, 200)}`);
      check("(f) …and nothing of theirs ever reached the database",
        !msgs(db).some((m) => m.sender_id === IDS.junior), String(msgs(db).length));
      await ctx.close();
    }

    /* ---------- (g) one message to everyone ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await openChat(page);
      await M.tap(page, '[data-tour="chat-new"]', 900);
      const t0 = await text();
      check("(g) the picker leads with Everyone", /Everyone/.test(t0), t0.slice(0, 200));
      await M.click(page, "Everyone", 1100); await shot("13-broadcast");
      const before = msgs(db).length;
      const field = page.getByPlaceholder("Message").first();
      const composer = (await field.count()) ? field : page.locator("textarea, input[type=text]").first();
      await composer.fill("Range is closed Saturday.");
      await M.click(page, "Send", 1600);
      const made = msgs(db).slice(before).filter((m) => m.body === "Range is closed Saturday.");
      const to = new Set(made.map((m) => m.player_id));
      check("(g) a broadcast writes one row per player, each in their own thread",
        made.length === 3 && to.size === 3 && made.every((m) => m.sender_id === IDS.coach && m.coach_id === IDS.coach),
        `${made.length} rows → ${[...to].length} threads`);
      await shot("14-broadcast-sent");
      await ctx.close();
    }

    /* ---------- (h) reached from the player's file, not only from Chat ---------- */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await M.tap(page, '[aria-label="Roster"]', 1000);
      await M.tap(page, '[data-tour="roster-row"]', 1100);
      await M.click(page, "Message", 1200); await shot("15-from-player-file");
      const t0 = await text();
      check("(h) Message on a player's file opens their conversation with a live composer",
        !/isn't available/i.test(t0) && (await page.getByPlaceholder("Message").count()) === 1, t0.slice(0, 200));
      const before = msgs(db).length;
      await write(page, "Bring the wedge.");
      check("(h) …and it sends", msgs(db).length === before + 1 && msgs(db)[msgs(db).length - 1].body === "Bring the wedge.",
        JSON.stringify(msgs(db)[msgs(db).length - 1] || {}));
      await ctx.close();
    }

    /* ---------- (i) opening a thread marks it read ---------- */
    {
      M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.adult, body: "One more thing —" });
      const { ctx, page, text, shot } = await boot("coach");
      await openChat(page);
      const t0 = await text();
      check("(i) an unread conversation is marked in the list", /One more thing/.test(t0), t0.slice(0, 220));
      await M.click(page, "Cian Murphy", 1400); await shot("16-read");
      const unread = msgs(db).filter((m) => m.sender_id === IDS.adult && !m.read_at);
      check("(i) opening it marks the other side's messages read", unread.length === 0, `${unread.length} still unread`);
      await ctx.close();
    }
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    results.push({ name: "run completed", ok: false, detail: String(e && e.message || e) });
  } finally { await browser.close(); M.stopServer(server); }

  const real = errors.filter((e) => !/vibrate/.test(e));
  check("no page errors", real.length === 0, real.slice(0, 3).join(" | "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ ...out, messages: msgs(db) }, null, 2));
  process.exit(0);
})();
