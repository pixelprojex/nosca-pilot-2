/* Partners. Most of the page is attributes (API.md): the two films with the phone, the ground shifts, the ink, the
   rules, the card that turns at the close. This file plays what needs a hand: the card that opens the page, the
   photograph that opens out of the green, the gold line the four steps hang on, and the frames drawing their
   hairlines round themselves. With motion off none of it runs and the page is the finished column the HTML is. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$;
  if (!gsap || !S.motion) return;

  /* ───────── 1. the card ─────────
     It lies on the table, front up. The scroll stands it up into the light, turns it over to its white back with one
     pass of light across the arriving face, and the back's gold rule draws. The words beside it stay still. */
  S.film('#top', function (tl, s) {
    var card = s.$('.pt-open__bcard'); if (!card) return;
    card.classList.remove('is-back', 'bcard--shadow');
    var flip = $('.bcard__flip', card);
    if (!$('.pt-open__cast', flip)) { var cast = document.createElement('i'); cast.className = 'pt-open__cast'; cast.setAttribute('aria-hidden', 'true'); flip.insertBefore(cast, flip.firstChild); }
    var back = $('.bcard__back', card), rule = $('.bcard__rule', back), sheen = $('.sheen', back);
    tl.fromTo(flip, { rotationY: 0, rotationX: 52, rotationZ: -11, y: function () { return s.vh() * 0.05; }, scale: 0.9 },
      { rotationX: 10, rotationZ: -3, y: 0, scale: 1, duration: 30, ease: 'power2.out' }, 0);
    tl.to(flip, { rotationY: 180, rotationX: 0, rotationZ: 0, duration: 34, ease: 'power2.inOut' }, 30);
    tl.to(flip, { scale: 1.05, duration: 17, ease: 'power1.inOut' }, 30).to(flip, { scale: 1, duration: 17, ease: 'power1.inOut' }, 47);
    if (sheen) tl.set(sheen, { opacity: 1 }, 52).fromTo(sheen, { x: 0, xPercent: -46 }, { xPercent: 46, duration: 18, ease: 'power1.inOut' }, 52).set(sheen, { opacity: 0 }, 70.5);
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 14, ease: 'power2.out' }, 62);
  });

  /* ───────── 5. climate ─────────
     The photograph waits as a window in the green, opens to the whole screen and comes to rest; the sentence fills
     with ink on it and the line under it rises. */
  S.film('#climate', function (tl, s) {
    var fig = s.$('.pt-still__pic'), img = fig ? $('img', fig) : null, eb = s.$('.pt-still__eb'), h = s.$('.pt-still__h'), p = s.$('.pt-still__p');
    if (fig) tl.fromTo(fig, { clipPath: 'inset(15% 11% 15% 11% round 6px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 36, ease: 'power2.inOut' }, 0);
    if (img) tl.fromTo(img, { scale: 1.22 }, { scale: 1.02, duration: 76, ease: 'power1.out' }, 0);
    if (eb) tl.fromTo(eb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 8, ease: 'power1.out' }, 26);
    if (h) { tl.fromTo(h, { autoAlpha: 0 }, { autoAlpha: 1, duration: 6, ease: 'power1.out' }, 26); S.inkFill(h, { tl: tl, at: 30, duration: 32 }); }
    if (p) S.rise(p, { tl: tl, at: 60, duration: 18 });
    /* the words go before the film lets go, so the white that rises next crosses the picture alone */
    tl.to(s.$('.pt-still__in'), { autoAlpha: 0, duration: 7, ease: 'power1.in' }, 93);
  });

  /* ───────── 6. how it starts ─────────
     The gold line draws down beside the four steps as the scroll passes, and each numeral takes its full gold as
     the line reaches it. Nothing that is being read moves. */
  (function steps() {
    var list = $('.pt-steps'), line = $('.pt-steps__line > i', list || document); if (!list || !line) return;
    gsap.fromTo(line, { scaleY: 0, transformOrigin: '50% 0%' }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 72%', end: 'bottom 62%', scrub: 0.6 } });
    $$('.pt-step', list).forEach(function (st) {
      var n = $('.pt-step__n', st); if (!n) return;
      gsap.fromTo(n, { opacity: 0.22 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: st, start: 'top 74%', end: 'top 60%', scrub: 0.6 } });
    });
  })();

  /* ───────── 7. frames kept ─────────
     Each frame draws its hairline round itself, top, right, foot, left, and then its mark, one frame after another. */
  (function frames() {
    var wall = $('.pt-frames'); if (!wall) return;
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: wall, start: 'top 86%', end: 'bottom 58%', scrub: 0.6 } });
    $$('.pframe', wall).forEach(function (f, i) {
      var at = i * 9, t = $('.pt-edge--t', f), r = $('.pt-edge--r', f), b = $('.pt-edge--b', f), l = $('.pt-edge--l', f);
      tl.fromTo(t, { scaleX: 0 }, { scaleX: 1, duration: 5, ease: 'power1.in' }, at)
        .fromTo(r, { scaleY: 0 }, { scaleY: 1, duration: 3.4 }, at + 5)
        .fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 5 }, at + 8.4)
        .fromTo(l, { scaleY: 0 }, { scaleY: 1, duration: 3.4, ease: 'power1.out' }, at + 13.4);
      var mark = $('.mark', f); if (mark) S.drawStripes(mark, { tl: tl, at: at + 4, duration: 13 });
    });
  })();
});
