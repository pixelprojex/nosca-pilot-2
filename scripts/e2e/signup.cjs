/* End-to-end proof of the reset sign-up / sign-in path against a mocked
   Supabase. Usage: node run-signup.cjs <distDir> <port> <outDir> [only]
   The mock behaves like the real database after nosca.sql: sign-up
   creates the profile via the "trigger" (resolving coach_code and
   family_code), RLS-like visibility on profiles, find_* / join_* /
   leave_* RPCs, recover / resend / PUT user, delete_my_account. */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const [distDir, portArg, outDir, onlyArg] = process.argv.slice(2);
const ONLY = (onlyArg || "").split(",").filter(Boolean);
/* headless artefacts, not app errors: aborted font CSS, and Chrome refusing vibrate() before a tap */
const IGNORED = /Failed to load resource|Blocked call to navigator\.vibrate/;
const PORT = Number(portArg || 4173);
const BASE = `http://localhost:${PORT}`;
const SB = "https://mock.supabase.co";
const COACH_ID = "00000000-0000-4000-8000-000000000c0a";
fs.mkdirSync(outDir, { recursive: true });

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uuid = () => "00000000-0000-4000-8000-" + String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
const code6 = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

function freshDb() {
  return {
    users: { "coach@example.ie": { id: COACH_ID, email: "coach@example.ie", password: "secret123", meta: { role: "coach", name: "Sinéad Walsh", sport: "tennis", account_type: "coach" } } },
    profiles: { [COACH_ID]: { id: COACH_ID, role: "coach", name: "Sinéad Walsh", sport: "tennis", account_type: "coach", coach_id: null, guardian_id: null, invite_code: "ABC234", family_code: "FAM777", date_of_birth: null, phone: null, club: null, created_at: "2026-01-01T00:00:00Z" } },
    signups: [],       // metadata the browser actually sent
    emails: [],        // recovery / confirmation mails the mock "sent"
    rpcs: [],          // rpc calls made
    userPuts: [],      // PUT /auth/v1/user bodies
    log: [],
  };
}

function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const token = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  const user = { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: u.meta, identities: [{ id: u.id, user_id: u.id, provider: "email", identity_data: { email: u.email } }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
  return { access_token: token, token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "rt_" + u.id, user };
}

/* the database trigger, in miniature */
function trigger(db, u) {
  const m = u.meta || {};
  let role = String(m.role || "player").toLowerCase(); if (!["coach", "player"].includes(role)) role = "player";
  const name = (m.name || "").trim() || u.email.split("@")[0];
  let coach = null;
  const code = String(m.coach_code || "").trim().toUpperCase();
  if (code) coach = Object.values(db.profiles).find((p) => p.role === "coach" && (p.invite_code || "").toUpperCase() === code) || null;
  const fcode = String(m.family_code || "").trim().toUpperCase();
  const guardian = fcode ? (Object.values(db.profiles).find((p) => (p.family_code || "").toUpperCase() === fcode) || null) : null;
  db.profiles[u.id] = { id: u.id, role, name, sport: (m.sport || "golf").toLowerCase(), account_type: m.account_type || null,
    date_of_birth: m.date_of_birth || null, phone: m.phone || null, coach_id: role === "player" && coach ? coach.id : null,
    guardian_id: role === "player" && guardian ? guardian.id : null, invite_code: role === "coach" ? code6() : null, family_code: code6(), club: null, created_at: new Date().toISOString() };
}

function attach(page, db, opts = {}) {
  const confirmOn = !!opts.confirmEmail;
  page.route("https://api.fontshare.com/**", (r) => r.abort());
  page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname, method = req.method();
    const hdr = req.headers();
    const json = (status, body, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", ...extra }, body: body === undefined ? "" : JSON.stringify(body) });
    const me = () => { const a = hdr["authorization"] || ""; const t = a.replace(/^Bearer\s+/i, ""); try { const pl = JSON.parse(Buffer.from(t.split(".")[1], "base64url")); return pl.sub; } catch { return null; } };
    const body = (() => { try { return JSON.parse(req.postData() || "null"); } catch { return null; } })();
    db.log.push(`${method} ${p}${url.search}`);
    if (method === "OPTIONS") return json(200, undefined);

    /* ---- auth ---- */
    if (p === "/auth/v1/signup" && method === "POST") {
      const email = (body.email || "").toLowerCase();
      db.signups.push(body);
      if (db.users[email]) {
        if (confirmOn) { const u = db.users[email]; return json(200, { ...session(u).user, identities: [], user_metadata: body.data }); }
        return json(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      }
      const u = { id: uuid(), email, password: body.password, meta: body.data || {} };
      db.users[email] = u; trigger(db, u);
      if (confirmOn) return json(200, { ...session(u).user, identities: [{ id: u.id, user_id: u.id, provider: "email", identity_data: { email } }], email_confirmed_at: null });
      return json(200, session(u));
    }
    if (p === "/auth/v1/token" && method === "POST") {
      if (url.searchParams.get("grant_type") === "password") {
        const u = db.users[(body.email || "").toLowerCase()];
        if (!u || u.password !== body.password) return json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return json(200, session(u));
      }
      if (url.searchParams.get("grant_type") === "refresh_token") {
        const u = Object.values(db.users).find((x) => "rt_" + x.id === body.refresh_token);
        if (!u) return json(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        return json(200, session(u));
      }
    }
    if (p === "/auth/v1/recover" && method === "POST") { db.emails.push({ kind: "recovery", to: (body.email || "").toLowerCase(), redirectTo: url.searchParams.get("redirect_to") }); return json(200, {}); }
    if (p === "/auth/v1/resend" && method === "POST") { db.emails.push({ kind: body.type || "signup", to: (body.email || "").toLowerCase() }); return json(200, {}); }
    if (p === "/auth/v1/user" && method === "PUT") { const id = me(); const u = Object.values(db.users).find((x) => x.id === id); if (!u) return json(401, { msg: "invalid JWT" }); db.userPuts.push(body); if (body.password) u.password = body.password; if (body.data) u.meta = { ...u.meta, ...body.data }; return json(200, session(u).user); }
    if (p === "/auth/v1/user" && method === "GET") { const id = me(); const u = Object.values(db.users).find((x) => x.id === id); return u ? json(200, session(u).user) : json(401, { msg: "invalid JWT" }); }
    if (p === "/auth/v1/logout") return json(204, undefined);

    /* ---- rest ---- */
    const wantObject = /vnd\.pgrst\.object\+json/.test(hdr["accept"] || "");
    const respond = (rows) => wantObject ? (rows.length === 1 ? json(200, rows[0]) : json(406, { code: "PGRST116", message: `JSON object requested, multiple (or no) rows returned`, details: `Results contain ${rows.length} rows` })) : json(200, rows, { "content-range": `0-${rows.length}/${rows.length}` });
    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop(); db.rpcs.push({ fn, args: body });
      if (fn === "find_coach_by_code") { const c = String(body.p_code || "").trim().toUpperCase(); const r = Object.values(db.profiles).filter((x) => x.role === "coach" && (x.invite_code || "").toUpperCase() === c).map((x) => ({ id: x.id, sport: x.sport, name: x.name })); return json(200, r); }
      if (fn === "find_guardian_by_code") { const c = String(body.p_code || "").trim().toUpperCase(); const r = Object.values(db.profiles).filter((x) => (x.family_code || "").toUpperCase() === c).map((x) => ({ id: x.id, name: x.name })); return json(200, r); }
      const human = (msg) => json(400, { code: "P0001", message: msg, details: null, hint: null });
      if (fn === "join_coach") { const id = me(); const mine = db.profiles[id]; if (!mine) return json(401, { message: "not signed in" }); const c = String(body.p_code || "").trim().toUpperCase(); const coach = Object.values(db.profiles).find((x) => x.role === "coach" && (x.invite_code || "").toUpperCase() === c); if (!coach) return human("That code doesn't match a coach."); if (coach.id === id) return human("That's your own code."); mine.coach_id = coach.id; return json(200, { id: coach.id, name: coach.name, sport: coach.sport }); }
      if (fn === "join_family") { const id = me(); const mine = db.profiles[id]; if (!mine) return json(401, { message: "not signed in" }); const c = String(body.p_code || "").trim().toUpperCase(); const g = Object.values(db.profiles).find((x) => (x.family_code || "").toUpperCase() === c); if (!g) return human("That code doesn't match a family."); if (g.id === id) return human("That's your own code."); mine.guardian_id = g.id; return json(200, { id: g.id, name: g.name, sport: g.sport }); }
      if (fn === "leave_coach") { const mine = db.profiles[me()]; if (mine) mine.coach_id = null; return json(204, undefined); }
      if (fn === "leave_family") { const mine = db.profiles[me()]; if (mine) mine.guardian_id = null; return json(204, undefined); }
      if (fn === "delete_my_account") { const id = me(); delete db.profiles[id]; for (const k of Object.keys(db.users)) if (db.users[k].id === id) delete db.users[k]; return json(204, undefined); }
      return json(404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
    }
    if (p === "/rest/v1/profiles") {
      const id = me(); const mine = db.profiles[id];
      const visible = Object.values(db.profiles).filter((x) => id && (x.id === id || x.coach_id === id || x.guardian_id === id || (mine && (x.id === mine.coach_id || x.id === mine.guardian_id))));
      const idEq = url.searchParams.get("id"); const rows = idEq && idEq.startsWith("eq.") ? visible.filter((x) => x.id === idEq.slice(3)) : visible;
      if (method === "GET") return respond(rows);
      if (method === "PATCH") { const upd = rows.filter((x) => x.id === id); upd.forEach((x) => Object.assign(x, body)); return json(200, upd); }
    }
    if (p.startsWith("/rest/v1/") && method === "GET") return wantObject ? json(406, { code: "PGRST116", message: "no rows" }) : json(200, []);
    if (p.startsWith("/rest/v1/")) return json(201, []);
    return json(404, { message: "not mocked: " + p });
  });
}

async function startServer() {
  const child = spawn("npx", ["vite", "preview", "--outDir", distDir, "--port", String(PORT), "--strictPort"], { cwd: require("path").resolve(__dirname, "../.."), stdio: ["ignore", "pipe", "pipe"], detached: true });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("preview server did not start")), 20000); child.stdout.on("data", (d) => { if (String(d).includes("localhost")) { clearTimeout(t); res(); } }); child.stderr.on("data", (d) => process.stderr.write(d)); });
  return child;
}

const results = [];
async function scenario(browser, name, fn, opts = {}) {
  if (ONLY.length && !ONLY.some((o) => name.startsWith(o))) return;
  const db = freshDb();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
                                         permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  attach(page, db, opts);
  const r = { name, ok: false, notes: [], errors, shots: [] };
  const shot = async (label) => { const f = path.join(outDir, `${name}-${label}.png`); await page.screenshot({ path: f }); r.shots.push(path.basename(f)); };
  try { await fn({ page, db, ctx, shot, note: (s) => r.notes.push(s) }); r.ok = errors.filter((e) => !IGNORED.test(e)).length === 0 && !r.notes.some((n) => n.startsWith("FAIL")); }
  catch (e) { r.notes.push("FAIL threw: " + (e && e.message || e).split("\n")[0]); try { await shot("threw"); } catch {} }
  results.push(r);
  await ctx.close();
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${name}\n      ${r.notes.join("\n      ")}${errors.filter((e) => !IGNORED.test(e)).length ? "\n      errors: " + errors.filter((e) => !IGNORED.test(e)).slice(0, 3).join(" | ") : ""}`);
}

const rootText = (page) => page.evaluate(() => document.getElementById("root").innerText.replace(/\s+/g, " ").trim());
const rootEmpty = (page) => page.evaluate(() => document.getElementById("root").innerHTML.length === 0);
const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
async function waitSplash(page) { await page.waitForTimeout(6800); }   // the branded opening holds 5.4s then lifts
/* the first-run walkthrough opens over the home screen; a person taps Skip */
async function dismissTour(page) { const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); return true; } return false; }
const btn = (page, name) => page.getByRole("button", { name, exact: true });
const codeBoxes = (page) => page.locator('input[autocapitalize="characters"]');

async function signIn(page, email, pass) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await btn(page, "Sign in").click();
  await page.getByPlaceholder("you@example.ie").fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await btn(page, "Sign in").click();
}

/* the details step; `dob` only for a player */
async function fillDetails(page, { name, email, phone, pass, dob }) {
  if (dob) { const [d, m, y] = dob; await page.getByPlaceholder("DD").fill(d); await page.getByPlaceholder("MM").fill(m); await page.getByPlaceholder("YYYY").fill(y); }
  await page.getByPlaceholder("Ray Doyle").fill(name);
  await page.getByPlaceholder("you@example.ie").fill(email);
  if (phone) await page.getByPlaceholder("+353 87 123 4567").fill(phone);
  await page.getByPlaceholder("At least 8 characters").fill(pass);
}
const pickChoice = async (page, label) => { await btn(page, label).click(); await btn(page, "Continue").click(); };
const startCreate = async (page, who, sport) => { await page.goto(BASE, { waitUntil: "networkidle" }); await btn(page, "Create account").click(); await pickChoice(page, who); await pickChoice(page, sport); };
const profileNamed = (db, n) => Object.values(db.profiles).find((p) => p.name === n);

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    await scenario(browser, "01-sign-in-coach", async ({ page, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" }); await shot("landing");
      await signIn(page, "coach@example.ie", "secret123");
      await page.waitForTimeout(1500);
      if (await rootEmpty(page)) { note("FAIL the page went blank after sign-in (React unmounted the tree)"); return; }
      await waitSplash(page); await shot("home");
      const t = await rootText(page); note("screen text starts: " + t.slice(0, 90));
      if (/Sign in|Create account/.test(t.slice(0, 40))) note("FAIL still on the landing / sign-in screen");
    });

    await scenario(browser, "02-sign-in-wrong-password", async ({ page, shot, note }) => {
      await signIn(page, "coach@example.ie", "wrong1234");
      await page.waitForTimeout(800); await shot("error");
      const t = await rootText(page);
      if (!/don't match/.test(t)) note("FAIL expected the friendly wrong-password message, got: " + t.slice(0, 120)); else note("friendly error shown");
    });

    await scenario(browser, "03-stay-signed-in-across-reload", async ({ page, shot, note }) => {
      await signIn(page, "coach@example.ie", "secret123");
      await page.waitForTimeout(1200);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1500); await shot("after-reload");
      if (await rootEmpty(page)) { note("FAIL blank page after reload with a stored session"); return; }
      const t = await rootText(page);
      if (/Create account/.test(t)) note("FAIL landed on the sign-in landing — session not restored"); else note("session restored without a sign-in screen");
    });

    await scenario(browser, "04-sign-up-coach-arrival", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await btn(page, "Create account").click(); await shot("step1-who");
      await pickChoice(page, "Coach"); await shot("step2-sport");
      await pickChoice(page, "Golf"); await shot("step3-details-blank");
      if (await page.getByPlaceholder("DD").count()) note("FAIL a coach was asked for a date of birth");
      /* Continue with nothing filled: stays, marks the first problem */
      await btn(page, "Create account").click(); await page.waitForTimeout(400);
      if (db.signups.length) note("FAIL an empty form was submitted");
      if (!/Enter your full name/.test(await rootText(page))) note("FAIL no inline problem shown for an empty form");
      await fillDetails(page, { name: "Ray Doyle", email: "Ray@Example.ie", phone: "+353 87 123 4567", pass: "secret123" });
      await shot("step3-details-filled");
      await btn(page, "Create account").click();
      await page.waitForTimeout(1800);
      const s = db.signups[0];
      if (!s) { note("FAIL no sign-up call reached the server"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.email !== "ray@example.ie") note("FAIL email not lower-cased");
      if (s.data.role !== "coach" || s.data.account_type !== "coach" || s.data.sport !== "golf" || s.data.date_of_birth !== null || s.data.phone !== "+353 87 123 4567") note("FAIL metadata wrong");
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      const prof = profileNamed(db, "Ray Doyle");
      await shot("arrival-coach");
      let t = await rootText(page);
      if (!/You're set up/.test(t)) { note("FAIL no arrival screen, got: " + t.slice(0, 120)); return; }
      if (!prof || !t.includes(prof.invite_code)) { note(`FAIL arrival does not show the real invite code ${prof && prof.invite_code}: ` + t.slice(0, 160)); return; }
      note("arrival shows the trigger's real invite code " + prof.invite_code);
      await btn(page, "Copy").click(); await page.waitForTimeout(400);
      t = await rootText(page);
      const clip = await clipboard(page);
      if (!/Copied/.test(t)) note("FAIL no Copied confirmation");
      if (clip !== prof.invite_code) note(`FAIL clipboard holds ${JSON.stringify(clip)}, not the code`); else note("Copy put the code on the clipboard");
      await btn(page, "Share").click(); await page.waitForTimeout(400);
      const clip2 = await clipboard(page);
      note("Share (no share sheet in headless Chrome) fell back to copying: " + JSON.stringify(clip2));
      if (!clip2 || !clip2.includes(`/?join=${prof.invite_code}`)) note("FAIL the shared text has no join link");
      await btn(page, "Show me around").click();
      const tourNow = await page.evaluate(() => sessionStorage.getItem("nosca.tour.now"));
      if (tourNow !== "1") note("FAIL nosca.tour.now not set by Show me around");
      await page.waitForTimeout(300);
      if (await rootEmpty(page)) { note("FAIL blank page after arrival"); return; }
      await waitSplash(page);
      const hadTour = await dismissTour(page); note("walkthrough opened after Show me around: " + hadTour);
      await shot("home");
      t = await rootText(page);
      if (/You're set up|Create account/.test(t.slice(0, 60))) note("FAIL did not reach the app after arrival");
    });

    await scenario(browser, "05-sign-up-parent-family-code", async ({ page, db, shot, note }) => {
      await startCreate(page, "Parent", "Tennis");
      if (await page.getByPlaceholder("DD").count()) note("FAIL a parent was asked for a date of birth");
      await fillDetails(page, { name: "Nuala Tran", email: "nuala@example.ie", pass: "secret123" });
      await btn(page, "Create account").click();
      await page.waitForTimeout(1800);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.data.role !== "player" || s.data.account_type !== "parent" || s.data.sport !== "tennis") note("FAIL parent metadata wrong");
      const prof = profileNamed(db, "Nuala Tran");
      await shot("arrival-parent");
      let t = await rootText(page);
      if (!prof || !t.includes(prof.family_code) || !/Your children enter this/.test(t)) note("FAIL arrival does not show the family code with the parent copy: " + t.slice(0, 160));
      else note("arrival shows the family code " + prof.family_code);
      await btn(page, "Show me around").click(); await page.waitForTimeout(300);
      await waitSplash(page); await dismissTour(page); await shot("home");
      t = await rootText(page);
      if (/Add your coach|Join your coach/.test(t)) note("FAIL a parent is held on the Add your coach screen");
      else note("parent landed on Home: " + t.slice(0, 80));
    });

    await scenario(browser, "06-sign-up-adult-player-with-coach-code", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Tennis");
      await fillDetails(page, { name: "Aoife Nolan", email: "aoife@example.ie", pass: "secret123", dob: ["02", "03", "1990"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(400); await shot("step4-codes");
      let t = await rootText(page);
      if (!/Your codes/.test(t)) { note("FAIL no codes step: " + t.slice(0, 100)); return; }
      if (!(await btn(page, "Skip for now").count())) note("FAIL an adult has no Skip for now");
      await codeBoxes(page).first().fill("abc234");
      await page.waitForTimeout(900);
      t = await rootText(page);
      if (!/Sinéad Walsh/.test(t)) note("FAIL the live check did not show the coach's name: " + t.slice(0, 160)); else note("live check matched: Sinéad Walsh shown before the account exists");
      await shot("step4-codes-matched");
      await btn(page, "Create account").click();
      await page.waitForTimeout(1800);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.data.coach_code !== "ABC234" || s.data.account_type !== "adult" || s.data.date_of_birth !== "1990-03-02" || s.data.family_code !== "") note("FAIL metadata wrong");
      const prof = profileNamed(db, "Aoife Nolan");
      if (!prof || prof.coach_id !== COACH_ID) note("FAIL profile not linked to the coach");
      await shot("arrival-player");
      t = await rootText(page);
      if (!/You're with Sinéad Walsh/.test(t)) note("FAIL arrival should say You're with Sinéad Walsh, got: " + t.slice(0, 120)); else note("arrival: You're with Sinéad Walsh");
      await btn(page, "Skip the tour").click(); await page.waitForTimeout(300);
      await waitSplash(page);
      const hadTour = await dismissTour(page);
      if (hadTour) note("FAIL the walkthrough opened even though the person skipped the tour");
      t = await rootText(page);
      if (/Add your coach/.test(t)) note("FAIL landed on the coachless screen despite a valid code"); else note("landed on the player home");
    });

    await scenario(browser, "07-sign-up-under-18-needs-family-code", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Golf");
      const y = String(new Date().getFullYear() - 15);
      await fillDetails(page, { name: "Ellie Tran", email: "ellie@example.ie", pass: "secret123", dob: ["05", "05", y] });
      await page.waitForTimeout(200);
      if (/18 or over/.test(await rootText(page))) note("FAIL dead end: a 15-year-old told 'You need to be 18 or over'");
      await btn(page, "Continue").click(); await page.waitForTimeout(400);
      let t = await rootText(page);
      if (!/Your codes/.test(t)) { note("FAIL no codes step for the junior: " + t.slice(0, 120)); return; }
      if (await btn(page, "Skip for now").count()) note("FAIL an under-18 was offered Skip for now");
      await btn(page, "Create account").click(); await page.waitForTimeout(500); await shot("step4-blocked");
      t = await rootText(page);
      if (db.signups.length) note("FAIL account created for an under-18 with no family code");
      else if (/Under 18s join with a parent's family code/.test(t)) note("stopped with the family-code message");
      else note("FAIL stopped, but without the message: " + t.slice(0, 160));
      await codeBoxes(page).nth(6).fill("fam777");
      await page.waitForTimeout(900);
      t = await rootText(page);
      if (!/Sinéad Walsh/.test(t)) note("FAIL the family code was not matched live");
      await btn(page, "Create account").click();
      await page.waitForTimeout(1800);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call after the family code"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.data.account_type !== "junior" || s.data.family_code !== "FAM777" || s.data.coach_code !== "") note("FAIL junior metadata wrong");
      const prof = profileNamed(db, "Ellie Tran");
      if (!prof || prof.guardian_id !== COACH_ID) note("FAIL profile not linked to the guardian");
      await shot("arrival-junior");
      t = await rootText(page);
      if (!/You're in Sinéad Walsh's family/.test(t)) note("FAIL arrival should name the family, got: " + t.slice(0, 120)); else note("arrival: You're in Sinéad Walsh's family");
    });

    await scenario(browser, "08-sign-up-player-wrong-code", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Tennis");
      await fillDetails(page, { name: "Dan Okafor", email: "dan@example.ie", pass: "secret123", dob: ["02", "03", "1990"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(300);
      await codeBoxes(page).first().fill("ZZZZZZ");
      await page.waitForTimeout(900);
      let t = await rootText(page);
      if (!/doesn't match a coach/.test(t)) note("FAIL no inline rejection after the live check: " + t.slice(0, 160));
      await btn(page, "Create account").click();
      await page.waitForTimeout(1000); await shot("rejected");
      t = await rootText(page);
      if (db.signups.length) note("FAIL the account was created even though the code matched no coach");
      else if (/doesn't match a coach/.test(t)) note("code rejected inline before any account was created");
      else note("FAIL no account created but no message shown either: " + t.slice(0, 100));
    });

    await scenario(browser, "09-forgot-password-then-recovery-link", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await btn(page, "Sign in").click();
      await page.getByPlaceholder("you@example.ie").fill("coach@example.ie");
      await btn(page, "Forgot password?").click(); await page.waitForTimeout(300); await shot("forgot");
      let t = await rootText(page);
      if (!/Reset password/.test(t)) { note("FAIL no reset screen: " + t.slice(0, 100)); return; }
      const prefilled = await page.getByPlaceholder("you@example.ie").inputValue();
      if (prefilled !== "coach@example.ie") note("FAIL email not carried over to the reset screen");
      await btn(page, "Send reset link").click(); await page.waitForTimeout(800); await shot("inbox-reset");
      t = await rootText(page);
      const mail = db.emails.find((e) => e.kind === "recovery");
      if (!mail) note("FAIL no recovery email requested");
      else note(`recovery email requested for ${mail.to}, redirect_to=${mail.redirectTo}`);
      if (!/Check your inbox/.test(t) || !t.includes("coach@example.ie")) note("FAIL no check-your-inbox screen with the address");
      /* the link in the email: the app opens with a recovery token */
      const u = db.users["coach@example.ie"];
      const s = session(u);
      /* the link opens in a fresh tab — a same-origin hash goto would be a same-document navigation */
      await page.goto("about:blank");
      await page.goto(`${BASE}/#access_token=${s.access_token}&refresh_token=rt_${u.id}&type=recovery&expires_in=86400&token_type=bearer`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500); await shot("set-password");
      t = await rootText(page);
      if (!/Set a new password/.test(t)) { note("FAIL the recovery link did not open Set a new password: " + t.slice(0, 120)); return; }
      const pws = page.locator('input[type="password"]');
      await pws.nth(0).fill("newsecret9"); await pws.nth(1).fill("different9");
      await btn(page, "Save password").click(); await page.waitForTimeout(300);
      if (!/don't match/.test(await rootText(page))) note("FAIL mismatched confirmation not caught");
      if (db.userPuts.length) note("FAIL updateUser called with a mismatched confirmation");
      await pws.nth(1).fill("newsecret9");
      await btn(page, "Save password").click(); await page.waitForTimeout(1500);
      if (!db.userPuts.length || db.userPuts[0].password !== "newsecret9") { note("FAIL updateUser({password}) not called"); return; }
      if (u.password !== "newsecret9") note("FAIL the password did not change");
      note("updateUser called; password changed");
      if (await rootEmpty(page)) { note("FAIL blank page after saving the password"); return; }
      await waitSplash(page); await dismissTour(page); await shot("home");
      t = await rootText(page);
      if (/Set a new password|Sign in/.test(t.slice(0, 40))) note("FAIL did not continue into the app after the new password"); else note("continued into the app, signed in");
    });

    await scenario(browser, "10-deep-link-join-prefills-code", async ({ page, db, shot, note }) => {
      await page.goto(`${BASE}/?join=abc234`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400); await shot("landing-invited");
      let t = await rootText(page);
      if (!/You've been invited/.test(t)) note("FAIL landing does not mention the invitation: " + t.slice(0, 100));
      if (/join=/.test(page.url())) note("FAIL the code was left in the address bar: " + page.url()); else note("code removed from the URL: " + page.url());
      await btn(page, "Create account").click(); await pickChoice(page, "Player"); await pickChoice(page, "Tennis");
      await fillDetails(page, { name: "Cian Murphy", email: "cian@example.ie", pass: "secret123", dob: ["09", "09", "1992"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(900); await shot("codes-prefilled");
      const vals = await codeBoxes(page).evaluateAll((els) => els.map((e) => e.value).join(""));
      if (!vals.startsWith("ABC234")) note("FAIL code boxes not pre-filled: " + JSON.stringify(vals)); else note("coach code pre-filled from the link");
      t = await rootText(page);
      if (!/Sinéad Walsh/.test(t)) note("FAIL the pre-filled code was not checked live");
      await btn(page, "Create account").click(); await page.waitForTimeout(1500);
      const prof = profileNamed(db, "Cian Murphy");
      if (!prof || prof.coach_id !== COACH_ID) note("FAIL not linked to the coach from the deep link"); else note("linked to the coach");
    });

    await scenario(browser, "11-sign-up-existing-email-confirm-on", async ({ page, db, shot, note }) => {
      await startCreate(page, "Coach", "Golf");
      await fillDetails(page, { name: "Sinéad Walsh", email: "coach@example.ie", pass: "another12" });
      await btn(page, "Create account").click();
      await page.waitForTimeout(1000); await shot("message");
      const t = await rootText(page);
      if (/already an account/.test(t)) note("told the email is already registered");
      else if (/Check your inbox/.test(t)) note("FAIL sent to 'Check your inbox' for an email that already has an account");
      else note("FAIL message: " + t.slice(0, 160));
      if (!(await btn(page, "Sign in").count())) note("FAIL no Sign in offered alongside the message");
    }, { confirmEmail: true });

    await scenario(browser, "12-sign-up-confirm-on-check-inbox", async ({ page, db, shot, note }) => {
      await startCreate(page, "Coach", "Rowing");
      await fillDetails(page, { name: "Orla Byrne", email: "orla@example.ie", pass: "secret123" });
      await btn(page, "Create account").click();
      await page.waitForTimeout(1000); await shot("inbox-signup");
      let t = await rootText(page);
      if (!/Check your inbox/.test(t) || !t.includes("orla@example.ie")) { note("FAIL no check-your-inbox screen with the address: " + t.slice(0, 160)); return; }
      note("check-your-inbox shown with the address");
      await btn(page, "Resend email").click(); await page.waitForTimeout(500);
      const re = db.emails.find((e) => e.kind === "signup" && e.to === "orla@example.ie");
      if (!re) note("FAIL resend did not reach the server"); else note("resend requested");
      t = await rootText(page);
      if (!/Resend email · \d+s/.test(t)) note("FAIL no cooldown shown after resend");
      const again = page.getByRole("button", { name: /Resend email · \d+s/ });
      if (!(await again.isDisabled())) note("FAIL resend not disabled during the cooldown");
      await btn(page, "I've confirmed — sign in").click(); await page.waitForTimeout(300);
      const v = await page.getByPlaceholder("you@example.ie").inputValue();
      if (v !== "orla@example.ie") note("FAIL sign-in email not prefilled after confirming"); else note("sign-in prefilled with the address");
    }, { confirmEmail: true });

    await scenario(browser, "13-sign-up-player-skip-then-join-from-home", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Rowing");
      await fillDetails(page, { name: "Tom Beckett", email: "tom@example.ie", pass: "secret123", dob: ["11", "11", "1988"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(300);
      await btn(page, "Skip for now").click();
      await page.waitForTimeout(1500);
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      let t = await rootText(page);
      if (!/No coach yet/.test(t)) note("FAIL arrival should say No coach yet, got: " + t.slice(0, 120));
      await btn(page, "Skip the tour").click(); await page.waitForTimeout(300);
      await waitSplash(page);
      const hadTour = await dismissTour(page); if (hadTour) note("FAIL walkthrough opened after Skip the tour");
      await shot("no-coach");
      t = await rootText(page);
      if (!/Add your coach/.test(t)) { note("FAIL expected the Add your coach screen, got: " + t.slice(0, 100)); return; }
      await codeBoxes(page).first().fill("ABC234");
      await btn(page, "Add coach").click();
      let sawLoading = false, sawJoined = false;
      for (let i = 0; i < 40; i++) { await page.waitForTimeout(100); t = await rootText(page); if (/^Loading…/.test(t)) sawLoading = true; if (/Sinéad Walsh/.test(t)) sawJoined = true; }
      await shot("after-join");
      if (sawLoading) note("FAIL the whole app unmounted mid-join");
      if (!sawJoined) note("FAIL the joined-coach moment never appeared");
      if (!db.rpcs.some((r) => r.fn === "join_coach" && r.args.p_code === "ABC234")) note("FAIL join did not go through the join_coach RPC");
      else note("joined through join_coach; the joined moment named the coach");
      const prof = profileNamed(db, "Tom Beckett");
      if (!prof || !prof.coach_id) note("FAIL coach_id not written");
    });

    await scenario(browser, "14-invite-sheet-real-code-and-qr", async ({ page, db, shot, note }) => {
      await signIn(page, "coach@example.ie", "secret123");
      await page.waitForTimeout(1200); await waitSplash(page); await dismissTour(page);
      await page.getByRole("button", { name: "Your profile" }).click(); await page.waitForTimeout(600);
      let t = await rootText(page);
      if (!/Invite code & QR ABC234/.test(t)) note("FAIL settings row does not show the real code: " + (t.match(/Invite code & QR \S+/) || [""])[0]);
      else note("settings row shows the real code");
      if ((t.match(/Delete account/g) || []).length !== 1) note("FAIL expected exactly one Delete account row, saw " + (t.match(/Delete account/g) || []).length);
      await page.getByRole("button", { name: /Invite code & QR/ }).click(); await page.waitForTimeout(700);
      await shot("invite-sheet");
      t = await rootText(page);
      if (!/Invite a player/.test(t) || !/ABC234/.test(t)) note("FAIL invite sheet without the real code");
      const qr = await page.locator('img[alt="QR code"]').getAttribute("src");
      if (!qr || !qr.startsWith("data:image/svg+xml")) note("FAIL no real QR image rendered"); else note("real QR rendered (" + qr.length + " chars of SVG)");
      const decoded = qr ? decodeURIComponent(qr.replace(/^data:image\/svg\+xml;utf8,/, "")) : "";
      if (!/<svg/.test(decoded) || !/<path/.test(decoded)) note("FAIL the QR data URL is not an SVG with modules");
      await btn(page, "Copy code").click(); await page.waitForTimeout(500);
      const clip = await clipboard(page);
      if (clip !== "ABC234") note("FAIL Copy code put " + JSON.stringify(clip) + " on the clipboard"); else note("Copy code works");
      t = await rootText(page);
      if (!/Code copied/.test(t)) note("FAIL no Code copied toast");
    });
  } finally {
    await browser.close(); try { process.kill(-server.pid, "SIGTERM"); } catch {} server.stdout.destroy(); server.stderr.destroy();
  }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passing`);
  process.exit(0);
})();
