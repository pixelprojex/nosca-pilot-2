/* ACCOUNT DELETION, end to end: Settings → Delete account → password → files removed →
   delete_my_account → signed out → landing.  Usage: node run-delete.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs"); const { spawn } = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [distDir, portArg, outDir] = process.argv.slice(2); const PORT = Number(portArg || 4197), BASE = `http://localhost:${PORT}`, SB = "https://mock.supabase.co";
fs.mkdirSync(outDir, { recursive: true });
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-00000000c0ac";
const user = { id: UID, email: "coach@t.ie", password: "secret12" };
const session = () => { const exp = Math.floor(Date.now() / 1000) + 86400; return { access_token: `${b64u({ alg: "HS256" })}.${b64u({ sub: UID, email: user.email, role: "authenticated", aud: "authenticated", exp })}.sig`, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "rt_" + UID, user: { id: UID, aud: "authenticated", role: "authenticated", email: user.email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: {}, identities: [{ id: UID, provider: "email" }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } }; };
const db = { alive: true, profile: { id: UID, role: "coach", name: "Niamh Byrne", sport: "golf", account_type: "coach", coach_id: null, guardian_id: null, invite_code: "QW7X2M", family_code: "FAM222", date_of_birth: null, phone: null, club: null, created_at: "2026-01-01T00:00:00Z" },
  files: { [`${UID}`]: [{ name: "lesson-a", id: null }, { name: "lesson-b", id: null }], [`${UID}/lesson-a`]: [{ name: "1-clip.mp4", id: "f1" }, { name: "2-note.m4a", id: "f2" }], [`${UID}/lesson-b`]: [{ name: "3-photo.jpg", id: "f3" }] },
  removed: [], calls: [], passwordChecks: [] };
(async () => {
  const child = spawn("npx", ["vite", "preview", "--outDir", distDir, "--port", String(PORT), "--strictPort"], { cwd: require("path").resolve(__dirname, "../.."), stdio: ["ignore", "pipe", "pipe"], detached: true });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("no server")), 20000); child.stdout.on("data", (d) => { if (String(d).includes("localhost")) { clearTimeout(t); res(); } }); });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const notes = []; let ok = true; const fail = (m) => { ok = false; notes.push("FAIL " + m); }; const pass = (m) => notes.push("PASS " + m);
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.route("https://api.fontshare.com/**", (r) => r.abort());
    page.route(`${SB}/**`, async (route) => {
      const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method(), hdr = req.headers();
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: body === undefined ? "" : JSON.stringify(body) });
      const body = (() => { try { return JSON.parse(req.postData() || "null"); } catch { return null; } });
      db.calls.push(`${method} ${p}${url.search}`);
      if (method === "OPTIONS") return json(200, undefined);
      if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") { const b = body(); db.passwordChecks.push(b.password); return b.password === user.password && db.alive ? json(200, session()) : json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }); }
      if (p === "/auth/v1/token") return json(200, session());
      if (p === "/auth/v1/user" && method === "GET") return db.alive ? json(200, session().user) : json(401, { msg: "invalid JWT" });
      if (p === "/auth/v1/logout") return json(204, undefined);
      const wantObject = /vnd\.pgrst\.object\+json/.test(hdr["accept"] || "");
      if (p === "/rest/v1/profiles" && method === "GET") { const rows = db.alive ? [db.profile] : []; return wantObject ? (rows.length ? json(200, rows[0]) : json(406, { code: "PGRST116" })) : json(200, rows); }
      if (p === "/rest/v1/rpc/delete_my_account") { db.alive = false; return json(204, undefined); }
      if (p.startsWith("/rest/v1/rpc/")) return json(200, null);
      if (p.startsWith("/rest/v1/") && method === "GET") return wantObject ? json(406, { code: "PGRST116" }) : json(200, []);
      if (p === "/storage/v1/object/list/media" && method === "POST") { const b = body(); const prefix = (b.prefix || "").replace(/\/$/, ""); return json(200, (db.files[prefix] || []).map((f) => ({ name: f.name, id: f.id, updated_at: "2026-01-01T00:00:00Z", metadata: f.id ? { size: 10 } : null }))); }
      if (p === "/storage/v1/object/media" && method === "DELETE") { const b = body(); const prefixes = b.prefixes || []; db.removed.push(...prefixes); return json(200, prefixes.map((n) => ({ name: n }))); }
      return json(404, { message: "not mocked " + p });
    });
    await page.addInitScript(([key, sess]) => { try { localStorage.setItem(key, JSON.stringify(sess)); localStorage.setItem("nosca.seen." + sess.user.id, "1"); } catch {} }, ["nosca.auth", session()]);
    await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(7200);
    const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) await skip.first().click().catch(() => {});
    /* header avatar → You */
    const avatar = page.getByRole("button", { name: "Your profile", exact: true }); if (await avatar.count()) await avatar.first().click(); else { const btns = await page.$$("button"); await btns[btns.length - 1].click(); }
    await page.waitForTimeout(600);
    let t = await page.evaluate(() => document.getElementById("root").innerText);
    if (!/Delete account/.test(t)) { await page.screenshot({ path: path.join(outDir, "no-settings.png") }); fail("could not reach Settings (text: " + t.slice(0, 80).replace(/\n/g, " ") + ")"); }
    else {
      pass("Settings reached; Delete account row present once: " + ((t.match(/Delete account/g) || []).length === 1));
      await page.getByText("Delete account", { exact: false }).first().scrollIntoViewIfNeeded(); await page.getByText("Delete account", { exact: false }).first().click(); await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, "confirm-sheet.png") });
      const pw = page.locator('input[type="password"]'); if (!(await pw.count())) fail("no password field in the confirm sheet"); else {
        await pw.first().fill("wrongpass"); await page.locator("div.z-40").getByRole("button", { name: /Delete/ }).last().click(); await page.waitForTimeout(700);
        t = await page.evaluate(() => document.getElementById("root").innerText);
        if (db.alive && /isn't right|not right|wrong/i.test(t)) pass("wrong password refused, account untouched"); else fail("wrong password: alive=" + db.alive + " text=" + t.slice(0, 120).replace(/\n/g, " "));
        await pw.first().fill(user.password); await page.locator("div.z-40").getByRole("button", { name: /Delete/ }).last().click(); await page.waitForTimeout(2500);
        t = await page.evaluate(() => document.getElementById("root").innerText);
        if (!db.alive) pass("delete_my_account called with the right password"); else fail("delete_my_account never called");
        const want = [`${UID}/lesson-a/1-clip.mp4`, `${UID}/lesson-a/2-note.m4a`, `${UID}/lesson-b/3-photo.jpg`];
        if (want.every((w) => db.removed.includes(w))) pass("all three files removed by full path"); else fail("storage removal incomplete: " + JSON.stringify(db.removed));
        if (db.calls.some((c) => c.includes("/auth/v1/logout"))) pass("signed out"); else fail("no sign-out call");
        if (/Create account/.test(t)) pass("back on the landing screen"); else fail("not on landing: " + t.slice(0, 100).replace(/\n/g, " "));
        await page.screenshot({ path: path.join(outDir, "after-delete.png") });
      }
    }
    if (errors.filter((e) => !/vibrate/.test(e)).length) fail("page errors: " + errors.join(" | ").slice(0, 200));
    await ctx.close();
  } finally { await browser.close(); try { process.kill(-child.pid, "SIGTERM"); } catch {} }
  notes.forEach((n) => console.log(n)); console.log(ok ? "DELETION: PASS" : "DELETION: FAIL"); process.exit(0);
})();
