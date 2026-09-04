/* PASS C1 — CORE LOOP CHECK. Derived from sweep.cjs: a session is injected per
   role and Supabase is mocked, now with real-shaped lessons, media (signed
   URLs served by the mock), messages, bookings and attendance writes.
   Usage: node run-core.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4193), BASE = `http://localhost:${PORT}`, SB = "https://mock.supabase.co";
const ROOT = require("path").resolve(__dirname, "../..");
fs.mkdirSync(outDir, { recursive: true });
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

const SEEDED = ["Ray Doyle", "ray@hollowbrook", "+353 87 123 4567", "Marcus Tran", "Priya Ellis", "Dan Okafor", "Sofia Reyes",
  "Tom Beckett", "Hannah Doyle", "Hollowbrook", "RD4K9P", "TrackMan", "Breathnach", "Summer clinic", "Junior squad", "Ladies group",
  "Captain's Prize", "Club Championship", "Garda", "Safeguarding", "Face-on", "Down the line", "Marcus T.", "Priya E.", "Dan O.", "1284",
  "24 Jul", "Friday 24", "Good session. Most of it went"];
const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const LESSON = { new: "10000000-0000-4000-8000-00000000ae01", old: "10000000-0000-4000-8000-00000000ae02", jun: "10000000-0000-4000-8000-00000000ae03" };
const MEDIA = { vid: "20000000-0000-4000-8000-00000000ed01", aud: "20000000-0000-4000-8000-00000000ed02" };
const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date());
let seq = 0; const uuid = () => `40000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const MP4 = Buffer.from("AAAAGGZ0eXBpc29tAAAAAGlzb21tcDQxAAAACGZyZWU=", "base64");   // ftyp + free boxes
const WEBM = Buffer.from("GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKChHdlYm1Ch4ECQoWBAhhTgGcBAAAAAAAB", "base64");

function freshDb() {
  const now = new Date().toISOString();
  const prof = (id, role, name, sport, type, extra = {}) => ({ id, role, name, sport, account_type: type, coach_id: null, guardian_id: null, invite_code: null, family_code: "F" + id.slice(-5).toUpperCase(), date_of_birth: null, phone: null, club: null, created_at: now, ...extra });
  const db = { users: {
      "coach@t.ie": { id: IDS.coach, email: "coach@t.ie", password: "secret12", meta: {} },
      "adult@t.ie": { id: IDS.adult, email: "adult@t.ie", password: "secret12", meta: {} },
      "parent@t.ie": { id: IDS.parent, email: "parent@t.ie", password: "secret12", meta: {} },
      "junior@t.ie": { id: IDS.junior, email: "junior@t.ie", password: "secret12", meta: {} } },
    profiles: {
      [IDS.coach]: prof(IDS.coach, "coach", "Niamh Byrne", "golf", "coach", { invite_code: "QW7X2M" }),
      [IDS.adult]: prof(IDS.adult, "player", "Cian Murphy", "golf", "adult", { coach_id: IDS.coach, date_of_birth: "1991-04-04" }),
      [IDS.parent]: prof(IDS.parent, "player", "Orla Kelly", "golf", "parent"),
      [IDS.junior]: prof(IDS.junior, "player", "Saoirse Kelly", "golf", "junior", { coach_id: IDS.coach, guardian_id: IDS.parent, date_of_birth: "2013-09-09" }) },
    log: [], posts: [], patches: [] };
  const nameOf = (id) => (db.profiles[id] || {}).name || null;
  const lesson = (id, playerId, date, focus, subs, notes, v, a) => ({
    id, coach_id: IDS.coach, player_id: playerId, group_name: null, kind: "private", focus, subs, notes, lesson_date: date,
    unread: true, rating_requested: false, created_at: `${date}T10:00:00Z`, d: date.slice(8), m: MON[Number(date.slice(5, 7)) - 1],
    videos: v, photos: 0, audio: a, media: v + a, who: nameOf(playerId), coach_name: "Niamh Byrne" });
  db.lessons = [
    lesson(LESSON.new, IDS.adult, "2026-09-01", "Short game", ["Chipping"], "Cleaner contact from the fringe.", 0, 0),
    lesson(LESSON.old, IDS.adult, "2026-08-20", "Putting", ["Lag putting"], "Pace on the long ones first.", 1, 1),
    lesson(LESSON.jun, IDS.junior, "2026-08-28", "Grip", [], "Left hand a touch stronger.", 0, 0),
  ];
  db.media = [
    { id: MEDIA.vid, lesson_id: LESSON.old, kind: "video", storage_path: `${IDS.coach}/${LESSON.old}/1-swing.mp4`, created_at: "2026-08-20T10:01:00Z" },
    { id: MEDIA.aud, lesson_id: LESSON.old, kind: "audio", storage_path: `${IDS.coach}/${LESSON.old}/2-note.webm`, created_at: "2026-08-20T10:02:00Z" },
  ];
  db.messages = [
    { id: "30000000-0000-4000-8000-000000000001", coach_id: IDS.coach, player_id: IDS.adult, sender_id: IDS.coach, body: "See you Tuesday at nine.", read_at: "2026-09-01T09:00:00Z", created_at: "2026-09-01T08:00:00Z" },
    { id: "30000000-0000-4000-8000-000000000002", coach_id: IDS.coach, player_id: IDS.adult, sender_id: IDS.adult, body: "Grand, thanks Niamh.", read_at: null, created_at: "2026-09-01T08:30:00Z" },
  ];
  db.bookings = [
    { id: "50000000-0000-4000-8000-000000000001", coach_id: IDS.coach, player_id: IDS.adult, group_name: null, booking_date: TODAY, start_time: "9:00 am", duration: 45, kind: "private", status: "confirmed", created_at: now },
    { id: "50000000-0000-4000-8000-000000000002", coach_id: IDS.coach, player_id: IDS.junior, group_name: null, booking_date: TODAY, start_time: "10:30 am", duration: 45, kind: "private", status: "confirmed", created_at: now },
    { id: "50000000-0000-4000-8000-000000000003", coach_id: IDS.coach, player_id: IDS.adult, group_name: null, booking_date: TODAY, start_time: "4:00 pm", duration: 45, kind: "private", status: "requested", created_at: now },
  ];
  return db;
}
function session(u) { const exp = Math.floor(Date.now() / 1000) + 86400; const token = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  return { access_token: token, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "rt_" + u.id, user: { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: u.meta, identities: [{ id: u.id, user_id: u.id, provider: "email", identity_data: { email: u.email } }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } }; }
function attach(page, db) {
  page.route("https://api.fontshare.com/**", (r) => r.abort());
  page.route(`${SB}/**`, async (route) => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method(), hdr = req.headers();
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: body === undefined ? "" : JSON.stringify(body) });
    const me = () => { try { return JSON.parse(Buffer.from((hdr["authorization"] || "").replace(/^Bearer\s+/i, "").split(".")[1], "base64url")).sub; } catch { return null; } };
    const body = (() => { try { return JSON.parse(req.postData() || "null"); } catch { return null; } })();
    db.log.push(`${method} ${p}${url.search}`);
    if (method === "OPTIONS") return json(200, undefined);
    if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") { const u = Object.values(db.users).find((x) => "rt_" + x.id === body.refresh_token); return u ? json(200, session(u)) : json(400, { msg: "bad" }); }
    if (p === "/auth/v1/user" && method === "GET") { const u = Object.values(db.users).find((x) => x.id === me()); return u ? json(200, session(u).user) : json(401, { msg: "invalid JWT" }); }
    if (p === "/auth/v1/logout") return json(204, undefined);
    const wantObject = /vnd\.pgrst\.object\+json/.test(hdr["accept"] || "");
    const respond = (rows) => wantObject ? (rows.length === 1 ? json(200, rows[0]) : json(406, { code: "PGRST116", message: "no rows" })) : json(200, rows);
    const meId = me(); const mine = db.profiles[meId]; const isCoach = mine && mine.role === "coach";
    const famIds = Object.values(db.profiles).filter((x) => x.guardian_id === meId).map((x) => x.id);
    const seesPlayer = (pid) => pid === meId || famIds.includes(pid);
    const eqOf = (name) => { const v = url.searchParams.get(name); return v && v.startsWith("eq.") ? v.slice(3) : null; };
    if (p.startsWith("/rest/v1/rpc/")) { const fn = p.split("/").pop(); if (fn === "find_coach_by_code") { const c = String(body.p_code || "").trim().toUpperCase(); return json(200, Object.values(db.profiles).filter((x) => x.role === "coach" && x.invite_code === c).map((x) => ({ id: x.id, sport: x.sport, name: x.name }))); } return json(200, null); }
    if (p === "/rest/v1/profiles") {
      const visible = Object.values(db.profiles).filter((x) => meId && (x.id === meId || x.coach_id === meId || x.guardian_id === meId || (mine && (x.id === mine.coach_id || x.id === mine.guardian_id)) || (famIds.includes(x.id)) || (x.role === "coach" && famIds.some((f) => db.profiles[f].coach_id === x.id))));
      const idEq = eqOf("id"); const rows = idEq ? visible.filter((x) => x.id === idEq) : visible;
      if (method === "GET") return respond(rows); if (method === "PATCH") { const upd = rows.filter((x) => x.id === meId); upd.forEach((x) => Object.assign(x, body)); return json(200, upd); } }
    const lessonVisible = (l) => isCoach ? l.coach_id === meId : seesPlayer(l.player_id);
    if (p === "/rest/v1/lessons_view" && method === "GET") return respond(db.lessons.filter(lessonVisible).sort((a, b) => (a.lesson_date < b.lesson_date ? 1 : -1)));
    if (p === "/rest/v1/lesson_media" && method === "GET") { const lid = eqOf("lesson_id"); return respond(db.media.filter((m) => (!lid || m.lesson_id === lid) && db.lessons.some((l) => l.id === m.lesson_id && lessonVisible(l)))); }
    if (p === "/rest/v1/lessons" && method === "POST") { const row = { id: uuid(), created_at: new Date().toISOString(), unread: true, ...body }; db.posts.push({ table: "lessons", rows: [row], by: meId }); return wantObject ? json(201, row) : json(201, [row]); }
    if (p === "/rest/v1/lesson_media" && method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: uuid(), created_at: new Date().toISOString(), ...r })); db.media.push(...rows); db.posts.push({ table: "lesson_media", rows }); return json(201, rows); }
    if (p === "/rest/v1/messages") {
      const vis = db.messages.filter((m) => isCoach ? m.coach_id === meId : seesPlayer(m.player_id));
      if (method === "GET") return respond(vis);
      if (method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: uuid(), read_at: null, created_at: new Date().toISOString(), ...r })); db.messages.push(...rows); db.posts.push({ table: "messages", rows, by: meId }); return json(201, rows); }
      if (method === "PATCH") { const pid = eqOf("player_id"); const neq = (url.searchParams.get("sender_id") || "").replace(/^neq\./, ""); const upd = db.messages.filter((m) => (!pid || m.player_id === pid) && (!neq || m.sender_id !== neq) && !m.read_at); upd.forEach((m) => Object.assign(m, body)); db.patches.push({ table: "messages", query: url.search, body, n: upd.length, by: meId }); return json(200, upd.map((m) => ({ id: m.id }))); }
    }
    if (p === "/rest/v1/bookings" && method === "GET") return respond(db.bookings.filter((b) => isCoach ? b.coach_id === meId : seesPlayer(b.player_id)));
    if (p === "/rest/v1/attendance_sessions" && method === "POST") { const row = { id: uuid(), session_date: TODAY, ...body }; db.posts.push({ table: "attendance_sessions", rows: [row], by: meId }); return wantObject ? json(201, row) : json(201, [row]); }
    if (p === "/rest/v1/attendance_marks" && method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: uuid(), ...r })); db.posts.push({ table: "attendance_marks", rows, by: meId }); return json(201, rows); }
    if (p === "/storage/v1/object/sign/media" && method === "POST") { const paths = (body && body.paths) || []; db.posts.push({ table: "sign", rows: paths }); return json(200, paths.map((pth) => ({ error: null, path: pth, signedURL: `/object/sign/media/${pth}?token=t-${pth.split("/").pop()}` }))); }
    if (p.startsWith("/storage/v1/object/sign/media/") && method === "GET") { const mp4 = p.endsWith(".mp4"); return route.fulfill({ status: 200, contentType: mp4 ? "video/mp4" : "audio/webm", headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes" }, body: mp4 ? MP4 : WEBM }); }
    if (p.startsWith("/storage/v1/object/media/") && method === "POST") { db.posts.push({ table: "upload", rows: [p] }); return json(200, { Key: p.replace("/storage/v1/object/", "") }); }
    if (p.startsWith("/rest/v1/") && method === "GET") return wantObject ? json(406, { code: "PGRST116", message: "no rows" }) : json(200, []);
    if (p.startsWith("/rest/v1/")) { const rows = Array.isArray(body) ? body : [body || {}]; db.posts.push({ table: p.split("/").pop(), rows, by: meId }); return wantObject ? json(201, rows[0]) : json(201, rows); }
    return json(404, { message: "not mocked: " + p });
  });
}
async function startServer() { const child = spawn("npx", ["vite", "preview", "--outDir", distDir, "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("no server")), 20000); child.stdout.on("data", (d) => { if (String(d).includes("localhost")) { clearTimeout(t); res(); } }); }); return child; }
const norm = (s) => s.replace(/\s+/g, " ").trim();
const allowedFor = { coach: ["Niamh Byrne", "Cian Murphy", "Saoirse Kelly", "QW7X2M"], adult: ["Cian Murphy", "Niamh Byrne"], parent: ["Orla Kelly", "Saoirse Kelly", "Niamh Byrne"], junior: ["Saoirse Kelly", "Orla Kelly", "Niamh Byrne"] };

const results = []; const leaks = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  — ${detail}` : ""}`); };

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errorsByRole = {};
  const boot = async (role) => {
    const db = freshDb(); const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage();
  /* the day is real but the hour is pinned to 08:00, so the two morning bookings are always still ahead and the register offers both */
  await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); attach(page, db);
    errorsByRole[role] = errorsByRole[role] || []; page.on("pageerror", (e) => errorsByRole[role].push(String(e.message || e)));
    await page.addInitScript(([key, sess]) => { try { localStorage.setItem(key, JSON.stringify(sess)); localStorage.setItem("nosca.seen." + sess.user.id, "1"); } catch {} }, ["nosca.auth", session(u)]);
    await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(7200);
    const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(400); }
    const text = async () => norm(await page.evaluate(() => document.getElementById("root").innerText));
    const leak = async (label) => { const tx = await text(); for (const s of SEEDED) if (tx.includes(s) && !(allowedFor[role] || []).includes(s)) leaks.push({ role, screen: label, seeded: s }); return tx; };
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { db, ctx, page, text, leak, shot };
  };
  /* The tab bar swallows a click that lands within 150ms of its own
     pointerup (its drag handling), which is exactly what a synthetic
     tap does — so tabs are clicked as the DOM event, like the sweep. */
  const tap = async (page, sel) => { await page.locator(sel).first().dispatchEvent("click"); await page.waitForTimeout(700); };
  const byText = (page, t) => page.locator("button", { hasText: t }).first();

  try {
    /* ---------- (a)+(b) adult player: second lesson, real media, download ---------- */
    {
      const { db, ctx, page, text, leak, shot } = await boot("adult");
      await leak("adult home"); await shot("adult-home");
      await tap(page, '[aria-label="Lessons"]');
      if (await page.locator('[aria-label="list"]').count()) await tap(page, '[aria-label="list"]');
      const listText = await leak("adult lessons list"); await shot("adult-lessons");
      check("(a) list shows both lessons, newest first", /Short game.*Putting/.test(listText), listText.slice(0, 200));
      /* the row, not the "Putting" filter chip above the list */
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
      check("(a) signed URLs were requested once per lesson (cached)", db.posts.filter((x) => x.table === "sign").length === 1, String(db.posts.filter((x) => x.table === "sign").length));
      await shot("adult-lesson-audio");
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }).catch(() => null), page.locator('[aria-label="Download lesson log"]').click()]);
      const file = dl ? await dl.path() : null; const html = file ? fs.readFileSync(file, "utf8") : "";
      check("(b) Download lesson log fires a download of an .html file", !!dl && /\.html$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : "no download");
      check("(b) the file carries the lesson's focus, notes, coach and media links", html.includes("Putting") && html.includes("Pace on the long ones first.") && html.includes("Niamh Byrne") && html.includes("1-swing.mp4") && html.includes("Voice note"), html.slice(0, 200));
      check("(b) the file carries no seeded text", !SEEDED.some((s) => html.includes(s)), SEEDED.filter((s) => html.includes(s)).join(","));
      if (dl) fs.copyFileSync(file, path.join(outDir, "lesson-log.html"));
      await page.waitForTimeout(600);
      check("(1) the opened lesson has a Back control (pop is wired)", (await page.locator('[aria-label="Back"]').count()) === 1);
      await shot("adult-after-download");
      /* Settings → Lesson logs */
      await tap(page, '[aria-label="Back"]'); await tap(page, '[aria-label="Your profile"]');
      await byText(page, "Lesson logs").click(); await page.waitForTimeout(700);
      const t2 = await leak("adult lesson logs"); await shot("adult-lesson-logs");
      check("(b) Settings → Lesson logs lists the person's lessons with Download", t2.includes("Short game") && t2.includes("Putting") && (await page.getByRole("button", { name: /Download Putting/ }).count()) === 1, t2.slice(0, 200));
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

    /* ---------- (c) coach chat, (d) attendance, (e) log a lesson ---------- */
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
      check("(d) Attendance lists today's real confirmed bookings by name", t4.includes("Cian Murphy") && t4.includes("9:00 am") && t4.includes("Saoirse Kelly") && t4.includes("10:30 am") && !t4.includes("4:00 pm"), t4.slice(0, 240));
      await byText(page, "Cian Murphy").click(); await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Present", exact: true }).first().click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: /Submit register/ }).click(); await page.waitForTimeout(1200);
      const sess = db.posts.find((x) => x.table === "attendance_sessions"); const marks = db.posts.find((x) => x.table === "attendance_marks");
      check("(d) submitting posts attendance_sessions + attendance_marks with real ids", !!sess && sess.rows[0].label === "Cian Murphy" && sess.rows[0].coach_id === IDS.coach && !!marks && marks.rows[0].player_id === IDS.adult && marks.rows[0].state === "in", JSON.stringify({ sess: sess && sess.rows[0], marks: marks && marks.rows }));
      await page.waitForTimeout(2200);

      /* Live capture sheet: real day, holding pile */
      await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(7200);
      await tap(page, '[aria-label="Add"]');
      await byText(page, "Live capture").click(); await page.waitForTimeout(800);
      const t5 = await leak("coach live capture"); await shot("coach-live-capture");
      check("(5) Live capture files under today's real bookings or nobody", /filing under/i.test(t5) && t5.includes("Cian Murphy · 9:00 am") && t5.includes("Saoirse Kelly · 10:30 am") && t5.includes("Nobody yet"), t5.slice(0, 200));

      /* (e) log a lesson with a typed note */
      await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(7200);
      await tap(page, '[aria-label="Add"]');
      const logBtn = page.getByRole("button", { name: /log a lesson|log lesson/i }).first();
      await logBtn.click(); await page.waitForTimeout(800);
      await leak("wizard who"); await byText(page, "Cian Murphy").click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      await leak("wizard when");
      await page.fill('input[type="time"]', "10:00"); await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      await leak("wizard focus");
      await page.getByRole("button", { name: "Short game", exact: true }).click(); await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      const t6 = await leak("wizard notes"); await shot("coach-wizard-notes");
      check("(e) notes step offers a typed note and a real voice note, no transcript", t6.includes("Record a voice note") && (await page.locator('textarea[placeholder="What happened, in a line or two"]').count()) === 1 && !t6.includes("Tap to record"), t6.slice(0, 200));
      await page.fill('textarea[placeholder="What happened, in a line or two"]', "Worked on tempo from a hundred yards.");
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
      const t7 = await leak("wizard media"); await shot("coach-wizard-media");
      check("(e) media step: Record / Library / Photo / Captured, no device readout", t7.includes("Record") && t7.includes("Library") && t7.includes("Photo") && t7.includes("Captured") && !/TrackMan|Serve radar|Launch/i.test(t7) && (await page.locator('input[type="file"]').count()) >= 1, t7.slice(0, 200));
      await page.getByRole("button", { name: "Publish", exact: true }).first().click(); await page.waitForTimeout(1500);
      const lp = db.posts.find((x) => x.table === "lessons"); const lrow = lp && lp.rows[0];
      check("(e) the lessons insert carries today's date and the typed note only", !!lrow && lrow.lesson_date === TODAY && lrow.notes === "Worked on tempo from a hundred yards." && lrow.focus === "Short game" && lrow.player_id === IDS.adult && lrow.coach_id === IDS.coach, JSON.stringify(lrow));
      const t8 = await leak("published burst"); await shot("coach-burst");
      check("(e) the burst offers no seeded 'Log next' or rating pretence", !t8.includes("Dan Okafor") && !t8.includes("4 left"), t8.slice(0, 200));
      await page.waitForTimeout(2800);
      /* history → the real lesson opens by id */
      await tap(page, '[aria-label="Roster"]');
      await page.locator('[aria-label="Cian Murphy history"]').click(); await page.waitForTimeout(800);
      await leak("coach player history");
      await byText(page, "Putting").click(); await page.waitForTimeout(1200);
      const t10 = await leak("coach lesson view"); await shot("coach-lesson-view");
      check("(1) coach opens the tapped lesson by id with its real notes and media", t10.includes("Putting") && t10.includes("Pace on the long ones first.") && !t10.includes("Distance control") && (await page.locator("video[controls]").count()) === 1 && t10.includes("Download lesson log"), t10.slice(0, 240));
      /* Settings → Lesson logs (coach) */
      await tap(page, '[aria-label="Back"]'); await tap(page, '[aria-label="Back"]'); await tap(page, '[aria-label="Your profile"]');
      await byText(page, "Lesson logs").click(); await page.waitForTimeout(700);
      const t11 = await leak("coach lesson logs"); await shot("coach-lesson-logs");
      check("(3) coach Lesson logs lists every lesson with who", t11.includes("Putting") && t11.includes("Cian Murphy") && t11.includes("Grip") && t11.includes("Saoirse Kelly"), t11.slice(0, 200));
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
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    results.push({ name: "run completed", ok: false, detail: String(e && e.message || e) });
  } finally { await browser.close(); try { process.kill(-server.pid, "SIGTERM"); } catch {} }

  const errs = Object.entries(errorsByRole).map(([r, es]) => [r, es.filter((e) => !/vibrate/.test(e))]);
  for (const [r, es] of errs) { check(`(f) no page errors as ${r}`, es.length === 0, es.slice(0, 3).join(" | ")); }
  check("(f) no seeded string on any screen touched", leaks.length === 0, leaks.map((l) => `${l.role}:${l.screen}:${l.seeded}`).join(" ; "));
  fs.writeFileSync(path.join(outDir, "core.json"), JSON.stringify({ results, leaks }, null, 2));
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})();
