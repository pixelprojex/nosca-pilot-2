/* THE IMPORT, END TO END AGAINST THE MOCK (docs/import/SPEC.md, "E2E").
 *
 *   PLAYWRIGHT_MODULE=… node scripts/e2e/import.cjs <distDir> <port> <outDir>
 *
 * A coach's WhatsApp history — and, with the coach's leave, a player's and
 * a parent's — read on the phone, sorted by the mock's function (the shared
 * validator, the gate, a plain reading of the coach's words, or the suite's
 * own plan), reviewed, and written in waves. The chats are the generated
 * fixtures (fixtures/make-chat-zip.cjs). Every scene starts from a fresh
 * database; the letters are the spec's.
 *
 *   (a) the gates   (b) the coach's switch   (r) refusals in words
 *   (c) Found   (d) sorting   (e) a day   (p) what is sent
 *   (g)(j) Import, a file that fails, a file whose answer is lost
 *   (l) the same chat again, and new files on those days
 *   (h) a player   (i) a parent for a junior   (n) remove
 *   (k) a reload mid-upload, a lost file   (m) stop   (o) the runner's answers
 *   (q) a register of this year's day   (s) nothing cut at 320 and 375
 *   (t) no reload under a job, and Sync   (u) an imported file taken off
 *   (v) the opening page, and the legal pages   (w) the founder's words, point by point
 */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const FX = require("./fixtures/make-chat-zip.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 6220), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

/* ---------------------------------------------------------------- the chats */
const CH = path.join(outDir, "chats"); FX.write(CH);
const chat = (n) => path.join(CH, n);
/* the plain chat under another coach's label, for "Check the coach" */
fs.writeFileSync(chat("chat-dave.txt"), fs.readFileSync(chat("chat-plain.txt"), "utf8").split(FX.COACH).join("Coach Dave"));
/* the iPhone chat with one more photo of the coach's on 13 March: new bytes, so a new file on a day already imported */
{
  const days = FX.DAYS.map(([iso, msgs]) => [iso, iso === "2025-03-13" ? [...msgs, ["17:55", "C", "", { kind: "photo", caption: "From behind" }]] : msgs]);
  const r = FX.render("iphone", days);
  let k = 0;
  const files = r.files.map((f) => (/^\d+-PHOTO-2025-03-13-17-55/.test(f.name) && !k++ ? { ...f, data: Buffer.concat([f.data, Buffer.from("more")]) } : f));
  fs.writeFileSync(chat("chat-more.zip"), FX.zip([{ name: "_chat.txt", data: Buffer.from(r.text, "utf8") }, ...files]));
}

const IDS = { coach: "c0000000-0000-4000-8000-00000000c0ac", cian: "a0000000-0000-4000-8000-0000000ad017", orla: "b0000000-0000-4000-8000-0000000b0001",
  tom: "b0000000-0000-4000-8000-0000000b0002", saoirse: "d0000000-0000-4000-8000-000000005a01", ellie: "e0000000-0000-4000-8000-00000000e111",
  aoife: "f0000000-0000-4000-8000-00000000a0fe" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const PASS = "secret12";
function freshDb({ allow = false, noImport = false, ready = true } = {}) {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.orla });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("cian", "cian@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Green", type: "adult", coachId: IDS.coach, dob: "1993-02-02" });
  person("orla", "orla@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("tom", "tom@t.ie", { role: "player", name: "Tom Kelly", type: "parent", familyId: FAM });
  person("saoirse", "saoirse@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  person("ellie", "ellie@t.ie", { role: "player", name: "Ellie Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2015-05-05" });
  M.setPrefs(db, IDS.coach, { player_imports: allow, setup_done: true });
  db.noImport = noImport; db.importReady = ready;
  return db;
}

const { check, summary } = M.checker("import");
/* ONLY=a,b,v,r,coach,h,i,n7,k,m,o,w,s,t runs those scenes alone (coach is c, d, e, f, p, g, j, q, l and the coach's own Remove) */
const want = (k) => !process.env.ONLY || process.env.ONLY.split(",").includes(k);
const until = async (fn, ms = 15000, every = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, every)); } return !!(await fn()); };
const sel = (t) => `[data-tour="${t}"]`;
const IGNORED = /Failed to load resource|vibrate|favicon/i;
const PATH_RE = /^import\/[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(mp4|m4v|mov|3gp|jpg|jpeg|png|webp|opus|ogg|m4a|mp3|aac)$/;

let server, browser;
const errors = [];
async function boot(db, who, { width = 390, height = 844, seen = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage(); await M.attach(page, db);
  const fn = [];
  page.on("request", (r) => { if (/\/\.netlify\/functions\/lesson-import/.test(r.url())) fn.push(r.method()); });
  page.on("pageerror", (e) => errors.push(`${who}: ${String(e.message || e)}`));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") { const tx = m.text(); if (!IGNORED.test(tx)) errors.push(`${who} console: ${tx.slice(0, 200)}`); } });
  const u = Object.values(db.users).find((x) => x.id === IDS[who]);
  await M.injectSession(page, M.session(u, db), { seen });
  await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
  const text = () => M.rootText(page);
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) }).catch(() => {});
  return { ctx, page, text, shot, fn, close: () => ctx.close() };
}
const count = (page, s) => page.locator(s).count();
const closeSheet = async (page) => { await page.mouse.click(195, 40); await page.waitForTimeout(600); };
/* Settings, as the coach (the pill) or anyone else (the switcher's Settings row) */
async function openSettings(page, coach) {
  await M.tap(page, sel("profile-pill"), 900);
  if (!coach) await M.tap(page, sel("sheet-settings"), 900);
}
/* from the home tab, so the header's pill is there */
async function openImport(page, coach, home = coach ? "Today" : "Home") {
  if (await page.locator(`[aria-label="${home}"]`).count()) await M.tap(page, `[aria-label="${home}"]`, 800);
  await openSettings(page, coach); await M.tap(page, sel("settings-import"), 1200);
}
async function choose(page, file) { await page.setInputFiles(sel("import-file"), file); await until(async () => (await count(page, sel("import-found"))) > 0 || (await count(page, sel("import-error"))) > 0 || (await count(page, sel("import-review"))) > 0, 12000); await page.waitForTimeout(400); }
async function setRole(page, label, role) { await page.locator(`[data-label="${label}"]`).click(); await page.waitForTimeout(500); await page.locator(`[data-import-role="${role}"]`).click(); await page.waitForTimeout(500); }
async function setFor(page, id) { await page.locator(sel("import-for")).click(); await page.waitForTimeout(500); await page.locator(`[data-person="${id}"]`).click(); await page.waitForTimeout(500); }
async function sorted(page) {
  await until(async () => { const st = await page.locator(sel("import-progress")).getAttribute("data-status").catch(() => null); return (await count(page, sel("import-review"))) > 0 && st !== "running"; }, 60000, 300);
  await page.waitForTimeout(600);
}
const rowsOf = (page) => page.$$eval(sel("import-row"), (els) => els.map((e) => ({ day: e.dataset.day, state: e.dataset.state, on: e.dataset.on === "1", text: e.innerText.replace(/\s+/g, " ").trim(), tick: !e.querySelector('[data-tour="import-tick"]').disabled })));
const rowOf = async (page, day) => (await rowsOf(page)).find((r) => r.day === day) || null;
const openDay = async (page, day) => { await page.locator(`${sel("import-row")}[data-day="${day}"] button`).first().click(); await page.waitForTimeout(700); };
const backBtn = async (page) => { await page.locator('[aria-label="Back"]').first().dispatchEvent("click"); await page.waitForTimeout(700); };
const importsOf = (db, pid) => db.imports.filter((b) => b.player_id === pid);
const noticesOf = (db, uid) => db.notifications.filter((n) => n.user_id === uid && /import/i.test(`${n.title} ${n.body || ""}`));
/* the coach, through Found to a sorted Review of the iPhone chat for Cian */
async function coachToReview(page, file = chat("chat-iphone.zip")) {
  await choose(page, file);
  if (await count(page, '[data-label="Cian M"][data-role=""]')) await setRole(page, "Cian M", "player");
  await setFor(page, IDS.cian);
  await page.locator(sel("import-sort")).click(); await page.waitForTimeout(600);
  await sorted(page);
}
const doneFor = (db, pid) => until(async () => importsOf(db, pid).some((b) => b.status === "done"), 40000, 300);
const idbCount = (page) => page.evaluate(() => new Promise((res) => { const r = indexedDB.open("nosca-offline"); r.onsuccess = () => { try { const t = r.result.transaction("lessons", "readonly").objectStore("lessons").getAll(); t.onsuccess = () => res(t.result.length); t.onerror = () => res(-1); } catch (e) { res(-1); } }; r.onerror = () => res(-1); }));
/* a player's own first imported lesson saved onto their phone, from their List */
async function downloadOne(page) {
  await page.locator(sel("log-view")).locator("button", { hasText: "List" }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('button[data-download="none"]').first().click().catch(() => {});
  return until(async () => (await count(page, 'button[data-download="saved"]')) > 0, 10000);
}
/* the 12px floor: no element carrying words under twelve pixels (the tab bar's labels are the written exception) */
const floor = (page) => page.evaluate(() => {
  const out = [];
  document.querySelectorAll("#root *").forEach((el) => {
    if (!el.offsetParent || el.closest("nav") || el.closest('[data-tour="tabbar"]')) return;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own && parseFloat(getComputedStyle(el).fontSize) < 12) out.push(`${el.textContent.trim().slice(0, 24)} @${getComputedStyle(el).fontSize}`);
  });
  return out;
});
/* nothing cut: no element past the screen's edge, nothing ellipsised that has more to say */
const cut = (page) => page.evaluate(() => {
  const W = window.innerWidth; const out = [];
  if (document.documentElement.scrollWidth > W + 1) out.push(`page ${document.documentElement.scrollWidth}`);
  document.querySelectorAll("#root *").forEach((el) => {
    if (!el.childNodes.length || !el.offsetParent) return;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) return;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.right > W + 1 && cs.position !== "fixed") out.push(`${el.textContent.trim().slice(0, 30)} → ${Math.round(r.right)}`);
    if (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) out.push(`… ${el.textContent.trim().slice(0, 30)}`);
  });
  return out;
});

(async () => {
  server = await M.startServer(distDir, PORT);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    /* ================================================================ (a) THE GATES */
    if (want("a")) {
      const db = freshDb({ noImport: true, allow: true });
      const c = await boot(db, "coach");
      await openSettings(c.page, true);
      const noRow = (await count(c.page, sel("settings-import"))) === 0;
      await M.back(c.page);
      await M.tap(c.page, '[aria-label="Roster"]', 800); await c.page.locator("button", { hasText: "Cian Murphy" }).first().click(); await c.page.waitForTimeout(900);
      const noFileRow = (await count(c.page, sel("player-import"))) === 0;
      check("(a1) a project whose SQL has not been re-run: no Settings row and no player-file row for the coach, and the function is never asked", noRow && noFileRow && c.fn.length === 0, `${noRow} ${noFileRow} ${c.fn.join(",")}`);
      check("(a1b) …and neither the batches nor the targets are read", !db.rpcs.some((r) => r.fn === "import_targets") && !db.rpcs.some((r) => r.fn === "import_lessons" && r.args.p_id), db.rpcs.map((r) => r.fn).join(","));
      await c.close();
      const p = await boot(db, "cian");
      const hero = (await count(p.page, sel("lessons-empty"))) > 0, heroKey = (await count(p.page, sel("lessons-import"))) === 0;
      check("(a2) a player on such a project: the empty Lessons hero carries no Import, and no request", hero && heroKey && p.fn.length === 0, `${hero} ${heroKey} ${p.fn}`);
      await p.close();
    }
    if (want("a")) {
      const db = freshDb({ ready: false, allow: true });
      const c = await boot(db, "coach");
      await openSettings(c.page, true);
      check("(a3) the SQL there, the key not: one GET at most, and no control", (await count(c.page, sel("settings-import"))) === 0 && c.fn.filter((m) => m === "GET").length <= 1 && !c.fn.includes("POST"), c.fn.join(","));
      await c.close();
    }
    if (want("a")) {
      const db = freshDb({ ready: true, allow: false });
      const p = await boot(db, "cian");
      await openSettings(p.page, false);
      const none = (await count(p.page, sel("settings-import"))) === 0;
      check("(a4) with the coach's switch off, a player sees no control and the function is never asked", none && p.fn.length === 0, `${none} ${p.fn}`);
      await p.close();
      const o = await boot(db, "orla");
      await openSettings(o.page, false);
      check("(a5) …nor a parent", (await count(o.page, sel("settings-import"))) === 0 && o.fn.length === 0, o.fn.join(","));
      await o.close();
    }

    /* ================================================================ (b) THE COACH'S SWITCH */
    if (want("b")) {
      const db = freshDb({ allow: false });
      M.addLesson(db, { coachId: IDS.coach, playerId: IDS.cian, date: "2026-09-20", focus: "Putting", unread: false });
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await c.shot("b1-start");
      check("(b1) the coach's Start: Imports from players, the two phones' steps and Choose file", (await count(c.page, sel("import-players"))) === 1 && (await count(c.page, sel("import-platform"))) === 1 && /Choose file/.test(await c.text()) && /Open the chat in WhatsApp/.test(await c.text()));
      await c.page.locator(`${sel("import-players")} button`).last().click(); await c.page.waitForTimeout(700);
      const notice = await c.text();
      check("(b2) turning it on opens the notice first", (await count(c.page, sel("import-allow"))) === 1 && /Your players and their parents can import their chats with you/.test(notice) && /sent to Anthropic to be sorted/.test(notice) && /Every lesson they import is marked as theirs · you can remove any of them/.test(notice), notice.slice(-300));
      await c.shot("b2-allow");
      await c.page.locator(sel("import-allow-yes")).click(); await c.page.waitForTimeout(900);
      check("(b3) Allow saves it, and says Allowed", db.prefs[IDS.coach].player_imports === true && /Allowed/.test(await c.text()));
      const p = await boot(db, "cian");
      await openSettings(p.page, false);
      check("(b4) the player's control appears on their next load", (await count(p.page, sel("settings-import"))) === 1);
      await p.close();
      await c.page.locator(`${sel("import-players")} button`).last().click(); await c.page.waitForTimeout(900);
      check("(b5) off asks nothing and saves", db.prefs[IDS.coach].player_imports === false && (await count(c.page, sel("import-allow"))) === 0);
      const p2 = await boot(db, "cian");
      await openSettings(p2.page, false);
      check("(b6) off, the player's control goes and nothing is removed", (await count(p2.page, sel("settings-import"))) === 0 && db.lessons.length === 1);
      await p2.close(); await c.close();
    }

    /* ================================================================ (v) THE OPENING PAGE, AND THE LEGAL PAGES */
    /* (launch, 28 November) the founder asked for the opening "very professional, very classy", saying how the chat
       is kept safe: the three steps, the safeguards in plain words, WhatsApp's own steps on both phones, one deep key
       held at the foot while the page scrolls — nothing cut at 390 or 320 — and the import's words in Privacy, the
       Terms and Data & permissions now the region and the retention are filled in */
    if (want("v")) {
      for (const [who, width] of [["coach", 390], ["coach", 320], ["cian", 390], ["cian", 320]]) {
        const coach = who === "coach", H = width === 320 ? 568 : 844, at = `${coach ? "the coach" : "a player"} at ${width}`;
        const db = freshDb({ allow: true });
        const c = await boot(db, who, { width, height: H });
        await openImport(c.page, coach);
        const lines = (t) => c.page.$$eval(`${sel(t)} [data-import-line]`, (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
        const how = await lines("import-how"), safe = await lines("import-safe");
        await c.shot(`v-${who}-${width}`);
        check(`(v1) ${at}: the three steps, numbered`, how.length === 3 && /^1 Export the chat from WhatsApp With its media$/.test(how[0]) && /^2 Nosca sorts it into lessons Day by day/.test(how[1]) && /^3 Tick the ones to keep Each is filed on its own day$/.test(how[2]), JSON.stringify(how));
        check(`(v2) ${at}: the six safeguards, said plainly`, safe.length === 6 && safe[0] === "The chat is read on your phone"
          && safe[1] === `${coach ? "Only your words go to the AI" : "Only the coach's words go to the AI"} Names Nosca knows, numbers and links are taken out first`
          && safe[2] === "Videos, photos and voice notes never go to the AI" && safe[3] === "Nothing is added until you tick it"
          && safe[4] === "Nobody else sees it until it is finished" && safe[5] === "It can be removed at any time", JSON.stringify(safe));
        /* one deep key, on the screen before any scroll and clear of the tab bar; nothing else on the page wears its colour */
        const keys = await c.page.evaluate(() => {
          const k = document.querySelector('[data-tour="import-choose"]'); const bar = document.querySelector('[data-tour="tabbar"]');
          const bg = getComputedStyle(k).backgroundColor, r = k.getBoundingClientRect(), b = bar ? bar.getBoundingClientRect() : null;
          /* a switch is not a key: the coach's Imports from players wears the colour while it is on */
          const deep = [...document.querySelectorAll('[data-scroll="screen"] button:not([aria-pressed])')].filter((x) => x.offsetParent && getComputedStyle(x).backgroundColor === bg).length;
          return { deep, top: r.top, bottom: r.bottom, h: window.innerHeight, bar: b ? b.top : window.innerHeight, text: k.innerText.trim() };
        });
        check(`(v3) ${at}: Choose file is the one deep key, on the screen at first paint above the tab bar`, keys.deep === 1 && keys.text === "Choose file" && keys.top > 0 && keys.bottom <= keys.bar + 1 && keys.bottom <= keys.h, JSON.stringify(keys));
        /* WhatsApp's own steps on both phones; Android's three dots drawn in the sentence, said in words to a reader */
        const steps = async () => (await lines("import-steps"));
        const iphone = (await c.page.locator(`${sel("import-platform")} button[aria-pressed="true"]`).innerText()).trim() === "iPhone" ? await steps() : null;
        await c.page.locator(`${sel("import-platform")} button`, { hasText: "Android" }).click(); await c.page.waitForTimeout(400);
        const android = await steps();
        const dots = await c.page.locator(`${sel("import-steps")} [data-glyph-in="dotsV"]`).count();
        check(`(v4) ${at}: WhatsApp's steps, iPhone and Android`, !!iphone && iphone.join(" | ") === "1 Open the chat in WhatsApp | 2 Tap the name at the top | 3 Tap Export Chat | 4 Tap Attach Media | 5 Tap Save to Files"
          && android.join(" | ") === "1 Open the chat in WhatsApp | 2 Tap the three dots, then More | 3 Tap Export chat | 4 Tap Include media | 5 Save the file" && dots === 1, `${(iphone || []).join(" | ")} // ${android.join(" | ")} · ${dots}`);
        await c.page.locator(`${sel("import-platform")} button`, { hasText: "iPhone" }).click(); await c.page.waitForTimeout(300);
        /* nothing cut: past the edge, ellipsised, or clipped inside its box; nothing under the 12px floor */
        const clipped = await c.page.evaluate(() => {
          const out = [];
          document.querySelectorAll('[data-scroll="screen"] *').forEach((el) => {
            if (!el.offsetParent || el.classList.contains("ins-sr") || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
            const cs = getComputedStyle(el);
            const hides = /hidden|clip/.test(cs.overflowY) || (cs.webkitLineClamp && cs.webkitLineClamp !== "none");
            if (hides && el.scrollHeight > el.clientHeight + 1) out.push(`↓ ${el.textContent.trim().slice(0, 30)}`);
          });
          return out;
        });
        const all = [...(await cut(c.page)), ...clipped];
        check(`(v5) ${at}: nothing on the opening page is cut`, all.length === 0, all.slice(0, 5).join(" | "));
        const small = await floor(c.page);
        check(`(v6) ${at}: …and nothing under the 12px floor`, small.length === 0, small.slice(0, 5).join(" | "));
        /* scrolled to its end, the key rests in its place under WhatsApp's steps, the coach's switch under it */
        await c.page.evaluate(() => { const s = document.querySelector('[data-scroll="screen"]'); s.scrollTo(0, s.scrollHeight); });
        await c.page.waitForTimeout(400);
        const order = await c.page.evaluate(() => {
          const y = (t) => { const e = document.querySelector(`[data-tour="${t}"]`); return e ? Math.round(e.getBoundingClientRect().top) : null; };
          return { steps: y("import-steps"), key: y("import-choose"), players: y("import-players") };
        });
        await c.shot(`v-${who}-${width}-end`);
        check(`(v7) ${at}: at the end the key rests under the steps${coach ? ", the switch under it" : ""}`, order.key > order.steps && (coach ? order.players > order.key : order.players === null), JSON.stringify(order));
        if (width === 390) {
          await c.page.evaluate(() => { const s = document.querySelector('[data-scroll="screen"]'); s.scrollTo(0, 0); });
          await c.page.locator(sel("import-start-privacy")).click(); await c.page.waitForTimeout(900);
          const pv = await c.text();
          check(`(v8) ${at}: Privacy Policy opens the policy, its Import paragraph filled in — the region, the processor, the retention`,
            /Privacy Policy/.test(pv) && /Import If you import a chat, it is read on your phone\./.test(pv) && /through Nosca's server \(Netlify, the United States\), to Anthropic/.test(pv)
            && /Anthropic acts as Nosca's processor, under a data processing agreement that includes the European Commission's standard contractual clauses\./.test(pv)
            && /It deletes the messages and its answers within 30 days, unless they are flagged under its usage policy or the law requires them to be kept longer\. Anthropic does not use them to train its models\./.test(pv)
            && !/null|undefined|<region>/.test(pv), pv.slice(pv.indexOf("Import If"), pv.indexOf("Import If") + 400));
          await backBtn(c.page);
          check(`(v9) ${at}: Back is the opening page again`, (await count(c.page, sel("import-choose"))) === 1);
        }
        await c.close();
      }
      /* the Terms' section and Data & permissions' line, from Settings, for both sides */
      for (const who of ["coach", "orla"]) {
        const db = freshDb({ allow: true });
        const c = await boot(db, who);
        if (who === "coach") await M.tap(c.page, '[aria-label="Today"]', 800); else if (await c.page.locator('[aria-label="Family"]').count()) await M.tap(c.page, '[aria-label="Family"]', 800);
        await openSettings(c.page, who === "coach");
        await M.tap(c.page, sel("settings-terms"), 900);
        const terms = await c.text();
        await backBtn(c.page);
        await M.tap(c.page, sel("settings-data"), 900);
        const dp = await c.text();
        await backBtn(c.page);
        const sect = terms.slice(terms.indexOf("Import You may"), terms.indexOf("Import You may") + 500);
        check(`(v10) ${who}: the Terms' Import section — took part and may share it, nothing added until ticked, marked as imported, who may remove`,
          /Content You keep ownership[^]*Import You may import a chat into Nosca only if you took part in it and are free to share it, and by importing one you confirm both\./.test(terms)
          && /The chat is sorted into lessons automatically and the sorting can be wrong, so nothing is added until you tick it\./.test(sect)
          && /Every imported lesson says it was imported, and by whom\./.test(sect)
          && /The coach, the player if they are 16 or over, and an adult who looks after the player can remove an import at any time, and its files are removed with it\. Money/.test(sect), sect);
        check(`(v11) ${who}: Data & permissions keeps only the lessons chosen and their files, nothing of the chat — and still says no payments`,
          /Import A chat you import is read on your phone\. Nosca keeps only the lessons you choose and their files, nothing of the chat\. Your data/.test(dp) && !/payment/i.test(dp), dp.slice(0, 400));
        await c.close();
      }
    }

    /* ================================================================ (r) REFUSALS, IN WORDS */
    if (want("r")) {
      const db = freshDb();
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      const said = async (file) => { await choose(c.page, file); return (await c.page.locator(sel("import-error")).innerText().catch(() => "")).trim(); };
      const g = await said(chat("chat-group.zip")); const s7 = await said(chat("chat-seven.zip")); const nz = await said(chat("not-a-chat.zip")); const nt = await said(chat("not-a-chat.txt"));
      check("(r) a group chat, a seven-label chat and a file that is not an export are each refused in one red line", g === "Group chats can't be imported" && s7 === "Only the coach and one family can be in an imported chat" && nz === "No chat found in that file" && nt === "That isn't a WhatsApp export", [g, s7, nz, nt].join(" | "));
      check("(r2) …and nothing was sent", db.importPosts.length === 0);
      await c.close();
    }

    /* ================================================================ (c)(d)(e)(p)(g)(j)(s) THE COACH'S IMPORT */
    let coachDb;
    if (want("coach")) {
      const db = coachDb = freshDb({ allow: true });
      /* a register of 14 June this year, Cian absent: never an imported 14 June 2025 (q) */
      db.sessions.push({ id: "5e000000-0000-4000-8000-0000000000a1", coach_id: IDS.coach, label: "Cian Murphy", session_date: "2026-06-14", created_at: "2026-06-14T10:00:00Z" });
      db.marks.push({ id: "6e000000-0000-4000-8000-0000000000a1", session_id: "5e000000-0000-4000-8000-0000000000a1", player_id: IDS.cian, state: "out" });
      db.importPlan = (body) => (body.segs.some((x) => x.part === "day" && /pre-shot routine/.test(x.text)) ? "review" : null);
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await choose(c.page, chat("chat-iphone.zip"));
      await c.shot("c1-found");
      const ft = await c.text();
      const vals = await c.page.$$eval(`${sel("import-counts")} [data-value]`, (els) => els.map((e) => e.textContent.trim()));
      check("(c1) Found: the range in the file, with years, and the counts — all on the phone, nothing sent", /Mon 3 Mar 2025 – Mon 17 Nov 2025/.test(ft) && vals.join("|") === "70|4|3|1|66 KB" && db.importPosts.length === 0, `${vals.join("|")} · ${ft.slice(0, 120)}`);
      const left = async (k) => (await c.page.locator(`${sel(`import-left-${k}`)} [data-row-value]`).innerText().catch(() => "")).trim();
      check("(c2) Left out: Not in the file 1, Documents 2, Stickers and GIFs 1", (await left("notInFile")) === "1" && (await left("documents")) === "2" && (await left("stickers")) === "1", [await left("notInFile"), await left("documents"), await left("stickers")].join(","));
      let opened = 0;
      for (const k of ["notInFile", "documents", "stickers"]) { await c.page.locator(sel(`import-left-${k}`)).click(); await c.page.waitForTimeout(500); if (await count(c.page, sel("import-left-sheet"))) opened++; await closeSheet(c.page); }
      check("(c3) each Left out row opens its list", opened === 3, String(opened));
      const sortAsleep1 = await c.page.locator(sel("import-sort")).isDisabled();
      const coachPre = await c.page.locator('[data-label="Niamh Byrne"]').getAttribute("data-role");
      await setRole(c.page, "Cian M", "player");
      const sortAsleep2 = await c.page.locator(sel("import-sort")).isDisabled();
      check("(c4) the coach's label is pre-filled as the coach; Sort sleeps until every label has a part and For is chosen", coachPre === "coach" && sortAsleep1 && sortAsleep2, `${coachPre} ${sortAsleep1} ${sortAsleep2}`);
      await setFor(c.page, IDS.aoife);
      check("(c5) …and wakes once both are", !(await c.page.locator(sel("import-sort")).isDisabled()));
      await c.page.locator(sel("import-preview")).click(); await c.page.waitForTimeout(600);
      const what = await c.page.locator(sel("import-what")).innerText().catch(() => "");
      check("(p1) See what is sent: the first coach-worded day's exact request — the coach's words, numbered, names taken out", /#1 C: Great first lesson today ⟨name⟩\./.test(what) && /P: \[message\]/.test(what) && !/Cian/.test(what), what.slice(0, 200));
      await closeSheet(c.page);
      await c.page.locator(sel("import-sort")).click(); await c.page.waitForTimeout(700);
      const chk = await c.text();
      check("(c6) a label that matches nobody's name opens Check who it's for", (await count(c.page, sel("import-check"))) === 1 && /Check who it's for/.test(chk) && /The chat is with “Cian M”/.test(chk) && /File under Aoife Green/.test(chk) && /Choose someone else/.test(chk), chk.slice(-200));
      await c.shot("c6-check");
      await c.page.locator(sel("import-check-back")).click(); await c.page.waitForTimeout(700);
      await c.page.locator(`[data-person="${IDS.cian}"]`).click(); await c.page.waitForTimeout(500);
      /* (d) sorting */
      const t0 = db.importPosts.length;
      await c.page.locator(sel("import-sort")).click();
      let sawLine = null, sawTrack = false;
      await until(async () => {
        const p = await c.page.locator(sel("import-progress")).innerText().catch(() => "");
        if (/Sorting · \d+ of \d+ days/.test(p)) { sawLine = p; sawTrack = (await count(c.page, sel("import-track"))) === 1; }
        return !!sawLine;
      }, 8000, 40);
      await sorted(c.page);
      await c.shot("d1-review");
      check("(d1) the progress line and the track are real while it sorts", !!sawLine && sawTrack && t0 === 0, String(sawLine));
      const rows = await rowsOf(c.page);
      check("(d2) rows arrive newest first", rows.length > 20 && rows[0].day === "2025-11-17" && rows.every((r, i) => i === 0 || rows[i - 1].day > r.day), rows.slice(0, 3).map((r) => r.day).join(","));
      const unsure = rows.find((r) => r.day === "2025-04-02");
      check("(d3) a day the words do not settle reads Not sure, unticked", unsure && unsure.state === "unsure" && !unsure.on && /Not sure/.test(unsure.text), JSON.stringify(unsure));
      const prac = rows.find((r) => r.day === "2025-03-20");
      check("(d4) the player's clip and the coach's feedback: a practice day", prac && prac.state === "practice" && prac.on, JSON.stringify(prac));
      const rev = rows.find((r) => r.day === "2025-06-05");
      check("(d5) a refusal reads Check this day, and its tick sleeps until the day is opened", rev && rev.state === "review" && !rev.on && !rev.tick && /Check this day/.test(rev.text), JSON.stringify(rev));
      const ellie = rows.find((r) => r.day === "2025-05-01");
      check("(d6) a day naming another child reads Names Ellie, unticked", ellie && !ellie.on && /Names Ellie/.test(ellie.text), JSON.stringify(ellie));
      await c.page.locator(sel("import-leftout")).click(); await c.page.waitForTimeout(700);
      const lo = await c.text();
      check("(d7) the recap is in Left out as Recap · added to the lesson before", /Recap · added to Thu 13 Mar/.test(lo) && (await count(c.page, `[data-day="2025-03-14"]`)) === 1, lo.slice(0, 300));
      await c.shot("d7-leftout");
      /* (e) a day: the held-back line, and Make a lesson */
      await c.page.locator('[data-day="2025-04-11"]').click(); await c.page.waitForTimeout(700);
      const held = await c.page.$$eval(`${sel("import-day-line")}[data-held="1"]`, (els) => els.map((e) => e.innerText));
      const heldNote = await c.page.locator(`${sel("import-day-note")} textarea`).inputValue().catch(() => "");
      check("(e1) the health line is Held back in the day's Messages, and absent from the note", held.length === 1 && /sore yesterday/.test(held[0]) && /Held back/.test(held[0]) && !/sore/.test(heldNote), `${held} · ${heldNote}`);
      await backBtn(c.page);
      await c.page.locator('[data-day="2025-03-08"]').click(); await c.page.waitForTimeout(700);
      await c.page.locator(sel("import-make")).click(); await c.page.waitForTimeout(800);
      const made = await rowOf(c.page, "2025-03-08");
      check("(e2) a Left-out day's Make a lesson adds it, ticked", made && made.on, JSON.stringify(made));
      /* the recap's lines are in the lesson before's note */
      await openDay(c.page, "2025-03-13");
      const n13 = await c.page.locator(`${sel("import-day-note")} textarea`).inputValue();
      check("(d8) …and its lines are in the previous day's note", /Good lesson today\. Chipping was much better, landing spot is the key\./.test(n13) && /keep the hands ahead on the chip shots\./.test(n13), n13);
      await backBtn(c.page);
      await openDay(c.page, "2025-04-10");
      const note = await c.page.locator(`${sel("import-day-note")} textarea`).inputValue();
      check("(e3) the note is the coach's own lines, byte for byte, \"pay attention to your grip\" kept", note === "Driver lesson today, full swing work. Pay attention to your grip pressure.\nSee https://example.com/drill for the drill.", JSON.stringify(note));
      await c.shot("e3-day");
      await c.page.locator(`${sel("import-day-in")} button`).click(); await c.page.waitForTimeout(500);
      await backBtn(c.page);
      check("(e4) In the import, off, unticks the row", !(await rowOf(c.page, "2025-04-10")).on);
      await c.page.locator(`${sel("import-row")}[data-day="2025-04-10"] ${sel("import-tick")}`).click(); await c.page.waitForTimeout(400);
      await openDay(c.page, "2025-06-14");
      const files = await c.page.$$eval(sel("import-day-file"), (els) => els.map((e) => ({ on: e.dataset.on === "1", text: e.innerText.replace(/\s+/g, " ") })));
      const shotRow = files.find((f) => /screenshot/i.test(f.text));
      check("(e5) the screenshot is unticked with its reason; the coach's clip and photo are ticked", files.length === 3 && shotRow && !shotRow.on && /Looks like a screenshot/.test(shotRow.text) && files.filter((f) => f.on).length === 2, JSON.stringify(files));
      await backBtn(c.page);
      /* the review day, opened, may be ticked */
      await openDay(c.page, "2025-06-05"); await backBtn(c.page);
      check("(d9) opened, the refused day's tick wakes", (await rowOf(c.page, "2025-06-05")).tick);
      /* per-day For moves a day to another player's batch */
      await openDay(c.page, "2025-03-27");
      await c.page.locator(sel("import-day-for")).click(); await c.page.waitForTimeout(500);
      await c.page.locator(`[data-person="${IDS.aoife}"]`).click(); await c.page.waitForTimeout(700);
      await backBtn(c.page);
      const moved = await rowOf(c.page, "2025-03-27");
      check("(e6) a day filed under another player says so as its second fact", moved && /Aoife Green/.test(moved.text), JSON.stringify(moved));
      /* Back, and a return, keep it */
      const before = (await rowsOf(c.page)).length;
      await backBtn(c.page); await M.tap(c.page, sel("settings-import"), 1200);
      check("(d10) Back and a return find the review where it was", (await count(c.page, sel("import-review"))) === 1 && (await rowsOf(c.page)).length === before, String(before));
      /* (f) the show: a row's poster made on the phone; the Feed plays the drafts' files from the zip; nothing goes to storage */
      const r614 = c.page.locator(`${sel("import-row")}[data-day="2025-06-14"]`);
      await r614.scrollIntoViewIfNeeded(); 
      const poster = await until(async () => (await c.page.locator(`${sel("import-row")}[data-day="2025-06-14"] [data-poster="1"]`).count()) === 1, 8000);
      const psrc = await c.page.locator(`${sel("import-row")}[data-day="2025-06-14"] img`).getAttribute("src").catch(() => "");
      check("(f1) a row's poster is its first picture, drawn on the phone", poster && /^data:image\/jpeg/.test(psrc || ""), String(psrc).slice(0, 40));
      const drafts = (await rowsOf(c.page)).filter((x) => x.on);
      const at = drafts.findIndex((x) => /file/.test(x.text));
      await c.page.locator(`${sel("import-view")} button`, { hasText: "Feed" }).click(); await c.page.waitForTimeout(900);
      const feedOn = (await count(c.page, sel("import-feed"))) === 1;
      await c.page.evaluate((i) => { const w = document.querySelector('[data-tour="import-feed"] .overflow-y-auto'); if (w) { w.style.scrollBehavior = "auto"; w.scrollTop = i * w.clientHeight; } }, at);
      const plays = await until(async () => (await c.page.locator(`[data-feed-card="${at}"] video[src^="blob:"], [data-feed-card="${at}"] img[src^="blob:"]`).count()) > 0, 10000);
      const alive = await c.page.$$eval('[data-tour="import-feed"] [src^="blob:"]', (els) => new Set(els.map((e) => e.getAttribute("src"))).size);
      check("(f2) the Feed plays the drafts' own files from the zip, three at most alive", feedOn && at >= 0 && plays && alive <= 3, `${feedOn} ${at} ${plays} ${alive}`);
      await c.shot("f2-feed");
      check("(f3) nothing is sent to storage before Import", db.uploads.length === 0 && db.uploadCalls === 0);
      await c.page.locator('[data-tour="import-feed"] [aria-label="Back"]').first().click(); await c.page.waitForTimeout(800);
      check("(f4) Back from the Feed is the List again", (await count(c.page, sel("import-review"))) === 1);
      /* (p) what was sent */
      const bodies = db.importPosts.map((b) => JSON.stringify(b));
      const bad = bodies.filter((b) => /087|123 4567|@|example\.com|https?:|D02|\.jpg|\.mp4|\.opus|\.png|PHOTO|VIDEO|\b(Cian|Murphy|Niamh|Byrne|Orla|Kelly|Saoirse|Ellie|Aoife|Green)\b/.test(b));
      check("(p2) no request carries a phone number, an email, a link, a file name, an Eircode, or a roster or family name", bodies.length > 20 && bad.length === 0, bad[0] ? bad[0].slice(0, 300) : String(bodies.length));
      check("(p3) every player-side line is a marker, and only the coach's lines carry words", db.importPosts.every((b) => b.segs.every((x) => x.a === "C" || ["[message]", "[video]", "[photo]", "[voice note]", "[file]", "[omitted]"].includes(x.text))));
      /* (s) nothing cut, here at 390 too */
      const cut390 = await cut(c.page);
      check("(s1) Review: nothing cut at 390", cut390.length === 0, cut390.slice(0, 4).join(" | "));
      const told = await c.page.locator(sel("import-told")).innerText();
      const aud = await c.page.locator(sel("import-audience")).innerText();
      check("(g0) the audience and who is told, by name", /Cian will see these lessons/.test(aud) && /Cian is told once/.test(told), `${aud} · ${told}`);

      /* ---------------------------------------------------------------- (g)(j) IMPORT */
      let bad1 = null, bad2 = null, lost = null;
      db.failUpload = (p) => { if (!String(p).startsWith("import/")) return null; if (!bad1) bad1 = p; else if (!bad2 && p !== bad1) bad2 = p; return p === bad1 || p === bad2 ? { status: 500, body: { statusCode: "500", error: "Internal", message: "boom" } } : null; };
      db.uploadLostResponse = (p) => { if (p === bad1 || p === bad2 || lost) return false; lost = p; return true; };
      const ticked = (await rowsOf(c.page)).filter((r) => r.on).length;
      await c.page.locator(sel("import-go")).click();
      await c.page.waitForTimeout(250);
      const leftAtOnce = (await count(c.page, sel("import-review"))) === 0;
      const feed = await until(async () => (await count(c.page, sel("log-view"))) > 0, 6000, 100);
      check("(g1) Import leaves the screen at once, for the player's file in Feed view", leftAtOnce && feed, `${leftAtOnce} ${feed}`);
      await c.shot("g1-landed");
      /* while it runs: nothing told, nothing half there, every path the batch's own, nothing the player can read */
      let invariant = true, toldEarly = false;
      const watch = setInterval(() => {
        const ids = new Set(db.imports.map((b) => b.id));
        db.lessons.filter((l) => l.import_id).forEach((l) => db.media.filter((m) => m.lesson_id === l.id).forEach((m) => { if (!db.files.media[m.storage_path]) invariant = false; }));
        /* a batch still filling, and somebody it is about already told */
        if (db.imports.some((b) => b.status === "adding" && db.notifications.some((n) => /imported/.test(n.title) && (n.user_id === b.player_id || n.user_id === b.coach_id)))) toldEarly = true;
        void ids;
      }, 50);
      await until(async () => !!bad2 && db.uploads.filter((u) => u.path === bad2 && u.refused).length >= 3, 30000);
      await c.page.waitForTimeout(1500);
      const p = await boot(db, "cian");
      const heldFromPlayer = (await count(p.page, sel("lessons-empty"))) > 0;
      check("(g2) while the batch fills, the player sees none of it", heldFromPlayer && db.lessons.some((l) => l.import_id), String(db.lessons.filter((l) => l.import_id).length));
      await p.close();
      check("(j1) a file that fails three times waits; its lesson waits; done waits", db.imports.every((b) => b.status === "adding") && db.uploads.filter((u) => u.path === bad1 && u.refused).length >= 3);
      await M.tap(c.page, '[aria-label="Today"]', 1000);
      const ban = await c.page.locator(sel("import-banner")).innerText().catch(() => "");
      check("(j2) Today's banner: the files that did not upload, with Retry · Leave out", /2 files didn't upload/.test(ban) && (await count(c.page, sel("import-retry"))) === 1 && (await count(c.page, sel("import-leave-out"))) === 1, ban);
      await c.shot("j2-banner");
      db.failUpload = (pp) => (pp === bad2 ? { status: 500, body: { statusCode: "500", error: "Internal", message: "boom" } } : null);
      await c.page.locator(sel("import-retry")).click();
      await until(async () => !!db.files.media[bad1] && db.uploads.filter((u) => u.path === bad2 && u.refused).length >= 6, 30000);
      await c.page.waitForTimeout(1200);
      check("(j3) Retry lands it", !!db.files.media[bad1] && db.media.some((m) => m.storage_path === bad1), bad1);
      await c.page.locator(sel("import-leave-out")).click();
      let toast = false;
      await until(async () => { if (/Imported/.test(await c.text())) toast = true; return importsOf(db, IDS.cian).some((b) => b.status === "done") && toast; }, 40000, 150);
      await c.page.waitForTimeout(1200);
      clearInterval(watch);
      const cianB = importsOf(db, IDS.cian).find((b) => b.status === "done");
      const aoifeB = importsOf(db, IDS.aoife).find((b) => b.status === "done");
      check("(j4) Leave out writes the lesson without it, and the import is done", !!cianB && !db.media.some((m) => m.storage_path === bad2) && db.lessons.filter((l) => l.import_id === cianB.id).length === ticked - 1, `${ticked} ${cianB && db.lessons.filter((l) => l.import_id === cianB.id).length}`);
      check("(j5) the answer lost on the way back is counted a success, never a failure", !!lost && db.media.some((m) => m.storage_path === lost) && db.uploads.filter((u) => u.path === lost && !u.refused).length === 1, lost);
      check("(g3) a day filed under another player is that player's own batch", !!aoifeB && db.lessons.some((l) => l.import_id === aoifeB.id && l.lesson_date === "2025-03-27" && l.player_id === IDS.aoife));
      check("(g4) no lesson ever sat in the database with a file not yet in storage", invariant);
      const paths = db.media.filter((m) => m.import_id).map((m) => m.storage_path);
      check("(g5) every path is import/<batch>/<uuid>.<ext>", paths.length > 3 && paths.every((x) => PATH_RE.test(x)), paths.find((x) => !PATH_RE.test(x)) || String(paths.length));
      const cn = noticesOf(db, IDS.cian), an = noticesOf(db, IDS.aoife);
      check("(g6) nobody was told before done, then exactly one notice per person, never the importer", !toldEarly && cn.length === 1 && an.length === 1 && noticesOf(db, IDS.coach).length === 0 && cn[0].title === `${cianB.lessons} lessons imported` && cn[0].body === "Mar 2025 – Nov 2025 · Niamh Byrne" && an[0].title === "1 lesson imported", JSON.stringify([...cn, ...an].map((n) => [n.title, n.body])));
      check("(g7) zero Lesson logged and zero New clip", !db.notifications.some((n) => /Lesson logged|New clip/.test(n.title)));
      check("(g8) the toast said Imported", toast);
      await M.tap(c.page, '[aria-label="Roster"]', 800); await c.page.locator("button", { hasText: "Cian Murphy" }).first().click(); await c.page.waitForTimeout(1200);
      const listT = await c.text();
      check("(g9) the coach's file shows them, the newest first, the day with its year", /Mon 17 Nov 2025/.test(listT) && listT.indexOf("Mon 17 Nov 2025") < listT.indexOf("Wed 12 Nov 2025"), listT.slice(0, 300));
      check("(g10) the player file's Import row counts what is in", /Import/.test(await c.page.locator(sel("player-import")).innerText().catch(() => "")) && new RegExp(`${cianB.lessons} lessons`).test(await c.page.locator(sel("player-import")).innerText()));
      /* (q) the register of 14 June 2026 does not mark the lesson of 14 June 2025 */
      const l14 = db.lessons.find((l) => l.import_id === cianB.id && l.lesson_date === "2025-06-14");
      await c.page.locator(sel("player-all-lessons")).click(); await c.page.waitForTimeout(1000);
      await c.page.locator('button:has-text("Sat 14 Jun 2025")').first().click(); await c.page.waitForTimeout(1300);
      const p14 = await c.text();
      check("(q) a register of this year's 14 June marks no imported lesson of 14 June 2025", !!l14 && /Sat 14 Jun 2025/.test(p14) && !/Absent/.test(p14), p14.slice(0, 200));
      await c.close();
    }

    /* ================================================================ (l) THE SAME CHAT AGAIN */
    if (want("coach")) {
      const db = coachDb; db.failUpload = null; db.uploadLostResponse = null; db.importPlan = null;
      const before = db.lessons.filter((l) => l.import_id).length;
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await coachToReview(c.page);
      const rows = await rowsOf(c.page);
      const done = rows.filter((r) => r.state === "already");
      check("(l1) the same zip again: every day it wrote reads Imported already, and cannot be ticked", done.length >= before - 2 && done.every((r) => !r.on && !r.tick && /Imported already/.test(r.text)), `${done.length} of ${before}`);
      await c.page.locator('[aria-label="Back"]').first().dispatchEvent("click"); await c.page.waitForTimeout(500);
      await c.close();
      const c2 = await boot(db, "coach");
      await openImport(c2.page, true);
      await coachToReview(c2.page, chat("chat-more.zip"));
      const r13 = await rowOf(c2.page, "2025-03-13");
      check("(l2) a second chat with a new file on that day offers it: Imported already · 1 new file, ticked", r13 && r13.state === "append" && r13.on && /Imported already · 1 new file/.test(r13.text), JSON.stringify(r13));
      /* only that day goes */
      for (const r of await rowsOf(c2.page)) if (r.on && r.day !== "2025-03-13") await c2.page.locator(`${sel("import-row")}[data-day="${r.day}"] ${sel("import-tick")}`).click();
      const m13 = () => db.media.filter((m) => db.lessons.some((l) => l.id === m.lesson_id && l.lesson_date === "2025-03-13" && l.player_id === IDS.cian)).length;
      const was = m13(), lessonsWas = db.lessons.length;
      await c2.page.locator(sel("import-go")).click();
      await until(async () => db.imports.filter((b) => b.player_id === IDS.cian && b.status === "done").length >= 2, 30000);
      await c2.page.waitForTimeout(800);
      check("(l3) …and appends only that file: no new lesson", m13() === was + 1 && db.lessons.length === lessonsWas, `${was}→${m13()} · ${lessonsWas}→${db.lessons.length}`);
      const n = noticesOf(db, IDS.cian).pop();
      check("(l4) the player is told the files were added", n && n.title === "1 file imported", n && n.title);
      await c2.close();
    }

    /* ================================================================ (n) THE COACH REMOVES THEIR OWN IMPORT */
    if (want("coach")) {
      const db = coachDb;
      const p = await boot(db, "cian");
      const saved = await downloadOne(p.page);
      await p.close();
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      const batch = importsOf(db, IDS.cian).find((b) => b.status === "done" && b.lessons > 1);
      await c.page.locator(`[data-batch="${batch.id}"]`).click(); await c.page.waitForTimeout(700);
      const own = (await count(c.page, 'input[type="password"]')) === 0 && (await count(c.page, sel("import-remove-sheet"))) === 1 && new RegExp(`Remove ${batch.lessons} lessons`).test(await c.text());
      await c.page.locator(sel("import-remove-go")).click(); await c.page.waitForTimeout(1200);
      check("(n0) the importer removing their own import: the red key, no password", own && batch.status === "removed" && !db.lessons.some((l) => l.import_id === batch.id) && /Removed/.test(await c.text()));
      const told = db.notifications.filter((x) => /removed/.test(x.title));
      check("(n2) everyone told is told, the remover not", told.length === 1 && told[0].user_id === IDS.cian && told[0].title === `Niamh Byrne removed ${batch.lessons} imported lessons` && told[0].body === "Mar 2025 – Nov 2025", JSON.stringify(told.map((x) => [x.user_id.slice(-4), x.title, x.body])));
      const leftBefore = Object.keys(db.files.media).filter((k) => k.startsWith(`import/${batch.id}/`)).length;
      db.sweep();
      const leftAfter = Object.keys(db.files.media).filter((k) => k.startsWith(`import/${batch.id}/`)).length;
      check("(n3) the files are gone after the sweep", leftBefore > 0 && leftAfter === 0, `${leftBefore}→${leftAfter}`);
      await c.close();
      const p2 = await boot(db, "cian");
      await p2.page.waitForTimeout(1500);
      const keptAfter = await idbCount(p2.page);
      check("(n4) the player's downloaded copy leaves their phone on the next load", saved && keptAfter === 0, `${saved} → ${keptAfter}`);
      await p2.close();
    }

    /* ================================================================ (h) A PLAYER, WITH THE SWITCH ON */
    if (want("h")) {
      const db = freshDb({ allow: true });
      const p = await boot(db, "aoife");
      check("(h1) the empty Lessons hero carries Import", (await count(p.page, sel("lessons-import"))) === 1);
      await p.page.locator(sel("lessons-import")).click(); await p.page.waitForTimeout(1200);
      await choose(p.page, chat("chat-dave.txt"));
      check("(h2) a lone adult player has no For row", (await count(p.page, sel("import-for"))) === 0);
      await setRole(p.page, "Coach Dave", "coach"); await setRole(p.page, "Cian M", "player");
      await p.page.locator(sel("import-sort")).click(); await p.page.waitForTimeout(700);
      const ck = await p.text();
      check("(h3) a coach's label that matches nobody: Check the coach", /Check the coach/.test(ck) && /The chat is with “Coach Dave”/.test(ck) && /These lessons will be filed with Niamh Byrne/.test(ck) && /It's Niamh/.test(ck) && /Choose another file/.test(ck), ck.slice(-250));
      await p.page.locator(sel("import-check-back")).click(); await p.page.waitForTimeout(700);
      check("(h4) Choose another file goes back to Start, nothing sent", (await count(p.page, sel("import-choose"))) === 1 && db.importPosts.length === 0);
      await choose(p.page, chat("chat-plain.txt"));
      await setRole(p.page, "Cian M", "player");
      await p.page.locator(sel("import-sort")).click(); await p.page.waitForTimeout(600);
      await sorted(p.page);
      check("(h5) the audience is the coach", /Niamh Byrne will see these lessons/.test(await p.page.locator(sel("import-audience")).innerText()) && /Niamh is told once/.test(await p.page.locator(sel("import-told")).innerText()));
      await openDay(p.page, "2025-04-10");
      check("(h6) a player's note cannot be typed", (await count(p.page, `${sel("import-day-note")} textarea`)) === 0 && /Driver lesson today/.test(await p.page.locator(sel("import-day-note")).innerText()));
      await backBtn(p.page);
      await p.page.locator(sel("import-go")).click(); await p.page.waitForTimeout(900);
      await doneFor(db, IDS.aoife); await p.page.waitForTimeout(1500);
      const b = importsOf(db, IDS.aoife).find((x) => x.status === "done");
      check("(h7) the rows carry the coach, sent by the player, not unread, no rating ask", !!b && db.lessons.filter((l) => l.import_id === b.id).every((l) => l.coach_id === IDS.coach && l.sent_by === IDS.aoife && l.unread === false && !l.rating_requested));
      await p.page.locator(sel("log-view")).locator("button", { hasText: "List" }).first().click().catch(() => {});
      await p.page.waitForTimeout(900);
      const lt = await p.text();
      check("(h8) the lessons read Imported by Aoife on the row", /Imported by Aoife/.test(lt), lt.slice(0, 200));
      await p.page.locator(sel("log-view")).locator("button", { hasText: "Feed" }).first().click().catch(() => {});
      await p.page.waitForTimeout(900);
      check("(h9) …and on the feed's tag line", /Imported by Aoife/.test(await p.text()));
      await p.close();
      const c = await boot(db, "coach");
      const bell = db.notifications.filter((n) => n.user_id === IDS.coach);
      check("(h10) the coach's bell has one row, by the player's whole name", bell.length === 1 && bell[0].title === `Aoife Green imported ${b.lessons} lessons`, JSON.stringify(bell.map((n) => n.title)));
      check("(h11) none of it is To review", (await count(c.page, sel("today-review"))) === 0);
      await M.tap(c.page, '[aria-label="Roster"]', 800); await c.page.locator("button", { hasText: "Aoife Green" }).first().click(); await c.page.waitForTimeout(1200);
      await c.page.locator(sel("log-view")).locator("button", { hasText: "List" }).first().click().catch(() => {});
      await c.page.waitForTimeout(600);
      const ft = await c.text();
      check("(h12) the coach's file shows them, Imported by Aoife", /Imported by Aoife/.test(ft), ft.slice(0, 200));
      await c.page.locator("button", { hasText: "Mon 17 Nov 2025" }).first().click(); await c.page.waitForTimeout(1200);
      const pg = await c.text();
      check("(h13) the coach's page for one: Imported by Aoife Green, and no Waiting on, no Reply, no Sent by", /Imported by Aoife Green/.test(pg) && !/Waiting on/.test(pg) && (await count(c.page, sel("clip-reply"))) === 0 && !/Sent by/.test(pg), pg.slice(0, 300));
      await c.close();
      /* (n1) the coach removes the player's import: behind the password, the wrong one first */
      const c2 = await boot(db, "coach");
      await openImport(c2.page, true);
      await c2.page.locator(`[data-batch="${b.id}"]`).click(); await c2.page.waitForTimeout(700);
      const pw = c2.page.locator('input[type="password"]');
      const asked = (await pw.count()) === 1;
      await pw.fill("not-it"); await c2.page.locator("button", { hasText: `Remove ${b.lessons} lessons` }).click(); await c2.page.waitForTimeout(1000);
      const wrong = /That password isn't right/.test(await c2.text()) && b.status === "done";
      await pw.fill(PASS); await c2.page.locator("button", { hasText: `Remove ${b.lessons} lessons` }).click(); await c2.page.waitForTimeout(1300);
      check("(n1) the coach removes a player's import behind the password, the wrong one first", asked && wrong && b.status === "removed" && !db.lessons.some((l) => l.import_id === b.id) && /Removed/.test(await c2.text()));
      const told = db.notifications.filter((x) => /removed/.test(x.title));
      check("(n1b) the player is told, the coach not", told.length === 1 && told[0].user_id === IDS.aoife && told[0].title === `Niamh Byrne removed ${b.lessons} imported lessons`, JSON.stringify(told.map((x) => [x.user_id.slice(-4), x.title])));
      await c2.close();
    }

    /* ================================================================ (i) A PARENT, FOR A JUNIOR */
    if (want("i")) {
      const db = freshDb({ allow: true });
      const o = await boot(db, "orla");
      await M.tap(o.page, '[aria-label="Lessons"]', 900);
      await o.page.locator(sel("lessons-import")).click(); await o.page.waitForTimeout(1200);
      await choose(o.page, chat("chat-parent.zip"));
      const pre = { orla: await o.page.locator('[data-label="Orla Kelly"]').getAttribute("data-role"), coach: await o.page.locator('[data-label="Niamh Byrne"]').getAttribute("data-role") };
      check("(i1) the parent's own label and the coach's are pre-filled; two children, so For waits to be chosen", pre.orla === "player" && pre.coach === "coach" && (await count(o.page, sel("import-for"))) === 1 && (await o.page.locator(sel("import-sort")).isDisabled()), JSON.stringify(pre));
      await setRole(o.page, "Saoirse K", "player");
      await setFor(o.page, IDS.saoirse);
      check("(i2) For a junior, the first day's exact request is shown inline under the consent", (await count(o.page, sel("import-inline-preview"))) === 1 && /\[day\]/.test(await o.page.locator(sel("import-inline-preview")).innerText()));
      await o.page.locator(sel("import-sort")).click(); await o.page.waitForTimeout(600);
      await sorted(o.page);
      const aud = await o.page.locator(sel("import-audience")).innerText();
      check("(i3) the audience: the child, the other adult and the coach — never the importer", /Saoirse, Tom Kelly and Niamh Byrne will see these lessons/.test(aud), aud);
      check("(i4) who is told", /Niamh, Saoirse and Tom are told once/.test(await o.page.locator(sel("import-told")).innerText()), await o.page.locator(sel("import-told")).innerText());
      const first = (await rowsOf(o.page)).find((r) => r.on);
      await openDay(o.page, first.day);
      const nt = await o.page.locator(sel("import-day-note")).innerText();
      check("(i5) a junior's note starts empty, and says so", /Notes start empty for Saoirse · tap a line to add it/.test(nt) && (await count(o.page, `${sel("import-day-note")} textarea`)) === 0, nt);
      const line = o.page.locator(`${sel("import-day-line")}[data-held="0"]`).first();
      await line.click(); await o.page.waitForTimeout(400);
      check("(i6) a tap on the coach's line adds it to the note", (await o.page.locator(`${sel("import-day-note")} [data-note]`).count()) === 1);
      await backBtn(o.page);
      await o.page.locator(sel("import-go")).click(); await o.page.waitForTimeout(900);
      await doneFor(db, IDS.saoirse); await o.page.waitForTimeout(1200);
      check("(i7) every request held only the coach's words and markers", db.importPosts.length > 0 && db.importPosts.every((b) => b.segs.every((x) => x.a === "C" || /^\[(message|video|photo|voice note|file|omitted)\]$/.test(x.text))) && !db.importPosts.some((b) => /Orla|Saoirse|Kelly/.test(JSON.stringify(b))));
      const b = importsOf(db, IDS.saoirse).find((x) => x.status === "done");
      const nc = db.notifications.filter((n) => n.user_id === IDS.coach), nj = noticesOf(db, IDS.saoirse), nm = noticesOf(db, IDS.tom), no = noticesOf(db, IDS.orla);
      check("(i8) the coach one notice, the junior one, the other adult one, the importer none", nc.length === 1 && nc[0].title === `${b.lessons} ${b.lessons === 1 ? "lesson" : "lessons"} imported for Saoirse Kelly` && nj.length === 1 && nm.length === 1 && nm[0].title === "Saoirse's lessons imported" && no.length === 0,
        JSON.stringify([...nc, ...nj, ...nm, ...no].map((n) => [n.user_id.slice(-4), n.title])));
      await o.close();
      const j = await boot(db, "saoirse");
      const noCtl = (await count(j.page, sel("settings-import"))) === 0 && (await count(j.page, sel("lessons-import"))) === 0 && j.fn.length === 0;
      const refused = await j.page.evaluate(async ({ sb, pid }) => {
        const s = JSON.parse(localStorage.getItem("nosca.auth"));
        const r = await fetch(`${sb}/rest/v1/rpc/import_begin`, { method: "POST", headers: { apikey: "mock", authorization: `Bearer ${s.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ p_id: "99999999-9999-4999-8999-999999999999", p_player: pid, p_sport: "golf", p_source: "whatsapp" }) });
        return { status: r.status, body: await r.text() };
      }, { sb: M.SB, pid: IDS.saoirse });
      check("(i9) the junior's own account shows no control, and a hand-made call is refused", noCtl && refused.status >= 400 && /Not yours to import/.test(refused.body), JSON.stringify(refused));
      await j.close();
      /* (n) a parent who has left the family has no Remove: nothing to tap, and the database refuses her */
      db.profiles[IDS.orla].family_id = null;
      const o2 = await boot(db, "orla");
      const gone = await o2.page.evaluate(async ({ sb, id }) => {
        const s = JSON.parse(localStorage.getItem("nosca.auth"));
        const r = await fetch(`${sb}/rest/v1/rpc/undo_import`, { method: "POST", headers: { apikey: "mock", authorization: `Bearer ${s.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ p_id: id, p_lesson: null }) });
        return { status: r.status, body: await r.text() };
      }, { sb: M.SB, id: b.id });
      check("(n5) a parent who has left the family has no Remove: no control, and the database refuses her", (await count(o2.page, sel("settings-import"))) === 0 && gone.status >= 400 && /Not yours to remove/.test(gone.body) && b.status === "done", JSON.stringify(gone));
      await o2.close();
      /* (n6) back in the family, her own import is hers to remove: no password */
      db.profiles[IDS.orla].family_id = FAM;
      const o3 = await boot(db, "orla");
      await openImport(o3.page, false, "Family");
      await o3.page.locator(`[data-batch="${b.id}"]`).click(); await o3.page.waitForTimeout(700);
      const own = (await count(o3.page, 'input[type="password"]')) === 0 && (await count(o3.page, sel("import-remove-sheet"))) === 1;
      await o3.page.locator(sel("import-remove-go")).click(); await o3.page.waitForTimeout(1300);
      check("(n6) an importer removing their own import: no password, and the others are told", own && b.status === "removed" && !db.lessons.some((l) => l.import_id === b.id)
        && db.notifications.filter((x) => /removed/.test(x.title)).map((x) => x.user_id).sort().join() === [IDS.coach, IDS.saoirse, IDS.tom].sort().join(), JSON.stringify(db.notifications.filter((x) => /removed/.test(x.title)).map((x) => x.user_id.slice(-4))));
      await o3.close();
    }

    /* ================================================================ (n) ONE LESSON FROM ITS PAGE, AND (u) A FILE TAKEN OFF */
    if (want("n7")) {
      const db = freshDb({ allow: true });
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await coachToReview(c.page, chat("chat-year-first.zip"));
      await c.page.locator(sel("import-go")).click(); await doneFor(db, IDS.cian); await c.page.waitForTimeout(1200);
      const b = importsOf(db, IDS.cian).find((x) => x.status === "done");
      await M.tap(c.page, '[aria-label="Roster"]', 800); await c.page.locator("button", { hasText: "Cian Murphy" }).first().click(); await c.page.waitForTimeout(900);
      await c.page.locator(sel("log-view")).locator("button", { hasText: "List" }).first().click().catch(() => {});
      await c.page.waitForTimeout(500);
      await c.page.locator('button:has-text("Thu 10 Apr 2025")').first().click(); await c.page.waitForTimeout(1200);
      const line = await c.page.locator(sel("lesson-imported")).innerText().catch(() => "");
      await c.page.locator(sel("lesson-import-remove")).click(); await c.page.waitForTimeout(700);
      const sheetTxt = await c.text();
      await c.page.locator(sel("import-remove-go")).click(); await c.page.waitForTimeout(1200);
      check("(n7) one lesson from its page: the coach's own import reads Imported, removes with no password, the count goes down and nobody is told", /^Imported\b/.test(line.trim()) && /Remove 1 lesson/.test(sheetTxt) && b.lessons === db.lessons.filter((l) => l.import_id === b.id).length && b.status === "done" && !db.notifications.some((n) => /removed/.test(n.title)), `${line} · ${b.lessons}`);
      /* (u) an imported file taken off its lesson: no error, and the sweep removes the file */
      await c.page.locator("button", { hasText: "Thu 27 Mar 2025" }).first().click().catch(() => {});
      await c.page.waitForTimeout(400);
      await c.close();
      const c2 = await boot(db, "coach");
      const lesson = db.lessons.find((l) => l.import_id === b.id && db.media.some((m) => m.lesson_id === l.id && m.kind === "video"));
      const media = db.media.find((m) => m.lesson_id === lesson.id && m.kind === "video");
      await M.tap(c2.page, '[aria-label="Roster"]', 800); await c2.page.locator("button", { hasText: "Cian Murphy" }).first().click(); await c2.page.waitForTimeout(900);
      await c2.page.locator(sel("log-view")).locator("button", { hasText: "List" }).first().click().catch(() => {});
      await c2.page.waitForTimeout(500);
      const dayLabel = (() => { const [y, m, d] = lesson.lesson_date.split("-").map(Number); const dt = new Date(y, m - 1, d); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`; })();
      await c2.page.locator(`button:has-text("${dayLabel}")`).first().click(); await c2.page.waitForTimeout(1500);
      await c2.page.locator('[aria-label="More"]').first().click(); await c2.page.waitForTimeout(400);
      await c2.page.locator("button", { hasText: "Remove this clip" }).first().click(); await c2.page.waitForTimeout(300);
      await c2.page.locator("button", { hasText: "Remove it? Tap again" }).first().click(); await c2.page.waitForTimeout(1500);
      const pt = await c2.text();
      const gone = !db.media.some((m) => m.id === media.id);
      const fileThere = !!db.files.media[media.storage_path];
      db.sweep();
      check("(u) an imported clip taken off its lesson: the row goes, no error is shown, and the sweep removes the file", gone && fileThere && !db.files.media[media.storage_path] && /Removed/.test(pt) && !/Couldn't|refused/.test(pt), `${gone} ${fileThere} · ${pt.slice(-120)}`);
      await c2.close();
    }

    /* ================================================================ (k) A RELOAD MID-UPLOAD, A LOST FILE */
    if (want("k")) {
      const db = freshDb({ allow: true });
      let stuck = null;
      db.failUpload = (p) => { if (!String(p).startsWith("import/")) return null; if (!stuck) stuck = p; return p === stuck ? { status: 500, body: { statusCode: "500", error: "Internal", message: "boom" } } : null; };
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await coachToReview(c.page, chat("chat-year-first.zip"));
      const posts = db.importPosts.length;
      await c.page.locator(sel("import-go")).click();
      await until(async () => !!stuck && db.uploads.filter((u) => u.path === stuck && u.refused).length >= 3, 20000);
      await c.page.waitForTimeout(1500);
      await c.page.reload({ waitUntil: "networkidle" }); await M.settle(c.page);
      await c.page.waitForTimeout(1200);
      const ban = await c.page.locator(sel("import-banner")).innerText().catch(() => "");
      check("(k1) after a reload the banner says the import is paused", /Import paused · choose the file again/.test(ban), ban);
      await openImport(c.page, true);
      check("(k2) Import shows the resume box", (await count(c.page, sel("import-resume"))) === 1 && /Choose the same file/.test(await c.text()));
      await c.shot("k2-resume");
      await c.page.setInputFiles(sel("import-file"), chat("chat-android.zip")); await c.page.waitForTimeout(1500);
      check("(k3) a different file: That's a different chat, with Start again", /That's a different chat/.test(await c.text()) && (await count(c.page, sel("import-restart"))) === 1);
      db.failUpload = null;
      await c.page.setInputFiles(sel("import-file"), chat("chat-year-first.zip"));
      await doneFor(db, IDS.cian); await c.page.waitForTimeout(1000);
      const ok = db.uploads.filter((u) => !u.refused && String(u.path).startsWith("import/"));
      const twice = ok.filter((u, i) => ok.findIndex((x) => x.path === u.path) !== i);
      check("(k4) the same file resumes: no file uploaded twice, no part sent twice", importsOf(db, IDS.cian).some((b) => b.status === "done") && twice.length === 0 && db.importPosts.length === posts && !!db.files.media[stuck], `${twice.length} dup · posts ${posts}→${db.importPosts.length}`);
      await c.close();
    }
    if (want("k")) {
      const db = freshDb({ allow: true });
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await coachToReview(c.page, chat("chat-year-first.zip"));
      await c.page.evaluate(() => { window.__noscaZipReadFail = 1; });
      await c.page.locator(sel("import-go")).click(); await c.page.waitForTimeout(2500);
      await M.tap(c.page, '[aria-label="Today"]', 900);
      const ban = await c.page.locator(sel("import-banner")).innerText().catch(() => "");
      check("(k5) a file the phone can no longer read: the same paused state, and no Retry to loop on", /Import paused · choose the file again/.test(ban) && (await count(c.page, sel("import-retry"))) === 0, ban);
      await c.close();
    }

    /* ================================================================ (m) STOP */
    if (want("m")) for (const how of ["nothing", "keep", "remove"]) {
      const db = freshDb({ allow: true });
      let okPath = null;
      db.failUpload = (p) => { if (!String(p).startsWith("import/")) return null; if (how !== "nothing" && !okPath) { okPath = p; return null; } return p === okPath ? null : { status: 500, body: { statusCode: "500", error: "Internal", message: "boom" } }; };
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await coachToReview(c.page, chat("chat-year-first.zip"));
      /* only the days with files, so nothing is in until a file is */
      const rows = await rowsOf(c.page);
      for (const r of rows) if (r.on && !/file/.test(r.text)) await c.page.locator(`${sel("import-row")}[data-day="${r.day}"] ${sel("import-tick")}`).click();
      await c.page.locator(sel("import-go")).click(); await c.page.waitForTimeout(800);
      await until(async () => db.uploads.filter((u) => u.refused).length >= 3, 20000);
      if (how !== "nothing") await until(async () => db.lessons.some((l) => l.import_id), 30000);
      await c.page.waitForTimeout(1500);
      await openImport(c.page, true);
      await c.page.locator(sel("import-stop")).click(); await c.page.waitForTimeout(700);
      const st = await c.text();
      const b = importsOf(db, IDS.cian)[0];
      if (how === "nothing") {
        check("(m1) Stop with nothing in: Nothing has been added, and Stop", /Stop import/.test(st) && /Nothing has been added/.test(st) && (await count(c.page, sel("import-stop-go"))) === 1, st.slice(-200));
        await c.page.locator(sel("import-stop-go")).click(); await c.page.waitForTimeout(1200);
        db.sweep();
        check("(m2) …the batch is removed, nobody is told, and after the sweep the folder is empty", b.status === "removed" || !db.imports.includes(b), b.status);
        check("(m3) …nothing told, nothing left", db.notifications.length === 0 && !Object.keys(db.files.media).some((k) => k.startsWith(`import/${b.id}/`)));
      } else if (how === "keep") {
        const n = db.lessons.filter((l) => l.import_id === b.id).length;
        check("(m4) Stop with some in: N of M lessons are in, Keep N", new RegExp(`${n} of \\d+ lessons? (is|are) in`).test(st) && (await count(c.page, sel("import-keep"))) === 1, st.slice(-200));
        await c.page.locator(sel("import-keep")).click(); await c.page.waitForTimeout(1500);
        check("(m5) Keep finishes with what is in, and one notice", b.status === "done" && b.lessons === n && noticesOf(db, IDS.cian).length === 1 && /Stopped/.test(await c.text()), `${b.status} ${b.lessons}/${n}`);
      } else {
        await c.page.locator(sel("import-remove-all")).click(); await c.page.waitForTimeout(1500);
        db.sweep();
        check("(m6) Remove all tells nobody, and the sweep empties the folder", (b.status === "removed" || !db.imports.includes(b)) && db.notifications.length === 0 && !Object.keys(db.files.media).some((k) => k.startsWith(`import/${b.id}/`)), b.status);
      }
      await c.close();
    }

    /* ================================================================ (o) THE RUNNER'S ANSWERS */
    if (want("o")) {
      const db = freshDb({ allow: true });
      const DRIVER = (b) => b.segs.some((x) => x.part === "day" && /Driver lesson today/.test(x.text));
      const whole = new Set(); let busied = null;
      db.importFail = (i, body) => {
        if (DRIVER(body)) { if (body.segs.filter((x) => x.part === "day" && x.a === "C" && x.id).length === 3) { whole.add(i); return "timeout"; } return null; }
        if (!busied) { busied = JSON.stringify(body); return "busy"; }
        return null;
      };
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await coachToReview(c.page, chat("chat-year-first.zip"));
      const again = db.importPosts.filter((b) => JSON.stringify(b) === busied).length;
      check("(o1) busy, then ok: retried", again === 2, String(again));
      const driverPosts = db.importPosts.filter(DRIVER);
      check("(o2) a timeout twice, then the halves: at most four requests for that part", whole.size === 2 && driverPosts.length <= 4 && driverPosts.length >= 3, `${whole.size} whole · ${driverPosts.length} in all`);
      await c.close();
      for (const [kind, words] of [["over", "Today's limit is reached"], ["paused", "Sorting is paused"]]) {
        const d2 = freshDb({ allow: true }); d2.importFail = () => kind;
        const c2 = await boot(d2, "coach");
        await openImport(c2.page, true);
        await coachToReview(c2.page, chat("chat-year-first.zip"));
        const line = await c2.page.locator(sel("import-progress")).innerText().catch(() => "");
        check(`(o3) ${kind} reads ${words}`, line.includes(words) && d2.importPosts.length <= 3, `${line} · ${d2.importPosts.length}`);
        await c2.close();
      }
      const d3 = freshDb({ allow: true }); d3.importFail = (i, body) => (DRIVER(body) ? "review" : null);
      const c3 = await boot(d3, "coach");
      await openImport(c3.page, true);
      await coachToReview(c3.page, chat("chat-year-first.zip"));
      const r = await rowOf(c3.page, "2025-04-10");
      check("(o4) review reads Check this day, and is never sent again", r && /Check this day/.test(r.text) && d3.importPosts.filter(DRIVER).length === 1, JSON.stringify(r));
      await c3.close();
    }

    /* ================================================================ (w) THE FOUNDER'S WORDS */
    /* (launch, 28 November) "Pull out all the dates … what was said on those dates … use AI to create the lesson. So
       create the title, tick all the boxes … upload all the content, the videos and media from that date, and then …
       cut down the text and write down exactly what is useful … any other messages that are not to do with lessons,
       just skip all of them … add all the lessons into the past library" — each read off the screens and the rows */
    if (want("w")) {
      const db = freshDb({ allow: true });
      const c = await boot(db, "coach");
      await openImport(c.page, true);
      await coachToReview(c.page);
      const rows = await rowsOf(c.page);
      const leftN = Number(((await c.page.locator(sel("import-leftout")).innerText().catch(() => "")).match(/(\d+) days?/) || [])[1] || 0);
      const dates = new Set(FX.DAYS.map(([iso]) => iso));
      check("(w1) every date pulled out: each day of the chat is a row on its own date, or Left out", rows.length + leftN === dates.size && rows.every((r) => dates.has(r.day)), `${rows.length} + ${leftN} of ${dates.size}`);
      /* the title is the areas the coach's words name, and those are the tiles ticked on the day */
      await openDay(c.page, "2025-06-14");
      const ids = ((await c.page.locator("[data-focus-ids]").getAttribute("data-focus-ids")) || "").split(",").filter(Boolean);
      const labels = ids.map((id) => (M.IMPORT_FOCUS.golf.find((a) => a.id === id) || {}).label);
      const tiles = await c.page.$$eval(`${sel("import-day-focus")} button[aria-label]`, (els) => els.map((e) => [e.getAttribute("aria-label"), getComputedStyle(e).backgroundColor]));
      const onBg = new Set(tiles.filter(([l]) => labels.includes(l)).map((x) => x[1])), offBg = new Set(tiles.filter(([l]) => !labels.includes(l)).map((x) => x[1]));
      const files14 = await c.page.$$eval(sel("import-day-file"), (els) => els.map((e) => ({ on: e.dataset.on === "1", text: e.innerText.replace(/\s+/g, " ") })));
      await c.shot("w2-day");
      await backBtn(c.page);
      const row14 = await rowOf(c.page, "2025-06-14");
      check("(w2) the title is the areas the coach's words name, and those tiles are the ones ticked", labels.length === 2 && labels.join(" · ") === "Full swing · Pitching" && row14.text.includes("Full swing · Pitching")
        && onBg.size === 1 && ![...onBg].some((b) => offBg.has(b)), `${labels.join(" · ")} · ${row14 && row14.text} · on ${[...onBg]} off ${[...offBg]}`);
      check("(w3) the day's videos and photos come with it — the coach's clip and still ticked, a screenshot of the phone left for a person", files14.filter((f) => f.on).length === 2 && files14.every((f) => f.on || /screenshot/i.test(f.text)), JSON.stringify(files14));
      await c.page.locator(sel("import-go")).click();
      await doneFor(db, IDS.cian);
      await c.page.waitForTimeout(1200);
      const mine = db.lessons.filter((l) => l.import_id && l.player_id === IDS.cian);
      const at = (iso) => mine.find((l) => l.lesson_date === iso);
      const mediaOf = (l) => (l ? db.media.filter((m) => m.lesson_id === l.id).map((m) => m.kind).sort().join(",") : "");
      check("(w3b) …and land on the lesson: the clip and the still on 14 June, the player's practice clip on 20 March, the coach's voice note on 17 April", mediaOf(at("2025-06-14")) === "photo,video" && mediaOf(at("2025-03-20")) === "video" && at("2025-03-20").kind === "practice" && mediaOf(at("2025-04-17")) === "audio",
        `${mediaOf(at("2025-06-14"))} · ${mediaOf(at("2025-03-20"))} ${at("2025-03-20") && at("2025-03-20").kind} · ${mediaOf(at("2025-04-17"))}`);
      /* the note is only the useful lines, each the coach's own words, never a word written for them */
      /* the coach's words are what they typed and the captions they put on their files */
      const coachSaid = FX.DAYS.flatMap(([, msgs]) => msgs.filter((m) => m[1] === "C").flatMap((m) => [m[2].replace(/^<This message was edited> /, ""), (m[3] && m[3].caption) || null].filter(Boolean)));
      const pieces = mine.flatMap((l) => String(l.notes || "").split("\n").filter(Boolean)).flatMap((ln) => (/^Drills · /.test(ln) ? ln.slice(9).split(" · ") : [ln.replace(/^Tip · /, "")]));
      const invented = pieces.filter((x) => !coachSaid.some((s) => s.includes(x)));
      check("(w4) every note is the coach's own words, cut down to the coaching — 5 June's booking line gone, 27 March's tip lifted to its end", (at("2025-06-05") || {}).notes === "Mental game today, the pre-shot routine."
        && (at("2025-03-27") || {}).notes === "Bunker play today. Open the face and splash the sand.\nThe splash\nTip · commit to the shot." && pieces.length > 10 && invented.length === 0,
        `${JSON.stringify((at("2025-06-05") || {}).notes)} · ${JSON.stringify((at("2025-03-27") || {}).notes)} · ${invented.slice(0, 3).join(" | ")}`);
      const chatty = /What time|See you Thursday|Paid for April|€40|Running late|Thanks Niamh|Brilliant|Will do|Cheers/;
      check("(w5) what is not about lessons is skipped: no lesson on the days that only arranged times or paid, no such line in any note", !at("2025-03-08") && !at("2025-04-24") && !mine.some((l) => chatty.test(l.notes || "")), mine.filter((l) => chatty.test(l.notes || "")).map((l) => l.lesson_date).join(","));
      check("(w6) every lesson is filed on its own day", mine.length > 20 && mine.every((l) => dates.has(l.lesson_date)), String(mine.length));
      /* the past library: the coach's All lessons, the player's List and Progress */
      await M.tap(c.page, '[aria-label="Roster"]', 800); await c.page.locator("button", { hasText: "Cian Murphy" }).first().click(); await c.page.waitForTimeout(1200);
      await c.page.locator(sel("player-all-lessons")).click(); await c.page.waitForTimeout(1200);
      const arch = await c.text();
      check("(w7) the coach's All lessons holds them on their days, the newest first", /Sat 14 Jun 2025/.test(arch) && /Thu 27 Mar 2025/.test(arch) && arch.indexOf("Mon 17 Nov 2025") < arch.indexOf("Sat 14 Jun 2025") && arch.indexOf("Sat 14 Jun 2025") < arch.indexOf("Thu 27 Mar 2025"), arch.slice(0, 240));
      await c.close();
      const p = await boot(db, "cian");
      await p.page.locator(sel("log-view")).locator("button", { hasText: "List" }).first().click().catch(() => {}); await p.page.waitForTimeout(900);
      const list = await p.text();
      check("(w8) the player's own lessons hold them on their days", /Sat 14 Jun 2025/.test(list) && /Bunker play/.test(list), list.slice(0, 240));
      await M.tap(p.page, sel("profile-pill"), 900); await M.tap(p.page, sel("sheet-progress"), 1200);
      const n = mine.filter((l) => l.kind !== "practice").length;
      const prog = await p.page.locator('[data-progress="imported"]').innerText().catch(() => "");
      const areas = await p.page.locator('[data-progress="areas"]').innerText().catch(() => "");
      await p.shot("w9-progress");
      check("(w9) Progress counts them, says how many came in, and reads what they worked on", prog.trim() === `Includes ${n} imported` && /Bunker play/.test(areas) && /Putting/.test(areas), `${prog} · ${areas.slice(0, 120)}`);
      await p.close();
    }

    /* ================================================================ (s) NOTHING CUT AT 320 AND 375 */
    if (want("s")) for (const width of [320, 375]) {
      const db = freshDb({ allow: true });
      const c = await boot(db, "coach", { width, height: 740 });
      await openImport(c.page, true);
      const start = await cut(c.page);
      await choose(c.page, chat("chat-merge.zip"));
      const found = await cut(c.page);
      await c.page.locator('[data-label="Cian Murphy (new)"]').click(); await c.page.waitForTimeout(500);
      const roleSheet = await cut(c.page);
      const same = (await count(c.page, '[data-import-role="same:Cian M"]')) === 1;
      await c.page.locator('[data-import-role="same:Cian M"]').click(); await c.page.waitForTimeout(500);
      await setRole(c.page, "Cian M", "player");
      const merged = await c.page.locator('[data-label="Cian Murphy (new)"]').getAttribute("data-role");
      await setFor(c.page, IDS.aoife);
      await c.page.locator(sel("import-sort")).click(); await c.page.waitForTimeout(700);
      const checkSheet = await cut(c.page);
      await c.page.locator(sel("import-check-go")).click(); await c.page.waitForTimeout(600);
      await sorted(c.page);
      const review = await cut(c.page);
      await openDay(c.page, "2025-06-14");
      const day = await cut(c.page);
      await c.shot(`s-${width}-day`);
      const all = [...start, ...found, ...roleSheet, ...checkSheet, ...review, ...day];
      check(`(s${width}) at ${width}: Start, Found, the sheets, the check, Review and A day — nothing cut`, all.length === 0, all.slice(0, 5).join(" | "));
      const small = await floor(c.page);
      check(`(s${width}b) …and nothing on A day under the 12px floor`, small.length === 0, small.slice(0, 5).join(" | "));
      if (width === 320) check("(c7) a label merged by hand: Same person as", same && merged === "same:Cian M", merged);
      await c.close();
    }

    /* ================================================================ (t) NO RELOAD UNDER A JOB; SYNC SAYS SO */
    if (want("t")) {
      const db = freshDb({ allow: true });
      db.failUpload = (p) => (String(p).startsWith("import/") ? { status: 500, body: { statusCode: "500", error: "Internal", message: "boom" } } : null);
      const c = await boot(db, "coach");
      let mode = "same";
      await c.page.route("**/version.json*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ built: mode === "newer" ? "2999-01-01T00:00:00.000Z" : "2000-01-01T00:00:00.000Z" }) }));
      await openImport(c.page, true);
      await coachToReview(c.page, chat("chat-year-first.zip"));
      await c.page.locator(sel("import-go")).click(); await c.page.waitForTimeout(1500);
      mode = "newer";
      const navs = []; c.page.on("framenavigated", (f) => { if (f === c.page.mainFrame()) navs.push(f.url()); });
      await c.page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
      await c.page.waitForTimeout(2500);
      check("(t1) a newer build does not reload the app while an import runs", navs.length === 0, navs.join(","));
      /* Import left the screen for the player's file; Settings is the home's pill */
      await M.tap(c.page, '[aria-label="Today"]', 800);
      await openSettings(c.page, true);
      await c.page.locator(sel("settings-sync")).click().catch(() => {}); await c.page.waitForTimeout(700);
      check("(t2) Sync says Importing · wait or stop it first", /Importing · wait or stop it first/.test(await c.text()) && navs.length === 0);
      await c.close();
    }

    check("(z) no page error and no console error or warning in any scene", errors.length === 0, errors.slice(0, 5).join(" | "));
  } catch (e) {
    console.error(e);
    check("the suite ran to its end", false, String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" ") : e));
  } finally {
    await browser.close().catch(() => {});
    try { await M.stopServer(server); } catch (e) { /* gone */ }
    const s = summary();
    fs.writeFileSync(path.join(outDir, "import.json"), JSON.stringify(s, null, 2));
    process.exit(s.passed === s.total ? 0 : 1);
  }
})();
