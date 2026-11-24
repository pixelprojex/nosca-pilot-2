/* Product: a film in eight chapters. The films themselves are markup (data-film, data-step, data-device: API.md);
   this file adds what a chapter needs beyond that: the hand-over between chapters (the phone turns out of one
   and into the next while the stages change), the opening's ground shift, the picture that opens close on a
   drawing, the gold line round a control, and the reel of chapter ticks at the edge of a desk's screen. */
Site.ready(function (S) {
  if (!S.motion) return;
  var gsap = S.gsap, ScrollTrigger = S.ScrollTrigger;
  var pose = function (v) { var a = String(v || '').split(',').map(Number); return { rotationY: a[0] || 0, rotationX: a[1] || 0, rotationZ: a[2] || 0 }; };

  /* the first screen: the phone rises into the stage as it turns; then the rest ground opens through the card's diagonal */
  S.film('#top', function (tl, s) {
    tl.fromTo(s.$('.pd-top__dev'), { y: function () { return s.vh() * 0.2; } }, { y: 0, duration: 46, ease: 'power2.out' }, 0);
    tl.fromTo(s.$('.pd-top__copy'), { y: 0 }, { y: function () { return -s.vh() * 0.05; }, duration: 30 }, 70);
    S.groundShift(s.$('.pd-top__next'), { tl: tl, at: 72, duration: 28, shape: 'wedge' });
  });

  /* what each chapter adds to its markup film */
  var extra = {
    /* the feed runs frame for frame (the markup does that); the lesson page then slides in over it */
    feed: function (tl, s) { S.device(s.$('.phone')).swap(tl, [s.at(2) - 3], { mode: 'slide', duration: 6 }); },
    /* the picture opens close on the drawing and pulls back to the tools */
    markup: function (tl, s) { tl.fromTo(s.$('.phone .screen'), { scale: 1.6, transformOrigin: '54% 50%' }, { scale: 1, duration: 30, ease: 'power2.inOut' }, 2); },
    /* a fine gold line draws round Log a practice as its caption arrives */
    drills: function (tl, s) {
      s.$$('.pd-ring').forEach(function (r) {
        var i = +r.dataset.ring || 0;
        tl.fromTo(r, { clipPath: 'inset(-6px 110% -6px -6px)' }, { clipPath: 'inset(-6px -6px -6px -6px)', duration: 12, ease: 'power1.inOut' }, s.at(i) + 5);
      });
    }
  };
  S.$$('.pd-ch').forEach(function (el) {
    S.film(el, extra[el.id] || null);
    /* the hand-over: as a chapter's stage comes up the phone turns in to face the reader and the words arrive at their
       own rate; as it leaves the phone turns away. Each on its own wrapper, so nothing fights the film's own timeline. */
    var dev = S.$('.pd-dev', el), out = S.$('.pd-dev__x', el), copy = S.$('.pd-ch__copy', el);
    if (dev && dev.dataset.pdIn) {
      var come = { trigger: el, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true };
      gsap.fromTo(dev, Object.assign({ transformPerspective: 1600, y: function () { return S.lvh() * 0.06; } }, pose(dev.dataset.pdIn)),
        { rotationY: 0, rotationX: 0, rotationZ: 0, y: 0, ease: 'power1.out', scrollTrigger: come });
      if (copy) gsap.fromTo(copy, { y: function () { return S.lvh() * 0.16; } }, { y: 0, ease: 'none', scrollTrigger: Object.assign({}, come) });
    }
    if (out && out.dataset.pdOut) {
      gsap.fromTo(out, { transformPerspective: 1600, rotationY: 0, rotationX: 0, rotationZ: 0 },
        Object.assign({ ease: 'power1.in', scrollTrigger: { trigger: el, start: 'bottom bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } }, pose(out.dataset.pdOut)));
    }
  });

  /* the reel: which chapter is playing, and the ground the ticks stand on */
  var reel = S.$('.pd-reel'), first = S.$('#log'), last = S.$('#progress');
  if (reel && first && last) {
    var items = S.$$('li', reel);
    ScrollTrigger.create({ trigger: first, start: 'top 55%', endTrigger: last, end: 'bottom 45%', toggleClass: { targets: reel, className: 'is-live' } });
    S.$$('.pd-ch').forEach(function (el) {
      var i = (+el.dataset.ch || 1) - 1;
      ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: function (st) { if (st.isActive) items.forEach(function (li, k) { li.classList.toggle('is-on', k === i); }); } });
    });
    S.$$('main > section').forEach(function (sec) {
      ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: function (st) { if (st.isActive) reel.dataset.ground = sec.classList.contains('g-green') ? 'green' : 'paper'; } });
    });
  }
});
