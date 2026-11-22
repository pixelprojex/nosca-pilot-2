(() => {
  'use strict';
  const D = document, H = D.documentElement;
  const qR = matchMedia('(prefers-reduced-motion: reduce)');
  const qS = matchMedia('(max-height: 519px)');
  const want = () => !qR.matches && !qS.matches;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (s, r = D) => r.querySelector(s);
  const $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => n.toLocaleString('en-GB');
  const touched = new Set();
  const st = (el, prop, v) => { if (!el) return; if (el.style[prop] !== v) el.style[prop] = v; touched.add(el); };
  const at = (el, k, v) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
  const cls = (el, c, on) => { if (el && el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on); };
  const active = (list, i) => list.forEach((el, k) => cls(el, 'on', k === i));
  const idxOf = (times, p) => { let i = 0; for (let k = 0; k < times.length; k++) if (p >= times[k]) i = k; return i; };

  /* crossfade a stack of screens: only the incoming one fades, over the outgoing */
  function stack(list, i) {
    if (list._cur === i) return;
    const prev = list._cur;
    list._cur = i;
    list.forEach((el, k) => { cls(el, 'on', k === i); cls(el, 'under', k === prev && prev !== undefined); });
    clearTimeout(list._t);
    list._t = setTimeout(() => list.forEach((el, k) => { if (k !== list._cur) cls(el, 'under', false); }), 560);
  }
  /* a tap ring, fired once each time its window is entered */
  const TAP = [
    { opacity: 0, transform: 'translate(-50%,-50%) scale(.55)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.32 },
    { opacity: 0, transform: 'translate(-50%,-50%) scale(1.16)' }
  ];
  function fire(el, on) {
    if (!el) return;
    if (on && !el._f) { el._f = true; if (el.animate) el.animate(TAP, { duration: 820, easing: 'cubic-bezier(.22,1,.36,1)' }); }
    else if (!on) el._f = false;
  }
  function countUp(el) {
    const to = +el.dataset.n, t0 = performance.now();
    const step = (now) => { const t = clamp((now - t0) / 900); el.textContent = fmt(Math.round(to * easeOut(t))); if (t < 1) requestAnimationFrame(step); };
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  const C = 2 * Math.PI * 8.6, R8 = 8.6, TOUCH = 17.2, GAP = 11.5 * Math.PI / 180;

  const R = {
    hero: {
      init(s) {
        s.mark = $('.hero-mark', s.el); s.title = $('.hero-title', s.el); s.end = $('.title-end', s.el);
        s.fade = $$('.hero-fade', s.el); s.phone = $('.hero-phone', s.el); s.video = $('video', s.el); s.hm = $('#hdr-mark');
        if (s.video) {
          s.video.addEventListener('playing', () => cls(s.video, 'live', true));
          s.video.addEventListener('pause', () => cls(s.video, 'live', false));
        }
      },
      measure(s) {
        s.mark.style.transform = 'none'; s.title.style.transform = 'none';
        const sr = s.stage.getBoundingClientRect(), a = s.mark.getBoundingClientRect(), b = s.hm.getBoundingClientRect();
        const c = s.title.getBoundingClientRect(), d = s.end.getBoundingClientRect();
        s.m = { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top - sr.top + a.height / 2), k: b.width / a.width };
        s.t = { x: d.left + d.width / 2 - (c.left + c.width / 2), y: d.top + d.height / 2 - (c.top + c.height / 2), k: d.width / c.width };
        s.fh = s.frame.offsetHeight;
      },
      render(s) {
        const p = s.p;
        const tm = easeInOut(seg(p, 0, 0.22)), tt = easeInOut(seg(p, 0.02, 0.24)), tf = seg(p, 0, 0.1), tp = easeOut(seg(p, 0.06, 0.4));
        st(s.mark, 'transform', `translate3d(${(s.m.x * tm).toFixed(2)}px,${(s.m.y * tm).toFixed(2)}px,0) scale(${(1 + (s.m.k - 1) * tm).toFixed(4)})`);
        s.done = p >= 0.22;
        st(s.mark, 'opacity', s.done ? '0' : '1');
        st(s.title, 'transform', `translate3d(${(s.t.x * tt).toFixed(2)}px,${(s.t.y * tt).toFixed(2)}px,0) scale(${(1 + (s.t.k - 1) * tt).toFixed(4)})`);
        s.fade.forEach((el) => { st(el, 'opacity', (1 - tf).toFixed(3)); st(el, 'transform', `translate3d(0,${(-26 * tf).toFixed(2)}px,0)`); });
        st(s.phone, 'transform', `translate3d(0,${((1 - tp) * 0.7 * s.fh).toFixed(2)}px,0) scale(${(0.92 + 0.08 * tp).toFixed(4)})`);
        const v = s.video;
        if (v) {
          const play = s.awake && p > 0.42 && p < 0.985;
          if (play && v.paused) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
          else if (!play && !v.paused) { v.pause(); try { v.currentTime = 0; } catch (e) { /* not seekable yet */ } }
        }
      }
    },

    name: {
      init(s) {
        s.wt = $('.w-tr', s.el); s.wb = $('.w-bl', s.el); s.word = $('.nasc-word', s.el);
        s.mean = $$('.mean', s.el); s.A = $('.nasc-block', s.el); s.B = $('.nosca-block', s.el); s.last = $('.weave-line', s.el);
        s.svg = $('.weave', s.el); s.gl = $('.ring-l', s.el); s.gr = $('.ring-r', s.el);
        s.pl = $('.ring-l path', s.el); s.pr = $('.ring-r path', s.el);
      },
      measure(s) {
        const sr = s.stage.getBoundingClientRect(), r = s.svg.getBoundingClientRect();
        const unit = r.width / 40 || 1, left = r.left - sr.left;
        const startL = (0.1 * sr.width - left) / unit;          /* the left ring's centre starts a tenth in from the edge */
        s.d0 = Math.max(40, 2 * (20 - startL));
      },
      render(s) {
        const e = s.enter, p = s.p;
        const te = easeOut(seg(e, 0.1, 1)), k = (1 - te) * 18;
        st(s.wt, 'transform', `translate3d(${k.toFixed(2)}%,${(-k).toFixed(2)}%,0)`);
        st(s.wb, 'transform', `translate3d(${(-k).toFixed(2)}%,${k.toFixed(2)}%,0)`);
        const ta = easeOut(seg(e, 0.45, 1));
        st(s.word, 'transform', `translate3d(0,${((1 - ta) * 56).toFixed(2)}px,0) scale(${(1.04 - 0.04 * ta).toFixed(4)})`);
        st(s.word, 'opacity', ta.toFixed(3));
        s.mean.forEach((m, i) => cls(m, 'on', p >= 0.07 + i * 0.09));
        const xo = smooth(seg(p, 0.4, 0.45)), xi = smooth(seg(p, 0.45, 0.5));
        st(s.A, 'opacity', (1 - xo).toFixed(3)); st(s.A, 'transform', `translate3d(0,${(-28 * xo).toFixed(2)}px,0)`);
        st(s.B, 'opacity', xi.toFixed(3)); st(s.B, 'transform', `translate3d(0,${(28 * (1 - xi)).toFixed(2)}px,0)`);
        cls(s.A, 'off', xo >= 1); cls(s.B, 'off', xi <= 0);
        const t = seg(p, 0.52, 0.86);
        const d = lerp(s.d0, 12, easeInOut(t));
        weave(s, d);
        cls(s.svg, 'done', t >= 1);
        cls(s.last, 'on', p >= 0.88);
      }
    },

    story: {
      init(s) {
        s.beats = $$('.beats > .beat', s.el); s.words = $$('.note .w', s.el); s.rule = $('.sig-rule', s.el);
        s.scr = $$('.b-split .screen .scr', s.el); s.pres = $('[data-ring=pres]', s.el);
        s.ticks = $$('.tk', s.el).map((t) => ({ el: t, t: +t.dataset.t }));
        s.c45 = $('.c45', s.el); s.cnt = $('.c1554', s.el); s.roles = $$('.role', s.el); s.ups = $$('[data-up]', s.el);
      },
      render(s) {
        const p = s.p, i = idxOf([0, 0.2, 0.46, 0.68, 0.86], p);
        active(s.beats, i);
        const n = Math.round(seg(p, 0.01, 0.13) * s.words.length);
        s.words.forEach((w, k) => cls(w, 'on', k < n));
        st(s.rule, 'transform', `scaleX(${easeOut(seg(p, 0.13, 0.18)).toFixed(3)})`);
        stack(s.scr, p < 0.33 ? 0 : 1);
        fire(s.pres, p >= 0.38 && p < 0.46);
        const tt = seg(p, 0.46, 0.64); let lit = 0;
        s.ticks.forEach((k) => { const on = tt > 0 && k.t <= tt + 1e-6; cls(k.el, 'on', on); if (on) lit++; });
        const t45 = String(lit); if (s.c45.textContent !== t45) s.c45.textContent = t45;
        const tc = fmt(Math.round(1554 * easeOut(seg(p, 0.68, 0.82)))); if (s.cnt.textContent !== tc) s.cnt.textContent = tc;
        s.roles.forEach((r, k) => cls(r, 'on', p >= 0.71 + k * 0.03));
        if (i === 4 && !s.counted) { s.counted = true; s.ups.forEach(countUp); }
      },
      rest(s) { s.c45.textContent = '45'; s.cnt.textContent = '1,554'; s.ups.forEach((el) => { el.textContent = fmt(+el.dataset.n); }); }
    },

    coach: {
      init(s) {
        s.caps = $$('.caps .beat', s.el); s.scr = $$('.pic .scr', s.el); s.spot = $('.pic .spot', s.el);
        s.ring = {}; $$('[data-ring]', s.el).forEach((r) => { s.ring[r.dataset.ring] = r; });
        s.lit = $$('.s-lit', s.el);
      },
      render(s) {
        const p = s.p;
        active(s.caps, idxOf([0, 0.24, 0.46, 0.72], p));
        stack(s.scr, idxOf([0, 0.07, 0.14, 0.24, 0.46, 0.6, 0.72, 0.79, 0.85], p));
        cls(s.spot, 'on', p >= 0.28 && p < 0.46);
        const g = s.ring;
        fire(g.weather, p >= 0.18 && p < 0.24); fire(g.video, p >= 0.37 && p < 0.46);
        fire(g.plus, p >= 0.755 && p < 0.79); fire(g.cian, p >= 0.815 && p < 0.85);
        fire(g.chip, p >= 0.875 && p < 0.9); fire(g.putt, p >= 0.9 && p < 0.93); fire(g.logit, p >= 0.95);
        [0.815, 0.875, 0.95].forEach((t, k) => cls(s.lit[k], 'on', p >= t));
      }
    },

    player: {
      init(s) { s.caps = $$('.caps .beat', s.el); s.scr = $$('.pic .scr', s.el); s.chart = $('.m-chart i', s.el); s.disc = $('.m-disc i', s.el); s.box = $('[data-box=study]', s.el); },
      render(s) {
        const p = s.p;
        active(s.caps, idxOf([0, 0.28, 0.52, 0.8], p));
        stack(s.scr, idxOf([0, 0.28, 0.52, 0.68, 0.8], p));
        st(s.chart, 'transform', `translate3d(${(100 * easeInOut(seg(p, 0.56, 0.66))).toFixed(2)}%,0,0)`);
        st(s.disc, 'transform', `translate3d(${(100 * seg(p, 0.7, 0.76)).toFixed(2)}%,0,0)`);
        cls(s.box, 'on', p >= 0.86);
      }
    },

    family: {
      init(s) {
        s.caps = $$('.caps .beat', s.el); s.comps = $$('.comp', s.el); s.duo = $('.duo', s.el);
        s.box = $('[data-box=orla]', s.el); s.gm = $('.gm', s.el); s.note = $('.lk-note', s.el);
      },
      render(s) {
        const p = s.p;
        active(s.caps, idxOf([0, 0.15, 0.3, 0.52, 0.78], p));
        active(s.comps, idxOf([0, 0.3, 0.52, 0.78], p));
        cls(s.duo, 'jr', p >= 0.15);
        cls(s.box, 'on', p >= 0.36 && p < 0.52);
        cls(s.gm, 'sent', p >= 0.58);
        st(s.note, 'transform', `translate3d(0,${(-150 * (1 - easeOut(seg(p, 0.82, 0.88)))).toFixed(2)}%,0)`);
      }
    },

    sports: {
      init(s) {
        s.scr = $$('.pic .scr', s.el); s.names = $$('.sp-list li', s.el); s.tags = $$('.sp-tags p', s.el);
        s.one = $$('.sp-one > div', s.el); s.lay = $('.lay', s.el);
      },
      render(s) {
        const p = s.p, i = idxOf([0, 0.21, 0.34, 0.47, 0.6, 0.73], p);
        stack(s.scr, i); active(s.names, i); active(s.tags, i); active(s.one, i);
        cls(s.lay, 'fin', p >= 0.86);
      }
    },

    principles: {
      init(s) { s.w = $$('.pw span', s.el); s.rule = $('.p-rule', s.el); },
      render(s) {
        const p = s.p;
        s.w.forEach((w, k) => cls(w, 'on', p >= [0.1, 0.35, 0.6][k]));
        st(s.rule, 'transform', `scaleX(${easeOut(seg(p, 0.7, 0.85)).toFixed(3)})`);
      }
    },

    close: {
      init(s) { s.card = $('.card3d', s.el); s.shadow = $('.c-shadow', s.el); s.rule = $('.cb-rule', s.el); s.ctas = $('.ctas', s.el); },
      render(s) {
        const p = s.p, tr = easeOut(seg(p, 0, 0.15)), tf = easeInOut(seg(p, 0.2, 0.65));
        if (tf >= 1) { cls(s.card, 'flat', true); st(s.card, 'transform', 'none'); }
        else {
          cls(s.card, 'flat', false);
          st(s.card, 'transform', `translate3d(0,${((1 - tr) * 70).toFixed(2)}px,0) rotateX(${((1 - tr) * 16).toFixed(2)}deg) rotateY(${(180 * tf).toFixed(2)}deg)`);
        }
        const c = Math.abs(Math.cos(Math.PI * tf));
        st(s.shadow, 'transform', `scaleX(${(0.3 + 0.7 * c).toFixed(3)})`);
        st(s.shadow, 'opacity', (0.25 + 0.75 * tr * (0.4 + 0.6 * c)).toFixed(3));
        st(s.rule, 'transform', `scaleX(${easeOut(seg(p, 0.66, 0.74)).toFixed(3)})`);
        cls(s.ctas, 'in', p >= 0.78);
      }
    }
  };

  function weave(s, d) {
    const cxL = 20 - d / 2, cxR = 20 + d / 2;
    at(s.gl, 'transform', `translate(${cxL.toFixed(3)} 12.5)`);
    at(s.gr, 'transform', `translate(${cxR.toFixed(3)} 12.5)`);
    if (d >= TOUCH) {
      const L = clamp((s.d0 - d) / (s.d0 - TOUCH)), len = (C * L).toFixed(3), vis = L < 0.004 ? 'hidden' : 'visible';
      [s.pl, s.pr].forEach((el) => { at(el, 'stroke-dasharray', `${len} ${C.toFixed(3)}`); at(el, 'stroke-dashoffset', '0'); at(el, 'visibility', vis); });
    } else {
      const h = Math.acos(Math.min(1, d / TOUCH)), half = GAP * clamp((TOUCH - d) / (TOUCH - 12)), g = 2 * half * R8;
      const da = `${(C - g).toFixed(3)} ${g.toFixed(3)}`;
      at(s.pl, 'stroke-dasharray', da); at(s.pr, 'stroke-dasharray', da);
      at(s.pl, 'stroke-dashoffset', (C - g / 2 - R8 * h).toFixed(3));                 /* the left ring breaks at the bottom crossing */
      at(s.pr, 'stroke-dashoffset', (C - g / 2 - R8 * (Math.PI + h)).toFixed(3));     /* the right ring at the top one */
      at(s.pl, 'visibility', 'visible'); at(s.pr, 'visibility', 'visible');
    }
  }

  let motion = false, scenes = [], queued = false, force = false, hdrH = 52, mq = 0;
  const hdr = $('#hdr'), nameSec = $('#name'), foot = $('#foot');
  const bands = { nameTop: 0, nameBot: 0, footTop: 1e9 };

  function measure() {
    mq = 0;
    const y = window.scrollY;
    for (const s of scenes) {
      const r = s.el.getBoundingClientRect();
      s.top = r.top + y; s.h = s.el.offsetHeight;
      s.vh = motion && s.stage ? s.stage.offsetHeight : window.innerHeight;
      s.len = Math.max(1, s.h - s.vh);
      if (motion && s.r.measure) s.r.measure(s);
    }
    bands.nameTop = nameSec.getBoundingClientRect().top + y; bands.nameBot = bands.nameTop + nameSec.offsetHeight;
    bands.footTop = foot.getBoundingClientRect().top + y;
    hdrH = hdr.offsetHeight || 52;
    force = true; frame();
  }
  const schedMeasure = () => { if (!mq) mq = requestAnimationFrame(measure); };

  function frame() {
    queued = false;
    const y = window.scrollY;
    if (motion) {
      for (const s of scenes) {
        if (!(s.awake || s.settle || force)) continue;
        const p = clamp((y - s.top) / s.len), e = clamp((y - (s.top - s.vh)) / s.vh), x = clamp((y - (s.top + s.len)) / s.vh);
        if (force || s.settle || Math.abs(p - s.p) > 1e-4 || Math.abs(e - s.enter) > 1e-4 || Math.abs(x - s.exit) > 1e-4) {
          s.p = p; s.enter = e; s.exit = x; s.r.render(s);
        }
        s.settle = false;
      }
    }
    force = false;
    const half = hdrH / 2;
    const olive = (bands.nameTop - y <= half && bands.nameBot - y > half) || bands.footTop - y <= half;
    cls(hdr, 'olive', olive);
    cls(hdr, 'solid', !olive && y > (motion ? bands.nameTop : 8));
    cls(H, 'top-olive', olive);
    const hero = scenes[0];
    cls(hdr, 'has-mark', !motion || (hero && hero.done));
  }
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };

  function setMode() {
    const m = want();
    motion = m;
    H.classList.toggle('motion', m);
    const hv = $('.hero-phone video'); if (m && hv && hv.preload !== 'auto') hv.preload = 'auto';
    if (!m) {
      touched.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; });
      touched.clear();
      scenes.forEach((s) => { if (s.r.rest) s.r.rest(s); s.p = -1; });
      const v = $('.hero-phone video'); if (v && !v.paused) v.pause();
    }
  }

  function init() {
    scenes = $$('[data-scene]').map((el) => ({
      el, stage: $('.stage', el), frame: $('.frame', el), r: R[el.dataset.scene],
      p: -1, enter: -1, exit: -1, awake: false, settle: false
    })).filter((s) => s.r);
    scenes.forEach((s) => s.r.init(s));
    setMode();
    const wake = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        const s = scenes.find((k) => k.el === en.target);
        if (!s) return;
        if (en.isIntersecting && !s.awake) {
          s.awake = true;
          $$('img', s.el).forEach((im) => { if (im.decode && im.complete) im.decode().catch(() => {}); });
        } else if (!en.isIntersecting && s.awake) { s.awake = false; s.settle = true; }
      });
      onScroll();
    }, { rootMargin: '50% 0px 50% 0px' });
    scenes.forEach((s) => wake.observe(s.el));
    const rv = new IntersectionObserver((ents, o) => {
      ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); o.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -15% 0px' });
    $$('.rv').forEach((el) => rv.observe(el));
    const close = scenes.find((k) => k.r === R.close);
    if (close) close.el.addEventListener('focusin', () => {
      if (!motion) return;
      const p = (window.scrollY - close.top) / close.len;
      if (p < 0.78 || p > 1) window.scrollTo(0, Math.round(close.top + 0.8 * close.len));
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    let lastW = window.innerWidth;
    window.addEventListener('resize', () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; schedMeasure(); } });
    if (window.ResizeObserver) new ResizeObserver(schedMeasure).observe(D.body);
    const onMode = () => { setMode(); schedMeasure(); };
    [qR, qS].forEach((q) => (q.addEventListener ? q.addEventListener('change', onMode) : q.addListener(onMode)));
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(schedMeasure);
    window.addEventListener('load', schedMeasure);
    measure();
  }

  try { init(); }
  catch (err) {
    H.classList.remove('motion');
    touched.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; });
    if (window.console) console.error(err);
  }
})();
