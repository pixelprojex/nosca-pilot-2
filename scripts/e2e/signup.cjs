/* End-to-end proof of the sign-up / sign-in path against the shared mock
   (mock.cjs), which behaves like the real database after nosca.sql: the
   trigger creates the profile, turns a coach code into a pending request
   and a family code into membership, and makes a parent a family of
   their own; codes are looked up live; join_coach asks, join_family joins.
   Usage: node signup.cjs <distDir> <port> <outDir> [only] */
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");

const [distDir, portArg, outDir, onlyArg] = process.argv.slice(2);
const ONLY = (onlyArg || "").split(",").filter(Boolean);
/* headless artefacts, not app errors: aborted font CSS, and Chrome refusing vibrate() before a tap */
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
  /* a parent who already has a family; FAM777 is its code */
  M.addFamily(db, { id: FAM_ID, code: "FAM777", createdBy: GRAINNE_ID });
  M.addUser(db, { id: GRAINNE_ID, email: "grainne@example.ie", password: "secret123", meta: { role: "player", name: "Gráinne Tran", sport: "tennis", account_type: "parent" } });
  M.addProfile(db, { id: GRAINNE_ID, role: "player", name: "Gráinne Tran", sport: "tennis", type: "parent", familyId: FAM_ID, createdAt: "2026-01-02T00:00:00Z" });
  return db;
}
const addPlayer = (db, { email, name, coachId = null, familyId = null, dob = "1985-01-01", type = "adult" }) => {
  const id = M.uuid("00000000"); M.addUser(db, { id, email, password: "secret123", meta: { role: "player", name, sport: "tennis", account_type: type } });
  M.addProfile(db, { id, role: "player", name, sport: "tennis", type, coachId, familyId, dob, createdAt: "2026-02-01T00:00:00Z" }); return id;
};
const addCoach = (db, { name, code }) => { const id = M.uuid("00000000"); M.addProfile(db, { id, role: "coach", name, sport: "golf", inviteCode: code, createdAt: "2026-01-01T00:00:00Z" }); return id; };

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
const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
async function waitSplash(page) { await page.waitForTimeout(6800); }   // the branded opening holds 5.4s then lifts
/* the first-run walkthrough opens over the home screen; a person taps Skip */
async function dismissTour(page) { const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); return true; } return false; }
const btn = (page, name) => page.getByRole("button", { name, exact: true });
const codeBoxes = M.codeBoxes;

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
const requestOf = (db, playerId) => db.requests.find((r) => r.player_id === playerId);

(async () => {
  const server = await M.startServer(distDir, PORT);
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
      if (!/ask to join you/.test(t)) note("FAIL the coach's arrival should say players ask to join (they are accepted from Roster): " + t.slice(0, 200));
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
      await page.waitForTimeout(300);
      if (await rootEmpty(page)) { note("FAIL blank page after arrival"); return; }
      await waitSplash(page);
      const hadTour = await dismissTour(page); note("walkthrough opened after Show me around: " + hadTour);
      if (tourNow !== "1" && !hadTour) note("FAIL Show me around neither set nosca.tour.now nor opened the walkthrough");
      await shot("home");
      t = await rootText(page);
      if (/You're set up|Create account/.test(t.slice(0, 60))) note("FAIL did not reach the app after arrival");
    });

    await scenario(browser, "05-sign-up-parent-new-family", async ({ page, db, shot, note }) => {
      await startCreate(page, "Parent", "Tennis");
      if (await page.getByPlaceholder("DD").count()) note("FAIL a parent was asked for a date of birth");
      await fillDetails(page, { name: "Nuala Tran", email: "nuala@example.ie", pass: "secret123" });
      /* a parent's details step continues to the family step */
      await btn(page, "Continue").click(); await page.waitForTimeout(500); await shot("step4-family");
      let t = await rootText(page);
      if (!/Your family/.test(t)) { note("FAIL no family step for a parent: " + t.slice(0, 120)); return; }
      if (db.signups.length) note("FAIL the account was created before the family step");
      const boxes = await codeBoxes(page).count();
      if (boxes !== 6) note(`FAIL a parent's codes step should have only the six family boxes, saw ${boxes}`); else note("codes step for a parent: family code only, no coach code field");
      if (!/Otherwise one is made for you/.test(t)) note("FAIL the family field does not say a family is made otherwise: " + t.slice(0, 200));
      if (!(await btn(page, "Start a new family").count())) { note("FAIL no 'Start a new family' way through"); return; }
      await btn(page, "Start a new family").click();
      await page.waitForTimeout(1800);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.data.role !== "player" || s.data.account_type !== "parent" || s.data.sport !== "tennis" || s.data.family_code !== "" || s.data.coach_code !== "") note("FAIL parent metadata wrong");
      const prof = profileNamed(db, "Nuala Tran");
      const fam = prof && prof.family_id && db.families[prof.family_id];
      if (!fam || fam.created_by !== prof.id) note("FAIL the trigger did not create a family for the parent"); else note("the trigger made a family, code " + fam.code);
      await shot("arrival-parent");
      t = await rootText(page);
      if (!fam || !t.includes(fam.code) || !/Your family is set up/.test(t) || !/Your children enter this code/.test(t)) note("FAIL arrival does not show the new family's code with the parent copy: " + t.slice(0, 200));
      else note("arrival shows the family code " + fam.code + " with the parent copy");
      await btn(page, "Show me around").click(); await page.waitForTimeout(300);
      await waitSplash(page); await dismissTour(page); await shot("home");
      t = await rootText(page);
      if (/Add your coach|Join your coach/.test(t)) note("FAIL a parent is held on the Add your coach screen");
      if (!(await page.locator('[data-tour="tab-family"][aria-current="page"]').count()) || !/No young players yet/.test(t)) note("FAIL a parent should land on the Family tab: " + t.slice(0, 120));
      else note("parent landed on the Family tab: " + t.slice(0, 60));
    });

    await scenario(browser, "05b-sign-up-parent-joins-existing-family", async ({ page, db, shot, note }) => {
      await startCreate(page, "Parent", "Tennis");
      await fillDetails(page, { name: "Conor Tran", email: "conor@example.ie", pass: "secret123" });
      await btn(page, "Continue").click(); await page.waitForTimeout(500);
      await codeBoxes(page).first().fill("fam777"); await page.waitForTimeout(900); await shot("family-matched");
      let t = await rootText(page);
      if (!/Gráinne's family · 1 person/.test(t)) note("FAIL the family code was not looked up live (find_family_by_code): " + t.slice(0, 200)); else note("live check: Gráinne's family · 1 person");
      await btn(page, "Create account").click(); await page.waitForTimeout(1800);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call"); return; }
      if (s.data.family_code !== "FAM777" || s.data.account_type !== "parent") note("FAIL metadata wrong: " + JSON.stringify(s.data));
      const prof = profileNamed(db, "Conor Tran");
      if (!prof || prof.family_id !== FAM_ID) note("FAIL the parent was not put in the existing family"); else note("joined Gráinne's family through the trigger");
      if (Object.values(db.families).length !== 1) note("FAIL a second family was created even though a code matched");
      if (!db.notifications.some((n) => n.user_id === GRAINNE_ID && n.kind === "family" && /Conor Tran joined your family/.test(n.title))) note("FAIL the family trigger did not tell Gráinne");
      await shot("arrival-joined");
      t = await rootText(page);
      if (!/You're in Gráinne's family/.test(t) || !t.includes("FAM777")) note("FAIL arrival should say You're in Gráinne's family with the code, got: " + t.slice(0, 160)); else note("arrival: You're in Gráinne's family, FAM777");
    });

    await scenario(browser, "06-sign-up-adult-player-with-coach-code", async ({ page, db, shot, note }) => {
      await startCreate(page, "Player", "Tennis");
      await fillDetails(page, { name: "Aoife Nolan", email: "aoife@example.ie", pass: "secret123", dob: ["02", "03", "1990"] });
      await btn(page, "Continue").click(); await page.waitForTimeout(400); await shot("step4-codes");
      let t = await rootText(page);
      if (!/Your codes/.test(t)) { note("FAIL no codes step: " + t.slice(0, 100)); return; }
      if (!(await btn(page, "Skip for now").count())) note("FAIL an adult has no Skip for now");
      if (!/Your coach accepts you from their app/.test(t)) note("FAIL the coach code hint does not say the coach accepts: " + t.slice(0, 200));
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
      const req = prof && requestOf(db, prof.id);
      if (!prof || prof.coach_id) note("FAIL a coach code must not link the player outright (coach_id set)");
      if (!req || req.coach_id !== COACH_ID || req.status !== "pending") note("FAIL the trigger did not create a pending coach_request"); else note("the trigger made a pending request to Sinéad Walsh");
      if (!db.notifications.some((n) => n.user_id === COACH_ID && n.kind === "request" && /Aoife Nolan asked to join/.test(n.title))) note("FAIL the request trigger did not tell the coach");
      await shot("arrival-player");
      t = await rootText(page);
      if (!/You've asked Sinéad Walsh/.test(t) || !/accept you from their app/.test(t)) note("FAIL arrival should say You've asked Sinéad Walsh, got: " + t.slice(0, 160)); else note("arrival: You've asked Sinéad Walsh");
      await btn(page, "Skip the tour").click(); await page.waitForTimeout(300);
      await waitSplash(page);
      const hadTour = await dismissTour(page);
      if (hadTour) note("FAIL the walkthrough opened even though the person skipped the tour");
      await shot("request-sent");
      t = await rootText(page);
      if (!(await page.locator('[data-tour="nocoach-pending"]').count()) || !/Request sent/.test(t) || !/Sinéad Walsh will accept you from their app/.test(t)) note("FAIL signed in, the player should see Request sent, got: " + t.slice(0, 160));
      else note("signed in: Request sent, naming Sinéad Walsh, with Withdraw the request");
      if (!(await btn(page, "Withdraw the request").count())) note("FAIL no way to withdraw the request");
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
      if (!/Gráinne's family · 1 person/.test(t)) note("FAIL the family code was not matched live with name and size: " + t.slice(0, 200)); else note("live check: Gráinne's family · 1 person");
      await btn(page, "Create account").click();
      await page.waitForTimeout(1800);
      const s = db.signups[0]; if (!s) { note("FAIL no sign-up call after the family code"); return; }
      note("metadata sent: " + JSON.stringify(s.data));
      if (s.data.account_type !== "junior" || s.data.family_code !== "FAM777" || s.data.coach_code !== "") note("FAIL junior metadata wrong");
      const prof = profileNamed(db, "Ellie Tran");
      if (!prof || prof.family_id !== FAM_ID) note("FAIL profile not put in the family"); else note("in Gráinne's family through the trigger");
      await shot("arrival-junior");
      t = await rootText(page);
      if (!/You're in Gráinne's family/.test(t)) note("FAIL arrival should name the family, got: " + t.slice(0, 120)); else note("arrival: You're in Gráinne's family");
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
      const u = db.users["coach@example.ie"];
      const s = M.session(u, db);
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
      const prof = profileNamed(db, "Cian Murphy"); const req = prof && requestOf(db, prof.id);
      if (!req || req.coach_id !== COACH_ID || req.status !== "pending" || prof.coach_id) note("FAIL the deep link should end in a pending request, not a link: " + JSON.stringify({ req, coach: prof && prof.coach_id })); else note("a pending request to the coach from the deep link");
    });

    await scenario(browser, "10b-deep-link-family-prefills-code", async ({ page, db, shot, note }) => {
      await page.goto(`${BASE}/?family=fam777`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400); await shot("landing-invited");
      let t = await rootText(page);
      if (!/You've been invited/.test(t) || !/Family code FAM777/.test(t)) note("FAIL landing does not name the family invitation: " + t.slice(0, 120));
      if (/family=/.test(page.url())) note("FAIL the code was left in the address bar: " + page.url());
      await btn(page, "Create account").click(); await pickChoice(page, "Player"); await pickChoice(page, "Tennis");
      const y = String(new Date().getFullYear() - 12);
      await fillDetails(page, { name: "Rian Tran", email: "rian@example.ie", pass: "secret123", dob: ["01", "06", y] });
      await btn(page, "Continue").click(); await page.waitForTimeout(900); await shot("codes-prefilled");
      const vals = await codeBoxes(page).evaluateAll((els) => els.map((e) => e.value).join(""));
      if (!vals.endsWith("FAM777") || vals.length !== 6) note("FAIL the family boxes were not pre-filled (coach boxes empty, family FAM777): " + JSON.stringify(vals)); else note("family code pre-filled from the link");
      t = await rootText(page);
      if (!/Gráinne's family · 1 person/.test(t)) note("FAIL the pre-filled family code was not checked live: " + t.slice(0, 200));
      await btn(page, "Create account").click(); await page.waitForTimeout(1500);
      const prof = profileNamed(db, "Rian Tran");
      if (!prof || prof.family_id !== FAM_ID || prof.account_type !== "junior") note("FAIL not put in the family from the deep link: " + JSON.stringify(prof)); else note("in the family from the deep link, as a junior");
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

    await scenario(browser, "13-sign-up-player-skip-then-ask-from-home", async ({ page, db, shot, note }) => {
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
      if (!(await btn(page, "Ask to join").count())) { note("FAIL the coachless screen's button should read Ask to join"); return; }
      await codeBoxes(page).first().fill("ABC234");
      await btn(page, "Ask to join").click();
      let sawLoading = false, sawJoined = false, sawPending = false;
      for (let i = 0; i < 40; i++) { await page.waitForTimeout(100); t = await rootText(page); if (/^Loading…/.test(t)) sawLoading = true; if (/Now coached by/.test(t)) sawJoined = true; if (/Request sent/.test(t)) sawPending = true; }
      await shot("after-ask");
      if (sawLoading) note("FAIL the whole app unmounted mid-join");
      if (sawJoined) note("FAIL the 'You're in' moment played though nothing was accepted yet");
      if (!sawPending) note("FAIL the Request sent screen never appeared: " + t.slice(0, 160));
      if (!db.rpcs.some((r) => r.fn === "join_coach" && r.args.p_code === "ABC234")) note("FAIL join did not go through the join_coach RPC");
      const prof = profileNamed(db, "Tom Beckett"); const req = prof && requestOf(db, prof.id);
      if (!req || req.status !== "pending" || req.coach_id !== COACH_ID) note("FAIL no pending request was made");
      if (prof && prof.coach_id) note("FAIL coach_id was written without the coach accepting");
      if (!/Sinéad Walsh will accept you/.test(t)) note("FAIL Request sent does not name the coach: " + t.slice(0, 160)); else note("asked through join_coach; Request sent names Sinéad Walsh");
      await btn(page, "Withdraw the request").click(); await page.waitForTimeout(1500); await shot("withdrawn");
      t = await rootText(page);
      if (!db.rpcs.some((r) => r.fn === "cancel_request" && r.args.p_id === req.id) || req.status !== "cancelled") note("FAIL Withdraw did not cancel the request through cancel_request");
      if (!/Add your coach/.test(t)) note("FAIL after withdrawing the screen should be Add your coach again: " + t.slice(0, 120)); else note("withdrawn through cancel_request; back to Add your coach");
    });

    await scenario(browser, "14-invite-sheet-real-code-and-qr", async ({ page, db, shot, note }) => {
      await signIn(page, "coach@example.ie", "secret123");
      await page.waitForTimeout(1200); await waitSplash(page); await dismissTour(page);
      await page.getByRole("button", { name: "Your profile" }).click(); await page.waitForTimeout(600);
      let t = await rootText(page);
      if (!/Invite code & QR ABC234/.test(t)) note("FAIL settings row does not show the real code: " + (t.match(/Invite code & QR \S+/) || [""])[0]);
      else note("settings row shows the real code");
      if (/Delete account/.test(t)) note("FAIL Delete account should live on the profile screen, not You, for a real account");
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

    /* a player who already has an account, no coach yet, taps the coach's join link */
    await scenario(browser, "15-join-link-signed-in-coachless-player", async ({ page, db, shot, note }) => {
      const id = addPlayer(db, { email: "tom@example.ie", name: "Tom Beckett", dob: "1988-11-11" });
      await signIn(page, "tom@example.ie", "secret123");
      await page.waitForTimeout(1200);
      await page.goto(`${BASE}/?join=abc234`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      if (/join=/.test(page.url())) note("FAIL the code was left in the address bar: " + page.url()); else note("code removed from the URL");
      await waitSplash(page); await dismissTour(page); await shot("nocoach-prefilled");
      let t = await rootText(page);
      if (!/Add your coach/.test(t)) { note("FAIL expected the Add your coach screen, got: " + t.slice(0, 120)); return; }
      const vals = await codeBoxes(page).evaluateAll((els) => els.map((e) => e.value).join(""));
      if (vals !== "ABC234") note("FAIL code boxes not pre-filled from the link: " + JSON.stringify(vals)); else note("code boxes pre-filled with ABC234");
      if (await btn(page, "Ask to join").isDisabled()) note("FAIL Ask to join is disabled with the code filled in");
      await btn(page, "Ask to join").click();
      let sawPending = false;
      for (let i = 0; i < 40; i++) { await page.waitForTimeout(100); t = await rootText(page); if (/Request sent/.test(t) && /Sinéad Walsh/.test(t)) sawPending = true; }
      await shot("after-ask");
      if (!sawPending) note("FAIL the Request sent screen never appeared");
      if (!db.rpcs.some((r) => r.fn === "join_coach" && r.args.p_code === "ABC234")) note("FAIL join did not go through join_coach");
      const req = requestOf(db, id);
      if (!req || req.status !== "pending" || db.profiles[id].coach_id) note("FAIL the link should end in a pending request"); else note("asked through the join link; pending with the coach");
    });

    /* a player who already has a coach taps a different coach's join link: offered by name, told to leave first */
    await scenario(browser, "16-join-link-signed-in-player-with-coach", async ({ page, db, shot, note }) => {
      const other = addCoach(db, { name: "Pádraig Óg", code: "KLM456" });
      const id = addPlayer(db, { email: "ann@example.ie", name: "Ann Burke", coachId: COACH_ID });
      await signIn(page, "ann@example.ie", "secret123");
      await page.waitForTimeout(1200);
      await page.goto(`${BASE}/?join=klm456`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await waitSplash(page); await dismissTour(page); await page.waitForTimeout(800); await shot("offer");
      let t = await rootText(page);
      if (!/You've been invited/.test(t)) { note("FAIL no invitation offer for a signed-in player: " + t.slice(0, 160)); return; }
      if (!/Ask to join Pádraig Óg\? Leave Sinéad Walsh first, from their profile\./.test(t)) note("FAIL the offer does not name both coaches and say to leave first: " + t.slice(0, 200)); else note("offer names the new coach and says to leave the current one first");
      if (!db.rpcs.some((r) => r.fn === "find_coach_by_code" && r.args.p_code === "KLM456")) note("FAIL the code was not looked up before the offer");
      if (await btn(page, "Ask to join").count()) note("FAIL an Ask to join button is offered although the player must leave their coach first");
      if (!(await btn(page, "Not now").count())) note("FAIL no Not now to close the offer");
      await btn(page, "Not now").click(); await page.waitForTimeout(600);
      if (db.rpcs.some((r) => r.fn === "join_coach")) note("FAIL join_coach was called");
      if (db.profiles[id].coach_id !== COACH_ID || requestOf(db, id)) note("FAIL the player's coach changed or a request was made"); else note("nothing changed: still with Sinéad Walsh, no request to " + db.profiles[other].name);
      await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500); await waitSplash(page); await dismissTour(page);
      t = await rootText(page);
      if (/You've been invited/.test(t)) note("FAIL the invitation was offered again after a reload"); else note("not offered again after a reload");
    });

    /* a real account's walkthrough leaves out steps whose control it never has */
    /* Signing in never plays the walkthrough — that belongs to sign-up.
       Settings → Walkthrough is the way back to it, and this is where
       the step counts for a real account are checked. */
    await scenario(browser, "17-live-tour-from-settings-not-on-sign-in", async ({ page, db, shot, note }) => {
      const counter = async () => (await page.locator("[data-tour-counter]").first().textContent().catch(() => "")) || "";
      const openFromSettings = async () => {
        await page.getByRole("button", { name: "You" }).first().click(); await page.waitForTimeout(700);
        await page.getByRole("button", { name: /Walkthrough/ }).first().click(); await page.waitForTimeout(1200);
      };

      await signIn(page, "coach@example.ie", "secret123");
      await page.waitForTimeout(1200); await waitSplash(page); await shot("coach-signed-in");
      if ((await counter()).trim()) note("FAIL the walkthrough opened on sign-in for a coach");
      else note("signing in did not play the walkthrough");
      await openFromSettings(); await shot("coach-tour");
      const c = (await counter()).trim();
      const cn = Number((c.match(/1 \/ (\d+)/) || [])[1]);
      if (!cn || cn < 15 || cn > 30) note("FAIL coach tour counter is " + JSON.stringify(c)); else note(`coach tour from Settings: ${cn} steps`);
      await dismissTour(page);

      addPlayer(db, { email: "ann@example.ie", name: "Ann Burke", coachId: COACH_ID });
      await page.evaluate(() => localStorage.clear());
      await signIn(page, "ann@example.ie", "secret123");
      await page.waitForTimeout(1200); await waitSplash(page); await shot("player-signed-in");
      if ((await counter()).trim()) note("FAIL the walkthrough opened on sign-in for a player");
      else note("signing in did not play the walkthrough for a player either");
      await openFromSettings(); await shot("player-tour");
      const p = (await counter()).trim();
      const pn = Number((p.match(/1 \/ (\d+)/) || [])[1]);
      if (!pn || pn < 8 || pn > 25) note("FAIL player tour counter is " + JSON.stringify(p)); else note(`player tour from Settings: ${pn} steps`);
      await dismissTour(page);
    });

    /* a family link, opened by a signed-in player */
    await scenario(browser, "18-family-link-signed-in-player", async ({ page, db, shot, note }) => {
      const id = addPlayer(db, { email: "ann@example.ie", name: "Ann Burke", coachId: COACH_ID });
      await signIn(page, "ann@example.ie", "secret123");
      await page.waitForTimeout(1200);
      await page.goto(`${BASE}/?family=fam777`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500); await waitSplash(page); await dismissTour(page); await page.waitForTimeout(800); await shot("offer");
      let t = await rootText(page);
      if (!/Join Gráinne's family\? 1 person in it\./.test(t)) { note("FAIL no family offer by name and size: " + t.slice(0, 160)); return; }
      note("offer names the family and its size");
      await btn(page, "Join").click(); await page.waitForTimeout(1500); await shot("joined");
      if (!db.rpcs.some((r) => r.fn === "join_family" && r.args.p_code === "FAM777")) note("FAIL join did not go through join_family");
      if (db.profiles[id].family_id !== FAM_ID) note("FAIL family_id not written"); else note("joined the family through the link");
      if (!db.notifications.some((n) => n.user_id === GRAINNE_ID && n.kind === "family")) note("FAIL the family trigger did not tell Gráinne");
      t = await rootText(page);
      if (/You've been invited/.test(t)) note("FAIL the offer is still open after joining");
      await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500); await waitSplash(page); await dismissTour(page);
      /* joining gives you a Family tab; the header stays your own account */
      await page.locator('[aria-label="Family"]').first().dispatchEvent("click"); await page.waitForTimeout(900); await shot("family");
      t = await rootText(page);
      if (!/Gráinne's family/.test(t) || !/Ann/.test(t)) note("FAIL the family tab does not show the joined family: " + t.slice(0, 160)); else note("the Family tab opens Gráinne's family with Ann in it");
    });
  } finally {
    await browser.close(); M.stopServer(server);
  }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\nsignup: ${results.filter((r) => r.ok).length}/${results.length} passing`);
  process.exit(0);
})();
