# Nosca's website: the foundation's API

One page. Read BRIEF.md first; this says how to build on the shared kit. See it all working: `dist/_kit.html`
(source `src/pages/_kit.html`, `src/css/_kit.css`, `src/js/_kit.js` are the worked examples).

## Build and serve

```
node build.mjs                 # src/ -> dist/   (prints warnings for absolute URLs and placeholders)
node build.mjs --watch         # rebuild on change
cd dist && python3 -m http.server <your port> --bind 127.0.0.1
```
The build never deletes; it overwrites what changed. A page whose source does not exist is skipped.

## Files, and who may touch what

```
src/partials/shell.html header.html footer.html defs.html card.html qr.html ticks.html arrow.html   (foundation)
src/css/site.css   src/js/site.js   build.mjs                                                        (foundation)
src/pages/<page>.html   src/css/<page>.css   src/js/<page>.js                                         (the page's engineer)
```
Page engineers edit ONLY their page's three files (and may add images under `assets/` with their page's
name as a prefix). Need something shared? Build it in your page's files, prefix its classes with your page
(`pd-…`, `st-…`), and say so in your report. Never rename or restyle a shared class from page CSS in a way
that changes it elsewhere; scope overrides under your page: `[data-page="product"] .phone{…}`.

## A page

`src/pages/product.html` starts with one comment, then the sections (no `<html>`, `<head>`, header or footer;
the shell adds them, and `css/product.css` / `js/product.js` are linked when those files exist):

```html
<!--
title: Product · Nosca
description: One or two plain sentences.
world: olive            (olive | green: the ground of the footer, the menu and .g-world)
header: paper           (what the header stands on at the top: paper | light | dark | world)
-->
<section class="section g-paper" id="…"> <div class="wrap"> … </div> </section>
```
Build syntax: `<!-- @include NAME key="value" -->`, `{{appUrl}} {{installUrl}} {{contactEmail}} {{year}}`
(`{{key|fallback}}`), and `<!-- @if contactEmail --> … <!-- @else --> … <!-- @endif -->` (also `@if !key`).
Every URL relative: `product.html#coach`, `assets/x.webp`, `./` for Home.

Includes: `mark` (class, foil="1" on white / foil="d" on a dark ground, label, attrs) · `weave` (same) ·
`pins` (class, attrs) · `phone` (screens="coach-today-golf,coach-log-golf" alts="First alt|" mode="fade|slide|rise"
autoplay="3.2" settle="settle" class attrs eager="1") · `card` (world="olive|green" class attrs) · `qr` · `ticks`
(the 45 cycle days) · `arrow` (the small arrow for keys and links). `attrs="…"` is copied onto the root element.

## Motion: the one rule

Write the FINISHED page in HTML and CSS. Entrance states belong under `html.motion` (set only when site.js
runs and the visitor allows motion; absent with reduced motion, short landscape viewports, no JS or a failed
script). `Site.motion` is the same switch in JS. Animate transform and opacity only.

## Tokens (CSS custom properties)

`--olive --olive-deep --green --green-deep` · `--world --world-deep` (the page's world) · `--gold --gold-hi
--gold-lo --pin` · `--on-dark --on-dark-2` · `--paper --ink --sub --faint --trace --hair --edge --ledge --wash
--table` · `--app --app-deep --app-tint` (the app's ONE green) · `--danger` (Call off only) · `--golf … --equestrian`
(only for `.sport-dot` and inside screenshots) · `--display --text` · `--ease` · `--gut --hdr-h --r-sheet`.
Inside a ground: `--bg --fg --fg-2 --fg-3 --line`.

Colour discipline: white, the greys, the world's ground, gold. There is no coloured ground and no sport-coloured
key, heading or tile. The app's vocabulary is green only.

## Layout and type

| class | what |
|---|---|
| `.wrap` `.wrap--narrow` `.wrap--wide` | centred column with gutters (1160 / 760 / 1440) |
| `.section` `.section--tight` | vertical rhythm |
| `.g-paper` `.g-wash` `.g-table` `.g-world` | grounds; words follow (`.c-2`, `.c-3` for the greys). `data-world="green"` on any element switches the world beneath it |
| `.sheet` (`.sheet--lift`) | round shoulders, lies over the section before it |
| `.hold` | the section stays at its end while the next slides over it and it recedes a little (`data-hold="still"` to hold without receding, `data-hold="0.94"` for the scale) |
| `.grid .grid--2/3/4` `.stack` (`--stack`) `.center` `.measure` `.keys` | utilities |
| `.t-mega .t-display .t-h1 .t-h2 .t-h3 .t-lede .t-body .t-small .t-caption .eyebrow .wordmark` | the type scale (display face; body in the system face). Nothing under 12px |
| `.t-gold` | foil gradient text: large display type only. Do not put `data-reveal="lines|words"` on it (use `rise`); add `data-sheen` for a light across it |
| `.sports` (spans) · `.sport-dot[data-sport]` · `.rule-gold` | the six sports line, the one permitted dot of a sport's colour, a gold rule |
| `data-header="dark|light|paper|world"` on a section | what the fixed header stands on while that section is under it (`dark`/`light` are see-through, for pinned scenes and heroes) |

## Objects

- **Keys** `<a class="key">` (world colour) · `.key--paper` (white, on any ground) · `.key--ghost` (on the world's ground)
  · `.key--sm` `.key--lg`. They sink on press. `data-magnet` adds the pull on a desk.
- **Link** `<a class="link">Words <!-- @include arrow --></a>` (`.link--gold` on the world's ground).
- **Mark** `<!-- @include mark class="…" -->` sized by `--mark-w`, coloured by `color`. `data-draw` draws it in.
  Large and faint behind a section: `<div class="ringsbg"><!-- @include mark --></div>` (`--rings-w`, `--rings-o`).
- **Pinstripes** `<!-- @include pins class="pins--band" attrs="data-pins" -->` inside a `position:relative` ground;
  `data-pins` draws them line by line. Size with `--pins-w`, weight with `--pin-sw` (viewBox units).
- **Phone** `<!-- @include phone screens="a,b,c" alts="…||" -->`; width `--phone-w`. `.phone--light` for a silver
  frame. Put phones in a `.depth` parent for perspective.
- **Shot** `<figure class="shot"><img …></figure>` (width `--shot-w`); a `.fan` of them with `data-fan` fans out.
- **Card** `<!-- @include card world="olive" class="bcard--shadow" attrs="data-tilt data-sheen" -->`; width `--card-w`;
  `.is-back` shows the back; turn it with `gsap.to(card.querySelector('.bcard__flip'), {rotationY: 180})`.
- **Tile** `.tile` (`--pad`, `--wash`, `--lift`) · **Partner frame** `<div class="pframe" data-sheen><!-- @include mark --><i class="sheen"></i></div>` in `.pframes` · **Stat** `.stats > .stat > .stat__n[data-count] + .stat__l`.
- **The app's vocabulary** (wrap in `.app`): `.app-card .app-list .app-row .app-row__t .app-name .app-sub .app-time
  .app-eyebrow .app-title .app-face .app-key (--quiet --danger --wide, .is-down) .app-tick(.is-on) .app-bubble(--mine)
  .app-thread .app-label .app-dot .app-bar>i .app-chip(.is-on) .app-star`.

## Behaviours by attribute (site.js wires them on load; `Site.scan(root)` for anything added later)

| attribute | does |
|---|---|
| `data-reveal="lines|words|chars|rise|fade|scale|left|right|down"` | enters once when it comes into view (`data-delay`, `data-duration`, `data-stagger`) |
| `data-reveal-group="rise"` | its children enter one after another (`data-stagger`) |
| `data-lit` | words light from dim to full as the element crosses the screen (`data-lit-start`, `data-lit-end`) |
| `data-parallax="0.15"` | drifts against the scroll (fraction of a screen; negative reverses) |
| `data-count="1500" data-suffix="+"` | counts up once; write the final text in the HTML |
| `data-pins` · `data-draw` · `data-fan` | draw / fan on entering (`="manual"` to drive it yourself) |
| `data-weave` | on an `@include weave`: the two rings travel in and weave as it crosses the screen |
| `data-sheen` | one sweep of light on entering and on hover; on `.t-gold` it moves the gradient |
| `data-tilt="7"` · `data-magnet` | pointer tilt with the sheen · magnetic pull (fine pointers only) |
| `data-phone="settle"` | the phone's slow 3D settle on entering |
| `data-screens="fade|slide|rise" data-autoplay="3.2"` | on `.phone__screen`: turn through the screens while in view |

## JS (`Site`, after `Site.ready`)

```js
Site.ready(function (S) {            // S === Site; runs after the engine is up, with or without motion
  // a pinned, scrubbed scene:  <section class="scene" style="--len:4"><div class="scene__stage"><div class="scene__safe">…
  S.scene('#coach', function (tl, s) {          // tl runs 0 → 100 over the section; ease 'none', duration 10 by default
    S.beats(tl, s.$$('.caption'), [[0, 30], [32, 64], [66, 100]]);   // captions take turns
    S.screens(tl, s.$('.phone'), [30, 64]);                          // crossfade the phone's screens at 30 and 64
    tl.fromTo(s.$('.thing'), { y: 80, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 12, ease: 'power2.out' }, 20);
  }, { rest: function (s) { /* optional: runs instead when motion is off */ } });

  // a live vignette: plays (and loops) only while on screen; HTML shows the finished picture
  S.vignette('#register', function (tl, el) { tl.set(ticks, { className: 'app-tick' }, 0); … });
});
```
| helper | returns / does |
|---|---|
| `Site.motion` `Site.fine` `Site.reduced` `Site.wide()` | switches |
| `Site.scene(el, build, {scrub, start, end, rest, onToggle, onUpdate})` | the timeline; the section gets `.is-live` while it plays. Height is `--len` screens; the stage is sticky (never use ScrollTrigger `pin`) |
| `Site.beats(tl, els, ranges, {y, fade})` · `Site.screens(tl, phone, positions)` | scrubbed captions · scrubbed screens |
| `Site.vignette(el, build, {loop, repeatDelay, soft, threshold})` | a paused-until-seen looping timeline |
| `Site.inView(el, {enter, leave, above, once, margin, threshold})` | an IntersectionObserver |
| `Site.phone(el)` → `{show(i), next(), screens, index}` · `Site.settle(el, opts)` | phone control · the settle timeline (paused) |
| `Site.fan(el, {spread, rot, drop, shrink, stagger})` | the fan timeline (paused) |
| `Site.pins(el)` · `Site.draw(el)` · `Site.sheen(el)` | paused timelines / a tween for gold |
| `Site.weave(svg)` → `{state:{d, draw}, render(), set(d, draw), far()}` | the rings: `d` is the distance between centres (12 is the mark); tween `state` and call `render` in `onUpdate` |
| `Site.split(el, 'lines'|'words'|'chars')` | a SplitText instance |
| `Site.svh()` `Site.lvh()` `Site.refresh()` `Site.fonts` (promise) `Site.lenis` `Site.gsap` `Site.ScrollTrigger` | plumbing |

## Rules

- Pinned scenes: use `.scene` + `Site.scene` (sticky + scrub). Size things inside a stage in `svh`; the stage itself
  is `100lvh` and `.scene__safe` is the `100svh` box that is always visible. Give scenes `data-header="light"` or `"dark"`.
- Shorter scenes on a phone: override `--len` in your page CSS under a media query.
- Images: `width`/`height` always, `loading="lazy"` below the fold, `alt` on the first of a stack and `alt=""` on the rest.
- Copy: BRIEF §2. No placeholders; an empty fact means the element is left out (`@if`).
- Check before you report: `scrollWidth === innerWidth` at 320/390/768/1440, console clean, reduced motion and no JS complete.

## Changes — 23 Nov, 05:10 UTC (the lead architect)

- `src/css/palette.css` is new and loads before `site.css` on every page (the shell links it). Variables only, owned by the
  lead architect, never edited by a page: for each of the twenty club colours `--club-<name>` (deep), `--club-<name>-tint`
  (its pale), `--club-<name>-lip` (the pale's ledge), `--club-<name>-mid` (its cloth tone, for a dark ground) and
  `--club-<name>-ink` (what is drawn on the pale). Names: fairway olive bottle lawn court petrol river navy steel aubergine
  indigo plum claret sienna rust saddle chestnut gold slate brick. Use the variables; never paste a hex (the values may be retuned).
- The rule (BRIEF §3, "THE LIGHTER HALF"): what acts is deep; what labels is pale with the deep as its ink; the page feels light;
  never a deep club colour on a dark ground (gold, white, `-mid`, `-tint` there).

## Changes — 23 Nov (Home and Partners)

- `site.js`, `Site.weave` only: while the two rings are apart the LEFT ring now draws whole (its dash pattern is one turn long); it used to stop at half a ring and jump whole when the rings touched. Nothing else in the foundation changed; every class and helper works as before.
- Two things found and NOT changed in the foundation (worked round in `index.*` / `partners.*`; the same fix belongs in every page): (1) `.sheen` and `.phone__sheen > b` rest on a percentage `translate3d` in CSS, GSAP reads it back as pixels, so every `xPercent` sweep (`Site.sheen`, `data-sheen`, `data-tilt`, `Site.settle`'s glass) stops at the element's left edge instead of crossing it: run `gsap.set('.sheen, .phone__sheen > b', { x: 0 })` once, as `index.js` and `partners.js` do. (2) `card.html` hands the card's `class` on to the `qr` include inside it, so a class with layout of its own (`.hero__card`) also lands on the QR code: write such rules as `.bcard.<class>`.
- For anyone building a scene (`Site.scene`): ScrollTrigger puts a scene's timeline back and rebuilds it on every refresh, and two start states do not survive that: a CSS custom property set with `gsap.set` before the scene, and the start state of a timeline nested inside it (`tl.add(Site.fan(…))`). Put both in CSS under `html.motion` instead (Home does: the first chapter chip's `--on`, the fan's hidden screens). And `Site.vignette`'s default "soft" restart cuts a tile's contents to nothing before fading them back: pass `{ soft: false }` and let the scene put itself back gently.
