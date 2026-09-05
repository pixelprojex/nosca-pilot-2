/* SEED SWEEP — signs in as each role (session injected, so it does not
   depend on the sign-in screens), crawls the interface by tapping what is
   visible, and checks every rendered screen for seeded names, numbers,
   emails and codes. Usage: node sweep.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4190), BASE = `http://localhost:${PORT}`, SB = "https://mock.supabase.co";
fs.mkdirSync(outDir, { recursive: true });
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

const SEEDED = ["Ray Doyle", "ray@hollowbrook", "+353 87 123 4567", "Marcus Tran", "Priya Ellis", "Dan Okafor", "Sofia Reyes",
  "Tom Beckett", "Hannah Doyle", "Hollowbrook", "RD4K9P", "TrackMan", "Breathnach", "Summer clinic", "Junior squad", "Ladies group",
  "Captain's Prize", "Club Championship", "Garda", "Safeguarding", "Face-on", "Down the line", "Marcus T.", "Priya E.", "Dan O.", "1284"];
/* people in the mock; every name here is allowed to appear for the role that owns it */
const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
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
    log: [] };
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
    if (p.startsWith("/rest/v1/rpc/")) { const fn = p.split("/").pop(); if (fn === "find_coach_by_code") { const c = String(body.p_code || "").trim().toUpperCase(); return json(200, Object.values(db.profiles).filter((x) => x.role === "coach" && x.invite_code === c).map((x) => ({ id: x.id, sport: x.sport, name: x.name }))); } return json(200, null); }
    if (p === "/rest/v1/profiles") { const id = me(); const mine = db.profiles[id];
      const visible = Object.values(db.profiles).filter((x) => id && (x.id === id || x.coach_id === id || x.guardian_id === id || (mine && (x.id === mine.coach_id || x.id === mine.guardian_id))));
      const idEq = url.searchParams.get("id"); const rows = idEq && idEq.startsWith("eq.") ? visible.filter((x) => x.id === idEq.slice(3)) : visible;
      if (method === "GET") return respond(rows); if (method === "PATCH") { const upd = rows.filter((x) => x.id === id); upd.forEach((x) => Object.assign(x, body)); return json(200, upd); } }
    if (p.startsWith("/rest/v1/") && method === "GET") return wantObject ? json(406, { code: "PGRST116", message: "no rows" }) : json(200, []);
    if (p.startsWith("/rest/v1/")) return json(201, Array.isArray(body) ? body : [body || {}]);
    return json(404, { message: "not mocked: " + p });
  });
}
async function startServer() { const child = spawn("npx", ["vite", "preview", "--outDir", distDir, "--port", String(PORT), "--strictPort"], { cwd: require("path").resolve(__dirname, "../.."), stdio: ["ignore", "pipe", "pipe"], detached: true });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("no server")), 20000); child.stdout.on("data", (d) => { if (String(d).includes("localhost")) { clearTimeout(t); res(); } }); }); return child; }
const norm = (s) => s.replace(/\s+/g, " ").trim();
const allowedFor = { coach: ["Niamh Byrne", "Cian Murphy", "Saoirse Kelly", "QW7X2M"], adult: ["Cian Murphy", "Niamh Byrne"], parent: ["Orla Kelly", "Saoirse Kelly", "Niamh Byrne"], junior: ["Saoirse Kelly", "Orla Kelly", "Niamh Byrne"] };

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const report = {};
  try {
    for (const role of ["coach", "adult", "parent", "junior"]) {
      const db = freshDb(); const u = Object.values(db.users).find((x) => x.id === IDS[role]);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage(); attach(page, db);
      const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
      await page.addInitScript(([key, sess]) => { try { localStorage.setItem(key, JSON.stringify(sess)); localStorage.setItem("nosca.seen." + sess.user.id, "1"); } catch {} }, ["nosca.auth", session(u)]);
      await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(7200);   // the opening
      const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(500); }
      const hits = [], seen = new Set(), visited = [];
      const record = async (label) => { const text = norm(await page.evaluate(() => document.getElementById("root").innerText)); const key = text.slice(0, 200); if (seen.has(key)) return false; seen.add(key); visited.push(label);
        for (const s of SEEDED) if (text.includes(s) && !(allowedFor[role] || []).includes(s)) hits.push({ screen: label, seeded: s });
        for (const m of text.match(/\+353[\d ]{6,}|[\w.]+@[\w.]+\.ie/g) || []) if (!/@t\.ie$/.test(m)) hits.push({ screen: label, seeded: m });
        return true; };
      await record("home");
      /* breadth-first: tap each visible button from a fresh home, then tap each visible button on that screen once */
      const clickable = async () => page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && !b.disabled; }).map((b, i) => ({ i, label: (b.getAttribute("aria-label") || b.innerText || b.getAttribute("data-tour") || "").replace(/\s+/g, " ").trim().slice(0, 40) })));
      const tap = async (i) => { const ok = await page.evaluate((i) => { const els = Array.from(document.querySelectorAll('button, [role="button"]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && !b.disabled; }); const el = els[i]; if (!el) return false; el.click(); return true; }, i); await page.waitForTimeout(650); return ok; };
      const home = async () => { await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(7200); const s = page.getByText("Skip", { exact: true }); if (await s.count()) await s.first().click().catch(() => {}); };
      const first = await clickable(); let budget = 70;
      for (const a of first) { if (budget <= 0) break; if (!(await tap(a.i))) continue; budget--; const fresh = await record(a.label || `#${a.i}`);
        if (fresh) { const second = await clickable(); for (const b of second.slice(0, 14)) { if (budget <= 0) break; if (/sign out|delete|log out/i.test(b.label)) continue; if (!(await tap(b.i))) continue; budget--; await record(`${a.label} → ${b.label}`); await page.goBack().catch(() => {}); const back = page.locator('[aria-label="Back"]'); if (await back.count()) await back.first().click().catch(() => {}); await page.waitForTimeout(350); } }
        await home(); }
      const shot = path.join(outDir, `${role}-home.png`); await page.screenshot({ path: shot });
      report[role] = { screens: visited.length, hits, errors: errors.filter((e) => !/vibrate/.test(e)) };
      console.log(`${role}: ${visited.length} distinct screens · ${hits.length} seed hit(s) · ${report[role].errors.length} page error(s)`);
      for (const h of hits.slice(0, 25)) console.log(`   LEAK  ${h.screen}  ⟶  "${h.seeded}"`);
      for (const e of report[role].errors.slice(0, 5)) console.log(`   ERROR ${e.slice(0, 160)}`);
      await ctx.close();
    }
  } finally { await browser.close(); try { process.kill(-server.pid, "SIGTERM"); } catch {} }
  fs.writeFileSync(path.join(outDir, "sweep.json"), JSON.stringify(report, null, 2));
  const total = Object.values(report).reduce((n, r) => n + r.hits.length, 0);
  console.log(`\nTOTAL seed hits: ${total}`); process.exit(0);
})();
