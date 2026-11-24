/* Home. The scenes, in the order the page plays them. Everything rests on the finished HTML when motion is off. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$;
  if (!gsap) return;

  /* without motion, the phones that hold several screens still turn through them, with a plain fade */
  if (!S.motion) {
    $$('.side__phone, .sports__phone').forEach(function (el) {
      var p = S.phone(el), timer = 0;
      if (!p || p.screens.length < 2) return;
      S.inView(el, { threshold: 0.4, margin: '0px', enter: function () { if (!timer) timer = setInterval(p.next, 3200); }, leave: function () { clearInterval(timer); timer = 0; } });
    });
    return;
  }

  /* the bands of light rest off to the left in CSS (a percentage); GSAP reads that back as pixels and would add every
     xPercent sweep on top of it, so a sweep stopped at the left edge. Zero it once and every sweep crosses whole. */
  gsap.set($$('.sheen, .phone__sheen > b'), { x: 0 });

  /* ───────── 1. the card opens the site ───────── */
  (function hero() {
    var el = $('#top'); if (!el) return;
    var stage = $('.hero__stage', el), card = $('.hero__card', el), flip = $('.bcard__flip', card), front = $('.bcard__front', card), back = $('.bcard__back', card),
      lock = $('.bcard__lock', front), pins = $('.pins', front), tr = $('.pins__tr', front), bl = $('.pins__bl', front), shadow = $('.hero__shadow', el),
      copy = $('.hero__copy', el), cue = $('.hero__cue', el), sheenF = $('.sheen', front), sheenB = $('.sheen', back), word = $('.bcard__word', front),
      rule = $('.bcard__rule', back), bits = $$(':scope > :not(.sheen)', back), g = {};
    function measure() {
      var vw = stage.offsetWidth, sv = S.svh(), lv = Math.max(stage.offsetHeight, sv), R = card.offsetWidth, cw = front.offsetWidth, ch = front.offsetHeight;
      g.k = R / cw;                                   /* the front's own scale, so it sits on the card */
      g.s0 = cw / R;                                  /* the card's scale while the front covers the screen */
      g.dx = Math.max(0, (cw - vw) / 2);              /* from the card's corners in to the screen's */
      g.dyT = Math.max(0, ch / 2 - sv / 2);
      g.dyB = Math.max(0, sv / 2 + ch / 2 - lv);
      g.sw = Math.min(0.5256 * cw, Math.max(240, 0.44 * vw)) / (0.5256 * cw);
      g.lock = cw / lock.offsetWidth;                 /* the lock-up reaches the card's own proportion as the camera pulls back */
      g.sEnd = Math.max(vw / R, (2 * lv - sv) / (R * 55 / 84)) * 1.05;   /* the back, grown until it is the page */
      gsap.set(front, { scale: g.k });
    }
    measure();
    S.ScrollTrigger.addEventListener('refreshInit', measure);

    S.scene(el, function (tl) {
      /* the words leave first */
      tl.to(copy, { autoAlpha: 0, y: -44, duration: 8, ease: 'power1.in' }, 1);
      tl.to(cue, { autoAlpha: 0, duration: 3 }, 0);
      /* the camera pulls back: the field becomes the card on the table */
      tl.fromTo(flip, { scale: function () { return g.s0; } }, { scale: 1, duration: 36, ease: 'power2.inOut' }, 3);
      tl.fromTo(tr, { x: function () { return -g.dx; }, y: function () { return g.dyT; }, scale: function () { return g.sw; } }, { x: 0, y: 0, scale: 1, duration: 36, ease: 'power2.inOut' }, 3);
      tl.fromTo(bl, { x: function () { return g.dx; }, y: function () { return -g.dyB; }, scale: function () { return g.sw; } }, { x: 0, y: 0, scale: 1, duration: 36, ease: 'power2.inOut' }, 3);
      tl.fromTo(lock, { scale: 1 }, { scale: function () { return g.lock; }, duration: 36, ease: 'power2.inOut' }, 3);
      tl.fromTo(shadow, { autoAlpha: 0, scale: 1.18 }, { autoAlpha: 1, scale: 1, duration: 13, ease: 'power2.out' }, 27);
      /* it tilts as it comes to rest, and the foil catches the light */
      tl.fromTo(flip, { rotationX: 0, rotationZ: 0 }, { rotationX: 10, rotationZ: -3, duration: 15, ease: 'power2.out' }, 25);
      tl.set(sheenF, { opacity: 0.6 }, 27).fromTo(sheenF, { xPercent: -46 }, { xPercent: 46, duration: 21, ease: 'power1.inOut' }, 27).set(sheenF, { opacity: 0 }, 48.5);   /* a glint, not a gloss */
      /* it turns over */
      tl.to(flip, { rotationY: 180, rotationX: 0, rotationZ: 0, duration: 22, ease: 'power2.inOut' }, 46);
      tl.to(flip, { scale: 1.08, duration: 11, ease: 'power1.inOut' }, 46).to(flip, { scale: 1, duration: 11, ease: 'power1.inOut' }, 57);
      tl.to(shadow, { scaleX: 0.42, opacity: 0.5, duration: 11, ease: 'power1.inOut' }, 46).to(shadow, { scaleX: 1, opacity: 1, duration: 11, ease: 'power1.inOut' }, 57);
      /* the back: its gold rule draws, the light crosses it */
      tl.fromTo(rule, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 9, ease: 'power2.out' }, 59);
      tl.set(sheenB, { opacity: 1 }, 62).fromTo(sheenB, { xPercent: -46 }, { xPercent: 46, duration: 14, ease: 'power1.inOut' }, 62).set(sheenB, { opacity: 0 }, 76.5);
      /* and grows until it is the page */
      tl.to(bits, { autoAlpha: 0, duration: 7, ease: 'power1.in' }, 77);
      tl.to(shadow, { autoAlpha: 0, duration: 6 }, 77);
      tl.to(flip, { scale: function () { return g.sEnd; }, duration: 18, ease: 'power2.in' }, 78);     /* all white by 96: the next section's title is already rising onto it (index.css, .arrive) */
    });

    /* the opening, once: the stripes draw line by line, the rings draw and weave, NOSCA settles */
    var w = S.weave($('.weave', front)), split = S.split(word, 'chars'), chars = split ? split.chars : [word];
    w.set(25, 0);
    gsap.set(chars, { opacity: 0, x: function (i) { return (i - (chars.length - 1) / 2) * 18; } });
    el.classList.add('is-go');
    gsap.timeline({ delay: 0.15 })
      .add(S.pins(pins, { paused: false, stagger: 0.075 }), 0)
      .to(w.state, { draw: 1, duration: 1.6, ease: 'power2.inOut', onUpdate: w.render }, 0.3)
      .to(w.state, { d: 12, duration: 1.7, ease: 'power3.inOut', onUpdate: w.render }, 1.35)
      .to(chars, { opacity: 1, x: 0, duration: 1.3, ease: 'power3.out', stagger: 0.07 }, 1.8);
  })();

  /* ───────── 2. the product arrives ───────── */
  S.scene('#app', function (tl, s) {
    var phone = s.$('.arrive__phone'), fan = s.$('.arrive__fan'), floor = $('.phone__floor', phone), glass = $('.phone__sheen > b', phone);
    /* the section is still coming up the screen until about 36: the phone waits for it, so its slow settle is seen on the
       screen and not spent below the fold; it comes to rest once the stage has stopped, and then the hand of screens fans out */
    tl.fromTo(phone, { y: function () { return S.svh() * 0.34; }, rotationX: 34, rotationY: -16, rotationZ: 4, scale: 0.84, transformPerspective: 1500 },
      { y: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, duration: 38, ease: 'power2.out' }, 22);
    if (floor) tl.fromTo(floor, { opacity: 0, scaleX: 0.5 }, { opacity: 1, scaleX: 1, duration: 32, ease: 'power2.out' }, 28);
    if (glass) tl.set(glass, { opacity: 1 }, 50).fromTo(glass, { xPercent: -42 }, { xPercent: 42, duration: 18, ease: 'power1.inOut' }, 50).set(glass, { opacity: 0 }, 68.5);
    tl.add(S.fan(fan, { paused: false, duration: 24, stagger: 3, spread: S.wide() ? 0.92 : 1.56, rot: 8, drop: 0.09, shrink: 0.1 }), 60);
  }, { start: 'top bottom' });

  /* ───────── 3. coach · player · family ───────── */
  S.scene('#sides', function (tl, s) {
    var sides = s.$$('.side'), nav = s.$$('.sides__nav span'), wide = S.wide(), span = 100 / sides.length;
    /* the first chapter's name is on from the stylesheet (index.css): a custom property set here is not put back when the scene is rebuilt */
    sides.forEach(function (side, i) {
      var a = i * span, b = a + span, copy = $('.side__copy', side), phone = $('.side__phone', side), va = $('.v--a', side), vb = $('.v--b', side), p = S.phone(phone);
      var drop = vb.classList.contains('v--note') ? -46 : 46;          /* a reminder comes down from the top, as it does on a phone */
      p.warm();
      gsap.set(p.screens, { autoAlpha: function (k) { return k === 0 ? 1 : 0; } });
      if (i > 0) {
        tl.fromTo(phone, { autoAlpha: 0, xPercent: 64, rotationY: -34, scale: 0.9, transformPerspective: 1400 }, { autoAlpha: 1, xPercent: 0, rotationY: 0, scale: 1, duration: 7, ease: 'power3.out' }, a - 0.5);
        tl.fromTo(copy, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 5, ease: 'power2.out' }, a + 0.5);
        tl.fromTo(nav[i], { '--on': 0 }, { '--on': 1, duration: 3 }, a - 1);
      }
      tl.fromTo(va, { autoAlpha: 0, y: 46, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 5, ease: 'power3.out' }, a + (i ? 6 : 1.5));
      /* the thread's later lines arrive once, as its tile comes in, and stay: looping them left the tile half empty each turn */
      var thread = $('#v-thread', side);
      if (thread) {
        var later = $$('.app-thread > *', thread).slice(1), arrive = gsap.timeline({ paused: true });
        arrive.fromTo(later, { opacity: 0, y: 14, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'power3.out', stagger: 1 }, 0.5).progress(1);
        tl.call(function () { arrive.restart(); }, null, a + 7.5);
      }
      if (p.screens[1]) tl.to(p.screens[1], { autoAlpha: 1, duration: 3.5, ease: 'power1.inOut' }, a + 12);
      if (!wide) tl.to(va, { autoAlpha: 0, y: -22, duration: 3.5, ease: 'power2.in' }, a + 14.5);
      tl.fromTo(vb, { autoAlpha: 0, y: drop, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 5, ease: 'power3.out' }, a + 17);
      if (p.screens[2]) tl.to(p.screens[2], { autoAlpha: 1, duration: 3.5, ease: 'power1.inOut' }, a + 22);
      if (i < sides.length - 1) {
        tl.to([va, vb], { autoAlpha: 0, y: -28, duration: 4, ease: 'power2.in' }, b - 6.5);
        tl.to(copy, { autoAlpha: 0, y: -30, duration: 4, ease: 'power2.in' }, b - 5.5);
        tl.to(phone, { autoAlpha: 0, xPercent: -64, rotationY: 34, scale: 0.9, duration: 6, ease: 'power3.in' }, b - 6.5);
        tl.to(nav[i], { '--on': 0, duration: 3 }, b - 3);
      }
    });
  });

  /* the small live scenes: each loops calmly while it is on screen, and none of them goes blank between turns. (The shared
     "soft" restart cuts a scene's whole contents to nothing and fades them back; here each scene puts itself back gently:
     keys and ticks ease to their rest through their own transitions, the line and the later bubbles fade before they return.) */
  var LOOP = { soft: false, repeatDelay: 1.3 };
  S.vignette('#v-register', function (tl, el) {
    var keys = $$('.v-mark', el);
    tl.set(keys, { className: 'app-key app-key--quiet v-mark' }, 0);
    keys.forEach(function (k, i) {
      var t = 0.9 + i * 0.8;
      tl.set(k, { className: 'app-key app-key--quiet v-mark is-down' }, t).set(k, { className: 'app-key v-mark is-down' }, t + 0.14).set(k, { className: 'app-key v-mark' }, t + 0.3);
    });
    tl.to({}, { duration: 2.2 });
  }, LOOP);
  S.vignette('#v-log', function (tl, el) {
    var chips = $$('.app-chip', el), key = $('.v-log', el), a = $('.v-log__a', el), b = $('.v-log__b', el);
    tl.set(chips, { className: 'app-chip' }, 0).to(b, { opacity: 0, duration: 0.25, ease: 'power1.out' }, 0).to(a, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 0.15);
    [1, 2].forEach(function (i, n) { tl.set(chips[i], { className: 'app-chip is-on' }, 0.9 + n * 0.75).fromTo(chips[i], { scale: 0.93 }, { scale: 1, duration: 0.5, ease: 'power3.out' }, 0.9 + n * 0.75); });
    tl.set(key, { className: 'app-key app-key--wide v-log is-down' }, 2.6).set(key, { className: 'app-key app-key--wide v-log' }, 2.78);
    tl.to(a, { opacity: 0, duration: 0.25 }, 2.8).to(b, { opacity: 1, duration: 0.4 }, 2.9).to({}, { duration: 2.2 });
  }, LOOP);
  S.vignette('#v-drills', function (tl, el) {
    var ticks = $$('.app-tick', el);
    tl.set(ticks, { className: 'app-tick' }, 0);
    [0, 1].forEach(function (i) { tl.set(ticks[i], { className: 'app-tick is-on' }, 0.9 + i * 0.95).fromTo(ticks[i], { scale: 0.7 }, { scale: 1, duration: 0.55, ease: 'power3.out' }, 0.9 + i * 0.95); });
    tl.to({}, { duration: 2.4 });
  }, LOOP);
  S.vignette('#v-progress', function (tl, el) {
    var line = $('.v-chart__line', el), end = $('.v-chart__dot--end', el);
    tl.set([line, end], { opacity: 1 }, 0.3)
      .fromTo(line, { strokeDasharray: '1 1.2', strokeDashoffset: 1.06 }, { strokeDashoffset: 0, duration: 1.9, ease: 'power2.inOut' }, 0.3)
      .fromTo(end, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'power3.out' }, 2)
      .to({}, { duration: 2.6 })
      .to([line, end], { opacity: 0, duration: 0.5, ease: 'power1.inOut' });
  }, { soft: false, repeatDelay: 0.3 });
  /* the thread and the reminder have no loop: the thread's lines arrive once with its tile (the scene above calls them in),
     and the scene brings the reminder down whole. A loop left each of those tiles part empty every time round. */

  /* ───────── 4. six sports, one app: the phone holds still, its screen re-tints ───────── */
  S.scene('#sports', function (tl, s) {
    var names = s.$$('.sport'), sw = s.$$('.swatch'), n = names.length, at = [], i;
    for (i = 1; i < n; i++) at.push(4 + i * 15.2);
    S.screens(tl, s.$('.sports__phone'), at, { duration: 4.5 });
    names.forEach(function (el, k) {
      gsap.set(sw[k], { scale: k ? 1 : 1.5, opacity: k ? 0.36 : 1 });
      if (k > 0) {
        tl.fromTo(el, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 4, ease: 'power2.out' }, at[k - 1] + 0.8);
        tl.to(sw[k], { scale: 1.5, opacity: 1, duration: 3, ease: 'power2.out' }, at[k - 1]);
      }
      if (k < n - 1) {
        tl.to(el, { autoAlpha: 0, y: -18, duration: 3.4, ease: 'power2.in' }, at[k] - 2.8);      /* a short way: further, and the name ran into the line above it on a phone */
        tl.to(sw[k], { scale: 1, opacity: 0.36, duration: 3, ease: 'power2.out' }, at[k]);
      }
    });
  });

  /* ───────── 5. the name: two rings travel in from the edges and weave ───────── */
  S.scene('#name', function (tl, s) {
    var w = S.weave(s.$('.weave'));
    w.set(w.far(), 0);
    tl.fromTo(w.state, { draw: 0 }, { draw: 1, duration: 26, ease: 'power1.out', onUpdate: w.render }, 6);
    tl.fromTo(w.state, { d: function () { return w.far(); } }, { d: 12, duration: 58, ease: 'power2.inOut', onUpdate: w.render }, 6);
    tl.fromTo(s.$('.name__line'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 8, ease: 'power2.out' }, 64);
    tl.fromTo(s.$('.name__link'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 8, ease: 'power2.out' }, 70);
  });

  /* ───────── 9. the card comes back, and turns to its code ───────── */
  (function close() {
    var card = $('.close__bcard'); if (!card) return;
    card.classList.remove('is-back');
    gsap.fromTo($('.bcard__flip', card), { rotationY: 0 }, { rotationY: 180, ease: 'power1.inOut', scrollTrigger: { trigger: card, start: 'top 94%', end: 'center 56%', scrub: 0.9 } });
  })();
});
