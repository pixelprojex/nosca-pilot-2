/* The story. The scenes, in the order the page plays them.
   Without motion (Reduce Motion, no JavaScript, a failed script) nothing here runs and the finished HTML and CSS stand on their own. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$, W = window, D = document;
  if (!gsap || !S.motion) return;
  var DASH = { strokeDasharray: '1 1.2', strokeDashoffset: 1.06 };

  /* one scene failing must not take the others with it, and must leave nothing hidden */
  function guard(id, fn) {
    var el = D.getElementById(id);
    if (!el) return;
    try { fn(el); } catch (e) { if (W.console) console.error(e); el.classList.add('st-fail'); }
  }

  /* ───────── 1. the name: the word first, then the dark card rises, its rings weave, and it turns ───────── */
  guard('top', function (el) {
    var title = $('.st-hero__title', el), band = $('.st-hero__pins', el), dim = $('.st-hero__dim', el), obj = $('.st-hero__object', el),
      shadow = $('.st-hero__shadow', el), flip = $('.bcard__flip', obj), front = $('.bcard__front', obj), back = $('.bcard__back', obj),
      word = $('.bcard__word', front), sheenF = $('.sheen', front), sheenB = $('.sheen', back), rule = $('.bcard__rule', back),
      cue = $('.st-hero__cue', el), caps = $$('.st-cap', el), w = S.weave($('.weave', front));
    if (w) w.set(64, 0);

    S.scene(el, function (tl, s) {
      /* the word leaves and the table darkens */
      if (cue) tl.to(cue, { autoAlpha: 0, duration: 3 }, 0);
      tl.to(title, { autoAlpha: 0, y: function () { return -0.08 * s.vh(); }, scale: 0.95, duration: 12, ease: 'power1.in' }, 1);
      tl.to(band, { autoAlpha: 0, duration: 13, ease: 'power1.inOut' }, 2);
      tl.fromTo(dim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 18, ease: 'power1.inOut' }, 2);
      /* the card comes up off the table and settles, a little tilted */
      tl.fromTo(obj, { y: function () { return 0.52 * s.vh(); } }, { y: 0, duration: 25, ease: 'power3.out' }, 8);
      tl.fromTo(obj, { autoAlpha: 0 }, { autoAlpha: 1, duration: 8, ease: 'power1.out' }, 8);
      tl.fromTo(flip, { rotationX: 48, rotationZ: -9, scale: 0.78 }, { rotationX: 9, rotationZ: -3, scale: 1, duration: 25, ease: 'power3.out' }, 8);
      tl.fromTo(shadow, { autoAlpha: 0, scale: 1.14 }, { autoAlpha: 1, scale: 1, duration: 14, ease: 'power2.out' }, 18);
      /* its pinstripes draw, line by line, both corners at once */
      $$('.pins__w', front).forEach(function (wedge) {
        tl.fromTo($$('path', wedge), DASH, { strokeDashoffset: 0, duration: 7, ease: 'power2.out', stagger: { amount: 9 } }, 16);
      });
      /* two rings: drawn apart, then each passes through the other */
      if (w) {
        tl.fromTo(w.state, { draw: 0 }, { draw: 1, duration: 11, ease: 'power2.inOut', onUpdate: w.render }, 22);
        tl.fromTo(w.state, { d: 64 }, { d: 12, duration: 24, ease: 'power2.inOut', onUpdate: w.render }, 32);
      }
      if (word) tl.fromTo(word, { autoAlpha: 0 }, { autoAlpha: 1, duration: 9, ease: 'power1.out' }, 50);
      /* the foil catches the light */
      if (sheenF) tl.set(sheenF, { opacity: 1 }, 57).fromTo(sheenF, { xPercent: -46 }, { xPercent: 46, duration: 15, ease: 'power1.inOut' }, 57).set(sheenF, { opacity: 0 }, 72.5);
      /* it turns over */
      tl.to(flip, { rotationY: 180, rotationX: 0, rotationZ: 0, duration: 21, ease: 'power2.inOut' }, 70);
      tl.to(flip, { scale: 1.07, duration: 10.5, ease: 'power1.inOut' }, 70).to(flip, { scale: 1, duration: 10.5, ease: 'power1.inOut' }, 80.5);
      tl.to(shadow, { scaleX: 0.44, opacity: 0.5, duration: 10.5, ease: 'power1.inOut' }, 70).to(shadow, { scaleX: 1, opacity: 1, duration: 10.5, ease: 'power1.inOut' }, 80.5);
      /* the back: its gold rule draws, the light crosses it */
      if (rule) tl.fromTo(rule, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 8, ease: 'power2.out' }, 83);
      if (sheenB) tl.set(sheenB, { opacity: 1 }, 86).fromTo(sheenB, { xPercent: -46 }, { xPercent: 46, duration: 12, ease: 'power1.inOut' }, 86).set(sheenB, { opacity: 0 }, 98.5);
      /* three lines take turns under it */
      S.beats(tl, caps, [[24, 40], [42, 66], [68, 100]], { y: 22, fade: 5 });
    });
  });

  /* ───────── 2. one moment: picked up, one thing done, put down ───────── */
  guard('moment', function (el) {
    var phs = $$('.st-ph', el), judge = $('.st-moment__judge', el), phone = $('.st-moment__ph', el),
      glass = $('.phone__sheen > b', phone), floor = $('.phone__floor', phone);
    S.scene(el, function (tl) {
      /* its shadow gathers under it as it comes up, and the glass catches the light once */
      if (floor) tl.fromTo(floor, { opacity: 0, scaleX: 0.55 }, { opacity: 1, scaleX: 1, duration: 30, ease: 'power3.out' }, 2).to(floor, { opacity: 0.55, scaleX: 0.82, duration: 18, ease: 'power2.inOut' }, 70);
      if (glass) tl.fromTo(glass, { xPercent: -42, opacity: 1 }, { xPercent: 42, duration: 17, ease: 'power2.inOut' }, 13).set(glass, { opacity: 0 }, 30.5);
      tl.fromTo(phone, { yPercent: 58, rotationX: 38, rotationZ: -6, scale: 0.88 }, { yPercent: 0, rotationX: 0, rotationZ: 0, scale: 1, duration: 30, ease: 'power3.out' }, 2);
      tl.fromTo(phone, { autoAlpha: 0 }, { autoAlpha: 1, duration: 9, ease: 'power1.out' }, 2);
      tl.fromTo(phs[0], { opacity: 0.2 }, { opacity: 1, duration: 9, ease: 'power1.out' }, 4);
      tl.fromTo(phs[1], { opacity: 0.2 }, { opacity: 1, duration: 8, ease: 'power1.out' }, 42);
      S.screens(tl, phone, [44, 70], { duration: 6 });
      tl.fromTo(phs[2], { opacity: 0.2 }, { opacity: 1, duration: 8, ease: 'power1.out' }, 68);
      tl.to(phone, { yPercent: 14, rotationX: 24, rotationZ: 3, scale: 0.93, duration: 18, ease: 'power2.inOut' }, 70);
      tl.fromTo(judge, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 9, ease: 'power2.out' }, 84);
    }, { start: 'top 62%' });
  });

  /* ───────── 3. how it was built: the track travels sideways, each stop arrives, the 45 cycle days light in order ───────── */
  guard('built', function (el) {
    var view = $('.st-built__view', el), track = $('.st-track', el), fill = $('.st-rail > i', el), svg = $('.st-cycles .ticks', el), nEl = $('.st-cycles__n', el),
      rings = $('.st-built__rings .mark', el), gates = $$('.st-stop, .st-verbs span', el), tks = svg ? $$('.tk', svg) : [], total = tks.length,
      txs = tks.map(function (t) { return (parseFloat(t.getAttribute('x')) || 0) + 2; }),
      m = { vl: 0, vw: W.innerWidth, travel: 0, g: [], sx: 0, sw: 1 }, live = false, shown = -1;
    if (!view || !track) return;

    /* positions inside the track; they do not change with the track's own travel */
    function measure() {
      var vr = view.getBoundingClientRect(), tr = track.getBoundingClientRect(), sr;
      m.vl = vr.left; m.vw = vr.width || W.innerWidth;
      m.travel = Math.max(0, track.offsetWidth - m.vw);
      m.g = gates.map(function (g) { return g.getBoundingClientRect().left - tr.left; });
      if (svg) { sr = svg.getBoundingClientRect(); m.sx = sr.left - tr.left; m.sw = sr.width || 1; }
    }
    /* every rendered frame of the travel: who has arrived, and how many days are lit */
    function frame() {
      var x = +gsap.getProperty(track, 'x') || 0, i, v, e, n = 0, edge, gx;
      if (live) {
        edge = m.vl + m.vw * 0.86;
        for (i = 0; i < gates.length; i++) if (!gates[i]._in && m.vl + x + m.g[i] < edge) { gates[i]._in = true; gates[i].classList.add('is-in'); }
      }
      if (!total) return;
      gx = (m.vw * 0.8 - (x + m.sx)) / m.sw * 520;        /* a line four fifths across the screen, in the ticks' own units */
      for (i = 0; i < total; i++) {
        v = S.clamp((gx - txs[i]) / 36, 0, 1);
        if (v > 0.5) n++;
        if (v === tks[i]._v) continue;
        tks[i]._v = v; e = 1 - Math.pow(1 - v, 3);
        tks[i].style.transform = 'scaleY(' + (0.16 + 0.84 * e).toFixed(3) + ')';
        tks[i].style.opacity = (0.28 + 0.72 * v).toFixed(3);
      }
      if (n !== shown && nEl) { shown = n; nEl.textContent = String(n); }
    }
    function go() { live = true; frame(); }

    measure();
    S.ScrollTrigger.addEventListener('refreshInit', measure);
    S.ScrollTrigger.addEventListener('refresh', frame);
    el.classList.add('st-go');
    S.scene(el, function (tl) {
      tl.fromTo(track, { x: 0 }, { x: function () { return -m.travel; }, duration: 88, ease: 'none', onUpdate: frame }, 6);
      if (fill) tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 88, ease: 'none' }, 6);
      /* the great rings behind it drift the same way, far more slowly: depth */
      if (rings) tl.fromTo(rings, { xPercent: 9 }, { xPercent: -9, duration: 100, ease: 'none' }, 0);
    });
    S.inView(view, { once: true, margin: '0px 0px -16% 0px', enter: go, above: go });
    /* the last stop's screen waits far off to the right: fetch it as the section comes near, so it is decoded before it arrives */
    S.inView(el, { once: true, margin: '150% 0px 150% 0px', enter: function () { $$('img[loading="lazy"]', track).forEach(function (im) { im.loading = 'eager'; }); } });
    frame();
  });

  /* ───────── 4. the crawl: every key on the coach's plus sheet is pressed, and each one answers ───────── */
  guard('crawl', function (el) {
    var tiles = $$('.st-tile', el), oks = $$('.st-tile__ok', el), fill = $('.st-crawl__bar > i', el), nEl = $('.st-crawl__n', el), STEP = 0.24, T0 = 0.5;
    if (!tiles.length) return;
    function count(n) { if (nEl) nEl.textContent = String(n); }
    function press(i, on) { tiles[i].classList.toggle('is-down', on); }
    S.vignette(el, function (tl) {
      gsap.set(oks, { scale: 0.3, opacity: 0 });
      if (fill) gsap.set(fill, { scaleX: 0 });
      count(0);
      tl.call(function () { count(0); tiles.forEach(function (t) { t.classList.remove('is-down'); }); }, null, 0);
      tiles.forEach(function (tile, i) {
        var at = T0 + i * STEP;
        tl.call(press, [i, true], at).call(press, [i, false], at + 0.16).call(count, [i + 1], at + 0.16);
        if (oks[i]) tl.fromTo(oks[i], { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.42, ease: 'power3.out', immediateRender: false }, at + 0.14);
      });
      if (fill) tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: tiles.length * STEP, ease: 'none', immediateRender: false }, T0 + 0.14);
      tl.to({}, { duration: 2.8 });
    }, { repeatDelay: 0.2, threshold: 0.35 });
  });

  /* ───────── 6. what we stand for: three words, lit one after another as they cross the screen ───────── */
  guard('stand', function (el) {
    var words = $$('.st-word', el), box = $('.st-stand__words', el);
    if (!words.length) return;
    gsap.fromTo(words, { opacity: 0.14, y: 20 }, {
      opacity: 1, y: 0, ease: 'none', duration: 1, stagger: 1.15,
      scrollTrigger: { trigger: box, start: 'top 88%', end: 'bottom 76%', scrub: 0.7 }
    });
  });

  /* ───────── 7. a call-off: the reason is chosen, the key is pressed, three people are told ───────── */
  guard('told', function (el) {
    var opt = $('.st-opt', el), key = $('.st-calloff', el), notes = $$('.st-note', el);
    if (!notes.length) return;
    function chosen(on) { if (opt) opt.classList.toggle('is-on', on); }
    function down(on) { if (key) key.classList.toggle('is-down', on); }
    chosen(false);
    S.vignette(el, function (tl) {
      tl.call(function () { chosen(false); down(false); }, null, 0);
      tl.call(chosen, [true], 0.7);
      tl.call(down, [true], 1.5).call(down, [false], 1.72);
      tl.fromTo(notes, { y: 26, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.85, stagger: 0.32 }, 1.85);
      tl.to({}, { duration: 3.4 });
    }, { repeatDelay: 0.2, threshold: 0.4 });
  });

  /* ───────── 8. the two faces of the card are dealt onto the table ───────── */
  guard('ireland', function (el) {
    var table = $('.st-table', el);
    if (!table) return;
    var on = function () { table.classList.add('st-in'); };
    table.classList.add('st-go');
    S.inView(table, { once: true, margin: '0px 0px -22% 0px', enter: on, above: on });
  });
});
