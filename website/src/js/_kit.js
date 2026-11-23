Site.ready(function (S) {
  S.scene('#scene', function (tl, s) {
    S.beats(tl, s.$$('.kit-beat'), [[0, 34], [36, 68], [70, 100]]);
    S.screens(tl, s.$('.kit-scene__phone'), [34, 68]);
    tl.fromTo(s.$('.kit-scene__phone'), { rotationY: -18, rotationX: 8, transformPerspective: 1200 }, { rotationY: 14, rotationX: -4, duration: 100 }, 0);
  });
  S.vignette('#kit-register', function (tl, el) {
    var ticks = S.$$('.app-tick', el);
    tl.set(ticks, { className: 'app-tick' }, 0);
    ticks.forEach(function (t, i) { tl.set(t, { className: 'app-tick is-on' }, 0.6 + i * 0.5).fromTo(t, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0.6 + i * 0.5); });
    tl.to({}, { duration: 1 });
  });
});
