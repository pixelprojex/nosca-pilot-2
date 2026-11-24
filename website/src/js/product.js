/* Product: a film in eight chapters. The films themselves are markup (data-film, data-step, data-device: API.md);
   this file gives each chapter its own camera, so that something on the stage moves with every turn of the thumb:
   - every caption's words rise out of their line's mask and the lede follows; leaving, the caption is wiped upward;
   - the screen a caption is about is pushed in on, slowly, for as long as the caption stands (data-cam on a step);
   - each chapter has its own shot: the log's close start, the feed's lesson page, the drawing pulled back from,
     the drill's key ringed in gold, the diary lifted off the page, the conversations seen close and drawn back
     from, the family's three phones parting and coming forward in turn, and Progress's line drawn large in gold
     with the screen scrolled under its own tab bar;
   - the opening's phone rises whole into view on a phone, and the rest ground closes over it carrying the chapters;
   - the hand-over between chapters (the phone turns out of one and into the next), the reel of ticks on a desk. */
Site.ready(function (S) {
  if (!S.motion) return;
  var gsap = S.gsap, ScrollTrigger = S.ScrollTrigger, W = window, D = document;
  var pose = function (v) { var a = String(v || '').split(',').map(Number); return { rotationY: a[0] || 0, rotationX: a[1] || 0, rotationZ: a[2] || 0 }; };
  /* the single-column layout: a phone, or a tablet held upright */
  var single = function () { return W.innerWidth < 720 || (W.innerWidth < 900 && W.innerHeight > W.innerWidth); };
  var hdr = function () { return parseFloat(getComputedStyle(D.documentElement).getPropertyValue('--hdr-h')) || 56; };
  var offs = function (node, root) { var y = 0, e = node; while (e && e !== root) { y += e.offsetTop; e = e.offsetParent; } return y; };

  /* ── captions: the words rise out of their masks, the lede a beat behind; leaving, the caption is wiped upward ── */
  function captions(tl, s) {
    var steps = s.$$('[data-step]');
    steps.forEach(function (st, i) {
      var r = s.steps[i]; if (!r) return;
      var h = S.$('h3', st), p = S.$('.t-lede, .t-body', st);
      if (r[0] <= 0.01) {
        /* the first caption rises as the chapter's stage comes up, before the pin */
        var ent = { trigger: s.el, start: 'top 78%', end: 'top 8%' };
        if (h) S.rise(h, Object.assign({ by: 'words' }, ent));
        if (p) S.rise(p, Object.assign({ by: 'lines' }, ent, { start: 'top 66%', end: 'top 0%' }));
      } else {
        /* it stands the moment the caption before has gone, so the words are never away while a screen changes */
        tl.fromTo(st, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, r[0] - 1.8);
        if (h) S.rise(h, { by: 'words', tl: tl, at: r[0] - 1.8, duration: 9 });
        if (p) S.rise(p, { by: 'lines', tl: tl, at: r[0] + 1.2, duration: 9 });
      }
      if (r[1] < 100) tl.fromTo(st, { clipPath: 'inset(-40% -12% -40% -12%)', y: 0 },
        { clipPath: 'inset(-40% -12% 140% -12%)', y: function () { return -s.vh() * 0.035; }, duration: 2.8, ease: 'power1.in', immediateRender: false }, r[1] - 4.6);
    });
  }
  /* ── the camera: while a caption stands, the screen it is about is pushed in on (data-cam="x y scale") ── */
  function cams(tl, s, screenOf, swapLen, also) {
    var steps = s.$$('[data-step]');
    steps.forEach(function (st, i) {
      var c = (st.dataset.cam || '').trim().split(/\s+/); if (c.length < 3) return;
      var scr = screenOf(i, st); if (!scr) return;
      var r = s.steps[i], half = (swapLen || 0) / 2;
      var a = i === 0 ? 0 : Math.max(0, r[0] - half), b = r[1] >= 100 ? 100 : r[1] + half;
      var from = { scale: 1, transformOrigin: c[0] + ' ' + c[1] }, to = { scale: +c[2], duration: b - a, ease: 'none', immediateRender: i === 0 };
      tl.fromTo(scr, from, to, a);
      if (also) also(i, a, b, from, to, tl);
    });
  }
  var screensOf = function (s) { var ph = s.$('[data-device]') || s.$('.phone'); var p = ph ? S.phone(ph) : null; return p ? p.screens : []; };

  /* ── the first screen ── */
  S.film('#top', function (tl, s) {
    captions(tl, s);
    var dev = s.$('.pd-top__dev'), copy = s.$('.pd-top__copy'), roles = s.$('.pd-roles');
    var fade = s.$$('.pd-top__copy > .eyebrow, .pd-top__h, .pd-top__lede');
    /* a desk: the phone rises into its column. A phone: the headline lifts away under the header and the phone with it,
       so the phone comes to rest whole under the three names by a third of the way in */
    tl.fromTo(dev, { y: function () { return single() || W.innerWidth < 900 ? 0 : s.vh() * 0.2; } }, { y: 0, duration: 46, ease: 'power2.out' }, 0);
    var lift = function () { return W.innerWidth < 900 ? -Math.max(0, offs(roles, s.stage) - hdr() - 14) : 0; };
    tl.fromTo([copy, dev.firstElementChild], { y: 0 }, { y: lift, duration: 30, ease: 'power1.inOut' }, 0);
    tl.fromTo(fade, { autoAlpha: 1 }, { autoAlpha: function () { return W.innerWidth < 900 ? 0 : 1; }, duration: 22, ease: 'none' }, 0);
    /* the rest ground closes over the opening; what was on it fades as the edge passes, so nothing is left cut */
    tl.to([copy, dev], { autoAlpha: 0, duration: 16, ease: 'power1.in' }, 64);
    S.groundShift(s.$('.pd-top__next'), { tl: tl, at: 62, duration: 28, shape: 'wedge' });
    /* the chapter card: the eyebrow, then the eight, each line drawn in gold from its left end with its words */
    var t = s.$('.pd-toc__t'), items = s.$$('.pd-toc li');
    if (t) tl.fromTo(t, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% 0% -20% 0%)', duration: 6, ease: 'power1.out' }, 80);
    items.forEach(function (li, i) {
      var at = 82 + i * 1.6;
      tl.fromTo(li, { '--drawn': 0 }, { '--drawn': 1, duration: 7, ease: 'power1.inOut' }, at);
      tl.fromTo(li.children, { clipPath: 'inset(-30% 100% -30% 0%)' }, { clipPath: 'inset(-30% 0% -30% 0%)', duration: 6, ease: 'power1.out' }, at + 1);
    });
  });

  /* ── what each chapter adds to its markup film ── */
  var extra = {
    log: function (tl, s) {
      /* the plus sheet rises in a breath (four frames in a short stretch), then the flow runs with the captions */
      var q = s.$('[data-sequence]'); if (!q) return;
      var api = S.sequence(q, { scroll: false }); if (!api) return;
      var f = api.at, a0 = s.at(0);
      api.keys(tl, [[0, f(0)], [a0 + 0.6, f(0)], [a0 + 3.4, f(4)], [s.at(1), f(11)], [s.at(2), f(19)], [s.at(3), f(36)], [100, 1]]);
    },
    feed: function (tl, s) {
      S.device(s.$('.phone')).swap(tl, [s.at(2) - 3], { mode: 'slide', duration: 6 });
      cams(tl, s, function (i, st) { return screensOf(s)[+st.dataset.camScreen || i]; }, 6);
    },
    markup: function (tl, s) {
      /* the picture opens close on the drawing and draws back to the tools for the whole of its caption */
      var sc = screensOf(s);
      tl.fromTo(sc[0], { scale: 1.6, transformOrigin: '54% 46%' }, { scale: 1, duration: s.at(1) + 4, ease: 'power1.inOut' }, 0);
      cams(tl, s, function (i) { return sc[i]; }, 8);
    },
    drills: function (tl, s) {
      var sc = screensOf(s), rings = s.$('.pd-rings');
      cams(tl, s, function (i) { return sc[i]; }, 8, function (i, a, b, from, to) {
        /* the ring stands on the screen, so it travels with the camera that moves in on its key */
        if (i === 1 && rings) tl.fromTo(rings, Object.assign({}, from), Object.assign({}, to, { immediateRender: false }), a);
      });
      s.$$('.pd-ring').forEach(function (r) {
        var i = +r.dataset.ring || 0;
        tl.fromTo(r, { clipPath: 'inset(-8px 110% -8px -8px)' }, { clipPath: 'inset(-8px -8px -8px -8px)', duration: 18, ease: 'power1.inOut' }, s.at(i) + 3);
      });
    },
    diary: function (tl, s) { var sc = screensOf(s); cams(tl, s, function (i) { return sc[i]; }, 8); },
    messages: function (tl, s) {
      /* close on the conversations, as a phone is read, then drawn back until the whole phone stands in the frame */
      var ph = s.$('.phone');
      tl.fromTo(ph, { scale: function () { return single() ? 1.42 : 1.55; }, transformOrigin: '50% 3%' }, { scale: 1, duration: 100, ease: 'power1.inOut' }, 0);
    },
    family: function (tl, s) {
      var fan = s.$('.pd-fan'), ps = s.$$('.pd-fan__p'); if (!fan || ps.length < 3) return;
      var side = function () { return single() ? 34 : 46; };
      var slot = function (k, j) {
        var d = (j - k + 3) % 3;
        if (d === 0) return { xPercent: 0, yPercent: 0, scale: 1, rotationZ: 0 };
        var sg = d === 1 ? 1 : -1;
        return { xPercent: function () { return sg * side(); }, yPercent: 5, scale: 0.8, rotationZ: sg * 5 };
      };
      tl.fromTo(fan, { rotationY: -9, transformPerspective: 1800 }, { rotationY: 7, duration: 100, ease: 'none' }, 0);
      /* they arrive as one phone and part */
      ps.forEach(function (p, j) {
        tl.fromTo(p, { xPercent: 0, yPercent: 0, scale: j ? 0.96 : 1, rotationZ: 0, zIndex: 3 - j }, Object.assign({ duration: 16, ease: 'power2.out' }, slot(0, j)), 0);
      });
      /* and each comes forward in turn */
      for (var k = 1; k < 3; k++) {
        var c = s.at(k);
        ps.forEach(function (p, j) {
          tl.fromTo(p, slot(k - 1, j), Object.assign({ duration: 10, ease: 'power2.inOut', immediateRender: false }, slot(k, j)), c - 5);
          tl.set(p, { zIndex: j === k ? 3 : (j - k + 3) % 3 === 1 ? 2 : 1 }, c);
        });
      }
      cams(tl, s, function (i) { return ps[i] && S.$('.screen', ps[i]); }, 10);
    },
    progress: function (tl, s) {
      var ph = s.$('.phone'), p = S.device(ph), sc = p.screens, box = S.$('.phone__screen', ph);
      var line = s.$('.pd-level');
      if (line) { S.drawStripes(line, { tl: tl, at: 2, duration: 56 }); tl.fromTo(line, { y: function () { return s.vh() * 0.04; } }, { y: function () { return -s.vh() * 0.04; }, duration: 100, ease: 'none' }, 0); }
      p.turn(tl, { from: [6, 3, -1], to: [-5, -1, 0.5], at: 0, duration: 100, ease: 'none' });
      if (sc.length < 2 || !box) return;
      /* one screen scrolled: its tab bar and, once scrolled, its compact header stay where they are */
      var mk = function (src, cls, clip) { var im = D.createElement('img'); im.src = src; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.className = 'pd-fix ' + cls; im.style.clipPath = clip; im.decoding = 'async'; box.appendChild(im); return im; };
      var bar = S.$('.pd-fix--bar', box) || mk(sc[0].getAttribute('src'), 'pd-fix--bar', 'inset(89% 0 0 0)');
      var head = S.$('.pd-fix--head', box) || mk(sc[1].getAttribute('src'), 'pd-fix--head', 'inset(0 0 87.6% 0)');
      gsap.set(sc, { autoAlpha: 1 });
      gsap.set(sc[0], { clipPath: 'inset(0% 0% 11% 0%)' });
      gsap.set(sc[1], { clipPath: 'inset(12.4% 0% 11% 0%)' });
      var c = s.at(1), run = 76.6;
      tl.fromTo(sc[1], { yPercent: run }, { yPercent: 0, duration: 18, ease: 'power1.inOut' }, c - 9);
      tl.fromTo(sc[0], { yPercent: 0 }, { yPercent: -run, duration: 18, ease: 'power1.inOut', immediateRender: false }, c - 9);
      tl.fromTo(head, { autoAlpha: 0 }, { autoAlpha: 1, duration: 3, ease: 'none' }, c - 7);
      /* then the camera moves in on the attendance */
      tl.fromTo(sc[1], { scale: 1, transformOrigin: '50% 52%' }, { scale: 1.12, duration: 100 - (c + 9), ease: 'none', immediateRender: false }, c + 9);
      tl.fromTo(sc[0], { scale: 1, transformOrigin: '50% 30%' }, { scale: 1.08, duration: c - 9, ease: 'none' }, 0);
    }
  };
  /* the log's phone: on a small screen its close start is gentle, so the picture is never drawn up past its size */
  var logPhone = S.$('#log [data-zoom]'); if (logPhone && W.innerWidth < 720) logPhone.dataset.zoom = '1.2';

  S.$$('.pd-ch').forEach(function (el) {
    S.film(el, function (tl, s) {
      captions(tl, s);
      if (extra[el.id]) extra[el.id](tl, s);
    });
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

  /* ── the one behaviour: the words rise on the picture, hold and leave before the film lets go, so the white that
     comes up through the diagonal after it (data-ground-shift on #drills) crosses only the photograph ── */
  S.film('#moment', function (tl, s) {
    var q = s.$('.pd-moment__q'), p = s.$('.pd-moment__p'), words = s.$('.pd-moment__words');
    S.rise(q, { by: 'words', tl: tl, at: 0, duration: 30 });
    S.rise(p, { by: 'lines', tl: tl, at: 20, duration: 16 });
    tl.fromTo(words, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: function () { return -s.vh() * 0.06; }, duration: 12, ease: 'power1.in', immediateRender: false }, 70);
  });
  /* the photograph under it opens out of the green as its stage comes up (the film then settles it) */
  S.$$('.pd-moment').forEach(function (el) {
    var pic = S.$('.film__stage > .photo', el); if (!pic) return;
    gsap.fromTo(pic, { clipPath: 'inset(16% 9% 0% 9%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power1.inOut', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top top', scrub: true } });
  });

  /* ── the footer's green arrives through the card's diagonal, as every other ground on this page does ── */
  var foot = S.$('footer.foot');
  if (foot && foot.previousElementSibling) S.groundShift(foot);

  /* ── the reel: which chapter is playing, and the ground the ticks stand on ── */
  var reel = S.$('.pd-reel'), first = S.$('#log'), last = S.$('#progress');
  if (reel && first && last) {
    var items = S.$$('li', reel);
    ScrollTrigger.create({ trigger: first, start: 'top 55%', endTrigger: last, end: 'bottom 45%', toggleClass: { targets: reel, className: 'is-live' } });
    S.$$('.pd-ch').forEach(function (el) {
      var i = (+el.dataset.ch || 1) - 1;
      ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: function (st) { if (st.isActive) items.forEach(function (li, k) { li.classList.toggle('is-on', k === i); }); } });
    });
    S.$$('main > section').forEach(function (sec) {
      var g = sec.classList.contains('g-green') ? 'green' : sec.classList.contains('g-rest') ? 'rest' : 'paper';
      ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: function (st) { if (st.isActive) reel.dataset.ground = g; } });
    });
  }
});
