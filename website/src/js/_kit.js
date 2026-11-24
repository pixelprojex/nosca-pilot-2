/* the kit page: the two pieces that need a line of script. Everything else on the page is attributes. */
Site.ready(function (S) {
  /* the opening film: the card's front drawn by the scroll, then the page's white opens through the card's diagonal */
  S.film('#open', function (tl, s) {
    var lock = s.$$('.kit-open__mark, .kit-open__word, .kit-open__h, .kit-open__p');
    S.drawStripes(s.$('.kit-open__pins'), { tl: tl, at: 0, duration: 52 });
    tl.fromTo(lock, { y: 0 }, { y: function () { return -s.vh() * 0.06; }, duration: 60, ease: 'none' }, 0);
    tl.fromTo(s.$('.kit-open__in'), { scale: 1, autoAlpha: 1 }, { scale: 0.94, autoAlpha: 0.5, duration: 30, ease: 'power1.in' }, 58);
    S.groundShift(s.$('.kit-open__next'), { tl: tl, at: 56, duration: 44, shape: 'wedge' });
  });
  /* a live vignette: the register's ticks landing, looping only while it is on screen */
  S.vignette('#kit-register', function (tl, el) {
    var ticks = S.$$('.app-tick', el);
    tl.set(ticks, { className: 'app-tick' }, 0);
    ticks.forEach(function (t, i) { tl.set(t, { className: 'app-tick is-on' }, 0.6 + i * 0.5).fromTo(t, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0.6 + i * 0.5); });
    tl.to({}, { duration: 1 });
  });
});
