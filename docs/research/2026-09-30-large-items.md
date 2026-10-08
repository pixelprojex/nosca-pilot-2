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
| Follow-up drill with a due date | — | — | — | yes | **no** → built 3 Oct |
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

### 2. A clip from the player to the coach. **Built 4 October.**
As a camera in the thread's composer (the player's own thread, a
parent's for a child) → the app's camera → "Send to <coach>" with the
area and a note; a `lessons` row of the player's own (`sent_by`), the
file under their folder, "Sent a clip" in the thread opening it; the
coach's To review under Actions, then Mark it up; triggers tell the
coach once and the player when the take lands. No camera until the
SQL is re-run (`canSendClip` probes the column). `send-clip.cjs`.
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

### 3. Progress — a player's journey over time. **Built 1 October.**
As below, as `ProgressScreen` from the player file, the profile pill
and the child's screen; `scripts/e2e/progress.cjs`. Read on 1 October:
TennisLocker "uses charts and graphs to show parents, players and
coaches how an athlete is improving over time" and is free for parents
and players; CoachNow's Space "serves as their training history";
Pwap, SwingCoach AI, MyPlatfrm and Pro Golf Practice all sell the
progress chart. The level line, the ladder and the month columns are
that, read off the lessons.
No SQL: every lesson carries its stage tag (`HI 18.4`, `WTN 22`,
`Green ball`, `Level 3.5`, `J15`) and its areas. A Progress screen for
the coach on the player file and for the player behind the profile
pill: the level as a line over time (one small SVG, no library), the
areas worked on as counts, lessons a month, drills done. It says only
what the lessons say; where a sport's stage is not a number (the
Pony Club tests, the squash ball) it is the ladder with the steps
reached. Nothing asked, nothing stored — a screen that reads.

### 4. A drill with a day. **Built 3 October.**
Skillest attaches a follow-up drill with a due date to a lesson. Nosca
sets drills; a `due` day on `drills` (one alter table), the player's
Drills screen ordered by it, and the reminder as a notification from
the trigger. Small SQL, medium build, noticeable to the player.

### 5. A player's season report. **Built 2 October.**
As one page from the foot of Progress on all three sides —
`shareSeasonReport()`; `progress.cjs` reads the file back. Taken
ahead of 2 and 4 because both of those need the founder's re-run of
`supabase/nosca.sql`, still outstanding, and would land invisible.
TennisLocker sells "evaluations" to parents. Nosca has
`downloadLessonLog` for one lesson; a per-player report — the
lessons, the areas, the stage line, the drills, the coach's tips — as
one HTML page for the share sheet, from the player file and the
family screen. No SQL. Noticeable to a parent at the end of a term.

### 7. The evening before a lesson. **Built 5 October.**
Not from the first reading of the field but from its second: TeamSnap
messages a few days before an event, CoachAccountable mails the day
before and again half an hour out, CoachRx pushes at a time the coach
sets. Nosca had the bookings and the bell and no reminder at all.
`remind_bookings()` on the drills' hourly pg_cron, at six the evening
before: the player, a junior's adults, the coach once with the count.
No app change; nothing asked of anyone. behaviour.sql 8c.

### 8. A sent clip is answered. **Built 6 October.**
The two candidates below it, read against the field on 6 October and
built as one: V1 Golf's athlete sees a sent swing move through Sent ·
Accepted · Completed on their Lessons tab; Skillest's coach "records
their own videos with their analysis as well as additional drills and
sends them back inside the lesson"; CoachNow's reply to a post is
video, text or audio in the same Space. Nosca: Reply on the coach's
page for a sent clip, the line in the thread tied to the clip and on
both lesson pages under the player's question, "Niamh Byrne replied"
landing on the clip, and "Waiting on Niamh" on the player's side until
the words or the take land. The thread's clip lines carry the clip's
poster. `clip-reply.cjs`; behaviour.sql 8d.

### 9. Lessons in the phone's calendar. **Built 7 October.**
TeamSnap's "Sync Calendar / Export" (an iCal feed to subscribe to, or
an export) and CoachIQ's calendar sync are the field's shape; Nosca
has no server to serve a feed from and wants none, so it is the file:
Settings › Calendar, the count of confirmed lessons ahead, one tap,
one `.ics` through the share sheet (a VEVENT per booking, named for
the other person, the booking's id as the UID). Both sides.
`calendar.cjs`. Built with the visual item of the day: **Seen** under
the last line a person sent once the other side has opened the thread
(CoachNow's read receipts; the phone's own convention).

### 10. Attendance on Progress. **Built 8 October.**
TennisLocker records attendance "with a quick tap" and lets parents
"see when their player attended practice"; USTA's Serve captures
attendance and tells parents. Nosca took the register and showed a
player only "Absent" on one lesson's page. Progress now carries
Attendance off the registers — the count, a mark per register, the
missed days — on the coach's, the player's and the parent's view and
in the season report. No SQL: `attendance_marks` were already
readable by the player and the family. `progress.cjs`. With it, the
visual item of the day: a child's row in the coach's Chat leads with
the parent's first name when the parent spoke last.

### Next candidates (unranked until read against the field)
- A second reminder the morning of, or an hour before, if the founder
  asks; CoachAccountable sends both.
- An acknowledgement from the player on a reply — CoachNow's "fist
  bump" — if the coaches ask for one; a tap, never a form.
- A calendar feed to subscribe to, if the file is not enough: a Netlify
  function serving a person's bookings as iCalendar under a secret per
  person, which is what TeamSnap's Subscribe button is. Needs a column
  for the secret and a function; the file first.

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
- https://apps.apple.com/app/id1433835828 (TennisLocker Coach: charts over time for parents)
- https://help.coachnow.io/en/articles/10809209-coachnow-academy-101 (a Space as the training history)
- https://rationalgo.ai/resources/app-builder/golf-lesson-student-handicap-improvement-tracker
- https://mwm.ai/apps/swingcoach-ai/6760660742
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
- https://austintennisacademy.com/?p=6280 (TennisLocker: attendance with a tap; parents see when their player attended)
- https://usta.clubspark.com/providers/coaches (USTA Serve: registration, attendance capture, communication with players and parents)
- https://www.teamsnap.com/blog/general-sports/learn-how-to-sync-your-personal-calendar-to-your-teamsnap-calendar (Sync Calendar / Export; Subscribe in the app)
- https://coachnow.io/blog/what-athletes-see (read receipts: who viewed and when)
- https://help.v1sports.com/en/articles/2981457-send-swings-to-instructor (Sent · Accepted · Completed on the athlete's Lessons tab)
- https://skillest.com/blog/app-why-skillest (the coach's analysis sent back inside the lesson)
- https://help.coachnow.io/en/articles/362744-how-do-i-post-media and https://coachnow.io/athletes (reply with video, text or audio; the fist bump)
