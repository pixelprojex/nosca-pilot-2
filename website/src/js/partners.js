/* Partners. The page rests on its finished HTML. With motion: the foil on the wall catches the light, and the card turns to its code. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$;
  if (!gsap || !S.motion) return;

  /* the bands of light rest off to the left in CSS (a percentage); GSAP reads that back as pixels and would add every
     xPercent sweep on top of it. Zero it once and every sweep crosses whole. */
  gsap.set($$('.sheen'), { x: 0 });

  /* the wall: the foil catches the light on one frame after another, left to right and a little down, and comes round again
     while the wall is on screen (--glint lifts the mark and the gold line; partners.css) */
  (function wall() {
    var el = $('.pt-frames'); if (!el) return;
    var box = el.getBoundingClientRect(), tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.6, delay: 1.8 });
    $$('.pframe', el).forEach(function (f) {
      var r = f.getBoundingClientRect(), at = ((r.left - box.left) / (box.width || 1)) * 1.5 + ((r.top - box.top) / (box.height || 1)) * 0.9;
      tl.fromTo(f, { '--glint': 0 }, { '--glint': 1, duration: 1.4, ease: 'sine.inOut' }, at).to(f, { '--glint': 0, duration: 2, ease: 'sine.inOut' }, at + 1.4);
    });
    S.inView(el, { threshold: 0.25, margin: '0px', enter: function () { tl.play(); }, leave: function () { tl.pause(); } });
  })();

  /* the card comes in on its front and turns to its code */
  (function card() {
    var el = $('.pt-bcard'); if (!el) return;
    el.classList.remove('is-back');
    gsap.fromTo($('.bcard__flip', el), { rotationY: 0 }, { rotationY: 180, ease: 'power1.inOut', scrollTrigger: { trigger: el, start: 'top 94%', end: 'center 56%', scrub: 0.9 } });
  })();
});
