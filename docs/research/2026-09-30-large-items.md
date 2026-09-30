# Large items — the standing brief

Started 30 September 2026, after the founder said the first two daily
cycles delivered "only minor tweaks" and asked for "large scale
improvements that are noticeable while not interfering with anything we
worked so hard on", and for the research time to be used. Every run
reads this file after the previous summary, adds what it finds with
its sources, strikes off what it built, and takes the top item that is
left. Ranked by how soon a coach or a player would notice it, against
how much of what is protected it would have to touch (none is the only
acceptable answer).

## What the reference products have that Nosca did not (30 Sep 2026)

Read across V1 Golf / V1 Coach, OnForm, CoachNow, Skillest, Sportsbox
AI, TennisLocker, CoachIQ and the coaching-app round-ups for 2026.

| Capability | V1 | OnForm | CoachNow | Skillest | Nosca |
|---|---|---|---|---|---|
| Draw on a clip, voice over it | yes | yes | yes | yes | yes (Mark it up) |
| Slow motion, frame by frame | yes | yes | yes | yes | yes (½×, a frame either way) |
| **Side-by-side comparison, synced** | yes, and overlay | yes | yes | yes | **no** → built 30 Sep |
| Athlete sends a practice clip for the coach to review | yes (V1 Coach) | yes | yes | yes, the whole product | no |
| Progress made visible to the client over time | swing library | per-athlete space | progress logs | AI summary per lesson | four tiles on the file, nothing over time |
| Follow-up drill with a due date | — | — | — | yes | drills, no date |
| Pose / skeleton overlay | yes | yes (3D) | yes | 17 points | no |
| Model swings from the pros | yes | — | — | — | no, and not wanted (licensing; "never invented") |
| Booking, lesson packs, payments | — | — | — | — | booking yes; no pricing anywhere, by the founder's rule |

Two findings that set the order. Coaches keep athletes engaged between
lessons by continuing the conversation asynchronously — new uploads,
annotated clips, voice-over between appointments (the CoachNow and
Onform positioning, and the whole of Skillest's loop: film, upload,
annotate, drill, refilm, about a day door to door). And perceived
progress is what keeps a paying client: one survey of coaching clients
puts it at 80% of the reason they continue.

## Ranked

### 1. Compare — two clips side by side, synced. **Built 30 September.**
The one tool every video-coaching product carries and Nosca lacked.
A coach taps Compare under a clip on the lesson page, picks another
of that player's clips (this month's against last month's, the fringe
chip against the bunker shot), and the two play together: one
transport, a frame either way, ½×, a scrub; each clip nudged a frame
at a time to line them up (address to address, the top of the
backswing to the top), a swap. A player has the same over their own
lessons. No SQL. Adds a route (`compare:`), a button beside Mark it up,
a screen; touches nothing that is protected. `scripts/e2e/compare.cjs`.

### Built the same day, at the founder's ask: Downloads
Not from the brief — the founder asked for downloads "done within the
app, a system just like Netflix", a Downloads section that "works
flawlessly and also saves every part of the log". Built as such:
the disc's four states, the store, the Downloads screen, the sheet,
and the app opening on its kept shell and last load with no network.
It stands as the pattern for the next large items: a whole capability,
both roles, its own suite, the founder's register in CLAUDE.md.

### 2. A clip from the player to the coach
The asynchronous loop the market is built on. A player (or a parent
for a child) films a practice swing with the app's own camera and
sends it to their coach; it lands on the coach's home under Actions as
"To review" with the player's face; the coach opens it in Mark it up,
and the take goes back to the player as a clip in their feed. Needs a
place to keep a clip that is not on a lesson yet: a `practice_clips`
table (player-writable, coach-readable through `my_coach_id()`) or a
lesson row a player may author with a kind of its own, with the
notification trigger for each side. Needs the founder's re-run of the
SQL, so the app must say plainly where it is not yet possible rather
than pretend. Large, and the most noticeable of all on the player's
side.

### 3. Progress — a player's journey over time
No SQL: every lesson carries its stage tag (`HI 18.4`, `WTN 22`,
`Green ball`, `Level 3.5`, `J15`) and its areas. A Progress screen for
the coach on the player file and for the player behind the profile
pill: the level as a line over time (one small SVG, no library), the
areas worked on as counts, lessons a month, drills done. It says only
what the lessons say; where a sport's stage is not a number (the
Pony Club tests, the squash ball) it is the ladder with the steps
reached. Nothing asked, nothing stored — a screen that reads.

### 4. A drill with a day
Skillest attaches a follow-up drill with a due date to a lesson. Nosca
sets drills; a `due` day on `drills` (one alter table), the player's
Drills screen ordered by it, and the reminder as a notification from
the trigger. Small SQL, medium build, noticeable to the player.

### 5. A player's season report
TennisLocker sells "evaluations" to parents. Nosca has
`downloadLessonLog` for one lesson; a per-player report — the
lessons, the areas, the stage line, the drills, the coach's tips — as
one HTML page for the share sheet, from the player file and the
family screen. No SQL. Noticeable to a parent at the end of a term.

### 6. Pose overlay
Every reference product draws a skeleton over the swing now. Possible
on the phone with a pose model in the bundle, at a cost of several
megabytes and a frame rate that needs proving on an iPhone. Not before
the items above; a research spike first.

### Not doing
- Model swings from professionals: licensing, and "never invented".
- Prices, packs, payments: no pricing anywhere.
- An AI-written lesson summary: the note is the coach's own words.
- A second camera angle: two phones, one coach.

## Sources
- https://skillest.com/blog/best-online-golf-coaching-platforms-2026/
- https://onform.com/blog/best-video-analysis-app-for-coaches/
- https://play.google.com/store/apps/details?id=com.v1sports.coach
- https://apps.apple.com/app/id349715369 (V1 Golf: compare and overlay, model swings)
- https://deepswing.io/blog/the-best-golf-swing-analyzer-apps-in-2026?lang=en
- https://slashdot.org/software/comparison/CoachNow-vs-OnForm/
- https://apps.apple.com/us/app/coachnow-sports-coaching-app/id596598472
- https://skillest.com/features/swing-analysis and https://skillest.com/features/online-lessons
- https://www.coachiq.io/blog/best-tennis-coaching-software
- https://play.google.com/store/apps/details?id=com.sportsanalyticsinc.coachapp (TennisLocker)
- https://goodcoach.app/blog/post/48/top-online-coaching-apps-comparison (the 80% figure)
- https://coachnow.com/
