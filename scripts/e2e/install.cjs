/* ADD TO HOME SCREEN. The guide that puts Nosca on a phone — the page
   the business card's code opens (/install), the Settings row and the
   arrival screen's line. This suite proves: /install with no account is
   the guide and not sign-up; the page is the card laid on paper (the
   card, one line saying what Nosca is, the steps, Open Nosca and About
   Nosca); ONLY THIS DEVICE'S STEPS are shown, read off the user agent —
   an iOS 27 Safari gets the three lines at the left of the address bar,
   an iOS 26 one the three dots, an older one Share on the toolbar,
   Chrome its three dots, Samsung its three lines — and every other
   device is behind one quiet row (install-device) that unfolds the
   platform and the version; every step is a numeral, a few words and a
   drawn picture with the thing to tap ringed, and no symbol is typed
   into a sentence; a Chrome that offers to install gets one Install
   Nosca button that opens the browser's own sheet; Open Nosca and the X
   land on sign-up for a stranger and on the app for a member; the
   Settings row opens the same guide in the app's own dress and is gone
   once the app runs from a Home Screen; the arrival screen's line opens
   the guide with Home under it; the gold that is read as a figure or a
   word measures 4.5:1; Reduce Motion lands the page whole at once;
   nothing under 12px, and nothing cut at 320.
   Usage: node install.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4351), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17" };
function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: "Portmarnock" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  return db;
}
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36";
/* Safari freezes the OS in its user agent (18_6, 18_7) from iOS 26 on: its own Version/ is the truth */
const IOS27 = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";
const IOS26 = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const IOS17 = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IGNORED = /Failed to load resource|Blocked call to navigator\.vibrate/;
/* a symbol standing in for a control: never in a step's words */
const SYMBOLS = /[⋯⋮☰≡…]/;

const { check, results, summary } = M.checker("install");
const one = (s) => s.replace(/\s+/g, " ").trim();
const device = async (page) => one(await page.locator('[data-tour="install-device"]').first().innerText());
/* the platform and the version are behind the one quiet row */
const choices = async (page) => { if (!(await page.locator('[data-tour="install-platform"]').count())) await M.tap(page, '[data-tour="install-device"]', 400); };
const pressed = async (page, which = "platform") => { await choices(page); return page.locator(`[data-tour="install-${which}"] button[aria-pressed="true"]`).first().getAttribute("aria-label"); };
const pick = async (page, label, which = "platform") => { await choices(page); await M.tap(page, `[data-tour="install-${which}"] [aria-label="${label}"]`, 500); };
/* each step whole (its words, then what its picture draws), and its words alone */
const steps = async (page) => (await page.locator('[data-tour="install-steps"] > *').allInnerTexts()).map(one);
const words = async (page) => (await page.locator('[data-tour="install-steps"] [data-ins-text]').allInnerTexts()).map(one);
/* what each picture is, for somebody who cannot see it */
const alts = (page) => page.locator('[data-tour="install-steps"] [data-ins-pic]').evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") || ""));
const pictures = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[data-tour="install-steps"] > *')).map((li) => {
  const pic = li.querySelector("[data-ins-pic]"), num = li.querySelector("[data-ins-num]");
  return { n: num ? num.textContent.trim() : "", role: pic ? pic.getAttribute("role") : "", alt: pic ? (pic.getAttribute("aria-label") || "") : "", taps: pic ? pic.querySelectorAll("[data-ins-tap]").length : 0, drawn: pic ? pic.querySelectorAll("svg").length : 0 };
}));
const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const openSettings = async (page) => {
  await M.tap(page, '[data-tour="profile-pill"], [aria-label="Your profile"]', 800);
  if (await page.locator('[data-tour="sheet-settings"]').count()) await M.tap(page, '[data-tour="sheet-settings"]', 900);
};

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  const errors = [];
  const userOf = (key) => Object.values(db.users).find((x) => x.id === IDS[key]);
  const boot = async ({ device: dev, ua, session, init, width = 390, reduce = false } = {}) => {
    const base = dev ? devices[dev] : { viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
    const ctx = await browser.newContext({ ...base, ...(ua ? { userAgent: ua } : {}), ...(reduce ? { reducedMotion: "reduce" } : {}) });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (m) => { if (m.type() === "error" && !IGNORED.test(m.text())) errors.push("console: " + m.text()); });
    if (init) await page.addInitScript(init);
    if (session) await M.injectSession(page, M.session(session, db));
    return { ctx, page, text: () => M.rootText(page), shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) }) };
  };
  /* the arrival (the card turning over, the steps rising in their turn) is over well inside two seconds */
  const guide = async (page) => { await page.goto(`${BASE}/install`, { waitUntil: "networkidle" }); await page.waitForTimeout(2300); };

  try {
    /* ---------- (a) a stranger on a computer ---------- */
    {
      const { ctx, page, text, shot } = await boot();
      await guide(page);
      const t = await text();
      check("(a) /install with no account is the guide, not sign-up", /Add to Home Screen/.test(t) && !/Create account/.test(t) && (await page.locator('[data-tour="install-steps"]').count()) === 1, t.slice(0, 200));
      /* the card laid on paper: the card, then one line of what Nosca is, then the title and the steps */
      const lay = await page.evaluate(() => {
        const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        const card = document.querySelector('[data-tour="install-card"]');
        return { card: box('[data-tour="install-card"]'), what: box('[data-tour="install-what"]'), h1: box("h1"), steps: box('[data-tour="install-steps"]'),
                 role: card && card.getAttribute("role"), label: card && card.getAttribute("aria-label"), stripes: card ? card.querySelectorAll("svg path").length : 0,
                 word: card ? Array.from(card.querySelectorAll('[data-tour="wordmark"]')).map((el) => el.textContent).join(",") : "", vw: window.innerWidth };
      });
      check("(a) the card lies at the top of the page — the mark, NOSCA and the pinstripes, drawn — over the line, the title and the steps",
        !!lay.card && lay.role === "img" && /card/i.test(lay.label || "") && lay.stripes > 20 && /NOSCA/.test(lay.word) && lay.card.left >= 0 && lay.card.right <= lay.vw
        && lay.card.top < lay.what.top && lay.what.bottom <= lay.h1.top && lay.h1.bottom <= lay.steps.top, JSON.stringify(lay));
      const what = one(await page.locator('[data-tour="install-what"]').innerText());
      check("(a) one short line says what Nosca is: a coaching app — lessons, video, drills", /coaching app/.test(what) && /lessons/.test(what) && /video/.test(what) && /drills/.test(what) && what.length <= 60 && !/!/.test(what), what);
      /* only this device's steps: every other device is behind one quiet row */
      const d0 = await device(page);
      check("(a) only this device's steps: one quiet row names the device and offers Change; no platform or version control until it is tapped",
        /^Computer · Chrome or Edge/.test(d0) && /Change$/.test(d0) && (await page.locator('[data-tour="install-platform"]').count()) === 0 && (await page.locator('[data-tour="install-version"]').count()) === 0 && (await page.locator('[data-tour="install-hint"]').count()) === 0, d0);
      const s0 = await steps(page), w0 = await words(page), a0 = await alts(page), p0 = await pictures(page);
      check("(a) a computer's Chrome reads the install icon at the right of the address bar — Chrome's and Edge's drawn side by side — then Install", s0.length === 2 && w0[0] === "Click the install icon" && /address bar/.test(a0[0]) && /Chrome/.test(a0[0]) && /Edge/.test(a0[0]) && p0[0].taps === 2 && w0[1] === "Click Install" && /Install/.test(s0[1]), s0.join(" | "));
      check("(a) three platforms behind Change, opened on Computer for a desktop browser", (await pressed(page)) === "Computer" && (await page.locator('[data-tour="install-platform"] button').count()) === 3 && /Done$/.test(await device(page)), await pressed(page));
      await pick(page, "iPhone"); const s1 = await steps(page), w1 = await words(page), a1 = await alts(page), p1 = await pictures(page);
      check("(a) iPhone opens on the newest, iOS 27: the three lines, Share, View More, Add to Home Screen, Add with Open as Web App left on, then Nosca on the Home Screen and sign in once",
        (await pressed(page, "version")) === "iOS 27" && s1.length === 6 && w1[0] === "Tap the three lines" && /left of the address bar/.test(a1[0]) && w1[1] === "Tap Share" && w1[2] === "Tap View More"
        && w1[3] === "Tap Add to Home Screen" && w1[4] === "Tap Add" && /Open as Web App stays on/.test(s1[4]) && /Open as Web App/.test(a1[4]) && w1[5] === "Tap Nosca" && /Home Screen/.test(s1[5]) && /Sign in once/.test(s1[5])
        && /iOS Version/.test(one(await page.locator('[data-tour="install-hint"]').innerText())), s1.join(" | "));
      check("(a) where Safari can show either control, both are drawn side by side in the one step: the three lines in the address bar, or Share on the toolbar", p1[0].taps === 2 && /Or Share/.test(a1[0]), JSON.stringify(p1[0]));
      await pick(page, "iOS 26", "version"); const s26 = await steps(page), w26 = await words(page), a26 = await alts(page), p26 = await pictures(page);
      check("(a) iOS 26: the three dots at the right of the address bar — or Share — then the same five steps", s26.length === 6 && w26[0] === "Tap the three dots" && /right of the address bar/.test(a26[0]) && p26[0].taps === 2 && w26.slice(1).join("|") === w1.slice(1).join("|") && /^iPhone · iOS 26/.test(await device(page)), s26.join(" | "));
      await pick(page, "Earlier", "version"); const s1b = await steps(page), w1b = await words(page), a1b = await alts(page);
      check("(a) iOS 18 or earlier: Share on Safari's toolbar, Add to Home Screen further down, Add, then Nosca on the Home Screen",
        s1b.length === 4 && w1b[0] === "Tap Share" && /toolbar/.test(a1b[0]) && w1b[1] === "Tap Add to Home Screen" && /Scroll down/.test(s1b[1]) && w1b[2] === "Tap Add" && w1b[3] === "Tap Nosca" && /Sign in once/.test(s1b[3]) && /^iPhone · iOS 18 or earlier/.test(await device(page)), s1b.join(" | "));
      await pick(page, "Android"); const s2 = await steps(page), w2 = await words(page), a2 = await alts(page);
      check("(a) Android in Chrome: the three dots, Add to Home screen (Install app on some phones), Install rather than a shortcut, then Nosca on the Home screen",
        s2.length === 4 && w2[0] === "Tap the three dots" && /top right/.test(a2[0]) && w2[1] === "Tap Add to Home screen" && /Install app/.test(s2[1]) && w2[2] === "Tap Install" && /Create shortcut/.test(s2[2]) && w2[3] === "Tap Nosca" && !/Sign in/.test(s2[3]), s2.join(" | "));
      /* a step is a numeral, a few words and a picture: every platform and version, one after another */
      const bad = [];
      for (const [plat, subs] of [["iPhone", ["iOS 27", "iOS 26", "Earlier"]], ["Android", ["Chrome", "Samsung"]], ["Computer", ["Chrome or Edge", "Safari"]]]) {
        await pick(page, plat);
        for (const sub of subs) {
          await pick(page, sub, "version");
          const ws = await words(page), ps = await pictures(page), all = await steps(page);
          ps.forEach((p, i) => {
            if (p.n !== String(i + 1)) bad.push(`${sub} ${i + 1}: numeral "${p.n}"`);
            if (p.role !== "img" || p.alt.length < 3) bad.push(`${sub} ${i + 1}: the picture says nothing to a screen reader`);
            if (p.taps < 1) bad.push(`${sub} ${i + 1}: nothing ringed to tap`);
            if (!ws[i] || ws[i].split(" ").length > 6) bad.push(`${sub} ${i + 1}: "${ws[i]}" is not a few words`);
            if (SYMBOLS.test(all[i].replace(/Add to Dock…/, ""))) bad.push(`${sub} ${i + 1}: a symbol typed into "${all[i]}"`);
          });
          if (ps.length !== ws.length || ps.length < 2) bad.push(`${sub}: ${ps.length} pictures for ${ws.length} steps`);
        }
      }
      check("(a) every step, on every device, is a numeral, six words at most and a drawn picture with the thing to tap ringed — and no symbol is typed into a sentence", bad.length === 0, bad.join("; "));
      const small = await page.evaluate(() => Array.from(document.querySelectorAll("#root *"))
        .filter((el) => !el.children.length && el.textContent.trim() && el.dataset.tour !== "wordmark" && parseFloat(getComputedStyle(el).fontSize) < 12)
        .map((el) => `${el.textContent.trim().slice(0, 24)} @ ${getComputedStyle(el).fontSize}`));
      check("(a) nothing on the page under 12px, bar the wordmark", small.length === 0, small.join(", "));
      /* the gold is a line's and a detail's; where it is read — a numeral, Change — it measures 4.5:1 on the paper */
      const gold = await page.evaluate(() => {
        const num = document.querySelector("[data-ins-num]"), dev = document.querySelector('[data-tour="install-device"]');
        const act = dev ? dev.lastElementChild : null, pg = document.querySelector('[data-tour="install-page"]');
        const key = document.querySelector('[data-tour="install-open"]'), whatEl = document.querySelector('[data-tour="install-what"]');
        const c = (el, p = "color") => (el ? getComputedStyle(el)[p] : "");
        return { num: c(num), act: c(act), page: c(pg, "backgroundColor"), key: c(key, "backgroundColor"), keyWord: c(key), what: c(whatEl) };
      });
      const rNum = ratio(gold.num, gold.page), rAct = ratio(gold.act, gold.page), rKey = ratio(gold.keyWord, gold.key), rWhat = ratio(gold.what, gold.page);
      check("(a) contrast, computed: the gold numerals and the gold Done 4.5:1 and over on the white page, the line of what Nosca is and the key's word too",
        gold.page === "rgb(255, 255, 255)" && gold.num === "rgb(142, 110, 38)" && rNum >= 4.5 && rAct >= 4.5 && rKey >= 4.5 && rWhat >= 4.5, `numeral ${rNum.toFixed(2)} · action ${rAct.toFixed(2)} · key ${rKey.toFixed(2)} · line ${rWhat.toFixed(2)} · ${JSON.stringify(gold)}`);
      /* the new controls answer a finger 44 tall */
      const hits = await page.evaluate(() => ["install-device", "install-close", "install-about", "install-open"].map((n) => { const el = document.querySelector(`[data-tour="${n}"]`); const r = el ? el.getBoundingClientRect() : { width: 0, height: 0 }; return [n, Math.round(r.width), Math.round(r.height)]; }));
      check("(a) Change, the X, Open Nosca and About Nosca are each 44 to a finger", hits.every(([, w, h]) => w >= 44 && h >= 44), JSON.stringify(hits));
      await shot("a-install-computer");
      /* the website, for somebody who has only the card */
      await page.evaluate(() => { window.__opened = []; window.open = (u, target) => { window.__opened.push([u, target]); return null; }; });
      await M.tap(page, '[data-tour="install-about"]', 400);
      const aboutOpened = await page.evaluate(() => window.__opened);
      check("(a) About Nosca, a quiet line under the key, opens /about/ beside the page and the guide stays", /About Nosca/.test(await page.locator('[data-tour="install-about"]').innerText()) && aboutOpened.length === 1 && aboutOpened[0][0] === "/about/" && aboutOpened[0][1] === "_blank" && (await page.locator('[data-tour="install-steps"]').count()) === 1, JSON.stringify(aboutOpened));
      await M.tap(page, '[data-tour="install-open"]', 300); await page.waitForLoadState("networkidle"); await page.waitForTimeout(900);
      const t2 = await text();
      check("(a) Open Nosca lands on sign-up", /Create account/.test(t2) && /Sign in/.test(t2) && new URL(page.url()).pathname === "/", `${page.url()} · ${t2.slice(0, 80)}`);
      /* the front door carries the way to the company's website too, before an account exists */
      await page.evaluate(() => { window.__opened = []; window.open = (u, target) => { window.__opened.push([u, target]); return null; }; });
      const doorAbout = page.locator('[data-tour="auth-about"]');
      const doorBox = (await doorAbout.count()) ? await doorAbout.first().boundingBox() : null;
      if (await doorAbout.count()) { await doorAbout.first().dispatchEvent("click"); await page.waitForTimeout(400); }
      const doorOpened = await page.evaluate(() => window.__opened);
      check("(a2) the sign-in page carries About Nosca under its two keys, 44 to a finger, and it opens /about/ beside the app", !!doorBox && doorBox.height >= 44 && doorOpened.length === 1 && doorOpened[0][0] === "/about/" && /Create account/.test(await M.rootText(page)), JSON.stringify({ doorBox, doorOpened }));
      await ctx.close();
    }

    /* ---------- (b) an iPhone in Safari ---------- */
    {
      /* a real iOS 17 Safari (Playwright's iPhone profile reports Version/26) */
      const { ctx, page } = await boot({ device: "iPhone 13", ua: IOS17 });
      await guide(page);
      const d = await device(page), w = await words(page), a = await alts(page);
      check("(b) an older iPhone opens on its own platform and version: Share on Safari's toolbar", /^iPhone · iOS 18 or earlier/.test(d) && w[0] === "Tap Share" && /Safari's toolbar/.test(a[0]) && (await pressed(page)) === "iPhone" && (await pressed(page, "version")) === "Earlier", `${d} | ${w[0]} | ${a[0]}`);
      check("(b) no Install button on an iPhone — Safari never offers one", (await page.locator('[data-tour="install-now"]').count()) === 0);
      await ctx.close();
    }

    /* ---------- (c) Android Chrome, which offers to install ---------- */
    {
      const { ctx, page, text, shot } = await boot({ device: "Pixel 5", init: () => {
        window.__prompted = 0;
        window.addEventListener("load", () => setTimeout(() => {
          const e = new Event("beforeinstallprompt");
          e.prompt = () => { window.__prompted++; return Promise.resolve(); };
          e.userChoice = Promise.resolve({ outcome: "accepted" });
          window.dispatchEvent(e);
        }, 300));
      } });
      await guide(page); await page.waitForTimeout(600);
      check("(c) an Android phone opens on Android", /^Android · Chrome/.test(await device(page)) && (await page.locator('[data-tour="install-platform"]').count()) === 0, await device(page));
      const btn = page.locator('[data-tour="install-now"]');
      check("(c) a Chrome that offers to install leads with one button, Install Nosca, the steps under it as Or by hand", (await btn.count()) === 1 && /Install Nosca/.test(await btn.innerText()) && /Or by hand/.test(await text()) && (await steps(page)).length === 4, (await text()).slice(0, 220));
      await shot("c-android-offer");
      await btn.click(); await page.waitForTimeout(700);
      const prompted = await page.evaluate(() => window.__prompted);
      check("(c) the button opens the browser's own sheet, and accepted reads Nosca is on your Home Screen", prompted === 1 && (await page.locator('[data-tour="install-done"]').count()) === 1 && /Nosca is on your Home Screen/.test(await text()) && (await page.locator('[data-tour="install-steps"]').count()) === 0 && (await page.locator('[data-tour="install-device"]').count()) === 0, `prompted ${prompted} · ${(await text()).slice(0, 120)}`);
      await shot("c-android-installed");
      await ctx.close();
    }

    /* ---------- (d) Samsung Internet ---------- */
    {
      const { ctx, page } = await boot({ ua: SAMSUNG });
      await guide(page);
      const d = await device(page), s = await steps(page), w = await words(page), a = await alts(page);
      check("(d) Samsung Internet opens on Samsung: the three lines bottom right, Add page to, Home screen, Add, then Nosca on the Home screen", /^Android · Samsung Internet/.test(d) && s.length === 5 && w[0] === "Tap the three lines" && /bottom right/.test(a[0]) && w[1] === "Tap Add page to" && w[2] === "Tap Home screen" && w[3] === "Tap Add" && w[4] === "Tap Nosca" && (await pressed(page)) === "Android" && (await pressed(page, "version")) === "Samsung", `${d} | ${s.join(" | ")}`);
      await ctx.close();
    }

    /* ---------- (b2) iOS 26 Safari: the OS reads 18_6 in its user agent, Version/26 is the truth ---------- */
    {
      const { ctx, page } = await boot({ ua: IOS26 });
      await guide(page);
      const w = await words(page);
      check("(b2) an iOS 26 iPhone opens on iOS 26, whose first step is the three dots", /^iPhone · iOS 26/.test(await device(page)) && w[0] === "Tap the three dots" && w.length === 6, w.join(" | "));
      await M.tap(page, '[data-tour="install-close"]', 300); await page.waitForLoadState("networkidle"); await page.waitForTimeout(900);
      check("(k) the X leaves the guide for the app: sign-up for a stranger", new URL(page.url()).pathname === "/" && /Create account/.test(await M.rootText(page)), page.url());
      await ctx.close();
    }

    /* ---------- (b3) iOS 27 Safari — the founder's phone: three lines, never three dots ---------- */
    {
      const { ctx, page, shot } = await boot({ ua: IOS27 });
      await guide(page);
      const d = await device(page), s = await steps(page), w = await words(page), a = await alts(page);
      check("(b3) an iOS 27 iPhone opens on iOS 27: the three lines at the left of the address bar — the Page Menu — and no step says three dots",
        /^iPhone · iOS 27/.test(d) && w[0] === "Tap the three lines" && /Three lines at the left of the address bar/.test(a[0]) && !s.some((x) => /three dots/i.test(x)) && !a.some((x) => /three dots/i.test(x)) && w.length === 6, `${d} | ${s.join(" | ")}`);
      check("(b3) …with no platform, version or hint above the steps, and the first step on the first screen", (await page.locator('[data-tour="install-platform"], [data-tour="install-version"], [data-tour="install-hint"]').count()) === 0
        && (await page.evaluate(() => { const r = document.querySelector("[data-ins-step]").getBoundingClientRect(); return r.top > 0 && r.bottom <= window.innerHeight; })));
      await shot("b3-ios27");
      await ctx.close();
    }

    /* ---------- (e) signed in: still the guide; Open Nosca is the app ---------- */
    {
      const { ctx, page, text } = await boot({ session: userOf("adult") });
      await guide(page);
      check("(e) /install while signed in is still the guide", /Add to Home Screen/.test(await text()) && (await page.locator('[data-tour="install-steps"]').count()) === 1 && (await page.locator('[data-tour="install-card"]').count()) === 1 && (await page.locator('[aria-label="Diary"]').count()) === 0, (await text()).slice(0, 120));
      await M.tap(page, '[data-tour="install-open"]', 300); await page.waitForLoadState("networkidle"); await M.settle(page);
      const t = await text();
      check("(e) Open Nosca opens the app for a member", (await page.locator('[aria-label="Diary"]').count()) === 1 && !/Create account/.test(t), t.slice(0, 160));
      await ctx.close();
    }

    /* ---------- (f) Settings › Add to Home Screen, in a browser tab ---------- */
    {
      const { ctx, page, text, shot } = await boot({ session: userOf("coach") });
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await openSettings(page);
      const row = page.locator('[data-tour="settings-install"]');
      check("(f) Settings carries Add to Home Screen in a browser tab, beside Walkthrough", (await row.count()) === 1 && /Add to Home Screen/.test(await row.innerText()) && (await page.locator('[data-tour="settings-tour"]').count()) === 1, await row.count());
      const search = page.locator('input[aria-label="Search settings"]').first();
      if (await search.count()) {
        await search.fill("phone"); await page.waitForTimeout(500);
        check("(f) the search finds it by \"phone\"", (await page.locator('[data-tour="settings-install"]').count()) === 1 && (await page.locator('[data-tour="settings-tour"]').count()) === 0, (await text()).slice(0, 120));
        await search.fill(""); await page.waitForTimeout(400);
      } else check("(f) the search finds it by \"phone\"", false, "no search field found");
      /* ABOUT NOSCA (23 November): the company's website is a row of Settings, found by "about" or "website", and it
         opens /about/ beside the app — the founder: "a button that is easily findable … that says about on it" */
      const about = page.locator('[data-tour="settings-about"]');
      check("(f2) Settings carries About Nosca, leading Support", (await about.count()) === 1 && /About Nosca/.test(await about.innerText()), await about.count());
      if (await search.count()) {
        await search.fill("website"); await page.waitForTimeout(500);
        check("(f2) the search finds it by \"website\"", (await page.locator('[data-tour="settings-about"]').count()) === 1 && (await page.locator('[data-tour="settings-tour"]').count()) === 0, (await text()).slice(0, 120));
        await search.fill(""); await page.waitForTimeout(400);
      }
      await page.evaluate(() => { window.__opened = []; window.open = (u, target) => { window.__opened.push([u, target]); return null; }; });
      await page.locator('[data-tour="settings-about"]').first().dispatchEvent("click"); await page.waitForTimeout(500);
      const opened = await page.evaluate(() => window.__opened);
      check("(f2) the row opens the website at /about/ beside the app, and the app stays where it was", opened.length === 1 && opened[0][0] === "/about/" && opened[0][1] === "_blank" && (await page.locator('[data-tour="settings-about"]').count()) === 1, JSON.stringify(opened));
      await page.locator('[data-tour="settings-install"]').first().dispatchEvent("click"); await page.waitForTimeout(1300);
      const t = await text();
      check("(f) the row opens the guide as a screen titled Add to Home Screen", /^Add to Home Screen/.test(t.replace(/^.*?Add to Home Screen/, "Add to Home Screen")) && (await page.locator('[data-tour="install-steps"]').count()) === 1 && (await page.locator('[data-tour="install-device"]').count()) === 1 && (await page.locator('[aria-label="Back"]').count()) === 1, t.slice(0, 160));
      /* one guide, two dresses: inside the app it is the app's own page — no card, no gold — with the same pictures and words */
      const dress = await page.evaluate(() => {
        const num = document.querySelector("[data-ins-num]"), dev = document.querySelector('[data-tour="install-device"]'), tap = document.querySelector("[data-ins-tap]");
        return { card: document.querySelectorAll('[data-tour="install-card"], [data-tour="install-what"], [data-tour="install-about"]').length, num: num ? getComputedStyle(num).color : "", act: dev && dev.lastElementChild ? getComputedStyle(dev.lastElementChild).color : "", ring: tap ? getComputedStyle(tap).boxShadow : "" };
      });
      const wApp = await words(page), pApp = await pictures(page);
      check("(f) inside the app the guide is the app's own page: no card and no gold — the numerals in the ink, Change and the ring in the sport's colour — over the same steps and pictures",
        dress.card === 0 && dress.num === "rgb(28, 28, 30)" && dress.act !== "rgb(142, 110, 38)" && !/154, 123, 43/.test(dress.ring) && dress.ring.includes(dress.act) && wApp.length === 2 && wApp[0] === "Click the install icon" && pApp.every((p) => p.taps >= 1 && p.role === "img"), JSON.stringify(dress));
      await pick(page, "iPhone");
      check("(f) …and Change works there as it does on the page: iPhone, the newest iOS, six steps", (await pressed(page, "version")) === "iOS 27" && (await words(page)).length === 6 && /^iPhone · iOS 27/.test(await device(page)), await device(page));
      await shot("f-settings-install");
      await M.back(page);
      check("(f) Back returns to Settings", (await page.locator('[data-tour="settings-install"]').count()) === 1 && (await page.locator('[data-tour="install-steps"]').count()) === 0);
      await ctx.close();
    }

    /* ---------- (g) on a Home Screen already: no row ---------- */
    {
      const { ctx, page } = await boot({ session: userOf("coach"), init: () => { Object.defineProperty(navigator, "standalone", { get: () => true, configurable: true }); } });
      await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
      await openSettings(page);
      check("(g) once the app runs from a Home Screen the row is not there, and Walkthrough still is", (await page.locator('[data-tour="settings-install"]').count()) === 0 && (await page.locator('[data-tour="settings-tour"]').count()) === 1);
      await ctx.close();
    }

    /* ---------- (h) the arrival screen's line ---------- */
    {
      const { ctx, page, text, shot } = await boot({ session: userOf("adult"), init: () => { try { sessionStorage.setItem("nosca.arrival", "player"); } catch (e) { /* private mode */ } } });
      await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(2500);
      const t = await text();
      const line = page.locator('[data-tour="arrival-install"]');
      check("(h) the arrival screen offers Add Nosca to your Home Screen, with Show me around and Skip", (await line.count()) === 1 && /Add Nosca to your Home Screen/.test(t) && /Show me around/.test(t) && /Skip/.test(t), t.slice(0, 200));
      const yLine = (await line.boundingBox() || {}).y, yBtn = (await page.getByRole("button", { name: "Show me around" }).boundingBox() || {}).y;
      check("(h) …as a quiet line above Show me around", yLine != null && yBtn != null && yLine < yBtn, `${yLine} ${yBtn}`);
      await shot("h-arrival");
      await line.dispatchEvent("click"); await M.settle(page);
      const t2 = await text();
      check("(h) the app opens on the guide, Home under it", (await page.locator('[data-tour="install-steps"]').count()) === 1 && /Add to Home Screen/.test(t2) && (await page.locator('[aria-label="Back"]').count()) === 1, t2.slice(0, 160));
      check("(h) the hand-off is consumed", (await page.evaluate(() => sessionStorage.getItem("nosca.install.now"))) === null);
      await M.back(page); await page.waitForTimeout(600);
      check("(h) Back is Home", (await page.locator('[aria-label="Diary"]').count()) === 1 && (await page.locator('[data-tour="install-steps"]').count()) === 0);
      await ctx.close();
    }

    /* ---------- (i) 320 ---------- */
    {
      const { ctx, page, shot } = await boot({ width: 320, ua: IOS27 });
      await guide(page);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await choices(page);
      const cut = await page.evaluate(() => Array.from(document.querySelectorAll('[data-tour="install-platform"] button, [data-tour="install-version"] button')).filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
      check("(i) nothing cut at 320: no sideways scroll, every platform's and every version's name whole", over <= 0 && cut.length === 0, `over ${over} cut ${cut.join(",")}`);
      /* every picture inside its panel, every ringed key inside its picture, on every device */
      const spill = [];
      for (const [plat, subs] of [["iPhone", ["iOS 27", "iOS 26", "Earlier"]], ["Android", ["Chrome", "Samsung"]], ["Computer", ["Chrome or Edge", "Safari"]]]) {
        await pick(page, plat);
        for (const sub of subs) {
          await pick(page, sub, "version");
          const out = await page.evaluate(() => {
            const bad = [], vw = window.innerWidth;
            document.querySelectorAll("[data-ins-pic]").forEach((pic, i) => {
              const r = pic.getBoundingClientRect();
              if (pic.scrollWidth > pic.clientWidth + 1) bad.push(`picture ${i + 1} runs ${pic.scrollWidth - pic.clientWidth}px over`);
              if (r.right > vw + 0.5 || r.left < 0) bad.push(`picture ${i + 1} off the screen`);
              pic.querySelectorAll("[data-ins-tap]").forEach((k) => { const q = k.getBoundingClientRect(); if (q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.bottom > r.bottom + 0.5 || q.top < r.top - 0.5) bad.push(`a key leaves picture ${i + 1}`); });
            });
            document.querySelectorAll("[data-ins-text]").forEach((el, i) => { if (el.scrollWidth > el.clientWidth + 1) bad.push(`step ${i + 1}'s words are cut`); });
            return bad;
          });
          out.forEach((x) => spill.push(`${sub}: ${x}`));
        }
      }
      const cardBox = await page.evaluate(() => { const r = document.querySelector('[data-tour="install-card"]').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), window.innerWidth]; });
      check("(i) at 320 every picture sits inside its panel with its keys whole, every step's words whole, on all seven sets of steps, and the card inside the screen", spill.length === 0 && cardBox[0] >= 0 && cardBox[1] <= cardBox[2], `${spill.join("; ")} card ${cardBox.join(",")}`);
      await shot("i-320");
      await ctx.close();
    }

    /* ---------- (j) Reduce Motion: the page is whole at once ---------- */
    {
      const still = async (page) => {
        await page.goto(`${BASE}/install`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-tour="install-steps"]'); await page.waitForTimeout(150);
        return page.evaluate(() => {
          const op = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
          const stepsEls = Array.from(document.querySelectorAll("[data-ins-step]"));
          const card = document.querySelector('[data-tour="install-card"]'), flip = card.children[1];
          const stripes = Array.from(card.querySelectorAll("svg path")).map((el) => parseFloat(getComputedStyle(el).strokeDashoffset) || 0);
          return { running: document.getAnimations().filter((a) => a.playState === "running" || a.pending).length, faint: stepsEls.filter((el) => op(el) < 0.999).length, steps: stepsEls.length,
                   turn: getComputedStyle(flip).transform, undrawn: stripes.filter((v) => v > 0.001).length, h1: op(document.querySelector("h1")), word: op(card.querySelector('[data-tour="wordmark"]')) };
        });
      };
      const a = await boot({ ua: IOS27, reduce: true });
      const sys = await still(a.page); await a.shot("j-reduce-motion"); await a.ctx.close();
      check("(j) under the phone's Reduce Motion the page is whole 150ms in: nothing running, the card on its green side with every stripe drawn, every step there", sys.running === 0 && sys.faint === 0 && sys.steps === 6 && (sys.turn === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(sys.turn)) && sys.undrawn === 0 && sys.h1 === 1 && sys.word === 1, JSON.stringify(sys));
      const b = await boot({ ua: IOS27, init: () => { try { localStorage.setItem("nosca.ui.reduceMotion", "true"); } catch (e) { /* private mode */ } } });
      const own = await still(b.page); await b.ctx.close();
      check("(j) …and under the app's own Reduce motion switch (.calm) the same", own.running === 0 && own.faint === 0 && own.steps === 6 && (own.turn === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(own.turn)) && own.undrawn === 0 && own.h1 === 1, JSON.stringify(own));
      /* and with motion: the arrival is brief, and what it leaves is each element's own style (fill-mode backwards, never both) */
      const c = await boot({ ua: IOS27 });
      await c.page.goto(`${BASE}/install`, { waitUntil: "domcontentloaded" });
      await c.page.waitForSelector('[data-tour="install-steps"]');
      const moving = await c.page.evaluate(() => { const an = document.getAnimations(); return { n: an.length, fills: Array.from(new Set(an.map((x) => x.effect.getComputedTiming().fill))), longest: Math.max(...an.map((x) => { const tm = x.effect.getComputedTiming(); return tm.delay + tm.duration; })) }; });
      await c.page.waitForTimeout(2600);
      const after = await c.page.evaluate(() => ({ running: document.getAnimations().filter((x) => x.playState === "running").length, faint: Array.from(document.querySelectorAll("[data-ins-step]")).filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).length }));
      await c.ctx.close();
      check("(j) with motion the arrival is brief — the card turns over, the foil draws, the steps rise in their turn, all over inside 2.4s — and every animation fills backwards", moving.n > 20 && moving.fills.length === 1 && moving.fills[0] === "backwards" && moving.longest <= 2400 && after.running === 0 && after.faint === 0, JSON.stringify({ moving, after }));
    }

    check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
