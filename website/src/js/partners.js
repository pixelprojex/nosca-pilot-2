/* Partners. Most of the page is attributes (API.md): the two films with the phone, the ground shifts, the ink, the
   rules, the card that turns at the close. This file plays what needs a hand: the card that opens the page, the
   register keyed to its captions, the camera inside the juniors' phone, the still lake whose clip the scroll plays,
   the gold line the four steps hang on, and the frames drawing their hairlines round themselves. With motion off
   none of it runs and the page is the finished column the HTML is. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$;
  if (!gsap || !S.motion) return;
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };

  /* On a phone under 620 tall (an iPhone SE in Safari, the first SE) a pinned phone film would leave the phone a
     stamp and trap the thumb: the two phone films are the plain column there, each caption with its own screen.
     Ready runs before the markup films are built, so the attribute is read when they are. */
  if (mq('(max-width: 719px) and (max-height: 619px)')) $$('#coach, #juniors').forEach(function (f) { f.dataset.unpin = 'sm'; });
  /* on a phone the 'tall' zoom would start from a picture enlarged past what a 660 frame holds: begin closer */
  if (mq('(max-width: 719px)')) $$('#coach [data-zoom]').forEach(function (d) { d.dataset.zoom = '1.3'; });

  /* the stage's own object leaves as its film ends, so the next ground's wedge crosses an empty frame and never
     cuts through the card or the phone */
  function leave(tl, el, at) {
    if (el) tl.fromTo(el, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: function () { return -S.svh() * 0.04; }, duration: 100 - at, ease: 'power1.in', immediateRender: false }, at);
  }

  /* ───────── 1. the card ─────────
     It lies on the table, front up. The scroll stands it up into the light, turns it over to its white back with one
     pass of light across the arriving face, and the back's gold rule draws. The words beside it stay still. */
  S.film('#top', function (tl, s) {
    var card = s.$('.pt-open__bcard'); if (!card) return;
    /* the pose it starts from is laid out in CSS before the first paint (partners.css); the class that shows its
       back at rest goes, and the shadow that turns with it is the flip's own (CSS too) */
    card.classList.remove('is-back');
    var flip = $('.bcard__flip', card);
    var back = $('.bcard__back', card), rule = $('.bcard__rule', back), sheen = $('.sheen', back);
    tl.fromTo(flip, { rotationY: 0, rotationX: 52, rotationZ: -11, y: function () { return s.vh() * 0.05; }, scale: 0.9 },
      { rotationX: 10, rotationZ: -3, y: 0, scale: 1, duration: 30, ease: 'power2.out' }, 0);
    tl.to(flip, { rotationY: 180, rotationX: 0, rotationZ: 0, duration: 34, ease: 'power2.inOut' }, 30);
    tl.to(flip, { scale: 1.05, duration: 17, ease: 'power1.inOut' }, 30).to(flip, { scale: 1, duration: 17, ease: 'power1.inOut' }, 47);
    if (sheen) tl.set(sheen, { opacity: 1 }, 52).fromTo(sheen, { x: 0, xPercent: -46 }, { xPercent: 46, duration: 18, ease: 'power1.inOut' }, 52).set(sheen, { opacity: 0 }, 70.5);
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 14, ease: 'power2.out' }, 62);
    leave(tl, s.$('.pt-open__card'), 95);
  });

  /* ───────── 3. the coach's side ─────────
     The register is keyed to its captions by hand: the day holds through the first; the register rises at one tap
     early in the second and waits there; the ten names are marked across the third, the list gliding down as the
     thumb does; Submit and "Register taken" arrive once the fourth is up, and hold, so the last caption is read beside
     the register taken. Frames (assets/seq/pt-register/manifest.json): home 0 · open 1–8 · marks 9–33 · submit 34–41. */
  S.film('#coach', function (tl, s) {
    var q = s.$('[data-sequence]'), api = q ? S.sequence(q, { scroll: false }) : null;
    if (api) {
      var a = s.at, f = function (i) { return api.at(i); };
      api.keys(tl, [[0, 0], [a(1) + 1, 0], [a(1) + 12, f(8)], [a(2), f(8)], [a(3) + 1, f(33)], [a(3) + 14, f(41)], [100, f(41)]]);
    }
    leave(tl, s.$('.pt-film__dev'), 96);
  });

  /* ───────── 4. juniors ─────────
     The screens push up through the phone with the captions (data-device='push'); while each is held the camera
     inside the screen moves slowly toward what its caption names: the children, the parent's labelled lines, the
     families' threads, the junior's drill. */
  S.film('#juniors', function (tl, s) {
    var shots = s.$$('.phone__screen .screen'), at = [[0, '50% 40%'], [1, '30% 34%'], [2, '50% 30%'], [3, '50% 18%']];
    at.forEach(function (x) {
      var img = shots[x[0]], r = s.steps[x[0]]; if (!img || !r) return;
      var from = x[0] === 0 ? 0 : r[0] - 3.5, to = x[0] === shots.length - 1 ? 100 : r[1] + 3.5;
      tl.fromTo(img, { scale: 1, transformOrigin: x[1] }, { scale: 1.13, duration: to - from, ease: 'none', immediateRender: false }, from);
    });
  });

  /* ───────── 5. climate ─────────
     The photograph waits as a window in the green, opens to the whole screen and comes to rest; the sentence fills
     with ink on it and the line under it rises. */
  S.film('#climate', function (tl, s) {
    var fig = s.$('.pt-still__pic'), img = fig ? $('video, img', fig) : null, eb = s.$('.pt-still__eb'), h = s.$('.pt-still__h'), p = s.$('.pt-still__p');
    /* the scroll is the clip's play head: the boat crosses the lake as the thumb goes down */
    var vid = fig ? $('video', fig) : null; if (vid) S.scrubVideo(vid, { tl: tl, at: 0, duration: 100 });
    if (fig) tl.fromTo(fig, { clipPath: 'inset(15% 11% 15% 11% round 6px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 36, ease: 'power2.inOut' }, 0);
    if (img) tl.fromTo(img, { scale: 1.22 }, { scale: 1.02, duration: 76, ease: 'power1.out' }, 0);
    if (eb) tl.fromTo(eb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 8, ease: 'power1.out' }, 26);
    if (h) { tl.fromTo(h, { autoAlpha: 0 }, { autoAlpha: 1, duration: 6, ease: 'power1.out' }, 26); S.inkFill(h, { tl: tl, at: 30, duration: 32 }); }
    if (p) S.rise(p, { tl: tl, at: 46, duration: 18 });
    /* the words go as the film lets go, so the white that rises next crosses the picture alone */
    tl.to(s.$('.pt-still__in'), { autoAlpha: 0, duration: 4, ease: 'power1.in' }, 96);
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
     Each frame draws its hairline round itself, top, right, foot, left, one frame after another. */
  (function frames() {
    var wall = $('.pt-frames'); if (!wall) return;
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: wall, start: 'top 88%', end: 'bottom 74%', scrub: 0.6 } });
    $$('.pframe', wall).forEach(function (f, i) {
      var at = i * 14, t = $('.pt-edge--t', f), r = $('.pt-edge--r', f), b = $('.pt-edge--b', f), l = $('.pt-edge--l', f);
      tl.fromTo(t, { scaleX: 0 }, { scaleX: 1, duration: 5, ease: 'power1.in' }, at)
        .fromTo(r, { scaleY: 0 }, { scaleY: 1, duration: 3.4 }, at + 5)
        .fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 5 }, at + 8.4)
        .fromTo(l, { scaleY: 0 }, { scaleY: 1, duration: 3.4, ease: 'power1.out' }, at + 13.4);
    });
  })();
});
