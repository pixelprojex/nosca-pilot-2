/* PASS C2 — DIARY, DRILLS, TIPS, COMPETITIONS, RECURRING, DETAILS, HONESTY.
   Derived from sweep.cjs: a session is injected per role and Supabase is
   mocked — here with a database shared across the roles, so what the
   player requests is what the coach accepts. Usage:
     node run-diary.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4197), BASE = `http://localhost:${PORT}`, SB = "https://mock.supabase.co";
const ROOT = require("path").resolve(__dirname, "../..");
/* FIXED_TIME=2026-11-15T10:30:00 runs the browser (and the mock's clock) from that moment */
const FIXED = process.env.FIXED_TIME ? new Date(process.env.FIXED_TIME) : null;
const nowMs = () => (FIXED ? FIXED.getTime() : Date.now());
fs.mkdirSync(outDir, { recursive: true });
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

const SEEDED = ["Ray Doyle", "ray@hollowbrook", "+353 87 123 4567", "Marcus Tran", "Priya Ellis", "Dan Okafor", "Sofia Reyes",
  "Tom Beckett", "Hannah Doyle", "Hollowbrook", "RD4K9P", "TrackMan", "Breathnach", "Summer clinic", "Junior squad", "Ladies group",
  "Captain's Prize", "Club Championship", "Garda", "Safeguarding", "Face-on", "Down the line", "Marcus T.", "Priya E.", "Dan O.", "1284",
  "24 Jul", "Friday 24", "Apple Health", "Keep at what we worked on"];
const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date(nowMs()));
let seq = 0; const uuid = () => `40000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function freshDb() {
  const now = new Date().toISOString();
  const prof = (id, role, name, sport, type, extra = {}) => ({ id, role, name, sport, account_type: type, coach_id: null, guardian_id: null, invite_code: null, family_code: "F" + id.slice(-5).toUpperCase(), date_of_birth: null, phone: null, club: null, created_at: now, ...extra });
  return { users: {
      "coach@t.ie": { id: IDS.coach, email: "coach@t.ie", password: "secret12", meta: {} },
      "adult@t.ie": { id: IDS.adult, email: "adult@t.ie", password: "secret12", meta: {} },
      "parent@t.ie": { id: IDS.parent, email: "parent@t.ie", password: "secret12", meta: {} },
      "junior@t.ie": { id: IDS.junior, email: "junior@t.ie", password: "secret12", meta: {} } },
    profiles: {
      [IDS.coach]: prof(IDS.coach, "coach", "Niamh Byrne", "golf", "coach", { invite_code: "QW7X2M" }),
      [IDS.adult]: prof(IDS.adult, "player", "Cian Murphy", "golf", "adult", { coach_id: IDS.coach, date_of_birth: "1991-04-04" }),
      [IDS.parent]: prof(IDS.parent, "player", "Orla Kelly", "golf", "parent"),
      [IDS.junior]: prof(IDS.junior, "player", "Saoirse Kelly", "golf", "junior", { coach_id: IDS.coach, guardian_id: IDS.parent, date_of_birth: "2013-09-09" }) },
    prefs: {},                     // id -> preferences row
    bookings: [], competitions: [], recurring: [], drills: [], tips: [],
    reviews: [{ id: uuid(), coach_id: IDS.coach, player_id: IDS.adult, rating: 5, comment: "Brilliant with the short game.", created_at: "2026-08-01T10:00:00Z" }],
    log: [], posts: [], patches: [], deletes: [], rpcs: [], auth: [] };
}
function session(u) { const exp = Math.floor(nowMs() / 1000) + 86400; const token = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
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
    if (p === "/auth/v1/user" && method === "PUT") { const u = Object.values(db.users).find((x) => x.id === me()); db.auth.push({ method, body, by: me() }); if (u && body && body.password) u.password = body.password; return u ? json(200, session(u).user) : json(401, { msg: "invalid JWT" }); }
    if (p === "/auth/v1/logout") return json(204, undefined);
    const wantObject = /vnd\.pgrst\.object\+json/.test(hdr["accept"] || "");
    const respond = (rows) => wantObject ? (rows.length === 1 ? json(200, rows[0]) : json(406, { code: "PGRST116", message: "no rows" })) : json(200, rows);
    const created = (rows) => wantObject ? json(201, rows[0]) : json(201, rows);
    const meId = me(); const mine = db.profiles[meId]; const isCoach = mine && mine.role === "coach";
    const famIds = Object.values(db.profiles).filter((x) => x.guardian_id === meId).map((x) => x.id);
    const seesPlayer = (pid) => pid === meId || famIds.includes(pid);
    const eqOf = (name) => { const v = url.searchParams.get(name); return v && v.startsWith("eq.") ? v.slice(3) : null; };
    const table = p.replace("/rest/v1/", "");
    const visible = (rows) => rows.filter((r) => isCoach ? r.coach_id === meId : seesPlayer(r.player_id) || (r.kind === "group" && r.coach_id === (mine && mine.coach_id)));
    const filtered = (rows) => { const id = eqOf("id"); return id ? rows.filter((r) => r.id === id) : rows; };

    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop(); db.rpcs.push({ fn, body, by: meId });
      if (fn === "find_coach_by_code") { const c = String(body.p_code || "").trim().toUpperCase(); return json(200, Object.values(db.profiles).filter((x) => x.role === "coach" && x.invite_code === c).map((x) => ({ id: x.id, sport: x.sport, name: x.name }))); }
      if (fn === "coach_availability") { const c = mine && mine.coach_id; return json(200, (c && db.prefs[c] && db.prefs[c].availability) || {}); }
      if (fn === "join_coach") { const c = String(body.p_code || "").trim().toUpperCase(); const coach = Object.values(db.profiles).find((x) => x.role === "coach" && x.invite_code === c); if (!coach) return json(400, { message: "No coach has that code." }); mine.coach_id = coach.id; return json(200, { id: coach.id, name: coach.name, sport: coach.sport }); }
      return json(200, null);
    }
    if (table === "profiles") {
      const vis = Object.values(db.profiles).filter((x) => meId && (x.id === meId || x.coach_id === meId || x.guardian_id === meId || (mine && (x.id === mine.coach_id || x.id === mine.guardian_id)) || famIds.includes(x.id) || (x.role === "coach" && famIds.some((f) => db.profiles[f].coach_id === x.id))));
      const rows = filtered(vis);
      if (method === "GET") return respond(rows);
      if (method === "PATCH") { const upd = rows.filter((x) => x.id === meId); upd.forEach((x) => Object.assign(x, body)); db.patches.push({ table, query: url.search, body, n: upd.length, by: meId }); return json(200, upd); }
    }
    if (table === "preferences") {
      if (method === "GET") { const id = eqOf("id"); const row = id === meId ? db.prefs[meId] : null; return respond(row ? [row] : []); }
      if (method === "POST") { const row = { ...(db.prefs[body.id] || {}), ...body }; db.prefs[body.id] = row; db.posts.push({ table, rows: [row], by: meId, prefer: hdr["prefer"] || "" }); return created([row]); }
    }
    const stores = { bookings: db.bookings, competitions: db.competitions, recurring: db.recurring, drills: db.drills, tips: db.tips, reviews: db.reviews };
    if (stores[table]) {
      const store = stores[table];
      if (method === "GET") return respond(visible(store));
      if (method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: uuid(), created_at: new Date().toISOString(), ...(table === "drills" ? { done: false } : {}), ...r })); store.push(...rows); db.posts.push({ table, rows, by: meId }); return created(rows); }
      if (method === "PATCH") { const upd = filtered(visible(store)); upd.forEach((r) => Object.assign(r, body)); db.patches.push({ table, query: url.search, body, n: upd.length, by: meId }); return json(200, upd); }
      if (method === "DELETE") { const gone = filtered(visible(store)); gone.forEach((r) => store.splice(store.indexOf(r), 1)); db.deletes.push({ table, query: url.search, rows: gone, by: meId }); return json(200, gone); }
    }
    if (p.startsWith("/rest/v1/") && method === "GET") return wantObject ? json(406, { code: "PGRST116", message: "no rows" }) : json(200, []);
    if (p.startsWith("/rest/v1/")) { const rows = Array.isArray(body) ? body : [body || {}]; db.posts.push({ table, rows, by: meId }); return created(rows); }
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
  const db = freshDb();                       // one database, every role
  const errorsByRole = {};
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage(); attach(page, db);
    if (FIXED) await page.addInitScript((t0) => { const Real = Date; const started = Real.now();
      class Shifted extends Real { constructor(...a) { if (a.length === 0) super(t0 + (Real.now() - started)); else super(...a); } static now() { return t0 + (Real.now() - started); } }
      window.Date = Shifted; }, FIXED.getTime());
    errorsByRole[role] = errorsByRole[role] || []; page.on("pageerror", (e) => errorsByRole[role].push(String(e.message || e)));
    await page.addInitScript(([key, sess]) => { try { localStorage.setItem(key, JSON.stringify(sess)); localStorage.setItem("nosca.seen." + sess.user.id, "1"); } catch {}
      window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; };
      window.__navs = []; }, ["nosca.auth", session(u)]);
    await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(7200);
    const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(400); }
    const text = async () => norm(await page.evaluate(() => document.getElementById("root").innerText));
    const leak = async (label) => { const tx = await text(); for (const s of SEEDED) if (tx.includes(s) && !(allowedFor[role] || []).includes(s)) leaks.push({ role, screen: label, seeded: s }); return tx; };
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text, leak, shot };
  };
  const tap = async (page, sel) => { await page.locator(sel).first().dispatchEvent("click"); await page.waitForTimeout(700); };
  const byText = (page, t) => page.locator("button", { hasText: t }).first();
  const click = async (page, t, wait = 800) => { await byText(page, t).click(); await page.waitForTimeout(wait); };
  const back = async (page) => { if (await page.locator('[aria-label="Back"]').count()) { await tap(page, '[aria-label="Back"]'); } };
  const last = (arr, table) => arr.filter((x) => x.table === table).slice(-1)[0];

  try {
    /* ---------- (g) a player whose coach has set nothing sees no invented slots ---------- */
    {
      const { ctx, page, leak, shot } = await boot("adult");
      await leak("adult home"); await shot("01-adult-home");
      await tap(page, '[aria-label="Diary"]');
      const t1 = await leak("adult diary — no hours"); await shot("02-adult-diary-nohours");
      check("(g) player sees 'hasn't set times yet' when the coach has no hours", t1.includes("Your coach hasn't set times yet."), t1.slice(0, 200));
      check("(g) no invented slots: no Request buttons, no 'open' counts", (await page.locator('[data-tour="agenda-book"]').count()) === 0 && !/\d+ open/.test(t1), t1.slice(0, 200));
      check("(j) no seeded '31 July 4:30 pm' booking on the player's home/diary", !t1.includes("4:30") && !t1.includes("Your lesson"), t1.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (g) the coach sets their hours; (b) books someone in and cancels ---------- */
    {
      const { ctx, page, leak, shot, text } = await boot("coach");
      const home = await leak("coach today"); await shot("03-coach-today");
      check("(d) coach Today carries no seeded competitions", !home.includes("Club Championship") && !home.includes("Captain's Prize"), home.slice(0, 200));
      await tap(page, '[aria-label="Your profile"]');
      await click(page, "Weekly availability");
      const t0 = await leak("coach availability"); await shot("04-coach-availability-empty");
      check("(g) a real coach starts with an empty week (no DEFAULT_AVAIL)", !/\d+ slots a week/.test(t0) || /^.*\b0 slots a week/.test(t0), t0.slice(0, 160));
      const toggles = page.locator('[data-tour="avail-days"] button[aria-pressed]');
      const n = await toggles.count();
      for (let i = 0; i < n; i++) { const tg = toggles.nth(i); if ((await tg.getAttribute("aria-pressed")) !== "true") { await tg.click(); await page.waitForTimeout(150); } }
      await click(page, "Save", 1200);
      const pref = last(db.posts, "preferences");
      const days = pref && pref.rows[0].availability && pref.rows[0].availability.days;
      check("(g) Save upserts preferences.availability with the week's hours", !!days && Object.values(days).some((x) => x.length) && /merge-duplicates/.test(pref.prefer) && pref.rows[0].id === IDS.coach, JSON.stringify(pref && pref.rows[0].availability).slice(0, 200));
      await shot("05-coach-availability-saved");
      /* the diary now has open rows; book Cian into the first one */
      await back(page); await tap(page, '[aria-label="Diary"]');
      const t1 = await leak("coach diary"); await shot("06-coach-diary");
      check("(b) coach diary lists the real week, no seeded names", (await page.locator('[data-tour="agenda-book"]').count()) > 0 && !SEEDED.some((s) => t1.includes(s)), t1.slice(0, 200));
      {
        const want = new Date(nowMs()).toLocaleDateString("en-IE", { month: "long", year: "numeric" });
        await click(page, "Calendar"); const tm = await text(); await shot("06b-coach-diary-month");
        check(`(k) the month view opens on the current month (${want})`, tm.includes(want), tm.slice(0, 200));
        await click(page, "List");
      }
      await tap(page, '[data-tour="agenda-book"]');
      const t2 = await text(); await shot("07-coach-bookwho");
      check("(b) Book someone in lists the real roster", t2.includes("Book someone in") && t2.includes("Cian Murphy") && !t2.includes("Marcus Tran"), t2.slice(0, 200));
      await click(page, "Cian Murphy", 1500);
      const b1 = last(db.posts, "bookings");
      check("(b) Book someone in POSTs a confirmed booking for that player", !!b1 && b1.rows[0].status === "confirmed" && b1.rows[0].player_id === IDS.adult && b1.rows[0].coach_id === IDS.coach && /^\d{4}-\d{2}-\d{2}$/.test(b1.rows[0].booking_date), JSON.stringify(b1 && b1.rows[0]));
      await page.waitForTimeout(2200);
      const t3 = await leak("coach diary after booking"); await shot("08-coach-diary-booked");
      check("(b) the booking shows in the coach's diary from the database", (await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).count()) > 0, t3.slice(0, 200));
      /* open it, Move -> cancel with a reason */
      await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const t4 = await leak("coach peek"); await shot("09-coach-peek");
      check("(b) the peek sheet shows no invented past lessons", !t4.includes("Short game") && !t4.includes("14 Jun"), t4.slice(0, 200));
      await click(page, "Move");
      await page.locator("button", { hasText: /Ill|sick|Weather|Something/i }).first().click(); await page.waitForTimeout(300);
      await click(page, "Next");
      await click(page, "Cancel the lesson", 1500);
      const c1 = last(db.patches, "bookings");
      check("(b) Cancel PATCHes the booking to cancelled", !!c1 && c1.body.status === "cancelled" && c1.query.includes(`id=eq.${b1.rows[0].id}`) && c1.n === 1, JSON.stringify(c1));
      await page.waitForTimeout(2200);
      check("(b) a cancelled booking leaves the diary", (await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).count()) === 0);
      await shot("10-coach-diary-cancelled");
      await ctx.close();
    }

    /* ---------- (a) the player requests a slot ---------- */
    {
      const { ctx, page, leak, shot, text } = await boot("adult");
      await tap(page, '[aria-label="Diary"]');
      const t1 = await leak("adult diary — hours set"); await shot("11-adult-diary-hours");
      check("(g) the player's open slots come from the coach's saved hours", (await page.locator('[data-tour="agenda-book"]').count()) > 0 && !t1.includes("hasn't set times"), t1.slice(0, 200));
      check("(a) a real player is offered no 'Repeat' pills", !t1.includes("Fortnightly"), t1.slice(0, 200));
      await tap(page, '[data-tour="agenda-book"]');
      const t2 = await text(); await shot("12-adult-request-sheet");
      check("(a) the Request sheet opens", t2.includes("Request it"), t2.slice(0, 120));
      await click(page, "Request it", 1500);
      const r1 = last(db.posts, "bookings");
      check("(a) Request it POSTs a requested booking with the player's coach_id", !!r1 && r1.rows[0].status === "requested" && r1.rows[0].coach_id === IDS.coach && r1.rows[0].player_id === IDS.adult && r1.by === IDS.adult, JSON.stringify(r1 && r1.rows[0]));
      await page.waitForTimeout(2200); await shot("13-adult-after-request");
      await tap(page, '[aria-label="Home"]');
      const t3 = await leak("adult home after request"); await shot("14-adult-home-next");
      check("(a) Home 'Next' shows the real request", /next/i.test(t3) && t3.includes("Requested") && !t3.includes("4:30"), t3.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (a) the coach accepts it; (c) drills and focus; (d) competitions; (e) recurring; (f) details; (h) invite; (i) honesty ---------- */
    {
      const { ctx, page, leak, shot, text } = await boot("coach");
      await click(page, "Lesson requests");
      const t1 = await leak("coach requests"); await shot("15-coach-requests");
      check("(a) coach Today lists the player's real request", t1.includes("Cian Murphy") && t1.includes("Accept"), t1.slice(0, 200));
      const reqId = db.bookings.find((b) => b.status === "requested").id;
      await click(page, "Accept", 1500);
      const a1 = last(db.patches, "bookings");
      check("(a) Accept PATCHes the request to confirmed", !!a1 && a1.body.status === "confirmed" && a1.query.includes(`id=eq.${reqId}`) && a1.n === 1, JSON.stringify(a1));
      await page.waitForTimeout(2000);
      await tap(page, '[aria-label="Diary"]');
      const t2 = await leak("coach diary after accept"); await shot("16-coach-diary-accepted");
      check("(a) the accepted lesson is in the coach's diary", (await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).count()) > 0, t2.slice(0, 200));

      /* (c) drills from the roster */
      await tap(page, '[aria-label="Roster"]');
      await page.locator('[data-tour="roster-row"]').first().click(); await page.waitForTimeout(900);
      const t3 = await leak("coach player file"); await shot("17-coach-player");
      check("(c) the player file is the real person with no borrowed history", t3.includes("Cian Murphy") && !t3.includes("Short game"), t3.slice(0, 200));
      await click(page, "Set drills");
      const t4 = await text(); await shot("18-coach-assign");
      check("(c) the drill sheet is for that player", t4.includes("Drills for Cian"), t4.slice(0, 200));
      /* one library drill */
      await page.locator("button", { hasText: "Ladder drill" }).first().click(); await page.waitForTimeout(200);
      await page.locator("button", { hasText: /^Set \d drill/ }).first().click(); await page.waitForTimeout(1500);
      const d1 = last(db.posts, "drills");
      check("(c) Set drills POSTs a drill row per drill for the player", !!d1 && d1.rows.length >= 1 && d1.rows.every((r) => r.player_id === IDS.adult && r.coach_id === IDS.coach && r.title), JSON.stringify(d1 && d1.rows));
      /* (c) focus */
      await click(page, "More");
      await click(page, "What they're working on");
      await page.fill('input[placeholder="Short headline"]', "Tempo on the long irons");
      await click(page, "Set as their focus", 1500);
      const tp = last(db.posts, "tips");
      check("(c) Set as their focus POSTs a tip for the player, no canned body", !!tp && tp.rows[0].player_id === IDS.adult && tp.rows[0].title === "Tempo on the long irons" && !(tp.rows[0].body || "").includes("Keep at what"), JSON.stringify(tp && tp.rows[0]));
      await shot("19-coach-after-tip");
      /* (c) the Practice screen: real roster, real completion, rename + remove */
      /* a coach reaches Practice through a drill in search */
      await back(page);
      await tap(page, '[aria-label="Search"]');
      await page.fill('input[placeholder="Lessons, drills, tips, people"]', "gate"); await page.waitForTimeout(600);
      await page.locator("button", { hasText: "Alignment stick gate" }).first().click(); await page.waitForTimeout(1000);
      let t5 = await leak("coach practice"); await shot("20-coach-practice");
      check("(c) coach Practice lists the real roster with counts from real drills", t5.includes("Cian Murphy") && /1 of 1 done|0 of 1 done/.test(t5) && !t5.includes("Marcus Tran"), t5.slice(0, 240));
      if (t5.includes("This week")) {
        await click(page, "Cian Murphy");
        const inp = page.locator('input[aria-label="Drill name"]').first();
        if (await inp.count()) {
          await inp.fill("Renamed drill"); await inp.press("Enter"); await page.waitForTimeout(1200);
          const up = last(db.patches, "drills");
          check("(c) a coach can rename their own drill (PATCH drills)", !!up && up.body.title === "Renamed drill" && up.n === 1, JSON.stringify(up));
          await page.locator('[aria-label="Remove"]').first().click(); await page.waitForTimeout(1200);
          const del = last(db.deletes, "drills");
          check("(c) a coach can remove their own drill (DELETE drills)", !!del && del.rows.length === 1, JSON.stringify(del && del.query));
        } else check("(c) practice row expands to the player's drills", false, t5.slice(0, 200));
      }
      await shot("21-coach-practice-edited");

      /* (d) competitions */
      await tap(page, '[aria-label="Today"]');
      await click(page, "Competitions");
      await click(page, "Add a competition");
      const t6 = await leak("coach events"); await shot("22-coach-events-empty");
      check("(d) Ahead lists no seeded events for a real coach", !t6.includes("Club Championship") && !t6.includes("Captain's Prize") && t6.includes("Nothing coming up"), t6.slice(0, 200));
      await tap(page, '[aria-label="Add"]');
      await page.fill('input[placeholder="Name"]', "Autumn Medal");
      await page.fill('input[placeholder="DD"]', "28");
      await page.locator("button", { hasText: /^Add$/ }).last().click(); await page.waitForTimeout(1500);
      const cp = last(db.posts, "competitions");
      check("(d) Add POSTs a competition with a real ISO date", !!cp && cp.rows[0].name === "Autumn Medal" && /^\d{4}-\d{2}-28$/.test(cp.rows[0].event_date) && cp.rows[0].coach_id === IDS.coach, JSON.stringify(cp && cp.rows[0]));
      await page.waitForTimeout(1500);
      const t7 = await leak("coach events added"); await shot("23-coach-events-added");
      check("(d) the competition comes back from the database", t7.includes("Autumn Medal"), t7.slice(0, 200));
      await click(page, "Autumn Medal");
      await click(page, "Remove", 1500);
      const cd = last(db.deletes, "competitions");
      check("(d) remove DELETEs the competition", !!cd && cd.rows.length === 1 && cd.rows[0].name === "Autumn Medal", JSON.stringify(cd && cd.query));
      await shot("24-coach-events-removed");
      await back(page);

      /* (e) recurring */
      await tap(page, '[aria-label="Diary"]');
      await click(page, "Recurring lessons");
      const t8 = await leak("coach recurring manager"); await shot("25-coach-recurring-empty");
      check("(e) the manager starts empty for a real coach", t8.includes("None yet") && !t8.includes("Marcus Tran"), t8.slice(0, 200));
      await tap(page, '[data-tour="recur-add"]');
      await click(page, "Cian Murphy");
      const t9 = await text(); await shot("26-coach-recurring-setup");
      check("(e) the arrangement sheet is for the real player", t9.includes("Set up Cian"), t9.slice(0, 200));
      await page.locator("button", { hasText: /^Book \d+ lessons$/ }).first().click(); await page.waitForTimeout(2000);
      const rc = last(db.posts, "recurring"); const rb = last(db.posts, "bookings");
      check("(e) save POSTs a recurring row (weekday 0-6, cadence) for the player", !!rc && rc.rows[0].player_id === IDS.adult && rc.rows[0].cadence === "weekly" && rc.rows[0].weekday >= 0 && rc.rows[0].weekday <= 6 && rc.rows[0].start_time, JSON.stringify(rc && rc.rows[0]));
      check("(e) …and books the run out in the diary (10 confirmed bookings)", !!rb && rb.rows.length === 10 && rb.rows.every((r) => r.status === "confirmed" && r.player_id === IDS.adult), rb ? String(rb.rows.length) : "no bookings");
      await page.waitForTimeout(1500);
      const t10 = await leak("coach recurring listed"); await shot("27-coach-recurring-listed");
      check("(e) the manager lists the arrangement from the database", t10.includes("Cian Murphy") && t10.includes("1 running"), t10.slice(0, 200));
      await click(page, "End"); await click(page, "End it", 1500);
      const rd = last(db.deletes, "recurring");
      check("(e) End DELETEs the recurring row", !!rd && rd.rows.length === 1 && rd.rows[0].id === rc.rows[0].id, JSON.stringify(rd && rd.query));
      await shot("28-coach-recurring-ended");
      await back(page);

      /* (f) personal details and password */
      await tap(page, '[aria-label="Your profile"]');
      const you0 = await leak("coach you"); await shot("29-coach-you");
      check("(i) Paperwork, Connections, Subscription, sporting record are absent for a real coach", !you0.includes("Paperwork") && !you0.includes("Connections") && !you0.includes("Subscription") && !you0.includes("sporting record"), you0.slice(0, 300));
      check("(i) Help centre is offered when a support address is configured", you0.includes("Help centre"), you0.slice(0, 300));
      await click(page, "Personal details");
      const t11 = await leak("coach details"); await shot("30-coach-details");
      const nameVal = await page.locator('input[aria-label="Name"]').inputValue();
      check("(f) details show the real person, no qualifications/bio stubs", nameVal === "Niamh Byrne" && t11.includes("coach@t.ie") && !t11.includes("Qualifications") && !t11.includes("Bio") && !t11.includes("Ray Doyle"), `${nameVal} · ${t11.slice(0, 200)}`);
      await page.fill('input[aria-label="Name"]', "Niamh Byrne-Walsh");
      await page.fill('input[aria-label="Club"]', "Hollow Lane GC");
      await click(page, "Save", 2000);
      const pp = last(db.patches, "profiles");
      check("(f) Save PATCHes profiles with name and club", !!pp && pp.body.name === "Niamh Byrne-Walsh" && pp.body.club === "Hollow Lane GC" && pp.query.includes(`id=eq.${IDS.coach}`) && pp.n === 1, JSON.stringify(pp));
      const t12 = await text(); await shot("31-coach-you-renamed");
      check("(f) the header shows the new name after the profile refresh", t12.includes("Niamh Byrne-Walsh") && t12.includes("Hollow Lane GC"), t12.slice(0, 200));
      check("(f) saving did not throw the coach back to Today", t12.includes("Personal details") && t12.includes("Sign out"), t12.slice(0, 120));
      await click(page, "Personal details");
      await click(page, "Change password");
      await page.fill('input[aria-label="New password"]', "newpass123");
      await page.fill('input[aria-label="New password again"]', "newpass123");
      await page.locator("button", { hasText: /^Change password$/ }).last().click(); await page.waitForTimeout(1500);
      const au = db.auth.find((x) => x.method === "PUT");
      check("(f) Change password PUTs /auth/v1/user with the new password", !!au && au.body.password === "newpass123", JSON.stringify(au));
      await shot("32-coach-password");
      await back(page);

      /* (h) invite routes */
      await tap(page, '[aria-label="Roster"]');
      await page.locator("button", { hasText: "QW7X2M" }).first().click(); await page.waitForTimeout(900);
      const t13 = await text(); await shot("33-coach-invite-routes");
      const link = `${BASE}/?join=QW7X2M`;
      check("(h) the invite sheet shows the real join link", t13.includes("localhost") && t13.includes("?join=QW7X2M") && t13.includes("QW7X2M"), t13.slice(0, 200));
      check("(h) Pick from Contacts is not shown where the Contact Picker API is absent", !t13.includes("Pick from Contacts"), t13.slice(0, 200));
      await click(page, "WhatsApp", 400);
      const opened = await page.evaluate(() => window.__opened);
      check("(h) WhatsApp opens wa.me with the join link in the text", opened.length === 1 && opened[0].startsWith("https://wa.me/?text=") && decodeURIComponent(opened[0]).includes(link), JSON.stringify(opened));
      await click(page, "Copy link", 900);
      const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      check("(h) Copy link puts the real join link on the clipboard", clip === link, clip);

      /* (i) reviews, help, notifications */
      await tap(page, '[aria-label="Your profile"]');
      await click(page, "Reviews");
      const t14 = await leak("coach reviews"); await shot("34-coach-reviews");
      check("(i) Reviews shows the coach's real review, not testimonials", t14.includes("Cian Murphy") && t14.includes("Brilliant with the short game.") && t14.includes("5.0 · 1 reviews") && !t14.includes("Marcus T."), t14.slice(0, 200));
      await back(page);
      await click(page, "Help centre");
      const t15 = await leak("coach help"); await shot("35-coach-help");
      check("(i) Help has no FAQ stubs and points at the configured address", !t15.includes("How do I connect") && t15.includes("help@example.ie") && t15.includes("Report a problem"), t15.slice(0, 200));
      await back(page);
      await click(page, "Notifications");
      const t16 = await leak("coach notifications"); await shot("36-coach-notifications");
      check("(i) Notifications says nothing about push and offers only what persists", !/push/i.test(t16) && t16.includes("As they happen") && !t16.includes("Quiet hours"), t16.slice(0, 200));
      await click(page, "Once a day", 1200);
      const np = last(db.posts, "preferences");
      check("(i) picking a notify choice upserts preferences.notify", !!np && np.rows[0].notify === "digest", JSON.stringify(np && np.rows[0]).slice(0, 160));
      await ctx.close();
    }

    /* ---------- (j) the pill / family sheet for an adult and a parent ---------- */
    {
      const { ctx, page, leak, shot } = await boot("adult");
      await tap(page, '[data-tour="profile-pill"]');
      const t1 = await leak("adult family sheet"); await shot("37-adult-family-sheet");
      check("(j) adult sheet shows the real coach, never Ray Doyle / Marcus Tran", t1.includes("Niamh Byrne") && !t1.includes("Ray Doyle") && !t1.includes("Marcus Tran") && !t1.includes("Add a coach"), t1.slice(0, 200));
      await ctx.close();
    }
    {
      const { ctx, page, leak, shot } = await boot("parent");
      const t0 = await leak("parent home"); await shot("38-parent-home");
      await tap(page, '[data-tour="profile-pill"]');
      const t1 = await leak("parent family sheet"); await shot("39-parent-family-sheet");
      check("(j) parent sheet lists the real family and the child's real coach", t1.includes("Orla Kelly") && t1.includes("Saoirse Kelly") && t1.includes("Niamh Byrne") && !t1.includes("Marcus Tran") && !t1.includes("Ray Doyle") && !t1.includes("Ellie Tran"), t1.slice(0, 240));
      /* Add a coach through the real RPC */
      await click(page, "Add a coach");
      const t2 = await leak("parent add coach"); await shot("40-parent-add-coach");
      check("(j) Add a coach goes straight to a code, no sport pick", t2.includes("Coach code") && !t2.includes("Golf") , t2.slice(0, 200));
      await page.fill('input[aria-label="Coach code"]', "zz zzzz"); await page.waitForTimeout(300);
      check("(j) the code field takes letters and digits, upper-cased, six long", (await page.locator('input[aria-label="Coach code"]').inputValue()) === "ZZZZZZ");
      await page.locator("button", { hasText: /^Join$/ }).first().click(); await page.waitForTimeout(1200);
      const bad = db.rpcs.filter((x) => x.fn === "join_coach");
      const t3 = await leak("parent bad code");
      check("(j) an unknown code is refused by join_coach and the message shown", bad.length === 1 && bad[0].body.p_code === "ZZZZZZ" && t3.includes("No coach has that code."), t3.slice(0, 200));
      await shot("41-parent-bad-code");
      /* and the real code links them */
      await page.fill('input[aria-label="Coach code"]', "QW7X2M"); await page.waitForTimeout(200);
      await page.locator("button", { hasText: /^Join$/ }).first().click(); await page.waitForTimeout(2500);
      const good = db.rpcs.filter((x) => x.fn === "join_coach").slice(-1)[0];
      const t4 = await leak("parent joined"); await shot("42-parent-joined");
      check("(j) the real code calls join_coach and the profile now points at the coach", !!good && good.body.p_code === "QW7X2M" && db.profiles[IDS.parent].coach_id === IDS.coach && t4.includes("Niamh Byrne"), t4.slice(0, 200));
      await ctx.close();
    }
  } finally { await browser.close(); try { process.kill(-server.pid, "SIGTERM"); } catch {} }

  const errors = Object.entries(errorsByRole).flatMap(([r, es]) => es.filter((e) => !/vibrate/.test(e)).map((e) => `${r}: ${e}`));
  check("no seeded text on any visited screen", leaks.length === 0, leaks.map((l) => `${l.role}/${l.screen}: ${l.seeded}`).join(" | "));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ results, leaks, errors, log: db.log.slice(-200) }, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed · ${leaks.length} leak(s) · ${errors.length} page error(s)`);
  process.exit(failed ? 1 : 0);
})();
