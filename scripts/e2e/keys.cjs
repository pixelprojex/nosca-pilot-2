/* EVERY KEY STANDS ON A LIP, AND EVERY BOX ON A FOOT (18 November). The
   founder asked for the buttons, tiles and boxes "Duolingo style … that we
   have already done with the Lares app", a press that looks like pushing a
   physical button and less text in the bar — then for it consistent: no
   box left the old way, no small circle in a big page, not everything a
   circle, and nothing on the home that the plus already holds. This walks
   it as the coach: no board on the home; the plus's tiles white on the
   edge and its lip, Call off red, Log a lesson across the top; a row on a
   three-point foot that sinks under the finger; the peek's keys round,
   three to a row, going right down and springing back; the tab bar as
   icons alone with their names kept for VoiceOver; the segmented thumb on
   its lip; a text box on the rows' foot; the log's Video · Photo · Voice
   as icons alone.  Usage: node keys.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4381), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
const TODAY = M.ymd(new Date());
const ACCENT = "rgb(32, 122, 48)";   // golf's #207A30 since 21 November (#2F6B3A before)

/* the app's TINT for golf, worked out the app's way: the accent's hue at a
   fresher saturation and 89% lightness */
const hslOf = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
const rgbOfHsl = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return `rgb(${[r, g, b].map((v) => Math.round((v + m) * 255)).join(", ")})`; };
const tintOf = (hex, l, k = 1) => { const [h, s] = hslOf(hex); return rgbOfHsl(h, Math.min(0.3, s * 0.65 + 0.06) * k, l); };
const TINT = "rgb(255, 255, 255)", WASH = "rgb(235, 243, 234)", NONE = "rgba(0, 0, 0, 0)";   // the second kind is the paper's white on the sport's edge — never a tint (18 Nov)
void tintOf;

function freshDb() {
  const db = M.emptyDb();
  const person = (id, email, prof) => { M.addUser(db, { id, email }); return M.addProfile(db, { id, ...prof }); };
  person(IDS.coach, "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person(IDS.adult, "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]) });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.adult, date: TODAY, time: "4:00 pm" });
  M.addLesson(db, { coachId: IDS.coach, playerId: IDS.adult, date: M.ymd(new Date(Date.now() - 7 * 864e5)), focus: "Putting" });
  return db;
}

const { check, results, summary } = M.checker("keys");
const { tap } = M;
const look = (page, sel) => page.locator(sel).first().evaluate((el) => {
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  /* the word's own colour: the leaf that carries the text, where a tile colours its label rather than itself */
  const leaf = [...el.querySelectorAll("*")].find((x) => x.children.length === 0 && (x.textContent || "").trim() && x.textContent.trim() === (el.innerText || "").trim());
  return { bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderTopColor, transform: cs.transform, w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || "").trim(), label: el.getAttribute("aria-label"), fg: getComputedStyle(leaf || el).color };
}).catch(() => null);
const lipOf = (shadow) => { const m = String(shadow || "").match(/\b0px (\d+(?:\.\d+)?)px 0px\b/); return m ? Number(m[1]) : 0; };
const ty = (transform) => { const m = String(transform || "").match(/matrix\(([^)]+)\)/); return m ? Number(m[1].split(",")[5]) : 0; };

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const db = freshDb();
    const u = Object.values(db.users).find((x) => x.id === IDS.coach);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) });

    /* (a) the home carries no board (18 November: every one of its six was on the plus already); the plus is
       Log a lesson across the top, then the eight as tiles two to a row — eight is a cluster, so a quiet tile
       drops its outline and stands on the wash on the soft lip of a row (a rim is for the prominent few), the
       glyph over the word, Call off red on a deeper red */
    const board = await page.locator('[data-tour="today-board"], [data-scroll="screen"] button[data-round]').count();
    check("(a) the home carries no board of actions — they are the plus's", board === 0, String(board));
    await tap(page, '[data-tour="quick"]', 900);
    const reg = await look(page, '[data-tour="quick-attend"]'), off = await look(page, '[data-tour="quick-weather"]'), logBlock = await look(page, '[data-tour="quick-log"]');
    const regTile = await page.locator('[data-tour="quick-attend"]').first().evaluate((el) => el.hasAttribute("data-tile") && !el.hasAttribute("data-round")).catch(() => false);
    await shot("a-plus");
    /* THE WHITE KEY (21 November, the afternoon; stone that morning): Duolingo's quiet key — a white face, a light
       grey ring (#E2E2E7), a three-point grey ledge (#D9D9DE) — never the sport's colour, never the wash */
    check("(a) Register on the plus is the white tile: the white face, the light grey ring, a three-point grey ledge — never the sport's colour", regTile && !!reg && reg.bg === "rgb(255, 255, 255)" && reg.border === "rgb(226, 226, 231)" && lipOf(reg.shadow) === 3 && /rgb\(217, 217, 222\)/.test(reg.shadow) && !/32, 122, 48/.test(reg.shadow) && reg.w > reg.h, JSON.stringify(reg));
    /* Call off is the white key like its neighbours since 21 November, told by its red word and the red square of its glyph */
    check("(a) …Call off the white key with its word in red, on the same ledge", !!off && off.bg === "rgb(255, 255, 255)" && off.fg === "rgb(196, 52, 42)" && lipOf(off.shadow) === 3, JSON.stringify(off));
    check("(a) …and Log a lesson the accent across the top, the glyph beside the word", !!logBlock && logBlock.bg === ACCENT && lipOf(logBlock.shadow) === 3 && logBlock.h >= 60 && logBlock.h < 70, JSON.stringify(logBlock));
    await page.keyboard.press("Escape"); await page.mouse.click(20, 120); await page.waitForTimeout(700);

    /* (c) content stands on a foot: a row of a list on three points of the wash made deeper, and one that is a
       button sinks onto it under the finger — Lares's tiles, so a list is the same family as its keys */
    const row = await page.evaluate(() => { const b = [...document.querySelectorAll(".nsc-list > *")].find((x) => /Cian Murphy/.test(x.innerText)); return b ? getComputedStyle(b).boxShadow : null; });
    check("(c) a row of the day stands on a two-point ledge of the light grey line, not the sport's colour", lipOf(row) === 2 && /rgb\(226, 226, 231\)/.test(String(row)) && !/32, 122, 48/.test(String(row)), String(row));
    const arch = page.locator('[data-tour="today-archive"]').first();
    let sink = null;
    if (await arch.count()) {
      await arch.scrollIntoViewIfNeeded(); const bb = await arch.boundingBox();
      await page.mouse.move(bb.x + 30, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(60);
      sink = await page.evaluate(() => { const el = document.querySelector('[data-tour="today-archive"]'); const cs = getComputedStyle(el); return { transform: cs.transform, shadow: cs.boxShadow }; });
      await page.mouse.move(5, 5); await page.mouse.up(); await page.waitForTimeout(400);
    }
    /* since 21 November a row sinks the whole of its ledge, as Duolingo's card does — it took half of it before */
    check("(c) …and a row that is one button sinks right onto it under the finger", !!sink && ty(sink.transform) === 2 && lipOf(sink.shadow) === 0, JSON.stringify(sink));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);

    /* (b) the peek's six are round keys three to a row — the face sinks its whole three-point lip under a finger
       that stays, and a finger that moves (a scroll starting on it) presses nothing: the one press */
    await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
    const peekKeys = await page.locator('[data-tour="peek-actions"] > button').evaluateAll((els) => els.map((e) => { const f = e.querySelector("[data-face]"); const r = f ? f.getBoundingClientRect() : null; return { round: e.hasAttribute("data-round"), w: r ? Math.round(r.width) : 0, top: Math.round(e.getBoundingClientRect().top), word: (e.innerText || "").trim() }; }));
    check("(b) the peek's actions are round keys, 56 across, three to a row", peekKeys.length >= 5 && peekKeys.every((k) => k.round && k.w === 56) && new Set(peekKeys.map((k) => k.top)).size === 2, JSON.stringify(peekKeys));
    const pressed = await page.evaluate(async () => {
      const el = document.querySelector('[data-tour="peek-actions"] button[data-round]'); if (!el) return null;
      const f = el.querySelector("[data-face]"), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 20;
      const ev = (type, dx = 0, dy = 0) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "touch", clientX: x + dx, clientY: y + dy }));
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const read = () => { const cs = getComputedStyle(f); return { transform: cs.transform, shadow: cs.boxShadow }; };
      /* a scroll that starts on the key: the finger moves before the press begins */
      ev("pointerdown"); ev("pointermove", 0, -24); await wait(120); const scrolled = read(); ev("pointercancel"); await wait(250);
      /* a finger that stays */
      ev("pointerdown"); const first = read(); await wait(140); const down = read();
      ev("pointerup"); await wait(260);
      return { scrolled, first, down, upTransform: f.style.transform, upShadow: f.style.boxShadow };
    });
    check("(b) a scroll that starts on a key presses nothing — the face never moves", !!pressed && ty(pressed.scrolled.transform) === 0 && lipOf(pressed.scrolled.shadow) === 3, JSON.stringify(pressed && pressed.scrolled));
    check("(b) a finger that stays sends the face right down — the whole three-point lip — only once it has stayed", !!pressed && ty(pressed.first.transform) === 0 && ty(pressed.down.transform) === 3 && lipOf(pressed.down.shadow) === 0, JSON.stringify(pressed));
    check("(b) …and it comes back up on release", !!pressed && pressed.upTransform === "none" && /0px 3px 0px/.test(pressed.upShadow), JSON.stringify(pressed));
    const peekLog = await look(page, '[data-tour="peek-log"]');
    await shot("b-peek");
    check("(e) the peek's Log is the accent on a four-point lip, 50 drawn", !!peekLog && peekLog.bg === ACCENT && lipOf(peekLog.shadow) === 4 && peekLog.h >= 50, JSON.stringify(peekLog));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);

    /* (d) the tab bar: the icons alone, their names kept, a capsule round the one you are on, the plus a key */
    const tabs = await page.locator('[data-tour="tabbar"] button[data-tour^="tab-"]').evaluateAll((els) => els.map((e) => ({ text: (e.innerText || "").replace(/\d+/g, "").trim(), label: e.getAttribute("aria-label") })));
    const pill = await look(page, "[data-tour-pill]");
    const plus = await look(page, '[data-tour="quick"] [data-lip]');
    await shot("d-bar");
    check("(d) the tab bar carries no words, only icons — each keeps its name for VoiceOver", tabs.length >= 4 && tabs.every((x) => x.text === "" && !!x.label) && ["Today", "Diary", "Roster", "Chat"].every((n) => tabs.some((x) => x.label === n)), JSON.stringify(tabs));
    check("(d) the highlight is a capsule round the icon (50 × 38), not a lozenge filling the cell", !!pill && pill.w === 50 && pill.h === 38, JSON.stringify(pill));
    check("(d) the raised plus is the big plus on the bar's swell, as it always was — no box of its own", !plus && (await page.locator('[data-tour="quick"] svg').count()) === 1 && (await page.locator('[data-tour="quick"] span').first().evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgba(0, 0, 0, 0)", JSON.stringify(plus));

    /* (f) the segmented thumb stands on a lip */
    await tap(page, '[aria-label="Diary"]', 1000);
    const thumb = await page.locator('[data-tour="cal-view"] span[data-lip]').first().evaluate((el) => getComputedStyle(el).boxShadow).catch(() => null);
    check("(f) the segmented control's thumb stands on a two-point lip", lipOf(thumb) === 2, String(thumb));

    /* (g) a text box: on the soft foot of a row */
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    await tap(page, '[aria-label="Your profile"]', 900);
    const field = page.locator('input[aria-label="Search settings"]').first();
    const ring0 = (await field.count()) ? await field.evaluate((el) => getComputedStyle(el.parentElement).boxShadow) : null;
    if (await field.count()) { await field.focus(); await page.waitForTimeout(300); }
    const ring1 = (await field.count()) ? await field.evaluate((el) => getComputedStyle(el.parentElement).boxShadow) : null;
    check("(g) a text box stands on the rows' two-point foot, typed in or not — a box like every other", lipOf(ring0) === 2 && lipOf(ring1) === 2, `${ring0} → ${ring1}`);

    /* (h) the log's Video · Photo · Voice: the icon alone, the word their name */
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    await tap(page, '[data-tour="quick"]', 900); await tap(page, '[data-tour="quick-log"]', 1000);
    const who = page.locator("button", { hasText: "Cian" }).first();
    if (await who.count()) { await who.click(); await page.waitForTimeout(1000); }
    const media = await page.locator('button[aria-label="Video"], button[aria-label="Photo"], button[aria-label="Voice note"]').evaluateAll((els) => els.map((e) => ({ label: e.getAttribute("aria-label"), text: (e.innerText || "").replace(/\d+/g, "").trim(), svg: !!e.querySelector("svg") })));
    await shot("h-log-media");
    check("(h) the log's Video, Photo and Voice are the icon alone, each named for VoiceOver", media.length === 3 && media.every((m) => m.text === "" && m.svg), JSON.stringify(media));

    await ctx.close();
    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
