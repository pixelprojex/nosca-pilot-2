/* Home. Most of the page is attributes (API.md); this file plays the scenes that need a hand: the card that opens the
   site, the coach's phone (the sequence held on each caption's picture), the player's phone (a sequence, then screens,
   turning only between captions), the name, and two grounds that arrive on the card's diagonal. With motion off none
   of it runs and the page is the finished column the HTML and CSS already are. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$;
  if (!gsap || !S.motion) return;
  var px = function (v) { return Math.round(v * 10) / 10 + 'px'; };

  /* ───────── 1. the card opens the site ─────────
     The first frame is the card's front at the size of the screen. The scroll draws the camera back until it is the
     card on the table, tilts it into the light, turns it to its white back, and holds the back to be read. Then the
     white opens out from the card's own rectangle to the whole screen, every side at once, while the card's words go:
     no band, nothing cut at an edge, and the next section's words rise onto the white. */
  (function open() {
    var el = $('#top'); if (!el) return;
    var stage = $('.hm-open__stage', el), card = $('.hm-open__card', el), flip = $('.bcard__flip', card), front = $('.bcard__front', card), back = $('.bcard__back', card),
      lock = $('.bcard__lock', front), pins = $('.pins', front), tr = $('.pins__tr', front), bl = $('.pins__bl', front), shadow = $('.hm-open__shadow', el),
      white = $('.hm-open__white', el), copy = $('.hm-open__copy', el), cue = $('.hm-open__cue', el), sheenF = $('.sheen', front), sheenB = $('.sheen', back),
      word = $('.bcard__word', front), rule = $('.bcard__rule', back), bits = $$(':scope > :not(.sheen)', back), g = {};
    function measure() {
      var vw = stage.offsetWidth, sv = S.svh(), lv = Math.max(stage.offsetHeight, sv), R = card.offsetWidth, cw = front.offsetWidth, ch = front.offsetHeight;
      g.k = R / cw;                                   /* the front's own scale, so it sits on the card */
      g.s0 = cw / R;                                  /* the card's scale while the front covers the screen */
      g.dx = Math.max(0, (cw - vw) / 2);              /* from the card's corners in to the screen's */
      g.dyT = Math.max(0, ch / 2 - sv / 2);
      g.dyB = Math.max(0, sv / 2 + ch / 2 - lv);
      g.sw = Math.min(0.5256 * cw, Math.max(200, 0.44 * vw)) / (0.5256 * cw);
      g.lock = cw / lock.offsetWidth;                 /* the lock-up reaches the card's own proportion as the camera draws back */
      g.lift = -lock.offsetWidth * 0.036;             /* on the first screen it stands a little high, over the headline */
      /* the card's rectangle on the stage, as the white's first clip: the back at rest is exactly that box */
      var t = card.offsetTop, l = card.offsetLeft, h = card.offsetHeight, sh = stage.offsetHeight;
      g.clip0 = 'inset(' + px(t) + ' ' + px(vw - l - R) + ' ' + px(sh - t - h) + ' ' + px(l) + ' round ' + px(R * 0.036) + ' / ' + px(h * 0.055) + ')';
      gsap.set(front, { scale: g.k });
    }
    measure();
    S.ScrollTrigger.addEventListener('refreshInit', measure);
    var clip1 = 'inset(0px 0px 0px 0px round 0px / 0px)';

    S.film(el, function (tl) {
      var io = 'power2.inOut';
      /* the words leave first */
      tl.to(copy, { autoAlpha: 0, y: -40, duration: 8, ease: 'power1.in' }, 1);
      tl.to(cue, { autoAlpha: 0, duration: 3 }, 0);
      /* the camera draws back: the field becomes the card on the table */
      tl.fromTo(flip, { scale: function () { return g.s0; } }, { scale: 1, duration: 34, ease: io }, 3);
      tl.fromTo(tr, { x: function () { return -g.dx; }, y: function () { return g.dyT; }, scale: function () { return g.sw; } }, { x: 0, y: 0, scale: 1, duration: 34, ease: io }, 3);
      tl.fromTo(bl, { x: function () { return g.dx; }, y: function () { return -g.dyB; }, scale: function () { return g.sw; } }, { x: 0, y: 0, scale: 1, duration: 34, ease: io }, 3);
      tl.fromTo(lock, { scale: 1, y: function () { return g.lift; } }, { scale: function () { return g.lock; }, y: 0, duration: 34, ease: io }, 3);
      tl.fromTo(shadow, { autoAlpha: 0, scale: 1.18 }, { autoAlpha: 1, scale: 1, duration: 13, ease: 'power2.out' }, 25);
      /* it tilts as it comes to rest, and one pass of light crosses the gold */
      tl.fromTo(flip, { rotationX: 0, rotationZ: 0 }, { rotationX: 10, rotationZ: -3, duration: 15, ease: 'power2.out' }, 24);
      tl.set(sheenF, { opacity: 0.6 }, 26).fromTo(sheenF, { xPercent: -46 }, { xPercent: 46, duration: 20, ease: 'power1.inOut' }, 26).set(sheenF, { opacity: 0 }, 46.5);
      /* it turns over */
      tl.to(flip, { rotationY: 180, rotationX: 0, rotationZ: 0, duration: 22, ease: io }, 42);
      tl.to(flip, { scale: 1.08, duration: 11, ease: 'power1.inOut' }, 42).to(flip, { scale: 1, duration: 11, ease: 'power1.inOut' }, 53);
      tl.to(shadow, { scaleX: 0.42, opacity: 0.5, duration: 11, ease: 'power1.inOut' }, 42).to(shadow, { scaleX: 1, opacity: 1, duration: 11, ease: 'power1.inOut' }, 53);
      /* the back: its gold rule draws, the light crosses it, and it is held to be read */
      tl.fromTo(rule, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 9, ease: 'power2.out' }, 55);
      tl.set(sheenB, { opacity: 1 }, 58).fromTo(sheenB, { xPercent: -46 }, { xPercent: 46, duration: 13, ease: 'power1.inOut' }, 58).set(sheenB, { opacity: 0 }, 71.5);
      /* the white opens from the card's rectangle to the screen, under the card, so the two whites are one; the card's
         words leave while it opens, then the card's own faint edge. The white is whole at 88, before the next
         section's words rise onto it, and the header reads paper the moment the white is under its foot. */
      if (white) {
        tl.fromTo(white, { autoAlpha: 1, clipPath: function () { return g.clip0; } }, { autoAlpha: 1, clipPath: clip1, duration: 16, ease: 'power2.inOut', immediateRender: false }, 72);
        tl.set(white, { autoAlpha: 0 }, 71.9);
      }
      tl.to(shadow, { autoAlpha: 0, duration: 5, ease: 'power1.out' }, 72);
      tl.to(bits, { autoAlpha: 0, duration: 7, ease: 'power1.in' }, 75);
      tl.to(card, { autoAlpha: 0, duration: 5, ease: 'none' }, 82);
    });

    /* the opening, once, while the visitor has not yet scrolled: the stripes draw line by line, the rings draw and
       weave, NOSCA settles, the two lines rise out of their masks. It waits for the type (the word is split into its
       letters); a visit that has waited past a second (index.html marks it .is-late) has already been given the
       finished card, and the opening is skipped. */
    var w = S.weave($('.weave', front)), lines = $$('.hm-open__title > span, .hm-open__sub > span', el);
    function play() {
      /* late: the stylesheet is already bringing the finished card in (its transitions live under :not(.is-go), so
         .is-go is not added, or they would be cut short) */
      if (el.classList.contains('is-late')) return;
      if ((window.pageYOffset || 0) > 40) { el.classList.add('is-go'); return; }
      var split = S.split(word, 'chars'), chars = split && split.chars && split.chars.length ? split.chars : [word];
      el.classList.add('is-go');                     /* the stylesheet's waiting states go first, or GSAP reads them back as pixels */
      if (w) w.set(25, 0);
      gsap.set(chars, { opacity: 0, x: function (i) { return (i - (chars.length - 1) / 2) * 16; } });
      gsap.set(lines, { y: 0, yPercent: 120 });
      var intro = gsap.timeline({ delay: 0.05 })
        .add(S.pins(pins, { paused: false, stagger: 0.07 }), 0)
        .to(chars, { opacity: 1, x: 0, duration: 1.2, ease: 'power3.out', stagger: 0.06 }, 1.3)
        .to(lines, { yPercent: 0, duration: 1.15, ease: 'power3.out', stagger: 0.14 }, 0.7);
      if (w) intro.to(w.state, { draw: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: w.render }, 0.15)
        .to(w.state, { d: 12, duration: 1.5, ease: 'power3.inOut', onUpdate: w.render }, 0.95);
      /* a visitor who scrolls before it has finished gets the finished card at once */
      var stop = function () { if ((window.pageYOffset || 0) > 40) { intro.progress(1); window.removeEventListener('scroll', stop); } };
      window.addEventListener('scroll', stop, { passive: true });
    }
    S.fonts.then(play, play);
  })();

  /* ───────── 3. the coach ─────────
     The sequence stands still on each caption's own picture and plays only on the turn of a caption: the plus rises
     under "One plus.", Who arrives under "Who.", the areas are tapped under "What was worked on.", and Log it goes
     down between that caption and "Logged.", whose finished screen comes early and is held to the end. */
  S.film('#coach', function (tl, s) {
    var q = S.sequence(s.$('[data-sequence]'), { scroll: false }); if (!q) return;
    var st = s.steps; if (st.length < 5) return;
    var a = function (i) { return st[i][0]; }, L = function (i) { return st[i][1] - st[i][0]; }, f = q.at;
    q.keys(tl, [
      [0, f(0)], [a(1), f(0)],
      [a(1) + L(1) * 0.55, f(10)], [a(2), f(10)],
      [a(2) + L(2) * 0.45, f(18)], [a(3), f(18)],
      [a(3) + L(3) * 0.3, f(27)], [a(3) + L(3) * 0.68, f(35)], [a(4) - 2.4, f(35)],
      [a(4) + 1.6, f(42)], [a(4) + L(4) * 0.5, f(57)], [100, f(57)]
    ]);
  });

  /* ───────── 4. the player and the family ─────────
     The feed scrolls from one lesson to the next under the first caption; then the screens slide through the phone
     on the turn of each caption. The phone stands square while a caption is read, and turns a little only while its
     screen changes. */
  S.film('#player', function (tl, s) {
    var phone = s.$('.hm-film__phone'), d = S.device(phone), q = S.sequence(s.$('[data-sequence]'), { scroll: false });
    var len = 4.6, cuts = s.steps.slice(1).map(function (r) { return r[0] - len / 2; });
    if (q) q.keys(tl, [[0, 0], [2.5, 0], [Math.max(6, cuts[0] - 2), q.at(14)], [100, q.at(14)]]);
    if (d && d.swap && cuts.length) d.swap(tl, cuts, { mode: 'slide', duration: len });
    tl.fromTo(phone, { rotationY: 13, rotationX: 4, rotationZ: -1, transformPerspective: 1600 }, { rotationY: 0, rotationX: 0, rotationZ: 0, duration: 9, ease: 'power2.out' }, 0);
    cuts.forEach(function (c) {
      tl.to(phone, { rotationY: -9, rotationX: 2, duration: len * 0.5, ease: 'power1.inOut' }, c - 0.4)
        .to(phone, { rotationY: 0, rotationX: 0, duration: len * 0.5 + 0.8, ease: 'power1.inOut' }, c + len * 0.5 - 0.4);
    });
  });

  /* ───────── 7. the name ─────────
     The stripes draw; the two rings travel in from the edges of the screen and weave into the mark; NOSCA settles
     under them (its letters once the type is in); the line rises word by word; the rest arrives last. */
  S.film('#name', function (tl, s) {
    var w = S.weave(s.$('.hm-name__weave')), word = s.$('.hm-name__word'), tail = s.$$('.hm-name__line, .hm-name__more');
    var far = function () { return w.far(0.1); };
    S.drawStripes(s.$('.hm-name__pins'), { tl: tl, at: 0, duration: 44 });
    if (w) {
      w.set(far(), 1);
      tl.fromTo(w.state, { d: far, draw: 1 }, { d: 12, duration: 38, ease: 'power2.inOut', onUpdate: w.render }, 2);
    }
    S.fonts.then(function () {
      var split = S.split(word, 'chars'), chars = split && split.chars && split.chars.length ? split.chars : [word];
      chars.forEach(function (c, i) {
        tl.fromTo(c, { opacity: 0, x: (i - (chars.length - 1) / 2) * 14 }, { opacity: 1, x: 0, duration: 12, ease: 'power2.out' }, 30 + i * 1.2);
      });
      tl.render(tl.time(), false, true);
    });
    S.rise(s.$('.hm-name__means'), { tl: tl, at: 44, duration: 28 });
    tl.fromTo(tail, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 9, ease: 'power2.out' }, 74);
  });

  /* ───────── grounds on the card's diagonal ─────────
     The photograph's film arrives under the white passage of the sports with its top edge on the card's slope, a
     gold line along it, levelling as it reaches the top of the screen (what lies above the slope is the white page).
     The footer's green rises the same way out of the close's foot, as the foundation's ground shift does. */
  var LEAD = function (w, k) { return Math.round(Math.min(w * 0.6915, S.svh() * k)); };
  (function photo() {
    var el = $('#words'); if (!el) return;
    var edge = document.createElement('i'); edge.className = 'hm-diag__edge'; edge.setAttribute('aria-hidden', 'true'); el.appendChild(edge);
    var lead = 0, width = 0;
    var size = function () { width = el.offsetWidth || window.innerWidth; lead = LEAD(width, 0.5); };
    var render = function (p) {
      p = Math.max(0, Math.min(1, p));
      var L = lead * (1 - p);
      if (L < 0.5) { el.style.clipPath = ''; edge.style.opacity = '0'; return; }
      el.style.clipPath = 'polygon(0px 0px, 100% ' + L.toFixed(1) + 'px, 100% 100%, 0px 100%)';
      edge.style.opacity = '1';
      edge.style.transform = 'rotate(' + (Math.atan2(L, width) * 180 / Math.PI).toFixed(3) + 'deg)';
    };
    size(); render(0);
    S.ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'top top', onRefreshInit: size, onRefresh: function (st) { render(st.progress); }, onUpdate: function (st) { render(st.progress); } });
  })();
  (function footer() {
    var foot = $('.foot'), host = $('#start'); if (!foot || !host) return;
    var apron = document.createElement('div'); apron.className = 'shift__apron'; apron.setAttribute('aria-hidden', 'true');
    apron.innerHTML = '<i class="shift__fill"></i><i class="shift__edge"></i>';
    var cs = getComputedStyle(foot);
    apron.style.setProperty('--shift-bg', cs.backgroundColor);
    apron.style.setProperty('--shift-rule', cs.getPropertyValue('--rule').trim() || '#CDB065');
    host.appendChild(apron);
    var fill = apron.firstChild, edge = apron.lastChild, lead = 0, width = 0;
    var size = function () {
      width = host.offsetWidth || window.innerWidth; lead = LEAD(width, 0.36);
      apron.style.height = lead + 'px';
      host.style.paddingBottom = '';
      if ((parseFloat(getComputedStyle(host).paddingBottom) || 0) < lead + 24) host.style.paddingBottom = (lead + 24) + 'px';
    };
    var render = function (p) {
      p = Math.max(0, Math.min(1, p));
      var q = 1 - p, top = (1 - q) * 100;
      fill.style.clipPath = 'polygon(0% ' + top.toFixed(2) + '%, 100% 100%, 0% 100%)';
      edge.style.transform = 'rotate(' + (Math.atan2(lead * q, width) * 180 / Math.PI).toFixed(3) + 'deg)';
      edge.style.opacity = q < 0.02 ? '0' : '1';
    };
    size(); render(0);
    S.ScrollTrigger.create({ trigger: foot, start: 'top bottom', end: function () { return foot.offsetHeight > S.svh() * 0.9 ? 'top ' + Math.round(Math.min(S.svh() * 0.14, 120)) + 'px' : 'bottom bottom'; }, onRefreshInit: size, onRefresh: function (st) { render(st.progress); }, onUpdate: function (st) { render(st.progress); } });
  })();
});
