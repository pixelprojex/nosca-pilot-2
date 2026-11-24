/* Home. Most of the page is attributes (API.md); this file plays the three scenes that need a hand: the card that
   opens the site, the player's phone (a sequence, then screens), and the name. With motion off none of it runs and
   the page is the finished column the HTML and CSS already are. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$;
  if (!gsap || !S.motion) return;

  /* ───────── 1. the card opens the site ─────────
     The first frame is the card's front at the size of the screen. The scroll draws the camera back until it is the
     card on the table, tilts it into the light, turns it to its white back, and the back grows until it is the page. */
  (function open() {
    var el = $('#top'); if (!el) return;
    var stage = $('.hm-open__stage', el), card = $('.hm-open__card', el), flip = $('.bcard__flip', card), front = $('.bcard__front', card), back = $('.bcard__back', card),
      lock = $('.bcard__lock', front), pins = $('.pins', front), tr = $('.pins__tr', front), bl = $('.pins__bl', front), shadow = $('.hm-open__shadow', el),
      copy = $('.hm-open__copy', el), cue = $('.hm-open__cue', el), sheenF = $('.sheen', front), sheenB = $('.sheen', back), word = $('.bcard__word', front),
      rule = $('.bcard__rule', back), bits = $$(':scope > :not(.sheen)', back), g = {};
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
      g.sEnd = Math.max(vw / R, (2 * lv - sv) / (R * 55 / 84)) * 1.05;   /* the back, grown until it is the page */
      gsap.set(front, { scale: g.k });
    }
    measure();
    S.ScrollTrigger.addEventListener('refreshInit', measure);

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
      /* the back: its gold rule draws, the light crosses it */
      tl.fromTo(rule, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 9, ease: 'power2.out' }, 55);
      tl.set(sheenB, { opacity: 1 }, 58).fromTo(sheenB, { xPercent: -46 }, { xPercent: 46, duration: 13, ease: 'power1.inOut' }, 58).set(sheenB, { opacity: 0 }, 71.5);
      /* the back is held a moment to be read, then grows until it is the page: it starts slowly with its words still
         on it, they go as it gathers pace, and it is all white at 95, as the next section's first words rise onto it */
      tl.to(flip, { scale: function () { return g.sEnd; }, duration: 21, ease: 'power3.in' }, 74);
      tl.to(bits, { autoAlpha: 0, duration: 5, ease: 'power1.in' }, 85);
      tl.to(shadow, { autoAlpha: 0, duration: 6 }, 78);
    });

    /* the opening, once, while the visitor has not yet scrolled: the stripes draw line by line, the rings draw and
       weave, NOSCA settles, the two lines rise out of their masks */
    var w = S.weave($('.weave', front)), split = S.split(word, 'chars'), chars = split && split.chars && split.chars.length ? split.chars : [word];
    var lines = $$('.hm-open__title > span, .hm-open__sub > span', el);
    el.classList.add('is-go');                       /* the stylesheet's waiting states go first, or GSAP reads them back as pixels */
    w.set(25, 0);
    gsap.set(chars, { opacity: 0, x: function (i) { return (i - (chars.length - 1) / 2) * 16; } });
    gsap.set(lines, { y: 0, yPercent: 120 });
    var intro = gsap.timeline({ delay: 0.1 })
      .add(S.pins(pins, { paused: false, stagger: 0.07 }), 0)
      .to(w.state, { draw: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: w.render }, 0.15)
      .to(w.state, { d: 12, duration: 1.5, ease: 'power3.inOut', onUpdate: w.render }, 0.95)
      .to(chars, { opacity: 1, x: 0, duration: 1.2, ease: 'power3.out', stagger: 0.06 }, 1.3)
      .to(lines, { yPercent: 0, duration: 1.15, ease: 'power3.out', stagger: 0.14 }, 0.7);
    /* a visitor who arrives part way down (a reload, a link to a section) gets the finished card at once */
    if ((window.pageYOffset || 0) > 40) intro.progress(1);
  })();

  /* ───────── 4. the player and the family ─────────
     The feed scrolls from one lesson to the next under the first caption; then the screens slide through the phone
     with the captions, while it turns slowly from one side to the other (data-turn-to, in the markup). */
  S.film('#player', function (tl, s) {
    var phone = s.$('.hm-film__phone'), d = S.device(phone), q = S.sequence(s.$('[data-sequence]'), { scroll: false });
    var len = 4.6, cuts = s.steps.slice(1).map(function (r) { return r[0] - len / 2; });
    if (q) q.keys(tl, [[0, 0], [2.5, 0], [Math.max(6, cuts[0] - 2), q.at(14)], [100, q.at(14)]]);
    if (d && d.swap && cuts.length) d.swap(tl, cuts, { mode: 'slide', duration: len });
  });

  /* ───────── 7. the name ─────────
     The stripes draw; the two rings travel in from the edges of the screen and weave into the mark; NOSCA settles
     under them; the line rises word by word; the rest arrives last. */
  S.film('#name', function (tl, s) {
    var w = S.weave(s.$('.hm-name__weave')), word = s.$('.hm-name__word'), tail = s.$$('.hm-name__line, .hm-name__more');
    var split = S.split(word, 'chars'), chars = split && split.chars && split.chars.length ? split.chars : [word];
    var far = function () { return w.far(0.1); };
    S.drawStripes(s.$('.hm-name__pins'), { tl: tl, at: 0, duration: 44 });
    if (w) {
      w.set(far(), 1);
      tl.fromTo(w.state, { d: far, draw: 1 }, { d: 12, duration: 38, ease: 'power2.inOut', onUpdate: w.render }, 2);
    }
    chars.forEach(function (c, i) {
      tl.fromTo(c, { opacity: 0, x: (i - (chars.length - 1) / 2) * 14 }, { opacity: 1, x: 0, duration: 12, ease: 'power2.out' }, 30 + i * 1.2);
    });
    S.rise(s.$('.hm-name__means'), { tl: tl, at: 44, duration: 28 });
    tl.fromTo(tail, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 9, ease: 'power2.out' }, 74);
  });
});
