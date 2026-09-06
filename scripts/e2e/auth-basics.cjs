/* The smaller set: sign in, wrong password, session across reload, the
   four sign-ups and what the trigger makes of each, a wrong code, asking
   a coach from the home screen. Against the shared mock (mock.cjs).
   Usage: node auth-basics.cjs <distDir> <port> <outDir> [only] */
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir, onlyArg] = process.argv.slice(2);
const ONLY = (onlyArg || "").split(",").filter(Boolean);
const IGNORED = /Failed to load resource|Blocked call to navigator\.vibrate/;
const PORT = Number(portArg || 4173);
const BASE = `http://localhost:${PORT}`;
const COACH_ID = "00000000-0000-4000-8000-000000000c0a";
const GRAINNE_ID = "00000000-0000-4000-8000-0000000064a1";
const FAM_ID = "fa000000-0000-4000-8000-0000000fa777";
fs.mkdirSync(outDir, { recursive: true });

function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: COACH_ID, email: "coach@example.ie", password: "secret123", meta: { role: "coach", name: "Sinéad Walsh", sport: "tennis", account_type: "coach" } });
  M.addProfile(db, { id: COACH_ID, role: "coach", name: "Sinéad Walsh", sport: "tennis", inviteCode: "ABC234", createdAt: "2026-01-01T00:00:00Z" });
  M.addFamily(db, { id: FAM_ID, code: "FAM777", createdBy: GRAINNE_ID });
  M.addUser(db, { id: GRAINNE_ID, email: "grainne@example.ie", password: "secret123", meta: {} });
  M.addProfile(db, { id: GRAINNE_ID, role: "player", name: "Gráinne Tran", sport: "tennis", type: "parent", familyId: FAM_ID, createdAt: "2026-01-02T00:00:00Z" });
  return db;
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
  await M.attach(page, db, opts);
  const r = { name, ok: false, notes: [], errors, shots: [] };
  const shot = async (label) => { const f = path.join(outDir, `${name}-${label}.png`); await page.screenshot({ path: f }); r.shots.push(path.basename(f)); };
  try { await fn({ page, db, ctx, shot, note: (s) => r.notes.push(s) }); r.ok = errors.filter((e) => !IGNORED.test(e)).length === 0 && !r.notes.some((n) => n.startsWith("FAIL")); }
  catch (e) { r.notes.push("FAIL threw: " + (e && e.message || e).split("\n")[0]); try { await shot("threw"); } catch { /* page gone */ } }
  results.push(r);
  await ctx.close();
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${name}\n      ${r.notes.join("\n      ")}${errors.filter((e) => !IGNORED.test(e)).length ? "\n      errors: " + errors.filter((e) => !IGNORED.test(e)).slice(0, 3).join(" | ") : ""}`);
}

const rootText = M.rootText, rootEmpty = M.rootEmpty;
async function waitSplash(page) { await page.waitForTimeout(6800); }
async function dismissTour(page) { const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); return true; } return false; }
const btn = (page, name) => page.getByRole("button", { name, exact: true });

async function signIn(page, email, pass) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await btn(page, "Sign in").click();
  await page.getByPlaceholder("you@example.ie").fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await btn(page, "Sign in").click();
}
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
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    await scenario(browser, "01-sign-in-coach", async ({ page, shot, note }) => {
      await signIn(page, "coach@example.ie", "secret123");
      await page.waitForTimeout(1500); await shot("after-submit");
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

    await scenario(browser, "04-sign-up-coach", async ({ page, db, shot, note }) => {
      await startCreate(page, "Coach", "Golf"); await shot("details-blank");
      await fillDetails(page, { name: "Ray Doyle", email: "Ray@Example.ie", phone: "+353 87 123 4567", pass: "secret123" });
      await btn(page, "Create account").click(); await page.waitForTimeout(1500); await shot("after-submit");
      const s = db.signups[0];
      if (!s) { note("FAIL no sign-up call reached the server"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.email !== "ray@example.ie") note("FAIL email not lower-cased");
      if (s.data.role !== "coach" || s.data.account_type !== "coach" || s.data.sport !== "golf" || s.data.date_of_birth !== null) note("FAIL metadata wrong");
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      const prof = profileNamed(db, "Ray Doyle");
      note("profile the trigger made: " + JSON.stringify(prof));
      const t = await rootText(page);
      if (!prof || !/You're set up/.test(t) || !t.includes(prof.invite_code)) note("FAIL no arrival with the invite code: " + t.slice(0, 120));
      await btn(page, "Skip the tour").click(); await waitSplash(page); await shot("home");
      if (/You're set up|Create account/.test((await rootText(page)).slice(0, 60))) note("FAIL did not reach the app");
    });

    await scenario(browser, "05-sign-up-player-with-code-is-a-request", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Tennis");
      await fillDetails(page, { name: "Aoife Nolan", email: "aoife@example.ie", pass: "secret123", dob: ["02", "03", "1990"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(400); await shot("code-screen");
      await M.codeBoxes(page).first().fill("abc234"); await page.waitForTimeout(900);
      await btn(page, "Create account").click(); await page.waitForTimeout(1500);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call"); return; }
      note("coach_code sent: " + JSON.stringify(s.data.coach_code));
      const prof = profileNamed(db, "Aoife Nolan"); const req = prof && db.requests.find((r) => r.player_id === prof.id);
      if (!prof || prof.coach_id) note("FAIL the profile was linked outright; a code must make a request");
      if (!req || req.coach_id !== COACH_ID || req.status !== "pending") note("FAIL no pending coach_request"); else note("a pending request to the coach");
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      const t0 = await rootText(page);
      if (!/You've asked Sinéad Walsh/.test(t0)) note("FAIL arrival should say You've asked Sinéad Walsh: " + t0.slice(0, 120));
      await btn(page, "Skip the tour").click(); await waitSplash(page); await shot("home");
      const t = await rootText(page);
      if (!(await page.locator('[data-tour="nocoach-pending"]').count()) || !/Request sent/.test(t)) note("FAIL should be on Request sent: " + t.slice(0, 120)); else note("landed on Request sent");
    });

    await scenario(browser, "06-sign-up-player-wrong-code", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Tennis");
      await fillDetails(page, { name: "Dan Okafor", email: "dan@example.ie", pass: "secret123", dob: ["02", "03", "1990"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(300);
      await M.codeBoxes(page).first().fill("ZZZZZZ"); await page.waitForTimeout(900);
      await btn(page, "Create account").click(); await page.waitForTimeout(1000); await shot("after-join");
      const t = await rootText(page);
      if (db.signups.length) note("FAIL the account was created even though the code matched no coach");
      else if (/doesn't match/.test(t)) note("code rejected inline before any account was created");
      else note("FAIL no account created but no message shown either: " + t.slice(0, 100));
    });

    await scenario(browser, "07-sign-up-player-skip-then-ask", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Rowing");
      await fillDetails(page, { name: "Tom Beckett", email: "tom@example.ie", pass: "secret123", dob: ["11", "11", "1988"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(300);
      await btn(page, "Skip for now").click(); await page.waitForTimeout(1500);
      if (await rootEmpty(page)) { note("FAIL blank page after account creation"); return; }
      await btn(page, "Skip the tour").click(); await waitSplash(page);
      const hadTour = await dismissTour(page); if (hadTour) note("FAIL the walkthrough opened after Skip the tour");
      await shot("no-coach");
      let t = await rootText(page);
      if (!/Add your coach/.test(t)) { note("FAIL expected the Add your coach screen, got: " + t.slice(0, 100)); return; }
      await M.codeBoxes(page).first().fill("ABC234");
      await btn(page, "Ask to join").click();
      let sawLoading = false, sawPending = false;
      for (let i = 0; i < 40; i++) { await page.waitForTimeout(100); t = await rootText(page); if (/^Loading…/.test(t)) sawLoading = true; if (/Request sent/.test(t)) sawPending = true; }
      await shot("after-ask");
      note(`Request sent shown: ${sawPending}; app unmounted to "Loading…" during the ask: ${sawLoading}`);
      if (sawLoading) note("FAIL the whole app unmounted mid-join");
      if (!sawPending) note("FAIL the Request sent screen never appeared");
      const prof = profileNamed(db, "Tom Beckett"); const req = prof && db.requests.find((r) => r.player_id === prof.id);
      if (!req || req.status !== "pending") note("FAIL no pending request written");
      if (prof && prof.coach_id) note("FAIL coach_id written without the coach accepting");
    });

    await scenario(browser, "08-sign-up-under-18-path", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Golf");
      const y = String(new Date().getFullYear() - 15);
      await fillDetails(page, { name: "Ellie Tran", email: "ellie@example.ie", pass: "secret123", dob: ["05", "05", y] });
      await btn(page, "Continue").click(); await page.waitForTimeout(400);
      await btn(page, "Create account").click(); await page.waitForTimeout(600); await shot("blocked");
      let t = await rootText(page);
      if (db.signups.length) note("FAIL a 15-year-old was allowed through with no family code");
      else if (/Under 18s join with a parent's family code/.test(t)) note("blocked until a family code is entered");
      else note("FAIL blocked, but without the message: " + t.slice(0, 160));
      await M.codeBoxes(page).nth(6).fill("fam777"); await page.waitForTimeout(900);
      t = await rootText(page);
      if (!/Gráinne's family · 1 person/.test(t)) note("FAIL the family code was not looked up live: " + t.slice(0, 160));
      await btn(page, "Create account").click(); await page.waitForTimeout(1500);
      const prof = profileNamed(db, "Ellie Tran");
      if (!prof || prof.family_id !== FAM_ID || prof.account_type !== "junior") note("FAIL not put in the family as a junior: " + JSON.stringify(prof)); else note("in the family as a junior");
    });

    await scenario(browser, "09-sign-up-existing-email-confirm-on", async ({ page, db, shot, note }) => {
      await startCreate(page, "Coach", "Golf");
      await fillDetails(page, { name: "Sinéad Walsh", email: "coach@example.ie", pass: "another12" });
      await btn(page, "Create account").click(); await page.waitForTimeout(1000); await shot("message");
      const t = await rootText(page);
      if (/already an account/.test(t)) note("told the email is already registered");
      else if (/Check your inbox/.test(t)) note("FAIL told to check the inbox for an email that already has an account");
      else note("FAIL message: " + t.slice(0, 160));
    }, { confirmEmail: true });
  } finally {
    await browser.close(); M.stopServer(server);
  }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\nauth-basics: ${results.filter((r) => r.ok).length}/${results.length} passing`);
  process.exit(0);
})();
