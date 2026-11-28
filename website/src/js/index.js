/* The one page. site.js plays every arrival (once, on its own clock); this file only underlines the header's anchor
   for the part on screen: a class, never a movement tied to the scroll. */
Site.ready(function (S) {
  'use strict';
  var links = S.$$('.hdr__nav a[href^="#"]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var parts = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var seen = new Map();
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) { seen.set(e.target, e.isIntersecting); });
    var on = -1; parts.forEach(function (p, i) { if (p && seen.get(p)) on = i; });
    links.forEach(function (a, i) { if (i === on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }, { rootMargin: '-45% 0px -54% 0px' });
  parts.forEach(function (p) { if (p) io.observe(p); });
});
