/* Nosca's website: the engine. One file on GSAP, ScrollTrigger, SplitText and Lenis.
   It wires the data-attribute behaviours and exposes a small global, Site, for page scripts.
   Motion runs only when this file has loaded and the visitor allows it (html.motion);
   otherwise every page rests on its finished layout. See API.md.                              */
(function () {
  'use strict';
  const W = window, D = document, H = D.documentElement;
  const gsap = W.gsap, ScrollTrigger = W.ScrollTrigger, SplitText = W.SplitText;
  const $ = (s, r) => (r || D).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || D).querySelectorAll(s));
  const el$ = (x, r) => (typeof x === 'string' ? $(x, r) : x);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  const mq = (q) => W.matchMedia(q);

  const libs = !!(gsap && ScrollTrigger && SplitText);
  if (!libs && W.__siteOff) W.__siteOff();
  const motion = libs && H.classList.contains('motion');
  const fine = mq('(hover: hover) and (pointer: fine)').matches;
  const EASE = 'power3.out';

  const Site = W.Site = {
    motion, fine, gsap, ScrollTrigger, SplitText, lenis: null,
    $, $$, clamp,
    reduced: mq('(prefers-reduced-motion: reduce)').matches,
    wide: () => W.innerWidth >= 900
  };

  /* ───────── viewport units, measured (svh and lvh as pixels) ───────── */
  const probe = D.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  const probeL = probe.cloneNode();
  probeL.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
  Site.svh = () => probe.offsetHeight || W.innerHeight;
  Site.lvh = () => probeL.offsetHeight || W.innerHeight;

  /* ───────── fonts: lines are split only once the display face is in ───────── */
  const fontsReady = (D.fonts && D.fonts.ready ? Promise.race([D.fonts.ready, new Promise((r) => setTimeout(r, 1800))]) : Promise.resolve());
  Site.fonts = fontsReady;

  /* ───────── in view ───────── */
  Site.inView = function (target, o) {
    const el = el$(target); if (!el || !('IntersectionObserver' in W)) { if (el && o.enter) o.enter(el); return null; }
    /* with `above`, the root reaches far up the page, so something jumped past still reports, and rests in place */
    const margin = o.margin || '0px 0px -10% 0px';
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (en.isIntersecting && o.above && en.boundingClientRect.bottom <= 0) { o.above(el); if (o.once) io.disconnect(); }
        else if (en.isIntersecting) { if (o.enter) o.enter(el); if (o.once) io.disconnect(); }
        else if (o.leave) o.leave(el);
      });
    }, { rootMargin: o.above ? margin.replace(/^\S+/, '100000px') : margin, threshold: o.threshold || 0 });
    io.observe(el);
    return io;
  };

  /* ───────── text: line and word reveals, lit words ───────── */
  Site.split = function (target, type, opts) {
    const el = el$(target); if (!el || !SplitText) return null;
    return SplitText.create(el, Object.assign({ type: type || 'lines', linesClass: 'split-line', wordsClass: 'split-word' }, opts || {}));
  };
  const FROM = {
    rise: { y: 34, opacity: 0 }, fade: { opacity: 0 }, scale: { scale: 0.94, opacity: 0, y: 20 },
    left: { x: -44, opacity: 0 }, right: { x: 44, opacity: 0 }, down: { y: -28, opacity: 0 }
  };
  function reveal(el) {
    if (!motion || el._rv) return; el._rv = true;
    const kind = el.dataset.reveal || 'rise', delay = num(el.dataset.delay, 0);
    let tween = null, seen = false, passed = false;
    const play = () => { seen = true; if (tween) tween.play(); };
    const skip = () => { seen = passed = true; if (tween) tween.progress(1); };
    if (kind === 'lines' || kind === 'words' || kind === 'chars') {
      fontsReady.then(() => {
        SplitText.create(el, {
          type: kind === 'lines' ? 'lines' : kind === 'words' ? 'lines,words' : 'lines,words,chars',
          mask: 'lines', linesClass: 'split-line', autoSplit: true,
          onSplit(self) {
            const t = kind === 'lines' ? self.lines : kind === 'words' ? self.words : self.chars;
            el.classList.add('is-set');
            tween = gsap.from(t, {
              yPercent: 112, duration: num(el.dataset.duration, 1.15), ease: 'power4.out', delay,
              stagger: num(el.dataset.stagger, kind === 'lines' ? 0.1 : kind === 'words' ? 0.045 : 0.018), paused: !seen
            });
            if (passed) tween.progress(1);
            return tween;
          }
        });
      });
    } else {
      gsap.set(el, FROM[kind] || FROM.rise); el.classList.add('is-set');
      tween = gsap.to(el, { x: 0, y: 0, scale: 1, opacity: 1, duration: num(el.dataset.duration, 1.1), ease: EASE, delay, paused: true, clearProps: 'transform,opacity' });
    }
    Site.inView(el, { once: true, enter: play, above: skip, margin: el.dataset.margin || '0px 0px -10% 0px' });
  }
  function revealGroup(el) {
    if (!motion || el._rv) return; el._rv = true;
    const kids = $$(':scope > *', el), kind = el.dataset.revealGroup || 'rise';
    gsap.set(kids, FROM[kind] || FROM.rise); el.classList.add('is-set');
    const tween = gsap.to(kids, { x: 0, y: 0, scale: 1, opacity: 1, duration: num(el.dataset.duration, 1.05), ease: EASE, delay: num(el.dataset.delay, 0), stagger: num(el.dataset.stagger, 0.08), paused: true, clearProps: 'transform,opacity' });
    Site.inView(el, { once: true, enter: () => tween.play(), above: () => tween.progress(1) });
  }
  function lit(el) {
    if (!motion || el._lit) return; el._lit = true;
    fontsReady.then(() => {
      SplitText.create(el, {
        type: 'words', wordsClass: 'split-word', autoSplit: true,
        onSplit(self) {
          el.classList.add('is-set');
          return gsap.fromTo(self.words, { opacity: num(el.dataset.litFrom, 0.16) }, {
            opacity: 1, ease: 'none', duration: 0.5, stagger: 0.16,
            scrollTrigger: { trigger: el, start: el.dataset.litStart || 'top 84%', end: el.dataset.litEnd || 'bottom 48%', scrub: 0.5 }
          });
        }
      });
    });
  }

  /* ───────── parallax ───────── */
  function parallax(el) {
    if (!motion || el._px) return; el._px = true;
    const f = num(el.dataset.parallax, 0.12), rot = num(el.dataset.parallaxRotate, 0);
    gsap.fromTo(el, { y: () => f * Site.lvh() * 0.5, rotation: -rot }, {
      y: () => -f * Site.lvh() * 0.5, rotation: rot, ease: 'none',
      scrollTrigger: { trigger: el.closest('[data-parallax-root]') || el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
    });
  }

  /* ───────── numbers that count up once ───────── */
  function counter(el) {
    if (!motion || el._ct) return; el._ct = true;
    const to = num(el.dataset.count, 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    const fmt = (n) => pre + Math.round(n).toLocaleString('en-GB') + suf;
    const w = el.getBoundingClientRect().width;
    if (w) el.style.minWidth = Math.ceil(w) + 'px';
    const o = { v: 0 }; el.textContent = fmt(0);
    Site.inView(el, { once: true, margin: '0px 0px -14% 0px', above: () => { el.textContent = fmt(to); }, enter: () => gsap.to(o, { v: to, duration: num(el.dataset.duration, 1.8), ease: 'power2.out', delay: num(el.dataset.delay, 0), onUpdate: () => { el.textContent = fmt(o.v); } }) });
  }

  /* ───────── gold: pinstripes that draw, rings that draw, a sheen that crosses ───────── */
  const DASH = { strokeDasharray: '1 1.2', strokeDashoffset: 1.06 };
  Site.pins = function (target, o) {
    const el = el$(target); if (!el || !gsap) return null; o = o || {};
    const tl = gsap.timeline({ paused: o.paused !== false, onComplete: () => { el.classList.add('is-in'); gsap.set($$('path', el), { clearProps: 'strokeDasharray,strokeDashoffset' }); } });
    $$('.pins__w', el).forEach((w) => {
      tl.fromTo($$('.pins__edge', w), DASH, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, 0);
      tl.fromTo($$('.pins__s', w), DASH, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out', stagger: o.stagger || 0.055 }, 0.25);
    });
    return tl;
  };
  Site.draw = function (target, o) {
    const el = el$(target); if (!el || !gsap) return null; o = o || {};
    const tl = gsap.timeline({ paused: o.paused !== false, onComplete: () => { el.classList.add('is-in'); gsap.set($$('path', el), { clearProps: 'strokeDasharray,strokeDashoffset' }); } });
    tl.fromTo($$('path', el), DASH, { strokeDashoffset: 0, duration: o.duration || 1.5, ease: 'power2.inOut', stagger: o.stagger == null ? 0.22 : o.stagger }, 0);
    return tl;
  };
  /* a band of light across an element that holds a .sheen child (or across .t-gold[data-sheen] type) */
  Site.sheen = function (target, o) {
    const el = el$(target); if (!el || !motion) return null; o = o || {};
    const band = el.classList.contains('sheen') ? el : $(':scope > .sheen, :scope .sheen', el);
    if (band) return gsap.timeline({ paused: !!o.paused })
      .set(band, { opacity: 1 }, 0)
      .fromTo(band, { xPercent: -46 }, { xPercent: 46, duration: o.duration || 1.9, ease: 'power2.inOut' }, 0)
      .set(band, { opacity: 0 });
    return gsap.fromTo(el, { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: o.duration || 2.2, ease: 'power2.inOut', paused: !!o.paused });
  };
  /* the two whole rings: apart, drawing, travelling, weaving. state.d is the distance between centres (12 is the mark). */
  const RING = 8.6, CIRC = 2 * Math.PI * RING, TOUCH = 2 * RING, GAP = 11.5 * Math.PI / 180;
  Site.weave = function (target) {
    const svg = el$(target); if (!svg) return null;
    const gl = $('.weave__l', svg), gr = $('.weave__r', svg), pl = $('path', gl), pr = $('path', gr);
    const state = { d: 12, draw: 1 };
    const at = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
    function render() {
      const d = state.d;
      at(gl, 'transform', 'translate(' + (20 - d / 2).toFixed(3) + ' 12.5)');
      at(gr, 'transform', 'translate(' + (20 + d / 2).toFixed(3) + ' 12.5)');
      if (d >= TOUCH) {
        const L = clamp(state.draw, 0, 1), len = (CIRC * L).toFixed(3), vis = L < 0.004 ? 'hidden' : 'visible';
        /* the left ring starts half way round its path, so its dash has to come back in past the path's start: its pattern
           is exactly one turn long. (With the right ring's longer pattern the left ring stopped at half a ring while the two
           were apart, and jumped whole when they touched.) */
        at(pr, 'stroke-dasharray', len + ' ' + (CIRC + 1).toFixed(3)); at(pl, 'stroke-dasharray', len + ' ' + Math.max(0.001, CIRC * (1 - L)).toFixed(3));
        at(pl, 'visibility', vis); at(pr, 'visibility', vis);
        at(pl, 'stroke-dashoffset', (-CIRC / 2).toFixed(3)); at(pr, 'stroke-dashoffset', '0');
      } else {
        const h = Math.acos(Math.min(1, d / TOUCH)), half = GAP * clamp((TOUCH - d) / (TOUCH - 12), 0, 1), g = 2 * half * RING;
        const da = (CIRC - g).toFixed(3) + ' ' + g.toFixed(3);
        at(pl, 'stroke-dasharray', da); at(pr, 'stroke-dasharray', da);
        at(pl, 'stroke-dashoffset', (CIRC - g / 2 - RING * h).toFixed(3));              /* the left ring breaks at the bottom crossing */
        at(pr, 'stroke-dashoffset', (CIRC - g / 2 - RING * (Math.PI + h)).toFixed(3));  /* the right ring at the top one */
        at(pl, 'visibility', 'visible'); at(pr, 'visibility', 'visible');
      }
    }
    /* the distance that puts each ring's centre `inset` of the way in from the viewport's edges */
    function far(inset) {
      const r = svg.getBoundingClientRect(), unit = (r.width / 40) || 1, cx = r.left + r.width / 2;
      const reach = Math.max(cx, W.innerWidth - cx) * (1 - 2 * (inset == null ? 0.06 : inset));
      return Math.max(44, (2 * reach) / unit);
    }
    return { svg, state, render, far, set(d, draw) { state.d = d; if (draw != null) state.draw = draw; render(); } };
  };
  function weaveAuto(svg) {
    if (!motion || svg._wv) return; svg._wv = true;
    const w = Site.weave(svg); if (!w) return;
    gsap.fromTo(w.state, { d: () => w.far(), draw: 0 }, {
      d: 12, draw: 1, ease: 'power2.inOut', onUpdate: w.render, immediateRender: true,
      scrollTrigger: { trigger: svg, start: svg.dataset.weaveStart || 'top 92%', end: svg.dataset.weaveEnd || 'center 46%', scrub: 0.9, invalidateOnRefresh: true }
    });
  }

  /* ───────── the phone ───────── */
  Site.phone = function (target) {
    const el = el$(target); if (!el) return null; if (el._phone) return el._phone;
    const box = $('.phone__screen', el), screens = $$('.screen', box), mode = (box && box.dataset.screens) || 'fade';
    let cur = Math.max(0, screens.findIndex((s) => s.classList.contains('is-on')));
    const decode = (img) => (img && img.decode && img.tagName === 'IMG' ? img.decode().catch(() => {}) : Promise.resolve());
    function warm() { screens.forEach((s) => { if (s.loading === 'lazy') s.loading = 'eager'; }); }
    function show(i, o) {
      i = ((i % screens.length) + screens.length) % screens.length; o = o || {};
      if (i === cur || !screens[i]) return;
      const a = screens[cur], b = screens[i]; cur = i;
      const done = () => { a.classList.remove('is-on'); b.classList.add('is-on'); if (gsap) gsap.set([a, b], { clearProps: 'all' }); };
      if (!gsap || o.instant) return done();
      decode(b).then(() => {
        if (screens[cur] !== b) return;
        gsap.killTweensOf([a, b]);
        gsap.set(b, { visibility: 'visible', zIndex: 2, opacity: 1 });
        const d = o.duration || 0.9;
        if (mode === 'slide' && motion) { gsap.fromTo(b, { xPercent: 100 }, { xPercent: 0, duration: d, ease: 'power3.inOut', onComplete: done }); gsap.to(a, { xPercent: -28, duration: d, ease: 'power3.inOut' }); }
        else if (mode === 'rise' && motion) gsap.fromTo(b, { yPercent: 100 }, { yPercent: 0, duration: d, ease: 'power3.out', onComplete: done });
        else gsap.fromTo(b, { opacity: 0 }, { opacity: 1, duration: d * 0.85, ease: 'power2.out', onComplete: done });
      });
    }
    const api = el._phone = { el, screens, show, next: () => show(cur + 1), warm, get index() { return cur; } };
    /* turn through the screens while it is on screen */
    const every = num(box && box.dataset.autoplay, 0);
    if (every && gsap && screens.length > 1) {
      let call = null;
      const tick = () => { api.next(); call = gsap.delayedCall(every, tick); };
      Site.inView(el, { threshold: 0.4, margin: '0px', enter: () => { if (!call) call = gsap.delayedCall(every, tick); }, leave: () => { if (call) { call.kill(); call = null; } } });
    }
    Site.inView(el, { once: true, margin: '120% 0px 120% 0px', enter: warm });
    return api;
  };
  /* crossfade a phone's screens inside a scrubbed timeline: Site.screens(tl, phone, [20, 40, 60]) */
  Site.screens = function (tl, target, at, o) {
    const p = Site.phone(target); if (!p || !tl) return tl; o = o || {};
    p.warm();
    gsap.set(p.screens, { autoAlpha: (i) => (i === 0 ? 1 : 0) });
    at.forEach((pos, i) => { if (p.screens[i + 1]) tl.to(p.screens[i + 1], { autoAlpha: 1, duration: o.duration || 5, ease: 'power1.inOut' }, pos); });
    return tl;
  };
  /* the slow 3D settle, with the floor shadow gathering under it and one sweep of glass */
  Site.settle = function (target, o) {
    const el = el$(target); if (!el || !gsap) return null; o = o || {};
    const floor = $('.phone__floor', el), glass = $('.phone__sheen > b', el);
    const tl = gsap.timeline({ paused: o.paused !== false, defaults: { ease: 'power3.out' } });
    tl.fromTo(el, { y: o.y == null ? 140 : o.y, rotationX: o.rx == null ? 26 : o.rx, rotationY: o.ry == null ? -16 : o.ry, rotationZ: o.rz == null ? 3 : o.rz, scale: o.scale || 0.86, opacity: 0, transformPerspective: 1400 },
      { y: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, opacity: 1, duration: o.duration || 2, ease: 'power3.out' }, 0);
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power1.out' }, 0);
    if (floor) tl.fromTo(floor, { opacity: 0, scaleX: 0.55 }, { opacity: 1, scaleX: 1, duration: o.duration || 2 }, 0);
    if (glass) tl.fromTo(glass, { xPercent: -42, opacity: 1 }, { xPercent: 42, duration: 1.7, ease: 'power2.inOut' }, 0.5).set(glass, { opacity: 0 });
    return tl;
  };

  /* ───────── screens as cards: fan, deal ───────── */
  Site.fan = function (target, o) {
    const el = el$(target); if (!el || !gsap) return null;
    o = Object.assign({ spread: 0.78, rot: 7, drop: 0.07, shrink: 0.12, paused: true, stagger: 0.07, duration: 1.5 }, o || {});
    const items = $$(':scope > .shot', el), n = items.length, mid = (n - 1) / 2;
    const t = (i) => (mid ? (i - mid) / mid : 0);
    const iw = () => (items[0] ? items[0].offsetWidth : 0);
    const reach = () => Math.max(0, Math.min(el.offsetWidth, W.innerWidth) * o.spread - iw()) / 2;
    items.forEach((it, i) => { it.style.zIndex = String(Math.round(n - Math.abs(i - mid))); });
    const tl = gsap.timeline({ paused: o.paused, defaults: { ease: 'power3.out', duration: o.duration } });
    tl.fromTo(items, { x: 0, y: (i) => 30 + Math.abs(t(i)) * 10, rotation: 0, scale: 0.8, opacity: 0 }, {
      x: (i) => t(i) * reach(), y: (i) => t(i) * t(i) * o.drop * (items[0] ? items[0].offsetHeight : 0), rotation: (i) => t(i) * o.rot,
      scale: (i) => 1 - Math.abs(t(i)) * o.shrink, opacity: 1, stagger: { each: o.stagger, from: 'center' }
    }, 0);
    return tl;
  };

  /* ───────── scenes: a tall section, a stage that stays, a timeline the scroll plays ─────────
     Site.scene('#id', (tl, s) => { tl.to(...,  { duration: 20 }, 10) })   positions and durations run 0 to 100 */
  Site.scene = function (target, build, o) {
    const el = el$(target); if (!el) return null; o = o || {};
    const stage = $('.scene__stage', el) || el;
    const s = { el, stage, motion, $: (q) => $(q, el), $$: (q) => $$(q, el), vw: () => stage.offsetWidth || W.innerWidth, vh: () => Site.svh(), lvh: () => Site.lvh() };
    if (!motion) { if (o.rest) o.rest(s); return null; }
    /* when the next section is a .sheet--over, the last screen of this one is spent under it: the timeline ends a screen early */
    const covered = !!(el.nextElementSibling && el.nextElementSibling.classList.contains('sheet--over'));
    const tl = gsap.timeline({
      defaults: { ease: 'none', duration: 10 },
      scrollTrigger: {
        trigger: el, start: o.start || 'top top', end: o.end || (covered ? 'bottom 200%' : 'bottom bottom'), scrub: o.scrub == null ? 0.9 : o.scrub, invalidateOnRefresh: true,
        onToggle: (st) => { el.classList.toggle('is-live', st.isActive); if (o.onToggle) o.onToggle(st.isActive, st); },
        onUpdate: o.onUpdate ? (st) => o.onUpdate(st.progress, st) : undefined
      }
    });
    tl.to({}, { duration: 100 }, 0);
    tl.eventCallback('onUpdate', () => { if (Site.header) Site.header.refresh(); });
    build(tl, s);
    el._scene = tl;
    return tl;
  };
  /* captions that take turns in a scrubbed timeline: each rises in, holds and leaves. ranges: [[in, out], …] in 0–100 */
  Site.beats = function (tl, targets, ranges, o) {
    o = Object.assign({ y: 26, fade: 4 }, o || {});
    const els = typeof targets === 'string' ? $$(targets) : targets;
    els.forEach((el, i) => {
      const r = ranges[i]; if (!r) return;
      const first = i === 0 && r[0] <= 0, last = r[1] == null || r[1] >= 100;
      if (!first) tl.fromTo(el, { autoAlpha: 0, y: o.y }, { autoAlpha: 1, y: 0, duration: o.fade, ease: 'power2.out' }, r[0]);
      else gsap.set(el, { autoAlpha: 1, y: 0 });
      if (!last) tl.to(el, { autoAlpha: 0, y: -o.y, duration: o.fade, ease: 'power2.in' }, r[1] - o.fade);
    });
    return tl;
  };

  /* ───────── live vignettes: a small looping scene that plays only while it is on screen ───────── */
  Site.vignette = function (target, build, o) {
    const el = el$(target); if (!el || !motion) return null; o = o || {};
    const tl = gsap.timeline({ paused: true, repeat: o.loop === false ? 0 : -1, repeatDelay: o.repeatDelay == null ? 1.6 : o.repeatDelay, defaults: { ease: EASE, duration: 0.7 } });
    build(tl, el);
    if (o.loop !== false && o.soft !== false) tl.eventCallback('onRepeat', () => gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }));
    Site.inView(el, { threshold: o.threshold == null ? 0.3 : o.threshold, margin: '0px', enter: () => tl.play(), leave: () => tl.pause() });
    el._vignette = tl;
    return tl;
  };

  /* ───────── pointer: tilt with a sheen, and a magnetic pull (fine pointers only) ───────── */
  function tilt(el) {
    if (!motion || !fine || el._tilt) return; el._tilt = true;
    const max = num(el.dataset.tilt, 7), band = $('.sheen', el);
    gsap.set(el, { transformPerspective: 1000 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, { rotationY: px * max * 2, rotationX: -py * max * 2, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
      if (band) gsap.to(band, { xPercent: px * 60, opacity: 1, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { rotationY: 0, rotationX: 0, duration: 1.1, ease: 'power3.out', overwrite: 'auto' });
      if (band) gsap.to(band, { opacity: 0, duration: 0.6, overwrite: 'auto' });
    });
  }
  function magnet(el) {
    if (!motion || !fine || el._mag) return; el._mag = true;
    const pull = num(el.dataset.magnet, 0.28);
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { '--mx': ((e.clientX - r.left - r.width / 2) * pull).toFixed(1) + 'px', '--my': ((e.clientY - r.top - r.height / 2) * pull).toFixed(1) + 'px', duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { '--mx': '0px', '--my': '0px', duration: 0.9, ease: 'elastic.out(1,0.6)', overwrite: 'auto' }));
  }
  function sheenAuto(el) {
    if (!motion || el._sh) return; el._sh = true;
    Site.inView(el, { once: true, margin: '0px 0px -20% 0px', enter: () => { const t = Site.sheen(el); if (t && t.delay) t.delay(num(el.dataset.delay, 0.3)); } });
    if (fine && !el.hasAttribute('data-tilt')) el.addEventListener('pointerenter', () => { if (!el._shT || !el._shT.isActive()) el._shT = Site.sheen(el, { duration: 1.4 }); });
  }

  /* ───────── keys: the press, on touch as well ───────── */
  function keys() {
    D.addEventListener('touchstart', () => {}, { passive: true });
    let down = null, t0 = 0;
    const up = () => { if (!down) return; const k = down, wait = Math.max(0, 110 - (performance.now() - t0)); down = null; setTimeout(() => k.classList.remove('is-down'), wait); };
    D.addEventListener('pointerdown', (e) => { const k = e.target.closest && e.target.closest('.key'); if (!k) return; down = k; t0 = performance.now(); k.classList.add('is-down'); }, { passive: true });
    ['pointerup', 'pointercancel', 'dragend'].forEach((ev) => D.addEventListener(ev, up, { passive: true }));
    W.addEventListener('blur', up);
    W.addEventListener('pageshow', () => $$('.key.is-down').forEach((k) => k.classList.remove('is-down')));
  }

  /* ───────── header: what it stands on, and the phone menu ───────── */
  function header() {
    const hdr = $('.hdr'); if (!hdr) return;
    const menu = $('#menu'), btn = $('.hdr__menu', hdr), main = $('main'), foot = $('.foot');
    const meta = $('meta[name="theme-color"]'), world = getComputedStyle(hdr).getPropertyValue('--world').trim() || '#4F5B29';
    let queued = false, open = false;
    function theme() {
      queued = false;
      if (open) return;
      const y = hdr.offsetHeight / 2;
      let t = 'paper';
      const stack = D.elementsFromPoint ? D.elementsFromPoint(Math.min(W.innerWidth - 4, W.innerWidth * 0.5), y) : [];
      for (let i = 0; i < stack.length; i++) {
        const e = stack[i];
        if (hdr.contains(e) || (menu && menu.contains(e)) || e === H || e === D.body) continue;
        const sec = e.closest('[data-header]');
        if (sec) t = sec.dataset.header;
        break;
      }
      if (hdr.dataset.theme !== t) {
        hdr.dataset.theme = t;
        if (meta) meta.setAttribute('content', t === 'dark' || t === 'world' ? world : '#FFFFFF');
      }
    }
    const ask = () => { if (!queued) { queued = true; requestAnimationFrame(theme); } };
    W.addEventListener('scroll', ask, { passive: true });
    W.addEventListener('resize', ask, { passive: true });
    Site.header = { refresh: ask, el: hdr };
    theme();
    if (!btn || !menu) return;
    function set(on) {
      open = on;
      btn.setAttribute('aria-expanded', String(on));
      btn.setAttribute('aria-label', on ? 'Close the menu' : 'Menu');
      hdr.classList.toggle('is-menu', on);
      if (on) { menu.hidden = false; void menu.offsetWidth; menu.classList.add('is-open'); }
      else { menu.classList.remove('is-open'); setTimeout(() => { if (!open) menu.hidden = true; }, 480); theme(); }
      if (main) main.inert = on; if (foot) foot.inert = on;
      if (Site.lenis) Site.lenis[on ? 'stop' : 'start']();
      H.style.overflow = on ? 'hidden' : '';
      if (on) { const first = $('a', menu); if (first) setTimeout(() => first.focus({ preventScroll: true }), 60); }
    }
    btn.addEventListener('click', () => set(!open));
    D.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { set(false); btn.focus(); } });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    mq('(min-width: 720px)').addEventListener('change', (e) => { if (e.matches && open) set(false); });
    W.addEventListener('pageshow', () => { if (open) set(false); });
  }

  /* ───────── sections that hold while the next sheet slides over ───────── */
  function holds() {
    const els = $$('.hold'); if (!els.length) return;
    const set = () => { const vh = Site.svh(); els.forEach((el) => el.style.setProperty('--hold-top', Math.min(0, vh - el.offsetHeight) + 'px')); };
    set();
    if (W.ResizeObserver) { const ro = new ResizeObserver(set); els.forEach((el) => ro.observe(el)); }
    W.addEventListener('resize', set, { passive: true });
    els.forEach((el) => {
      const next = el.nextElementSibling; if (!next || el.dataset.hold === 'still') return;
      gsap.to(el, {
        scale: num(el.dataset.hold, 0.955), ease: 'none', transformOrigin: () => '50% ' + (el.offsetHeight - Site.svh() / 2) + 'px',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true }
      });
    });
  }

  /* ───────── smooth wheel on a desk; a phone keeps its own scrolling ───────── */
  function smooth() {
    if (!fine || !W.Lenis) return;
    const lenis = Site.lenis = new W.Lenis({ lerp: 0.105, smoothWheel: true, syncTouch: false, anchors: true, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ───────── wire every data-attribute under a root ───────── */
  Site.scan = function (root) {
    root = root || D;
    $$('[data-phone]', root).forEach((el) => {
      const p = Site.phone(el);
      if (motion && el.dataset.phone === 'settle' && !el._settled) { el._settled = true; const tl = Site.settle(el); Site.inView(el, { once: true, margin: '0px 0px -16% 0px', enter: () => tl.play(), above: () => tl.progress(1) }); }
      return p;
    });
    if (!libs) return;
    $$('[data-count]', root).forEach(counter);
    if (!motion) return;
    $$('[data-reveal]', root).forEach(reveal);
    $$('[data-reveal-group]', root).forEach(revealGroup);
    $$('[data-lit]', root).forEach(lit);
    $$('[data-parallax]', root).forEach(parallax);
    $$('[data-pins]', root).forEach((el) => { if (el._pins || el.dataset.pins === 'manual') return; el._pins = true; const tl = Site.pins(el); Site.inView(el, { once: true, margin: '0px 0px -12% 0px', enter: () => tl.play(), above: () => tl.progress(1) }); });
    $$('[data-draw]', root).forEach((el) => { if (el._draw || el.dataset.draw === 'manual') return; el._draw = true; const tl = Site.draw(el); Site.inView(el, { once: true, margin: '0px 0px -12% 0px', enter: () => tl.play(), above: () => tl.progress(1) }); });
    $$('[data-weave]', root).forEach(weaveAuto);
    $$('[data-sheen]', root).forEach(sheenAuto);
    $$('[data-tilt]', root).forEach(tilt);
    $$('[data-magnet]', root).forEach(magnet);
    $$('[data-fan]', root).forEach((el) => { if (el._fan || el.dataset.fan === 'manual') return; el._fan = true; const tl = Site.fan(el); Site.inView(el, { once: true, margin: '0px 0px -18% 0px', enter: () => tl.play(), above: () => tl.progress(1) }); });
  };

  /* ───────── start ───────── */
  const queue = [];
  let started = false;
  Site.ready = function (fn) { if (started) { try { fn(Site); } catch (e) { fail(e); } } else queue.push(fn); };
  Site.refresh = function () { if (ScrollTrigger) ScrollTrigger.refresh(); if (Site.header) Site.header.refresh(); };
  function fail(e) { if (W.console) console.error(e); }

  function start() {
    D.body.appendChild(probe); D.body.appendChild(probeL);
    if (libs) {
      gsap.registerPlugin(ScrollTrigger, SplitText);
      gsap.config({ nullTargetWarn: false });
      gsap.defaults({ ease: EASE, duration: 1 });
      ScrollTrigger.config({ ignoreMobileResize: true });
      ScrollTrigger.addEventListener('refreshInit', () => H.classList.add('is-measuring'));
      ScrollTrigger.addEventListener('refresh', () => { H.classList.remove('is-measuring'); if (Site.header) Site.header.refresh(); });
    }
    try { keys(); header(); } catch (e) { fail(e); }
    try {
      if (motion) { smooth(); holds(); }
      Site.scan(D);
      clearTimeout(W.__siteFail);
    } catch (e) { fail(e); if (W.__siteOff) W.__siteOff(); }
    started = true;
    queue.splice(0).forEach((fn) => { try { fn(Site); } catch (e) { fail(e); } });
    if (libs) {
      fontsReady.then(() => ScrollTrigger.refresh());
      W.addEventListener('load', () => ScrollTrigger.refresh());
    }
    H.classList.add('site-ready');
  }
  /* page scripts are deferred after this file, so they can queue with Site.ready before we start */
  const go = () => { if (!started && !go.ran) { go.ran = true; start(); } };
  if (D.readyState === 'complete') go();
  else { D.addEventListener('DOMContentLoaded', go); W.addEventListener('load', go); }
})();
