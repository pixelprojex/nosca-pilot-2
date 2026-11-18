/* EVERY KEY STANDS ON A LIP (18 November). The founder asked for the
   buttons, tiles and boxes "Duolingo style … that we have already done
   with the Lares app", dramatic 3D, a press that looks like pushing a
   physical button, saturated colour fills rather than white outlined
   boxes, and less text in the bar. This walks it as the coach: the
   board's one action on the accent's lip and the rest on the sport's
   tint; a key going right down under a pointer and springing back; the
   peek's Log, a row, the segmented thumb and the raised plus on their
   lips; the tab bar as icons alone with their names kept for VoiceOver
   and a capsule round the active icon; the log's Video · Photo · Voice
   as icons alone; a text box ringed, and the ring the accent while
   typed in.  Usage: node keys.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4381), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
const TODAY = M.ymd(new Date());
const ACCENT = "rgb(47, 107, 58)";   // golf's #2F6B3A

/* the app's TINT for golf, worked out the app's way: the accent's hue at a
   fresher saturation and 89% lightness */
const hslOf = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
const rgbOfHsl = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return `rgb(${[r, g, b].map((v) => Math.round((v + m) * 255)).join(", ")})`; };
const tintOf = (hex, l, k = 1) => { const [h, s] = hslOf(hex); return rgbOfHsl(h, Math.min(0.46, s * 1.1 + 0.06) * k, l); };
const TINT = tintOf("#2F6B3A", 0.89);

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
  return { bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderTopColor, transform: cs.transform, w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || "").trim(), label: el.getAttribute("aria-label") };
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

    /* (a) the board: the one action on the accent's lip, the rest the sport's tint on theirs */
    const logT = await look(page, 'button[data-lip][aria-label="Log"]');
    const regT = await look(page, 'button[data-lip][aria-label="Register"]');
    await shot("a-board");
    check("(a) the board's Log is the accent standing on a six-point lip", !!logT && logT.bg === ACCENT && lipOf(logT.shadow) === 6, JSON.stringify(logT));
    check("(a) …and Register is the sport's tint (never white with an outline), on its own six-point lip with a fine ring", !!regT && regT.bg === TINT && regT.bg !== "rgb(255, 255, 255)" && lipOf(regT.shadow) === 6 && /inset/.test(regT.shadow) && /rgba\(0, 0, 0, 0\)|transparent/.test(regT.border), JSON.stringify(regT));

    /* (b) the press: right down at once, and back up on release */
    const pressed = await page.evaluate(() => {
      const el = document.querySelector('button[data-lip][aria-label="Register"]'); if (!el) return null;
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7, pointerType: "touch" }));
      const cs = getComputedStyle(el); const down = { transform: cs.transform, shadow: cs.boxShadow };
      el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "touch" }));
      return { down, upTransform: el.style.transform, upShadow: el.style.boxShadow };
    });
    check("(b) a key goes right down under the finger — five of its six points, the lip one point — with nothing eased in", !!pressed && ty(pressed.down.transform) === 5 && lipOf(pressed.down.shadow) === 1, JSON.stringify(pressed));
    check("(b) …and comes back up on release", !!pressed && pressed.upTransform === "none" && /0px 6px 0px/.test(pressed.upShadow), JSON.stringify(pressed));

    /* (c) a row of a list on its lip */
    const row = await page.evaluate(() => { const b = [...document.querySelectorAll(".nsc-list > *")].find((x) => /Cian Murphy/.test(x.innerText)); return b ? getComputedStyle(b).boxShadow : null; });
    check("(c) a row of the day stands on a four-point lip of the wash", lipOf(row) === 4, String(row));

    /* (d) the tab bar: the icons alone, their names kept, a capsule round the one you are on, the plus a key */
    const tabs = await page.locator('[data-tour="tabbar"] button[data-tour^="tab-"]').evaluateAll((els) => els.map((e) => ({ text: (e.innerText || "").replace(/\d+/g, "").trim(), label: e.getAttribute("aria-label") })));
    const pill = await look(page, "[data-tour-pill]");
    const plus = await look(page, '[data-tour="quick"] [data-lip]');
    await shot("d-bar");
    check("(d) the tab bar carries no words, only icons — each keeps its name for VoiceOver", tabs.length >= 4 && tabs.every((x) => x.text === "" && !!x.label) && ["Today", "Diary", "Roster", "Chat"].every((n) => tabs.some((x) => x.label === n)), JSON.stringify(tabs));
    check("(d) the highlight is a capsule round the icon (50 × 38), not a lozenge filling the cell", !!pill && pill.w === 50 && pill.h === 38, JSON.stringify(pill));
    check("(d) the raised plus is a key: the accent on its own lip", !!plus && plus.bg === ACCENT && lipOf(plus.shadow) >= 4, JSON.stringify(plus));

    /* (e) the peek's Log is the Button on its lip */
    await page.locator("button", { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
    const peekLog = await look(page, '[data-tour="peek-log"]');
    await shot("e-peek");
    check("(e) the peek's Log is the accent on a six-point lip, 50 drawn", !!peekLog && peekLog.bg === ACCENT && lipOf(peekLog.shadow) === 6 && peekLog.h >= 50, JSON.stringify(peekLog));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);

    /* (f) the segmented thumb stands on a lip */
    await tap(page, '[aria-label="Diary"]', 1000);
    const thumb = await page.locator('[data-tour="cal-view"] span[data-lip]').first().evaluate((el) => getComputedStyle(el).boxShadow).catch(() => null);
    check("(f) the segmented control's thumb stands on a two-point lip", lipOf(thumb) === 2, String(thumb));

    /* (g) a text box: ringed, the ring the accent while typed in */
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    await tap(page, '[aria-label="Your profile"]', 900);
    const field = page.locator('input[aria-label="Search settings"]').first();
    const ring0 = (await field.count()) ? await field.evaluate((el) => getComputedStyle(el.parentElement).boxShadow) : null;
    if (await field.count()) { await field.focus(); await page.waitForTimeout(300); }
    const ring1 = (await field.count()) ? await field.evaluate((el) => getComputedStyle(el.parentElement).boxShadow) : null;
    check("(g) a text box carries a ring, never a lip, and the ring is the accent's 2px while typed in", /inset/.test(String(ring0)) && lipOf(ring0) === 0 && /2px/.test(String(ring1)) && String(ring1).includes(ACCENT), `${ring0} → ${ring1}`);

    /* (h) the log's Video · Photo · Voice: the icon alone, the word their name */
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    await tap(page, 'button[data-lip][aria-label="Log"]', 1000);
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
