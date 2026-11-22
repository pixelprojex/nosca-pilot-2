# Nosca: the website's content brief

First demo, for the shareholders. Written 21 November 2026.

Every fact on the page comes from the repository or from the founder's own
messages, and each one is listed with its source at the end of this brief.
Square brackets mark the few things only Fionn can supply. Nothing in square
brackets is invented, and nothing outside them is either.

## The tagline

**Coaching, linked.**

Keep the card's line. It is already printed on the card Fionn hands out, so
the card, the site and the app say the same thing. It carries the meaning of
*nasc* in two words. It also states the product's thesis: one app that links
the coach, the player and the family. The card's second line, "One app for
coach, player and parent.", is the hero's subline.

## Voice

- Plain, confident, short sentences. Active voice. British and Irish spelling
  (colour, organisations, anglicised).
- No hype, no exclamation marks, no em-dash asides, no "not X but Y".
- "We" is the company. Nothing implies a team size, a founding year, users,
  funding or awards.
- Never on the page: prices; partner, sponsor, competitor or governing-body
  names or logos; testimonials; the words "AI" or "revolutionary"; the
  founder's design references (Apple, Duolingo and so on are his references,
  not our claims).

## The page at a glance

| # | id | Headline | What the reader sees |
|---|----|----------|----------------------|
| 1 | hero | Coaching, linked. | The gold mark draws itself, then the coach's Today rises on a phone |
| 2 | name | Nasc. | The card's olive band, "nasc" in gold, and the two rings interlocking |
| 3 | story | Built around one moment. | Five beats appear as you scroll, then the numbers row |
| 4 | coach | For the coach. | One pinned phone steps through log, capture, mark-up, compare and the diary |
| 5 | player | For the player. | The feed, Drills with a day, a Progress line drawing itself, a clip sent |
| 6 | family | For the family. | A parent's phone and a junior's, one group message landing in separate family threads, a lock-screen reminder |
| 7 | sports | Six sports. One app. | The same phone re-tinted sport by sport, ending on six coloured tiles |
| 8 | principles | Professional. Curated. Specialist. | Three words, then four lines, on white |
| 9 | partners | Partners. | Six empty frames, kept |
| 10 | close | In pilot, in Ireland. | The card turns over to its white back, the code live, then two buttons |

The founder asked that "when you scroll down, the text appears", or that the
reader is "brought to a certain animation". So sections 3 to 7 are pinned
scroll sequences: the picture stays and the words change beat by beat. The
other sections reveal once. All motion honours Reduce Motion, which is the
app's own rule. Under it every section rests on its final frame.

---

## 1. Hero (`hero`)

**Purpose.** The thesis, the name and the mark. This is the first thing a
shareholder sees.

**Copy**

> NOSCA
>
> # Coaching, linked.
>
> One app for coach, player and parent.
>
> Golf · Tennis · Rowing · Squash · Padel · Equestrian

**Visual.** A white page. The woven mark draws itself in the card's gold, one
ring after the other. Each ring breaks where the other passes over it, using
the exact geometry in `src/lib/brandmark.jsx` (`RING_L`, `RING_R`,
`RING_LEN`). NOSCA is tracked wide beneath it, then the headline rises in. On
the first scroll the mark settles into the header's top-left. An iPhone rises
from below the fold, showing the coach's Today in golf green (polish shot
`c1-today`). There is no button here; the close carries them.

## 2. The name (`name`)

**Purpose.** Where the name comes from, and the idea the product is built on.

**Copy**

> The name
>
> # Nasc.
>
> Irish for a link. A tie, a bond. To link, to bind.
>
> Nosca is our anglicised spelling of it: the link between a coach, a player
> and the family behind them.
>
> Two rings, each passing through the other.

**Visual.** This is the page's one dark band, and it is the card's front: the
olive ground (about #4F5B29 on screen), with gold pinstripes sliding in from
two opposing corners as the band arrives. "nasc" is set very large, in lower
case, in gold, on its own. As you scroll, the three meanings appear one at a
time under it. Then "Nosca" appears in the card's tracked capitals, and the
two gold rings drift in from either side and weave together. Use a gentle
cross-fade from nasc to Nosca, not a letter-by-letter morph, so the spelling
is shown as ours and not as a derivation.

## 3. The story (`story`)

**Purpose.** How Nosca came to be and how it is made. This is the backstory
the founder asked for, in facts. The personal part is Fionn's to write.

**Copy** (five beats, each appearing as you scroll)

> # Built around one moment.
>
> **[Fionn, in one or two sentences: when and where Nosca began, and why.]**
> Fionn Breathnach, Founder
>
> **One moment.** A coach picks up the phone mid-lesson, does one thing in
> seconds and puts it down. Every screen is judged against it.
>
> **Each sport in its own words.** Levels and terms are checked against each
> sport's governing body. Nothing is invented.
>
> **Built in daily cycles.** 45 since 29 September. Each one is researched,
> built and tested before it ships. Then the founder reads it on his phone and
> sends back what is not right.
>
> **Proven before it ships.** Before each release, 1,554 automated checks
> drive Nosca as a coach, a player, a parent and a junior. A crawl taps every
> control and fails on any that does nothing.
>
> | 6 | 45 | 155 | 1,554 |
> |---|---|---|---|
> | sports | development cycles | updates since September | automated checks before each release |

**Visual.** The section is pinned. The beats appear on the left one at a time
and the picture on the right changes with each one:

1. The founder's note in large type on white, signed in the card's style
   (name, then Founder in grey).
2. The coach's Today with the live lesson and its Register key (`c1-today`).
   A tap on Register shows Present marked.
3. The log's level view cycling through sports, each in its own colour:
   tennis Red ball · U8 to Yellow ball, rowing J13 to Senior, squash Blue dot
   to Double yellow. Choose screens that carry generic terms only. Avoid any
   screen that names a governing body's own product, such as the golf
   Passport, GolfSixes, Pony Club tests, WTN or SquashLevels.
4. A strip of 45 small ticks, one per cycle, lighting left to right from
   29 Sep to 20 Nov.
5. A counter rolling up to 1,554, with Coach · Player · Parent · Junior
   lighting in turn.

The numbers row then counts up once, in ink, with grey labels.

## 4. For the coach (`coach`)

**Purpose.** The product at the coach's side, shown working.

**Copy** (four beats)

> # For the coach.
>
> **Log a lesson in seconds.** Tap the player. Tap what you worked on. Log it.
>
> **Capture as it happens.** Photo, video or a voice note, filed under the
> lesson as you take it.
>
> **Draw on the swing.** Pause, draw, talk over it, and the player receives
> the recording. Or play two clips side by side, in step.
>
> **A diary that tells people.** Hours, days away and standing lessons. Call
> a day off for rain, and everyone affected is told.

**Visual.** One iPhone, pinned in the centre, in golf green. Its screen is
scrubbed by the scroll:

- **Log:** the plus sheet (`c9-plus`), then Who as faces (`c9-log-who`), then
  two focus tiles chosen (`c11-log-worked-on`), then Log it and the Logged
  burst.
- **Capture:** the live camera filling the screen, with PHOTO · VIDEO · VOICE
  along the bottom, the Grid guide on and the shutter ring turning red.
- **Draw:** Mark it up on a swing paused at the top. A line and an angle draw
  themselves in, then the stage splits into Compare's two clips playing
  together.
- **Diary:** the Diary's List view (`c2-diary`), then the Call off sheet with
  Weather chosen.

Each caption fades with its screen.

## 5. For the player (`player`)

**Purpose.** What the player gets: their lessons, their practice, their
progress.

**Copy** (four beats)

> # For the player.
>
> **Every lesson, kept.** The clip, what you worked on and your coach's note,
> as a feed of your own lessons.
>
> **Drills with a day.** Set by your coach for the next lesson, with a
> reminder at the hour you choose.
>
> **Progress you can see.** Your level over time, the areas you have worked
> on, and your attendance.
>
> **A clip between lessons.** Film your practice and send it. Your coach
> draws on it and sends it back.

**Visual.** The phone again, now as a player in tennis teal, so the page
shows a second sport without saying so:

- **Feed:** the full-bleed lesson clip, with the focus in large type on the
  glass panel and View lesson with its star (`a1-home`). One flick snaps to
  the next lesson.
- **Drills:** the Drills tab, with "By Thu 8 Oct" under a drill and a tick
  filling (`a6-drills`).
- **Progress:** the level line drawing itself left to right, and the
  attendance discs filling.
- **Clip:** the thread with a sent clip's card ("Open the clip").

## 6. For the family (`family`)

**Purpose.** Parents and under-18s, and the care taken with children.
Shareholders will ask about this.

**Copy** (five beats)

> # For the family.
>
> **Parents, in the loop.** Book for a child, follow their lessons, answer for
> them.
>
> **A parent's words are the parent's.** In a child's thread, a parent's line
> carries the parent's name, so it never reads as the child's.
>
> **Each family's own thread.** A coach's message to a group arrives in each
> family's own thread. No family reads another's.
>
> **Under-18s.** Their own account, with their lessons and drills. Booking
> stays with the family.
>
> **Reminded once.** The evening before each lesson, everyone is told.

**Visual.** The section opens on two phones side by side, a parent's and a
junior's:

- **Parent:** the Family screen with the children and Coming up
  (`p1-family`), then the child's thread with a parent's bubble labelled
  "Orla · parent" (`p6-thread-for-child`).
- **Junior:** the junior's own home (`j1-home`).
- **Group message:** one line from the coach splits into three small phones,
  each receiving it in its own family thread.
- **Reminder:** a lock screen at 6:00 pm, with "Ellie's lesson tomorrow ·
  10:00 am" sliding down.

The names come from the app's demo data and are fictional.

## 7. Six sports (`sports`)

**Purpose.** The breadth of the product, and the colour system that holds it
together.

**Copy**

> # Six sports. One app.
>
> Each in its own colour, and in its own words.
>
> **Golf** Full swing, short game, on course.
> **Tennis** Serve, return, rally, net.
> **Rowing** Technique, rhythm, racing, erg.
> **Squash** Drives, volleys, front court, movement.
> **Padel** Net game, overheads, walls.
> **Equestrian** Flatwork, poles, jumping, cross-country.

**Visual.** A pinned phone whose tint changes sport by sport as you scroll:
the tab bar, the one action key and the sport's glyph (flag, racket, oar,
squash racket, padel bat, horseshoe). The page around it stays white, which
is how the app works. Beside the phone, each sport's name appears in its own
colour with its line:

| Sport | Colour |
|-------|--------|
| Golf | #207A30 |
| Tennis | #01836E |
| Rowing | #1B74A1 |
| Squash | #C74B17 |
| Padel | #6536B6 |
| Equestrian | #8C2941 |

The section ends on six tiles drawn the way the app's sport grid draws them:
each sport's colour at an eighth over white, a ring at 55%, and the 3D ledge.

## 8. Principles (`principles`)

**Purpose.** What the company stands for, in the founder's words and spirit.

**Copy**

> # Professional. Curated. Specialist.
>
> **Coach and player, side by side.** Both see the same lesson. A gap between
> them is a fault, and we fix it.
>
> **Fewer taps.** Every step has to earn its place.
>
> **The coach's own words.** Every note, tip and reply is theirs, typed or
> spoken.
>
> **Nothing pretends.** Every button does what it says, or it is not there.

**Visual.** White, with no screenshots. The three words arrive one at a time,
large and in ink, with a fine gold rule under the last. The four lines then
rise in one by one, in two columns (one column on a phone).

**Flag for Fionn.** The heading is his own words from 18 November: "something
of a professional, something established, something curated, something
specialist". "Established" is left out because a pilot cannot claim it yet.
He may put it back.

## 9. Partners (`partners`)

**Purpose.** The space the founder asked for, for sponsors and partners. It
stays empty until a partner is signed.

**Copy**

> # Partners.
>
> Kept for the clubs and organisations who back Nosca.
>
> [Partner] · [Partner] · [Partner] · [Partner] · [Partner] · [Partner]
>
> To partner with Nosca: [contact email]

**Visual.** A quiet grid of six frames: three across on a desktop, two across
on a phone. Each frame is drawn like the app's card: white, a 1.5px #E2E2E7
line, a 2px ledge and 14px corners, with the mark centred faintly in gold at
low opacity. The frames rise in with a slight stagger. They carry no names
and no logos.

## 10. Close (`close`)

**Purpose.** Where to start, and how to reach the company.

**Copy**

> # In pilot, in Ireland.
>
> Nosca's pilot is open in Ireland, in English. Open it on your phone and add
> it to your Home Screen.
>
> [Open Nosca] → https://nosca-pilot-2.netlify.app
> [Add to Home Screen] → https://nosca-pilot-2.netlify.app/install
>
> Scan to start
>
> Contact: [contact email]

**Footer**

> The mark · NOSCA · Coaching, linked. ·
> Golf · Tennis · Rowing · Squash · Padel · Equestrian ·
> Designed in Ireland. · © 2026 [registered company name]

**Visual.** The business card is the closing image. Its olive front, with the
gold stripes, turns over in 3D as you scroll and shows the white back: the
gold mark and NOSCA, the gold rule, "Fionn Breathnach / Founder", the card's
two lines and the code. The code is live and scannable from the screen, and
it opens `/install`, as the card's does. Below the card sit the two buttons:
Open Nosca in bottle green #123C30 with white words, on the app's ledge, and
Add to Home Screen as a white key. If Fionn wants to name a date for the App
Store, it goes here as one line: "[On the App Store: month]".

---

## The name, in full (for the name section and for anyone who asks)

**Nasc** is Irish. As a noun (masculine; genitive *naisc*) it means a tie or
tether, a clasp, a bond, and in modern use a link, including a hyperlink. As
a verb it means to tie, to tether, to link, to bind.

**Nosca** is, in the founder's own words, "the anglicised spelling of the
Irish word for linking". The page says "our anglicised spelling of it", and
claims no more about the history of the spelling than that.

**Sources**

- **The founder:** his message of 21 November 2026, in
  `scratchpad/founder-msgs.txt`.
- **The meaning of *nasc*:** Wiktionary's Irish entry and Omniglot's
  Celtiadur, as returned by a web search for the word alone. That search
  result gave the noun and verb senses above and the Old Irish origin.
- **Not yet confirmed:** teanglann.ie (Ó Dónaill's dictionary) lists nasc 1
  and nasc 2, but it could not be reached from this machine. Confirm the
  wording there before publishing.

**Kept off the page until checked.** The same search summary gave Old Irish
*nasc* as "fastening, tie, spancel, ring; legal term, bond, obligation". The
sense "ring" would sit beautifully beside a mark of two rings, but it rests
on one summary. Verify it in a dictionary before using it.

**The mark.** `src/lib/brandmark.jsx` describes it as two rings, woven: each
one broken where the other passes over, worked out from four numbers. The
same file describes the brand colour #123C30 as "Deep bottle green. Irish
without being a flag."

## Numbers the page may show

| Value | What it counts | Source |
|------:|----------------|--------|
| 6 | sports | CLAUDE.md, opening; `src/Nosca.jsx` `SPORTS`; the card's back |
| 3 | sides of one app: coach, player, parent, plus an under-18 account | the card ("One app for coach, player and parent."); CLAUDE.md |
| 1,554 | automated checks in the browser, across 56 suites, on the latest full verification (21 Nov 2026) | sum of the suites' own counts in `scratchpad/logs/` (see note 1) |
| 116 | database checks, with 0 failing | `supabase/test/run.sh`, latest log `scratchpad/logs/sql-1112a.log` (12 Nov 2026; `nosca.sql` is unchanged since) |
| 4 | roles every crawl drives: coach, adult player, parent, junior | CLAUDE.md, "Before every push"; `docs/cycles/2026-09-29.md` (seed sweep by role) |
| 45 | development cycle summaries, 29 Sep to 20 Nov 2026, on 44 days (one evening sprint) | `docs/cycles/` |
| 155 | pull requests merged, 2 Sep to 21 Nov 2026 (#1 to #155, every one merged; #156 open) | GitHub, pixelprojex/nosca-pilot-2 |
| 36 | large items researched and built from the standing brief, 30 Sep to 13 Nov 2026 | `docs/research/2026-09-30-large-items.md` |
| 136 | sources cited in that research brief | same file, "Sources" |
| 48 | focus areas across the six sports (golf 9, tennis 8, rowing 5, squash 8, padel 8, equestrian 10) | `src/Nosca.jsx` `SPORTS[x].focus` |
| 74 | starter drills (12 a sport, rowing 14) | `src/Nosca.jsx` `SPORTS[x].drills` |
| 12px | the smallest type on any live screen | CLAUDE.md, "12px is the floor"; `scripts/e2e/type-floor.cjs` |
| 44 | points a finger can land on, on every header control | CLAUDE.md, "The hit area is not the glyph" |
| 320px | the narrowest phone every screen is checked at | CLAUDE.md, "Nothing is cut at 320"; `scripts/e2e/narrow.cjs` |
| 7 | walkthrough steps at most, a role | CLAUDE.md |
| 2 Sep 2026 | the repository's first commit | GitHub commits, `fd9abb1` |
| 4:48 | when the daily cycle fires each morning, Irish time | `docs/cycles/README.md` |

**Recommended row for the page:** 6 sports · 45 development cycles · 155
updates since September · 1,554 automated checks before each release.

**Note 1: how the checks were counted.**

- **The logs:** `chainA1-f36.log`, `chainA2-f36.log`, `chainB-f36.log` and
  `rerun36.log`. Where a suite was re-run, the re-run's count replaces the
  first.
- **The sum:** 1,525 checks print as "N/M passed" across 54 suites. Two more
  suites print "passing": signup 20/20 and auth-basics 9/9. Together they
  make 1,554 checks in 56 suites.
- **What failed:** on that run, 1,552 checks passed. `downloads.cjs` was
  21/23, the known offline pair on this machine.
- **What is not counted:** the crawls (the seed sweep, the dead-ends crawl,
  walkthrough alignment) and the screenshot sweep.
- **On the page:** if the page should not need updating as suites grow,
  show "1,500+" instead.

## Facts the copy rests on

| Fact | Source |
|------|--------|
| Nosca is a coaching app for golf, tennis, rowing, squash, padel and equestrian, with a coach side, a player side, and parent and under-18 variants | CLAUDE.md, opening |
| It is an Ireland-only, English-only pilot: a web app that installs to the Home Screen at https://nosca-pilot-2.netlify.app, with a guide at /install | CLAUDE.md; `docs/brand/business-card/README.md` |
| The card says "Coaching, linked. One app for coach, player and parent." and "Golf · Tennis · Rowing · Squash · Padel · Equestrian" under "Fionn Breathnach, Founder" | `scripts/business-card.py` (`NAME`, `LINE`, `SPORTS`); `preview-both.png` |
| The card's design: an olive front with gold pinstripes in two opposing corner wedges, a white back with the gold mark, NOSCA and a gold rule, set in Instrument Sans, gold foil on both sides, made by MOO | `docs/brand/business-card/README.md`; `scripts/business-card.py` |
| The brand colour is #123C30, "Deep bottle green. Irish without being a flag." | `src/lib/brandmark.jsx` |
| The app is white throughout, with one saturated colour a sport: golf #207A30, tennis #01836E, rowing #1B74A1, squash #C74B17, padel #6536B6, equestrian #8C2941 | CLAUDE.md (21 November); `src/Nosca.jsx` themes |
| The sports' own lines, as written in the app | `src/Nosca.jsx` `SPORTS[x].tagline` |
| "The one behaviour: a coach picks up the phone mid-lesson, does one thing in seconds, puts it down. Every coach screen is judged against that." | CLAUDE.md |
| "Every sport's taxonomy is the real one, verified against the governing body — never invented." | CLAUDE.md |
| On 19 Sep 2026 the app was rebuilt around "one behaviour, one screen to log, the real taxonomy for every sport" | GitHub, PR #18, commit `da766e9` |
| The daily cycle's first run was on 29 Sep 2026. It fires at 4:48 each morning: research, one large improvement, full verification, merge, and a written summary | `docs/cycles/2026-09-29.md`; `docs/cycles/README.md` |
| The standing research brief compares Nosca with the reference coaching products. Its "Not doing" list includes "An AI-written lesson summary: the note is the coach's own words" | `docs/research/2026-09-30-large-items.md` |
| Before every push: a check for names that resolve to nothing, the build, the database suite when the schema changes, and the Playwright suites on the built app, including a crawl that "taps every control as every role and fails on any that does nothing" | CLAUDE.md, "Before every push" |
| The database file is run twice on a throwaway Postgres, with behaviour checks and upgrade paths | `supabase/test/run.sh` |
| Logging a lesson is two screens: a face, then one page. From a booking it is one tile and Log it | CLAUDE.md |
| Capture is the phone's camera, with PHOTO · VIDEO · VOICE, filed under today's booking | CLAUDE.md |
| Mark it up: each mark belongs to a moment, the coach can talk over it, and the take reaches the player as a clip | CLAUDE.md |
| Compare plays two clips of the same player side by side, in step, and both sides have it. Study steps a clip frame by frame, at ½× and ¼×, on a loop | CLAUDE.md |
| Hours, days away and recurring lessons are in the Diary. Call off takes a reason, the days and the lessons, and the player is told with the reason first | CLAUDE.md |
| The player's home is a feed of their own lessons | CLAUDE.md |
| A drill carries a day, by default the next lesson, and the reminder comes at the hour the person chose | CLAUDE.md |
| Progress shows the level over time, the areas worked on and attendance, and can be shared as a season report | CLAUDE.md |
| A player, or a parent for a child, can send a clip to the coach, who marks it up and replies | CLAUDE.md |
| "A parent's message is the parent's": a parent's line is labelled with the adult's first name and "parent" | CLAUDE.md |
| A coach messages a group "into each member's own thread, never a thread the families share", because no safeguarding guidance for juniors allows a shared thread | CLAUDE.md; `docs/research/...` (a national tennis body's safeguarding guidance) |
| A junior sees the family "and nothing they cannot do". A parent books a junior's lesson and answers Not going for them | CLAUDE.md |
| At six the evening before a lesson, the player, a junior's adults and the coach are each reminded once | CLAUDE.md; `supabase/nosca.sql` `remind_bookings` |
| "Coach and player parity: asymmetries are bugs." "Fewer clicks, less clutter; every extra step gets challenged." | CLAUDE.md, "How the founder works" |
| "A real account either does the real thing … or does not show the control — nothing may toast and pretend." | CLAUDE.md |
| Every field a person writes words into carries dictation | CLAUDE.md |
| What the company stands for: "We stand for something of a professional, something established, something curated, something specialist." | founder, 18 Nov 2026 (`founder-msgs.txt`) |
| An App Store release is spoken of as upcoming, with no date | founder, 13 Nov 2026 (`founder-msgs.txt`) |
| The pilot runs on Ireland's clock: the reminders, and the daily cycle on Irish time. This is the basis for "Designed in Ireland." | CLAUDE.md; `docs/cycles/README.md` |

## Placeholders, and where each sits

1. **[Fionn, in one or two sentences: when and where Nosca began, and why.]**
   Story, beat 1, signed "Fionn Breathnach, Founder".
   - If he would rather not write a new line, his own words of 18 November
     can stand there, lightly edited and only with his approval: "We stand
     for something professional, something established, something curated,
     something specialist."
2. **[contact email]** Partners (the line under the frames) and Close.
3. **[Partner]**, six times. The partner frames stay empty until a partner is
   signed.
4. **[registered company name]** The footer's copyright line.
5. **[On the App Store: month]** Optional, in the close, only if Fionn wants
   to name a date.

## Notes for design and build

- **Palette.**
  - The page is white (#FFFFFF), with ink #1C1C1E and Apple's greys (#5F5F65
    for secondary text).
  - The card's gold is for the mark and fine rules only. The preview's foil
    runs from #B08630 to #FAE6A0. Never use gold for body text, which would
    sit near 3:1 on white.
  - The card's olive is for the name band and the card in the close.
  - Bottle green #123C30 is for the primary button and links.
  - Sport colours appear only in the sports section and inside phone screens.
- **Type.** Instrument Sans, from Google Fonts, the card's face. Headlines are
  large and tight and the body is calm. Nothing on the page goes under 12px,
  which is the app's own floor.
- **Screens.** Take them from the app's own screenshot sweep
  (`scripts/e2e/polish-shots.cjs` names: `c1-today`, `c2-diary`, `c9-plus`,
  `c9-log-who`, `c11-log-worked-on`, `a1-home`, `a6-drills`, `p1-family`,
  `p6-thread-for-child`, `j1-home`), run against the mocked backend so no real
  person's data appears.
  - Set them in an iPhone frame.
  - The demo names are fictional.
  - Skip any screen that shows a governing body's own product name.
- **Motion.**
  - Scroll-scrubbed and pinned sections (3 to 7). The others reveal once,
    with short rises and fades, never a bounce.
  - Under Reduce Motion every section shows its final frame.
  - No blur over content. The app allows only its tab bar to blur.
- **Small screens.** At 320px wide nothing may be cut or scroll sideways:
  the app's own rule, and WCAG 1.4.10.
- **Meta.**
  - Title: "Nosca · Coaching, linked."
  - Description: "One coaching app for coach, player and parent, in golf,
    tennis, rowing, squash, padel and equestrian. In pilot in Ireland."
