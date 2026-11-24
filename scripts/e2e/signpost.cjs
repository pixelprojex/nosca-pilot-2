/* THE SIGNPOST. The business cards are printed, and the code on them
   opens the site's first address — nosca-pilot-2.netlify.app/install —
   for good. The app lives at nosca.netlify.app now, so the first
   address is a signpost: index.html sends whatever page of it is
   opened to the same page of the app's own address, before the app
   loads. This plays a scanned card. The built page is served under
   the old host's name (the browser's requests for that host are
   answered from the local build), and the new host answers with a
   page that only says where it was reached — so what is checked is
   where a phone ends up, not what a string in a file says.

   The hop is made only once the new address WORKS: the old page first
   asks it for /ready.png, a picture only a build given its database
   writes (vite.config.js), and anything but a picture — a build made
   without its Supabase settings (whose app is a blank page: the new
   site went public that way on 24 November and every scanned card was
   sent to it), a login wall in front of the site (Netlify's site
   protection, which the new site had on the day of the move), the site
   down, no network — leaves the person on the old address, which still
   carries the whole app. So the new host is played four ways here:
   well, built without its settings, behind a wall, and gone.

   Also here, because the same two names decide it: the daily digest
   (a scheduled function Netlify runs on both sites) sends from the
   app's own site and does nothing on the signpost.

   Usage: node signpost.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4321), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const OLD = "nosca-pilot-2.netlify.app", NEW = "nosca.netlify.app";
const { check, summary } = M.checker("signpost");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    /* a phone that scans the card: the old host is the local build, the new host a page that says where it was reached */
    /* the picture a build given its database writes: this build was given the mock's */
    const READY = path.join(distDir, "ready.png");
    check("(r) a build given its database writes /ready.png, and it is a picture", fs.existsSync(READY) && fs.readFileSync(READY).slice(1, 4).toString() === "PNG");
    const PROBE = fs.existsSync(READY) ? fs.readFileSync(READY) : Buffer.alloc(0);
    const visit = async (url, { wait = 2500, fresh: first = "well", init = null, user = false } = {}) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const state = { fresh: first };
      if (init) await ctx.addInitScript(init);
      const page = await ctx.newPage();
      const asked = { old: [], fresh: [] };
      /* routes are tried newest first: the catch-all is registered first so the two hosts' own routes win */
      await ctx.route("**/*", async (r) => {
        const u = new URL(r.request().url());
        if (u.hostname === "localhost") return r.continue();
        return r.fulfill({ status: 204, body: "" });   // the mock Supabase and anything else: quiet
      });
      /* an email link's token is good: the auth server knows whose it is, so an app that reads the link signs in with it */
      if (user) await ctx.route("**/auth/v1/user", (r) => r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ id: "u-link", aud: "authenticated", role: "authenticated", email: "link@nosca.test", app_metadata: {}, user_metadata: {} }) }));
      const local = async (r, list) => {
        const u = new URL(r.request().url());
        list.push(u.pathname + u.search);
        try {
          const res = await ctx.request.get(BASE + u.pathname + u.search, { failOnStatusCode: false });
          return r.fulfill({ status: res.status(), headers: { "content-type": res.headers()["content-type"] || "text/html" }, body: await res.body() });
        } catch (e) { return r.fulfill({ status: 502, body: String(e) }); }
      };
      await ctx.route(`http://${OLD}/**`, (r) => local(r, asked.old));
      await ctx.route(`https://${OLD}/**`, (r) => local(r, asked.old));
      await ctx.route(`http://deploy-preview-156--${OLD}/**`, (r) => local(r, asked.old));
      await ctx.route(`https://${NEW}/**`, async (r) => {
        const u = new URL(r.request().url()), fresh = state.fresh;
        asked.fresh.push(u.pathname + (u.pathname === "/ready.png" ? "" : u.search));
        if (fresh === "gone") return r.abort("connectionrefused");
        /* Netlify's site protection: a 401 and a page of script, whatever was asked for */
        if (fresh === "wall") return r.fulfill({ status: 401, contentType: "text/html", body: `<!doctype html><title>Login Redirect</title><p>login</p>` });
        /* a build with no database settings has every other file, the icons too, and no /ready.png: the catch-all answers it with index.html */
        if (fresh === "bare" && u.pathname === "/ready.png") return r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><title>Nosca</title><div id="root"></div>` });
        if (u.pathname === "/icons/icon-192.png") return r.fulfill({ status: 200, contentType: "image/png", body: PROBE });
        /* slow: the picture comes a second and a half on, so the old page's app is up and running before the hop */
        if (fresh === "slow" && u.pathname === "/ready.png") await new Promise((done) => setTimeout(done, 1500));
        if (u.pathname === "/ready.png") return r.fulfill({ status: 200, contentType: "image/png", body: PROBE });
        return r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><title>new</title><p id="at">reached</p>` });
      });
      await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(wait);
      const at = page.url();
      const hasRoot = await page.locator("#root").count();
      const rootLen = hasRoot ? await page.evaluate(() => document.getElementById("root").innerHTML.length) : 0;
      return { ctx, page, at, asked, hasRoot, rootLen, state };
    };
    /* a session as supabase-js keeps it under the app's storage key, its access token running `left` seconds more */
    const seed = (left) => `(() => { try { if (location.hostname !== "${OLD}" || sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1");
      const now = Math.round(Date.now() / 1000);
      localStorage.setItem("nosca.auth", JSON.stringify({ access_token: "aaa.bbb.ccc", refresh_token: "r3fr35h", token_type: "bearer", expires_in: 3600, expires_at: now + ${left}, user: { id: "u1" } }));
    } catch (e) {} })();`;

    /* ---------- the card ---------- */
    {
      const v = await visit(`http://${OLD}/install`);
      check("(a) the card's code — the old address's /install — lands on /install at the app's own address", v.at === `https://${NEW}/install`, v.at);
      /* a browser's preload scanner may fetch the bundle while the hop is under way; what matters is that the
         page asked of the old address was the card's, and that the new address was asked for the same page once */
      check("(a2) the old address was asked for the card's page first; the new address for its picture, and then for that same page, once",
        v.asked.old[0] === "/install" && v.asked.fresh[0] === "/ready.png" && v.asked.fresh.filter((p) => p === "/install").length === 1, `old ${JSON.stringify(v.asked.old.slice(0, 4))} · new ${JSON.stringify(v.asked.fresh)}`);
      await v.page.screenshot({ path: path.join(outDir, "01-card.png") });
      await v.ctx.close();
    }
    {
      const v = await visit(`http://${OLD}/`);
      check("(b) the old address's front page lands on the app's own front page", v.at === `https://${NEW}/`, v.at);
      await v.ctx.close();
    }
    {
      const v = await visit(`http://${OLD}/install?ref=card&x=1#steps`);
      check("(c) the path, the query and the fragment all travel with it", v.at === `https://${NEW}/install?ref=card&x=1#steps`, v.at);
      await v.ctx.close();
    }
    {
      /* a join link somebody was sent before the move: the code must arrive */
      const v = await visit(`http://${OLD}/?join=QW7X2M`);
      check("(d) a join link sent before the move keeps its code", v.at === `https://${NEW}/?join=QW7X2M`, v.at);
      await v.ctx.close();
    }
    {
      const v = await visit(`http://${OLD}/demo`);
      check("(e) any other page of the old address goes to the same page of the new", v.at === `https://${NEW}/demo`, v.at);
      await v.ctx.close();
    }

    /* ---------- the new address is not well: nobody is sent to it ---------- */
    {
      const v = await visit(`http://${OLD}/install`, { wait: 6500, fresh: "wall" });
      const guide = await v.page.locator('[data-tour="install-open"]').count();
      check("(w) a login wall in front of the new address: the card stays on the old one, and the guide is on the page", v.at === `http://${OLD}/install` && guide === 1 && v.rootLen > 0, `${v.at} · guide ${guide} · root ${v.rootLen}`);
      check("(w2) the new address was asked for its picture and for nothing else", v.asked.fresh.length >= 1 && v.asked.fresh.every((p) => p === "/ready.png"), JSON.stringify(v.asked.fresh));
      await v.page.screenshot({ path: path.join(outDir, "03-wall-stays.png") });
      await v.ctx.close();
    }
    {
      /* 24 November: the new site public, built without its Supabase settings — its icons load, its app is a blank page */
      const v = await visit(`http://${OLD}/install`, { wait: 6500, fresh: "bare" });
      const guide = await v.page.locator('[data-tour="install-open"]').count();
      check("(w5) the new address built without its database settings: the card stays on the old one, and the guide is on the page", v.at === `http://${OLD}/install` && guide === 1 && v.rootLen > 0 && v.asked.fresh.every((p) => p === "/ready.png"), `${v.at} · guide ${guide} · asked ${JSON.stringify(v.asked.fresh)}`);
      await v.ctx.close();
    }
    {
      const v = await visit(`http://${OLD}/install`, { wait: 6500, fresh: "gone" });
      const guide = await v.page.locator('[data-tour="install-open"]').count();
      check("(w3) the new address gone altogether: the card stays on the old one, and the guide is on the page", v.at === `http://${OLD}/install` && guide === 1, `${v.at} · guide ${guide}`);
      await v.ctx.close();
    }
    {
      const v = await visit(`http://${OLD}/`, { wait: 6500, fresh: "wall" });
      check("(w4) and the front page the same: the app, where it has always been", v.at === `http://${OLD}/` && v.rootLen > 0, `${v.at} · root ${v.rootLen}`);
      await v.ctx.close();
    }

    /* ---------- everything that is not the old address stays where it is ---------- */
    {
      const v = await visit(`http://deploy-preview-156--${OLD}/install`, { wait: 3500 });
      check("(f) a deploy preview of the old site is another host: it does not hop, and the page loads", v.at === `http://deploy-preview-156--${OLD}/install` && v.asked.fresh.length === 0 && v.hasRoot === 1 && v.rootLen > 0, `${v.at} · new asked ${v.asked.fresh.length} · root ${v.rootLen}`);
      await v.ctx.close();
    }
    {
      const v = await visit(`${BASE}/install`, { wait: 3500 });
      check("(g) the app at its own address (here, localhost) never hops, and the guide is on the page", v.at === `${BASE}/install` && v.asked.fresh.length === 0 && v.rootLen > 0 && (await v.page.locator('[data-tour="install-open"]').count()) === 1, `${v.at} · root ${v.rootLen}`);
      await v.page.screenshot({ path: path.join(outDir, "02-own-address.png") });
      await v.ctx.close();
    }

    /* ---------- the move is seamless (24 November) ---------- */
    {
      /* an app on a Home Screen: iOS would open another address inside it as a sheet of browser, on every open */
      const v = await visit(`http://${OLD}/`, { wait: 4000, init: "Object.defineProperty(navigator, 'standalone', { get: () => true });" });
      check("(s) an app on a Home Screen at the old address stays there — it is never bounced into a browser sheet — and works", v.at === `http://${OLD}/` && v.asked.fresh.length === 0 && v.rootLen > 0, `${v.at} · new asked ${JSON.stringify(v.asked.fresh)} · root ${v.rootLen}`);
      await v.ctx.close();
    }
    {
      /* a browser tab signed in at the old address: it arrives at the new one signed in, and the old copy is gone */
      const v = await visit(`http://${OLD}/?join=QW7X2M`, { init: seed(1800) });
      const hand = (() => { try { return Object.fromEntries(new URLSearchParams(new URL(v.at).hash.slice(1))); } catch (e) { return {}; } })();
      check("(t) a signed-in tab arrives at the new address carrying its session the way Supabase's own links do — the path and the query kept",
        v.at.startsWith(`https://${NEW}/?join=QW7X2M#`) && hand.access_token === "aaa.bbb.ccc" && hand.refresh_token === "r3fr35h" && hand.token_type === "bearer" && Number(hand.expires_in) > 1700 && Number(hand.expires_in) <= 1800 && Number(hand.expires_at) > 0, v.at);
      v.state.fresh = "wall";
      await v.page.goto(`http://${OLD}/`, { waitUntil: "domcontentloaded" }).catch(() => {}); await v.page.waitForTimeout(800);
      const left = await v.page.evaluate(() => localStorage.getItem("nosca.auth")).catch(() => "unread");
      check("(t2) …and the old address's own copy of it is cleared as the tab leaves, so a token the new address has since rotated is never handed over, or refreshed, again", left === null, String(left).slice(0, 80));
      await v.ctx.close();
    }
    {
      /* a session about to run out is not carried: on the way, either side would refresh it */
      const v = await visit(`http://${OLD}/install`, { init: seed(60) });
      check("(t3) a session within two minutes of its end is not carried — the tab arrives as it was, and signs in there", v.at === `https://${NEW}/install`, v.at);
      await v.ctx.close();
    }
    {
      /* a password-reset link the database still addresses to the old site carries its own token: it travels untouched */
      const v = await visit(`http://${OLD}/#access_token=from-email&expires_in=3600&refresh_token=x&token_type=bearer&type=recovery`, { init: seed(1800) });
      check("(t4) an email link's own token travels with it untouched, and the stored session is not sent in its place",
        v.at === `https://${NEW}/#access_token=from-email&expires_in=3600&refresh_token=x&token_type=bearer&type=recovery`, v.at);
      await v.ctx.close();
    }
    const LINK = "#access_token=from-email&expires_in=3600&refresh_token=x&token_type=bearer&type=recovery";
    {
      /* the same link while the new address is slow to answer, the old page's app up and running first. It read the link,
         kept a copy and cleared it from the address — and the copy was then handed on as a plain sign-in, so a reset never
         reached "set a new password", and a copy kept at the old address could later be refreshed against the new one's */
      const v = await visit(`http://${OLD}/${LINK}`, { fresh: "slow", user: true, wait: 3500 });
      check("(t5) an email link while the new address is slow arrives there whole — its own token and its type, nothing in its place", v.at === `https://${NEW}/${LINK}`, v.at);
      v.state.fresh = "wall";
      await v.page.goto(`http://${OLD}/`, { waitUntil: "domcontentloaded" }).catch(() => {}); await v.page.waitForTimeout(800);
      const left = await v.page.evaluate(() => localStorage.getItem("nosca.auth")).catch(() => "unread");
      check("(t5b) …and the old address kept no copy of the link's sign-in", left === null, String(left).slice(0, 80));
      await v.ctx.close();
    }
    {
      /* a join code while the new address is slow: the old page's app takes the code out of its own address as it starts */
      const v = await visit(`http://${OLD}/?join=QW7X2M`, { fresh: "slow", wait: 3500 });
      check("(t6) a join link while the new address is slow keeps its code: what is handed on is the page as it was opened, not as the app under the hop tidied it", v.at === `https://${NEW}/?join=QW7X2M`, v.at);
      await v.ctx.close();
    }
    {
      /* the new address does not answer: the link goes back in the address and the page opens on it again, once, and the
         app where it has always been takes it — the reset still reaches its own screen */
      const v = await visit(`http://${OLD}/${LINK}`, { fresh: "wall", user: true, wait: 4500 });
      const stored = await v.page.evaluate(() => { try { return JSON.parse(localStorage.getItem("nosca.auth") || "null"); } catch (e) { return null; } }).catch(() => null);
      const opened = v.asked.old.filter((p) => p === "/").length;
      const setPw = await v.page.getByText("Confirm password").count().catch(() => 0);
      check("(t7) an email link while the new address does not answer: the page opens on it again, once, and the app at the old address takes it — the reset's own screen",
        v.at.startsWith(`http://${OLD}/`) && !!stored && stored.access_token === "from-email" && opened === 2 && v.asked.fresh.length === 1 && setPw > 0,
        `${v.at} · stored ${stored && stored.access_token} · opened ${opened} · new asked ${JSON.stringify(v.asked.fresh)} · set password ${setPw}`);
      await v.page.screenshot({ path: path.join(outDir, "04-link-stays.png") });
      await v.ctx.close();
    }

    /* ---------- the built page itself ---------- */
    const { pathToFileURL } = require("url");
    const ps = await import(pathToFileURL(path.join(M.ROOT, "scripts/public-settings.mjs")).href);
    {
      const html = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
      const hop = html.indexOf(OLD), bundle = html.search(/<script[^>]+type="module"/);
      check("(h) the hop is in the built page's head, ahead of the app's bundle", hop > 0 && bundle > 0 && hop < bundle && html.includes(`https://${NEW}`), `hop ${hop} · bundle ${bundle}`);
      check("(h2) a build given its database does not forward its own address anywhere", !html.includes(ps.forwardScript()));
    }

    /* ---------- the app's own site, built with no variables: its three public settings read off the first site's app ---------- */
    {
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const jwt = (claims) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.c2lnbmF0dXJl`;
      const REF = "abcdefghijklmnopqrst", URL1 = `https://${REF}.supabase.co`;
      const ANON = jwt({ iss: "supabase", ref: REF, role: "anon", iat: 1, exp: 2 });
      const SERVICE = jwt({ iss: "supabase", ref: REF, role: "service_role", iat: 1, exp: 2 });
      const OTHER = jwt({ iss: "supabase", ref: "zyxwvutsrqponmlkjihg", role: "anon", iat: 1, exp: 2 });
      const VAPID = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
      const bundle = (key) => `const a="${URL1}",b="${key}";const v="${VAPID}";export{a,b,v};`;
      const got = ps.settingsFromScripts([bundle(ANON)]);
      check("(p) the address, the anon key and the push key are read off the app's own scripts",
        got && got.VITE_SUPABASE_URL === URL1 && got.VITE_SUPABASE_ANON_KEY === ANON && got.VITE_VAPID_PUBLIC_KEY === VAPID, JSON.stringify(got));
      check("(p2) a service key is never taken for the anon key — nothing is taken at all", ps.settingsFromScripts([bundle(SERVICE)]) === null);
      check("(p3) nor another project's anon key beside this project's address", ps.settingsFromScripts([bundle(OTHER)]) === null);
      check("(p4) a page whose scripts carry no database gives nothing", ps.settingsFromScripts(["const x=1;"]) === null && ps.settingsFromScripts([]) === null);
      const page = `<!doctype html><head><script type="module" crossorigin src="/assets/index-AbC123.js"></script><link rel="modulepreload" crossorigin href="/assets/vendor-XyZ.js"></head>`;
      check("(p5) the page's scripts are the module and its preloads", JSON.stringify(ps.scriptsOf(page)) === JSON.stringify(["/assets/index-AbC123.js", "/assets/vendor-XyZ.js"]), JSON.stringify(ps.scriptsOf(page)));
      const served = { "/": page, "/assets/index-AbC123.js": bundle(ANON), "/assets/vendor-XyZ.js": "export const z=0;" };
      const fetcher = async (u) => { const p = new URL(u).pathname; return p in served ? new Response(served[p], { status: 200 }) : new Response("no", { status: 404 }); };
      const site = await ps.settingsFromSite("https://first.example", fetcher);
      check("(p6) read from the first site the way a browser reads it", site && site.VITE_SUPABASE_ANON_KEY === ANON && site.VITE_SUPABASE_URL === URL1, JSON.stringify(site));
      const down = await ps.settingsFromSite("https://first.example", async () => { throw new Error("down"); });
      const gone = await ps.settingsFromSite("https://first.example", async () => new Response("no", { status: 404 }));
      check("(p7) a first site down or missing gives nothing, and never throws", down === null && gone === null);
    }
    {
      /* a build with no database at the app's own address: the person lands on the same page of the first site */
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await ctx.route("**/*", (r) => r.fulfill({ status: 204, body: "" }));
      await ctx.route(`https://${NEW}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><head>${ps.forwardScript()}</head><body><div id="root"></div></body></html>` }));
      await ctx.route(`https://${OLD}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><title>first</title><p>the app</p>` }));
      await ctx.route(`https://deploy-preview-159--${NEW}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><head>${ps.forwardScript()}</head><body>preview</body></html>` }));
      await page.goto(`https://${NEW}/install?ref=card#steps`, { waitUntil: "domcontentloaded" }).catch(() => {}); await page.waitForTimeout(800);
      check("(p8) the app's own address, built with no database, sends a person to the same page of the first site — never a blank page", page.url() === `https://${OLD}/install?ref=card#steps`, page.url());
      await page.goto(`https://deploy-preview-159--${NEW}/`, { waitUntil: "domcontentloaded" }).catch(() => {}); await page.waitForTimeout(500);
      check("(p9) …and only that address: a preview of it stays where it is", page.url() === `https://deploy-preview-159--${NEW}/`, page.url());
      await ctx.close();
    }

    /* ---------- the daily digest runs on one site ---------- */
    {
      const sp = await import(pathToFileURL(path.join(M.ROOT, "netlify/functions/lib/signpost.mjs")).href);
      check("(i) the signpost is recognised by its site name", sp.isSignpost({ SITE_NAME: "nosca-pilot-2" }) === true);
      check("(i2) … by its address", sp.isSignpost({ URL: "https://nosca-pilot-2.netlify.app" }) === true);
      check("(i3) … and by the newer handler context", sp.isSignpost({}, { site: { name: "nosca-pilot-2", url: "https://nosca-pilot-2.netlify.app" } }) === true);
      check("(j) the app's own site is not the signpost", sp.isSignpost({ SITE_NAME: "nosca", URL: "https://nosca.netlify.app" }) === false);
      check("(j2) a site that says nothing of itself is not the signpost, so a single site still sends", sp.isSignpost({}) === false && sp.isSignpost() === false);
      check("(j3) a name that merely contains the old one is not it", sp.isSignpost({ SITE_NAME: "nosca-pilot-22", URL: "https://my-nosca-pilot-2.netlify.app.example.com" }) === false);

      /* the function itself: exactly one site sends (24 November) — whichever holds the keys, the app's own when both do.
         The signpost asks the app's own site whether it is armed; rows are counted apart from that question */
      const keep = { ...process.env };
      const realFetch = global.fetch; let fetched = 0, armedAsked = 0, armed = true;
      global.fetch = async (u) => {
        if (String(u).endsWith("/.netlify/functions/armed")) { armedAsked += 1; return new Response(JSON.stringify({ armed }), { status: 200, headers: { "content-type": "application/json" } }); }
        fetched += 1; return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      };
      try {
        Object.assign(process.env, { SUPABASE_URL: "https://mock.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", VITE_VAPID_PUBLIC_KEY: "BPcZ0cGqVZ1W0n4oFqVY2rXl2bq0c2p8iX0b0m3mQ3bq5h8t5x0d6y1o2m3n4b5v6c7x8z9a0s1d2f3g4h5j6k", VAPID_PRIVATE_KEY: "k", VAPID_SUBJECT: "mailto:help@nosca.ie", PUSH_WEBHOOK_SECRET: "s" });
        const digest = (await import(pathToFileURL(path.join(M.ROOT, "netlify/functions/digest.mjs")).href)).default;
        process.env.SITE_NAME = "nosca-pilot-2"; process.env.URL = "https://nosca-pilot-2.netlify.app";
        const a = await digest(new Request("https://nosca-pilot-2.netlify.app/.netlify/functions/digest"), {});
        const aBody = await a.json().catch(() => ({}));
        check("(k) on the signpost, with the app's own site armed, the digest does nothing: it answers 200 skipped and reads no row", a.status === 200 && /^signpost site/.test(aBody.skipped || "") && fetched === 0 && armedAsked === 1, `${a.status} ${JSON.stringify(aBody)} · fetched ${fetched}`);
        process.env.SITE_NAME = "nosca"; process.env.URL = "https://nosca.netlify.app";
        const b = await digest(new Request("https://nosca.netlify.app/.netlify/functions/digest"), {});
        const bBody = await b.json().catch(() => ({}));
        check("(k2) on the app's own site it goes on to its work (it is not skipped)", bBody.skipped === undefined, `${b.status} ${JSON.stringify(bBody).slice(0, 160)} · fetched ${fetched}`);
        /* the app's own site built without the keys: it says so and sends nothing, and the signpost sends in its place */
        armed = false; fetched = 0;
        process.env.SITE_NAME = "nosca-pilot-2"; process.env.URL = "https://nosca-pilot-2.netlify.app";
        const c = await digest(new Request("https://nosca-pilot-2.netlify.app/.netlify/functions/digest"), {});
        const cBody = await c.json().catch(() => ({}));
        check("(k3) on the signpost, with the app's own site not armed, the digest goes on to its work, as (k2) does — one summary from the old address beats none", cBody.skipped === undefined && armedAsked === 2, `${c.status} ${JSON.stringify(cBody).slice(0, 160)} · asked ${armedAsked}`);
        const held = process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY; fetched = 0;
        process.env.SITE_NAME = "nosca"; process.env.URL = "https://nosca.netlify.app";
        const d = await digest(new Request("https://nosca.netlify.app/.netlify/functions/digest"), {});
        const dBody = await d.json().catch(() => ({}));
        check("(k4) a site without the keys says so, answers 200 and reads nothing — it was a 500 every morning on the app's own site", d.status === 200 && /no keys/.test(dBody.skipped || "") && fetched === 0, `${d.status} ${JSON.stringify(dBody)}`);
        const armedFn = (await import(pathToFileURL(path.join(M.ROOT, "netlify/functions/armed.mjs")).href)).default;
        const no = await (await armedFn()).json();
        process.env.SUPABASE_SERVICE_ROLE_KEY = held;
        const yes = await (await armedFn()).json();
        check("(k5) armed answers whether this site holds the keys, as true or false and nothing else", no.armed === false && yes.armed === true && Object.keys(no).length === 1 && Object.keys(yes).length === 1, JSON.stringify({ no, yes }));
        /* the signpost's question, when the app's own site does not answer: no */
        global.fetch = async () => { throw new Error("unreachable"); };
        check("(k6) an app site that does not answer is not armed, so the signpost sends", (await sp.appSiteArmed()) === false);
      } catch (e) {
        check("(k) the digest could be run both ways", false, String(e && e.message || e));
      } finally {
        global.fetch = realFetch;
        for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
        Object.assign(process.env, keep);
      }
    }
  } catch (e) {
    check("the script ran to the end", false, String(e && e.stack || e));
  } finally {
    await browser.close();
    M.stopServer(server);
    summary();
  }
})();
