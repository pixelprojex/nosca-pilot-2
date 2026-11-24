# Nosca's website: the foundation's contract

Read `BRIEF.md` first (the founder's words and this round's direction). This file says how to build a page on
the shared kit. Every piece below is on one page, working: build with `--kit` and open `_kit.html`
(source `src/pages/_kit.html`, `src/css/_kit.css`, `src/js/_kit.js` — copy the patterns, not the class names).

## Build, serve, look

```
node website/build.mjs                          # src/ -> website/dist/, with the kit page
node website/build.mjs --out <dir>              # a release build (no kit page, no _files)
node website/build.mjs --out <dir> --kit        # the same, keeping the kit page
node website/build.mjs --watch
cd <dir> && python3 -m http.server <port> --bind 127.0.0.1

PLAYWRIGHT_MODULE=$(npm root -g)/playwright node website/tools/cap.cjs --dist <dir> --out <shots> \
     --pages index,story --widths 1440,768,390,320 --mode on|off|nojs --frames 40 --port <port>
```
`cap.cjs` prints one JSON line a page and width (console errors, failed requests, sideways scroll, text under
12px, dead pictures). `--mode on --frames N` wheels down the page and saves N viewport stills: read them as a
contact sheet before you hand a scene in. The build warns about absolute URLs and anything that looks like a placeholder.

## Files, and who may touch what

```
src/partials/*   src/css/site.css   src/js/site.js   build.mjs   fonts/   vendor/   BRIEF.md API.md KEYS.md   (foundation)
src/css/palette.css                                   (written by scripts/club-palette.py; nobody edits it)
src/pages/<page>.html   src/css/<page>.css   src/js/<page>.js   assets/<page>-*                               (the page's engineer)
assets/photo/ (MANIFEST.json, CREDITS.md)             (the imagery engineer)
assets/seq/<name>/ (frames + manifest.json)           (foundation; made by tools/seq/)
```
A page engineer edits only the page's three files. Need something shared? Build it in the page's files with the
page's prefix (`hm-`, `pd-`, `st-`, `pt-`) and say so in the report. Never restyle a shared class globally:
scope it, `[data-page="story"] .phone{…}`.

## A page

`src/pages/story.html` is one comment, then sections. The shell adds `<html>`, the head, the header and the footer,
and links `css/story.css` / `js/story.js` when they exist.

```html
<!--
title: Story · Nosca
description: One or two plain sentences.
world: olive            (olive | green: which card's green --ground-green is on this page. Story is green.)
header: green           (the ground the header stands on before the first scroll: paper | rest | green)
-->
<section class="film g-green" id="top" …> … </section>
<section class="section g-paper" id="…"><div class="wrap"> … </div></section>
```
Template: `<!-- @include NAME key="value" -->` · `{{appUrl}} {{installUrl}} {{contactEmail}} {{year}}`
(`{{key|fallback}}`) · `<!-- @if contactEmail --> … <!-- @else --> … <!-- @endif -->` (`@if !key` too; not nested).
Every URL relative: `product.html#coach`, `assets/x.webp`, `./` for Home. When `contactEmail` is empty no address shows.

| include | gives |
|---|---|
| `mark` (`class`, `foil="1"` gold, `label`, `attrs`) | the woven mark, two drawable paths. `--mark-w` sizes it, `color` colours it; `foil` makes it the ground's gold |
| `weave` (same) | two whole rings that travel and weave (`data-weave`, `Site.weave`) |
| `pins` (`class`, `attrs`) | the card's two pinstripe wedges, absolutely filling a `position:relative` parent. `.pins--tr` / `.pins--bl` show one wedge; `--pins-w` its width, `--pin-sw` the stripe weight |
| `phone` (`screens="a,b,c"` `alts="First|…"` `mode="fade|slide|rise|push"` `seq="log"` `seqalt` `poster="0|last|N"` `autoplay="3.2"` `settle="settle"` `class` `attrs` `eager="1"`) | the drawn phone with its screens stacked (780×1688 stills from `assets/`), or with an image sequence as its first screen |
| `seq` (`name="log"` `alt` `poster="0|last|N"` `class` `attrs` `eager`) | an image sequence outside a phone: the poster `<img>` and everything `Site.sequence` needs |
| `photo` (`name` `alt` `class` `attrs` `sizes` `focus` `credit="1"` `eager="1"`) | `<figure class="photo">` from `assets/photo/MANIFEST.json`: width, height, srcset, the alt and the picture's own dark tone behind it while it loads. The build fails, naming the photograph, when it is not in the manifest |
| `card` (`world="olive|green"` `class` `attrs` `weave="1"` `pinsattrs` `frontattrs`) | the business card, both faces. `--card-w` sizes it; `.is-back` shows the back; `.bcard--shadow` lays it on a table |
| `qr` · `ticks` · `arrow` | the install code · the 45 cycle days · the small arrow for keys and links |

## The one rule of motion

**Write the finished page in HTML and CSS.** Every caption, every picture, in a plain column. Anything that hides,
offsets or pins lives under `html.motion`, a class that exists only while `site.js` is running and the visitor
allows motion. With JavaScript off, a failed script, Reduce Motion or a very short landscape screen, the page is
whole and still. `.only-rest` shows only without motion (a still for a scene), `.only-motion` only with it.
Animate **transform, opacity and clip-path only**. Pins are `position: sticky` (never ScrollTrigger `pin`), so
nothing jumps when one starts or ends.

## Colour: the card is the art direction

Three grounds and no fourth. A section says which it stands on, and its words follow.

| class | token | value | what |
|---|---|---|---|
| `.g-green` | `--ground-green` (`--ground-green-deep`) | `#4F5B29` (`#3E4820`); `#123C30` (`#0A251D`) under `data-world="green"` | the card's front. The olive card's ground is CMYK 50/30/85/45 in `scripts/business-card.py` and measures `#505D27` in the print preview; the dark card is the brand's bottle green |
| `.g-paper` | `--ground-paper` | `#FFFFFF` | the card's back |
| `.g-rest` | `--ground-rest` | `#F6F4EE` | one quiet warm off-white, for rest (the table the card lies on in the preview is `#ECE9E3`) |

Gold is **a line, a numeral, a small-caps eyebrow, a hairline**. Never a fill, a gradient or a glow.

| token | value | for |
|---|---|---|
| `--gold-line` | `#C2A24C` | rules, the mark and pinstripes on white or rest. A line, never words |
| `--gold-pin` | `#CDB065` | pinstripes, rules and the mark on the green |
| `--gold-text-on-white` | `#85651A` | gold words on paper or rest: an eyebrow, a numeral |
| `--gold-text-on-green` | `#E9CF7E` | gold words on the green: NOSCA, an eyebrow, a numeral |
| `--ink --sub --faint --trace --hair --edge --ledge` | `#1C1C1E #5F5F65 #6E6E73 #AEAEB2 #EBEBF0 #E2E2E7 #D9D9DE` | the app's own greys |
| `--on-green --on-green-2` | `#F4F6F3 #DADED2` | words on the green |

Inside any ground use `--bg --fg --fg-2 --fg-3 --fg-dim --line --rule --gold-text --focus`: they are already the
right ones for that ground (`.c-2`, `.c-3` are the two greys as classes; `--gold-text` is the gold words may take
there, `--rule` the gold a line takes there).

Measured contrast (WCAG) of every pair that is sanctioned for words. Use no other pair.

| words | on paper | on rest | on olive green | on dark green |
|---|---|---|---|---|
| `--ink` | 17.0 | 15.5 | no | no |
| `--sub` | 6.3 | 5.8 | no | no |
| `--faint` (small print) | 5.1 | 4.6 | no | no |
| `--gold-text-on-white` | 5.4 | 4.9 | no | no |
| `--on-green` | no | no | 6.8 | 11.3 |
| `--on-green-2` | no | no | 5.4 | 9.0 |
| `--gold-text-on-green` | no | no | 4.8 | 8.0 |
| white | no | no | 7.3 | 12.3 |

Lines only, never words: `--gold-line` (2.5 on paper, 2.2 on rest), `--gold-pin` (3.5 on olive, 5.8 on dark),
`--trace`, `--hair`, `--edge`.

**The six sports' colours** (`--golf --tennis --rowing --squash --padel --equestrian`, the app's own values from
`palette.css`) appear only inside their own sport's moment, and mostly inside the phone's screen, where the
screenshots already carry them. Outside a screen the one permitted mark is `.sport-dot[data-sport]` beside the
sport's name. No sport-coloured ground, band, panel, heading or key. The club colours (`--club-*`, `data-club`)
are for vignettes of the app (`.app …`, `KEYS.md`) and nothing else. Fewer colours on screen at once, everywhere.

Retired, kept as aliases so nothing breaks, **do not write them in new work**: `--olive --green --world
--world-deep --gold --gold-hi --gold-lo --gold-deep --pin --on-dark --on-dark-2 --paper --table --wash`(as a ground),
`.g-world` (= `.g-green`), `.g-wash` `.g-table` (= `.g-rest`), `.t-gold`'s gradient (it is flat now), the
`#g-foil` gradients (flat), `.panel`'s pale tint (it is the rest ground), `data-header="dark|world|light"`.

## Type

Instrument Sans is the voice (`--display`), set large and tight. Instrument Serif (`--serif`, OFL, self-hosted,
with a true italic) speaks only in the few editorial moments. Body copy is the system face (`--text`) at 17.
Each web font has a fallback face cut with `size-adjust` and its own ascent and descent, so nothing moves when it lands.

| class | size (320 → 1920) | for |
|---|---|---|
| `.t-mega` | 84 → 340, 600, −0.055em | one word a page: Nosca. |
| `.t-display` | 46 → 152 | a page's first headline |
| `.t-h1` | 40 → 104 | a film's or a chapter's headline |
| `.t-h2` | 31 → 68 | a caption's headline |
| `.t-h3` | 22 → 32 | a small heading |
| `.t-lede` | 19 → 26, in `--fg-2` | the sentence under a headline (max 30em) |
| `.t-body` `.t-small` `.t-caption` | 17 · 14 · 13 | nothing under 12 |
| `.eyebrow` | 13, small capitals at .22em, in the ground's gold | the card's small caps. `.eyebrow--rule` leads with a gold rule; `.eyebrow--ink` is grey |
| `.wordmark` | tracked .42em | NOSCA |
| `.t-quote` | serif 30 → 72 | a pull-quote; `<i>` inside is the true italic |
| `.t-numeral` | serif italic 44 → 96, gold | a chapter numeral: `01`, `2` |
| `.t-serif` | the serif at the current size | a word or a line |
| `<i lang="ga">nascadh</i>` | the serif's italic, a touch larger | a word in Irish, set apart as the foreign word it is. Always mark it up so |

`h1 h2 h3` balance; `p` wraps pretty. `.measure` is 34em. `.nw` keeps words together. `.sports` (spans) is the six
sports line with its dots. `.t-gold` is flat gold in the ground's `--gold-text` (large type, numerals, eyebrows only).

## Layout

| class | what |
|---|---|
| `.wrap` `.wrap--narrow` `.wrap--wide` | a centred column with gutters (1160 / 760 / 1440; the gutter is `--gut`) |
| `.section` `.section--tight` | vertical rhythm: 96 → 208 of air above and below (56 → 112) |
| `.cols` | the editorial grid: twelve columns on a desk, four on a phone (where every child takes the full row). Place a child off-centre with `style="--at:3;--span:6"`. This is how asymmetry is made: do not centre everything |
| `.grid .grid--2/3/4` `.stack` (`--stack`) `.center` `.keys` | utilities |
| `.rule-gold` (`--hair`) | the card's gold rule; add `data-rule` and it draws from its left end with the scroll |
| `.sheet` (`.sheet--lift`, `.sheet--over`) | a section with round shoulders lying over the one before; `--over` slides right over the film or `.hold` before it, which stays pinned one more screen |
| `.hold` | the section stays at its end while the next slides over it and it recedes a little (`data-hold="still"`, `data-hold="0.94"`). It stays under everything after it, the footer included |
| `data-header="paper|rest|green|none"` on a section | the header is **solid**, the colour of the ground under its foot, closed by a gold hairline. With no attribute it reads the section's own ground. `none` slides it away while a full-bleed film plays (it returns on focus) |
| `data-world="green"` on any element | the dark card's green for `.g-green` beneath it |

## Objects

- **Keys** `<a class="key">` (the card's green, white words) · `.key--paper` (white, on any ground) · `.key--ghost`
  (an outline, on the green) · `.key--sm` `.key--lg`. They sink on press. `data-magnet` adds the pull on a desk.
- **Link** `<a class="link">Words <!-- @include arrow --></a>` (`.link--gold` takes the ground's gold).
- **Mark** `<!-- @include mark foil="1" class="…" -->`, large and faint behind a section:
  `<div class="ringsbg"><!-- @include mark --></div>` (`--rings-w`, `--rings-o`).
- **Pinstripes** `<!-- @include pins attrs="data-stripes" -->` in a `position:relative` ground. `.pins--band` is the
  size for a full-width band.
- **Phone** `<!-- @include phone … -->`, width `--phone-w`; `.phone--light` a silver frame; `.phone--flat` no cast shadow.
  Give its parent `.depth` for perspective.
- **Shot** `<figure class="shot"><img …></figure>` (`--shot-w`): a screen outside the phone, on the app's ledge.
- **Card** `<!-- @include card world="olive" class="bcard--shadow" -->`.
- **Photograph** `<!-- @include photo name="…" attrs="data-settle" -->` or by hand `<figure class="photo" style="--ar:3/2;--focus:50% 30%"><img width height alt loading="lazy"></figure>`.
  `.photo--tall` 4/5 · `.photo--wide` 21/9 · `.photo--square` · `.photo--bleed` a full screen · `.photo--veil` lays one even
  veil of the deep green over it for words (`--veil:.42`; never a gradient). The manifest's `headline` says where on each
  picture words can sit and in which colour: put them there, in `--on-green`, and raise `--veil` until the lightest part
  under them holds 4.5:1 (a white sky needs .75; the graded pictures' dark halves hold at .42 to .5). Gold words on a
  photograph only where the veiled picture is as dark as the card's green. `.credit` / `credit="1"` is the small line under one.
- **A photograph as a film's ground** `<!-- @include photo name="…" class="photo--bleed photo--veil" attrs="data-settle='none'" -->`
  as the first child of `.film__stage`: with motion it fills the pinned stage and the words in `.film__safe` lie on
  it; at rest it is the picture at its own shape with the words under it. (The kit's `#still`.)
- **Loop** `<!-- @include loop name="loop-rowing-lake-1" credit="1" -->`: a clip from the manifest's `loops`, muted and
  inline, its poster the still; it plays only while it is on screen. `scrub="1"` makes the scroll its play head instead.
  `.vid--bleed` and `.vid--veil` as for a photograph.
- **Partner frame** `<div class="pframe"><!-- @include mark --></div>` in `.pframes`: paper, one gold hairline, the mark faint. No shadow.
- **Stat** `.stats > .stat > .stat__n[data-count] + .stat__l`. Only the numbers BRIEF §2 gives.
- **The app's vocabulary** for a vignette (wrap in `.app`, colours per `KEYS.md`): `.app-card .app-list .app-row
  .app-row__t .app-name .app-sub .app-time .app-eyebrow .app-title .app-face .app-glyph .app-key (--quiet --danger --wide,
  .is-down) .app-tick(.is-on) .app-bubble(--mine) .app-thread .app-label .app-dot .app-bar>i .app-chip(.is-on) .app-star`,
  on a `.tile` (`--pad`). `data-club="navy"` picks a club colour for what is inside.

## The motion library

The scroll is a film reel the visitor turns by hand. Every piece is **scrubbed**: it moves exactly as far as the
thumb has. Each takes the same two ways of being driven:

```
{ tl, at, duration }                 inside a film: positions and durations run 0 to 100 over the film
{ start, end, scrub, trigger }       on its own passage through the screen (the default; the attribute does this)
```
Attributes are wired on load (`Site.scan(root)` for anything added later). A piece standing on a pinned stage
(a film's or a rail's) is left to that film or rail: drive it from the film's timeline. `="manual"` on any
attribute leaves the piece to your script.

### Site.film — a pinned scene the scroll plays

```html
<section class="film g-rest" id="log" data-film style="--len:5.4;--len-sm:4.6" data-header="rest">
  <div class="film__stage">                       <!-- sticky, one screen tall (100lvh), clips -->
    <div class="film__safe hm-log">               <!-- the 100svh box that is always visible: lay the scene out here -->
      <div class="film__steps">                   <!-- captions: a column at rest; with motion they share one place and take turns -->
        <div data-step data-frame="0"><p class="t-numeral">1</p><h2 class="t-h2">The coach's day.</h2><p class="t-lede">…</p></div>
        <div data-step data-frame="11"> … </div>
      </div>
      <!-- @include phone seq="log" seqalt="…" attrs="data-device data-zoom='tall' data-turn='-20,7,1.5'" -->
      <i class="film__bar"><i></i></i>            <!-- the fine gold line of progress -->
    </div>
  </div>
</section>
```
`data-film` builds all of that with no script. `--len` is the film's length in screens (`--len-sm` on a phone, else
four fifths of `--len`). What the markup says:

| in a film | does |
|---|---|
| `[data-step]` (or `data-step="20,45"` for its own range) | captions take turns, evenly over the film (after the zoom's lead). The section carries `data-at="<index>"` |
| `[data-step-mark]` | the nth one gets `.is-on` while the nth step plays (a chapter list, dots) |
| `[data-device]` on a phone (`="fade|slide|rise|push"`, `data-swap="4.4"`) | its screens change with the steps |
| `data-zoom="bleed|tall|1.8"` (`data-zoom-len="16"`, `data-zoom-wide="tall"`) | the phone's screen fills the stage (or stands a screen tall), then draws back into its frame over the first 16 of the film. A 660px frame at full bleed on a desk is soft: name a gentler start for 900 and up |
| `[data-after-lead]` | anything that should wait for the zoom: it arrives as the phone settles into its frame (an eyebrow, a chapter list) |
| `data-turn="ry,rx,rz"` (`data-turn-to="ry,rx,rz"`) | it turns in 3D into rest (or from one pose to another across the whole film) |
| a `[data-sequence]` (the phone's `seq`) | runs frame for frame with the steps: each step's `data-frame` is the frame the sequence stands on as that step begins |
| `[data-scrub-video]` | its time runs with the film |
| `.film__bar > i` | fills |
| `[data-ink]` `[data-rise]` `[data-settle]` `[data-depth]` `[data-stripes]` `[data-rule]` on the stage | play with the film: inside a `[data-step]` as that step begins, otherwise over the film. `data-at="6" data-len="44"` places one exactly (0 to 100). Anything your script drives itself is left alone |
| `data-span="16,100"` | where the steps begin and end |
| `data-unpin="sm"` | on a phone this film does not pin: it is the plain column (`.only-rest` shows, `.only-motion` hides) |

With script, when the scene needs more (`Site.ready` runs before the markup films are built, so yours wins):

```js
Site.ready(function (S) {
  S.film('#open', function (tl, s) {                          // tl: 0 → 100, ease 'none', duration 10 by default
    S.drawStripes(s.$('.pins'), { tl: tl, at: 0, duration: 52 });
    tl.fromTo(s.$('.hm-lock'), { y: 0 }, { y: function () { return -s.vh() * 0.06; }, duration: 60 }, 0);
    S.groundShift(s.$('.shift-layer'), { tl: tl, at: 56, duration: 44, shape: 'wedge' });
  }, { rest: function (s) { /* runs instead when motion is off */ } });
});
```
`s`: `el stage $(q) $$(q) vw() vh() lvh() steps at(i)`. Options: `scrub` (0.9) `start` `end` `span` `unpin` `rest`
`onToggle(active)` `onUpdate(progress)`. The section has `.is-live` while it plays and `.is-built` once made.
Use function values (`y: () => …`) for anything measured: the timeline is rebuilt on resize. Two things do not
survive that rebuild, so keep them in CSS under `html.motion`: a CSS custom property set with `gsap.set` before the
film, and the start state of a timeline nested inside it (put tweens straight on `tl`). `Site.scene` is the same
stage without the conveniences (the older name; `Site.beats(tl, els, ranges)` and `Site.screens(tl, phone, positions)` still work).

### Site.device — the phone in a film

`var d = Site.device(phone)` is `Site.phone(phone)` (`show(i) next() warm() screens index`) with three things a timeline plays:
`d.swap(tl, [30, 60], { mode, duration })` the screens change inside it · `d.turn(tl, { from: [ry, rx, rz], to: [0, 0, 0], at, duration })`
it turns · `d.zoom(tl, { from: 'bleed' | 'tall' | 1.8, at, duration, wide })` its screen fills the stage and draws back.
Outside a film: `data-phone="settle"` is the slow 3D settle on entering; `data-screens` + `data-autoplay="3.2"` on
`.phone__screen` turn through the screens while in view (the `phone` include writes both).

### Site.sequence — frames of the real app on a canvas, drawn by scroll

`<!-- @include seq name="register" alt="…" -->` (or the phone's `seq`). On its own it plays over its passage
through the screen (`data-start`, `data-end`); in a markup film it follows the steps. By hand:
`var q = Site.sequence(el, { tl, at, duration })` or `q.keys(tl, [[0, 0], [40, q.at(18)], [100, 1]])` (at timeline
position 40 it stands on frame 18); `q.p = 0…1`, `q.frame(i)`, `q.frames`. Frames load when it nears the screen, a
coarse pass first so a fast scroll always has a near frame. The `<img>` is the poster and the no-JS picture.

| sequence | frames | size | marks in its manifest (first, last frame) |
|---|---|---|---|
| `log` | 58 | 0.8 MB | home 0 · plus 1–10 · who 11–18 · page 19–27 · chipping 28–31 · putting 32–35 · logged 36–57 |
| `register` | 36 | 1.1 MB | home 0 · peek 1–7 · open 8–15 · six marks 16–33 (the fourth is Absent) · submit 34–35 |
| `feed` | 29 | 0.5 MB | first 0 · to the second lesson 1–14 · to the third 15–28 (a player's feed; the clips are the test suite's synthetic clip) |

All are 660 × 1428, shot from a mock build of the real app (`tools/seq/seq-*.cjs`, then `seq-encode.py`; they
need the stills harness in the scratchpad, see each file's first line). Ask the foundation for another.

### Site.scrubVideo — a video whose time is the scroll

`<video data-scrub-video muted playsinline preload="metadata" poster width height src>` or
`Site.scrubVideo(video, { tl, at, duration })`. It never plays, so it is silent and still off screen. Encode with
a keyframe every frame or two (`ffmpeg -g 2 -an -movflags +faststart`). `assets/seq/plus/plus-scrub.mp4` is the
plus sheet rising (1.1 MB). `video[data-video]` is the other kind: it plays muted and inline while on screen and
pauses the moment it is not (`="once"` does not loop).

### Site.inkFill — a headline fills with ink line by line

`<h2 class="t-display" data-ink>` (`data-ink="gold"` fills in gold). The dim line stays (`--fg-dim`); a full-ink
copy of each line opens over it from the left. `Site.inkFill(el, { tl, at, duration })` in a film.

### Site.rise — words rising out of their line's mask

`<p class="t-quote" data-rise>` (words) · `data-rise="lines"`. `Site.rise(el, { by, tl, at, duration })`.
`data-lit` is the quieter cousin: words light from dim to full as the paragraph crosses the screen.

### Site.depth — layers at different rates

`<div data-depth="0.18"> <figure data-z="-0.6"> <h2 data-z="0.3"> … </div>`. `data-z` is how far forward a layer
stands (1 moves a whole range against the scroll, −1 with it); the range is `data-depth` of a screen;
`data-z-scale="0.06"` lets a far layer breathe. `data-parallax="0.15"` is one element drifting on its own.

### Site.drawStripes — the card's gold drawing itself

`data-stripes` on a `pins` include (the wedges draw line by line behind their edge) · `data-rule` on a
`.rule-gold` (from its left end) · or any svg whose paths carry `pathLength="1"` (the mark, a diagram).
`Site.drawStripes(el, { tl, at, duration })`. (`data-pins` and `data-draw` are the time-based draws on entering.)

### Site.groundShift — one ground giving way to another

On a section: `<section class="section g-green" data-ground-shift>`. Its ground arrives as the card's diagonal:
a wedge of it, closed by the gold edge, rises out of the section before and levels as the section reaches the
top. Nothing is pinned. A plain section before it is given a foot as tall as the wedge (`data-shift-lead="0.5"`
of a screen), so the wedge crosses air. After a film, a rail or a `.hold` there is no foot: the edge starts level
when the scene lets go, tilts over the departing frame, and levels again at the top (it never lies over a scene that is still playing).
In a film: `<div class="shift-layer g-paper" aria-hidden="true">…</div>` on the stage and
`Site.groundShift(layer, { tl, at, duration, shape: 'wedge' | 'rise' | 'iris' })` opens it over the stage through a clip-path.

### Site.rail — a horizontal passage on vertical scroll

```html
<section class="rail g-paper" id="sports" data-rail data-header="paper">
  <div class="rail__stage"><div class="rail__track hm-sports"> …items… </div><i class="rail__bar"><i></i></i></div>
</section>
```
At rest the track is a plain column (or your grid). With motion the section is as tall as the track is wide, so
the thumb's travel down is the track's travel across. Inside it `[data-settle]` photographs open as they come in,
`[data-rail-z="0.12"]` layers drift at their own rate, `[data-rail-in]` items rise in, and `[data-ink]` / `[data-rise]` play as their item arrives. `--rail-gap`, `--rail-pad`;
`data-rail="1.4"` slows it. `data-unpin="sm"`: on a phone it is the phone's own sideways swipe, snapping item to
item. `Site.rail(el, function (tween, r) { … })` hands you `r.containerAnimation` (and `r.items r.track r.stage r.dist()`)
for anything else that should happen as an item passes.

### Site.settle — a photograph that settles

`<figure class="photo" data-settle>`: the frame opens through a clip-path (`data-settle="9% 7% 9% 7%"`, or `none`)
and the picture comes to rest from a slow scale, then keeps a little drift for as long as it is on screen. Never a
pop. `Site.settle(figure, { tl, at, duration, open, scale })`.

### Site.card — the business card

`Site.card(card).turn(tl, { at, duration, from: 0, to: 180, tilt: [rx, rz] })` turns it over in a film, with one
pass of light across the arriving face. `<div class="bcard is-back" data-card-turn>` (through the include:
`class="is-back" attrs="data-card-turn"`) turns from its front to its back on its own passage.

### The rest

| attribute / call | does |
|---|---|
| `data-weave` on a `weave` include · `Site.weave(svg)` → `{ state: { d, draw }, render(), set(d, draw), far() }` | the two rings travel in and weave as it crosses the screen (`d` is the distance between centres; 12 is the mark) |
| `data-count="1500" data-suffix="+"` | counts up once; write the final text in the HTML |
| `data-tilt="7"` · `data-magnet` · `data-sheen` | pointer tilt with one pass of light · magnetic pull · one pass of light on entering (fine pointers; nothing may depend on hover) |
| `Site.vignette(el, build, { loop, repeatDelay, soft, threshold })` | a small looping timeline that plays only while on screen; the HTML shows the finished picture. The restart never blanks the tile |
| `Site.inView(el, { enter, leave, above, once, margin, threshold })` | an IntersectionObserver |
| `Site.fan(el)` · `data-fan` | `.shot`s in a `.fan` fanning out |
| `data-reveal="lines|words|rise|fade|…"` · `data-reveal-group` | a timed entrance. **Not for headlines, sections or pictures any more**: an entrance that only fades up is the tell this round removes. Keep it for small print inside a tile, if at all |
| `Site.motion` `Site.fine` `Site.reduced` `Site.wide()` `Site.small()` | switches |
| `Site.svh()` `Site.lvh()` `Site.refresh()` `Site.fonts` `Site.toHash('#id')` `Site.header.refresh()` `Site.lenis` `Site.gsap` `Site.ScrollTrigger` `Site.split(el, type)` | plumbing |

## Rules that keep it holding

- **Every section has a scroll-linked behaviour; each long page has at least three pinned films; the first screen
  of each page is one.** One idea per screen of scroll.
- Size things on a stage in `svh` (`min(60vw, calc((100svh - var(--hdr-h) - 110px) / 2.2))` for a phone); the stage
  is `100lvh`, `.film__safe` the `100svh` that always shows. Keep clear of the header (`--hdr-h`, 56 / 64).
- A film must not trap the thumb on a phone: shorter there (`--len-sm`), or `data-unpin="sm"`.
- Pictures: `width` and `height` always, `loading="lazy"` below the fold, `alt` on the first of a stack and
  `alt=""` on the rest. Video: `muted playsinline`, never autoplaying off screen.
- Lines are split only once the fonts are in, and re-split on resize; do not put `data-ink` and `data-rise` on one element.
- Anchors: a link to `#id` on the same page glides there. A plain section lands with its top at the header's foot; a film, a scene or a rail lands flush with the top of the screen, pinned on its first frame. A page opened on `#id` lands again once films have set the page's length (`Site.toHash`).
- Safari: no `scroll-timeline`, no `animation-timeline`; `lvh`/`svh` are written with a `vh` fallback before them.
- Before you report, with `cap.cjs`: no console errors, no failed requests, no sideways scroll at 320 / 390 / 768 /
  1440 / 1920, nothing under 12px, `--mode off` and `--mode nojs` whole, and every film watched frame by frame.

## Fixed this round (the loose ends from round one)

- The sheen rested on a percentage translate that GSAP read back as pixels, so every pass of light stopped at the
  element's left edge (`Site.sheen`, `data-sheen`, `data-tilt`, the phone's glass). It rests on no transform now;
  the `gsap.set('.sheen …', { x: 0 })` in page scripts is no longer needed (and harmless).
- `Site.vignette`'s soft restart blanked a tile. It is off unless asked for (`soft: true`), and then only dips.
- The card partial handed its `class` on to the QR code inside it. It does not.
- `.hold` stacked over later sections and the footer. It is under everything after it and stops painting once covered.
- Lenis anchors landed under the header; a page opened on `#id` landed short once films lengthened it. The foundation handles anchors itself now: sections land at the header's foot, films flush.
- The header was 97% white and ghosted over content. It is solid, on the ground beneath it, closed by a gold hairline.
- `<i lang="ga">` had no style. It is the serif's true italic.
- Gold was a gradient (`.t-gold`, `#g-foil`). It is one flat metal.
