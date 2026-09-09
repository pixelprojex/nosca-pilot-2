/* DEAD ENDS. Every button, tab and link on every reachable screen, as
   each role, tapped once — and anything that does nothing is a failure.
   "Something" is a change of screen, a sheet opening, a toast, a
   navigation, a dialog, a file input, a native share, or a control
   changing its own state (a toggle, a segmented choice, a chip). A
   control whose only effect is to look pressed is a dead end.

   Usage: node dead-ends.cjs <distDir> <port> <outDir>
   Runs against the same mocked Supabase as the other suites, so the
   coach has a roster and lessons and every screen is populated. */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4211), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d", eoin: "00000000-0000-4000-8000-000000e01e00" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
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
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-01", focus: "Short game", notes: "Cleaner contact from the fringe." });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "4:00 pm"], [0, 1, 2, 3, 4]) });
  return db;
}

/* what the tester must not press: it would end the session or destroy data */
const NEVER = /sign out|log out|delete|leave|remove|withdraw|clear all|call off|cancel the lesson|decline|end the/i;

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const dead = [], tapped = {}, consoleNoise = [];
  try {
    /* ROLES=coach,adult narrows a run, so the four can go in parallel */
    for (const role of (process.env.ROLES || "coach,adult,parent,junior").split(",")) {
      const db = freshDb(); const u = Object.values(db.users).find((x) => x.id === IDS[role]);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
      const page = await ctx.newPage(); await M.attach(page, db);
      page.on("console", (m) => { if (["warning", "error"].includes(m.type()) && !/vibrate|Download the React DevTools/.test(m.text())) consoleNoise.push({ role, type: m.type(), text: m.text().slice(0, 160) }); });
      page.on("pageerror", (e) => consoleNoise.push({ role, type: "pageerror", text: String(e.message || e).slice(0, 160) }));
      await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.__shares = 0; if (navigator.share) navigator.share = async () => { window.__shares++; }; });
      await M.injectSession(page, M.session(u, db));
      const home = async () => { await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page); };
      await home();

      /* a fingerprint of "what is on screen and what state it is in" */
      const state = () => page.evaluate(() => {
        const root = document.getElementById("root");
        const text = (root && root.innerText || "").replace(/\s+/g, " ").trim();
        const sheet = !!document.querySelector("[data-sheet]");
        const pressed = Array.from(document.querySelectorAll("[aria-pressed],[aria-current],[aria-checked],[aria-expanded]")).map((e) => e.getAttribute("aria-pressed") + e.getAttribute("aria-current") + e.getAttribute("aria-checked") + e.getAttribute("aria-expanded")).join("");
        const inputs = Array.from(document.querySelectorAll("input,textarea,select")).map((i) => i.type === "checkbox" || i.type === "radio" ? String(i.checked) : i.value).join("|");
        const backs = document.querySelectorAll('[aria-label="Back"]').length;
        return { text, sheet, pressed, inputs, backs, opened: (window.__opened || []).length, shares: window.__shares || 0, files: document.activeElement && document.activeElement.type === "file" };
      });
      const changed = (a, b) => a.text !== b.text || a.sheet !== b.sheet || a.pressed !== b.pressed || a.inputs !== b.inputs || a.backs !== b.backs || a.opened !== b.opened || a.shares !== b.shares;

      /* a control that is already in the state it would put you in — the
         tab you are on, the segment that is selected, a pressed toggle —
         does nothing on purpose, and is not a dead end */
      /* on screen, enabled, and actually reachable by a finger: a button
         under an open sheet's scrim is not one a person can press */
      const visible = () => page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], a[href]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && !b.disabled && getComputedStyle(b).pointerEvents !== "none"; }).map((b, i) => ({ i, covered: (() => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); return !!top && top !== b && !b.contains(top) && !top.contains(b); })(), on: b.getAttribute("aria-current") === "page" || b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-selected") === "true" || b.getAttribute("aria-checked") === "true", label: (b.getAttribute("aria-label") || b.innerText || b.getAttribute("data-tour") || b.getAttribute("href") || "").replace(/\s+/g, " ").trim().slice(0, 48) })));
      const tapNth = (i) => page.evaluate((i) => { const els = Array.from(document.querySelectorAll('button, [role="button"], a[href]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && !b.disabled && getComputedStyle(b).pointerEvents !== "none"; }); const el = els[i]; if (!el) return null; const lab = (el.getAttribute("aria-label") || el.innerText || "").trim().slice(0, 48); el.click(); return lab; }, i);

      /* the screens to sweep: home, every tab, and the two header doors */
      const doors = [["home", []], ...(await page.evaluate(() => Array.from(document.querySelectorAll('[data-tour^="tab-"]')).map((t) => [t.getAttribute("data-tour"), [`[data-tour="${t.getAttribute("data-tour")}"]`]]))),
                     ["you", ['[aria-label="Your profile"]']], ["alerts", ['[aria-label="Alerts"]']], ["quick", ['[data-tour="quick"]']]];
      const seenScreens = new Set();
      for (const [name, steps] of doors) {
        await home();
        let ok = true;
        for (const sel of steps) { const el = page.locator(sel).first(); if (!(await el.count())) { ok = false; break; } await el.dispatchEvent("click"); await page.waitForTimeout(700); }
        if (!ok) continue;
        const key = (await state()).text.slice(0, 160); if (seenScreens.has(key)) continue; seenScreens.add(key);
        const controls = await visible();
        for (const c of controls) {
          if (NEVER.test(c.label) || c.on || c.covered) continue;
          /* back to this exact screen before every tap, so each control is judged on its own */
          await home();
          for (const sel of steps) { const el = page.locator(sel).first(); if (await el.count()) { await el.dispatchEvent("click"); await page.waitForTimeout(600); } }
          const before = await state();
          const lab = await tapNth(c.i); if (lab == null) continue;
          tapped[role] = (tapped[role] || 0) + 1;
          await page.waitForTimeout(750);
          const after = await state();
          if (!changed(before, after)) {
            /* a second look: some things animate in slowly */
            await page.waitForTimeout(700);
            const later = await state();
            if (!changed(before, later)) { dead.push({ role, screen: name, control: lab || c.label || `#${c.i}` }); await page.screenshot({ path: path.join(outDir, `dead-${role}-${name}-${(lab || c.label || c.i).toString().replace(/[^a-z0-9]+/gi, "_").slice(0, 30)}.png`) }); }
          }
        }
      }
      await ctx.close();
    }
  } finally { await browser.close(); M.stopServer(server); }
  fs.writeFileSync(path.join(outDir, "dead-ends.json"), JSON.stringify({ dead, tapped, consoleNoise }, null, 2));
  console.log(`tapped: ${Object.entries(tapped).map(([r, n]) => `${r} ${n}`).join(" · ")}`);
  for (const d of dead) console.log(`DEAD  ${d.role} · ${d.screen} · "${d.control}"`);
  const noise = consoleNoise.filter((x, i, a) => a.findIndex((y) => y.text === x.text) === i);
  for (const n of noise.slice(0, 20)) console.log(`CONSOLE ${n.role} ${n.type}: ${n.text}`);
  console.log(`${dead.length === 0 ? "PASS" : "FAIL"}  no dead ends (${dead.length})`);
  console.log(`${noise.length === 0 ? "PASS" : "FAIL"}  console clean (${noise.length} distinct)`);
  console.log(`\ndead-ends: ${dead.length === 0 && noise.length === 0 ? "clean" : "issues"}`);
  process.exit(0);
})();
