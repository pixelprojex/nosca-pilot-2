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
     through the other; the pinstripes draw; the long form of the name rises and holds while it is read; the words
     go; then the green opens along the card's diagonal, a gold hairline on its edge, onto the moment underneath ───────── */
  guard('top', function (el) {
    S.film(el, function (tl, s) {
      var wv = s.$('.st-name__weave'), w = S.weave(wv);
      if (w) {
        var far = function () { return w.far(S.small() ? 0.2 : 0.16); };
        tl.fromTo(w.state, { d: far, draw: 1 }, { d: 12, draw: 1, duration: 34, ease: 'power2.inOut', onUpdate: w.render }, 0);
        w.set(far(), 1);
        wv.classList.add('is-set');
      }
      S.drawStripes(s.$('.st-name__pins'), { tl: tl, at: 2, duration: 40 });
      S.rise(s.$('.st-name__long'), { tl: tl, at: 30, duration: 10 });
      S.rise(s.$('.st-name__link'), { tl: tl, at: 40, duration: 8 });
      /* held from 48 to 78: the name and its meaning stand still for the read; then the whole lockup leaves first */
      tl.to(s.$('.st-name__in'), { y: function () { return -s.vh() * 0.05; }, autoAlpha: 0, duration: 9, ease: 'power1.in' }, 78);
      /* the green's own clip, and a gold hairline on its edge (a band 1.5px deep on the green's side of the line) */
      var ground = s.$('.st-name__ground'), edge = s.$('.st-name__edge');
      if (ground) {
        var wedge = { p: 0 };
        var paint = function () {
          var p = wedge.p, L = (100 - 146 * p).toFixed(3), R = (100 - 100 * p).toFixed(3);
          ground.style.clipPath = p <= 0 ? '' : 'polygon(0% 0%, 100% 0%, 100% ' + R + '%, 0% ' + L + '%)';
          if (edge) {
            edge.style.visibility = p > 0.002 && p < 0.998 ? 'visible' : 'hidden';
            edge.style.clipPath = 'polygon(0% calc(' + L + '% - 1.5px), 100% calc(' + R + '% - 1.5px), 100% ' + R + '%, 0% ' + L + '%)';
          }
        };
        tl.fromTo(wedge, { p: 0 }, { p: 1, duration: 14, ease: 'power1.inOut', onUpdate: paint, onComplete: paint, onReverseComplete: paint }, 86);
        paint();
      }
    });
  });

  /* ───────── 2. one moment: the sentence fills with ink a phrase at a time, and the phone does what each phrase says ───────── */
  guard('moment', function (el) {
    var h = S.$('.st-moment__h', el), phone = S.$('.st-moment__phone', el), q = phone && S.$('[data-sequence]', phone);
    if (!h || !phone) return;
    /* the ink: the sentence stays as it is (grey), and a full-ink copy lies on it, a span a word */
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
    /* the register's frames, straight past the near-empty sheet (f007 to f009: one faded row) */
    var register = function (tl, seq, a, b) {
      var k = function (x) { return a + (b - a) * x; };
      seq.keys(tl, [[0, 0], [k(0), 0], [k(0.15), seq.at(6)], [k(0.16), seq.at(10)], [k(0.36), seq.at(16)], [k(0.9), seq.at(33)], [k(1), seq.at(35)], [100, seq.at(35)]]);
    };

    S.film(el, function (tl, s) {
      var lit = function (words, at, len) {
        var n = words.length, step = n > 1 ? len / n : len;
        words.forEach(function (wd, i) { tl.fromTo(wd, { opacity: 0 }, { opacity: 1, duration: step * 1.4, ease: 'none' }, at + i * step); });
      };
      var seq = q ? S.sequence(q, { scroll: false }) : null;
      var copy = s.$('.st-moment__copy'), judge = s.$('.st-moment__judge');
      if (S.small()) {
        /* a phone: the words first, whole; they make way; the phone takes the screen; it is put down; the words return */
        if (phrases[0]) lit(phrases[0], 2, 12);
        if (phrases[1]) lit(phrases[1], 13, 10);
        if (phrases[2]) lit(phrases[2], 22, 8);
        S.rise(judge, { tl: tl, at: 29, duration: 7 });
        tl.to(copy, { y: function () { return -s.vh() * 0.06; }, autoAlpha: 0, duration: 7, ease: 'power1.in' }, 42);
        tl.fromTo(phone, { y: function () { return s.vh(); }, rotationX: 56, rotationZ: -5, scale: 0.9, transformPerspective: 1400 },
          { y: 0, rotationX: 0, rotationZ: 0, scale: 1, duration: 14, ease: 'power2.out' }, 44);
        if (seq) register(tl, seq, 58, 84);
        tl.to(phone, { y: function () { return s.vh() * 0.08; }, rotationX: 44, rotationZ: 4, scale: 0.86, autoAlpha: 0, duration: 10, ease: 'power2.in' }, 84);
        tl.fromTo(copy, { autoAlpha: 0, y: function () { return s.vh() * 0.03; } }, { autoAlpha: 1, y: 0, duration: 7, ease: 'power1.out', immediateRender: false }, 92);
        return;
      }
      /* picked up: it rises off the table, from lying back to facing the reader */
      tl.fromTo(phone, { y: function () { return s.vh() * 0.42; }, rotationX: 56, rotationZ: -5, scale: 0.9, transformPerspective: 1400 },
        { y: 0, rotationX: 0, rotationZ: 0, scale: 1, duration: 26, ease: 'power2.out' }, 0);
      if (phrases[0]) lit(phrases[0], 2, 22);
      /* one thing in seconds: the register, frame for frame */
      if (seq) register(tl, seq, 30, 69);
      if (phrases[1]) lit(phrases[1], 31, 30);
      /* put down: it lies back on the table, and the whole of it stays inside the stage (half off the stage's foot, it
         was cut flat by the stage's edge for a screen once the pin let go) */
      tl.to(phone, { y: function () { return s.vh() * 0.06; }, rotationX: 44, rotationZ: 4, scale: 0.86, duration: 18, ease: 'power2.in' }, 72);
      if (phrases[2]) lit(phrases[2], 72, 14);
      S.rise(judge, { tl: tl, at: 84, duration: 9 });
    });
  });

  /* ───────── 3. what we stand for: the markup film plays the three words; the picture opens out of the page; the words
     go before the film lets go, so the white that rises next crosses the picture alone ───────── */
  guard('stand', function (el) {
    opening(el, S.$('.film__stage > .photo', el));
    S.film(el, function (tl, s) { tl.to(s.$('.st-stand__in'), { autoAlpha: 0, duration: 7, ease: 'power1.in' }, 93); });
  });
  /* ───────── 5. how it was built: the gold line runs date to date; the 45 cycle days light as it passes them ───────── */
  guard('built', function (el) {
    S.film(el, function (tl, s) {
      var fill = s.$('.st-axis__fill'), pts = s.$$('.st-axis__pt'), tks = s.$$('.st-axis .tk');
      /* [timeline position, how far along the axis] — the steps' own ranges are in the markup */
      var K = [[0, 0], [13, 0], [17, 21.25], [29, 21.25], [33, 33.75], [38, 33.75], [56, 90], [69, 90], [73, 100], [100, 100]];
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

  /* ───────── 6. proven before it ships: the crawl finds each control on the plus sheet in turn ───────── */
  guard('proven', function (el) {
    S.film(el, function (tl, s) {
      var small = S.small(), fig = s.$('.st-crawl'), num = s.$('.st-proven__n .t-numeral'), rings = s.$$('.st-ring');
      S.inkFill(s.$('.st-proven__h'), { tl: tl, at: 2, duration: small ? 14 : 20 });
      if (num) tl.fromTo(num, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% -12% -20% -12%)', duration: 10, ease: 'power1.inOut' }, small ? 12 : 16);
      S.rise(s.$('.st-proven__l'), { tl: tl, at: small ? 16 : 20, duration: 10 });
      S.rise(s.$('.st-proven__crawl'), { tl: tl, at: small ? 22 : 28, duration: 8 });
      var at0 = 34, each = 5.6;
      if (small) {
        /* a phone: the words have been read; they make way and the sheet takes the screen */
        tl.to(s.$('.st-proven__copy'), { y: function () { return -s.vh() * 0.06; }, autoAlpha: 0, duration: 7, ease: 'power1.in' }, 40);
        tl.fromTo(fig, { y: function () { return s.vh(); }, scale: 0.94 }, { y: 0, scale: 1, duration: 12, ease: 'power2.out' }, 42);
        at0 = 55; each = 4.2;
      } else {
        /* the figure rises whole, so nothing of it lies over anything else */
        tl.fromTo(fig, { y: function () { return s.vh() * 0.08; }, scale: 0.96 }, { y: 0, scale: 1, duration: 28, ease: 'power2.out' }, 0);
      }
      rings.forEach(function (r, i) {
        tl.fromTo(r, { clipPath: 'inset(-6px 100% -6px -6px)', opacity: 1 }, { clipPath: 'inset(-6px -6px -6px -6px)', duration: each * 0.7, ease: 'power1.inOut' }, at0 + i * each);
      });
    });
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
      /* the first fact comes after the headline has inked, never before it */
      var first = s.$('.st-climate__steps [data-step]');
      if (first) tl.fromTo(first, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 4, ease: 'power2.out' }, 24);
      /* the words go before the film lets go, so the rest ground that rises next crosses the picture alone */
      tl.to(s.$('.st-climate__in'), { autoAlpha: 0, duration: 7, ease: 'power1.in' }, 93);
    });
  });
});
