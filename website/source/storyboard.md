# Nosca website: the scroll storyboard

The motion plan for the first website. It turns `brief.md` into scenes, a
scroll length for each, the technique that does it, and what each scene
shows under Reduce Motion. It ends with the scroll engine and its pitfalls.

The page is white. It reads like a luxury brand when it is still and plays like
a game when it is scrolled. Each section has one orchestrated moment. The
signature is the two rings linking in scene 2.

## The whole page at a glance

| # | Scene | Length | Pinned | The one moment |
|---|-------|--------|--------|----------------|
| 1 | Hero: Coaching, linked. | 200svh | yes | The gold mark draws itself, then settles into the header as a phone rises |
| 2 | Name: Nasc. **(signature)** | 400svh | yes | Two gold rings come in from either side and weave into the mark |
| 3 | Story: Built around one moment. | 450svh | yes | 45 ticks light on their real dates, then 1,554 rolls up |
| 4 | For the coach | 500svh | yes | A lesson's life: diary, capture, draw, log. The words light with the taps |
| 5 | For the player | 400svh | yes | The same lesson arrives in the feed. The level line draws itself |
| 6 | For the family | 400svh | yes | One coach line splits into three family threads |
| 7 | Six sports. One app. | 420svh | yes | The same screen re-tints through the six sports |
| 8 | Principles, then Partners | 160svh pinned + about 180svh of flow | part | Three words light one at a time, then a gold rule draws |
| 9 | Close: In pilot, in Ireland. | 260svh pinned + about 100svh of flow | yes | The business card turns over, and its code is live |

The total is about 3,470svh, or 35 screens. At an easy thumb pace of about 2.5
seconds a screen, reading included, that is about 90 seconds on a phone.

**Changes to the brief, for the writer and the founder to accept**

- *Story's beat 3 ("Each sport in its own words") moves to scene 7.* Scene 7
  already turns through the six sports, so the line belongs there and the story
  loses a beat it would repeat. The copy is unchanged.
- *The coach's beats run in the order of a lesson's life:* Diary, Capture,
  Draw, Log. That puts **Log it** last, and scene 5 opens on the lesson just
  logged. The copy is unchanged.
- *The player stays in golf, not tennis.* The coach logs Cian Murphy's
  *Chipping · Putting* (HI 15.8), and the player's feed opens on *Chipping ·
  Putting · HI 15.8*. The same lesson crosses from one side to the other, which
  shows the link without saying it. Scene 7 carries the other five colours.
- *The reminder names the demo family's own junior,* "Saoirse's lesson
  tomorrow · 10:00 am", not Ellie. The parent is Orla Kelly and the junior
  Saoirse Kelly, so the whole family scene is one fictional family.

## Global rules for motion

- **Scrubbed or triggered.** A pinned scene is *scrubbed*: scroll position is
  the clock, and scrolling back plays it backwards. Section headings, count-ups,
  the principles' lines, the partner frames and the footer are *triggered once*
  by IntersectionObserver and play on time. Nothing loops and nothing plays on
  its own while the reader is still, except the hero's first draw.
- **What animates.** Only `transform` and `opacity` animate. Two other writes
  are allowed: SVG `stroke-dashoffset` and `stroke-dasharray` on the mark and the
  drawn lines, and a class toggle per word for the highlight, whose colour then
  eases by a CSS transition. Width, height, top, left, margin, letter-spacing and
  font-size never animate.
- **Easing.** There is never a bounce or an overshoot, which is the app's own
  rule.
  - One-shot reveals use `cubic-bezier(0.22, 1, 0.36, 1)` over 700ms. They rise
    16px on a phone and 24px on a desktop, with an opacity fade of 0→1 over
    600ms and a stagger of 90ms.
  - Scrubbed moves use `easeOut(t) = 1 − (1 − t)³`.
  - Crossfades use `smooth(t) = t²(3 − 2t)`.
  - Draw-ons are linear, because the reader's thumb is already the easing.
- **Rhythm in a pinned scene.** Each beat sits at rest, fully lit and settled,
  for at least 60% of its window. That is the reading time. A transition takes
  0.04 to 0.08 of the scene's progress (20 to 35svh), which is one thumb flick.
  A screen never changes while its caption is being read.
- **Word highlight.** This is Apple's highlight.
  - Words are wrapped in `<span class="w">` *at build time*, not at runtime, so
    nothing shifts on load.
  - Each word gets a threshold inside its beat. When progress passes it, the
    word takes `.on`, and `transition: color 350ms` eases it in.
  - On white, a word goes from dim `#8E8E93` (3.3:1, still readable) to ink
    `#1C1C1E`. On the olive band it goes from `rgba(244,246,243,.38)` to
    `#F4F6F3`.
- **Phone frame.** The phone is a bezel only.
  - The bezel is 10px of `#1C1C1E`, with a corner radius of 13% of the phone's
    width, a white screen, and the 780×1688 screenshot at 100% width.
  - There is no notch, island or fake status bar. The shots start at the app's
    own 12px of top air, and anything drawn over them would cover the app's mark
    row. It is also a portrait of the app, not a copy of anyone's hardware.
  - The shadow is a pre-blurred PNG or SVG under the phone that changes in
    opacity and scale. A `box-shadow` is never animated.
- **Screen crossfade.** All of a scene's screens are stacked inside the phone.
  - **Fade only the incoming screen, over the outgoing one.** If both fade, the
    picture dips to white halfway through.
  - Once the incoming screen reaches 1, the outgoing one gets
    `visibility: hidden` so it stops painting.
- **Tap ring.** This shows the reader where a finger went: the app's walkthrough
  ring.
  - It is a 2px ring in the sport's colour, 44px across on the phone's own
    scale.
  - It scales from 0.6 to 1 with opacity 0→1→0 over 0.03 of progress, just
    before the next screen arrives.
  - Its position is stored on the element as `data-tap="x%,y%"`, measured from
    the 780×1688 shot (for example, the Register key on `coach-today-golf`). Do
    not guess coordinates.
- **Layout.**
  - The header is `--hdr: 52px`.
  - At 960px and wider, a pinned scene has its words in the left 5 of 12
    columns and its picture in the right 7. The phone's height is
    `clamp(480px, 74svh, 760px)`.
  - Under 960px, the picture is on top and the caption under it, crossfading in
    place. The phone's height is `clamp(260px, 56svh, 600px)`.
  - At 320px nothing is cut and nothing scrolls sideways. On a landscape phone
    (`max-height: 520px`) no scene is pinned and the static layout is used
    (below).
- **Type.**
  - The face is Instrument Sans (400, 500, 600 and 700) from Google Fonts, with
    `display=swap`.
  - Headlines are `clamp(40px, 7vw, 96px)` at 600, with −0.02em tracking.
  - A beat's title is `clamp(24px, 3.2vw, 40px)` at 600. Body text is
    17 to 19px at 400 in `#5F5F65`.
  - Nothing is under 12px.
  - Numerals use `font-variant-numeric: tabular-nums`, so a counting figure
    never changes width.
- **Gold.** The mark, the rings, fine rules and the large lowercase "nasc" use
  an SVG `linearGradient` or a `background-clip: text` gradient running from
  `#B08630` through `#E9CF7E` to `#C2A24C`, which is the card's foil. Gold is
  never used for body text.
- **The header.**
  - It is a solid white bar, never blurred, with the 36px mark at the left.
    Nothing else is on it on a phone.
  - While scene 2's olive band is under it, it turns olive with a gold mark. The
    frame loop does this by comparing `scrollY + 26` with the cached band top and
    bottom, so no extra observer is needed.
  - A 1px `#EBEBF0` hairline appears once the page has moved.

---

## Scene 1: Hero ("Coaching, linked.")

**Length.** The section is 200svh: one screen at rest, then 100svh of scrub.

**On load.** This plays on time, once. It is the only motion that runs without
a scroll, as the app's own splash does.

1. **The left ring draws (200ms to 1200ms).** Each ring path carries
   `pathLength="1"`, with `stroke-dasharray: 1` and `stroke-dashoffset` going
   from 1 to 0, eased in and out. The paths are the real `RING_L` and `RING_R`
   from `assets/mark.svg`, broken from the first stroke, so the weave is there
   while it draws.
2. **The right ring draws (450ms to 1450ms).**
3. **NOSCA fades in (1300ms).** It is tracked at 0.42em, at weight 500 in gold,
   and fades in rising 8px over 500ms. The tracking is fixed and never
   animates.
4. **The headline rises (1500ms).** "Coaching, linked." rises 16px over 700ms.
5. **The lines follow (1650ms and 1800ms).** "One app for coach, player and
   parent." is in `#5F5F65`. The sports line is 15px in `#6E6E73`.

**On scroll.** Progress p runs from 0 to 1.

- **p 0 to 0.45.** The mark flies to the header. This is a FLIP: in `measure()`,
  read the rectangle of the hero mark and of the header's mark slot, and keep the
  translate and the single scale that map one onto the other. The frame applies
  that transform scaled by `easeOut(seg(p, 0, .45))`. At p ≥ 0.45 the header's
  own mark shows and the hero's hides. They are the same pixels, so nothing
  jumps.
- **p 0.05 to 0.35.** NOSCA and the two lines fade out and lift 24px, together.
- **p 0.05 to 0.50.** The statement scales down into its place: "Coaching,
  linked." moves to the top of the frame and scales from 1 to 0.62. This is the
  same FLIP, onto an invisible `.title-end` placeholder.
- **p 0.20 to 0.90.** The phone rises from `translateY(70svh) scale(.92)` to
  rest, showing `coach-today-golf.webp`, and its shadow comes up with it.
- **p 0.90 to 1.** The scene holds, then releases. The phone scrolls away with
  the page as the olive band slides up over it.

**Assets.** `mark-gold.svg` (its geometry inlined), `coach-today-golf.webp`, and
the shadow.

**Reduce Motion.**
- Nothing is pinned. The hero is 100svh: the drawn mark, NOSCA, the headline and
  both lines, centred.
- The phone with Today sits below it in the flow.
- The header's mark is always shown.

## Scene 2: Name ("Nasc."), the signature

**Length.** The section is 400svh. This is the longest hold on the page, because
the name is the story.

**The stage.**
- The ground is olive `#4F5B29`, full-bleed.
- Two wedges of gold pinstripes sit in opposite corners, taken from the card's
  geometry in `scripts/business-card.py`:
  - the top-right wedge is the triangle (0.44W, 0), (W, 0), (W, 0.58H);
  - the bottom-left wedge is the triangle (0, 0.42H), (0, H), (0.56W, H).
- The stripes run at 45°. The pitch is `clamp(14px, 2.2vw, 28px)` and the lines
  are 1.25px (1.5px on a desktop). This is finer than the card's own proportion,
  so a full-bleed band never reads as a heavy hatch.
- Each wedge has one 2px gold hairline on its inner edge.
- The stripes are one inline SVG with a `<pattern>`, clipped by each triangle.

**Enter.** While the band rises into view, enter runs from 0 to 1. The wedges
slide in along their diagonals from outside their corners (`translate(18%,-18%)`
and `translate(-18%,18%)` to 0, with easeOut), and they finish as the band
reaches the top.

**Pinned beats.**

| p | What happens |
|---|--------------|
| 0.00 to 0.12 | **"nasc"** arrives. It is lowercase, in the foil gradient, `clamp(96px, 22vw, 280px)` at 600 with −0.03em tracking. It rises from 40px below, its opacity goes from 0 to 1 and its scale from 1.04 to 1 |
| 0.14 to 0.42 | The three meanings appear one at a time under it, in paper, `clamp(20px, 2.4vw, 28px)`. "Irish for a link." comes at 0.14 to 0.22, "A tie, a bond." at 0.24 to 0.32, "To link, to bind." at 0.34 to 0.42. Each rises 12px and lights from dim to full, and stays lit |
| 0.46 to 0.56 | **The cross-fade. It is never a morph.** "nasc" and the meanings fade and lift 24px. **NOSCA** fades in, in the card's tracked capitals, in the space the mark will sit above, so the spelling reads as *ours*, not as a derivation |
| 0.50 to 0.62 | "Nosca is our anglicised spelling of it: the link between a coach, a player and the family behind them." lights word by word under NOSCA |
| 0.58 to 0.88 | **The rings link.** Two whole gold circles come in from the left and right edges. They draw themselves on while they travel (0.58 to 0.70) and weave as they meet. The geometry is given below |
| 0.84 to 0.94 | The anglicised line dims away, and "Two rings, each passing through the other." lights in its place |
| 0.94 to 1.00 | **The scene holds on the card's front**: the olive ground, the stripes in two corners, the woven mark centred and NOSCA under it, with one line below. Then it releases |

**The weave, exactly.** All values are in the mark's units, viewBox
`0 0 40 25`.
- Each ring has radius r = 8.6 and a stroke of 2.75 with round caps. Its full
  circumference is C = 2π·8.6 = 54.035.
- The rings travel so that the distance between centres, d, goes from d₀ (each
  ring just off its edge of the stage) down to 12 (the mark). d follows
  `easeInOut(seg(p, .58, .86))`.
- Each ring is a full circle path that starts at its rightmost point and runs
  clockwise: `M cx+r cy A r r 0 1 1 cx−r cy A r r 0 1 1 cx+r cy`.
- When d < 2r = 17.2, the circles cross. The half-angle off the horizontal is
  h = acos(d / 2r).
  - The **left** ring's gap is centred at θ = +h, the bottom crossing (y points
    down). The right ring passes over there.
  - The **right** ring's gap is centred at θ = −(180° − h), the top crossing. The
    left ring passes over there.
- Each gap's half-width grows linearly from 0° to 11.5° as d goes from 17.2 to
  12. The gap length is g = 2·half·(π/180)·8.6, so at rest it is 3.452.
- Set `stroke-dasharray: (C − g) g` and
  `stroke-dashoffset: C − g/2 − 8.6·θ`, with θ in radians in [0, 2π).
- At d = 12, h = 45.759° and the dash equals `RING_L` and `RING_R` exactly. Swap
  in the real paths from `mark-gold.svg` there and finish on the true mark.
- The draw-on and the gap are written into one dasharray. Before the rings
  cross, the drawn length L runs from 0 to C as `dasharray: L C`. After they
  cross, it is the gap pattern above.

**Assets.** The pinstripe SVG, the mark's geometry
(`raw/mark-geometry.json`), and gold gradients for the SVG and for text.

**Reduce Motion.**
- Nothing is pinned. The band is about 160svh at rest.
- "nasc" is large, with the three meanings under it as three lines.
- Then comes the card's front: the woven mark in its real paths, NOSCA, and both
  lines. The stripes are in place.

## Scene 3: Story ("Built around one moment.")

**Length.** The section is 450svh. The heading "Built around one moment." rises
once, on entering.

| p | Beat | Picture | Words |
|---|------|---------|-------|
| 0.00 to 0.22 | **The founder's note** | No phone: white, full width | The bracketed note in large ink type, `clamp(28px, 4vw, 48px)`, lighting word by word (0.02 to 0.14). A gold rule draws (scaleX from 0 to 1, origin left, 0.12 to 0.16) above the signature, set as on the card's back: "Fionn Breathnach" in ink at 600, and "Founder" in grey under it |
| 0.22 to 0.48 | **One moment.** | The phone enters from the right on a desktop, or from below on a phone, with `coach-today-golf` (0.22 to 0.28). A tap ring lands on Register (0.34), then `coach-register` fades in over it with Present marked (0.38 to 0.42) | "One moment." and its line |
| 0.48 to 0.70 | **Built in daily cycles.** | The phone leaves, and **the cycle strip** takes its place. See the note below the table | "Built in daily cycles." and its lines |
| 0.70 to 0.88 | **Proven before it ships.** | The strip gives way to **1,554** in very large ink numerals, scrubbed up from 0 (0.72 to 0.82). Under it, Coach · Player · Parent · Junior light in turn (0.74, 0.77, 0.80, 0.83) | "Proven before it ships." and its lines |
| 0.88 to 1.00 | **The numbers row** | The four figures settle into one row (2 × 2 on a phone): **6** sports · **45** development cycles · **155** updates since September · **1,554** automated checks before each release. The figures are ink and the labels grey. The 6 and 155 count up once (900ms) as the row lands; 45 and 1,554 are already there | |

**The cycle strip.** It is one hairline spanning 53 days, 29 Sep to 20 Nov.
- 45 ticks sit **on their real dates** from `docs/cycles/`:
  - 29 Sep to 25 Oct, daily;
  - 31 Oct to 3 Nov;
  - 7 to 10 Nov;
  - 12 Nov;
  - 13 Nov twice, drawn as two ticks side by side;
  - 14 to 20 Nov.
- The gaps stay, because they are true.
- The ticks light from `#D9D9DE` to ink, left to right, as p passes them
  (0.52 to 0.66).
- "45" above the strip counts **in step with the lit ticks**.
- "29 Sep" and "20 Nov" sit at the ends in 13px grey.

**Assets.** `coach-today-golf.webp` and `coach-register.webp`. The strip and the
figures are HTML or SVG.

**Reduce Motion.** Four static blocks in order, then the numbers row:
- the note;
- "One moment." with `coach-register`;
- the strip, all lit, with 45;
- 1,554 with the four roles.

The numbers row shows its final values.

## Scene 4: For the coach

**Length.** The section is 500svh. Everything is golf. The phone is on the
right on a desktop, with the captions on the left; on a phone the caption sits
under it. Each caption crossfades with its screen.

| p | Beat | Screens and motion |
|---|------|--------------------|
| 0.00 to 0.24 | **A diary that tells people.** | `coach-diary-list`, then `coach-diary-calendar` (0.10), then the Call off sheet with Weather chosen (0.17, `coach-calloff`) |
| 0.24 to 0.46 | **Capture as it happens.** | The live camera (`coach-capture`). At 0.36 the shutter's ring turns red: a red ring drawn at the shutter's measured position crossfades in |
| 0.46 to 0.72 | **Draw on the swing.** | Mark it up, paused (`coach-markup`). A line and then an angle draw themselves on as SVG strokes over the clip (0.50 to 0.60), in the app's inks. At 0.62 it crossfades to Compare's two clips (`coach-compare`) |
| 0.72 to 1.00 | **Log a lesson in seconds.** | `coach-plus-golf`, with a tap ring on Log a lesson (0.76), then `coach-log-who`, a tap on Cian (0.82), then `coach-log-golf` with Chipping · Putting chosen (0.84), then a tap on Log it (0.90), then the Logged burst (`coach-logged`, 0.93) |

**The one moment.** The caption "Tap the player. Tap what you worked on. Log
it." lights *one sentence at a time with the three taps* (0.82, 0.86, 0.90).
The words and the finger move together.

**Assets.** These exist now: `coach-diary-list`, `coach-diary-calendar`,
`coach-plus-golf`, `coach-log-who` and `coach-log-golf`. To be shot, with a
fallback for each:
- `coach-calloff`. If it is not shot, the beat holds on the calendar.
- `coach-capture`, made with `capture.cjs`'s fake camera. If it is not shot,
  `coach-log-golf` scales to 1.6 about its Video · Photo · Voice keys, with a tap
  ring on Video.
- `coach-markup`. If it is not shot, use the clip area of `player-lesson` with
  the SVG line and angle drawn over it, flagged as a composite.
- `coach-compare`. If it is not shot, hold on markup.
- `coach-logged`. If it is not shot, hold on Log it.

**Reduce Motion.** The four beats as a list. Each beat is its caption beside
one phone at rest, showing its key screen: the calendar, the capture, the
markup, and the log with two areas chosen.

## Scene 5: For the player

**Length.** The section is 400svh. It is golf, and the same lesson as the
coach's.

| p | Beat | Screens and motion |
|---|------|--------------------|
| 0.00 to 0.28 | **Every lesson, kept.** | `player-feed`. The phone enters a touch larger (scale 1.04 to 1), because the feed is full-bleed. If `player-feed-2` is shot, one card-height upward slide inside the screen (translateY −100%, 0.18 to 0.22) is the flick to the next lesson |
| 0.28 to 0.52 | **Drills with a day.** | `player-drills` |
| 0.52 to 0.80 | **Progress you can see.** | `player-progress`. **The level line draws itself.** A white mask over the chart's measured box slides right (translateX 0 to 100%, 0.56 to 0.66) and uncovers the real line from 20.1 down to 15.8. Then `player-progress-attendance` (0.68), with the attendance discs uncovered the same way (0.70 to 0.76) |
| 0.80 to 1.00 | **A clip between lessons.** | The thread with the sent clip's card, "Open the clip" (`player-thread-clip`) |

**Assets.** These exist now: `player-feed`, `player-drills`, `player-progress`
and `player-progress-attendance`. To be shot:
- `player-feed-2`;
- `player-thread-clip`. If it is not shot, use `player-lesson` (the same clip's
  page, with Compare and Study).

The chart and attendance boxes are measured in % of 780×1688.

**Reduce Motion.** Four captions, each beside its screen at rest, with the line
and the discs complete.

## Scene 6: For the family

**Length.** The section is 400svh, with one fictional family from the demo data.

| p | Beat | Picture |
|---|------|---------|
| 0.00 to 0.30 | **Parents, in the loop.**, then **Under-18s.** (0.16) | Two phones side by side, a parent's (`parent-family`, p1-family) and a junior's (`junior-home`, j1-home), rising with a 0.03 stagger. On a phone they overlap at 80% of their width, and the active one comes forward (scale 1, the other 0.9 at 50% opacity) |
| 0.30 to 0.52 | **A parent's words are the parent's.** | The parent's phone crossfades to the child's thread (`parent-thread-child`, p6-thread-for-child), and a tap ring settles on "Orla · parent". The junior's phone steps back |
| 0.52 to 0.78 | **Each family's own thread.** | HTML, not a screenshot. One coach bubble appears at the top centre (0.54), in golf green with white words, in the app's bubble shape: 20px radius, an 8px tail corner and a 2px ledge. Three copies travel down into three small phone outlines (0.58 to 0.68, translate and scale only). Each outline carries the thread head of a different demo child (Saoirse, Cian, Róisín), and the bubble lands as the last line in each. The bubble's words are taken from the app's own seeded thread text, never written new |
| 0.78 to 1.00 | **Reminded once.** | A plain phone lock screen in HTML: a dark ground and "6:00" large. A notification slides down from above (translateY −120% to 0, 0.82 to 0.88): the mark on a bottle-green rounded square, "NOSCA · now", and "Saoirse's lesson tomorrow · 10:00 am" |

**Assets.** To be shot: `parent-family`, `parent-thread-child` and
`junior-home`. The polish-shots names exist in `scripts/e2e/polish-shots.cjs`.
Until they are shot, beats 1 and 2 use `coach-chat.webp`, whose Saoirse row
reads "Orla: …", with a ring on it. This is true from the coach's side.

**Reduce Motion.**
- The two phones at rest.
- The thread.
- The three small threads with the line already in each.
- The lock screen with the notification in place.

## Scene 7: Six sports. One app.

**Length.** The section is 420svh. The page stays white, as the app does.

| p | What happens |
|---|--------------|
| 0.00 to 0.08 | "Six sports. One app." rises, with "Each in its own colour, and in its own words." under it. Then comes the line moved from the story: "Levels and terms are checked against each sport's governing body. Nothing is invented." |
| 0.08 to 0.86 | Six windows of 0.13 each: golf 0.08, tennis 0.21, rowing 0.34, squash 0.47, padel 0.60, equestrian 0.73. In each, the phone crossfades to `coach-today-<sport>`. The six shots share one layout, so a crossfade reads as **a pure re-tint**: the mark, the Register key and the tab bar change and nothing moves |
| beside the phone | On a desktop, the six names stand in a column. The active one is in its colour at `clamp(40px, 6vw, 88px)`, with its glyph (`SportGlyph`'s SVG paths from Nosca.jsx) and its line under it in grey. The others are `#D9D9DE`. On a phone, one name sits under the phone and crossfades |
| 0.86 to 1.00 | The phone recedes (scale 1 to 0.9, opacity to 0). **Six tiles** rise in with a 0.015 stagger, three across (two on a phone), drawn as the app's SportGrid draws them. See the note below the table |

**The tiles.** Each one has:
- a face of the colour at an eighth over white,
  `color-mix(in srgb, C 12.5%, #fff)`;
- a 1.5px ring at 55%;
- a 3px ledge of the ring colour, made with `box-shadow: 0 3px 0`;
- 14px corners;
- the glyph and the name in the colour.

The six colours are golf `#207A30`, tennis `#01836E`, rowing `#1B74A1`, squash
`#C74B17`, padel `#6536B6` and equestrian `#8C2941`. Each line is the app's own
`SPORTS[x].tagline`.

**Assets.** `coach-today-{golf,tennis,rowing,squash,padel,equestrian}.webp`.

**Blocking.** `coach-today-equestrian` shows "Pony Club rally" at 5:00 pm, which
names an organisation the brief keeps off the page. Re-shoot it with the group
named as golf's is ("Thursday clinic"). Until then, the sixth window uses
`coach-log-equestrian`.

Do not use `coach-log-tennis` (WTN) or `coach-log-squash` ("Level 1410") anywhere.

**Reduce Motion.** The six tiles with their lines, then one row of six small
phones at rest (three across on a phone).

## Scene 8: Principles, then Partners

**Principles.** This part is pinned for 160svh, on white with no screenshots.
- "Professional." "Curated." "Specialist." sit one to a line at
  `clamp(48px, 9vw, 120px)` and light from dim to ink one at a time (p 0.10,
  0.35 and 0.60).
- A 2px gold rule draws under "Specialist." (scaleX from 0 to 1, origin left,
  0.70 to 0.85).
- Then the stage releases.
- The four lines follow in the flow, in two columns on a desktop and one on a
  phone. Each is a 20px title at 600 in ink with a 17px grey line, and each
  rises once at 85% of the viewport, staggered by 90ms.

**Partners.** This part is flow only.
- "Partners." and "Kept for the clubs and organisations who back Nosca." come
  first.
- Six empty frames follow, three across (two on a phone), at 3:2. Each is drawn
  as the app's card: white, a 1.5px `#E2E2E7` line, a 2px ledge and 14px
  corners.
- The gold mark sits centred in each at 14% opacity, with "[Partner]" in 13px
  `#8E8E93` under it.
- The frames rise once with a 70ms stagger.
- "To partner with Nosca: [contact email]" sits under them.

**Reduce Motion.** All three words in ink, the rule drawn, the lines and the
frames in place.

## Scene 9: Close ("In pilot, in Ireland.")

**Length.** The section is 260svh pinned, followed by about 100svh of flow. The
heading and its paragraph rise once, on entering. The stage carries
`perspective: 1400px`.

**The card.** It is the trim's own shape at 84:55, `clamp(280px, 56vw, 640px)`
wide.
- Its **front** is the same composition scene 2 ends on, which is the page's
  rhyme: olive, the stripes, the mark and NOSCA.
- Its **back** is white: the gold mark top left, NOSCA top right, the gold rule,
  "Fionn Breathnach" over "Founder", "Coaching, linked." over "One app for coach,
  player and parent.", the sports line, the code and "Scan to start".

| p | What happens |
|---|--------------|
| 0.00 to 0.15 | The card rises with a slight tilt, rotateX from 12° to 4° and rotateY from −8° to 0 |
| 0.20 to 0.65 | **It turns over:** rotateY from 0 to 180°, eased in and out, with the tilt easing to 0. The shadow under it scales across as \|cos θ\| |
| 0.66 to 0.74 | On the back, the gold rule draws itself (scaleX from 0 to 1) |
| 0.65 to 0.80 | The back rests flat to the screen. Here the card's transform is set to exactly `none` and its `will-change` removed, so the code is drawn crisp and scans |
| 0.80 to 1.00 | The card settles (scale 1 to 0.92, rising 4svh). The two buttons rise under it. **Open Nosca** is bottle green `#123C30` with white words, 52px tall, on a 4px ledge a third deeper. **Add to Home Screen** is a white key with an `#E2E2E7` ring on a `#D9D9DE` ledge. Pressed, either one sinks onto its ledge |

**The flow.**
- "Contact: [contact email]".
- The optional "[On the App Store: month]".
- The footer, which rises once: the mark · NOSCA · Coaching, linked. · the six
  sports · Designed in Ireland. · © 2026 [registered company name].

**The code.** It is live and generated at build time with the same library and
settings as the card: python `qrcode`, `ERROR_CORRECT_M`, version 3, border 0,
encoding `https://nosca-pilot-2.netlify.app/install`. It is drawn as vector
`<rect>`s in `#123C30`, with a white quiet zone of four modules added on screen,
and it is at least 132px across on a phone.

**Assets.** The QR SVG, the stripe SVG and `mark-gold.svg`.

**Reduce Motion.** Front and back side by side, as `preview-both.png` shows
them (stacked on a phone), then the buttons.

---

## The scroll engine (vanilla JS, no library)

### The markup contract

```html
<section class="scene" data-scene="name" style="--len:400">
  <div class="stage">             <!-- sticky; 100lvh -->
    <div class="frame"> … </div>  <!-- 100svh, padding-top: var(--hdr) -->
  </div>
</section>
```

### The CSS contract

These styles apply only under `html.motion`.

```css
.scene { position: relative; height: calc(var(--len) * 1svh); overflow-x: clip; }
.stage { position: sticky; top: 0; height: 100lvh; overflow: hidden; }
.frame { height: 100svh; padding-top: var(--hdr); }
@supports not (height: 1svh) { .scene { height: calc(var(--len) * 1vh); } .stage { height: 100vh; } .frame { height: 100vh; } }
```

- **The stage is `100lvh` and the frame `100svh`.** Neither changes when iOS
  Safari's toolbar shows or hides.
  - The stage always covers the screen.
  - The content always fits the visible part.
  - The scroll length is fixed, so progress never jumps.
- **Never use `dvh` for a stage.** It re-lays out during the scroll, and the
  element only catches up after the toolbar has settled (WebKit bug 266835).
- The **static layout is the default**. It is what a reader sees with no
  JavaScript, under Reduce Motion, and on a landscape phone.
  - A two-line inline script in `<head>` adds `motion` to `<html>` before first
    paint, unless `matchMedia('(prefers-reduced-motion: reduce)')` matches or the
    screen is shorter than 520px.
  - Only `.motion` gives a scene its tall height and the stage its stickiness,
    and puts elements in their "before" states.
  - If the script fails, the page is complete and readable.

### The core

```js
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const seg = (p, a, b) => clamp((p - a) / (b - a));           // a window of a scene
const smooth = t => t * t * (3 - 2 * t), easeOut = t => 1 - (1 - t) ** 3;

const scenes = [...document.querySelectorAll('.scene')].map(el => ({
  el, stage: el.querySelector('.stage'), top: 0, len: 1, vh: 1,
  p: -1, active: false, settle: false, render: RENDER[el.dataset.scene] }));
const byEl = new Map(scenes.map(s => [s.el, s]));

function measure() {                        // the ONLY place that reads layout
  const y = scrollY;
  for (const s of scenes) {
    s.top = s.el.getBoundingClientRect().top + y;
    s.vh  = s.stage.offsetHeight;           // 100lvh in px: stable
    s.len = Math.max(1, s.el.offsetHeight - s.vh);
    s.render.measure?.(s);                  // FLIP rects, chart boxes, tap points
  }
  frame(true);
}

let queued = false;
const request = () => { if (!queued) { queued = true; requestAnimationFrame(() => frame(false)); } };
addEventListener('scroll', request, { passive: true });

function frame(force) {
  queued = false;
  const y = scrollY;                        // one read; nothing else is read here
  for (const s of scenes) {
    if (!force && !s.active && !s.settle) continue;
    const p = clamp((y - s.top) / s.len);
    const enter = clamp((y - (s.top - s.vh)) / s.vh);        // the scene rising into view
    const exit  = clamp((y - (s.top + s.len)) / s.vh);       // and leaving
    if (force || s.settle || Math.abs(p - s.p) > 1e-4 || enter < 1 || exit > 0) {
      s.p = p; s.render(p, enter, exit, s);                   // writes only
    }
    s.settle = false;
  }
  header.classList.toggle('dark', y + 26 >= band.top && y + 26 < band.top + band.len + band.vh);
}

const io = new IntersectionObserver(es => {
  for (const e of es) {
    const s = byEl.get(e.target);
    s.active = e.isIntersecting;
    if (!s.active) s.settle = true;         // a fling past it still lands on 0 or 1
    s.render.warm?.(s.active);              // decode() its images, set or clear will-change
  }
  request();
}, { rootMargin: '50% 0px 50% 0px' });
scenes.forEach(s => io.observe(s.el));
```

### When to measure

Measure on:
- `DOMContentLoaded`;
- `document.fonts.ready` (Instrument Sans changes line heights);
- `load`;
- a `ResizeObserver` on `document.body`, which fires on real layout changes
  only. It never fires for the toolbar, because nothing is sized in `dvh` or
  `vh`;
- `resize`, **only if `innerWidth` changed**. iOS fires `resize` when the
  toolbar toggles, and those events are ignored;
- `orientationchange`, two frames later.

The work is debounced with one rAF. Measuring calls `frame(true)`, so a reload
in the middle of the page, or an anchor jump, renders every scene at its true
progress at once.

### Each scene's renderer

A renderer is a pure `(p, enter, exit) → writes` built from four helpers.
- `stack(screens, steps)` sets the incoming screen's opacity to
  `smooth(seg(p, a, a + w))` over the outgoing one, and hides the outgoing one at
  1.
- `tap(ring, at)` handles the tap ring.
- `light(words, a, b)` toggles `.on` when a word's threshold is crossed. It
  touches only the words whose state changed.
- `draw(path, t)` sets `stroke-dashoffset = 1 − t` on `pathLength="1"`.

A renderer writes `el.style.transform`, `el.style.opacity` and
`style.strokeDashoffset`. It never writes to a large subtree's inherited custom
property every frame, because that recalculates style for every descendant. If
`--p` is used, it goes on a leaf element.

### One-shot reveals

- A separate IntersectionObserver with `rootMargin: '0px 0px -15% 0px'`
  adds `.in` and unobserves the element.
- CSS **transitions** animate from the before state to `.in`. They are not
  keyframes with `fill-mode: both`, which would pin the end frame over the
  element's own style, as the app's notes record.
- Count-ups run once, over 900ms with easeOut, from the final value already in
  the HTML. The script sets the figure to 0 only when motion is on.
- Numbers are formatted with `toLocaleString('en-GB')`.

### Reduce Motion while the page is open

A `matchMedia(...).addEventListener('change')` toggles `html.motion` and calls
`measure()`. The renderers' final frames match the static layout, so the switch
is seamless.

### Pitfalls the engine avoids

- **Sticky breaks under a scrolling ancestor.**
  - `overflow: hidden`, `auto` or `scroll` on any ancestor of `.stage` (`main`,
    a wrapper, or `body`/`html` with `overflow-x: hidden`) makes that ancestor
    the scroll container, and the stage never sticks.
  - Use `overflow-x: clip` on `.scene` for sideways overflow, because it creates
    no scroll container. The stage's own `overflow: hidden` is safe.
  - Never put the stage in a flex or grid parent that stretches it to the
    section's height. `.scene` is a plain block, and the stage has an explicit
    height.
- **Progress from cached numbers only.** `window.innerHeight`, `clientHeight`
  and `getBoundingClientRect` are never read in the frame. On iOS,
  `innerHeight` changes with the toolbar and would make progress jump. Reading
  layout after a write forces a synchronous layout on every frame, which is
  layout thrash.
- **One rAF per frame, a passive listener, no work in the scroll handler.**
  - Do not lerp or smooth the progress. It lags, floats, and lands wrong on a
    fast fling.
  - Do not hijack the scroll. There is no wheel smoothing, no
    `scroll-behavior: smooth` on `html`, and no `scroll-snap` in a scrubbed
    scene. Native momentum is what makes it feel right on an iPhone.
- **Flings.** A scene can enter and leave between two frames. The `settle` flag
  renders its clamped end state once, so nothing is left half-way.
- **The IntersectionObserver's job is only waking.** Its 50% rootMargin wakes a
  scene half a screen before it appears, so its first visible frame is already
  right. Step timing comes from progress, never from thresholds, which fire
  unreliably on fast scrolls.
- **The image and layer budget on iOS.**
  - Each 780×1688 shot decodes to about 5.3MB, and 34 shots would be about
    180MB.
  - `warm(true)` calls `img.decode()` on the scene's screens and sets
    `will-change: transform, opacity` on the few moving elements.
  - `warm(false)` clears it.
  - Do not put `loading="lazy"` on an image in a pinned stage, because it would
    load at the moment it fades in. Give every image its `width` and `height`.
- **3D (the card).**
  - `transform-style: preserve-3d` is flattened by `opacity < 1`, `overflow`,
    `filter`, `clip-path` or `mask` on the 3D container. Put fades on a wrapper
    outside it.
  - Each face needs `-webkit-backface-visibility: hidden`, and the back face its
    own `rotateY(180deg) translateZ(.5px)` against z-fighting at 90°.
  - At rest, the transform is `none`, so Safari re-rasterises the code sharply.
    Never scale a rasterised layer above 1.
- **Text.** Words are split at build time, so screen readers read whole
  sentences. Hidden captions stay in the DOM in reading order. The decorative
  copies (the flying mark, the stripes, the tap rings) carry `aria-hidden`.
- **No blur anywhere.** There is no `backdrop-filter` and no animated `filter`.
  This is the app's rule, and it is also the most expensive thing to scrub on a
  phone.

---

## Assets: what exists, what to shoot

**In `assets/` now**
- `coach-today-*` for all six sports.
- `coach-log-golf`, `coach-log-rowing` and `coach-log-padel`. The tennis log
  shows WTN, so leave it out, and leave out the squash log ("Level 1410").
- `splash-*` for all six sports, which are not used: the page stays white.
- `coach-plus-golf`, `coach-log-who`, `coach-register`, `coach-diary-list`,
  `coach-diary-calendar` and `coach-chat`.
- `player-feed`, `player-lesson`, `player-drills`, `player-progress` and
  `player-progress-attendance`.
- `mark.svg` and `mark-gold.svg`, plus `raw/mark-geometry.json`.

**To shoot against the mock, in golf unless noted**

| Asset | What it shows |
|-------|---------------|
| `coach-calloff` | Weather chosen |
| `coach-capture` | Fake camera, VIDEO, Grid on |
| `coach-markup` | A line and an angle on a paused clip |
| `coach-compare` | Two clips |
| `coach-logged` | The burst |
| `player-feed-2` | The next feed card |
| `player-thread-clip` | The thread with "Open the clip" |
| `parent-family` | p1-family |
| `parent-thread-child` | p6-thread-for-child |
| `junior-home` | j1-home |
| `coach-today-equestrian` | The group named "Thursday clinic" |

**Made at build**
- The QR SVG.
- The pinstripe SVG.
- The `SportGlyph` paths copied from `src/Nosca.jsx`.
- The phone shadow.
- The lock screen, the three family threads and the coach bubble, in HTML.

## References

The scroll-scene pattern was studied through web search. apple.com and
css-tricks.com could not be reached from this machine, so no page source was
read. What is said here about Apple's pattern is the published reverse
engineering, not Apple's code.

- "Let's Make One of Those Fancy Scrolling Animations Used on Apple Product
  Pages", CSS-Tricks, via search and its mirror at
  https://multizone.cz/devfeed/let-s-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages-6b47c85d.html.
  It covers the scroll fraction mapped to a frame index, drawing in
  requestAnimationFrame, and preloading.
- "Building an Apple-style Scroll Experience (Like the MacBook Neo Page)",
  https://ddingpy.github.io/mynote/posts/building-an-apple-style-scroll-experience-like-the-macbook-neo-page.
  It covers a tall scene, a 100vh sticky stage, and progress from 0 to 1
  driving transforms, opacity and text steps.
- "How to make 3D animation effect (like AirPods website) as you scroll the
  page", https://setproduct.com/blog/how-to-3d-animate-scroll.
- The Pudding:
  - "Introducing Scrollama", https://pudding.cool/process/introducing-scrollama/
    (IntersectionObserver in place of scroll math);
  - "Scrollytelling sticky", https://pudding.cool/process/scrollytelling-sticky/
    (CSS sticky in place of JavaScript pinning; the side-by-side and overlay
    layouts);
  - "How to implement scrollytelling with six different libraries",
    https://pudding.cool/process/how-to-implement-scrollytelling.
- "How to Create an Apple-Style Text Reveal on Scroll",
  https://framer.university/blog/how-to-create-an-apple-style-text-reveal-on-scroll.
- WebKit Bug 266835, "dvh causes scroll jank as the address bar resizes when
  scrolling", https://bugs.webkit.org/show_bug.cgi?id=266835.
- Ahmad Shadeed, "New Viewport Units", https://ishadeed.com/article/new-viewport-units/
  (svh, lvh and dvh).
- Builder.io, "View timeline", https://www.builder.io/blog/view-timeline. This
  is CSS scroll-driven animation, which is not used here because support is
  still uneven across browsers.
