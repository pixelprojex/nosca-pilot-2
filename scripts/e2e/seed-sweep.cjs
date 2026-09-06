/* SEED SWEEP — signs in as each role (session injected, so it does not
   depend on the sign-in screens), crawls the interface by tapping what is
   visible, then walks straight to the newer screens (family, its
   settings, the profile, alerts, requests, a player's file), and checks
   every rendered screen for seeded names, numbers, emails and codes.
   Usage: node seed-sweep.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4190), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

/* people in the mock; every name here is allowed to appear for the role that owns it */
const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", eoin: "00000000-0000-4000-8000-000000e01e01" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const SUPPORT = "help@nosca.ie";   // the configured support address, shown on Help
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  M.addRequest(db, { playerId: IDS.eoin, coachId: IDS.coach, notify: true });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-08-28", focus: "Putting", notes: "Left hand a touch stronger." });
  return db;
}
const allowedFor = { coach: ["Niamh Byrne", "Cian Murphy", "Saoirse Kelly", "Orla Kelly", "Eoin Walsh", "QW7X2M"], adult: ["Cian Murphy", "Niamh Byrne"], parent: ["Orla Kelly", "Saoirse Kelly", "Niamh Byrne"], junior: ["Saoirse Kelly", "Orla Kelly", "Niamh Byrne"] };
/* the screens added with families, requests, notifications and the profile — each must be reached and read clean */
const TARGETS = {
  coach: [["requests", ['[data-tour="today-requests"]'], /Requests/], ["alerts", ['[aria-label="Alerts"]'], /Alerts/], ["you", ['[aria-label="Your profile"]'], /Sign out/], ["profile", ['[aria-label="Your profile"]', '[data-tour="settings-profile"]'], /Your profile/],
          ["player", ['[aria-label="Roster"]', '[data-tour="roster-row"]'], /lessons/i], ["notifications", ['[aria-label="Your profile"]', '[data-tour="settings-profile"]', '[data-tour="profile-notifications"]'], /Notifications/]],
  player: [["family", ['[data-tour="profile-pill"]'], /Family|family/], ["familyCode", ['[data-tour="profile-pill"]', '[data-tour="family-settings"], [data-tour="family-setup"]'], /Start a family|Who's in it/],
           ["alerts", ['[aria-label="Alerts"]'], /Alerts/], ["you", ['[aria-label="Your profile"]'], /Sign out/], ["profile", ['[aria-label="Your profile"]', '[data-tour="settings-profile"]'], /Your profile/],
           ["notifications", ['[aria-label="Your profile"]', '[data-tour="settings-profile"]', '[data-tour="profile-notifications"]'], /Notifications/]],
};

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const report = {};
  try {
    for (const role of ["coach", "adult", "parent", "junior"]) {
      const db = freshDb(); const u = Object.values(db.users).find((x) => x.id === IDS[role]);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage(); await M.attach(page, db);
      const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
      await M.injectSession(page, M.session(u, db));
      const home = async () => { await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page); };
      await home();
      const hits = [], seen = new Set(), visited = [];
      const record = async (label) => { const text = await M.rootText(page); const key = text.slice(0, 200); if (seen.has(key)) return false; seen.add(key); visited.push(label);
        for (const s of M.SEEDED) if (text.includes(s) && !(allowedFor[role] || []).includes(s)) hits.push({ screen: label, seeded: s });
        for (const m of text.match(/\+353[\d ]{6,}|[\w.]+@[\w.]+\.ie/g) || []) if (!/@t\.ie$/.test(m) && m !== SUPPORT) hits.push({ screen: label, seeded: m });
        return true; };
      await record("home");
      /* breadth-first: tap each visible button from a fresh home, then tap each visible button on that screen once */
      const clickable = async () => page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && !b.disabled; }).map((b, i) => ({ i, label: (b.getAttribute("aria-label") || b.innerText || b.getAttribute("data-tour") || "").replace(/\s+/g, " ").trim().slice(0, 40) })));
      const tap = async (i) => { const ok = await page.evaluate((i) => { const els = Array.from(document.querySelectorAll('button, [role="button"]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && !b.disabled; }); const el = els[i]; if (!el) return false; el.click(); return true; }, i); await page.waitForTimeout(650); return ok; };
      const first = await clickable(); let budget = 90;
      for (const a of first) { if (budget <= 0) break; if (/sign out|delete|log out|leave/i.test(a.label)) continue; if (!(await tap(a.i))) continue; budget--; const fresh = await record(a.label || `#${a.i}`);
        if (fresh) { const second = await clickable(); for (const b of second.slice(0, 14)) { if (budget <= 0) break; if (/sign out|delete|log out|leave|clear all|carry on/i.test(b.label)) continue; if (!(await tap(b.i))) continue; budget--; await record(`${a.label} → ${b.label}`); await page.goBack().catch(() => {}); const back = page.locator('[aria-label="Back"]'); if (await back.count()) await back.first().click().catch(() => {}); await page.waitForTimeout(350); } }
        await home(); }
      /* then the newer screens, on purpose */
      const reached = {};
      for (const [name, steps, sig] of (TARGETS[role === "coach" ? "coach" : "player"])) {
        await home();
        let ok = true;
        for (const sel of steps) { const el = page.locator(sel).first(); if (!(await el.count())) { ok = false; break; } await el.dispatchEvent("click"); await page.waitForTimeout(900); }
        const text = await M.rootText(page);
        await record(`→ ${name}`); seen.delete(text.slice(0, 200));
        reached[name] = ok && sig.test(text);
        await page.screenshot({ path: path.join(outDir, `${role}-${name}.png`) });
      }
      await home(); await page.screenshot({ path: path.join(outDir, `${role}-home.png`) });
      report[role] = { screens: visited.length, hits, errors: errors.filter((e) => !/vibrate/.test(e)), reached };
      const missing = Object.entries(reached).filter(([, v]) => !v).map(([k]) => k);
      console.log(`${role}: ${visited.length} distinct screens · ${hits.length} seed hit(s) · ${report[role].errors.length} page error(s) · reached ${Object.keys(reached).filter((k) => reached[k]).join(", ")}${missing.length ? ` · NOT reached: ${missing.join(", ")}` : ""}`);
      for (const h of hits.slice(0, 25)) console.log(`   LEAK  ${h.screen}  ⟶  "${h.seeded}"`);
      for (const e of report[role].errors.slice(0, 5)) console.log(`   ERROR ${e.slice(0, 160)}`);
      await ctx.close();
    }
  } finally { await browser.close(); M.stopServer(server); }
  fs.writeFileSync(path.join(outDir, "sweep.json"), JSON.stringify(report, null, 2));
  const total = Object.values(report).reduce((n, r) => n + r.hits.length, 0);
  const errs = Object.values(report).reduce((n, r) => n + r.errors.length, 0);
  const unreached = Object.values(report).reduce((n, r) => n + Object.values(r.reached).filter((v) => !v).length, 0);
  console.log(`${total === 0 ? "PASS" : "FAIL"}  0 seeded hits across every role (${total})`);
  console.log(`${errs === 0 ? "PASS" : "FAIL"}  0 page errors across every role (${errs})`);
  console.log(`${unreached === 0 ? "PASS" : "FAIL"}  every newer screen reached for every role (${unreached} missing)`);
  console.log(`\nTOTAL seed hits: ${total}`); process.exit(0);
})();
