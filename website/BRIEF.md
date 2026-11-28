# Nosca's website — the brief (read this first; it is the single source of truth)

Workspace: `website/` in the app's repository. Everything the site is lives here and nothing here touches the
app (read the app's `CLAUDE.md` freely: it is the product's truth). `API.md` is how to build on the foundation;
`KEYS.md` is how the app's own keys are drawn inside a vignette.

## 0. The latest words, on top of everything below (24 and 28 Nov)

- "there's a bit too much focus on the business card … keep the business card design rather than having the business card itself repeated loads of times … I do love the business card design, so keep that consistent throughout." So the card as an object stands only at the pilot; elsewhere the site speaks the card's language (its deep green, white, gold lines, the mark and NOSCA).
- "our original design for the business cards was the darker color with the vertical lines, not diagonal lines … both have the same diagonal lines." The deep green card is the first print file: stripes across its top and foot and a clear band through the middle. The olive keeps its two corner wedges. On the deep green ground the site's stripes are the band.
- "I kind of want it all on one page … get rid of the partners page … Keep the story, that is great." One page: the opening, the product, the six sports (once: "why is it duplicated?"), the story, the pilot. No partners page, no partner frames.
- "cut down on text where possible … very short lines, minimize text … Don't make it look like AI, don't make it look tacky … extremely visually appealing, but also must be easy to navigate … simplify." A headline is a few words, one short line under it at most.
- The footer was "very messy": now one aligned column, the sports on two balanced lines, no card in it.
- On the phone, scrolling was "vibrating and shaking … every time I stop, it glitches … one tiny touch, you end up missing loads of information", and on 28 Nov: people "felt they had to be constantly scrolling to use it, and that if they stopped scrolling, everything just started shaking and vibrating … the visuals look very nice, so continue absolutely intense work … Make sure everything is comprehensive, everything is cohesive, everything is classy, everything is professional, and everything comes back down to our ethos." So: **nothing pinned and nothing tied to the scroll, on any device** (no ScrollTrigger, no Lenis); every piece plays once on its own clock as it arrives; a short page (about eight phone screens) with Product · Story · Pilot in the header.
- "improve some of the stock images, and have more stock videos": the gloved grip is gone; four short loops stand in the sports (a golf swing, a serve, rowing on flat water, a rider's stirrup). "for some of the sample screens … there are like drone shots … I want it all to be super accurate": `tools/fixtures/` holds licensed side-on coaching clips for the re-shoot of the app's screens.

§3.D and §4 below describe the film engine and the four pages of the earlier rounds; where they say otherwise, this section wins.

## 1. The founder's words (the client; hold every decision to these)

First draft, 21 Nov: "The website will say a lot about us as a company … really go into the backstory … where the name come from … the anglicized spelling of the Irish word for linking … how this story came to be, how we developed it … examples of the product … space for our sponsors … very, very good … but very simple … look at the Apple website … This dynamic style where when you scroll down, the text appears, or … you're brought to a certain animation and it's like you're in a video game … a sublime demo … to show to our shareholders."

On that first draft, 22 Nov:
- "the name came from the Irish word nosca, which means linking. You said nosc. That's not where it came from." (His final word on the name, a day later, is below and replaces this.)
- "I love that it matches the business card. That's all great. Also, please match the dark version of the business card, as I'm printing both. So match that on a different page maybe."
- "I want much more animations, much more fluidity. I want much more motion. I want you to take the calm effect from the Apple website … this dynamic style of advertising is so important, and I really need you to amplify that and … hone in on the specific small details."
- "this site must be completely comprehensive."
- "I'm loving the sample phone screens as well, but just overall, the visuals just don't cut it for me."
- "don't overcomplicate it. Keep it classy, keep it professional, and keep it down to the main ethos of our brand."
- "maybe mention things like climate, like we support climate action, etc."
- "it needs to be stunning. The dynamics are so important. The way it moves, the way the screens pop up, the animations, the flowing element, the fluidity, the calm element, the color schemes, the professionalism."
- On colour, the same evening, about the first draft AND the app: "WOW! That's way too colourful. Not cohesive or classy."
- Of everything in one green, the fix for that: "I do want variation in colors. I don't want all the same green … the green is … so like in your face and modern … it's not classy, it's not traditional … the business card, that's kind of more of the design I'm going for … different buttons are different colors, different functions."
- Of the deep colours that answered it (23 Nov, early): "those colors are beautiful and all, but I also want some more lighter tones throughout so it doesn't feel too dark and heavy … please ensure that the website is fully complete." And of the keys: "the colors must be visually appealing … I do want fulfilled buttons throughout. I don't want just tiny circles and tiny icons. And the colors don't all need to be saturated dark colors. I want light colors too that also match the same color family. And make sure that it is classy and professional." (These three are about the APP's keys and colours. On the site they govern only a vignette of the app: `KEYS.md`.)
- And the brand (18 Nov): "We don't stand for cheap apps … AI … tacky apps. No. We stand for something of a professional, something established, something curated, something specialist."

On the name, 23 Nov: "it is an anglicized spelling of the Irish word nascadh, which means linking."

On the second build, 23 Nov, in order (THIS is what this round answers):
- "It does not look classy whatsoever yet. I really need you to bring back that class and tone down the colours a little bit, make it more calm. Ensure that at the forefront is professionalism and class, and the website must be beautiful… look at the business cards, look at the beautiful design we did there with the gold, with the greens. It's stunning, but we need to bring that into our site because our site is not holding the same class."
- "the dynamics are vital… You must feel like you're in a movie, in a video game… as you scroll, everything should move with you… professional, classy, mystical experience. It's like the Apple website."
- "we could use stock images or stock videos of people playing the sports that are very, very classy, very professional, just to make it feel a bit more realistic and less like an AI app."
- later, of the build that followed: "the website… looks absolutely amazing, but I'm not sure if I'm still seeing this dynamic element, and I want more resemblance of what we see on the Apple page… ensure that it doesn't look like some 'AI' website."
- and: "Everything must be perfect, professional, classy, sublime, beautiful color family."

So: the structure is right and the screens of the app are loved. What was wrong is that the site was more colourful
than the card (pale green, straw and mint panels down every page), that it sat in boxes, and that most of its motion
was content fading up as it entered, which is what every template does. This round the site becomes the card at the
size of a screen, calm, with real photographs, and its motion is the scroll itself.

## 2. Truth rules (non-negotiable)

- The name: the short line is exactly **"From the Irish <i lang="ga">nascadh</i>, linking."** and the long form "Nosca is an anglicised spelling of the Irish word <i lang="ga">nascadh</i>, which means linking." Print *nascadh* exactly so (lower case, marked up `<i lang="ga">`). NEVER "nasc" on its own, never "The Irish for linking" as if Nosca were itself the Irish word; never invent an etymology or a pronunciation key.
- Never invent a fact about the company: no founding story, team, user numbers, funding, awards, partner names, testimonials, quotes, pledges or certifications. Say only what `CLAUDE.md` and this file establish. The numbers, in these rounded forms and no others: **6 sports · 45 development cycles (29 Sep to 20 Nov 2026) · 150+ updates since September · 1,500+ automated checks before each release · 4 roles (coach, player, parent, junior)**.
- No visible placeholders anywhere (no square brackets, no "lorem", no "coming soon"). If a fact is missing, leave the element out. The contact email comes from `site.config.json` (`contactEmail`); while it is empty, no contact address is shown.
- Climate: the founder's statement is "We support climate action." You may add only what the product truly does: lesson notes, registers and reports are digital, never paper; a weather call-off tells everyone affected before they travel. No pledge, percentage, partner or offset claim.
- Partners and sponsors: elegant empty frames for future partners. No logos, no names, no tiers. **No pricing anywhere.**
- The pilot is Ireland only, in English.
- People on the app's screens are the app's demo data; the footer says so ("Screens show the app with its demo data. The names are fictional."). The founder's name appears only as on his printed card: "Fionn Breathnach · Founder".
- **Photographs** are real and licensed (`assets/photo/MANIFEST.json`, `CREDITS.md`, the imagery engineer's). Atmospheric and adult: a fairway at first light, a hand on a grip, a court from above, oars on flat water, a horse's neck and a rider's hands. Never a grinning stock model, and never an identifiable person presented as a Nosca coach, player or customer: the licences forbid implying endorsement, and it would be a lie. A photograph is a place and a moment, never a testimonial, and its caption (if any) says only what it shows.
- Copy voice: plain, confident, short, the founder's own register. British and Irish spelling. Active voice. A headline is a few words; a paragraph is one or two short sentences. Less text than you think. Never: "Elevate", "Unlock", "Seamless", "Effortless", "Revolutionise", "Supercharge", "Empower", a rhetorical question, an exclamation mark, an em-dash aside, "not X but Y", or anything that sounds machine-written.
- App links come from `site.config.json` (`appUrl` Open Nosca, `installUrl` Add to Home Screen) as `{{appUrl}}` and `{{installUrl}}`; never paste an address.

## 3. The direction for this round (hold to it)

**A. The card is the art direction.** Look at `docs/brand/business-card/preview-front.png`, `preview-back.png`,
`preview-both.png` and `scripts/business-card.py`. The site is that object at the size of a screen: its deep green
ground, its fine gold pinstripes and rules, the mark and NOSCA in gold, and its white back.
- **Three grounds and no fourth:** the card's green (`.g-green`), white (`.g-paper`), and one quiet warm off-white for
  rest (`.g-rest`). The green is the olive card's on Home, Product and Partners and the dark card's bottle green on
  Story (`world: green`), which is the founder's "match the dark version … on a different page".
- **Gold is a line, a numeral, a small-caps eyebrow, a hairline.** Never a fill, never a gradient, never a glow.
- **The six sports' colours appear only inside their own sport's moment,** at the app's own values (`palette.css`),
  mostly inside the phone's screen, where the screenshots already carry them. Never as big bright blocks, never as a
  ground, a band, a panel, a heading or a key. Outside a screen the one mark a sport may leave is a small dot beside its name.
- Fewer colours on screen at once than before, everywhere. The pale club panels of the last build are gone.
  The tokens, the classes and the measured contrast of every sanctioned pair are in `API.md`.

**B. Calm.** More white space, fewer boxes, fewer things per screen, longer lines of sight. One idea per screen of scroll.

**C. Type.** Instrument Sans stays the voice: large, confident, tightly set headlines the way apple.com sets them.
One classical serif with a true italic, Instrument Serif, for the few editorial moments: the Irish word
*nascadh*, a pull-quote, a chapter numeral. Nothing else is set in it.

**D. Motion is the product of scroll, as on Apple's product pages.** The tell of a template (and of an "AI
website") is content that merely fades up as it enters. Here the scroll is a film reel the visitor turns by hand:
- pinned scenes where the device stays put and the scroll drives what happens in it: screens changing inside the
  phone, the phone turning in 3D, scaling from full-bleed down into its frame, the caption beside it stepping in time;
- scrubbed image sequences on a canvas (frames of the real app, drawn by scroll position) and scroll-scrubbed video;
- headlines that fill with ink line by line as the scroll passes, words rising out of masks;
- depth: layers moving at different rates; the gold pinstripes drawing themselves along with the scroll;
- grounds that change by scroll (white giving way to the green through a clip-path, not a hard edge);
- horizontal passages driven by vertical scroll (the six sports);
- photographs that settle: a slow scale and a reveal tied to scroll, never a pop.

**Every section has a scroll-linked behaviour; each long page has at least three pinned film scenes; the first
screen of each page is one.** All of it scrubbed (GSAP ScrollTrigger with Lenis), transform, opacity and clip-path
only, sixty frames a second on a phone, nothing that jumps when a pin starts or ends. Calm still rules: one focal
movement at a time, and text never moves while it is being read. The library that does all of this is in `site.js`
and documented in `API.md`: `Site.film`, `Site.device`, `Site.sequence`, `Site.scrubVideo`, `Site.inkFill`,
`Site.rise`, `Site.depth`, `Site.drawStripes`, `Site.groundShift`, `Site.rail`, `Site.settle`, `Site.card`.

**E. Real photography,** graded as one family (truth rules above). Photographs settle; they are never decoration
behind a box, and words lie on one only under an even veil of the card's green.

**F. Not "an AI website".** None of: gradient blobs, glows, glass cards, emoji, icon-in-a-circle feature grids,
three equal cards in a row, centred everything, purple, drop-shadowed floating panels, a badge above the headline,
the words in §2's list, invented numbers, invented testimonials, invented partners, logos of companies that are not
partners. Instead: editorial asymmetry on a real grid (`.cols`), fine rules, real product screens (`assets/*.webp`
are stills of the real app; `assets/seq/` are frames of it in use), real photographs, and specific true sentences.

**G. True.** §2.

**H. It must hold.** With JavaScript off every word and picture is visible; under `prefers-reduced-motion`
everything is still and visible; 320 to 1920 wide, nothing cut, no horizontal scroll; pinned scenes shorten or
unpin on small phones if they would trap the thumb; pictures lazy-load with dimensions set; video is muted,
playsinline, paused off screen; no layout shift when fonts land; the header is solid and never ghosts over content;
it works in Safari (no scroll-timeline CSS, nothing without a fallback); semantic headings, alt text, visible
focus, 4.5:1 for words, nothing under 12px, 44px to a finger; every URL relative; no third-party request of any kind;
each page under about 2.5 MB on first load (a sequence loads only as it nears the screen).

## 4. The site (four pages, one system)

Shared chrome: a slim fixed header, solid on the ground beneath it and closed by a gold hairline (the gold mark at
left, Product · Story · Partners, an Open Nosca key; on phones a full-screen menu on the green), and a footer that is
the card: its front above a gold rule (the wedges, the mark, NOSCA), its back's manner beneath (ranged left, small,
plain: "Coaching, linked.", the name line, the six sports, the links, the small print: © 2026 Nosca · Made in
Ireland · the demo-data line · "This site sets no cookies and collects no data."). Pages glide into each other
(cross-page view transitions).

What each page must cover (its engineer composes the scenes, to §3; these are the true things it may say):

**Home (`index.html`, the olive card).** The card opens the site: its front drawn by the scroll, then the white of
its back becomes the page. The app arrives in a phone and is used in front of the visitor (logging a lesson, frame
by frame). Coach · Player · Family. Six sports, one app, each in its own words (golf: full swing, short game, on
course · tennis: serve, return, rally, net · rowing: technique, rhythm, racing, erg · squash: drives, volleys, front
court, movement · padel: net game, overheads, walls · equestrian: flatwork, poles, jumping, cross-country; "Levels
and terms are the ones each sport's governing body uses."). The name: "From the Irish *nascadh*, linking.", the two
rings weaving, "A coach, a player and a family, linked." What we stand for: "Professional. Curated. Specialist." and
the four principles (coach and player side by side · fewer taps · the coach's own words · nothing pretends).
Climate. Frames kept for partners. The close: "In pilot, in Ireland.", Open Nosca · Add to Home Screen, the code.

**Product (`product.html`, white first).** "Built around the lesson." The comprehensive tour, by chapter:
- Coach: log a lesson in seconds (Who → what was worked on → Log it); capture video, photo and voice as it happens;
  mark up a clip and compare two side by side; the diary, hours and days away; call off and everyone is told; the
  register; groups; drills with a day; tips.
- Player: every lesson kept (the lesson page, the feed); drills that arrive with a day and a reminder at the hour
  you choose; progress you can see (level over time, attendance); log a practice; send a clip to your coach;
  downloads that play offline.
- Family: a parent books and answers for a child; an under-18's own account; a parent's words are labelled the
  parent's; a coach's group message lands in each family's own thread (no family reads another's); a reminder the evening before.
- Sports: the six, each with its real ladder (tennis: Red, Orange, Green, Yellow ball then WTN · golf: Handicap
  Index · rowing: J13 to J18, Novice to Senior · squash: the ball's dot · padel: levels 0 to 7 · equestrian: Pony
  Club tests and riding-school stages) and its own words.
- Everywhere: adds to the Home Screen on iPhone, Android and computer; opens offline on its kept copy;
  notifications; lessons into the phone's calendar.

**Story (`story.html`, the dark green card).** The name and the rings. One moment: "A coach picks up the phone
mid-lesson, does one thing in seconds and puts it down. Every coach screen is judged against it." How it was built
(only these facts: 2 Sep 2026 the first commit · 19 Sep rebuilt around one behaviour · 29 Sep daily development
cycles begin · every morning: research, build, test, ship · 13 Nov the visual sprint · 21 Nov the app redrawn in
white, with each sport's own colour; the 45 ticks in the `ticks` include are the real cycle days). Proven before it ships: 1,500+ automated checks
drive the app as a coach, a player, a parent and a junior; a crawl taps every control and fails on any that does
nothing. Every sport in its own words, verified against its governing body, never invented. What we stand for.
Climate. Made in Ireland.

**Partners (`partners.html`, white first).** "Partners." A wall of empty frames kept for partners and sponsors,
"Why Nosca" in three true lines (six sports in one app · coach, player and family in one place · built and piloted
in Ireland), Climate, the contact line only if `contactEmail` is set, the close.

## 5. Structure and ownership

```
website/
  BRIEF.md  API.md  KEYS.md  README.md  site.config.json
  vendor/  fonts/  assets/ (stills of the app, seq/ frames of it in use, photo/ the photographs)
  src/partials/   src/pages/*.html   src/css/site.css + <page>.css   src/js/site.js + <page>.js
  build.mjs  → dist/   tools/ (cap.cjs, contact.py, seq/)
```
The foundation engineer owns `build.mjs`, the partials, `site.css`, `site.js`, the kit page, `fonts/`, `vendor/`
and the three documents. Each page's engineer owns that page's three files. The imagery engineer owns
`assets/photo/`. Page engineers never edit shared files: build what is missing in the page's own files and say so.

## 6. Working rules

- If files already exist in your area, continue from them; never start over. Commit your own files by path, in steps.
- Build, serve and capture as `API.md` says. Capture at 390, 768 and 1440 at least (320 and 1920 before you finish),
  with motion on as frames, with Reduce Motion, and with JavaScript off, and READ the pictures. Never hand in a scene
  you have not watched frame by frame. The machine is shared: one browser at a time.
- Be your own harshest critic against §1 before you stop: is it the card? Is it calm? Does the scroll play it like a
  film? Is every sentence true? Would the founder call any screen of it "an AI website"?
- Final report: short. What you built, the checks with their results, the contact sheets' paths, anything the lead must know.
