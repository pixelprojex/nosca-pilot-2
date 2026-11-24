# Nosca's website — the brief (read this first; it is the single source of truth)

Workspace: this folder (`web2/`). Everything you make lives here. Never edit the app repository at /home/user/nosca-pilot-2 (read it freely: CLAUDE.md in your context is the product's truth).

## 1. The founder's words (the client; hold every decision to these)

First draft, 21 Nov: "The website will say a lot about us as a company … really go into the backstory … where the name come from … the anglicized spelling of the Irish word for linking … how this story came to be, how we developed it … examples of the product … space for our sponsors … very, very good … but very simple … look at the Apple website … This dynamic style where when you scroll down, the text appears, or … you're brought to a certain animation and it's like you're in a video game … a sublime demo … to show to our shareholders."

On that first draft, 22 Nov (THIS is what you are answering):
- "the name came from the Irish word nosca, which means linking. You said nosc. That's not where it came from."
- "I love that it matches the business card. That's all great. Also, please match the dark version of the business card, as I'm printing both. So match that on a different page maybe."
- "I want much more animations, much more fluidity. I want much more motion. I want you to take the calm effect from the Apple website … this dynamic style of advertising is so important, and I really need you to amplify that and … hone in on the specific small details."
- "this site must be completely comprehensive."
- "I'm loving the sample phone screens as well, but just overall, the visuals just don't cut it for me."
- "don't overcomplicate it. Keep it classy, keep it professional, and keep it down to the main ethos of our brand."
- "maybe mention things like climate, like we support climate action, etc."
- "it needs to be stunning. The dynamics are so important. The way it moves, the way the screens pop up, the animations, the flowing element, the fluidity, the calm element, the color schemes, the professionalism."
- "get this website launched, separate to the app … through Netlify."
- **And on colour, the same evening, about the first draft AND the app: "WOW! That's way too colourful. Not cohesive or classy."** (See "Colour discipline" in §3: it overrides anything colourful elsewhere in this brief.)
- And the brand (18 Nov): "We don't stand for cheap apps … AI … tacky apps. No. We stand for something of a professional, something established, something curated, something specialist."

So: the first draft's structure was right but it moved in steps (class toggles at thresholds), sat in a lot of white with small phones and captions, and showed square-bracket placeholders. The rebuild is FLUID (scrubbed, continuous, layered), CALM (slow eases, one thing moving at a time), bigger and more cinematic, rich in small finished details, and still simple to read.

## 2. Truth rules (non-negotiable)

- The name (THE FOUNDER'S FINAL WORD, 23 Nov, 17:00 UTC; it replaces every earlier line about the name in this brief): **"it is an anglicized spelling of the Irish word nascadh, which means linking."** So the short line under the name is "From the Irish <i lang="ga">nascadh</i>, linking." and the long form is "Nosca is an anglicised spelling of the Irish word <i lang="ga">nascadh</i>, which means linking." Print *nascadh* exactly so (lower case, set apart as a foreign word). NEVER "nasc" on its own, never "The Irish for linking" as if Nosca were itself the Irish word; never invent an etymology or a pronunciation key.
- Never invent a fact about the company: no founding story, team, user numbers, funding, awards, partner names, testimonials, quotes, pledges or certifications. Facts come from CLAUDE.md and `reference/brief-facts.md` (every number there has a source). Use these rounded forms: **6 sports · 45 development cycles (29 Sep to 20 Nov 2026) · 150+ updates since September · 1,500+ automated checks before each release · 4 roles (coach, player, parent, junior)**.
- No visible placeholders anywhere (no square brackets, no "lorem", no "coming soon"). If a fact is missing, leave the element out. The contact email is not known yet: read it from `site.config.json` (`contactEmail`); when it is empty, the contact line does not render.
- Climate: the founder's statement is "We support climate action." You may add only what the product truly does: lesson notes, registers and reports are digital, never paper; a weather call-off tells everyone affected before they travel. No pledge, percentage, partner or offset claim.
- Partners/sponsors: elegant empty frames for future partners. No logos, no names, no tiers with prices. No pricing anywhere.
- People shown on screens are the app's demo data; the footer says "Screens show the app with its demo data. The names are fictional." The founder's name appears only as on his printed card: "Fionn Breathnach · Founder".
- Copy voice: plain, confident, short. British/Irish spelling. Active voice. No hype, no exclamation marks, no em-dash asides, no "not X but Y", nothing that sounds machine-written. A headline is a few words; a paragraph is one or two short sentences. Less text than you think.
- App links: `https://nosca-pilot-2.netlify.app/` (Open Nosca) and `https://nosca-pilot-2.netlify.app/install` (Add to Home Screen), from `site.config.json` (`appUrl`).

## 3. The brand world

Two printed business cards (see `reference/card-olive.png` and `reference/card-dark.png`): the FRONT is a solid ground — olive `#4F5B29` on one card, deep bottle green `#123C30` on the other — with fine gold pinstripes in two opposing corner wedges (top-right, bottom-left), the woven two-ring mark in gold and NOSCA tracked wide in gold. The BACK is white: gold mark, NOSCA in gold, a gold rule, "Fionn Breathnach / Founder", "Coaching, linked. / One app for coach, player and parent.", a QR code, "Golf · Tennis · Rowing · Squash · Padel · Equestrian". Gold is foil on the real card.

Tokens (define once in `site.css`):
- olive `#4F5B29` · olive-deep `#3E4820` · green `#123C30` · green-deep `#0A251D`
- gold `#C2A24C` · gold-hi `#E9CF7E` · gold-lo `#B08630` · pinstripe `#CDB065` · on-dark `#F4F6F3` · on-dark-2 `#DADED2`
- paper `#FFFFFF` · ink `#1C1C1E` · sub `#5F5F65` · faint `#6E6E73` · hair `#EBEBF0` · edge `#E2E2E7` · ledge `#D9D9DE` · wash `#F2F2F7`
- the app's club colours and the six sports' leads: see "Colour discipline" below (CSS variables `--club-*`)
- Type: display = "Instrument Sans" (self-hosted, `fonts/`, weights 400/500/600); text = the system UI stack (SF on an iPhone). Big, tight display type; wide-tracked small caps for NOSCA and eyebrows.
- The mark: two woven rings, viewBox `0 0 40 25`, paths `M18.651 19.734 A 8.6 8.6 0 1 1 21.108 17.341` and `M21.349 5.266 A 8.6 8.6 0 1 1 18.892 7.659`, stroke 2.75, round caps. `reference/first-draft/main.js` has working maths for two whole rings travelling together and weaving (the gaps opening at the crossings), and `src.html` has the card's exact pinstripe geometry, the QR (`qr.svg`, opens /install) and the cycle ticks (`ticks.svg`). Reuse what is good in them.
- The app itself (the screenshots in `assets/`, listed in `assets/MANIFEST.json`): white, one saturated colour a sport, 3D keys on ledges (a key sinks onto its ledge when pressed), cards with 1.5px `#E2E2E7` lines and a 2px ledge, 14–16px corners. The site's own buttons are those keys.

**Colour discipline (non-negotiable; UPDATED late on 22 Nov with the founder's final word on colour — it replaces every earlier colour instruction, including "one green"):**
In one day he rejected three things: ten bright hues ("way too colourful. Not cohesive or classy"), everything in one green ("I do want variation in colors. I don't want all the same green"), and bright modern colour itself ("the green is … so like in your face and modern … it's not classy, it's not traditional"). What he wants: the business card's world — deep, traditional, cohesive colours, WITH variation, "different buttons are different colors, different functions", the way his Lares app does it with eight hues that share one tone. So:
- The site's own palette is the card's: the world's ground (olive `#4F5B29`, or dark green `#123C30`), gold, white, ink and the greys.
- The app is shown in its **club colours**: one family of traditional tones at the card's own depth (white reads on every one; the gold alone carries a dark glyph). Golf's set, which the vignettes use: lead **fairway `#285937`** (keys, ticks, what is chosen, progress), then **olive `#4F5B29`, navy `#213654`, saddle `#765637`, plum `#5F3954`, claret `#6B2935`, bottle `#123C30`, gold `#C2A24C`, slate `#48555C`**, and **brick `#9A322A`** for a Call off. In a vignette the functions differ in colour: Register fairway, Capture navy, Tip gold, Drills plum, Add player olive, New group bottle, Competition claret, Call off brick; faces with white initials take fairway, olive, navy, saddle, plum or claret by person. Never a bright or saturated colour (never `#207A30`, never a pure red, blue, orange or purple).
- The six sports' leads (one family, so they sit together): golf fairway `#285937` · tennis court `#125856` · rowing river `#264A70` · squash sienna `#844925` · padel aubergine `#4D3566` · equestrian claret `#6B2935`. In the six-sports moment they appear inside the phone's screen as it re-tints, and may also stand together as a quiet row of six small swatches or key-shaped chips. Still no coloured grounds, bands or floods, and no coloured headings: a sport's name is in ink (or on-dark).
- **THE LIGHTER HALF (23 Nov, 05:00 UTC — the founder's newest word, and it applies to the site as much as the app):** "those colors are beautiful and all, but I also want some more lighter tones throughout so it doesn't feel too dark and heavy, especially if somebody's using it with the black background … please ensure that the website is fully complete." So every club colour now has lighter relations, made on its own hue, and the lead owns them in ONE file, `src/css/palette.css` (variables only; already written; never edit it — tell the lead): for each of the twenty colours `--club-<name>` (the deep cloth), `--club-<name>-tint` (its PALE: sage, duck egg, stone blue, heather, plaster, straw — a heritage pastel with grey in it), `--club-<name>-lip` (the pale's own ledge), `--club-<name>-mid` (its CLOTH tone, lightness 0.76: what the colour becomes on a dark ground) and `--club-<name>-ink` (what is drawn on the pale: the deep colour itself; the gold's is a deeper gold). **The rule, in the app and on the site: what acts is deep (the one action, a key, a badge); what labels is pale with the deep colour as its ink (a glyph tile, a face with no picture, a chip, a chosen state, a quiet panel behind a vignette).** In a vignette the plus sheet's eight glyph tiles and a Settings row's tile are therefore PALE faces on their own lip with the DEEP glyph (Register `--club-fairway-tint` + fairway glyph, Capture navy's, Tip gold's with `--club-gold-ink`, Drills plum's, Add player olive's, New group bottle's, Competition claret's, Call off brick's); faces with no picture are a pale disc with deep initials; the one action stays the deep lead with white words. **The page must feel light:** white first, generous air, the pales as soft panels and chips where colour is wanted; deep grounds (olive, dark green) stay the two card worlds and are used with restraint, never stacked one after another down a page. **On a dark ground (the Story world, the footer, the dark card) never put a deep club colour** — it sinks; use the gold, white, and the `-mid` and `-tint` tones.
- Put every club colour in `site.css` as a CSS variable (`--club-fairway`, `--club-navy`, …) and use only those, so the lead can tune them in one place.
- The screenshots in `assets/` still show the app's old bright colours; the lead re-shoots them in the club colours under the same filenames before launch. Build against the filenames.

Worlds: **Home lives in the OLIVE card's world. The Story page lives in the DARK GREEN card's world** (that is the founder's "match the dark version … on a different page"). Product and Partners are white pages with olive and gold as their only accents. Each world: its ground for hero and footer bands, its card object (front and back), gold details.

## 4. The site (four pages, one system)

Shared chrome: a slim fixed header (the gold/ink mark at left that weaves on hover; links Product · Story · Partners; an "Open Nosca" key at right; on phones a calm full-screen menu), a footer in the page's world ground with pinstripes, the mark, NOSCA, "Coaching, linked.", the six sports, the small print (© 2026 Nosca · Made in Ireland · the demo-data line · "This site sets no cookies and collects no data."). Cross-page View Transitions (`@view-transition { navigation: auto }`) with the header mark shared, so pages glide into each other.

### Home (`index.html`, olive)
1. **The card opens the site.** The first screen IS the olive card front, full-bleed: pinstripes draw in line by line, the gold rings draw and weave, NOSCA settles, then "Coaching, linked." and "One app for coach, player and parent." As you scroll, the camera pulls back: the olive field becomes the physical card on a white table (rounded corners, soft shadow, a foil sheen sweeping across the gold as it tilts), it turns over to its white back, and the white back grows until it IS the page. (If a perfect morph is fragile, any robust version of "the hero becomes the card, the card turns, the page begins" is fine. It must be smooth on a phone.)
2. **The product arrives.** A large phone rises with a slow 3D settle (the coach's Today), then five to seven app screens fan out from behind it like a hand of cards and settle into an arc or a row ("the way the screens pop up"). One line of copy.
3. **Coach · Player · Family.** Three chapters in one pinned, flowing scene: for each, a phone with two or three screens crossfading/sliding and one or two small live vignettes built in HTML (see §5). Each ends on a quiet link to its part of the Product page.
4. **Six sports, one app.** The page stays white and calm; the phone holds still while its screen re-tints through the six sports one at a time (the six `coach-today-*.webp`, a soft crossfade or a wipe), the sport's name large in ink beside it with a small dot of its colour, its own words under it in grey (golf: full swing, short game, on course · tennis: serve, return, rally, net · rowing: technique, rhythm, racing, erg · squash: drives, volleys, front court, movement · padel: net game, overheads, walls · equestrian: flatwork, poles, jumping, cross-country). "Levels and terms are the ones each sport's governing body uses."
5. **The name.** Olive band, pinstripes: "Nosca." very large in gold, "The Irish for linking.", then two rings travel in from the edges and weave into the mark as you scroll: "A coach, a player and a family, linked." Link: The story.
6. **What we stand for.** "Professional. Curated. Specialist." lighting word by word; four short principles (coach and player side by side · fewer taps · the coach's own words · nothing pretends); the numbers counting up once.
7. **Climate.** A calm, short band: "We support climate action." and the two true product notes.
8. **Partners.** A row of empty partner frames with a foil sheen on hover; "Partner with Nosca" link to the Partners page.
9. **Close.** "In pilot, in Ireland." Open Nosca · Add to Home Screen, the QR code, then the olive footer.

### Product (`product.html`, white, olive and gold; the app in its club colours; the comprehensive tour)
Hero: "Built around the lesson." with three phones (coach, player, parent) arriving in depth. A sticky chapter bar (Coach · Player · Family · Sports · Everywhere) that tracks the scroll. Chapters, each a mix of pinned phone scenes and a bento grid of live vignettes:
- **Coach:** log a lesson in seconds (Who → tap what you worked on → Log it; make this a small INTERACTIVE demo the visitor can tap); capture video, photo, voice as it happens; mark up a clip (lines, angles, drawn over the picture) and compare two clips side by side; the diary, hours and days away; call off for weather and everyone is told; the register; groups; drills with a day; tips.
- **Player:** every lesson kept (the lesson page, the feed); drills that arrive with a day and a reminder at the hour you choose; progress you can see (level over time, attendance); log a practice; send a clip to your coach; downloads that play offline.
- **Family:** a parent books and answers for a child; an under-18's own account; a parent's words are labelled the parent's; a coach's group message lands in each family's own thread (no family reads another's); a reminder the evening before.
- **Sports:** the six, each with its real ladder (tennis: Red, Orange, Green, Yellow ball then WTN · golf: Handicap Index · rowing: J13 to J18, Novice to Senior · squash: the ball's dot · padel: levels 0 to 7 · equestrian: Pony Club tests and riding-school stages) and its own words.
- **Everywhere:** adds to the Home Screen on iPhone, Android and computer; opens offline on its kept copy; notifications; lessons into the phone's calendar.
Close with the CTAs.

### Story (`story.html`, the DARK GREEN card's world)
1. Hero in dark green with gold pinstripes: "Nosca." "The Irish for linking." The rings weave. The dark card itself appears and turns.
2. **One moment.** "A coach picks up the phone mid-lesson, does one thing in seconds and puts it down. Every coach screen is judged against it."
3. **How it was built**, as a flowing horizontal timeline you scroll through: 2 Sep 2026 the first commit · 19 Sep rebuilt around one behaviour · 29 Sep daily development cycles begin · every morning: research, build, test, ship · 13 Nov the visual sprint · 21 Nov the app redrawn in white, with each sport's own colour. (Only these facts; the 45 ticks in `ticks.svg` are the real cycle days.)
4. **Proven before it ships.** 1,500+ automated checks drive the app as a coach, a player, a parent and a junior; a crawl taps every control and fails on any that does nothing.
5. **Every sport in its own words.** Terms and levels verified against each sport's governing body, never invented.
6. **What we stand for** (fuller than Home) and **Climate**.
7. **Made in Ireland.** The pilot is in Ireland, in English. Close with the dark card's back and the CTAs.

### Partners (`partners.html`, white + olive)
Hero: "Partners." A graceful wall of empty frames reserved for partners and sponsors (the mark faint inside each, a slow sheen), a short "Why Nosca" in three true lines (six sports in one app · coach, player and family in one place · built and piloted in Ireland), the Climate band, and the contact line (only if `contactEmail` is set), then the CTAs.

## 5. Motion (the heart of the job)

Feel: Apple's product pages. Calm and continuous. Things glide into place and rest. Nothing bounces, flashes or jitters. One focal movement at a time. Text never moves while you are reading it.

Stack (already vendored in `vendor/`, self-hosted, no CDN): **GSAP 3.13 + ScrollTrigger + SplitText** and **Lenis** smooth scroll (desktop wheel inertia; native touch scrolling on phones). Use ScrollTrigger pinning and `scrub` (0.6–1.2) for scenes, so motion follows the thumb and can be scrubbed back and forth; use time-based reveals (0.9–1.2 s, ease `cubic-bezier(.22,1,.36,1)` / power3-4.out, 60–100 ms stagger) for text and tiles entering.

Vocabulary to build once and reuse everywhere (the foundation documents the exact API in `API.md`):
- Headline/paragraph reveals by line with masks (SplitText lines sliding up out of overflow-hidden), words that light from dim to full as you pass.
- Sheets: sections are full-bleed "cards" with large rounded top corners that slide up over the previous one (the site is a stack of card stock). Grounds flow between white and the world's own ground (olive or dark green), never a sport colour.
- The phone: a drawn device (CSS, no logos), big. It enters with a slow 3D settle (rotate/translate in perspective), casts a soft shadow that follows its tilt, and has one glass sheen sweep. Screens inside crossfade, slide, or pan. Screens also live outside the phone as cards that fan, stack and deal.
- Live vignettes (small scenes rebuilt in HTML/SVG in the app's own style, animated when in view, looping calmly or scrubbed): the register's Present ticks landing; a drill ticked off; the progress line drawing itself; chat bubbles arriving on their ledges; the plus sheet rising with its eight tiles; a download ring filling to a tick; a call-off notice reaching three phones; the next-lesson card. These are the "specific small details".
- Gold: pinstripes that draw in line by line; a foil sheen (a moving highlight in the gold gradient) on the mark, NOSCA and the card as they tilt or as the pointer moves.
- The rings: drawn, travelling, weaving; a recurring quiet motif (large, faint, drifting behind sections).
- Keys: the app's 3D buttons (a ledge; pressing sinks). Magnetic pull and tilt-with-sheen on hover for desktop only; nothing may depend on hover.
- Counters that count up once; the cycle ticks lighting in order.
- Parallax depth on layered elements; subtle, never queasy.

Hard requirements:
- Phone first (the founder reads on an iPhone): perfect at 390×844 and 320×640, then 768 and 1440. Never a horizontal scroll. Pinned scenes sized in `svh`/`lvh`, `ScrollTrigger.config({ ignoreMobileResize: true })`, no jump when Safari's bars move.
- 60 fps: animate transform and opacity only; no layout thrash; images decoded before they are shown; lazy-load below the fold; `will-change` only while moving.
- Complete without motion: with `prefers-reduced-motion`, or JS off/failed, every page reads fully, every scene in its finished state (no opacity:0 leftovers). First paint is composed (no blank flash before JS).
- Accessible: semantic headings, alt text, visible focus, 4.5:1 text contrast (gold on olive/green is for large display type and ornaments only; body on dark is on-dark `#F4F6F3`), no text under 12px, 44px hit areas.
- Static and relative: every URL in the built pages is relative (`css/…`, `assets/…`, `story.html`) so the same `dist/` works at a domain root or under `/about/`. No third-party requests at all (no CDNs, no Google Fonts, no analytics).
- Weight: each page under ~2.5 MB on first load; fonts are ~28 KB each; reuse the screenshots in `assets/` (780×1688 WebP). You may crop/resize copies into `assets/` with ImageMagick/PIL; never fake a screen.

## 6. Structure and ownership

```
web2/
  BRIEF.md  API.md (foundation writes)  site.config.json
  vendor/  fonts/  assets/  reference/
  src/partials/ (head, header, footer)   src/pages/*.html
  src/css/site.css   src/css/<page>.css
  src/js/site.js     src/js/<page>.js
  build.mjs  → dist/  (index.html product.html story.html partners.html css/ js/ vendor/ fonts/ assets/)
```
The **foundation engineer** owns `build.mjs`, the partials, `site.css`, `site.js`, `API.md`, `index.html` + `index.css/js`, and `partners.html` + its css/js. The **product engineer** owns `product.*` only; the **story engineer** owns `story.*` only. Page engineers never edit shared files: if you need something shared, build it in your page's files and say so in your report.

## 7. Working rules (credits are tight; waste nothing)

- If files already exist in your area, continue from them; never start over.
- No web research. No reading the app's 22k-line source: `assets/MANIFEST.json`, CLAUDE.md (in your context) and `reference/` are enough.
- Test with Playwright (`require(process.env.PLAYWRIGHT_MODULE)`, `PLAYWRIGHT_MODULE=$(npm root -g)/playwright`, `chromium.launch()`): serve `dist/` with `python3 -m http.server <your port> --bind 127.0.0.1` (kill it after). Check scripted: no console errors, no failed requests, `scrollWidth === innerWidth` at 320/390/768/1440, reduced motion (everything visible), JS disabled (everything visible). Step down the page and assemble **contact sheets** with ImageMagick `montage` (10–12 frames a sheet at about a third size) and read those — at most about 15 image reads in total. The machine is shared (other test suites are running): one browser at a time.
- Be your own harshest critic against §1 before you stop: is it stunning, fluid, calm, classy, simple, true?
- Final report: short. What you built, the checks with results, the contact sheets' paths, anything the lead must know.
