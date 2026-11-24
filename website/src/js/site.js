/* Nosca's website: the engine. One file on GSAP, ScrollTrigger, SplitText and Lenis.
   It wires the data-attribute behaviours and exposes a small global, Site, for page scripts.
   Motion runs only when this file has loaded and the visitor allows it (html.motion);
   otherwise every page rests on its finished layout. See API.md.

   The motion library (BRIEF §5): the scroll is a film reel the visitor turns by hand. Every piece below is
   SCRUBBED by the scroll, moves transform, opacity and clip-path only, and takes the same options:
     { tl, at, duration }           play inside a film's timeline (positions 0 to 100), or
     { start, end, scrub, trigger } play on its own passage through the screen (the default).            */
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
  const SMALL = '(max-width: 719px)';

  const Site = W.Site = {
    motion, fine, gsap, ScrollTrigger, SplitText, lenis: null,
    $, $$, clamp,
    reduced: mq('(prefers-reduced-motion: reduce)').matches,
    wide: () => W.innerWidth >= 900,
    small: () => mq(SMALL).matches
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

  /* ───────── the one way a scrubbed piece is driven ─────────
     Inside a film: its tweens go straight onto the film's own timeline (never a nested one: a nested timeline's
     start state does not survive a ScrollTrigger refresh). On its own: one timeline, 0 to 100, on its passage. */
  function drive(el, o, d, build) {
    o = o || {};
    if (o.tl) {
      const had = o.tl.getChildren(false, true, true);
      build(o.tl, o.at == null ? 0 : o.at, o.duration == null ? (d.duration || 20) : o.duration);
      const made = o.tl.getChildren(false, true, true).filter((c) => had.indexOf(c) < 0);
      return { tl: o.tl, kill: () => made.forEach((c) => c.kill()) };
    }
    const ds = el.dataset || {};
    const st = { trigger: o.trigger || d.trigger || el, scrub: o.scrub != null ? o.scrub : ds.scrub != null ? (ds.scrub === 'true' ? true : num(ds.scrub, d.scrub)) : d.scrub, invalidateOnRefresh: true };
    if (o.containerAnimation) { st.containerAnimation = o.containerAnimation; st.start = o.start || 'left 96%'; st.end = o.end || 'left 30%'; st.scrub = true; }
    else { st.start = o.start || ds.start || d.start; st.end = o.end || ds.end || d.end; }
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: st });
    build(tl, 0, 100);
    return { tl, kill: () => { if (tl.scrollTrigger) tl.scrollTrigger.kill(); tl.kill(); } };
  }
  /* one tween a target, each put straight on the timeline. A stagger makes a nested timeline, and on a scrubbed
     timeline the targets it has not reached yet would sit in their finished state until it gets to them. */
  function each(tl, targets, from, to, at, spread) {
    const n = targets.length, step = n > 1 ? spread / (n - 1) : 0;
    targets.forEach((t, i) => tl.fromTo(t, Object.assign({}, from), Object.assign({}, to), at + i * step));
  }
  /* pieces that stand on a pinned stage cannot be driven by their own passage: the film or the rail drives them */
  const staged = (el) => !!el.closest('.film__stage, .scene__stage, .rail__stage');

  /* ───────── text: line and word reveals, lit words ───────── */
  Site.split = function (target, type, opts) {
    const el = el$(target); if (!el || !SplitText) return null;
    return SplitText.create(el, Object.assign({ type: type || 'lines', linesClass: 'split-line', wordsClass: 'split-word' }, opts || {}));
  };
  /* <i lang="ga">nascadh</i>, linking.  Split into words, the comma could fall to the next line: keep it with its word. */
  function glue(el) {
    $$('i, em, b, strong, a', el).forEach((n) => {
      const t = n.nextSibling, m = t && t.nodeType === 3 ? /^[,.;:!?)\u2019\u201D]+/.exec(t.nodeValue) : null;
      if (!m || (n.parentNode.classList && n.parentNode.classList.contains('nw'))) return;
      const w = D.createElement('span'); w.className = 'nw';
      n.parentNode.insertBefore(w, n); w.appendChild(n); w.appendChild(D.createTextNode(m[0])); t.nodeValue = t.nodeValue.slice(m[0].length);
    });
  }
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
      if (kind !== 'lines') glue(el);
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
    glue(el);
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

  /* a headline that fills with ink line by line as the scroll passes. The dim line stays; a full-ink copy of
     each line lies on it and opens from the left through a clip-path. Site.inkFill(el, { tl, at, duration }) in a film. */
  Site.inkFill = function (target, o) {
    const el = el$(target); if (!el || !motion || el._ink) return null; el._ink = true; o = o || {};
    let made = null;
    fontsReady.then(() => {
      SplitText.create(el, {
        type: 'lines', linesClass: 'ink-line', autoSplit: true,
        onSplit(self) {
          if (made) made.kill();
          const fills = self.lines.map((ln) => {
            const f = D.createElement('span'); f.className = 'ink-fill'; f.setAttribute('aria-hidden', 'true'); f.innerHTML = ln.innerHTML; ln.appendChild(f); return f;
          });
          el.classList.add('is-set');
          made = drive(el, o, { start: 'clamp(top 82%)', end: 'clamp(bottom 46%)', scrub: 0.4 }, (tl, at, dur) => {
            const each = dur / Math.max(1, fills.length);
            fills.forEach((f, i) => tl.fromTo(f, { clipPath: 'inset(-12% 100% -24% 0%)' }, { clipPath: 'inset(-12% 0% -24% 0%)', duration: each, ease: 'none' }, at + i * each));
          });
          if (!o.tl) return made.tl;
        }
      });
    });
    return el;
  };
  /* words rising out of their line's mask as the scroll brings the line in (the scrubbed cousin of data-reveal="words") */
  Site.rise = function (target, o) {
    const el = el$(target); if (!el || !motion || el._rise) return null; el._rise = true; o = o || {};
    const by = o.by || el.dataset.rise || 'words';
    let made = null;
    if (by !== 'lines') glue(el);
    fontsReady.then(() => {
      SplitText.create(el, {
        type: by === 'lines' ? 'lines' : 'lines,words', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit(self) {
          if (made) made.kill();
          const bits = by === 'lines' ? self.lines : self.words;
          el.classList.add('is-set');
          made = drive(el, o, { start: 'clamp(top 96%)', end: 'clamp(top 58%)', scrub: 0.5 }, (tl, at, dur) => {
            each(tl, bits, { yPercent: 118 }, { yPercent: 0, duration: dur * 0.5, ease: 'power2.out' }, at, dur * 0.5);
          });
          if (!o.tl) return made.tl;
        }
      });
    });
    return el;
  };

  /* ───────── depth ───────── */
  function parallax(el) {
    if (!motion || el._px) return; el._px = true;
    const f = num(el.dataset.parallax, 0.12), rot = num(el.dataset.parallaxRotate, 0);
    gsap.fromTo(el, { y: () => f * Site.lvh() * 0.5, rotation: -rot }, {
      y: () => -f * Site.lvh() * 0.5, rotation: rot, ease: 'none',
      scrollTrigger: { trigger: el.closest('[data-parallax-root]') || el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
    });
  }
  /* layers moving at different rates: <div data-depth="0.18"> <img data-z="-1"> <h2 data-z="0.4"> … </div>
     data-z is how far forward a layer stands (1 moves a full range against the scroll, -1 with it, 0 not at all);
     the range is data-depth of a screen. data-z-scale lets a far layer breathe a little as it goes. */
  Site.depth = function (target, o) {
    const el = el$(target); if (!el || !motion) return null; if (el._depth && !(o && o.tl)) return el._depth; o = o || {};
    const layers = $$('[data-z]', el), range = num(o.range != null ? o.range : el.dataset.depth, 0.16);
    const r = drive(el, o, { start: 'top bottom', end: 'bottom top', scrub: true }, (tl, at, dur) => {
      layers.forEach((l) => {
        const z = num(l.dataset.z, 0), sc = num(l.dataset.zScale, 0);
        tl.fromTo(l, { y: () => z * range * Site.lvh(), scale: 1 + Math.max(0, sc) }, { y: () => -z * range * Site.lvh(), scale: 1 + Math.max(0, -sc), duration: dur, ease: 'none' }, at);
      });
    });
    return (el._depth = r.tl);
  };

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

  /* ───────── gold: pinstripes and rules that draw, rings that draw, a pass of light ───────── */
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
  /* the card's gold drawing itself WITH the scroll: the pinstripe wedges line by line behind their edge, a gold
     rule from its left end, or any svg whose paths carry pathLength="1" (the mark, a diagram). */
  Site.drawStripes = function (target, o) {
    const el = el$(target); if (!el || !motion) return null; if (el._stripes && !(o && o.tl)) return el._stripes; o = o || {};
    let r;
    if (el.classList.contains('rule-gold') || el.hasAttribute('data-rule')) {
      r = drive(el, o, { start: 'clamp(top 96%)', end: 'clamp(top 60%)', scrub: 0.6 }, (tl, at, dur) => tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: dur, ease: 'power1.inOut' }, at));
    } else {
      const wedges = $$('.pins__w', el);
      const loose = wedges.length ? [] : (el.matches('path, line') ? [el] : $$('path, line', el));
      r = drive(el, o, { trigger: el.classList.contains('pins') ? el.parentElement : el, start: 'clamp(top 90%)', end: 'clamp(top 24%)', scrub: 0.6 }, (tl, at, dur) => {
        wedges.forEach((w) => {
          tl.fromTo($$('.pins__edge', w), DASH, { strokeDashoffset: 0, duration: dur * 0.62, ease: 'power1.inOut' }, at);
          each(tl, $$('.pins__s', w), DASH, { strokeDashoffset: 0, duration: dur * 0.4, ease: 'power1.out' }, at + dur * 0.08, dur * 0.52);
        });
        if (loose.length) each(tl, loose, DASH, { strokeDashoffset: 0, duration: dur * (loose.length > 1 ? 0.7 : 1), ease: 'power1.inOut' }, at, dur * 0.3);
      });
    }
    el.classList.add('is-set');
    return (el._stripes = r.tl);
  };
  /* one quiet pass of light across an element that holds a .sheen child */
  Site.sheen = function (target, o) {
    const el = el$(target); if (!el || !motion) return null; o = o || {};
    const band = el.classList.contains('sheen') ? el : $(':scope > .sheen, :scope .sheen', el);
    if (!band) return null;
    return gsap.timeline({ paused: !!o.paused })
      .set(band, { opacity: 1 }, 0)
      .fromTo(band, { x: 0, xPercent: -46 }, { xPercent: 46, duration: o.duration || 1.9, ease: 'power2.inOut' }, 0)
      .set(band, { opacity: 0 });
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
        /* the left ring starts half way round its path, so its dash has to come back in past the path's start: its pattern is exactly one turn long */
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

  /* ───────── a ground giving way to another ─────────
     On a section (data-ground-shift): its ground arrives as the card's diagonal. A wedge of it, closed by the gold
     edge, rises out of the section before and levels as the section reaches the top of the screen. Nothing is
     pinned, so nothing inside the section measures wrong.
     On a layer inside a film (Site.groundShift(layer, { tl, at, duration, shape })): the layer's clip-path opens
     over the pinned stage: 'wedge' (the card's diagonal, from the lower left), 'rise' (from the foot), 'iris' (a circle). */
  const CLIP = {
    wedge: ['polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)', 'polygon(0% -46%, 100% 0%, 100% 100%, 0% 100%)'],
    rise: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'],
    iris: ['circle(0% at 50% 56%)', 'circle(142% at 50% 56%)']
  };
  Site.groundShift = function (target, o) {
    const el = el$(target); if (!el || !motion) return null; o = o || {};
    if (o.tl) {
      const c = CLIP[o.shape || el.dataset.groundShift] || CLIP.wedge;
      o.tl.fromTo(el, { clipPath: c[0] }, { clipPath: c[1], duration: o.duration == null ? 16 : o.duration, ease: o.ease || 'power1.inOut' }, o.at || 0);
      return o.tl;
    }
    if (el._shift) return el._shift;
    /* the apron lies on the foot of the section before, so nothing this section clips can cut it off */
    const prev = el.previousElementSibling; if (!prev) return null;
    const cs = getComputedStyle(el);
    if (getComputedStyle(prev).position === 'static') prev.style.position = 'relative';
    const apron = D.createElement('div'); apron.className = 'shift__apron'; apron.setAttribute('aria-hidden', 'true');
    apron.innerHTML = '<i class="shift__fill"></i><i class="shift__edge"></i>';
    apron.style.setProperty('--shift-bg', cs.backgroundColor);
    apron.style.setProperty('--shift-rule', cs.getPropertyValue('--rule').trim() || '#C2A24C');
    prev.appendChild(apron);
    el.classList.add('is-shift');
    const fill = apron.firstChild, edge = apron.lastChild;
    let lead = 0, width = 0;
    /* a plain section before it is given a foot as tall as the wedge, so the wedge crosses air and never the
       section's words; a film, a rail or a held section keeps its own height and the wedge crosses its last frame */
    const fixed = prev.matches('.film, .scene, .rail, .hold');
    const size = () => {
      width = el.offsetWidth || W.innerWidth;
      /* the card's wedge runs at 34.7 degrees; never more than half a screen ahead (data-shift-lead="0.5") */
      lead = Math.round(Math.min(width * 0.6915, Site.svh() * num(el.dataset.shiftLead, 0.5)));
      apron.style.height = lead + 'px';
      if (!fixed) { prev.style.paddingBottom = ''; if ((parseFloat(getComputedStyle(prev).paddingBottom) || 0) < lead + 24) prev.style.paddingBottom = (lead + 24) + 'px'; }
    };
    const render = (p) => {
      const q = 1 - clamp(p, 0, 1), top = (1 - q) * 100;
      fill.style.clipPath = 'polygon(0% ' + top.toFixed(2) + '%, 100% 100%, 0% 100%)';
      edge.style.transform = 'rotate(' + (Math.atan2(lead * q, width) * 180 / Math.PI).toFixed(3) + 'deg)';
      edge.style.opacity = q < 0.02 ? '0' : '1';
    };
    size(); render(0);
    return (el._shift = ScrollTrigger.create({
      trigger: el, start: 'top bottom', end: () => 'top ' + Math.round(Math.min(Site.svh() * 0.14, 120)) + 'px',
      onRefreshInit: size, onRefresh: (st) => render(st.progress), onUpdate: (st) => render(st.progress)
    }));
  };

  /* ───────── the phone ───────── */
  Site.phone = function (target) {
    const el = el$(target); if (!el) return null; if (el._phone) return el._phone;
    const box = $('.phone__screen', el), screens = $$('.screen', box), mode = (box && box.dataset.screens) || 'fade';
    let cur = Math.max(0, screens.findIndex((s) => s.classList.contains('is-on')));
    const decode = (img) => (img && img.decode && img.tagName === 'IMG' ? img.decode().catch(() => {}) : Promise.resolve());
    function warm() { screens.forEach((s) => { if (s.loading === 'lazy') s.loading = 'eager'; const i = s.tagName === 'IMG' ? null : $('img', s); if (i && i.loading === 'lazy') i.loading = 'eager'; }); }
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
    /* turn through the screens while it is on screen (never under Reduce Motion: everything is still) */
    const every = num(box && box.dataset.autoplay, 0);
    if (every && gsap && motion && screens.length > 1) {
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
  /* the device in a film: Site.device(phone) is Site.phone(phone) with three things a timeline can play.
       d.swap(tl, [30, 60], { mode: 'fade|slide|rise|push', duration })   the screens change inside it
       d.turn(tl, { from: [ry, rx, rz], to: [0, 0, 0], at, duration })   it turns in 3D
       d.zoom(tl, { from: 'bleed' | 'tall' | 1.8, at, duration })        its screen fills the stage, then draws back into the frame */
  Site.device = function (target) {
    const p = Site.phone(target); if (!p || !gsap) return p; if (p.zoom) return p;
    const el = p.el, box = $('.phone__screen', el), floor = $('.phone__floor', el);
    const stageOf = () => el.closest('.film__stage, .scene__stage, .rail__stage');
    const offs = (node, root) => { let x = 0, y = 0, e = node; while (e && e !== root) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y }; };
    p.swap = function (tl, at, o) {
      o = o || {}; const mode = o.mode || (box && box.dataset.screens) || 'fade', d = o.duration || 5, ease = o.ease || 'power2.inOut';
      p.warm();
      gsap.set(p.screens, { autoAlpha: (i) => (i === 0 || mode !== 'fade' ? 1 : 0) });
      at.forEach((pos, i) => {
        const a = p.screens[i], b = p.screens[i + 1]; if (!b) return;
        if (mode === 'slide') { tl.fromTo(b, { xPercent: 101 }, { xPercent: 0, duration: d, ease }, pos); tl.fromTo(a, { xPercent: 0 }, { xPercent: -28, duration: d, ease, immediateRender: false }, pos); }
        else if (mode === 'rise') tl.fromTo(b, { yPercent: 101 }, { yPercent: 0, duration: d, ease: o.ease || 'power2.out' }, pos);
        else if (mode === 'push') { tl.fromTo(b, { yPercent: 101 }, { yPercent: 0, duration: d, ease }, pos); tl.fromTo(a, { yPercent: 0 }, { yPercent: -101, duration: d, ease, immediateRender: false }, pos); }
        else tl.to(b, { autoAlpha: 1, duration: d, ease: 'power1.inOut' }, pos);
      });
      return p;
    };
    p.turn = function (tl, o) {
      o = Object.assign({ from: [-26, 10, 2], to: [0, 0, 0], at: 0, duration: 24, ease: 'power2.out' }, o || {});
      tl.fromTo(el, { rotationY: o.from[0], rotationX: o.from[1], rotationZ: o.from[2] || 0, transformPerspective: 1600 },
        { rotationY: o.to[0], rotationX: o.to[1], rotationZ: o.to[2] || 0, duration: o.duration, ease: o.ease }, o.at);
      return p;
    };
    p.zoom = function (tl, o) {
      o = Object.assign({ from: 'bleed', at: 0, duration: 18, ease: 'power2.inOut' }, o || {});
      const geo = () => {
        const st = stageOf(), sw = st ? st.clientWidth : W.innerWidth, sh = Site.svh(), bw = box.offsetWidth || 1, bh = box.offsetHeight || 1;
        /* a 660px frame filling a desk's screen is soft: data-zoom-wide="tall" (or o.wide) names a gentler start from 900 up */
        const wide = W.innerWidth >= 900 && (o.wide || el.dataset.zoomWide), from = wide ? (isNaN(+wide) ? wide : +wide) : o.from;
        const s = from === 'bleed' ? Math.max(sw / bw, sh / bh) * 1.1 : from === 'tall' ? sh / bh : (+from || 1.6);
        const c = st ? offs(el, st) : { x: el.getBoundingClientRect().left, y: 0 };
        return { s, x: sw / 2 - (c.x + el.offsetWidth / 2), y: st ? sh / 2 - (c.y + el.offsetHeight / 2) : 0 };
      };
      tl.fromTo(el, { scale: () => geo().s, x: () => geo().x, y: () => geo().y }, { scale: 1, x: 0, y: 0, duration: o.duration, ease: o.ease }, o.at);
      if (floor) tl.fromTo(floor, { opacity: 0 }, { opacity: 1, duration: o.duration * 0.5, ease: 'none' }, o.at + o.duration * 0.5);
      return p;
    };
    return p;
  };
  /* the slow 3D settle of a phone on entering (time-based), with the floor shadow gathering under it */
  function phoneSettle(el, o) {
    o = o || {};
    const floor = $('.phone__floor', el), glass = $('.phone__sheen > b', el);
    const tl = gsap.timeline({ paused: o.paused !== false, defaults: { ease: 'power3.out' } });
    tl.fromTo(el, { y: o.y == null ? 140 : o.y, rotationX: o.rx == null ? 26 : o.rx, rotationY: o.ry == null ? -16 : o.ry, rotationZ: o.rz == null ? 3 : o.rz, scale: o.scale || 0.86, opacity: 0, transformPerspective: 1400 },
      { y: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, opacity: 1, duration: o.duration || 2, ease: 'power3.out' }, 0);
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power1.out' }, 0);
    if (floor) tl.fromTo(floor, { opacity: 0, scaleX: 0.55 }, { opacity: 1, scaleX: 1, duration: o.duration || 2 }, 0);
    if (glass) tl.fromTo(glass, { x: 0, xPercent: -42, opacity: 1 }, { xPercent: 42, duration: 1.7, ease: 'power2.inOut' }, 0.5).set(glass, { opacity: 0 });
    return tl;
  }
  /* a photograph that settles: its frame opens (clip-path) and the picture comes to rest from a slow scale, then
     keeps a little drift for as long as it is on screen. Site.settle(figure) on <figure class="photo">.
     (Handed a .phone it is the phone's entrance, as it always was.) */
  Site.settle = function (target, o) {
    const el = el$(target); if (!el || !gsap) return null;
    if (el.classList.contains('phone')) return phoneSettle(el, o);
    if (!motion) return null; if (el._settle && !(o && o.tl)) return el._settle; o = o || {};
    const pic = $(':scope > img, :scope > picture, :scope > video', el) || el.firstElementChild;
    const open = o.open || el.dataset.settle || '9% 7% 9% 7%';
    const r = drive(el, o, { start: 'top bottom', end: 'bottom top', scrub: 0.7 }, (tl, at, dur) => {
      if (open !== 'none') tl.fromTo(el, { clipPath: 'inset(' + open + ')' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur * (o.containerAnimation ? 1 : 0.42), ease: 'power2.out' }, at);
      if (pic) {
        tl.fromTo(pic, { scale: num(o.scale, 1.24) }, { scale: 1.07, duration: dur * (o.containerAnimation ? 1 : 0.56), ease: 'power2.out' }, at);
        if (o.containerAnimation) tl.fromTo(pic, { xPercent: 3 }, { xPercent: 0, duration: dur, ease: 'none' }, at);
        else tl.fromTo(pic, { yPercent: 3.4 }, { yPercent: -3.4, duration: dur, ease: 'none' }, at);
      }
    });
    return (el._settle = r.tl);
  };

  /* ───────── the business card as an object ─────────
     c = Site.card(card)   c.turn(tl, { at, duration, from: 0, to: 180, tilt: [rx, rz] })  it turns over in a film
     <div class="bcard" data-card-turn> turns from its front to its back on its own passage through the screen.
     A pass of light crosses the face that is arriving (never a glow), if the card carries its .sheen. */
  Site.card = function (target) {
    const el = el$(target); if (!el) return null; if (el._card) return el._card;
    const flip = $('.bcard__flip', el), front = $('.bcard__front', el), back = $('.bcard__back', el);
    const api = el._card = {
      el, flip, front, back,
      turn(tl, o) {
        o = Object.assign({ at: 0, duration: 24, from: 0, to: 180, tilt: [0, 0], ease: 'power2.inOut', sheen: true }, o || {});
        if (!gsap || !flip) return api;
        tl.fromTo(flip, { rotationY: o.from, rotationX: o.tilt[0] || 0, rotationZ: o.tilt[1] || 0 }, { rotationY: o.to, rotationX: 0, rotationZ: 0, duration: o.duration, ease: o.ease }, o.at);
        const face = (o.to / 180) % 2 ? back : front, band = o.sheen && face ? $('.sheen', face) : null;
        if (band) tl.set(band, { opacity: 1 }, o.at + o.duration * 0.5).fromTo(band, { x: 0, xPercent: -46 }, { xPercent: 46, duration: o.duration * 0.6, ease: 'power1.inOut' }, o.at + o.duration * 0.5).set(band, { opacity: 0 }, o.at + o.duration * 1.12);
        return api;
      }
    };
    return api;
  };
  function cardTurn(el) {
    if (!motion || el._ct) return; el._ct = true;
    const c = Site.card(el); if (!c || !c.flip) return;
    const back = el.classList.contains('is-back');   /* it ends on the face the markup shows */
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: el, start: el.dataset.start || 'top 92%', end: el.dataset.end || 'center 52%', scrub: 0.9 } });
    c.turn(tl, { at: 0, duration: 100, from: back ? 0 : 180, to: back ? 180 : 0, tilt: [8, -3] });
  }

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

  /* ───────── an image sequence on a canvas, drawn by scroll position (Apple's own trick) ─────────
     <div class="seq" data-sequence="assets/seq/log/" data-frames="58" data-pattern="f%03d.webp" data-w data-h><img poster></div>
     (write it with <!-- @include seq name="log" -->). Frames load when it nears the screen: a coarse pass first, so a
     fast scroll always has a near frame to draw, then the rest. q = Site.sequence(el); q.p = 0…1; q.keys(tl, [[pos, p], …]). */
  Site.sequence = function (target, o) {
    const el = el$(target); if (!el) return null; o = o || {};
    let api = el._seq;
    if (!api) {
      const n = Math.max(1, num(el.dataset.frames, 1)), base = el.dataset.sequence || '', pat = el.dataset.pattern || 'f%03d.webp';
      const w = num(el.dataset.w, 660), h = num(el.dataset.h, 1428);
      const url = (i) => base + pat.replace(/%0(\d)d/, (_, k) => String(i).padStart(+k, '0'));
      const imgs = new Array(n), ok = new Array(n).fill(false);
      let canvas = null, ctx = null, shown = -1, want = 0, prog = 0, raf = 0, ready = null;
      const nearest = (i) => { if (ok[i]) return i; for (let d = 1; d < n; d++) { if (i - d >= 0 && ok[i - d]) return i - d; if (i + d < n && ok[i + d]) return i + d; } return -1; };
      const paint = () => {
        raf = 0; if (!ctx) return;
        const i = nearest(want); if (i < 0 || i === shown) return;
        ctx.drawImage(imgs[i], 0, 0, w, h); shown = i; el.classList.add('is-drawn');
      };
      const ask = () => { if (!raf && ctx) raf = requestAnimationFrame(paint); };
      const one = (i) => new Promise((res) => {
        const im = new Image(); im.decoding = 'async';
        const done = () => { imgs[i] = im; ok[i] = true; if (shown !== want) ask(); res(); };
        im.onload = () => { if (im.decode) im.decode().then(done, done); else done(); };
        im.onerror = () => res();
        im.src = url(i);
      });
      const load = () => {
        if (ready) return ready;
        canvas = D.createElement('canvas'); canvas.width = w; canvas.height = h; canvas.setAttribute('aria-hidden', 'true'); el.appendChild(canvas); ctx = canvas.getContext('2d');
        const order = [0, n - 1];
        for (let s = 8; s >= 1; s = s >> 1) for (let i = 0; i < n; i += s) if (order.indexOf(i) < 0) order.push(i);
        let k = 0; const worker = () => (k < order.length ? one(order[k++]).then(worker) : null);
        ready = Promise.all([worker(), worker(), worker(), worker()]);
        return ready;
      };
      api = el._seq = {
        el, frames: n, load,
        get p() { return prog; }, set p(v) { prog = clamp(v, 0, 1); want = Math.round(prog * (n - 1)); ask(); },
        frame(i) { api.p = clamp(i, 0, n - 1) / Math.max(1, n - 1); },
        at: (i) => clamp(i, 0, n - 1) / Math.max(1, n - 1),
        /* piecewise in a film: at timeline position pos the sequence stands at progress p */
        keys(tl, pts) {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1]; if (b[0] <= a[0]) continue;
            tl.fromTo(api, { p: a[1] }, { p: b[1], duration: b[0] - a[0], ease: 'none', immediateRender: i === 0 }, a[0]);
          }
          return api;
        }
      };
      if (motion) Site.inView(el, { once: true, margin: '160% 0px 160% 0px', enter: load });
    }
    if (!motion) return api;
    if (o.tl) api.keys(o.tl, o.keys || [[o.at || 0, 0], [(o.at || 0) + (o.duration == null ? 100 : o.duration), 1]]);
    else if (o.scroll !== false && !api._own && !staged(el)) {
      api._own = gsap.fromTo(api, { p: 0 }, { p: 1, ease: 'none', scrollTrigger: { trigger: o.trigger || el, start: o.start || el.dataset.start || 'clamp(top 78%)', end: o.end || el.dataset.end || 'clamp(bottom 30%)', scrub: o.scrub == null ? 0.3 : o.scrub } });
    }
    return api;
  };

  /* ───────── video ─────────
     Site.scrubVideo(video): its currentTime is tied to the scroll (encode it with a keyframe every frame or two:
     ffmpeg -g 2 -an -movflags +faststart). It never plays, so it is silent and still off screen.
     video[data-video]: plays muted and inline while it is on screen, and is paused the moment it is not. */
  Site.scrubVideo = function (target, o) {
    let v = el$(target); if (!v) return null; if (v.tagName !== 'VIDEO') v = $('video', v); if (!v) return null; o = o || {};
    let api = v._scrub;
    if (!api) {
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.removeAttribute('autoplay'); v.removeAttribute('loop'); v.pause();
      let prog = 0, raf = 0, primed = false;
      const seek = () => {
        raf = 0; const dur = v.duration; if (!dur || !isFinite(dur) || v.seeking) return;
        const t = clamp(prog, 0, 1) * Math.max(0, dur - 0.04);
        if (Math.abs(v.currentTime - t) > 0.012) v.currentTime = t;
      };
      const ask = () => { if (!raf) raf = requestAnimationFrame(seek); };
      v.addEventListener('seeked', ask); v.addEventListener('loadedmetadata', ask); v.addEventListener('loadeddata', ask);
      const prime = () => {
        if (primed) return; primed = true; v.preload = 'auto';
        if (v.readyState < 2) { try { v.load(); } catch (e) { /* keeps its poster */ } }
        const pl = v.play(); if (pl && pl.then) pl.then(() => { v.pause(); ask(); }, () => {}); else v.pause();
      };
      api = v._scrub = { el: v, prime, get p() { return prog; }, set p(x) { prog = x; ask(); } };
      if (motion) Site.inView(v, { once: true, margin: '120% 0px 120% 0px', enter: prime });
    }
    if (!motion) return api;
    if (o.tl) o.tl.fromTo(api, { p: 0 }, { p: 1, duration: o.duration == null ? 100 : o.duration, ease: 'none' }, o.at || 0);
    else if (!api._own && !staged(v)) api._own = gsap.fromTo(api, { p: 0 }, { p: 1, ease: 'none', scrollTrigger: { trigger: o.trigger || v, start: o.start || v.dataset.start || 'clamp(top 80%)', end: o.end || v.dataset.end || 'clamp(bottom 25%)', scrub: o.scrub == null ? 0.25 : o.scrub } });
    return api;
  };
  function videoInView(v) {
    if (v._vid) return; v._vid = true;
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    if (!motion) { v.removeAttribute('autoplay'); v.pause(); v.controls = true; return; }
    v.loop = v.dataset.video !== 'once';
    Site.inView(v, { threshold: 0.25, margin: '0px', enter: () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); }, leave: () => v.pause() });
    D.addEventListener('visibilitychange', () => { if (D.hidden) v.pause(); });
  }

  /* ───────── films: a tall section, a stage that stays, a timeline the scroll plays ─────────
     Site.film('#id', (tl, s) => { tl.to(…, { duration: 20 }, 10) })   positions and durations run 0 to 100.
     A film also plays what its markup says without a line of script: [data-step] captions take turns, a
     [data-device] phone changes screens with them (and turns, and draws back from full-bleed), a [data-sequence]
     runs frame for frame with them, .film__bar fills, and [data-step-mark] items light as their step plays.
     Site.scene is the same stage without the conveniences (the older name; pages built on it keep working). */
  function stageOfFilm(el) { return $('.film__stage, .scene__stage', el) || el; }
  function filmCore(el, build, o, rich) {
    const stage = stageOfFilm(el);
    const s = { el, stage, motion, $: (q) => $(q, el), $$: (q) => $$(q, el), vw: () => stage.offsetWidth || W.innerWidth, vh: () => Site.svh(), lvh: () => Site.lvh(), steps: [], at: () => 0 };
    /* when the next section is a .sheet--over, the last screen of this one is spent under it: the timeline ends a screen early */
    const covered = !!(el.nextElementSibling && el.nextElementSibling.classList.contains('sheet--over'));
    let stepEls = [], marks = [], cur = -1;
    const mark = (p) => {
      if (!stepEls.length) return;
      let i = 0; const pos = p * 100;
      s.steps.forEach((r, k) => { if (pos >= r[0] - 0.01) i = k; });
      if (i === cur) return; cur = i; el.dataset.at = String(i);
      marks.forEach((m, k) => m.classList.toggle('is-on', k === i));
    };
    const tl = gsap.timeline({
      defaults: { ease: 'none', duration: 10 },
      scrollTrigger: {
        trigger: el, start: o.start || 'top top', end: o.end || (covered ? 'bottom 200%' : 'bottom bottom'), scrub: o.scrub == null ? 0.9 : o.scrub, invalidateOnRefresh: true,
        onToggle: (st) => { el.classList.toggle('is-live', st.isActive); if (o.onToggle) o.onToggle(st.isActive, st); },
        onUpdate: (st) => { mark(st.progress); if (o.onUpdate) o.onUpdate(st.progress, st); },
        onRefresh: (st) => mark(st.progress)
      }
    });
    tl.to({}, { duration: 100 }, 0);
    tl.eventCallback('onUpdate', () => { if (Site.header) Site.header.refresh(); });
    if (rich) {
      stepEls = $$('[data-step]', el); marks = $$('[data-step-mark]', el);
      const devices = $$('[data-device]', el).map((d) => ({ el: d, api: Site.device(d) }));
      const zoomer = devices.filter((d) => d.el.dataset.zoom)[0];
      const lead = zoomer ? num(zoomer.el.dataset.zoomLen, 16) : 0;
      const span = (el.dataset.span || o.span || (lead + ',100')).toString().split(',').map(Number);
      const n = stepEls.length, each = n ? (span[1] - span[0]) / n : 0;
      s.steps = stepEls.map((e, i) => { const x = (e.dataset.step || '').split(',').map(Number); return x.length === 2 && !isNaN(x[0]) && !isNaN(x[1]) ? x : [span[0] + i * each, span[0] + (i + 1) * each]; });
      if (n) s.steps[n - 1][1] = 100;
      s.at = (i) => (s.steps[i] ? s.steps[i][0] : 0);
      if (n) Site.beats(tl, stepEls, s.steps.map((r, i) => [i === 0 && !lead ? 0 : r[0], r[1]]), { y: num(el.dataset.stepY, 22), fade: num(el.dataset.stepFade, 3.2) });
      devices.forEach((d) => {
        const ds = d.el.dataset, swapLen = num(ds.swap, 4.4), cuts = s.steps.slice(1).map((r) => r[0] - swapLen / 2);
        if (ds.zoom) d.api.zoom(tl, { from: isNaN(+ds.zoom) ? ds.zoom : +ds.zoom, at: 0, duration: lead });
        if (ds.turn) { const f = ds.turn.split(',').map(Number), t = (ds.turnTo || '0,0,0').split(',').map(Number); d.api.turn(tl, { from: f, to: t, at: 0, duration: ds.turnTo ? 100 : Math.max(lead, 22), ease: ds.turnTo ? 'none' : 'power2.out' }); }
        if (d.api.screens.length > 1 && cuts.length && !$('[data-sequence]', d.el)) d.api.swap(tl, cuts, { mode: ds.device || undefined, duration: swapLen });
      });
      /* what waits for the zoom to finish: an eyebrow, a chapter list. It arrives as the phone settles into its frame. */
      const late = $$('[data-after-lead]', el);
      if (late.length) { if (lead) tl.fromTo(late, { autoAlpha: 0 }, { autoAlpha: 1, duration: lead * 0.3, ease: 'power1.out' }, lead * 0.72); else gsap.set(late, { autoAlpha: 1 }); }
      $$('[data-sequence]', el).forEach((q) => {
        if (q.dataset.drive === 'manual') return;
        const api = Site.sequence(q, { scroll: false }); if (!api) return;
        const framed = stepEls.filter((e) => e.dataset.frame != null);
        const pts = framed.length ? stepEls.map((e, i) => (e.dataset.frame != null ? [s.steps[i][0], api.at(num(e.dataset.frame, 0))] : null)).filter(Boolean) : [[span[0], 0]];
        if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);
        pts.push([100, 1]);
        api.keys(tl, pts);
      });
      $$('[data-scrub-video]', el).forEach((v) => { if (v.dataset.drive !== 'manual') Site.scrubVideo(v, { tl, at: span[0], duration: span[1] - span[0] }); });
      const bar = $('.film__bar > i', el); if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 100, ease: 'none' }, 0);
    }
    if (build) build(tl, s);
    el.classList.add('is-built');
    el._scene = el._film = tl;
    return tl;
  }
  function film(target, build, o, rich) {
    const el = el$(target); if (!el) return null;
    if (typeof build !== 'function') { o = build; build = null; } o = o || {};
    if (el._film) return el._film;
    const rest = () => { if (o.rest) o.rest({ el, stage: stageOfFilm(el), motion: false, $: (q) => $(q, el), $$: (q) => $$(q, el) }); };
    if (!motion) { rest(); return null; }
    /* data-unpin="sm": on a phone this film does not pin; it is the plain column, every caption and picture in view */
    if ((el.dataset.unpin || o.unpin) === 'sm') {
      el.dataset.unpin = 'sm';
      const mm = gsap.matchMedia();
      mm.add('(min-width: 720px)', () => { filmCore(el, build, o, rich); return () => { el._film = el._scene = null; el.classList.remove('is-built', 'is-live'); }; });
      mm.add(SMALL, () => { rest(); });
      return el._film;
    }
    return filmCore(el, build, o, rich);
  }
  Site.film = function (target, build, o) { return film(target, build, o, true); };
  Site.scene = function (target, build, o) { return film(target, build, o, false); };
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

  /* ───────── a rail: a horizontal passage driven by the vertical scroll ─────────
     <section class="rail" data-rail> <div class="rail__stage"> <div class="rail__track"> …items… </div></div></section>
     The section is as tall as the track is wide, so a thumb's travel down is the track's travel across.
     Inside it: [data-settle] photographs open as they come in from the right, [data-rail-z="0.3"] layers drift at
     their own rate, [data-rail-in] items rise in. Site.rail(el, (tween, r) => …) hands you r.containerAnimation. */
  Site.rail = function (target, build, o) {
    const el = el$(target); if (!el) return null;
    if (typeof build !== 'function') { o = build; build = null; } o = o || {};
    if (el._rail) return el._rail;
    const stage = $('.rail__stage', el), track = $('.rail__track', el);
    if (!motion || !stage || !track) return null;
    const speed = num(o.speed != null ? o.speed : el.dataset.rail, 1) || 1;
    const make = () => {
      const dist = () => Math.max(0, track.scrollWidth - stage.clientWidth);
      const size = () => el.style.setProperty('--rail-run', Math.round(dist() * speed) + 'px');
      size(); ScrollTrigger.addEventListener('refreshInit', size);
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: el, start: 'top top', end: 'bottom bottom', scrub: o.scrub == null ? 0.6 : o.scrub, invalidateOnRefresh: true,
          onToggle: (st) => el.classList.toggle('is-live', st.isActive),
          onUpdate: () => { if (Site.header) Site.header.refresh(); }
        }
      });
      const bar = $('.rail__bar > i', el); if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: true } });
      const inside = { containerAnimation: tween };
      $$('[data-settle]', track).forEach((f) => Site.settle(f, inside));
      $$('[data-rail-z]', track).forEach((l) => {
        const z = num(l.dataset.railZ, 0.2);
        gsap.fromTo(l, { x: () => z * stage.clientWidth * 0.5 }, { x: () => -z * stage.clientWidth * 0.5, ease: 'none', scrollTrigger: { containerAnimation: tween, trigger: l.closest('.rail__track > *') || l, start: 'left right', end: 'right left', scrub: true, invalidateOnRefresh: true } });
      });
      $$('[data-rail-in]', track).forEach((l) => {
        gsap.fromTo(l, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, ease: 'power2.out', scrollTrigger: { containerAnimation: tween, trigger: l, start: 'left 92%', end: 'left 62%', scrub: true } });
      });
      const r = { el, stage, track, items: $$(':scope > *', track), containerAnimation: tween, dist };
      if (build) build(tween, r);
      el.classList.add('is-built');
      el._rail = tween;
      return () => { ScrollTrigger.removeEventListener('refreshInit', size); el._rail = null; el.style.removeProperty('--rail-run'); el.classList.remove('is-built', 'is-live'); };
    };
    if ((el.dataset.unpin || o.unpin) === 'sm') { el.dataset.unpin = 'sm'; gsap.matchMedia().add('(min-width: 720px)', make); return el._rail; }
    make();
    return el._rail;
  };

  /* ───────── live vignettes: a small looping scene that plays only while it is on screen ───────── */
  Site.vignette = function (target, build, o) {
    const el = el$(target); if (!el || !motion) return null; o = o || {};
    const tl = gsap.timeline({ paused: true, repeat: o.loop === false ? 0 : -1, repeatDelay: o.repeatDelay == null ? 1.6 : o.repeatDelay, defaults: { ease: EASE, duration: 0.7 } });
    build(tl, el);
    /* the restart never blanks the tile: at most (soft: true) its contents dip and come back */
    if (o.loop !== false && o.soft === true) tl.eventCallback('onRepeat', () => gsap.fromTo(el, { opacity: 0.55 }, { opacity: 1, duration: 0.7, ease: 'power1.out', clearProps: 'opacity' }));
    Site.inView(el, { threshold: o.threshold == null ? 0.3 : o.threshold, margin: '0px', enter: () => tl.play(), leave: () => tl.pause() });
    el._vignette = tl;
    return tl;
  };

  /* ───────── pointer: tilt with a pass of light, and a magnetic pull (fine pointers only) ───────── */
  function tilt(el) {
    if (!motion || !fine || el._tilt) return; el._tilt = true;
    const max = num(el.dataset.tilt, 7), band = $('.sheen', el);
    gsap.set(el, { transformPerspective: 1000 });
    if (band) gsap.set(band, { x: 0 });
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
    el.addEventListener('pointerleave', () => gsap.to(el, { '--mx': '0px', '--my': '0px', duration: 0.9, ease: 'power3.out', overwrite: 'auto' }));
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

  /* ───────── header: solid, on the ground beneath it; and the phone menu ─────────
     It reads what lies just under its foot: that section's data-header, or the section's own ground when it has
     none (or says "light"). "none" slides it away for a full-bleed film. It is never see-through. */
  const GROUNDS = '.g-green, .g-world, .g-rest, .g-wash, .g-table, .g-paper';
  const groundOf = (e) => { const g = e.closest(GROUNDS); if (!g) return 'paper'; const c = g.classList; return c.contains('g-green') || c.contains('g-world') ? 'green' : c.contains('g-paper') ? 'paper' : 'rest'; };
  const NAMED = { paper: 'paper', rest: 'rest', green: 'green', dark: 'green', world: 'green', none: 'none' };
  function header() {
    const hdr = $('.hdr'); if (!hdr) return;
    const menu = $('#menu'), btn = $('.hdr__menu', hdr), main = $('main'), foot = $('.foot');
    const meta = $('meta[name="theme-color"]'), world = getComputedStyle(hdr).getPropertyValue('--ground-green').trim() || '#4F5B29';
    const TINT = { paper: '#FFFFFF', rest: '#F6F4EE', green: world };
    let queued = false, open = false;
    function theme() {
      queued = false;
      if (open) return;
      const y = hdr.offsetHeight + 2;
      let t = 'paper', under = 'paper';
      const stack = D.elementsFromPoint ? D.elementsFromPoint(Math.min(W.innerWidth - 4, W.innerWidth * 0.5), y) : [];
      for (let i = 0; i < stack.length; i++) {
        const e = stack[i];
        if (hdr.contains(e) || (menu && menu.contains(e)) || e === H || e === D.body) continue;
        const sec = e.closest('[data-header]'), said = sec ? sec.dataset.header : '';
        under = groundOf(e);
        t = NAMED[said] || under;
        break;
      }
      if (hdr.dataset.theme !== t) hdr.dataset.theme = t;
      const tint = TINT[t === 'none' ? under : t] || '#FFFFFF';
      if (meta && meta.getAttribute('content') !== tint) meta.setAttribute('content', tint);
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
      if (meta && on) meta.setAttribute('content', world);
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

  /* ───────── sections that hold while the next one slides over ─────────
     A held section stays under everything after it (site.css), and stops painting once it is fully covered. */
  function holds() {
    const els = $$('.hold'); if (!els.length) return;
    const set = () => { const vh = Site.svh(); els.forEach((el) => el.style.setProperty('--hold-top', Math.min(0, vh - el.offsetHeight) + 'px')); };
    set();
    if (W.ResizeObserver) { const ro = new ResizeObserver(set); els.forEach((el) => ro.observe(el)); }
    W.addEventListener('resize', set, { passive: true });
    els.forEach((el) => {
      const next = el.nextElementSibling; if (!next) return;
      ScrollTrigger.create({ trigger: next, start: 'top top', onEnter: () => { el.style.visibility = 'hidden'; }, onLeaveBack: () => { el.style.visibility = ''; } });
      if (el.dataset.hold === 'still') return;
      gsap.to(el, {
        scale: num(el.dataset.hold, 0.955), ease: 'none', transformOrigin: () => '50% ' + (el.offsetHeight - Site.svh() / 2) + 'px',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true }
      });
    });
  }

  /* ───────── smooth wheel on a desk; a phone keeps its own scrolling. Anchors land clear of the header. ─────────
     A plain section lands with its top at the header's foot (its own padding is the air), so the header takes its ground. A film, a scene or a rail lands flush with the top
     of the screen, pinned and on its first frame (its stage is laid out for the header standing over it). */
  const clear = (el) => {
    if (el && motion && el.matches && el.matches('.film, .scene, .rail, [data-header="none"]')) return 0;
    const h = $('.hdr'); return h ? h.offsetHeight : 60;
  };
  function smooth() {
    if (!fine || !W.Lenis) return;
    const lenis = Site.lenis = new W.Lenis({ lerp: 0.105, smoothWheel: true, syncTouch: false, anchors: false, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  /* a page opened on #somewhere: pinned films change the page's length after the browser has jumped, so land again */
  Site.toHash = function (hash, instant) {
    const id = (hash || location.hash || '').replace(/^#/, ''); if (!id) return false;
    let el = null; try { el = D.getElementById(decodeURIComponent(id)); } catch (e) { el = null; }
    if (!el) return false;
    const y = Math.max(0, Math.round(el.getBoundingClientRect().top + W.pageYOffset - clear(el)));
    const jump = instant !== false || Site.reduced;
    if (Site.lenis) Site.lenis.scrollTo(y, { immediate: jump, force: true, duration: jump ? 0 : 1.2 });
    else W.scrollTo({ top: y, behavior: jump ? 'auto' : 'smooth' });
    return el;
  };
  /* a link to somewhere on this page glides there (and the keyboard's focus goes with it) */
  function anchors() {
    D.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href*="#"]'); if (!a || a.target === '_blank') return;
      let u; try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.origin !== location.origin || u.pathname !== location.pathname || u.search !== location.search || u.hash.length < 2) return;
      const el = Site.toHash(u.hash, false); if (!el) return;
      e.preventDefault();
      if (u.hash !== location.hash) history.pushState(null, '', u.hash);
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
    W.addEventListener('popstate', () => { if (location.hash) Site.toHash(location.hash); });
  }

  /* ───────── wire every data-attribute under a root ───────── */
  Site.scan = function (root) {
    root = root || D;
    $$('[data-phone]', root).forEach((el) => {
      const p = Site.phone(el);
      if (motion && el.dataset.phone === 'settle' && !el._settled) { el._settled = true; const tl = phoneSettle(el); Site.inView(el, { once: true, margin: '0px 0px -16% 0px', enter: () => tl.play(), above: () => tl.progress(1) }); }
      return p;
    });
    $$('video[data-video]', root).forEach(videoInView);
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
    /* the scrubbed library, on each piece's own passage. Anything standing on a pinned stage is left to its film or rail,
       and ="manual" leaves a piece to the page's script. */
    const own = (sel, key, fn) => $$(sel, root).forEach((el) => { if (el.dataset[key] === 'manual' || staged(el)) return; fn(el); });
    own('[data-ink]', 'ink', (el) => Site.inkFill(el));
    own('[data-rise]', 'rise', (el) => Site.rise(el));
    own('[data-depth]', 'depth', (el) => Site.depth(el));
    own('[data-stripes]', 'stripes', (el) => Site.drawStripes(el));
    own('[data-rule]', 'rule', (el) => Site.drawStripes(el));
    own('[data-settle]', 'settle', (el) => Site.settle(el));
    own('[data-ground-shift]', 'groundShift', (el) => Site.groundShift(el));
    own('[data-sequence]', 'drive', (el) => Site.sequence(el));
    own('[data-scrub-video]', 'drive', (el) => Site.scrubVideo(el));
    own('.bcard[data-card-turn]', 'cardTurn', cardTurn);
  };
  /* films and rails that are all markup; a page's script gets to them first (Site.ready runs before this) */
  function stages(root) {
    if (!motion) return;
    $$('[data-film]', root || D).forEach((el) => { if (!el._film && el.dataset.film !== 'manual') Site.film(el); });
    $$('[data-rail]', root || D).forEach((el) => { if (!el._rail && el.dataset.rail !== 'manual') Site.rail(el); });
  }

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
    try { keys(); header(); anchors(); } catch (e) { fail(e); }
    try {
      if (motion) { smooth(); holds(); }
      Site.scan(D);
      clearTimeout(W.__siteFail);
    } catch (e) { fail(e); if (W.__siteOff) W.__siteOff(); }
    started = true;
    queue.splice(0).forEach((fn) => { try { fn(Site); } catch (e) { fail(e); } });
    try { stages(D); } catch (e) { fail(e); }
    if (libs) {
      const again = () => { ScrollTrigger.refresh(); };
      fontsReady.then(again);
      W.addEventListener('load', () => { again(); if (motion && location.hash) requestAnimationFrame(() => Site.toHash()); });
    }
    H.classList.add('site-ready');
  }
  /* page scripts are deferred after this file, so they can queue with Site.ready before we start */
  const go = () => { if (!started && !go.ran) { go.ran = true; start(); } };
  if (D.readyState === 'complete') go();
  else { D.addEventListener('DOMContentLoaded', go); W.addEventListener('load', go); }
})();
