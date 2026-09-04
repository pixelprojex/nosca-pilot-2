/* End-to-end proof of the sign-up / sign-in path against a mocked
   Supabase. Usage: node run.cjs <distDir> <port> <outDir>
   The mock behaves like the real database after rebuild-signup.sql:
   sign-up creates the profile via the "trigger", RLS-like visibility
   on profiles, find_coach_by_code, delete_my_account. */
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
fs.mkdirSync(outDir, { recursive: true });

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uuid = () => "00000000-0000-4000-8000-" + String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
const code6 = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

function freshDb() {
  const coachId = "00000000-0000-4000-8000-000000000c0a";
  return {
    users: { "coach@example.ie": { id: coachId, email: "coach@example.ie", password: "secret1", meta: { role: "coach", name: "Sinéad Walsh", sport: "tennis", account_type: "coach" } } },
    profiles: { [coachId]: { id: coachId, role: "coach", name: "Sinéad Walsh", sport: "tennis", account_type: "coach", coach_id: null, guardian_id: null, invite_code: "ABC234", family_code: "FAM777", date_of_birth: null, phone: null, club: null, created_at: "2026-01-01T00:00:00Z" } },
    signups: [],       // metadata the browser actually sent
    emails: [],        // recovery / confirmation mails the mock "sent"
    rpcs: [],          // rpc calls made
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
    guardian_id: guardian ? guardian.id : null, invite_code: role === "coach" ? code6() : null, family_code: code6(), club: null, created_at: new Date().toISOString() };
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
      if (confirmOn) return json(200, { ...session(u).user, identities: [] });
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
    if (p === "/auth/v1/recover" && method === "POST") { db.emails.push({ kind: "recovery", to: (body.email || "").toLowerCase() }); return json(200, {}); }
    if (p === "/auth/v1/resend" && method === "POST") { db.emails.push({ kind: body.type || "signup", to: (body.email || "").toLowerCase() }); return json(200, {}); }
    if (p === "/auth/v1/user" && method === "PUT") { const id = me(); const u = Object.values(db.users).find((x) => x.id === id); if (!u) return json(401, { msg: "invalid JWT" }); if (body.password) u.password = body.password; if (body.data) u.meta = { ...u.meta, ...body.data }; return json(200, session(u).user); }
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  attach(page, db, opts);
  const r = { name, ok: false, notes: [], errors, shots: [] };
  const shot = async (label) => { const f = path.join(outDir, `${name}-${label}.png`); await page.screenshot({ path: f }); r.shots.push(path.basename(f)); };
  try { await fn({ page, db, ctx, shot, note: (s) => r.notes.push(s) }); r.ok = errors.filter((e) => !IGNORED.test(e)).length === 0 && !r.notes.some((n) => n.startsWith("FAIL")); }
  catch (e) { r.notes.push("FAIL threw: " + (e && e.message || e)); try { await shot("threw"); } catch {} }
  results.push(r);
  await ctx.close();
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${name}\n      ${r.notes.join("\n      ")}${errors.filter((e) => !IGNORED.test(e)).length ? "\n      errors: " + errors.filter((e) => !IGNORED.test(e)).slice(0, 3).join(" | ") : ""}`);
}

const rootText = (page) => page.evaluate(() => document.getElementById("root").innerText.replace(/\s+/g, " ").trim());
const rootEmpty = (page) => page.evaluate(() => document.getElementById("root").innerHTML.length === 0);
async function waitSplash(page) { await page.waitForTimeout(6800); }   // the branded opening holds 5.4s then lifts
/* the first-run walkthrough opens over the home screen; a person taps Skip */
async function dismissTour(page) { const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); return true; } return false; }

async function signIn(page, email, pass) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByPlaceholder("you@example.ie").fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function fillDetails(page, { name, email, phone, pass, dob }) {
  const [d, m, y] = dob;
  await page.getByPlaceholder("DD").fill(d); await page.getByPlaceholder("MM").fill(m); await page.getByPlaceholder("YYYY").fill(y);
  await page.getByPlaceholder("Ray Doyle").fill(name);
  await page.getByPlaceholder("you@example.ie").fill(email);
  if (phone) await page.getByPlaceholder("+353 87 123 4567").fill(phone);
  await page.getByPlaceholder("At least 6 characters").fill(pass);
  await page.getByRole("button", { name: "Continue" }).click();
}
const pickChoice = async (page, label) => { await page.getByRole("button", { name: label, exact: true }).click(); await page.getByRole("button", { name: "Continue" }).click(); };

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    await scenario(browser, "01-sign-in-coach", async ({ page, shot, note }) => {
      await signIn(page, "coach@example.ie", "secret1");
      await page.waitForTimeout(1500); await shot("after-submit");
      if (await rootEmpty(page)) { note("FAIL the page went blank after sign-in (React unmounted the tree)"); return; }
      await waitSplash(page); await shot("home");
      const t = await rootText(page); note("screen text starts: " + t.slice(0, 90));
      if (/Sign in|Create account/.test(t.slice(0, 40))) note("FAIL still on the landing / sign-in screen");
    });

    await scenario(browser, "02-sign-in-wrong-password", async ({ page, shot, note }) => {
      await signIn(page, "coach@example.ie", "wrong123");
      await page.waitForTimeout(800); await shot("error");
      const t = await rootText(page);
      if (!/don't match/.test(t)) note("FAIL expected the friendly wrong-password message, got: " + t.slice(0, 120)); else note("friendly error shown");
    });

    await scenario(browser, "03-stay-signed-in-across-reload", async ({ page, shot, note }) => {
      await signIn(page, "coach@example.ie", "secret1");
      await page.waitForTimeout(1200);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1500); await shot("after-reload");
      if (await rootEmpty(page)) { note("FAIL blank page after reload with a stored session"); return; }
      const t = await rootText(page);
      if (/Create account/.test(t)) note("FAIL landed on the sign-in landing — session not restored"); else note("session restored without a sign-in screen");
    });

    await scenario(browser, "04-sign-up-coach", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Create account" }).click();
      await pickChoice(page, "Coach"); await pickChoice(page, "Golf");
      await shot("details-blank");
      await fillDetails(page, { name: "Ray Doyle", email: "Ray@Example.ie", phone: "+353 87 123 4567", pass: "secret1", dob: ["24", "07", "1985"] });
      await page.waitForTimeout(1500); await shot("after-submit");
      const s = db.signups[0];
      if (!s) { note("FAIL no sign-up call reached the server"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.email !== "ray@example.ie") note("FAIL email not lower-cased");
      if (s.data.role !== "coach" || s.data.account_type !== "coach" || s.data.sport !== "golf" || s.data.date_of_birth !== "1985-07-24") note("FAIL metadata wrong");
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      await waitSplash(page); await shot("home");
      note("profile the trigger made: " + JSON.stringify(Object.values(db.profiles).find((p) => p.name === "Ray Doyle")));
    });

    await scenario(browser, "05-sign-up-player-with-code", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Create account" }).click();
      await pickChoice(page, "Player"); await pickChoice(page, "Adult player"); await pickChoice(page, "Tennis");
      await fillDetails(page, { name: "Aoife Nolan", email: "aoife@example.ie", pass: "secret1", dob: ["02", "03", "1990"] });
      await page.waitForTimeout(500); await shot("code-screen");
      await page.locator('input[autocapitalize="characters"]').first().fill("abc234");
      await page.getByRole("button", { name: "Join coach" }).click();
      await page.waitForTimeout(1500);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call"); return; }
      note("coach_code sent: " + JSON.stringify(s.data.coach_code));
      const prof = Object.values(db.profiles).find((p) => p.name === "Aoife Nolan");
      if (!prof || prof.coach_id !== "00000000-0000-4000-8000-000000000c0a") note("FAIL profile not linked to the coach");
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      await waitSplash(page); await shot("home");
      const t = await rootText(page);
      if (/Add your coach/.test(t)) note("FAIL landed on the coachless screen despite a valid code"); else note("landed on the player home");
    });

    await scenario(browser, "06-sign-up-player-wrong-code", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Create account" }).click();
      await pickChoice(page, "Player"); await pickChoice(page, "Adult player"); await pickChoice(page, "Tennis");
      await fillDetails(page, { name: "Dan Okafor", email: "dan@example.ie", pass: "secret1", dob: ["02", "03", "1990"] });
      await page.locator('input[autocapitalize="characters"]').first().fill("ZZZZZZ");
      await page.getByRole("button", { name: "Join coach" }).click();
      await page.waitForTimeout(1500); await shot("after-join");
      const t = await rootText(page);
      if (db.signups.length) note("FAIL the account was created even though the code matched no coach (" + (Object.values(db.profiles).find((p) => p.name === "Dan Okafor") || {}).coach_id + ")");
      else if (/doesn't match/.test(t)) note("code rejected inline before any account was created");
      else note("FAIL no account created but no message shown either: " + t.slice(0, 100));
    });

    await scenario(browser, "07-sign-up-player-skip-then-join", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Create account" }).click();
      await pickChoice(page, "Player"); await pickChoice(page, "Adult player"); await pickChoice(page, "Rowing");
      await fillDetails(page, { name: "Tom Beckett", email: "tom@example.ie", pass: "secret1", dob: ["11", "11", "1988"] });
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.waitForTimeout(1500);
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      await waitSplash(page);
      const hadTour = await dismissTour(page); note("first-run walkthrough opened over the screen and was skipped: " + hadTour);
      await shot("no-coach");
      let t = await rootText(page);
      if (!/Add your coach/.test(t)) { note("FAIL expected the Add your coach screen, got: " + t.slice(0, 100)); return; }
      await page.locator('input[autocapitalize="characters"]').first().fill("ABC234");
      await page.getByRole("button", { name: "Add coach" }).click();
      /* watch for a full remount: the app would show "Loading…" and replay the splash */
      let sawLoading = false, sawJoined = false;
      for (let i = 0; i < 40; i++) { await page.waitForTimeout(100); t = await rootText(page); if (/^Loading…/.test(t)) sawLoading = true; if (/Sinéad Walsh/.test(t)) sawJoined = true; }
      await shot("after-join");
      note(`joined moment shown with the coach's name: ${sawJoined}; app unmounted to "Loading…" during the join: ${sawLoading}`);
      if (sawLoading) note("FAIL the whole app unmounted mid-join");
      if (!sawJoined) note("FAIL the joined-coach moment never appeared");
      const prof = Object.values(db.profiles).find((p) => p.name === "Tom Beckett");
      if (!prof || !prof.coach_id) note("FAIL coach_id not written");
    });

    await scenario(browser, "08-sign-up-under-18-path", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Create account" }).click();
      await pickChoice(page, "Player"); await pickChoice(page, "Under 18"); await pickChoice(page, "Golf");
      const y = String(new Date().getFullYear() - 15);
      await fillDetails(page, { name: "Ellie Tran", email: "ellie@example.ie", pass: "secret1", dob: ["05", "05", y] });
      await page.waitForTimeout(600); await shot("blocked");
      const t = await rootText(page);
      if (db.signups.length) note("a 15-year-old was allowed through the Under 18 path");
      else if (/18 or over/.test(t)) note("FAIL dead end: chose Under 18, then told 'You need to be 18 or over'");
      else note("blocked with: " + t.slice(0, 160));
    });

    await scenario(browser, "09-sign-up-existing-email-confirm-on", async ({ page, db, shot, note }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Create account" }).click();
      await pickChoice(page, "Coach"); await pickChoice(page, "Golf");
      await fillDetails(page, { name: "Sinéad Walsh", email: "coach@example.ie", pass: "another1", dob: ["24", "07", "1985"] });
      await page.waitForTimeout(1000); await shot("message");
      const t = await rootText(page);
      if (/already an account/.test(t)) note("told the email is already registered");
      else if (/Account created/.test(t)) note("FAIL told 'Account created. Confirm your email' for an email that already has an account");
      else note("message: " + t.slice(0, 160));
    }, { confirmEmail: true });
  } finally {
    await browser.close(); try { process.kill(-server.pid, "SIGTERM"); } catch {} server.stdout.destroy(); server.stderr.destroy();
  }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passing`);
  process.exit(0);
})();
