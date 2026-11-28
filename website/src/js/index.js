/* The one page. Two things need a hand here and nothing else does (site.js plays every arrival):
   - a tour: the phone plays its steps ONCE as it arrives, on its own clock, and rests on the last; a tap on a step
     shows that step (a sequence of the real app drawn on a canvas, or the app's screens crossfading). It pauses off
     screen and never runs again by itself, so nothing moves after the visitor has stopped.
   - the header's anchors: the one for the part on screen is underlined.
   Under Reduce Motion a tap still shows a step, at once. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, $ = S.$, $$ = S.$$, live = S.live;

  $$('[data-tour]').forEach(function (el) {
    var btns = $$('.tour__steps button', el); if (!btns.length) return;
    var cur = -1;
    function light(i) {
      if (i === cur) return; cur = i;
      btns.forEach(function (b, k) { b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
    }
    el.classList.add('is-on');
    light(0);

    if (el.dataset.tour === 'seq') {
      var q = $('[data-sequence]', el), seq = q && S.sequence(q, { scroll: false });
      if (!seq || !gsap) return;
      var frames = btns.map(function (b) { return +b.dataset.frame || 0; });
      var holds = btns.map(function (b) { return b.dataset.hold == null ? 1.4 : +b.dataset.hold; });
      var starts = [], tl = gsap.timeline({ paused: true }), t = 0;
      btns.forEach(function (b, i) {
        starts.push(t);
        tl.call(light, [i], t);
        var from = i ? frames[i - 1] : 0, to = frames[i], len = i ? Math.max(0.5, (to - from) * 0.075) : 0;
        if (len) tl.fromTo(seq, { p: seq.at(from) }, { p: seq.at(to), duration: len, ease: 'none', immediateRender: false }, t);
        else tl.set(seq, { p: seq.at(to) }, t);
        t += len + holds[i];
      });
      var played = false, inView = false;
      var start = function () { seq.load().then(function () { if (!played && inView && live) { played = true; tl.play(0); } }); };
      S.inView(el, { threshold: 0.45, margin: '0px', enter: function () { inView = true; if (played) { if (tl.progress() < 1 && tl.paused() && tl._was) tl.play(); } else start(); }, leave: function () { inView = false; if (tl.isActive()) { tl._was = true; tl.pause(); } } });
      btns.forEach(function (b, i) {
        b.addEventListener('click', function () {
          played = true; tl._was = false;
          seq.load();
          if (live) tl.pause(starts[i] + 0.01, false).play();   /* from that step on, once, to the end */
          else { tl.pause(); seq.frame(frames[i]); }
          light(i);
        });
      });
      if (!live) { /* the poster is the still; a tap draws its step */ }
      return;
    }

    /* screens: the app's own screens crossfade inside the phone */
    var phone = $('[data-phone]', el), api = phone && S.phone(phone);
    if (!api || !gsap) return;
    var call = null, done = false, step = 3.1;
    function show(i) { api.show(i, { instant: !live, duration: 0.8 }); light(i); }
    function next() {
      call = null;
      if (cur >= btns.length - 1) { done = true; return; }
      show(cur + 1); call = gsap.delayedCall(step, next);
    }
    S.inView(el, { threshold: 0.45, margin: '0px', enter: function () { if (live && !done && !call) { api.warm(); call = gsap.delayedCall(cur <= 0 ? 1.6 : step, next); } }, leave: function () { if (call) { call.kill(); call = null; } } });
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { done = true; if (call) { call.kill(); call = null; } api.warm(); show(i); });
    });
  });

  /* the header's anchors: the part on screen is underlined (a class, never a movement tied to the scroll) */
  var links = $$('.hdr__nav a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    var parts = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var seen = new Map();
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { seen.set(e.target, e.isIntersecting); });
      var on = -1; parts.forEach(function (p, i) { if (p && seen.get(p)) on = i; });
      links.forEach(function (a, i) { if (i === on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }, { rootMargin: '-45% 0px -54% 0px' });
    parts.forEach(function (p) { if (p) io.observe(p); });
  }
});
