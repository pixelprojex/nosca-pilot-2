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
const ACCENT = "rgb(40, 89, 55)";   // golf's fairway #285937 since the colour study of 22 November (#207A30, #2F6B3A before)

/* the app's TINT for golf, worked out the app's way: the accent's hue at a
   fresher saturation and 89% lightness */
const hslOf = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
const rgbOfHsl = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return `rgb(${[r, g, b].map((v) => Math.round((v + m) * 255)).join(", ")})`; };
const tintOf = (hex, l, k = 1) => { const [h, s] = hslOf(hex); return rgbOfHsl(h, Math.min(0.3, s * 0.65 + 0.06) * k, l); };
const TINT = "rgb(255, 255, 255)", WASH = "rgb(235, 243, 234)", NONE = "rgba(0, 0, 0, 0)";   // the second kind is the paper's white on the sport's edge — never a tint (18 Nov)
void tintOf;

function freshDb(sport = "golf") {
  const db = M.emptyDb();
  const person = (id, email, prof) => { M.addUser(db, { id, email }); return M.addProfile(db, { id, sport, ...prof }); };
  person(IDS.coach, "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person(IDS.adult, "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  /* a second player with the day's first lesson: since 22 November (art direction) the lesson next is the home's
     one coloured card (c0), and Cian's, after it, stays the white row of the day that (c) and the peek read */
  const AOIFE = "00000000-0000-4000-8000-0000000a01fe";
  person(AOIFE, "aoife@t.ie", { role: "player", name: "Aoife Doyle", type: "adult", coachId: IDS.coach, dob: "1993-03-03" });
  M.addBooking(db, { coachId: IDS.coach, playerId: AOIFE, date: TODAY, time: "2:00 pm" });
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
/* WCAG's contrast of two computed colours, read off the page — never a constant of the palette */
const lum = (rgb) => { const [r, g, b] = String(rgb).match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const rgbIn = (s) => { const m = String(s || "").match(/rgba?\([^)]+\)/); return m ? m[0] : null; };
/* how far apart two computed colours are, in OKLab — what scripts/club-palette.py's SEPARATE measures */
const oklab = (rgb) => {
  const [r, g, b] = String(rgb).match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * q, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * q, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * q];
};
const dE = (x, y) => { const p = oklab(x), q = oklab(y); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const FOIL = "rgb(194, 162, 76)", FOIL_LIGHT = "rgb(230, 208, 138)";
/* the gold on the day's card: the pinstripe wedge in its corner and the eyebrow's colour */
const foilOf = (page) => page.evaluate(() => {
  const c = document.querySelector("[data-next-card]"); if (!c) return null;
  const svg = c.querySelector("svg[data-foil]"), path = svg && svg.querySelector("path"), eb = c.querySelector("[data-foil-word]");
  const cr = c.getBoundingClientRect(), sr = svg ? svg.getBoundingClientRect() : null;
  return { wedge: !!svg, stroke: path ? getComputedStyle(path).stroke : null, opacity: path ? Number(getComputedStyle(path).strokeOpacity) : 0, hidden: svg ? svg.getAttribute("aria-hidden") : null,
           taps: svg ? getComputedStyle(svg).pointerEvents : null, corner: sr ? cr.right - sr.right >= 0 && cr.right - sr.right <= 2 && sr.top - cr.top >= 0 && sr.top - cr.top <= 2 : false, clip: getComputedStyle(c).overflow,
           eyebrow: eb ? getComputedStyle(eb).color : null, bg: getComputedStyle(c).backgroundColor };
});
/* the plus sheet's eight filled keys: their faces */
const plusFaces = (page) => page.locator("[data-tile][data-fill]").evaluateAll((els) => els.map((e) => ({ word: (e.innerText || "").trim(), bg: getComputedStyle(e).backgroundColor })));
/* the day's coloured card, as the page draws it */
const cardOf = (page) => page.evaluate(() => {
  const cs = [...document.querySelectorAll("[data-next-card]")], c = cs[0]; if (!c) return { n: 0 };
  const s = getComputedStyle(c), nm = c.querySelector("[data-name]");
  return { n: cs.length, kind: c.dataset.nextCard, bg: s.backgroundColor, shadow: s.boxShadow, radius: s.borderTopLeftRadius, fg: getComputedStyle(nm).color, name: nm.textContent.trim(),
           inList: !!c.parentElement && c.parentElement.classList.contains("nsc-list"), transform: s.transform };
});
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
       grey ring (#E4E0D7), a three-point grey ledge (#D9D4C9) — never the sport's colour, never the wash */
    /* FILLED KEYS (23 November): a function's tile is filled with its function's light colour — Register the lead's
       cloth tone, #A4C9AC — with no ring, the word in the hue's ink, on a three-point ledge of the same hue */
    check("(a) Register on the plus is a filled tile: the lead's light colour on the face, no ring, a three-point ledge of the same hue, the word in its ink — never a white key", regTile && !!reg && reg.bg === "rgb(164, 201, 172)" && reg.border === "rgba(0, 0, 0, 0)" && lipOf(reg.shadow) === 3 && /rgb\(102, 145, 114\)/.test(reg.shadow) && reg.fg === "rgb(22, 49, 30)" && reg.w > reg.h, JSON.stringify(reg));
    /* Call off is filled like its neighbours, in the brick's light colour with the brick's ink — #E0B1AA since the
       cloth of the reds and the blues was capped (24 November; #DAA198 before, a salmon) */
    check("(a) …Call off filled with the brick's light colour, its word in the brick's ink, on the same ledge", !!off && off.bg === "rgb(224, 177, 170)" && off.fg === "rgb(85, 28, 23)" && lipOf(off.shadow) === 3, JSON.stringify(off));
    check("(a) …and Log a lesson the accent across the top, the glyph beside the word", !!logBlock && logBlock.bg === ACCENT && lipOf(logBlock.shadow) === 3 && logBlock.h >= 60 && logBlock.h < 70, JSON.stringify(logBlock));
    await page.keyboard.press("Escape"); await page.mouse.click(20, 120); await page.waitForTimeout(700);

    /* (c) content stands on a foot: a row of a list on three points of the wash made deeper, and one that is a
       button sinks onto it under the finger — Lares's tiles, so a list is the same family as its keys */
    const row = await page.evaluate(() => { const b = [...document.querySelectorAll(".nsc-list > *")].find((x) => /Cian Murphy/.test(x.innerText)); return b ? getComputedStyle(b).boxShadow : null; });
    /* 28 November, the Lares card: a row of the day stands on a four-point ledge a step deeper in its own family
       (golf's fairway pale's ledge toward its cloth, #ABCDB3) — never the deep colour itself */
    check("(c) a row of the day stands on a four-point ledge of its own family's pale, not the sport's deep colour", lipOf(row) === 4 && /rgb\(171, 205, 179\)/.test(String(row)) && !/40, 89, 55/.test(String(row)), String(row));
    const arch = page.locator('[data-tour="today-archive"]').first();
    let sink = null;
    if (await arch.count()) {
      await arch.scrollIntoViewIfNeeded(); const bb = await arch.boundingBox();
      await page.mouse.move(bb.x + 30, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(60);
      sink = await page.evaluate(() => { const el = document.querySelector('[data-tour="today-archive"]'); const cs = getComputedStyle(el); return { transform: cs.transform, shadow: cs.boxShadow }; });
      await page.mouse.move(5, 5); await page.mouse.up(); await page.waitForTimeout(400);
    }
    /* since 21 November a row sinks the whole of its ledge, as Duolingo's card does — it took half of it before */
    check("(c) …and a row that is one button sinks onto it under the finger", !!sink && ty(sink.transform) === 3 && lipOf(sink.shadow) === 1, JSON.stringify(sink));
    /* (c0) THE NEXT LESSON IS THE ONE COLOURED CARD (22 November, art direction): the one action's own colour — read
       off the plus's Log a lesson, never a constant of the palette — its words 4.5:1 and over on it, 16px corners,
       a box of the day's list on a four-point ledge of its colour made deeper; exactly one on the screen, and the
       whole card sinks onto its ledge under a finger */
    {
      const card = await cardOf(page), ledge = rgbIn(card.shadow);
      check("(c0) the next lesson is the day's one coloured card: the one action's colour, its words 4.5:1 and over, 18px corners, a four-point ledge of the colour made deeper",
        card.n === 1 && card.kind === "next" && card.name === "Aoife Doyle" && card.inList && !!logBlock && card.bg === logBlock.bg && contrast(card.fg, card.bg) >= 4.5
        && card.radius === "18px" && lipOf(card.shadow) === 4 && !!ledge && ledge !== card.bg && lum(ledge) < lum(card.bg), JSON.stringify(card));
      const cb = await page.locator("[data-next-card]").first().boundingBox();
      await page.mouse.move(cb.x + 40, cb.y + 22); await page.mouse.down(); await page.waitForTimeout(60);
      const down = await cardOf(page);
      await page.mouse.move(5, 5); await page.mouse.up(); await page.waitForTimeout(400);
      const up = await cardOf(page);
      check("(c0) …and the whole card sinks onto its ledge under the finger and comes back", ty(down.transform) === 3 && lipOf(down.shadow) === 1 && ty(up.transform) === 0 && lipOf(up.shadow) === 4, JSON.stringify({ down: [down.transform, down.shadow], up: [up.transform, up.shadow] }));
      /* (c1) GOLD AS FOIL (24 November): the card carries the business card's pinstripe wedge in its top-right corner —
         a hairline of the card's gold at a third of its strength, clipped by the corner, ornament only — and its
         eyebrow in the light foil; the time and the name stay white */
      const foil = await foilOf(page);
      check("(c1) the day's card carries the card's pinstripe wedge in its top-right corner: the card's gold, a third of its strength, clipped by the corner, taking no tap and saying nothing",
        !!foil && foil.wedge && foil.stroke === FOIL && foil.opacity > 0.2 && foil.opacity < 0.5 && foil.corner && foil.clip === "hidden" && foil.taps === "none" && foil.hidden === "true", JSON.stringify(foil));
      check("(c1) …and its eyebrow is the light foil, 4.5:1 and over on the card, while the name stays white",
        !!foil && foil.eyebrow === FOIL_LIGHT && contrast(foil.eyebrow, foil.bg) >= 4.5 && card.fg === "rgb(255, 255, 255)", JSON.stringify({ foil, name: card.fg }));
    }
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

    /* (k) the Logged burst: the tick's disc wears a fine ring of the card's gold set in from its edge, a medal's rim */
    {
      const area = page.getByRole("button", { name: "Chipping", exact: true });
      if (await area.count()) { await area.first().click(); await page.waitForTimeout(300); }
      await page.getByRole("button", { name: "Log it", exact: true }).click(); await page.waitForTimeout(1700);
      const disc = await page.evaluate(() => { const d = document.querySelector('[aria-live="polite"] [data-foil]'); return d ? { shadow: getComputedStyle(d).boxShadow, bg: getComputedStyle(d).backgroundColor } : null; });
      await shot("k-burst");
      check("(k) the Logged burst's tick sits in the accent's disc with a fine ring of the card's gold set in from its edge",
        !!disc && disc.bg === ACCENT && disc.shadow.includes(`${FOIL} 0px 0px 0px 6.5px inset`) && disc.shadow.includes(`${ACCENT} 0px 0px 0px 5px inset`), JSON.stringify(disc));
    }

    await ctx.close();

    /* (i) the words on the sport's colour, read on the card itself in every sport: 4.5:1 and over, one card a screen */
    {
      const read = [], apart = [];
      for (const sport of ["golf", "tennis", "rowing", "squash", "padel", "equestrian"]) {
        const d = freshDb(sport), su = Object.values(d.users).find((x) => x.id === IDS.coach);
        const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const p2 = await c2.newPage();
        await p2.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(p2, d);
        p2.on("pageerror", (e) => errors.push(`${sport}: ${String(e.message || e)}`));
        await M.injectSession(p2, M.session(su, d));
        await p2.goto(BASE, { waitUntil: "networkidle" }); await M.settle(p2);
        const c = await cardOf(p2), f = await foilOf(p2);
        read.push({ sport, n: c.n, bg: c.bg, fg: c.fg, ratio: c.n ? Math.round(contrast(c.fg, c.bg) * 100) / 100 : 0, foil: f && f.eyebrow, foilRatio: f && f.eyebrow ? Math.round(contrast(f.eyebrow, c.bg) * 100) / 100 : 0 });
        if (sport === "tennis") await p2.screenshot({ path: path.join(outDir, "i-card-tennis.png") });
        /* the plus sheet's eight: no two keys of different functions the same colour */
        await tap(p2, '[data-tour="quick"]', 900);
        const faces = await plusFaces(p2);
        let close = { d: 9 };
        for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) { const d = dE(faces[i].bg, faces[j].bg); if (d < close.d) close = { d: Math.round(d * 1000) / 1000, a: faces[i].word, b: faces[j].word }; }
        apart.push({ sport, n: faces.length, ...close });
        if (sport === "rowing") await p2.screenshot({ path: path.join(outDir, "a2-plus-rowing.png") });
        await c2.close();
      }
      check("(i) the words on the day's card read 4.5:1 and over in all six sports, one card a screen", read.length === 6 && read.every((r) => r.n === 1 && r.ratio >= 4.5), JSON.stringify(read));
      check("(i) …and its eyebrow, in the light foil, reads 4.5:1 and over on the card in all six sports", read.length === 6 && read.every((r) => r.foil === FOIL_LIGHT && r.foilRatio >= 4.5), JSON.stringify(read.map((r) => [r.sport, r.foil, r.foilRatio])));
      /* NO TWO KEYS OF A SPORT THE SAME COLOUR (24 November): the cool and red cloth tones were capped, and in rowing
         the lead's blue and Capture's met at one grey-blue (0.005 apart) — the sets were changed so every pair stays apart */
      check("(a2) the plus sheet's eight keys are eight colours in every sport: no two closer than 0.018 in OKLab", apart.length === 6 && apart.every((x) => x.n === 8 && x.d >= 0.018), JSON.stringify(apart));
    }
    /* (j) A RED QUIET KEY (24 November): what cancels, where it is not the one confirm, is the brick's own pale on
       the pale's ledge with the word in the brick — never the sport's pale with a red word on it. A player's own
       lesson ends on Cancel · Reschedule: the red quiet key beside the lead's quiet key */
    {
      const d = freshDb(), au = Object.values(d.users).find((x) => x.id === IDS.adult);
      const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const p3 = await c3.newPage();
      await p3.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(p3, d);
      p3.on("pageerror", (e) => errors.push(`adult: ${String(e.message || e)}`));
      await M.injectSession(p3, M.session(au, d));
      await p3.goto(BASE, { waitUntil: "networkidle" }); await M.settle(p3);
      await tap(p3, '[aria-label="Diary"]', 1200);
      if (await p3.locator('[data-tour="cal-view"] [aria-label="Calendar"]').count()) await tap(p3, '[data-tour="cal-view"] [aria-label="Calendar"]', 900);
      const keyOf = (sel) => p3.locator(sel).first().evaluate((el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, ring: cs.borderTopColor, fg: cs.color, lip: cs.boxShadow }; }).catch(() => null);
      const cancel = await keyOf('[data-tour="day-cancel"]'), resched = await keyOf('[data-tour="day-reschedule"]');
      await p3.screenshot({ path: path.join(outDir, "j-red-key.png") });
      check("(j) a player's Cancel is the red quiet key: the brick's pale (#F8E2DF) on its own ledge, the word in the brick at 4.5:1 and over",
        !!cancel && cancel.bg === "rgb(248, 226, 223)" && cancel.ring === "rgb(234, 202, 198)" && cancel.fg === "rgb(154, 50, 42)" && contrast(cancel.fg, cancel.bg) >= 4.5 && lipOf(cancel.lip) === 3, JSON.stringify(cancel));
      check("(j) …beside Reschedule, the lead's quiet key — never the same face with a red word",
        !!resched && !!cancel && resched.bg !== cancel.bg && resched.fg !== cancel.fg, JSON.stringify({ cancel, resched }));
      await c3.close();
    }

    /* (l) THE FRONT DOOR IS THE CARD'S BACK (24 November): the mark in the card's gold over the name, and one fine
       gold rule under it; the name itself stays the ink (gold words on white read 2.4:1) */
    {
      const c4 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const p4 = await c4.newPage(); await M.attach(p4, M.emptyDb());
      p4.on("pageerror", (e) => errors.push(`landing: ${String(e.message || e)}`));
      await p4.goto(BASE, { waitUntil: "networkidle" }); await M.settle(p4); await p4.waitForTimeout(900);
      const door = await p4.evaluate(() => {
        const mark = document.querySelector("[data-foil] svg"), rule = document.querySelector("[data-foil-rule]");
        const name = [...document.querySelectorAll("span")].find((x) => x.textContent.trim() === "NOSCA" && !x.children.length);
        return { strokes: mark ? [...mark.querySelectorAll("path")].map((p) => p.getAttribute("stroke")) : [], rule: rule ? { bg: getComputedStyle(rule).backgroundColor, w: rule.getBoundingClientRect().width, h: rule.getBoundingClientRect().height } : null,
                 name: name ? getComputedStyle(name).color : null, create: /Create account/.test(document.body.innerText) };
      });
      await p4.screenshot({ path: path.join(outDir, "l-landing.png") });
      check("(l) the sign-in page's mark is the card's gold, with one fine gold rule under the name, and the name stays the ink",
        door.create && door.strokes.length === 2 && door.strokes.every((x) => String(x).toUpperCase() === "#C2A24C") && !!door.rule && door.rule.bg === FOIL && door.rule.h === 1 && door.rule.w === 56 && !!door.name && door.name !== FOIL, JSON.stringify(door));
      await c4.close();
    }
    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 500));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
