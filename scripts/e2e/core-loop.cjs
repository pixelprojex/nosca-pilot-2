/* CORE LOOP. A session is injected per role against the shared mock
   (mock.cjs): lessons open by id with real media, a lesson log downloads,
   chat is real, attendance and live capture read today's bookings, the
   wizard logs a lesson with a typed note — and, since families and
   requests: the coach's player file lists that player's real lessons, and
   attached files upload in parallel with a status strip that names a
   refused file and retries it.
   Usage: node core-loop.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4193), BASE = `http://localhost:${PORT}`, SB = M.SB;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const LESSON = { new: "10000000-0000-4000-8000-00000000ae01", old: "10000000-0000-4000-8000-00000000ae02", jun: "10000000-0000-4000-8000-00000000ae03" };
const TODAY = M.ymd(new Date());

function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: IDS.coach, email: "coach@t.ie" }); M.addUser(db, { id: IDS.adult, email: "adult@t.ie" });
  M.addUser(db, { id: IDS.parent, email: "parent@t.ie" }); M.addUser(db, { id: IDS.junior, email: "junior@t.ie" });
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  M.addProfile(db, { id: IDS.coach, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  M.addProfile(db, { id: IDS.adult, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  M.addProfile(db, { id: IDS.parent, role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  M.addProfile(db, { id: IDS.junior, role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  M.addLesson(db, { id: LESSON.new, coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-01", focus: "Short game", subs: ["Chipping"], notes: "Cleaner contact from the fringe." });
  M.addLesson(db, { id: LESSON.old, coachId: IDS.coach, playerId: IDS.adult, date: "2026-08-20", focus: "Putting", subs: ["Lag putting"], notes: "Pace on the long ones first." });
  M.addLesson(db, { id: LESSON.jun, coachId: IDS.coach, playerId: IDS.junior, date: "2026-08-28", focus: "Grip", notes: "Left hand a touch stronger." });
  M.addMedia(db, { lessonId: LESSON.old, kind: "video", path: `${IDS.coach}/${LESSON.old}/1-swing.mp4`, createdAt: "2026-08-20T10:01:00Z" });
  M.addMedia(db, { lessonId: LESSON.old, kind: "audio", path: `${IDS.coach}/${LESSON.old}/2-note.webm`, createdAt: "2026-08-20T10:02:00Z" });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.coach, body: "See you Tuesday at nine.", readAt: "2026-09-01T09:00:00Z", createdAt: "2026-09-01T08:00:00Z" });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.adult, senderId: IDS.adult, body: "Grand, thanks Niamh.", createdAt: "2026-09-01T08:30:00Z" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "9:00 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.junior, date: TODAY, time: "10:30 am" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm", status: "requested" });
  /* the one file the storage refuses, once */
  db.failUpload = (p) => (/-big-clip\.mp4$/.test(p) && !db.refusedOnce ? (db.refusedOnce = true, {}) : null);
  return db;
}

const allowedFor = { coach: ["Niamh Byrne", "Cian Murphy", "Saoirse Kelly", "Orla Kelly", "QW7X2M"], adult: ["Cian Murphy", "Niamh Byrne"], parent: ["Orla Kelly", "Saoirse Kelly", "Niamh Byrne"], junior: ["Saoirse Kelly", "Orla Kelly", "Niamh Byrne"] };
const { check, results, summary } = M.checker("core-loop");
const leaks = [];

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errorsByRole = {};
  const boot = async (role, db = freshDb()) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage();
    /* the day is real but the hour is pinned to 08:00, so the two morning bookings are always still ahead and the register offers both */
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    errorsByRole[role] = errorsByRole[role] || []; page.on("pageerror", (e) => errorsByRole[role].push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const text = () => M.rootText(page);
    const leak = async (label) => { const tx = await text(); for (const s of M.SEEDED) if (tx.includes(s) && !(allowedFor[role] || []).includes(s)) leaks.push({ role, screen: label, seeded: s }); return tx; };
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { db, ctx, page, text, leak, shot };
  };
  const { tap, byText } = M;

  try {
    /* ---------- (a)+(b) adult player: second lesson, real media, download ---------- */
    {
      const { db, ctx, page, text, leak, shot } = await boot("adult");
      await leak("adult home"); await shot("adult-home");
      await tap(page, '[aria-label="Lessons"]');
      if (await page.locator('[aria-label="list"]').count()) await tap(page, '[aria-label="list"]');
      const listText = await leak("adult lessons list"); await shot("adult-lessons");
      check("(a) list shows both lessons, newest first", /Short game.*Putting/.test(listText), listText.slice(0, 200));
      await page.locator("button", { hasText: "20 AUG" }).first().click(); await page.waitForTimeout(1200);
      const t1 = await leak("adult lesson (second)"); await shot("adult-lesson-putting");
      check("(a) opened the SECOND lesson (Putting), not the newest", /Putting/.test(t1) && t1.includes("Pace on the long ones first.") && !t1.includes("Cleaner contact"), t1.slice(0, 240));
      const vid = page.locator("video[controls]");
      await vid.first().waitFor({ timeout: 8000 }).catch(() => {});
      const vsrc = (await vid.count()) ? await vid.first().getAttribute("src") : null;
      check("(a) a real <video controls playsinline> with the signed URL", !!vsrc && vsrc.includes(`${SB}/storage/v1/object/sign/media/`) && vsrc.includes("1-swing.mp4") && (await vid.first().getAttribute("playsinline")) !== null, String(vsrc));
      const pill = page.getByRole("button", { name: "Voice note" });
      check("(a) a pill for the voice note", (await pill.count()) > 0);
      if (await pill.count()) { await pill.first().click(); await page.waitForTimeout(500); }
      const aud = page.locator("audio[controls]");
      const asrc = (await aud.count()) ? await aud.first().getAttribute("src") : null;
      check("(a) a real <audio controls> for the voice note", !!asrc && asrc.includes("2-note.webm"), String(asrc));
      check("(a) signed URLs were requested once per lesson (cached)", db.posts.filter((x) => x.table === "sign").length === 1, JSON.stringify(db.posts.filter((x) => x.table === "sign").map((x) => x.rows)));
      await shot("adult-lesson-audio");
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), page.locator('button', { hasText: "Download lesson log" }).first().click()]);
      const file = dl ? await dl.path() : null; const html = file ? fs.readFileSync(file, "utf8") : "";
      check("(b) Download lesson log fires a download of an .html file", !!dl && /\.html$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : "no download");
      check("(b) the file carries the lesson's focus, notes, coach and media links", html.includes("Putting") && html.includes("Pace on the long ones first.") && html.includes("Niamh Byrne") && html.includes("1-swing.mp4") && html.includes("Voice note"), html.slice(0, 200));
      check("(b) the file carries no seeded text", !M.SEEDED.some((s) => html.includes(s)), M.SEEDED.filter((s) => html.includes(s)).join(","));
      if (dl) fs.copyFileSync(file, path.join(outDir, "lesson-log.html"));
      await page.waitForTimeout(600);
      check("(1) the opened lesson has a Back control (pop is wired)", (await page.locator('[aria-label="Back"]').count()) === 1);
      await shot("adult-after-download");
      /* You → Lesson logs */
      await tap(page, '[aria-label="Back"]'); await tap(page, '[aria-label="Your profile"]');
      await byText(page, "Lesson logs").click(); await page.waitForTimeout(700);
      const t2 = await leak("adult lesson logs"); await shot("adult-lesson-logs");
      check("(b) You → Lesson logs lists the person's lessons with Download", t2.includes("Short game") && t2.includes("Putting") && (await page.getByRole("button", { name: /Download Putting/ }).count()) === 1, t2.slice(0, 200));
      const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), page.getByRole("button", { name: /Download Short game/ }).click()]);
      const html2 = dl2 ? fs.readFileSync(await dl2.path(), "utf8") : "";
      check("(b) a Download from the list makes the right file", html2.includes("Short game") && html2.includes("Cleaner contact from the fringe."), dl2 ? dl2.suggestedFilename() : "no download");
      /* adult Chat: the coach, real thread */
      await tap(page, '[aria-label="Back"]'); await tap(page, '[aria-label="Chat"]');
      const t3 = await leak("adult chat"); await shot("adult-chat");
      check("(c) adult Chat lists their coach only", t3.includes("Niamh Byrne") && t3.includes("Grand, thanks Niamh."), t3.slice(0, 200));
      await byText(page, "Niamh Byrne").click(); await page.waitForTimeout(900);
      const t4 = await leak("adult thread");
      check("(c) adult thread shows the real messages, no canned reply", t4.includes("See you Tuesday at nine.") && !t4.includes("No problem, I'll sort it"), t4.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (c) coach chat, (d) attendance, (e) log a lesson, (g) the player file, (h) uploads ---------- */
    {
      const { db, ctx, page, text, leak, shot } = await boot("coach");
      await leak("coach today"); await shot("coach-today");
      await tap(page, '[aria-label="Chat"]');
      const t1 = await leak("coach chat"); await shot("coach-chat");
      check("(c) coach Chat lists the real roster", t1.includes("Cian Murphy") && t1.includes("Saoirse Kelly") && t1.includes("Grand, thanks Niamh."), t1.slice(0, 200));
      await byText(page, "Cian Murphy").click(); await page.waitForTimeout(1000);
      const t2 = await leak("coach thread"); await shot("coach-thread");
      check("(c) opening the thread shows the mocked messages", t2.includes("See you Tuesday at nine.") && t2.includes("Grand, thanks Niamh."), t2.slice(0, 200));
      const patch = db.patches.find((x) => x.table === "messages" && x.body && x.body.read_at);
      check("(c) read_at patched for the other side's unread message", !!patch && patch.n === 1 && patch.query.includes(`player_id=eq.${IDS.adult}`) && patch.query.includes(`sender_id=neq.${IDS.coach}`), patch ? patch.query : "no PATCH");
      await page.fill('input[placeholder="Message"]', "Bring a wedge on Saturday.");
      await tap(page, '[aria-label="Send"]'); await page.waitForTimeout(1200);
      const post = db.posts.find((x) => x.table === "messages");
      const r = post && post.rows[0];
      check("(c) send posts to /rest/v1/messages with the right ids", !!r && r.coach_id === IDS.coach && r.player_id === IDS.adult && r.sender_id === IDS.coach && r.body === "Bring a wedge on Saturday.", JSON.stringify(r));
      const t3 = await text();
      check("(c) the sent message appears from the database, no canned reply", t3.includes("Bring a wedge on Saturday.") && !t3.includes("Grand, that works."), t3.slice(-200));
      check("(c) the message trigger told the player (kind message, screen thread)", db.notifications.some((n) => n.user_id === IDS.adult && n.kind === "message" && n.data.screen === "thread" && n.data.id === IDS.adult), JSON.stringify(db.notifications.slice(-1)));
      await shot("coach-thread-sent");
      /* Message everyone */
      await tap(page, '[aria-label="Back"]');
      await byText(page, "Message everyone").click(); await page.waitForTimeout(600);
      await page.fill('textarea[placeholder="Write or say your message"]', "Range is closed Friday.");
      await page.getByRole("button", { name: "Send", exact: true }).click(); await page.waitForTimeout(1200);
      const bc = db.posts.filter((x) => x.table === "messages").pop();
      check("(c) Message everyone posts one row per roster player", !!bc && bc.rows.length === 2 && bc.rows.every((x) => x.sender_id === IDS.coach && x.body === "Range is closed Friday.") && new Set(bc.rows.map((x) => x.player_id)).size === 2, JSON.stringify(bc && bc.rows.map((x) => x.player_id)));

      /* (d) attendance */
      await tap(page, '[aria-label="Today"]'); await tap(page, '[aria-label="Add"]');
      await leak("coach quick menu");
      await byText(page, "Attendance").click(); await page.waitForTimeout(800);
      const t4 = await leak("coach attendance"); await shot("coach-attendance");
      /* the sheet's own text: Today sits behind it, and a lesson merely
         asked for is answered there, so the page carries "4:00 pm" even
         though the register must not */
      const sheet4 = await page.locator("[data-sheet]").first().innerText();
      check("(d) Attendance lists today's real confirmed bookings by name", sheet4.includes("Cian Murphy") && sheet4.includes("9:00 am") && sheet4.includes("Saoirse Kelly") && sheet4.includes("10:30 am") && !sheet4.includes("4:00 pm"), sheet4.slice(0, 240));
      await page.locator("div.z-40").getByRole("button", { name: /Cian Murphy/ }).first().click(); await page.waitForTimeout(500);
      await page.locator("div.z-40").getByRole("button", { name: "Present", exact: true }).first().click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: /Submit register/ }).click(); await page.waitForTimeout(1200);
      const sess = db.posts.find((x) => x.table === "attendance_sessions"); const marks = db.posts.find((x) => x.table === "attendance_marks");
      check("(d) submitting posts attendance_sessions + attendance_marks with real ids", !!sess && sess.rows[0].label === "Cian Murphy" && sess.rows[0].coach_id === IDS.coach && !!marks && marks.rows[0].player_id === IDS.adult && marks.rows[0].state === "in", JSON.stringify({ sess: sess && sess.rows[0], marks: marks && marks.rows }));
      await page.waitForTimeout(2200);

      /* Live capture sheet: real day, holding pile */
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Add"]');
      await byText(page, "Live capture").click(); await page.waitForTimeout(800);
      const t5 = await leak("coach live capture"); await shot("coach-live-capture");
      check("(5) Live capture files under today's real bookings or nobody", /filing under/i.test(t5) && t5.includes("Cian Murphy · 9:00 am") && t5.includes("Saoirse Kelly · 10:30 am") && t5.includes("Nobody yet"), t5.slice(0, 200));

      /* (e) log a lesson with a typed note */
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Add"]');
      await page.getByRole("button", { name: /log a lesson|log lesson/i }).first().click(); await page.waitForTimeout(800);
      const tw0 = await leak("wizard who"); await shot("coach-wizard-who");
      check("(e) the first page asks who and when, and never for a time nothing stores", tw0.includes("Date") && (await page.locator('input[type="date"]').count()) === 1 && (await page.locator('input[type="time"]').count()) === 0, tw0.slice(0, 200));
      await byText(page, "Cian Murphy").click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      /* three pages now — who and when, what happened, what's next. The
         focus, the clips and the note used to be a page each. */
      const t6 = await leak("wizard what happened"); await shot("coach-wizard-what");
      check("(e) notes step offers a typed note and a real voice note, no transcript", t6.includes("Record a voice note") && (await page.locator('textarea[placeholder="What happened, in a line or two"]').count()) === 1 && !t6.includes("Tap to record"), t6.slice(0, 200));
      check("(e) media step: Record / Library / Photo / Captured, no device readout", t6.includes("Record") && t6.includes("Library") && t6.includes("Photo") && t6.includes("Captured") && !/TrackMan|Serve radar|Launch/i.test(t6) && (await page.locator('input[type="file"]').count()) >= 1, t6.slice(0, 200));
      check("(e) the focus, the clips and the note are one page", t6.includes("Short game") && t6.includes("Clips and photos") && t6.includes("The note") && t6.includes("2 / 3"), t6.slice(0, 300));
      await page.getByRole("button", { name: "Short game", exact: true }).click(); await page.waitForTimeout(300);
      await page.fill('textarea[placeholder="What happened, in a line or two"]', "Worked on tempo from a hundred yards.");
      /* one way forward per page: Continue until the last one, which is
         the Publish. */
      for (let i = 0; i < 4; i++) {
        const pub = page.getByRole("button", { name: "Publish", exact: true });
        if (await pub.count()) { await pub.first().click(); break; }
        await page.getByRole("button", { name: "Continue" }).first().click();
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(1500);
      const lp = db.posts.find((x) => x.table === "lessons"); const lrow = lp && lp.rows[0];
      check("(e) the lessons insert carries today's date and the typed note only", !!lrow && lrow.lesson_date === TODAY && lrow.notes === "Worked on tempo from a hundred yards." && lrow.focus === "Short game" && lrow.player_id === IDS.adult && lrow.coach_id === IDS.coach, JSON.stringify(lrow));
      check("(e) the lesson trigger told the player (kind lesson, screen lesson, the new id)", db.notifications.some((n) => n.user_id === IDS.adult && n.kind === "lesson" && n.data.screen === "lesson" && lrow && n.data.id === lrow.id), JSON.stringify(db.notifications.filter((n) => n.kind === "lesson")));
      const t8 = await leak("published burst"); await shot("coach-burst");
      check("(e) the burst offers no seeded 'Log next' or rating pretence", !t8.includes("Dan Okafor") && !t8.includes("4 left"), t8.slice(0, 200));
      await page.waitForTimeout(2800);

      /* (g) Roster → the player's real file */
      await tap(page, '[aria-label="Roster"]');
      const tr0 = await leak("coach roster"); await shot("coach-roster");
      check("(g) the roster row carries the real lesson count", (await page.locator('[data-tour="roster-row"]', { hasText: "Cian Murphy" }).innerText()).includes("3 lessons") && tr0.includes("1 lessons"), tr0.slice(0, 240));
      await page.locator('[data-tour="roster-row"]', { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const tg = await leak("coach player file"); await shot("coach-player-file");
      const fileRows = page.locator('[data-tour="player-lessons"] button');
      const rowTexts = await fileRows.allInnerTexts();
      check("(g) the player file lists that player's real lessons, newest first, with the count in the header", tg.includes("3 lessons") && rowTexts.length === 3 && /Short game/.test(rowTexts[0]) && /01 SEP|Short game/.test(rowTexts[1]) && /20 AUG/.test(rowTexts[2]) && /Putting/.test(rowTexts[2]) && !tg.includes("Grip"), JSON.stringify(rowTexts));
      check("(g) the file's rows are the coach's own — nothing seeded (14 Jun, Driving)", !tg.includes("14 Jun") && !tg.includes("Held the finish"), tg.slice(0, 200));
      await fileRows.filter({ hasText: "Putting" }).first().click(); await page.waitForTimeout(1200);
      const t10 = await leak("coach lesson view"); await shot("coach-lesson-view");
      check("(g) tapping a row opens the coach lesson view by id with its real notes and media", t10.includes("Putting") && t10.includes("Pace on the long ones first.") && !t10.includes("Distance control") && (await page.locator("video[controls]").count()) === 1 && t10.includes("Download lesson log"), t10.slice(0, 240));
      /* You → Lesson logs (coach) */
      await tap(page, '[aria-label="Back"]'); await tap(page, '[aria-label="Back"]'); await tap(page, '[aria-label="Your profile"]');
      await byText(page, "Lesson logs").click(); await page.waitForTimeout(700);
      const t11 = await leak("coach lesson logs"); await shot("coach-lesson-logs");
      check("(3) coach Lesson logs lists every lesson with who", t11.includes("Putting") && t11.includes("Cian Murphy") && t11.includes("Grip") && t11.includes("Saoirse Kelly"), t11.slice(0, 200));

      /* (h) two files, one refused by the storage limit, retried from Today */
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await tap(page, '[aria-label="Add"]');
      await page.getByRole("button", { name: /log a lesson|log lesson/i }).first().click(); await page.waitForTimeout(800);
      await byText(page, "Saoirse Kelly").click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Putting", exact: true }).click(); await page.waitForTimeout(300);
      await page.fill('textarea[placeholder="What happened, in a line or two"]', "Two clips attached.");
      await page.locator('input[type="file"]').first().setInputFiles([
        { name: "swing.mp4", mimeType: "video/mp4", buffer: M.MP4 },
        { name: "big-clip.mp4", mimeType: "video/mp4", buffer: M.MP4 },
      ]);
      await page.waitForTimeout(600);
      const th0 = await text(); await shot("coach-wizard-two-files");
      check("(h) both files are listed on the media step", th0.includes("swing.mp4") && th0.includes("big-clip.mp4"), th0.slice(0, 200));
      for (let i = 0; i < 4; i++) {
        const pub = page.getByRole("button", { name: "Publish", exact: true });
        if (await pub.count()) { await pub.first().click(); break; }
        await page.getByRole("button", { name: "Continue" }).first().click();
        await page.waitForTimeout(400);
      }
      /* the burst plays 2.6 s; the uploads have long finished by then */
      await page.waitForTimeout(4200);
      const strip = page.locator('[data-tour="upload-status"]');
      await strip.waitFor({ timeout: 6000 }).catch(() => {});
      const th1 = (await strip.count()) ? M.norm(await strip.innerText()) : ""; await shot("coach-upload-strip");
      const ups = db.uploads.filter((u) => u.bucket === "media");
      check("(h) every attached file was uploaded at once (two POSTs to the media bucket)", ups.length === 2 && ups.some((u) => /-swing\.mp4$/.test(u.path) && !u.refused) && ups.some((u) => /-big-clip\.mp4$/.test(u.path) && u.refused), JSON.stringify(ups.map((u) => [u.path.split("/").pop(), u.refused])));
      check("(h) Today shows the upload strip naming the refused file and the reason", th1.includes("1 file didn't upload") && th1.includes("1 in") && th1.includes("big-clip.mp4") && /Too big for the storage limit \(50 MB\)/.test(th1), th1);
      const retry = strip.getByRole("button", { name: "Retry", exact: true });
      check("(h) the strip offers Retry", (await retry.count()) === 1);
      const lessonH = db.posts.filter((x) => x.table === "lessons").pop().rows[0];
      check("(h) the lesson itself was written before the uploads, with one media row so far", !!lessonH && lessonH.player_id === IDS.junior && db.media.filter((m) => m.lesson_id === lessonH.id).length === 1, JSON.stringify(db.media.filter((m) => lessonH && m.lesson_id === lessonH.id).map((m) => m.storage_path)));
      if (await retry.count()) { await retry.click(); await page.waitForTimeout(1800); }
      const th2 = (await strip.count()) ? M.norm(await strip.innerText()) : ""; await shot("coach-upload-retried");
      const ups2 = db.uploads.filter((u) => u.bucket === "media" && /-big-clip\.mp4$/.test(u.path));
      check("(h) Retry uploads only the failed file again and it lands", ups2.length === 2 && !ups2[1].refused && db.uploads.filter((u) => u.bucket === "media").length === 3 && db.media.filter((m) => m.lesson_id === lessonH.id).length === 2, JSON.stringify(db.uploads.map((u) => [u.path.split("/").pop(), u.refused])));
      /* the retry reports on the files it retried — one — and nothing failed; it then clears itself */
      check("(h) the strip then reads attached, with nothing failed", /\d files? attached/.test(th2) && !/didn't upload/.test(th2) || th2 === "", th2);
      check("(h) the junior's lesson told the junior and every adult in the family", db.notifications.some((n) => n.user_id === IDS.junior && n.kind === "lesson" && n.data.id === lessonH.id) && db.notifications.some((n) => n.user_id === IDS.parent && n.kind === "lesson" && n.data.screen === "family" && n.data.id === lessonH.id), JSON.stringify(db.notifications.filter((n) => n.kind === "lesson").map((n) => [n.user_id.slice(-4), n.title])));

      /* (h2) THE IPHONE CASE. Every camera capture comes back called
         "image.jpg" or "video.mp4". These used to share one storage
         path — one Date.now() for the whole batch — so upsert:false
         kept the first and 409'd the rest: three clips, one clip in the
         lesson. This is the regression test for that. */
      db.failUpload = null;
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page, { carryOn: true });
      const before = db.uploads.filter((u) => u.bucket === "media").length;
      /* the plus, then Log a lesson — Today's empty state is gone now
         that this coach has something to log */
      await M.tap(page, '[data-tour="quick"]', 700);
      await M.tap(page, '[data-tour="quick-log"]', 900);
      await byText(page, "Saoirse Kelly").click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Putting", exact: true }).click(); await page.waitForTimeout(300);
      await page.fill('textarea[placeholder="What happened, in a line or two"]', "Three captures, all called the same thing.");
      await page.locator('input[type="file"]').first().setInputFiles([
        { name: "image.jpg", mimeType: "image/jpeg", buffer: M.PNG },
        { name: "image.jpg", mimeType: "image/jpeg", buffer: M.PNG },
        { name: "image.jpg", mimeType: "image/jpeg", buffer: M.PNG },
      ]);
      await page.waitForTimeout(600);
      for (let i = 0; i < 4; i++) {
        const pub = page.getByRole("button", { name: "Publish", exact: true });
        if (await pub.count()) { await pub.first().click(); break; }
        await page.getByRole("button", { name: "Continue" }).first().click();
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(4600);
      const sameUps = db.uploads.filter((u) => u.bucket === "media").slice(before);
      const samePaths = sameUps.map((u) => u.path);
      check("(h2) three files with the SAME name all upload, to three different paths, none refused",
            sameUps.length === 3 && new Set(samePaths).size === 3 && sameUps.every((u) => !u.refused),
            JSON.stringify(samePaths.map((x) => x.split("/").pop())));
      const sameLesson = db.lessons.filter((l) => l.coach_id === IDS.coach).pop();
      const sameRows = db.media.filter((m) => m.lesson_id === sameLesson.id);
      check("(h2) …and all three are attached to the lesson", sameRows.length === 3 && new Set(sameRows.map((r) => r.storage_path)).size === 3, JSON.stringify(sameRows.map((r) => r.storage_path.split("/").pop())));
      await ctx.close();
    }

    /* ---------- (f) junior: lessons by id, nothing seeded ---------- */
    {
      const { ctx, page, leak, shot } = await boot("junior");
      await leak("junior home"); await shot("junior-home");
      await tap(page, '[aria-label="Lessons"]');
      if (await page.locator('[aria-label="list"]').count()) await tap(page, '[aria-label="list"]');
      await leak("junior lessons");
      await page.locator("button", { hasText: "28 AUG" }).first().click(); await page.waitForTimeout(1000);
      const t = await leak("junior lesson"); await shot("junior-lesson");
      check("(f) junior opens their own lesson by id", t.includes("Grip") && t.includes("Left hand a touch stronger."), t.slice(0, 200));
      await ctx.close();
    }
    /* ---------- (i) a group lesson counts for everyone who was at it ---------- */
    {
      const gdb = freshDb();
      const squad = M.addLesson(gdb, { coachId: IDS.coach, groupName: "Tuesday squad", date: "2026-09-03", focus: "Serve", notes: "Toss out in front." });
      M.addAttendee(gdb, { lessonId: squad.id, playerId: IDS.adult });
      M.addAttendee(gdb, { lessonId: squad.id, playerId: IDS.junior });

      {
        const { ctx, page, leak } = await boot("coach", gdb);
        await tap(page, '[aria-label="Roster"]', 900);
        const row = page.locator('[data-tour="roster-row"]').filter({ hasText: "Cian Murphy" }).first();
        const rowText = (await row.count()) ? M.norm(await row.innerText()) : "";
        /* two private in the fixture, plus the squad they were marked at */
        check("(i) the coach's roster counts a group session for the players who were at it", /3 lessons/.test(rowText), rowText);
        await row.click(); await page.waitForTimeout(1200);
        const t = await leak("coach player file with a group");
        check("(i) …and it is on that player's file, named, with no 'private' hedge", t.includes("Serve") && t.includes("3 lessons") && !t.includes("private"), t.slice(0, 240));
        await ctx.close();
      }
      {
        /* the same session, from the other side: the player's own log */
        const { ctx, page, leak } = await boot("adult", gdb);
        await tap(page, '[aria-label="Lessons"]', 900);
        if (await page.locator('[aria-label="list"]').count()) await tap(page, '[aria-label="list"]', 800);
        const t = await leak("player log with a group");
        check("(i) the player's own log carries the group session they attended", t.includes("Serve"), t.slice(0, 240));
        await ctx.close();
      }
      {
        /* and somebody who was NOT at it does not get it */
        const { ctx, page, leak } = await boot("parent", gdb);
        const t = await leak("parent, not at the squad");
        check("(i) a person who was not marked at it never sees it", !t.includes("Toss out in front."), t.slice(0, 200));
        await ctx.close();
      }
    }

    /* (j) TWO PLAYERS WITH THE SAME NAME.
       Everything used to resolve a person by their display name, so the
       second Cian Murphy on a roster was the first one as far as every
       write was concerned: the lesson, the drills and the tip all
       landed on whoever the roster listed first. */
    {
      const ndb = freshDb();
      const TWIN = "00000000-0000-4000-8000-00000000tw1n";
      M.addUser(ndb, { id: TWIN, email: "twin@t.ie" });
      M.addProfile(ndb, { id: TWIN, role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1990-01-01" });
      const { ctx, page } = await boot("coach", ndb);
      await M.tap(page, '[data-tour="quick"]', 700);
      await M.tap(page, '[data-tour="quick-log"]', 900);
      const rows = page.locator('button:has-text("Cian Murphy")');
      check("(j) both people called Cian Murphy are offered, not one", (await rows.count()) === 2, String(await rows.count()));
      /* the SECOND one — the one a name lookup would never reach */
      await rows.nth(1).click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Putting", exact: true }).click(); await page.waitForTimeout(300);
      await page.fill('textarea[placeholder="What happened, in a line or two"]', "The other Cian.");
      for (let i = 0; i < 4; i++) {
        const pub = page.getByRole("button", { name: "Publish", exact: true });
        if (await pub.count()) { await pub.first().click(); break; }
        await page.getByRole("button", { name: "Continue" }).first().click();
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(1500);
      const lp = ndb.posts.filter((x) => x.table === "lessons").pop();
      const lrow = lp && lp.rows[0];
      check("(j) the lesson was written against the person who was ticked, not the first of that name",
            !!lrow && lrow.player_id === TWIN, JSON.stringify(lrow && { player_id: lrow.player_id, expected: TWIN }));
      check("(j) …and the notification went to them", ndb.notifications.some((n) => n.user_id === TWIN && n.kind === "lesson"),
            JSON.stringify(ndb.notifications.filter((n) => n.kind === "lesson").map((n) => n.user_id)));
      await ctx.close();
    }

  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    results.push({ name: "run completed", ok: false, detail: String(e && e.message || e) });
  } finally { await browser.close(); M.stopServer(server); }

  for (const [r, es] of Object.entries(errorsByRole)) { const real = es.filter((e) => !/vibrate/.test(e)); check(`(f) no page errors as ${r}`, real.length === 0, real.slice(0, 3).join(" | ")); }
  check("(f) no seeded string on any screen touched", leaks.length === 0, leaks.map((l) => `${l.role}:${l.screen}:${l.seeded}`).join(" ; "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "core.json"), JSON.stringify({ ...out, leaks }, null, 2));
  process.exit(0);
})();
