/* ADD TO HOME SCREEN. The guide that puts Nosca on a phone — the page
   the business card's second QR code opens (/install), the Settings row
   and the arrival screen's line. This suite proves: /install with no
   account is the guide and not sign-up, three platforms on the
   Segmented opened on the device it is read on, the steps changing with
   the platform and the browser (Safari's Share, Chrome's three dots,
   Samsung's three lines), a Chrome that offers to install getting one
   Install Nosca button that opens the browser's own sheet, Open Nosca
   landing on sign-up for a stranger and on the app for a member, the
   Settings row opening the same guide and gone once the app runs from a
   Home Screen, the arrival screen's line opening the guide with Home
   under it, nothing under 12px, and nothing cut at 320.
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
const IGNORED = /Failed to load resource|Blocked call to navigator\.vibrate/;

const { check, results, summary } = M.checker("install");
const pressed = (page) => page.locator('[data-tour="install-platform"] button[aria-pressed="true"]').first().getAttribute("aria-label");
const pick = (page, label) => M.tap(page, `[data-tour="install-platform"] [aria-label="${label}"]`, 500);
const steps = (page) => page.locator('[data-tour="install-steps"] > *').allInnerTexts();
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
  const boot = async ({ device, ua, session, init, width = 390 } = {}) => {
    const base = device ? devices[device] : { viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
    const ctx = await browser.newContext({ ...base, ...(ua ? { userAgent: ua } : {}) });
    const page = await ctx.newPage(); await M.attach(page, db);
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (m) => { if (m.type() === "error" && !IGNORED.test(m.text())) errors.push("console: " + m.text()); });
    if (init) await page.addInitScript(init);
    if (session) await M.injectSession(page, M.session(session, db));
    return { ctx, page, text: () => M.rootText(page), shot: (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) }) };
  };
  const guide = async (page) => { await page.goto(`${BASE}/install`, { waitUntil: "networkidle" }); await page.waitForTimeout(900); };

  try {
    /* ---------- (a) a stranger on a computer ---------- */
    {
      const { ctx, page, text, shot } = await boot();
      await guide(page);
      const t = await text();
      check("(a) /install with no account is the guide, not sign-up", /Add to Home Screen/.test(t) && !/Create account/.test(t) && (await page.locator('[data-tour="install-platform"]').count()) === 1, t.slice(0, 200));
      check("(a) three platforms, opened on Computer for a desktop browser", (await page.locator('[data-tour="install-platform"] button').count()) === 3 && (await pressed(page)) === "Computer", await pressed(page));
      const s0 = await steps(page);
      check("(a) a computer's Chrome reads the install icon at the right of the address bar", s0.length === 2 && /install icon/.test(s0[0]) && /address bar/.test(s0[0]) && /Click Install/.test(s0[1]), s0.join(" | "));
      await pick(page, "iPhone"); const s1 = await steps(page);
      check("(a) iPhone opens on iOS 26: ⋯, Share, Add to Home Screen, Open as Web App and Add, then open it and sign in once", (await page.locator('[data-tour="install-version"] button[aria-pressed="true"]').getAttribute("aria-label")) === "iOS 26" && s1.length === 5 && /Tap ⋯/.test(s1[0]) && /three lines/.test(s1[0]) && /Tap Share/.test(s1[1]) && /Add to Home Screen/.test(s1[2]) && /View More/.test(s1[2]) && /Open as Web App/.test(s1[3]) && /Sign in there once/.test(s1[4]) && /iOS Version/.test(await text()), s1.join(" | "));
      await M.tap(page, '[data-tour="install-version"] [aria-label="iOS 18 or earlier"]', 500); const s1b = await steps(page);
      check("(a) iOS 18 or earlier: Share in Safari's bar, Add to Home Screen, Add, open it", s1b.length === 4 && /Tap Share/.test(s1b[0]) && /Add to Home Screen/.test(s1b[1]) && /Tap Add/.test(s1b[2]) && /Open Nosca/.test(s1b[3]), s1b.join(" | "));
      await pick(page, "Android"); const s2 = await steps(page);
      check("(a) Android in Chrome: ⋮, Add to home screen, Install rather than a shortcut, open it", s2.length === 4 && /Three dots/.test(s2[0]) && /Add to home screen/.test(s2[1]) && /Tap Install/.test(s2[2]) && /Create shortcut/.test(s2[2]) && /Open Nosca/.test(s2[3]), s2.join(" | "));
      const small = await page.evaluate(() => Array.from(document.querySelectorAll("#root *"))
        .filter((el) => !el.children.length && el.textContent.trim() && el.dataset.tour !== "wordmark" && parseFloat(getComputedStyle(el).fontSize) < 12)
        .map((el) => `${el.textContent.trim().slice(0, 24)} @ ${getComputedStyle(el).fontSize}`));
      check("(a) nothing on the page under 12px, bar the wordmark", small.length === 0, small.join(", "));
      await shot("a-install-computer");
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
      const { ctx, page } = await boot({ device: "iPhone 13", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
      await guide(page);
      const s = await steps(page);
      check("(b) an older iPhone opens on its own platform and version: Share at the foot of Safari", (await pressed(page)) === "iPhone" && (await page.locator('[data-tour="install-version"] button[aria-pressed="true"]').getAttribute("aria-label")) === "iOS 18 or earlier" && /foot of Safari/.test(s[0]) && /iPad/.test(s[0]), `${await pressed(page)} | ${s[0]}`);
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
      check("(c) an Android phone opens on Android", (await pressed(page)) === "Android", await pressed(page));
      const btn = page.locator('[data-tour="install-now"]');
      check("(c) a Chrome that offers to install leads with one button, Install Nosca, the steps under it as Or by hand", (await btn.count()) === 1 && /Install Nosca/.test(await btn.innerText()) && /Or by hand/.test(await text()) && (await steps(page)).length === 4, (await text()).slice(0, 220));
      await shot("c-android-offer");
      await btn.click(); await page.waitForTimeout(700);
      const prompted = await page.evaluate(() => window.__prompted);
      check("(c) the button opens the browser's own sheet, and accepted reads Nosca is on your Home Screen", prompted === 1 && (await page.locator('[data-tour="install-done"]').count()) === 1 && /Nosca is on your Home Screen/.test(await text()) && (await page.locator('[data-tour="install-steps"]').count()) === 0, `prompted ${prompted} · ${(await text()).slice(0, 120)}`);
      await ctx.close();
    }

    /* ---------- (d) Samsung Internet ---------- */
    {
      const { ctx, page } = await boot({ ua: SAMSUNG });
      await guide(page);
      const s = await steps(page);
      check("(d) Samsung Internet opens on Samsung: ☰, Add page to, Home screen, Add, open it", (await pressed(page)) === "Android" && (await page.locator('[data-tour="install-version"] button[aria-pressed="true"]').getAttribute("aria-label")) === "Samsung" && s.length === 5 && /Three lines/.test(s[0]) && /Add page to/.test(s[1]) && /Home screen/.test(s[2]) && /Tap Add/.test(s[3]), s.join(" | "));
      await ctx.close();
    }

    /* ---------- (b2) iOS 26 Safari: the OS reads 18_6 in its user agent, Version/26 is the truth ---------- */
    {
      const { ctx, page } = await boot({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" });
      await guide(page);
      check("(b2) an iOS 26 iPhone opens on iOS 26, whose first step is ⋯", (await page.locator('[data-tour="install-version"] button[aria-pressed="true"]').getAttribute("aria-label")) === "iOS 26" && /Tap ⋯/.test((await steps(page))[0]));
      await M.tap(page, '[data-tour="install-close"]', 300); await page.waitForLoadState("networkidle"); await page.waitForTimeout(900);
      check("(k) the X leaves the guide for the app: sign-up for a stranger", new URL(page.url()).pathname === "/" && /Create account/.test(await M.rootText(page)), page.url());
      await ctx.close();
    }

    /* ---------- (e) signed in: still the guide; Open Nosca is the app ---------- */
    {
      const { ctx, page, text } = await boot({ session: userOf("adult") });
      await guide(page);
      check("(e) /install while signed in is still the guide", /Add to Home Screen/.test(await text()) && (await page.locator('[data-tour="install-platform"]').count()) === 1 && (await page.locator('[aria-label="Diary"]').count()) === 0, (await text()).slice(0, 120));
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
      await page.locator('[data-tour="settings-install"]').first().dispatchEvent("click"); await page.waitForTimeout(900);
      const t = await text();
      check("(f) the row opens the guide as a screen titled Add to Home Screen", /^Add to Home Screen/.test(t.replace(/^.*?Add to Home Screen/, "Add to Home Screen")) && (await page.locator('[data-tour="install-platform"]').count()) === 1 && (await page.locator('[aria-label="Back"]').count()) === 1, t.slice(0, 160));
      await shot("f-settings-install");
      await M.back(page);
      check("(f) Back returns to Settings", (await page.locator('[data-tour="settings-install"]').count()) === 1 && (await page.locator('[data-tour="install-platform"]').count()) === 0);
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
      check("(h) the app opens on the guide, Home under it", (await page.locator('[data-tour="install-platform"]').count()) === 1 && /Add to Home Screen/.test(t2) && (await page.locator('[aria-label="Back"]').count()) === 1, t2.slice(0, 160));
      check("(h) the hand-off is consumed", (await page.evaluate(() => sessionStorage.getItem("nosca.install.now"))) === null);
      await M.back(page); await page.waitForTimeout(600);
      check("(h) Back is Home", (await page.locator('[aria-label="Diary"]').count()) === 1 && (await page.locator('[data-tour="install-platform"]').count()) === 0);
      await ctx.close();
    }

    /* ---------- (i) 320 ---------- */
    {
      const { ctx, page, shot } = await boot({ width: 320 });
      await guide(page);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const cut = await page.evaluate(() => Array.from(document.querySelectorAll('[data-tour="install-platform"] button')).filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
      check("(i) nothing cut at 320: no sideways scroll, every platform's name whole", over <= 0 && cut.length === 0, `over ${over} cut ${cut.join(",")}`);
      await shot("i-320");
      await ctx.close();
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
