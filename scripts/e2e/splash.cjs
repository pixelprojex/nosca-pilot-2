/* THE SPLASH: THE RINGS LARGER AND BOLDER, THE ANIMATION AS IT WAS
   (23 November). The founder, of the opening: "I love the animation, but
   … enlarge the rings a small bit, as they just look a little bit small
   and timid almost. I want something a bit more bold … keep the animation
   the exact same … a bit more sporty, a bit more energetic … keep the
   classy professionalism." So this holds two things apart. What it is
   drawn at: the mark's box 192 across (148 before), the rings' stroke 2
   of the mark's 40 units (1.6 before), the ripples carried with the
   mark, the orbit and the pool with the column, the orbit's foot clear
   of the line under the rule, the wordmark 23 at 500 over a 64px rule.
   And what must not move: every keyframe to the character, every delay
   and duration of the sequence for the brand and for a sport, the hold
   before it lifts, a tap that skips it, and Reduce Motion landing on the
   settled mark. It freezes the sequence at four moments — the rings
   drawing, converged, the wordmark in, settled — for the brand splash
   (the ?demo harness, its phone frame stretched to the viewport) and for
   a coach of golf, tennis and equestrian (the built app against the
   mock) at 320, 375 and 430 wide, writes a screenshot of each, and
   measures that nothing crowds: the rings at their widest, the word at
   its widest, the column in its order.
   Usage: node splash.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4391), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const COACH = "00000000-0000-4000-8000-00000000c0ac";
const SIZES = [[320, 568], [375, 667], [430, 932]];
const VARIANTS = ["brand", "golf", "tennis", "equestrian"];
/* the sequence, as Splash has it: when each piece begins, and how long the whole is held */
const T = {
  brand: { r1: 350, r2: 800, join: 1750, link: 2150, word: 2800, rule: 3300, sub: 3700, foot: 4200, hold: 5400 },
  sport: { r1: 250, r2: 600, join: 1350, link: 1700, word: 2200, rule: 2600, sub: 2950, foot: 3350, hold: 4000 },
};
const MOMENTS = {
  brand: [["1-drawing", 1100], ["2-converged", 2750], ["3-word", 3900], ["4-settled", 5300]],
  sport: [["1-drawing", 900], ["2-converged", 2300], ["3-word", 3150], ["4-settled", 3950]],
};
/* the eleven keyframes the opening is made of, as they are written in ShimmerCSS */
const KEYFRAMES = [
  "@keyframes draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}",
  "@keyframes tighten{from{opacity:0;letter-spacing:0.62em}to{opacity:1;letter-spacing:0.34em}}",
  "@keyframes trackFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}",
  "@keyframes glow{0%,100%{opacity:.25}50%{opacity:.55}}",
  "@keyframes splashOut{from{opacity:1}to{opacity:0}}",
  "@keyframes ripple{0%{transform:scale(.55);opacity:.5}70%{opacity:0}100%{transform:scale(2.1);opacity:0}}",
  "@keyframes orbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
  "@keyframes converge{0%{transform:translateX(var(--from))}100%{transform:translateX(0)}}",
  "@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}",
  "@keyframes dashRun{0%{stroke-dashoffset:0;opacity:0}10%{opacity:.5}85%{opacity:.5}100%{stroke-dashoffset:-108;opacity:0}}",
  "@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}",
];
/* name : delay : duration : iterations : fill, for every animation the splash runs */
const sequence = (t) => [
  `glow:0:6000:inf:none`,
  ...[0, 1, 2].map((i) => `ripple:${t.link + i * 900}:3600:inf:none`),
  `orbit:${t.r1}:26000:inf:none`, `breathe:${t.link}:5000:inf:none`,
  `converge:${t.join}:900:1:both`, `converge:${t.join}:900:1:both`,
  `draw:${t.r1}:1250:1:forwards`, `draw:${t.r2}:1250:1:forwards`, `draw:${t.link}:850:1:forwards`,
  `dashRun:${t.link + 900}:2600:inf:none`, `tighten:${t.word}:1200:1:forwards`, `trackFill:${t.rule}:950:1:forwards`,
  `fadeUp:${t.sub}:900:1:forwards`, `fadeUp:${t.foot}:900:1:forwards`,
].sort();

/* the sizes: the mark; the ripples, which are the mark's; the orbit and the pool, which are the column's; the wordmark and its rule */
const MARK_W = 192, WEIGHT = 2, RIPPLE = 246, ORBIT = 272, POOL = 448, POOL_BLUR = 142, WORD = 23, RULE = 64, GUTTER = 16;

const { check, summary } = M.checker("splash");
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

/* in the page: the splash, and its pieces by what they are */
const IN_PAGE = () => {
  window.__splash = () => [...document.querySelectorAll('button[aria-label="Skip"]')].find((b) => b.style.zIndex === "60") || null;
  window.__seek = (t) => { const s = window.__splash(); document.getAnimations().filter((a) => a.effect && s.contains(a.effect.target)).forEach((a) => { a.pause(); a.currentTime = t; }); };
  window.__box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
  window.__read = () => {
    const s = window.__splash(); if (!s) return null;
    const mark = s.querySelector('[data-splash="mark"] svg'), rings = [...mark.querySelectorAll("circle")], paths = [...mark.querySelectorAll("path")];
    const word = s.querySelector('[data-splash="word"]'), rule = s.querySelector('[data-splash="rule"]');
    const kids = [...s.children], sub = kids[kids.indexOf(rule) + 1], foot = kids[kids.length - 1];
    const spans = kids.filter((k) => k.tagName === "SPAN"), orbit = s.querySelector("svg[aria-hidden]");
    const cs = (el) => getComputedStyle(el);
    return {
      vw: innerWidth, vh: innerHeight, splash: window.__box(s), mark: window.__box(mark), ringL: window.__box(rings[0]), ringR: window.__box(rings[1]),
      strokes: [...rings, ...paths].map((e) => cs(e).strokeWidth), dash: rings.concat(paths[0]).map((e) => cs(e).strokeDashoffset), slide: [...mark.querySelectorAll("g")].map((g) => cs(g).transform),
      word: window.__box(word), wordSize: cs(word).fontSize, wordWeight: cs(word).fontWeight, wordSpace: cs(word).letterSpacing, wordOpacity: cs(word).opacity,
      rule: window.__box(rule), ruleTransform: cs(rule).transform, sub: window.__box(sub), subOpacity: cs(sub).opacity, subText: sub.textContent, foot: window.__box(foot), footText: foot.textContent,
      pool: spans[0].offsetWidth, poolBlur: cs(spans[0]).filter, ripples: spans.slice(1).map((x) => x.offsetWidth), orbit: Number(orbit.getAttribute("width")),
      leaving: s.style.animation.includes("splashOut"),
    };
  };
};
/* the two timers that lift the splash away, in both forms: dropped where a moment is frozen, kept where the hold is timed */
const NO_HOLD = () => { const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 4000 || ms === 4700 || ms === 5400 || ms === 6100) return 0; return st.call(window, fn, ms, ...a); }; };

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const open = async (v, [w, h], { hold = false, reduce = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduce ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${v} ${w}: ${e.message}`));
    await page.addInitScript(IN_PAGE); if (!hold) await page.addInitScript(NO_HOLD);
    if (v === "brand") await page.goto(`${BASE}/?demo`, { waitUntil: "load" });
    else {
      const db = M.emptyDb(); const u = M.addUser(db, { id: COACH, email: "coach@t.ie" });
      M.addProfile(db, { id: COACH, role: "coach", name: "Niamh Byrne", sport: v, inviteCode: "QW7X2M", club: "Hollow Lane" }); M.setPrefs(db, COACH, {});
      await M.attach(page, db); await M.injectSession(page, M.session(u, db));
      await page.goto(BASE, { waitUntil: "load" });
    }
    await page.waitForFunction(() => window.__splash && window.__splash() !== null, null, { timeout: 20000, polling: "raf" });
    const seen = Date.now();
    if (v === "brand") {
      /* the harness draws the app in a 384 × 768 phone frame under its toolbar: the frame is stretched to the viewport and the
         toolbar put away, so the brand splash is measured on the screen a phone has */
      await page.evaluate(() => { const frame = window.__splash().parentElement; [...frame.parentElement.children].forEach((k) => { if (k !== frame) k.style.display = "none"; });
        Object.assign(frame.style, { position: "fixed", inset: "0", width: "100%", height: "100%", maxWidth: "none", border: "none", borderRadius: "0", boxShadow: "none", zIndex: "9999" }); });
      await page.waitForFunction((ww) => innerWidth === ww, w, { timeout: 5000 }).catch(() => {});
    }
    const seek = async (t) => { await page.evaluate((x) => window.__seek(x), t); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
    return { ctx, page, seen, seek, read: () => page.evaluate(() => window.__read()) };
  };

  try {
    /* (a) the keyframes are the ones that were loved, to the character */
    { const js = fs.readdirSync(path.join(distDir, "assets")).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(distDir, "assets", f), "utf8")).join("\n");
      const gone = KEYFRAMES.filter((k) => !js.includes(k));
      check("(a) the eleven keyframes of the opening are in the build as they were written — draw, tighten, trackFill, glow, splashOut, ripple, orbit, converge, breathe, dashRun, fadeUp", gone.length === 0, gone.join(" | ")); }

    for (const size of SIZES) for (const v of VARIANTS) {
      const [w, h] = size, kind = v === "brand" ? "brand" : "sport", t = T[kind], tag = `${v} ${w}×${h}`;
      const { ctx, page, seek, read } = await open(v, size);
      /* the four moments, frozen */
      for (const [name, at] of MOMENTS[kind]) { await seek(at); await page.screenshot({ path: path.join(outDir, `${v}-${w}x${h}-${name}.png`) }); }

      /* (b) the sequence: every animation's name, delay, duration, count and fill */
      if (w === 375) {
        const got = await page.evaluate(() => { const s = window.__splash(); return document.getAnimations().filter((a) => a.effect && s.contains(a.effect.target)).map((a) => { const x = a.effect.getTiming(); return [a.animationName, x.delay, x.duration, x.iterations === Infinity ? "inf" : x.iterations, x.fill].join(":"); }).sort(); });
        check(`(b) ${v}: the sequence is the one that was loved — sixteen animations, each at its own delay and length (the rings at ${t.r1} and ${t.r2}, together at ${t.join}, the link at ${t.link}, the word at ${t.word}, the rule at ${t.rule})`, JSON.stringify(got) === JSON.stringify(sequence(t)), `got ${got.join(" ")} — want ${sequence(t).join(" ")}`);
      }

      /* at rest: everything landed, the breath back at its start */
      await seek(t.link + 5000); const f = await read();
      const px = f.mark.w / 40, sw = WEIGHT * px, ink = { l: f.ringL.l - sw / 2, r: f.ringR.r + sw / 2 };
      /* (c) the mark's size and weight */
      check(`(c) ${tag}: the mark's box is ${MARK_W} across and its own shape, 40 by 25 (it was 148 by 92)`, near(f.mark.w, MARK_W) && near(f.mark.h, MARK_W * 0.625), `${f.mark.w} × ${f.mark.h}`);
      check(`(c) ${tag}: the rings, the link and its travelling dash are one weight, ${WEIGHT} of the mark's 40 units — ${(WEIGHT * 4.8).toFixed(1)}px on the screen where they were 5.9`, f.strokes.length === 4 && f.strokes.every((s) => s === `${WEIGHT}px`) && near(sw, 9.6, 0.1), `${f.strokes.join(" ")} · ${sw.toFixed(2)}px`);
      check(`(c) ${tag}: the rings stand about 150 across, 1.3 times the 113 they were, centred on the screen`, near(ink.r - ink.l, 149.8, 1) && near((ink.l + ink.r) / 2, f.vw / 2, 1), `${(ink.r - ink.l).toFixed(1)} wide, centre ${((ink.l + ink.r) / 2).toFixed(1)} of ${f.vw}`);
      /* (d) what was drawn round the old mark went with the new one: the ripples by the mark's 1.3, the orbit and the pool by
         the column's 1.18, since they turn and glow about the middle of the whole column */
      check(`(d) ${tag}: the ripples are ${RIPPLE} (190 beside the old mark), the orbit ${ORBIT} (230) and the pool ${POOL} under a blur of ${POOL_BLUR} (380 under 120)`, f.ripples.length === 3 && f.ripples.every((r) => r === RIPPLE) && f.orbit === ORBIT && f.pool === POOL && f.poolBlur === `blur(${POOL_BLUR}px)`, `ripples ${f.ripples} orbit ${f.orbit} pool ${f.pool} ${f.poolBlur}`);
      const cy = (f.splash.t + f.splash.b) / 2, orbitR = ORBIT * 0.42, orbitLine = ORBIT * 0.004 / 2, markTop = f.ringL.t - sw / 2;
      check(`(d) ${tag}: the orbit passes behind the top of the rings and its foot stops over the line under the rule — never through its letters`, cy - orbitR > markTop && cy - orbitR < markTop + sw && cy + orbitR + orbitLine <= f.sub.t + 1, `orbit ${(cy - orbitR).toFixed(1)}–${(cy + orbitR).toFixed(1)} · the rings' top edge ${markTop.toFixed(1)}–${(markTop + sw).toFixed(1)} · the line's box from ${f.sub.t.toFixed(1)}`);
      /* (e) the wordmark and its rule */
      check(`(e) ${tag}: the wordmark is ${WORD}px at 500, tracked 0.34em, and narrower than the rings over it (it was 20 at 400)`, f.wordSize === `${WORD}px` && f.wordWeight === "500" && near(parseFloat(f.wordSpace), WORD * 0.34, 0.05) && f.wordOpacity === "1" && f.word.w < ink.r - ink.l, `${f.wordSize} ${f.wordWeight} ${f.wordSpace} · ${f.word.w.toFixed(1)} wide under ${(ink.r - ink.l).toFixed(1)}`);
      check(`(e) ${tag}: the rule is ${RULE} by 1, centred under the word (it was 54)`, near(f.rule.w, RULE) && near(f.rule.h, 1, 0.2) && near((f.rule.l + f.rule.r) / 2, f.vw / 2, 1), `${f.rule.w} × ${f.rule.h}`);
      /* (f) nothing crowds: the column in its order with air between, every piece inside the screen */
      const order = f.mark.b < f.word.t && f.word.b + 8 <= f.rule.t && f.rule.b + 8 <= f.sub.t && f.sub.b + 24 <= f.foot.t && f.foot.b <= f.vh - 16;
      check(`(f) ${tag}: the column holds — the mark, the word, the rule, "${f.subText}", and "${f.footText}" at the foot with air over it`, order && f.mark.t >= 32, `mark ${f.mark.t.toFixed(0)}–${f.mark.b.toFixed(0)} word ${f.word.t.toFixed(0)}–${f.word.b.toFixed(0)} rule ${f.rule.t.toFixed(0)} sub ${f.sub.t.toFixed(0)}–${f.sub.b.toFixed(0)} foot ${f.foot.t.toFixed(0)}–${f.foot.b.toFixed(0)} of ${f.vh}`);
      const inside = [["word", f.word], ["rule", f.rule], ["sub", f.sub], ["foot", f.foot]].filter(([, b]) => b.l < GUTTER || b.r > f.vw - GUTTER).map(([n, b]) => `${n} ${b.l.toFixed(0)}–${b.r.toFixed(0)}`);
      check(`(f) ${tag}: every line of it is whole on the screen, ${GUTTER}px clear of both edges`, inside.length === 0 && f.vw === w, `${inside.join(", ")} of ${f.vw}`);
      /* the rings at their widest: drawn apart, before they slide together */
      await seek(t.join); const wide = await read(); const wl = wide.ringL.l - sw / 2, wr = wide.ringR.r + sw / 2;
      check(`(f) ${tag}: apart, before they join, the rings are still ${GUTTER}px and more inside both edges`, wl >= GUTTER && wr <= wide.vw - GUTTER && wr - wl > ink.r - ink.l + 60, `${wl.toFixed(1)}–${wr.toFixed(1)} of ${wide.vw}`);
      /* the word at its widest: the first frame of its tightening, tracked 0.62em */
      await seek(t.word); const loose = await read();
      check(`(f) ${tag}: the word at its loosest, 0.62em, is inside both edges too`, near(parseFloat(loose.wordSpace), WORD * 0.62, 0.05) && loose.word.l >= GUTTER && loose.word.r <= loose.vw - GUTTER, `${loose.wordSpace} · ${loose.word.l.toFixed(1)}–${loose.word.r.toFixed(1)} of ${loose.vw}`);
      await ctx.close();
    }

    /* (g) the hold: the splash stays its whole length and lifts by itself — 5.4 s before a sport, 4 s inside one. The hold is
       counted from the app's last render under it (a load landing starts it again, as it always has), so it is never shorter
       than its length and here never much longer; the lift is 700 ms */
    for (const v of ["brand", "golf"]) {
      const t = T[v === "brand" ? "brand" : "sport"]; const { ctx, page, seen } = await open(v, [375, 667], { hold: true });
      await page.waitForFunction(() => { const s = window.__splash(); return !s || s.style.animation.includes("splashOut"); }, null, { timeout: 15000, polling: 50 }).catch(() => {});
      const lifted = Date.now() - seen, wasThere = await page.evaluate(() => window.__splash() !== null);
      await page.waitForFunction(() => window.__splash() === null, null, { timeout: 5000, polling: 50 }).catch(() => {});
      const gone = Date.now() - seen, isGone = await page.evaluate(() => window.__splash() === null);
      check(`(g) ${v}: the opening holds its ${t.hold / 1000} s and no less, then lifts by itself and is gone 700 ms on`, wasThere && isGone && lifted >= t.hold - 150 && lifted <= t.hold + 2500 && gone - lifted >= 500 && gone - lifted <= 1100, `began to lift at ${lifted} ms, gone at ${gone} ms`);
      await ctx.close();
    }
    /* (h) a tap skips it */
    { const { ctx, page, read } = await open("tennis", [375, 667]); await page.waitForTimeout(600);
      await page.evaluate(() => window.__splash().click()); await page.waitForTimeout(700);
      check("(h) a tap on the opening skips it", (await read()) === null, "still there 700 ms after the tap"); await ctx.close(); }

    /* (i) Reduce Motion lands on the settled mark: every piece at its end, at the end of its own delay */
    for (const v of ["brand", "equestrian"]) {
      const t = T[v === "brand" ? "brand" : "sport"]; const { ctx, page, seen, read } = await open(v, [320, 568], { reduce: true });
      await page.waitForTimeout(Math.max(0, t.foot + 500 - (Date.now() - seen))); const f = await read();
      await page.screenshot({ path: path.join(outDir, `${v}-320x568-reduce.png`) });
      const still = (m) => m === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(m);
      check(`(i) ${v}, Reduce Motion: both rings and the link are drawn whole and the rings are together`, !!f && f.dash.every((d) => Math.abs(parseFloat(d)) < 0.01) && f.slide.every(still), f ? `dash ${f.dash.join(" ")} · ${f.slide.join(" ")}` : "no splash");
      check(`(i) ${v}, Reduce Motion: the mark is its full size, the word is in at 0.34em, the rule is drawn and the line under it reads`, !!f && near(f.mark.w, MARK_W) && f.wordOpacity === "1" && near(parseFloat(f.wordSpace), WORD * 0.34, 0.05) && near(f.rule.w, RULE) && f.subOpacity === "1", f ? `mark ${f.mark.w} word ${f.wordOpacity} ${f.wordSpace} rule ${f.rule.w} sub ${f.subOpacity}` : "no splash");
      await ctx.close();
    }
    check("no page error on the way", errors.length === 0, errors.join(" | "));
  } catch (e) { check("the run finished", false, String(e && e.stack || e).slice(0, 600)); } finally { await browser.close(); M.stopServer(server); }
  summary();
})();
