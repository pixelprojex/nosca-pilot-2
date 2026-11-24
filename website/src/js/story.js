/* The story, as a slow film. Each scene below is what the scroll plays; without motion (Reduce Motion, no JavaScript,
   a failed script) none of this runs and the finished HTML and CSS stand on their own. The films that are all markup
   (#stand, and #built's captions) are played by the foundation; this file adds what the markup cannot say. */
Site.ready(function (S) {
  'use strict';
  var gsap = S.gsap, W = window, D = document;
  if (!gsap || !S.motion) return;

  /* one scene failing must not take the others with it */
  function guard(id, fn) {
    var el = D.getElementById(id);
    if (!el) return;
    try { fn(el); } catch (e) { if (W.console) console.error(e); }
  }
  /* a photograph under a pinned stage opens out of the page as the stage comes up (the film then settles it) */
  function opening(el, pic) {
    if (!pic) return;
    gsap.fromTo(pic, { clipPath: 'inset(14% 7% 0% 7%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power1.inOut', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top top', scrub: true } });
  }

  /* ───────── the thread: two fine gold lines down the margin, drawn by the scroll as the page passes ───────── */
  S.$$('.st-thread').forEach(function (t) {
    gsap.fromTo(t, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: t.parentElement, start: 'top 72%', end: 'bottom 72%', scrub: 0.4 } });
  });

  /* ───────── 1. the name: two rings stand apart on the dark card; the scroll brings them in until each passes
     through the other; the pinstripes draw; the long form of the name rises; the white opens through the diagonal ───────── */
  guard('top', function (el) {
    S.film(el, function (tl, s) {
      var w = S.weave(s.$('.st-name__weave'));
      if (w) {
        var far = function () { return w.far(S.small() ? 0.2 : 0.16); };
        tl.fromTo(w.state, { d: far, draw: 1 }, { d: 12, draw: 1, duration: 50, ease: 'power2.inOut', onUpdate: w.render }, 0);
        w.set(far(), 1);
      }
      S.drawStripes(s.$('.st-name__pins'), { tl: tl, at: 2, duration: 58 });
      S.rise(s.$('.st-name__long'), { tl: tl, at: 46, duration: 14 });
      S.rise(s.$('.st-name__link'), { tl: tl, at: 58, duration: 10 });
      tl.fromTo(s.$('.st-name__in'), { y: 0, scale: 1 }, { y: function () { return -s.vh() * 0.05; }, scale: 0.97, duration: 24, ease: 'power1.in' }, 70);
      S.groundShift(s.$('.st-name__next'), { tl: tl, at: 70, duration: 24, shape: 'wedge' });
    });
  });

  /* ───────── 2. one moment: the sentence fills with ink a phrase at a time, and the phone does what each phrase says ───────── */
  guard('moment', function (el) {
    var h = S.$('.st-moment__h', el), phone = S.$('.st-moment__phone', el), q = phone && S.$('[data-sequence]', phone);
    if (!h || !phone) return;
    /* the ink: the sentence stays as it is (dim), and a full-ink copy lies on it, a span a word */
    var base = D.createElement('span'); base.className = 'st-ink st-ink__base';
    while (h.firstChild) base.appendChild(h.firstChild);
    /* both copies are cut into the same word spans, so they break their lines in the same places */
    var cut = function (root) { return S.$$('.st-ph', root).map(function (ph) {
      var words = ph.textContent.split(/(\s+)/);
      ph.textContent = '';
      return words.map(function (wd) {
        if (!wd.trim()) { ph.appendChild(D.createTextNode(wd)); return null; }
        var sp = D.createElement('span'); sp.className = 'st-wd'; sp.textContent = wd; ph.appendChild(sp); return sp;
      }).filter(Boolean);
    }); };
    cut(base);
    var top = base.cloneNode(true); top.className = 'st-ink st-ink__top'; top.setAttribute('aria-hidden', 'true');
    var phrases = S.$$('.st-ph', top).map(function (ph) { return S.$$('.st-wd', ph); });
    h.appendChild(base); h.appendChild(top); h.classList.add('is-set');
    if (q) q.dataset.drive = 'manual';

    S.film(el, function (tl, s) {
      var lit = function (words, at, len) {
        var n = words.length, step = n > 1 ? len / n : len;
        words.forEach(function (wd, i) { tl.fromTo(wd, { opacity: 0 }, { opacity: 1, duration: step * 1.4, ease: 'none' }, at + i * step); });
      };
      /* picked up: it rises off the table, from lying back to facing the reader */
      tl.fromTo(phone, { y: function () { return s.vh() * 0.42; }, rotationX: 56, rotationZ: -5, scale: 0.9, transformPerspective: 1400 },
        { y: 0, rotationX: 0, rotationZ: 0, scale: 1, duration: 26, ease: 'power2.out' }, 0);
      if (phrases[0]) lit(phrases[0], 2, 22);
      /* one thing in seconds: the register, frame for frame */
      if (q) {
        var seq = S.sequence(q, { scroll: false });
        seq.keys(tl, [[0, 0], [30, 0], [36, seq.at(4)], [44, seq.at(10)], [50, seq.at(16)], [64, seq.at(33)], [69, seq.at(35)], [100, seq.at(35)]]);
      }
      if (phrases[1]) lit(phrases[1], 31, 30);
      /* put down */
      tl.to(phone, { y: function () { return s.vh() * 0.3; }, rotationX: 48, rotationZ: 4, scale: 0.92, duration: 20, ease: 'power2.in' }, 72);
      if (phrases[2]) lit(phrases[2], 72, 14);
      S.rise(s.$('.st-moment__judge'), { tl: tl, at: 86, duration: 9 });
    });
  });

  /* ───────── 3. what we stand for: the markup film plays the three words; the picture opens out of the page ───────── */
  guard('stand', function (el) { opening(el, S.$('.film__stage > .photo', el)); });

  /* ───────── 5. how it was built: the gold line runs date to date; the 45 cycle days light as it passes them ───────── */
  guard('built', function (el) {
    S.film(el, function (tl, s) {
      var fill = s.$('.st-axis__fill'), pts = s.$$('.st-axis__pt'), tks = s.$$('.st-axis .tk');
      /* [timeline position, how far along the axis] — the steps' own ranges are in the markup */
      var K = [[0, 0], [12, 0], [17, 21.25], [26, 21.25], [31, 33.75], [36, 33.75], [56, 90], [68, 90], [73, 100], [100, 100]];
      var when = function (p) {
        for (var i = 0; i < K.length - 1; i++) { var a = K[i], b = K[i + 1]; if (b[1] > a[1] && p > a[1] && p <= b[1]) return a[0] + (p - a[1]) / (b[1] - a[1]) * (b[0] - a[0]); }
        return 0;
      };
      if (fill) {
        tl.set(fill, { scaleX: 0 }, 0);
        for (var i = 0; i < K.length - 1; i++) {
          var a = K[i], b = K[i + 1]; if (b[1] === a[1]) continue;
          tl.fromTo(fill, { scaleX: a[1] / 100 }, { scaleX: b[1] / 100, duration: b[0] - a[0], ease: 'none', immediateRender: false }, a[0]);
        }
      }
      pts.forEach(function (pt) {
        var p = parseFloat(pt.style.getPropertyValue('--p')) || 0, dot = S.$('b', pt);
        if (dot) tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 2.4, ease: 'power2.out' }, Math.max(0, when(p) - 0.6));
      });
      tks.forEach(function (tk) {
        var t = parseFloat(tk.getAttribute('data-t')) || 0, p = (27 + t * 52) / 80 * 100;
        tl.fromTo(tk, { opacity: 0.2, scaleY: 0.32 }, { opacity: 1, scaleY: 1, duration: 1.6, ease: 'power2.out' }, when(p));
      });
    });
  });

  /* ───────── 6. proven before it ships: the crawl finds each control on the plus sheet, and each one answers ───────── */
  guard('proven', function (el) {
    var nEl = S.$('.st-crawl__n', el), count = { v: 0 };
    if (nEl) nEl.textContent = '0';
    S.film(el, function (tl, s) {
      S.inkFill(s.$('.st-proven__h'), { tl: tl, at: 2, duration: 20 });
      var num = s.$('.st-proven__n .t-numeral');
      if (num) tl.fromTo(num, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% -12% -20% -12%)', duration: 12, ease: 'power1.inOut' }, 16);
      S.rise(s.$('.st-proven__l'), { tl: tl, at: 20, duration: 12 });
      S.rise(s.$('.st-proven__crawl'), { tl: tl, at: 28, duration: 8 });
      tl.fromTo(s.$('.st-crawl__shot'), { y: function () { return s.vh() * 0.08; }, scale: 0.96 }, { y: 0, scale: 1, duration: 28, ease: 'power2.out' }, 0);
      var rings = s.$$('.st-ring'), at0 = 34, each = 5.6;
      rings.forEach(function (r, i) {
        tl.fromTo(r, { clipPath: 'inset(-6px 100% -6px -6px)', opacity: 1 }, { clipPath: 'inset(-6px -6px -6px -6px)', duration: each * 0.7, ease: 'power1.inOut' }, at0 + i * each);
      });
      var span = rings.length * each;
      tl.fromTo(count, { v: 0 }, { v: rings.length, duration: span, ease: 'none', onUpdate: function () { if (nEl) nEl.textContent = String(Math.min(rings.length, Math.floor(count.v + 0.3))); } }, at0);
      var bar = s.$('.st-crawl__bar > i');
      if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: span, ease: 'none' }, at0);
    });
  });

  /* ───────── 7. six sports: the swatch card comes to rest flat and its six chips are set on it in turn ───────── */
  guard('sports', function (el) {
    var card = S.$('.st-swatch', el), chips = S.$$('.st-swatch__chips i', el);
    if (!card) return;
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: card, start: 'top 96%', end: 'center 48%', scrub: 0.6, invalidateOnRefresh: true } });
    tl.fromTo(card, { rotationX: 26, rotationZ: -2.5, y: 40, transformPerspective: 1200, transformOrigin: '50% 100%' }, { rotationX: 0, rotationZ: 0, y: 0, duration: 60, ease: 'power2.out' }, 0);
    chips.forEach(function (c, i) { tl.fromTo(c, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 14, ease: 'power2.out' }, 22 + i * 12); });
  });

  /* ───────── 8. climate: three photographs come to rest one after another; the words take turns on them ───────── */
  guard('climate', function (el) {
    var pics = S.$$('.film__stage > .photo', el);
    opening(el, pics[0]);
    S.film(el, function (tl, s) {
      var img = function (f) { return S.$('img', f); };
      S.inkFill(s.$('.st-climate__h'), { tl: tl, at: 3, duration: 22 });
      if (pics[0]) tl.fromTo(img(pics[0]), { scale: 1.16, yPercent: 2 }, { scale: 1.03, yPercent: -2, duration: 40, ease: 'power1.out' }, 0);
      [[pics[1], 31], [pics[2], 64]].forEach(function (pair) {
        var f = pair[0], at = pair[1]; if (!f) return;
        tl.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 12, ease: 'power2.inOut' }, at);
        tl.fromTo(img(f), { scale: 1.22, yPercent: 4 }, { scale: 1.03, yPercent: -2, duration: 40, ease: 'power1.out' }, at);
      });
    });
  });
});
