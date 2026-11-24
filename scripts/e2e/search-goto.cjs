/* THE SEARCH FINDS WHERE TO GO (24 November). The header's search finds
   the app's features as well as what was written: a Go to group above
   the lessons, tips, drills, players and messages, from one registry
   (goToRows) — every Settings row this person's Settings draws, every
   action on the coach's plus by its one name, and the places the home,
   the Diary and the switcher open — each only for someone who can open
   it. As the coach: away, holiday, hours, recurring, install,
   walkthrough, default view, call off, new group, competition,
   drifting, progress, saved and downloads each find their row and the
   tap opens that screen or sheet (a pick unfolding in place and a
   toggle flipping in place, as on Settings); the best match first;
   accents and word prefixes found; an empty field and a cleared one
   showing no Go to group; Back from where a row went landing on the
   search with its words; on a Home Screen no Add to Home Screen, as
   Settings offers none. As a player nothing of the coach's (away,
   hours, drifting) and their own Progress, Log a practice, Send a clip
   (the thread's camera) and Your coach by name and by "review"; a
   parent each child's Progress and Send a clip by name and no practice;
   a junior nothing a junior cannot do. Every row a row of words — the
   label on its inset, the value in the sub grey, the chevron, no glyph
   — and nothing cut at 320.
   Usage: node search-goto.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4390), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07",
              junior: "00000000-0000-4000-8000-00000000c41d", aoife: "00000000-0000-4000-8000-0000000a01fe" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  /* a name with its accents, for the search to find without them */
  person("aoife", "aoife@t.ie", { role: "player", name: "Aoife Ní Bhriain", type: "adult", coachId: IDS.coach, dob: "1990-02-02" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: "2026-09-01", focus: "Short game", notes: "Cleaner contact from the fringe.", subs: ["HI 18.4"] });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.junior, date: "2026-08-28", focus: "Putting", notes: "Left hand a touch stronger." });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "4:00 pm"], [0, 1, 2, 3, 4]) });
  return db;
}

const { check, results, summary } = M.checker("search-goto");
/* what only a coach may be offered, and what only an adult with a child */
const COACH_ONLY = /^(quick-|unlogged$|clips$|requests$|atrisk$|recurring$|archive$|settings-(availability|away|invite|library|tips|shortcuts|setup|reviews|register|review-prompt|lessons-as-a-player|lessons-you-ve-taken)$)/;
const PARENT_ONLY = /^(progress:|settings-digest$)/;

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const boot = async (role, width = 390, init = null) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(`${role}: ${String(e.message || e)}`));
    if (init) await page.addInitScript(init);
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const field = (page) => page.locator('input[placeholder="Search"]');
  const openSearch = async (page) => { await tap(page, '[aria-label="Search"]', 900); };
  const type = async (page, q) => { await field(page).fill(q); await page.waitForTimeout(450); };
  /* the Go to rows in the order drawn: each one's hook and its words */
  const rows = (page) => page.evaluate(() => [...document.querySelectorAll('[data-tour="search-goto"] [data-tour="search-goto-row"]')]
    .map((r) => ({ id: r.getAttribute("data-goto"), text: r.innerText.replace(/\s+/g, " ").trim() })));
  const ids = async (page) => (await rows(page)).map((r) => r.id);
  const hasGroup = async (page) => (await page.locator('[data-tour="search-goto"]').count()) > 0;
  /* a row's own control: the row itself, or the head of a row that unfolds */
  const tapRow = async (page, id, wait = 900) => {
    await page.evaluate((k) => { const r = document.querySelector(`[data-tour="search-goto-row"][data-goto="${k}"]`); const b = r && (r.matches("button") ? r : r.querySelector("button[data-row], button")); if (b) b.click(); }, id);
    await page.waitForTimeout(wait);
  };
  const title = (page) => page.evaluate(() => { const els = [...document.querySelectorAll('[data-tour="screen-title"]')].filter((e) => e.getBoundingClientRect().width > 0); const e = els[els.length - 1]; return e ? e.textContent.trim() : ""; });
  const sheetText = (page) => page.evaluate(() => { const s = document.querySelector("[data-sheet]"); return s ? s.innerText.replace(/\s+/g, " ").trim() : ""; });
  const closeSheet = async (page) => { await page.locator("[data-sheet-scrim]").first().click({ position: { x: 20, y: 20 } }).catch(() => {}); await page.waitForTimeout(700); };
  const onSearch = async (page, q) => (await field(page).count()) === 1 && (await field(page).inputValue()) === q;

  try {
    /* ================= the coach ================= */
    {
      const { ctx, page, text, shot } = await boot("coach");
      await openSearch(page);
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("placeholder") === "Search");
      check("(a) a fresh search is the field alone, focused: no Go to group", focused && !(await hasGroup(page)) && (await ids(page)).length === 0, `${focused} · ${JSON.stringify(await ids(page))}`);

      /* every word a coach might type finds its row, and the row goes there */
      const cases = [
        ["away", "settings-away", async () => (await title(page)) === "Away", "the Away screen"],
        ["holiday", "settings-away", async () => (await title(page)) === "Away", "Away, by a word that is not its name"],
        ["hours", "settings-availability", async () => (await title(page)) === "Hours", "Hours"],
        ["recurring", "recurring", async () => (await title(page)) === "Recurring lessons", "Recurring lessons"],
        ["install", "settings-install", async () => (await title(page)) === "Add to Home Screen", "Add to Home Screen"],
        ["competition", "quick-comp", async () => (await title(page)) === "Ahead", "the plus's Competition: Ahead"],
        ["drifting", "atrisk", async () => (await title(page)) === "Drifting", "Drifting"],
        ["saved", "saved", async () => (await title(page)) === "Saved", "Saved"],
        ["downloads", "settings-downloads", async () => (await title(page)) === "Saved" && /Nothing downloaded/.test(await text()), "Saved on its Downloads half"],
      ];
      for (const [q, id, there, what] of cases) {
        await type(page, q);
        const found = await ids(page);
        check(`(b) "${q}" finds ${id} first`, found[0] === id, JSON.stringify(found));
        await tapRow(page, id);
        const ok = await there();
        check(`(b) …and the tap opens ${what}`, ok, `${await title(page)} · ${(await text()).slice(0, 120)}`);
        if (q === "hours") await shot("02-coach-hours-from-search");
        await M.back(page, 900);
        check(`(b) …and Back lands on the search with "${q}" still in it and the row there`, (await onSearch(page, q)) && (await ids(page)).includes(id), `${await field(page).inputValue().catch(() => "?")} · ${JSON.stringify(await ids(page))}`);
      }
      /* come back to a search and the keyboard stays down over the results */
      const refocused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("placeholder") === "Search");
      check("(b2) a search come back to does not take the focus again", !refocused, String(refocused));

      /* the plus's actions, through the plus's own handler */
      await type(page, "call off");
      const coLead = await M.rowLead(page, '[data-goto="quick-weather"]');
      /* a red row is told by its red word, as the plus's one red tile is */
      check("(c) \"call off\" finds the plus's Call off and nothing else, its word in the brick", JSON.stringify(await ids(page)) === JSON.stringify(["quick-weather"]) && !!coLead && coLead.color === "rgb(154, 50, 42)", `${JSON.stringify(await rows(page))} · ${coLead && coLead.color}`);
      await tapRow(page, "quick-weather", 1100);
      const co = await sheetText(page);
      check("(c) …and the tap opens the call-off sheet on its Why", /^Call off/.test(co) && /Weather/.test(co), co.slice(0, 120));
      await shot("03-coach-call-off-from-search");
      await closeSheet(page);
      check("(c) …and closing it leaves the search as it was", (await onSearch(page, "call off")) && (await ids(page))[0] === "quick-weather");
      await type(page, "new group");
      const ng = await ids(page);
      await tapRow(page, "quick-group", 1100);
      const ngs = await sheetText(page);
      check("(c2) \"new group\" finds New group and opens its sheet", ng[0] === "quick-group" && /^New group/.test(ngs) && /Group name|Create group/.test(ngs), `${JSON.stringify(ng)} · ${ngs.slice(0, 100)}`);
      await closeSheet(page);

      /* a player's Progress, picked the way the plus's Tip and Drills pick */
      await type(page, "progress");
      const pg = await ids(page);
      await tapRow(page, "progress", 1000);
      const pk = await sheetText(page);
      check("(d) \"progress\" finds Progress, which asks for whose: the roster as rows", pg[0] === "progress" && /^Progress/.test(pk) && /Cian Murphy/.test(pk), `${JSON.stringify(pg)} · ${pk.slice(0, 120)}`);
      await page.locator("[data-sheet] button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(1200);
      const pt = await text();
      check("(d) …and the player picked opens on their Progress", (await title(page)) === "Cian Murphy" && /Short game/.test(pt), `${await title(page)} · ${pt.slice(0, 160)}`);
      await M.back(page, 900);
      check("(d) …and Back lands on the search with its words", await onSearch(page, "progress"));

      /* the walkthrough, from its row */
      await type(page, "walkthrough");
      const wt = await ids(page);
      await tapRow(page, "settings-tour", 1200);
      const skip = await page.getByText("Skip", { exact: true }).count();
      check("(e) \"walkthrough\" finds Walkthrough, and the tap starts it", wt[0] === "settings-tour" && skip > 0, `${JSON.stringify(wt)} · skip ${skip}`);
      if (skip) { await page.getByText("Skip", { exact: true }).first().click(); await page.waitForTimeout(800); }
      check("(e) …and leaving it is the search again", await onSearch(page, "walkthrough"));

      /* a pick unfolds in place and is chosen there, as on Settings */
      await type(page, "default view");
      const dv = await rows(page);
      await tapRow(page, "settings-view", 500);
      const opts = await page.locator('[data-goto="settings-view"] [data-row-option]').allInnerTexts();
      check("(f) \"default view\" finds Default view reading List, and a tap unfolds List · Feed in place", dv.length && dv[0].id === "settings-view" && /Default view List/.test(dv[0].text) && JSON.stringify(opts) === JSON.stringify(["List", "Feed"]), `${JSON.stringify(dv)} · ${JSON.stringify(opts)}`);
      await shot("04-coach-default-view-unfolded");
      await page.locator('[data-goto="settings-view"] button', { hasText: /^Feed$/ }).first().click(); await page.waitForTimeout(700);
      const after = (await rows(page))[0] || {};
      check("(f) …Feed is chosen there: the row reads Feed and the coach's preferences hold it", /Default view Feed/.test(after.text || "") && (db.prefs[IDS.coach] || {}).default_view === "feed", `${after.text} · ${JSON.stringify((db.prefs[IDS.coach] || {}).default_view)}`);
      await tapRow(page, "settings-view", 400);
      await page.locator('[data-goto="settings-view"] button', { hasText: /^List$/ }).first().click(); await page.waitForTimeout(600);

      /* a toggle flips in place */
      await type(page, "reduce motion");
      const rm = page.locator('[data-goto="settings-reduce-motion"] button[aria-pressed]');
      const was = (await rm.count()) ? await rm.first().getAttribute("aria-pressed") : null;
      if (was !== null) { await rm.first().click(); await page.waitForTimeout(400); }
      const now = (await rm.count()) ? await rm.first().getAttribute("aria-pressed") : null;
      check("(g) \"reduce motion\" finds the switch, and it flips there", was !== null && now !== was, `${was} → ${now}`);
      if (was !== null && now !== was) { await rm.first().click(); await page.waitForTimeout(300); }

      /* the best match first; the plus's Drills and the library told apart by the library's count */
      await type(page, "drills");
      const dr = await rows(page);
      check("(h) \"drills\": the plus's Drills, then the library with its count", dr.length >= 2 && dr[0].id === "quick-drills" && dr[0].text === "Drills" && dr[1].id === "settings-library" && /^Drills \d+ drills$/.test(dr[1].text), JSON.stringify(dr));

      /* accents and word prefixes */
      await type(page, "wálkthrough");
      check("(i) accents fold: \"wálkthrough\" finds Walkthrough", (await ids(page))[0] === "settings-tour", JSON.stringify(await ids(page)));
      await type(page, "ni bhri");
      const nb = await text();
      check("(i2) …and \"ni bhri\" finds Aoife Ní Bhriain among the players", /Players/.test(nb) && /Aoife Ní Bhriain/.test(nb), nb.slice(0, 200));
      await shot("05a-coach-players-ni-bhri");
      /* what was written sits under where to go, in the same box */
      await type(page, "short");
      const sg = await page.evaluate(() => [...document.querySelectorAll(".nsc-group")].map((g) => g.parentElement.previousElementSibling ? g.parentElement.previousElementSibling.textContent.trim() : ""));
      check("(i3) \"short\" finds the Short game lesson under Lessons, in Settings' box as Go to is", sg.includes("Lessons") && /Short game/.test(await text()), JSON.stringify(sg));
      await shot("05b-coach-lessons-short");
      await type(page, "hom scr");
      check("(j) a prefix on each word, in any order: \"hom scr\" finds Add to Home Screen", (await ids(page))[0] === "settings-install", JSON.stringify(await ids(page)));
      await type(page, "less recur");
      check("(j2) …\"less recur\" finds Recurring lessons", (await ids(page)).includes("recurring"), JSON.stringify(await ids(page)));
      await type(page, "d");
      const d1 = await rows(page);
      check("(j3) one letter is the start of a word: \"d\" finds Drills, Drifting, Default view and Downloads and no row with a d inside it (Sound, Add player)",
        ["quick-drills", "atrisk", "settings-view", "settings-library", "settings-downloads"].every((k) => d1.some((r) => r.id === k)) && !d1.some((r) => ["settings-sound", "quick-player", "settings-reduce-motion"].includes(r.id)), JSON.stringify(d1.map((r) => r.id)));

      /* every Go to row a row of words */
      await type(page, "a");
      const all = await ids(page);
      const leads = [];
      for (let i = 0; i < all.length; i++) leads.push({ id: all[i], ...(await M.rowLead(page, '[data-tour="search-goto-row"]', i)) });
      const bad = leads.filter((o) => !(o.lead === 0 && o.before === 0 && o.inset === 16 && !o.labelCut && !o.valueCut && o.glyphs.every((g) => g === "chevron-right")));
      check("(k) every Go to row is a row of words: the label on the 16 inset, nothing before it, no glyph but the chevron, nothing cut", all.length > 10 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
      const boxed = await page.evaluate(() => { const g = document.querySelector('[data-tour="search-goto"] .nsc-group'); return g ? { rows: g.children.length, edge: getComputedStyle(g).borderTopColor } : null; });
      check("(k2) …in Settings' own box, the boxed list every kind of the search sits in", !!boxed && boxed.rows === all.length && (await page.locator(".nsc-group").count()) >= 1, JSON.stringify(boxed));
      await shot("05-coach-a");

      /* cleared, nothing */
      await page.locator('button[aria-label="Clear"]').first().click(); await page.waitForTimeout(400);
      check("(l) the Clear cross empties the field, and the Go to group goes with it", (await field(page).inputValue()) === "" && !(await hasGroup(page)));
      await type(page, "away"); await shot("01-coach-390-away");
      await ctx.close();
    }

    /* ================= the coach at 320: nothing cut ================= */
    {
      const { ctx, page, shot } = await boot("coach", 320);
      await openSearch(page);
      for (const q of ["a", "invite", "version", "default view"]) {
        await type(page, q);
        const n = (await ids(page)).length; const leads = [];
        for (let i = 0; i < n; i++) leads.push(await M.rowLead(page, '[data-tour="search-goto-row"]', i));
        const wide = await page.evaluate(() => [...document.querySelectorAll('[data-tour="search-goto-row"]')].filter((r) => r.getBoundingClientRect().right > innerWidth - 16 + 0.5 || r.scrollWidth > r.clientWidth + 1).length);
        check(`(m) at 320 "${q}": ${n} rows, no label or value cut, nothing past the page's gutter`, n > 0 && leads.every((o) => o && !o.labelCut && !o.valueCut) && wide === 0, JSON.stringify(leads.filter((o) => !o || o.labelCut || o.valueCut).slice(0, 2)) + ` wide ${wide}`);
        await shot(`06-coach-320-${q.replace(/\s+/g, "-")}`);
      }
      await ctx.close();
    }

    /* ================= the coach on a Home Screen ================= */
    {
      /* installed, Settings has no Add to Home Screen row — and so the search has none */
      const { ctx, page } = await boot("coach", 390, () => { Object.defineProperty(navigator, "standalone", { get: () => true, configurable: true }); });
      await openSearch(page);
      await type(page, "install");
      check("(m2) on a Home Screen \"install\" finds no Add to Home Screen, as Settings offers none", !(await ids(page)).includes("settings-install"), JSON.stringify(await ids(page)));
      await type(page, "walkthrough");
      check("(m2) …while the rest of Settings is found as ever", (await ids(page))[0] === "settings-tour", JSON.stringify(await ids(page)));
      await ctx.close();
    }

    /* ================= a player ================= */
    {
      const { ctx, page, text, shot } = await boot("adult");
      await openSearch(page);
      check("(n) a player's fresh search shows no Go to group", !(await hasGroup(page)));
      for (const q of ["away", "hours", "drifting"]) {
        await type(page, q);
        check(`(n) a player's "${q}" finds nothing of the coach's — no Go to group at all`, !(await hasGroup(page)), JSON.stringify(await rows(page)));
      }
      const seen = new Set();
      for (const q of ["call off", "new group", "recurring", "register", "competition", "invite", "requests", "a", "e", "o"]) { await type(page, q); (await ids(page)).forEach((k) => seen.add(k)); }
      check("(n2) …nor any of the plus's actions or the coach's places, whatever is typed", ![...seen].some((k) => COACH_ONLY.test(k) || PARENT_ONLY.test(k)), JSON.stringify([...seen].filter((k) => COACH_ONLY.test(k) || PARENT_ONLY.test(k))));
      await type(page, "default view");
      const dv = (await rows(page))[0] || {};
      check("(o) a player's Default view reads Feed, their own", dv.id === "settings-view" && /Default view Feed/.test(dv.text), JSON.stringify(dv));
      await type(page, "niamh");
      const nm = await rows(page);
      check("(o2) the coach's name finds Your coach by its value", nm.some((r) => r.id === "settings-family" && /Your coach Niamh Byrne/.test(r.text)), JSON.stringify(nm));
      await type(page, "progress");
      await shot("07-player-390-progress");
      const pr = await ids(page);
      await tapRow(page, "progress", 1100);
      check("(p) \"progress\" finds their own Progress and opens it", pr[0] === "progress" && (await title(page)) === "Progress" && /Short game/.test(await text()), `${JSON.stringify(pr)} · ${await title(page)}`);
      await M.back(page, 900);
      check("(p) …and Back is the search with its words", await onSearch(page, "progress"));
      await type(page, "practice");
      const pc = await ids(page);
      await tapRow(page, "practice-log", 1000);
      const ps = await sheetText(page);
      check("(q) \"practice\" finds Log a practice, which opens the practice sheet", pc.includes("practice-log") && /^Practice/.test(ps), `${JSON.stringify(pc)} · ${ps.slice(0, 80)}`);
      await closeSheet(page);
      /* the thread's camera, found by name */
      await type(page, "clip");
      const cl = await ids(page);
      await tapRow(page, "send-clip", 1300);
      const cam = (await page.locator('[data-tour="capture-shutter"]').count()) > 0;
      check("(q2) \"clip\" finds Send a clip, which opens the camera as the thread's does", cl[0] === "send-clip" && cam, `${JSON.stringify(cl)} · camera ${cam}`);
      await shot("07b-player-send-clip-camera");
      if (cam) { await page.locator('button[aria-label="Close"]').first().click().catch(() => {}); await page.waitForTimeout(800); }
      check("(q2) …and closing the camera is the search again", await onSearch(page, "clip"));
      await type(page, "review");
      check("(q3) \"review\" finds Your coach, where a review is left", (await ids(page)).includes("settings-family"), JSON.stringify(await rows(page)));
      await type(page, "saved");
      check("(q4) a player's Saved and Starred are there too", (await ids(page)).includes("saved") && (await ids(page)).includes("saved:starred"), JSON.stringify(await ids(page)));
      await ctx.close();
    }

    /* ================= the player at 320 ================= */
    {
      const { ctx, page, shot } = await boot("adult", 320);
      await openSearch(page);
      for (const q of ["progress", "a"]) {
        await type(page, q);
        const n = (await ids(page)).length; const leads = [];
        for (let i = 0; i < n; i++) leads.push(await M.rowLead(page, '[data-tour="search-goto-row"]', i));
        check(`(r) a player at 320 "${q}": ${n} rows, nothing cut`, n > 0 && leads.every((o) => o && !o.labelCut && !o.valueCut), JSON.stringify(leads.filter((o) => !o || o.labelCut || o.valueCut).slice(0, 2)));
        await shot(`08-player-320-${q}`);
      }
      await ctx.close();
    }

    /* ================= a parent ================= */
    {
      const { ctx, page, text } = await boot("parent");
      await openSearch(page);
      await type(page, "progress");
      const pr = await rows(page);
      const kid = pr.find((r) => r.id === `progress:${IDS.junior}`);
      check("(s) a parent's \"progress\" is their child's, named on the row — and none of their own, having no coach", !!kid && /^Progress Saoirse$/.test(kid.text) && !pr.some((r) => r.id === "progress"), JSON.stringify(pr));
      await tapRow(page, `progress:${IDS.junior}`, 1100);
      check("(s) …and it opens Saoirse's Progress", (await title(page)) === "Saoirse Kelly" && /Putting/.test(await text()), `${await title(page)} · ${(await text()).slice(0, 120)}`);
      await M.back(page, 900);
      await type(page, "saoirse");
      check("(s2) …and the child's name finds it too", (await ids(page)).includes(`progress:${IDS.junior}`), JSON.stringify(await ids(page)));
      await type(page, "clip");
      const pc = await rows(page);
      check("(s3) a parent's \"clip\" is Send a clip for the child, named on the row — none of their own, having no coach", pc.some((r) => r.id === `send-clip:${IDS.junior}` && /^Send a clip Saoirse$/.test(r.text)) && !pc.some((r) => r.id === "send-clip"), JSON.stringify(pc));
      const seen = new Set();
      for (const q of ["practice", "call off", "drifting", "hours", "away", "a", "e"]) { await type(page, q); (await ids(page)).forEach((k) => seen.add(k)); }
      check("(t) a parent is offered no practice of their own and nothing of the coach's", !seen.has("practice-log") && ![...seen].some((k) => COACH_ONLY.test(k)), JSON.stringify([...seen].filter((k) => k === "practice-log" || COACH_ONLY.test(k))));
      await ctx.close();
    }

    /* ================= a junior ================= */
    {
      const { ctx, page, text, shot } = await boot("junior");
      await openSearch(page);
      check("(u) a junior's fresh search shows no Go to group", !(await hasGroup(page)));
      const seen = new Map();
      for (const q of ["call off", "new group", "drifting", "hours", "away", "recurring", "register", "log", "requests", "review", "competition", "capture", "tip", "invite", "message", "chat", "clip", "video", "this month", "a", "e", "i", "o", "s", "t"]) {
        await type(page, q); for (const r of await rows(page)) seen.set(r.id, r.text);
      }
      /* a junior has no thread, so no camera to the coach either */
      const wrong = [...seen.keys()].filter((k) => COACH_ONLY.test(k) || PARENT_ONLY.test(k) || /^send-clip/.test(k) || /message|chat/i.test(seen.get(k)));
      check("(u2) a junior is offered nothing a junior cannot do: none of the plus, the coach's places, a child's Progress, This month, a message or a clip to send", seen.size > 5 && wrong.length === 0, JSON.stringify(wrong));
      await type(page, "progress");
      const pr = await ids(page);
      await tapRow(page, "progress", 1100);
      check("(u3) …and their own Progress opens", pr[0] === "progress" && (await title(page)) === "Progress", `${JSON.stringify(pr)} · ${await title(page)} · ${(await text()).slice(0, 80)}`);
      await shot("09-junior-progress");
      await ctx.close();
    }

    check("(z) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
