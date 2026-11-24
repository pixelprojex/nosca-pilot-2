/* Product: the page's motion and its one interactive demo, on top of the foundation's reveals.
   The page is finished in HTML and CSS. Every scene here starts from that picture and comes back to it,
   so without motion (no html.motion) or without script nothing is hidden. Transform and opacity only. */
(function () {
  'use strict';
  const W = window, D = document, H = D.documentElement;
  const $ = (s, r) => (r || D).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || D).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const guard = (fn) => { try { return fn(); } catch (e) { if (W.console) console.error(e); return null; } };
  const text = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };

  H.classList.add('js');
  const demo = guard(logDemo);
  guard(chapterBar);
  guard(landing);
  if (W.Site && W.Site.ready) W.Site.ready((S) => guard(() => motion(S)));
  else H.classList.add('pd-off');

  /* ───────── the log demo: Who, tap what you worked on, Log it. Plain DOM, so it works without motion ───────── */
  function logDemo() {
    const box = $('#log-demo'); if (!box) return null;
    const people = $$('.pd-ft', box), areas = $$('.pd-area', box);
    const logit = $('.pd-logit', box), next = $('.pd-lognext', box), back = $('.pd-view__back', box);
    const nameEl = $('[data-demo="name"]', box), levelEl = $('[data-demo="level"]', box), sumEl = $('[data-demo="summary"]', box);
    if (!people.length || !logit) return null;
    let person = people[0], last = -1;
    const api = { manual: false };
    const picked = () => areas.filter((a) => a.classList.contains('is-on'));
    const setArea = (a, on) => { if (!a) return; a.classList.toggle('is-on', on); a.setAttribute('aria-pressed', String(on)); };
    const go = (step) => { if (box.getAttribute('data-step') !== step) box.setAttribute('data-step', step); };
    const focusSoon = (el) => { if (el) setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { /* nothing to focus */ } }, 90); };
    const tap = (el) => { if (!el) return; el.classList.add('is-down'); setTimeout(() => el.classList.remove('is-down'), 190); };
    const lift = () => { people[0].classList.remove('is-down'); logit.classList.remove('is-down'); };
    /* where the page taps for the visitor: one soft ring on the phone's glass */
    const glass = $('.pd-demo__screen', box), dot = D.createElement('i');
    dot.className = 'pd-tap'; dot.setAttribute('aria-hidden', 'true'); if (glass) glass.appendChild(dot);
    const ping = (el) => {
      if (!el || !glass) return;
      dot.style.setProperty('--tx', (el.offsetLeft + el.offsetWidth / 2) + 'px'); dot.style.setProperty('--ty', (el.offsetTop + el.offsetHeight / 2) + 'px');
      dot.classList.remove('is-go'); void dot.offsetWidth; dot.classList.add('is-go');
    };
    function sync() {
      const got = picked(), name = person.getAttribute('data-name') || '', level = person.getAttribute('data-level');
      logit.classList.toggle('is-off', !got.length);
      logit.setAttribute('aria-disabled', String(!got.length));
      text(nameEl, name);
      text(levelEl, level ? ' · ' + level : '');
      text(sumEl, [name].concat(got.map((a) => a.textContent.trim())).join(' · '));
    }

    box.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button'); if (!b || !box.contains(b)) return;
      const keyed = e.detail === 0;
      api.manual = true; lift();
      if (b.classList.contains('pd-ft')) { person = b; areas.forEach((a) => setArea(a, false)); sync(); go('log'); if (keyed) focusSoon(areas[0]); }
      else if (b.classList.contains('pd-area')) { setArea(b, !b.classList.contains('is-on')); sync(); }
      else if (b === logit) { if (picked().length) { sync(); go('done'); if (keyed) focusSoon(next); } }
      else if (b === next || b === back) { go('who'); if (keyed) focusSoon(person); }
    });

    /* the page plays the demo itself as it is scrolled, stage 0 to 6, until the visitor taps:
       0 Who · 1 Cian pressed · 2 the page, nothing chosen · 3 Chipping · 4 and Putting · 5 Log it pressed · 6 Logged */
    api.script = (k) => {
      if (api.manual || k === last) return;
      const forward = k > last;
      people[0].classList.toggle('is-down', k === 1);
      logit.classList.toggle('is-down', k === 5);
      if (forward && k === 1) ping(people[0]);
      if (forward && k === 5) ping(logit);
      if (k >= 2) {
        person = people[0];
        areas.forEach((a, i) => setArea(a, (i === 2 && k >= 3) || (i === 3 && k >= 4)));
        if (forward && k === 3) { tap(areas[2]); ping(areas[2]); }
        if (forward && k === 4) { tap(areas[3]); ping(areas[3]); }
      }
      sync();
      go(k < 2 ? 'who' : k < 6 ? 'log' : 'done');
      last = k;
    };
    api.release = () => { api.manual = false; last = -1; lift(); };
    sync();
    return api;
  }

  /* ───────── a landing on a chapter (product.html#family): once the type has set, the chapter goes back under the bar ───────── */
  function landing() {
    const id = (W.location.hash || '').slice(1), el = id && D.getElementById(id); if (!el) return;
    let moved = false;
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => W.addEventListener(ev, () => { moved = true; }, { passive: true, once: true }));
    const again = () => { if (!moved && Math.abs(el.getBoundingClientRect().top) < W.innerHeight * 2) el.scrollIntoView(); };
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => setTimeout(again, 80));
    W.addEventListener('load', () => setTimeout(again, 80));
  }

  /* ───────── the chapter bar: which chapter is under it, and how far through the tour ───────── */
  function chapterBar() {
    const bar = $('.pd-bar'); if (!bar) return;
    const inner = $('.pd-bar__in', bar), ind = $('.pd-bar__ind', bar), prog = $('.pd-bar__prog', bar);
    const links = $$('a', inner), secs = links.map((a) => D.getElementById((a.getAttribute('href') || '').slice(1)));
    const end = $('#open');
    let cur = -2, queued = false, stick = 0;
    function place() {
      const a = links[cur];
      if (!ind) return;
      if (!a) { ind.style.setProperty('--s', '0'); return; }
      const pad = parseFloat(getComputedStyle(a).paddingLeft) || 0;
      ind.style.setProperty('--x', (a.offsetLeft + pad) + 'px');
      ind.style.setProperty('--s', (Math.max(0, a.offsetWidth - pad * 2) / 100).toFixed(3));
      if (inner.scrollWidth > inner.clientWidth + 2) {
        const left = a.offsetLeft - (inner.clientWidth - a.offsetWidth) / 2;
        if (inner.scrollTo) inner.scrollTo({ left: left, behavior: 'smooth' }); else inner.scrollLeft = left;
      }
    }
    function read() {
      queued = false;
      const line = stick + Math.min(170, W.innerHeight * 0.24);
      let i = -1;
      secs.forEach((s, k) => { if (s && s.getBoundingClientRect().top <= line) i = k; });
      if (i !== cur) {
        cur = i;
        links.forEach((a, k) => { a.classList.toggle('is-on', k === i); if (k === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
        place();
      }
      if (prog && secs[0] && end) {
        const a = secs[0].getBoundingClientRect().top, b = end.getBoundingClientRect().top;
        prog.style.setProperty('--p', clamp((line - a) / Math.max(1, b - a), 0, 1).toFixed(4));
      }
    }
    const ask = () => { if (!queued) { queued = true; requestAnimationFrame(read); } };
    /* on a desk the smooth wheel takes an anchor to the very top, under the header and this bar: send it to just under the bar.
       A phone keeps the browser's own jump, which reads the chapter's scroll margin */
    links.forEach((a, k) => a.addEventListener('click', (e) => {
      const lenis = W.Site && W.Site.lenis, el = secs[k];
      if (!lenis || !el || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault(); e.stopPropagation();
      lenis.scrollTo(el, { offset: -(stick - 2) });
      if (W.history && W.history.pushState) W.history.pushState(null, '', a.getAttribute('href'));
      if (e.detail === 0) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    }));
    const size = () => { stick = (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight; cur = -2; ask(); };
    W.addEventListener('scroll', ask, { passive: true });
    W.addEventListener('resize', size, { passive: true });
    W.addEventListener('load', size);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(size);
    size();
  }

  /* ───────── without motion: the films are still, so each phone turns quietly through its screens while it is seen ───────── */
  function rest(S) {
    if (!S.gsap || !S.phone || !S.inView) return;
    $$('.pd-film .phone').forEach((el) => {
      const p = S.phone(el); if (!p || !p.screens || p.screens.length < 2) return;
      let call = null;
      const tick = () => { p.next(); call = S.gsap.delayedCall(4, tick); };
      S.inView(el, { threshold: 0.4, margin: '0px', enter: () => { if (!call) call = S.gsap.delayedCall(4, tick); }, leave: () => { if (call) { call.kill(); call = null; } } });
    });
  }

  /* ───────── motion ───────── */
  function motion(S) {
    const gsap = S.gsap, ST = S.ScrollTrigger;
    W.__pdUp = true;
    if (!S.motion || !gsap || !ST) { guard(() => rest(S)); return; }

    const hero = $('.pd-hero'), phones = $$('.pd-hero .pd-hp'), labels = $$('.pd-hero .pd-slot__label'), rings = $('.pd-hero__rings');
    /* the page gave up waiting (pd-off) and showed itself: leave the hero as it stands, take the rest over */
    if (H.classList.contains('pd-off')) { gsap.set(phones.concat(labels, rings ? [rings] : []), { opacity: 1 }); H.classList.remove('pd-off'); }
    else guard(heroIn);
    guard(heroDrift);
    guard(logScene);
    lazy('#coach-film', () => film('#coach-film', 1));
    lazy('#player-film', () => film('#player-film', -1));
    lazy('#sports-film', sports);
    guard(vignettes);

    guard(closeDrift);

    /* the hero: the coach's phone rises and settles, the player's and the parent's ease out from behind it */
    function heroIn() {
      const L = phones[0], C = phones[1], R = phones[2];
      const tl = gsap.timeline({ paused: true });
      const settle = (el, o, at) => { const t = el && S.settle(el, o); if (t) tl.add(t.paused(false), at); };
      if (rings) tl.fromTo(rings, { opacity: 0 }, { opacity: 1, duration: 2.6, ease: 'power1.out' }, 0);
      settle(C, { y: 150, rx: 18, ry: 0, rz: 0, scale: 0.9, duration: 2.1 }, 0);
      settle(L, { y: 110, rx: 12, ry: 12, rz: 0, scale: 0.88, duration: 2.2 }, 0.3);
      settle(R, { y: 110, rx: 12, ry: -12, rz: 0, scale: 0.88, duration: 2.2 }, 0.42);
      if (L) tl.fromTo(L, { xPercent: 30 }, { xPercent: 0, duration: 2.2, ease: 'power3.out' }, 0.3);
      if (R) tl.fromTo(R, { xPercent: -30 }, { xPercent: 0, duration: 2.2, ease: 'power3.out' }, 0.42);
      if (labels.length) tl.fromTo(labels, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.1 }, 1.25);
      /* the three screens are decoded before a phone is shown, so none rises blank */
      const shots = phones.map((p) => $('img', p)).filter(Boolean).map((im) => (im.decode ? im.decode().catch(() => {}) : null));
      Promise.race([Promise.all(shots), new Promise((r) => setTimeout(r, 1500))]).then(() => gsap.delayedCall(0.55, () => tl.play()));
    }
    /* and as the hero leaves, the three drift apart in depth */
    function heroDrift() {
      if (!hero) return;
      const c = $('.pd-slot--c', hero), l = $('.pd-slot--l', hero), r = $('.pd-slot--r', hero), mark = $('.pd-hero__rings .mark', hero);
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 } });
      if (c) tl.to(c, { yPercent: -7 }, 0);
      if (l) tl.to(l, { yPercent: -2, xPercent: -5 }, 0);
      if (r) tl.to(r, { yPercent: -2, xPercent: 5 }, 0);
      if (mark) tl.to(mark, { rotation: 6, yPercent: 5 }, 0);
    }

    /* the rings behind the close turn into place as it arrives */
    function closeDrift() {
      const sec = $('#open'), mark = sec && $('.pd-close__rings .mark', sec); if (!mark) return;
      gsap.fromTo(mark, { rotation: -7, yPercent: 7 }, { rotation: 0, yPercent: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 15%', scrub: 0.8 } });
    }

    /* Log a lesson: pinned where the whole phone fits (the CSS holds the same query), in the page's flow elsewhere.
       The scroll plays the three steps; a tap hands the demo to the visitor until the scene is left. */
    function logScene() {
      const sec = $('#log'), phone = $('.pd-demo__phone'); if (!sec || !phone || !demo) return;
      gsap.matchMedia().add({ pin: '(min-width: 900px) and (min-height: 780px)', flow: '(max-width: 899px), (max-height: 779px)' }, (ctx) => {
        const pin = ctx.conditions.pin, marks = pin ? [0.1, 0.17, 0.34, 0.46, 0.64, 0.72] : [0.12, 0.2, 0.36, 0.5, 0.82, 0.9];
        ST.create({
          trigger: pin ? sec : phone, start: pin ? 'top top' : 'top 55%', end: pin ? 'bottom bottom' : 'bottom 80%',
          onUpdate: (self) => { let k = 0; while (k < marks.length && self.progress >= marks[k]) k++; demo.script(k); },
          onLeave: () => demo.release(), onLeaveBack: () => demo.release()
        });
        if (pin) gsap.fromTo(phone, { rotationY: -8, rotationX: 2 }, { rotationY: 6, rotationX: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.9 } });
        return () => gsap.set(phone, { clearProps: 'transform' });
      });
    }

    /* a scene is built as it comes near, so its screens are fetched then and not at the first paint */
    function lazy(sel, build) {
      const el = $(sel); if (!el) return;
      let done = false;
      const run = () => { if (!done) { done = true; guard(build); } };
      if (!S.inView(el, { once: true, margin: '150% 0px 150% 0px', enter: run, above: run })) run();
    }
    /* the stage rises in with the thumb before it pins */
    function approach(sec) {
      const bits = [$('.pd-film__phone', sec), $('.pd-film__copy', sec)].filter(Boolean);
      if (bits.length) gsap.fromTo(bits, { y: 80, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: 'power2.out', stagger: 0.12, scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top 15%', scrub: 0.8 } });
    }
    const ranges = (n, pad) => { const seg = 100 / n, out = []; for (let i = 0; i < n; i++) out.push([i ? i * seg + pad : 0, i === n - 1 ? 100 : (i + 1) * seg - pad]); return out; };

    /* a film: the phone holds while its screens turn, the captions take turns, the rail fills */
    function film(sel, dir) {
      const sec = $(sel); if (!sec) return;
      approach(sec);
      S.scene(sec, (tl, s) => {
        const beats = s.$$('.pd-beat'), n = beats.length, seg = 100 / n, phone = s.$('.phone'), rail = s.$$('.pd-rail b');
        S.beats(tl, beats, ranges(n, 1), { y: 22, fade: 4 });
        if (phone) {
          S.screens(tl, phone, beats.slice(1).map((_, i) => (i + 1) * seg - 3), { duration: 6 });
          tl.fromTo(phone, { rotationY: -9 * dir, rotationX: 3 }, { rotationY: 7 * dir, rotationX: 0, duration: 100, ease: 'none' }, 0);
        }
        rail.forEach((b, i) => tl.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: seg, ease: 'none' }, i * seg));
      });
    }

    /* six sports: the phone holds still and re-tints, the list lights one sport at a time */
    function sports() {
      const sec = $('#sports-film'); if (!sec) return;
      const keys = $$('.pd-sportkeys li', sec);
      let cur = 0;
      approach(sec);
      S.scene(sec, (tl, s) => {
        const beats = s.$$('.pd-beat'), n = beats.length, seg = 100 / n, phone = s.$('.phone');
        S.beats(tl, beats, ranges(n, 0.8), { y: 20, fade: 3 });
        if (phone) {
          S.screens(tl, phone, beats.slice(1).map((_, i) => (i + 1) * seg - 2.4), { duration: 4.8 });
          tl.fromTo(phone, { rotationY: -7, rotationX: 2 }, { rotationY: 7, rotationX: 0, duration: 100, ease: 'none' }, 0);
        }
        const was = tl.eventCallback('onUpdate');
        tl.eventCallback('onUpdate', () => {
          if (was) was();
          const i = clamp(Math.floor(tl.progress() * n + 0.04), 0, n - 1);
          if (i !== cur) { cur = i; keys.forEach((k, j) => k.classList.toggle('is-on', j === i)); }
        });
      });
    }

    /* the vignettes: each plays once when it is seen and rests on the finished picture; two loop, calmly */
    function vignettes() {
      const vig = (id, build, o) => {
        const cell = D.getElementById(id); if (!cell) return;
        const stage = $('.pd-stage', cell) || cell;
        guard(() => S.vignette(stage, (tl) => {
          const t = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } });
          build(t, (q) => $(q, cell), (q) => $$(q, cell));
          tl.add(t, 0.4);
        }, Object.assign({ loop: false, threshold: 0.4 }, o || {})));
      };
      const rise = (t, els, at, o) => {
        o = o || {};
        const list = (Array.isArray(els) ? els : [els]).filter(Boolean); if (!list.length) return t;
        return t.fromTo(list, { y: o.y == null ? 16 : o.y, x: o.x || 0, autoAlpha: 0 }, { y: 0, x: 0, autoAlpha: 1, duration: o.d || 0.8, stagger: o.s == null ? 0.14 : o.s }, at);
      };
      const bubble = (t, el, at) => { if (el) t.fromTo(el, { y: 16, scale: 0.96, autoAlpha: 0, transformOrigin: el.classList.contains('app-bubble--mine') ? '100% 100%' : '0% 100%' }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.85 }, at); };
      /* a key sinks onto its ledge and comes back */
      const press = (t, el, at) => {
        if (!el) return;
        t.call(() => el.classList.add('is-down'), null, at).to(el, { y: 3, duration: 0.12, ease: 'power2.out' }, at)
          .call(() => el.classList.remove('is-down'), null, at + 0.24).to(el, { y: 0, duration: 0.22, ease: 'power2.out' }, at + 0.24);
      };
      /* something chosen in the finished picture starts unchosen and is tapped */
      const choose = (t, el, at) => { if (!el) return; el.classList.remove('is-on'); press(t, el, at); t.call(() => el.classList.add('is-on'), null, at + 0.06); };

      vig('v-plus', (t, q, qq) => {
        const tiles = qq('.pd-ptile');
        rise(t, q('.pd-plus > .pd-key'), 0, { y: 26, d: 0.9 });
        rise(t, tiles, 0.14, { y: 28, d: 0.9, s: 0.06 });
        press(t, tiles[0], 1.9);
      });

      vig('v-capture', (t, q) => {
        const cam = q('.pd-cam'), time = q('.pd-cam__time b'), dot = q('.pd-cam__time i');
        if (!cam || !time) return;
        const at = (s, rec) => () => { time.textContent = s; if (rec != null) cam.classList.toggle('is-rec', rec); };
        t.call(at('0:00', true), null, 0.01).call(at('0:01'), null, 1).call(at('0:02'), null, 2).call(at('0:03'), null, 3).call(at('0:04'), null, 4).call(at('0:04', false), null, 4.4);
        if (dot) t.fromTo(dot, { opacity: 1 }, { opacity: 0.2, duration: 0.5, ease: 'sine.inOut', repeat: 7, yoyo: true }, 0.2);
        t.to({}, { duration: 0.6 }, 4.4);
      }, { loop: true, soft: false, repeatDelay: 3.4 });

      vig('v-register', (t, q, qq) => {
        const ticks = qq('.app-tick'), n = q('[data-n]');
        ticks.forEach((k) => k.classList.remove('is-on')); text(n, '0');
        ticks.forEach((k, i) => t.call(() => { k.classList.add('is-on'); text(n, String(i + 1)); }, null, 0.45 + i * 0.42));
        t.to({}, { duration: 0.3 }, 0.45 + ticks.length * 0.42);
      });

      vig('v-hours', (t, q, qq) => {
        t.fromTo(qq('.pd-chip'), { scale: 0.86, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7, stagger: 0.07 }, 0);
        rise(t, q('.pd-away'), 0.75);
      });

      vig('v-groups', (t, q, qq) => {
        const faces = qq('.pd-face'), key = q('.pd-key');
        t.fromTo(faces, { x: (i) => (faces.length - 1 - i * 2) * 9, scale: 0.7, autoAlpha: 0 }, { x: 0, scale: 1, autoAlpha: 1, duration: 0.9, stagger: 0.06 }, 0);
        rise(t, [q('.app-title'), q('.app-sub')], 0.5, { y: 10, s: 0.08 });
        rise(t, key, 0.9, { y: 12 });
        press(t, key, 2.1);
      });

      vig('v-calloff', (t, q, qq) => {
        choose(t, q('.pd-chip.is-on'), 0.35);
        press(t, q('.pd-calloff__key'), 1.15);
        rise(t, qq('.pd-notice'), 1.55, { x: -26, y: 0, s: 0.18, d: 0.9 });
      });

      vig('v-drills', (t, q, qq) => {
        const ticks = qq('.app-tick');
        ticks.forEach((k) => k.classList.remove('is-on'));
        ticks.forEach((k, i) => t.call(() => k.classList.add('is-on'), null, 0.4 + i * 0.45));
        t.fromTo(q('.pd-by'), { autoAlpha: 0, x: 8 }, { autoAlpha: 1, x: 0, duration: 0.7 }, 1.3);
        rise(t, q('.pd-tip'), 1.6);
      });

      vig('v-progress', (t, q, qq) => {
        const num = q('.pd-prog__num'), o = { v: 20.1 };
        t.fromTo(q('.pd-line__p'), { strokeDasharray: '1 1.2', strokeDashoffset: 1.06 }, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, 0.15)
          .fromTo(q('.pd-line__dot--a'), { scale: 0 }, { scale: 1, duration: 0.5 }, 0.1)
          .fromTo(q('.pd-line__dot--b'), { scale: 0 }, { scale: 1, duration: 0.5 }, 2.15)
          .fromTo(qq('.pd-discs i'), { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.09 }, 0.5);
        if (num) { num.textContent = '20.1'; t.to(o, { v: 15.8, duration: 2.2, ease: 'power2.inOut', onUpdate: () => { num.textContent = o.v.toFixed(1); } }, 0.15); }
      });

      vig('v-pdrills', (t, q, qq) => {
        const rows = qq('.pd-rows .pd-row'), last = rows[rows.length - 1], tick = last && $('.app-tick', last), name = last && $('.pd-row__t', last);
        if (tick && name) { tick.classList.remove('is-on'); name.classList.remove('is-struck'); t.call(() => { tick.classList.add('is-on'); name.classList.add('is-struck'); }, null, 1.1); }
        rise(t, rows, 0, { y: 12, s: 0.1 });
        rise(t, q('.pd-row--solo'), 1.6);
      });

      vig('v-practice', (t, q) => {
        choose(t, q('.pd-chip.is-on'), 0.4);
        press(t, q('.pd-key'), 1.15);
        rise(t, q('.pd-practised'), 1.55);
      });

      vig('v-clip', (t, q) => {
        const wait = q('.pd-standing');
        bubble(t, q('.pd-clipcard'), 0);
        if (wait) t.fromTo(wait, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.9).to(wait, { autoAlpha: 0, duration: 0.4 }, 2.6);
        bubble(t, q('.pd-reply'), 2.8);
      });

      vig('v-downloads', (t, q) => {
        const disc = q('.pd-disc'), ring = q('.pd-disc__ring');
        if (disc && ring) {
          disc.classList.remove('is-done');
          t.fromTo(ring, { strokeDasharray: '1 1.5', strokeDashoffset: 1.04 }, { strokeDashoffset: 0, duration: 1.8, ease: 'power1.inOut' }, 0.5)
            .call(() => disc.classList.add('is-done'), null, 2.4);
        }
        rise(t, q('.pd-strip'), 2.9, { y: 10 });
      });

      vig('v-for', (t, q) => {
        choose(t, q('.pd-forp.is-on'), 0.4);
        choose(t, q('.pd-chip.is-on'), 1.1);
        rise(t, q('.pd-key'), 1.7, { y: 12 });
      });

      vig('v-going', (t, q, qq) => {
        const key = q('.pd-key'), a = qq('.pd-swap > span:first-child'), b = qq('.pd-swap > span + span');
        if (!key || !a.length || !b.length) return;
        press(t, key, 0.9);
        t.to(a, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 1.05).to(b, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' }, 1.2);
        press(t, key, 4);
        t.to(b, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 4.15).to(a, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' }, 4.3)
          .to({}, { duration: 0.4 }, 4.7);
      }, { loop: true, soft: false, repeatDelay: 3 });

      vig('v-labelled', (t, q, qq) => { qq('.app-bubble').forEach((b, i) => bubble(t, b, 0.1 + i * 0.85)); });

      vig('v-groupmsg', (t, q, qq) => {
        bubble(t, q('.pd-gm__line'), 0.1);
        qq('.pd-gm__t .app-bubble').forEach((b, i) => bubble(t, b, 1.05 + i * 0.2));
      });

      vig('v-evening', (t, q, qq) => { rise(t, qq('.pd-notice'), 0.1, { y: -14, s: 0.22, d: 0.9 }); });
      vig('v-notify', (t, q, qq) => { rise(t, qq('.pd-notice'), 0.1, { y: -14, s: 0.22, d: 0.9 }); });
      vig('v-offline', (t, q, qq) => { rise(t, q('.pd-strip'), 0, { y: -10 }); rise(t, qq('.pd-row'), 0.5, { s: 0.16 }); });

      vig('v-home', (t, q, qq) => {
        t.fromTo(qq('.pd-hs__grid > i'), { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, stagger: 0.04 }, 0)
          .fromTo(q('.pd-hs__app'), { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1 }, 0.55);
      });

      vig('v-cal', (t, q) => { rise(t, q('.pd-calv__ev'), 0.4, { x: -16, y: 0, d: 0.9 }); });
    }
  }
})();
