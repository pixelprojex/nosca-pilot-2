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

### 11. A practice of the player's own. **Built 9 October.**
Tennispreneur is a player's private journal — thoughts and reflections
after every lesson and match — that the coach reads and comments on;
Ace It keeps a practice log with a coach dashboard; Golf Grind logs
practice by skill. Nosca had a clip to the coach and nothing for the
practice a player does on their own. Log a practice under the Drills
tab: the areas as tiles, a note, Save; the row is the player's own
(kind practice), reads Practice in their list, the coach is told once
that they practised, and Progress counts it apart from the lessons on
both sides. SQL: the kind constraint admits 'practice'; the trigger's
own branch. `practice.cjs`; behaviour.sql 8e. With it, the visual item
of the day: the family's Coming up row names the person reading it
rather than "You".

Reply stands on the coach's page for a practice as on a sent clip, so
Tennispreneur's coach comment on a journal entry is already there.

### 12. A coach's own note on a player. **Built 10 October.**
SportMember's private notes (only the writing coach sees them, in the
player's profile), BridgeAthletic's athlete notes (tied to the coach
who wrote them), Volt's profile notes, TrainingPeaks' private notes:
the thing a coach keeps in their head between lessons. Nosca's player
file had the tiles, the lessons, the tip and Progress, and nowhere for
"left-handed, hates bunker drills". Notes is a row at the foot of the
file, the sheet one field, the note on the coach's own preferences row
keyed by the player; a project without the column keeps it on the
phone. `notes.cjs`. With it, the visual item of the day: the feed's
paused play disc sits in the picture above the glass panel rather than
over the title.

### 13. A framing guide on the live camera. **Built 11 October.**
V1 Golf's capture screen carries an alignment guide — a marker over
the picture to set the golfer's distance from the camera, with
down-the-line and face-on guides for the setup, and none of it in the
recorded video; every guide to filming a swing says the same things
(the camera at hand height, down the line along the target line, far
enough back that the clubhead stays in frame); the phone's own camera
has a grid. Nosca's camera had the picture and nothing to line it up
against. A Guide button up top, beside the filing pill, cycles Off ·
Grid (thirds) · Lines (a plumb line and a level through the middle),
drawn over the live picture only — the recorder takes the stream, so
no line is ever in a clip or a still — and kept on the phone the way
the phone keeps its grid. The visual item of the day; `capture.cjs`
(b2). With it, the small functional fix: a coach who also takes
lessons and stars one of their own now finds it under Saved › Starred
(the half read only what they taught).

### 14. Away — the days a coach is not coaching. **Built 12 October.**
PGA Coach's Blocked Times ("vacations, personal appointments,
tournaments, facility closures, travel": the availability is removed
for the window), FreshLearn's days off on a calendar, SimplyBook's
block-out for a golf tutor: every booking product lets a coach take a
week off in one go. Nosca's week was seven weekdays and nothing else:
a holiday meant emptying each day by hand in the diary, and a player
could ask for a lesson in the middle of it. Away is a Settings row for
a coach (found by "holiday"), spans of days on their hours
(`availability.away`, read by a player through `coach_availability()`
like the rest), and both diaries offer nothing on those days and say
so — the coach's day reads Away with what was booked before and Call
off beside it, a player's reads "Niamh is away", the month grid strikes
the days through. The functional item of the day; `away.cjs`. The
visual half is the diary's reading of it: the struck days, the Away
row in the list, the player's line.

### 15. The roster reads where each player stands. **Built 13 October.**
A coach scans a roster to see who is next and who has gone quiet;
CoachNow's Smart Lists segment athletes by activity, TennisLocker
tracks attendance by session, and the research behind Drifting called
quiet players the single thing a solo coach most needs to see. Nosca's
roster row carried a total — "2 lessons" — which told a coach nothing
they would act on. The grey line is now the next confirmed lesson
("Thu 15 Oct · 10:00 am"), else the last one taught ("Last lesson ·
Sun 11 Oct"), with Drifting in the caution colour where the home's own
rule says so, else "No lessons yet"; the level sits on the right as a
value; the count stays on the player's file ("All 3 lessons"). The
visual item of the day; `roster.cjs`. With it, the small fix: the
diary's day meta no longer reads "0 booked · 0 free" or "0 available"
— a nought is not a fact worth a line.

### 16. Study a clip — slow, a frame at a time, a loop. **Built 14 October.**
Every video product gives the athlete the transport on one clip: V1
Golf steps frames at full, half and quarter speed, Kinovea loops a
working zone the play head runs inside, OnForm goes down to frame by
frame, Dartfish holds a key position. Nosca's lesson page played a clip
with the browser's own controls (its approved shape, kept), the feed
slowed to ½× only, and Compare needed a second clip — so a player alone
with one clip could not slow it, step it or watch the top of the swing
over and over. **Study** sits beside Mark it up and Compare under a
video on the lesson page, for both sides from one clip, and opens the
clip on the dark stage with play, a frame either way, 1× · ½× · ¼×,
the scrub with the time, and **Loop** — From here, To here, the span
drawn on the picture's foot and the head going back to the start every
time it reaches the end. No SQL, no server. The functional item of the
day; `study.cjs`. With it, two small visual fixes from the screenshot
sweep: the unread dot no longer sits on lessons a person has already
read (it marks only the coach's To review, where opening clears it),
and the family's child row carries what is undone, never a lesson
total.

### 17. The cancel reason reaches the other side. **Built 15 October.**
Every booking product that lets one side cancel carries the why to
the other: TeamSnap's cancelled game takes a reason in its Notes and
Notify Team sends it; GoRendezvous shares the cancellation reason in
the client's notice; Calendly's host writes an optional message that
reaches the invitee's cancellation mail (and its users ask for the
same the other way); Teamer's cancelled event carries a message;
Healthie reports cancellation reasons back to the practice. Nosca's
Cancel sheet asked Why and promised "They are told straight away with
the reason" — and `cancelBooking` wrote the status alone, so the
player read the day and the coach's name and the coach read only
"Cian Murphy cancelled". Now `bookings.cancel_reason` (one column,
120 characters, degrading to today until the SQL is re-run) rides on
every cancellation — the peek's Cancel, the diary's, the call-off's
non-weather reasons, and a player's or parent's own Cancel, which
asks the same Why with no password and ends on one button — and
`trg_bookings_notify` leads the notice with it: "Unwell · Sat 10 Oct
10:00 am". Two facts a line: the coach's name gives way to the reason
on the player's notice. The functional item of the day;
`cancel-reason.cjs`, behaviour.sql 8f. With it, two small visual fixes
from the screenshot sweep under one rule (one date, one time): the
booking-request rows on the coach's home and on Alerts read the
weekday like every other row, and the coach's book sheet names the
month.

### 18. The type floor. **Built 16 October.**
CLAUDE.md has said since the type scale came down a step that nothing
goes below 12px — the floor for a coach reading a phone at arm's length
on a range — and the app did not meet it: `TYPE.caption` was 11px on a
hundred and fifteen lines, fifty literals from 8.5 to 11.5 sat beside
it, and a face's initials were drawn at a third of the disc (7.9px in
the header pill). Apple's HIG sets 11pt as its minimum with Caption 1
at 12pt and iOS's tab labels at 10pt; Material's body-small is 12sp;
WCAG sets no size, only 200% resize. The founder's floor is the
stricter, so the ladder now ends on it: caption is 12, every literal
is on the floor, `Avatar` floors its initials and the header pill's
disc grows to carry them, the bell's count disc is iOS's 18. Two
written exceptions, each the phone's own convention: the tab bar's
labels (the one surface the founder asked kept as it was) and the
sign-up wordmark. `type-floor.cjs` reads the computed size of every
word on every screen as every role, so the floor is kept the way the
dead-ends crawl keeps the taps. The visual item of the day; with it,
one small functional fix from the audit — a player's own lesson is a
row in the Diary's List view and a requested hour is not offered again
(the default view drew only free hours, so the lesson they came to
check was a hole in the day).

### 19. Message a group, into each member's own thread. **Built 17 October.**
A coach's Chat plus offered Everyone and then the people, so a squad of
six was six threads and six identical lines. Every product in the
field lets a coach reach a group; the question is how. CoachNow's Lists
are a BCC post into each athlete's own Space, and every reply comes
back privately; TeamSnap keeps a team chat apart from direct messages;
a club WhatsApp group puts every family's words and every child's name
in front of every other family, which the GDPR advice to Irish clubs
warns against, and the LTA lets a coach message an under-18 only
through a channel that includes a parent. Nosca's junior thread is
already that channel — the family's adults read it — so the group
message fans into each member's own thread: a row per saved group
under Everyone, the sheet naming the group and who it goes to, the
group's page carrying Message as a player's file does. No SQL: a
shared thread would need a group the database can see. The functional
item of the day; `group-message.cjs`. With it, one small visual fix
from the screenshot sweep: the parent's own Chat preview names who
spoke last, so a parent's words no longer read as the coach's.

### 20. The last hairline lists, boxed; one add control. **Built 18 October.**
The boxed list had reached the home, the bell, Chat and the diary, and
stopped at the sheets: the lesson's peek, the register, the Message
picker, the pick-a-player sheet, Drifting, the roster's groups, the
player file's foot and the child's screen still drew hairline rows
under a section rule — two list languages in one app, and on the
roster and every lesson list a row of the old one drawn inside a box
of the new. Apple's guidance is one list style per kind of content,
used the same way throughout; Material's list is a container of
items with consistent spacing and dividers or none. The register's
people and the tip prompts read as one set, so they take the diary
day's shape: one box, rows inside. The header's + was drawn four ways;
three carried an ink plus on the accent at 2.06 to 3.39:1, under
WCAG 1.4.11's 3:1 for the parts of a control a person needs to see,
and an empty tick box on the hairline read 1.2:1. One `HeaderAdd`
with a white plus (5.03 to 8.23:1) and the tick box on the edge (3.0
to 4.1:1). The visual item of the day; `boxes.cjs`. With it, one small
functional fix: a booking's notification opens the Diary on that
lesson's day, the way Android's guidance has a notification open the
thing it describes rather than the app's front screen.

### 21. Ending a recurring lesson cancels what it booked. **Built 19 October.**
End on a recurring arrangement deleted the row and left every lesson it
had booked in the player's diary and the coach's, and nobody was told;
an edit deleted and re-inserted the row and said "Updated" over lessons
left on the old day; the Diary's Recurring row opened a blank Set up.
The field is settled on this: Google Calendar asks "this event, this
and following, or all events"; TeamSnap offers Update All Future;
Fresha, Unified Practice and Therapy Appointment cancel all remaining
occurrences of a series in one step and tell the client; TimeTap sends
a notice for the whole series. Nosca's End is the "this and following"
of that set, with the app's own way of taking a lesson from somebody —
the reason, the lessons ticked, the password — and a run's lessons now
carry the run (`bookings.recurring_id`). An edit keeps the run and says
the booked lessons stay; moving them, with a notice, is the next step.
The functional item of the day; `recurring.cjs`; behaviour.sql 10c.
With it, one small visual fix: the Diary's Recurring rows boxed.

### 22. A Chat thread drawn in runs. **Built 20 October.**
Every line in a thread was its own bubble with its own time and tail,
so a coach's three quick lines read as three messages and half the
thread was timestamps. The messengers agree on the shape and on what a
run is keyed by. Signal Desktop groups lines by the same author on the
same day within three minutes and hides the time and status on all but
the last (`timelineUtil.std.ts`), draws them 2px apart with a joined
corner on the sender's side (`_modules.scss`), and names the author on
the first line only in a group (`Message.dom.tsx`); Telegram pins
bubbles going the same way within five minutes, and in a group only
from the same sender, with the tail on the bottom bubble only
(`ChatActivity.java`, `MessageDrawable.java`). Nosca keys a run on the
sender, never the side — a junior's thread has three writers on the
left — keeps the scale's 6px rather than Signal's 2px, keeps every
bubble of a run fully round but the last (iMessage's way, not Signal's
joined corners), and keeps a parent's label on every bubble of her run
where Signal names the author once, because a parent's line read as
the child's is the one thing the thread must never do. The visual item
of the day; `thread-runs.cjs`. With it, one small functional fix: the
coach's drill library did what its toasts said (`drill-library.cjs`
(c1)–(c11)).

### 23. The Diary's per-day sheet is that date. **Built 21 October.**
The pencil on a Diary day opened a sheet titled with the date that
wrote every change to that weekday for every week: one tap took 9:00
off every Thursday, emptying it erased Thursdays from every player's
diary and hid a confirmed lesson from the coach's List, and its Group
only / Private only were never saved. The scheduling tools agree that
a date is changed apart from the week: Calendly's date-specific hours,
Acuity's override hours for specific days, PGA Coach's Open Time
("without changing your recurring schedule") and Blocked Times beside
Recurring Hours, Arketa's overrides (deleting one restores the week),
MoeGo's date override. Nosca's sheet writes the date into the coach's
own hours (`availability.blocked`, which the Calendar view's Block
already wrote, and a new `availability.extra`), so every diary reads it
through `coach_availability()` with no SQL; the week is a row at the
foot that opens Hours on that weekday. The functional item of the day;
`edit-day.cjs`. With it, one small visual fix: the register's Present,
Absent and walk-in moved off a 0.5px hairline onto the sport's edge
(`boxes.cjs` (r1)–(r4)).

### 24. The weekly lists boxed. **Built 22 October.**
The boxed list (a box per row on the sport's edge) had reached every
list a coach and a parent open daily by 18 October; the weekly ones —
the lesson page's drills, the Compare picker, the Calendar view's free
times, the group page's sessions, New group's people, the setup's
lists, the attendance record, the push prompt — still drew text
between hairlines, two list languages in one app, with an undone
drill's tick at 1.9:1 against the 3:1 a control's edge needs (WCAG
1.4.11). Apple's guidance is one list style per kind of content;
Material's list is one container of consistent items (item 20). Two of
those lists also read "15 Oct" and "05 Oct" against the app's one day.
Hours' Add a time was the last rail of round pills on a live screen.
Hours' days and the profile card were already edged surfaces, so they
keep their own box rather than taking a second inside it. The visual
item of the day; `lists.cjs`. With it, one small functional fix: the
times a coach offers on Cancel and on declining a request are that
day's open times (`offer-times.cjs`).

### 25. A group's lessons reach its members. **Built 23 October.**
A group booking carried a name and no player, and the notification
trigger returned for it: a clinic booked, rained off or cancelled told
no member and no parent, the evening's reminder skipped it, and a
member's Diary drew the clinic's hour as a hole. Every group-scheduling
product that documents it tells the members when a session is
cancelled, usually with the reason — Spond's Cancel and notify
recipients, TeamSnap's Notify your team, Playtomic emailing every
enrolled player when a class or a series is cancelled — and most remind
them before it (TeamSnap two days ahead, Spond 48 hours); PGA Coach puts
the coach's group event in the student's own app. No product found lets
a member cancel a session for everyone: they answer for themselves
(Heja's going / not going, Teamer's accept or decline with a reason,
CourtReserve's withdraw), which is the next functional candidate. The
functional item of the day, from the prototype of 21 October;
`group-notify.cjs`, behaviour.sql 8f. With it, one small visual fix:
the coach's day rows and the child's values line up with their boxes
(`boxes.cjs` (a5), (a6), (n4)).

### 26. The Diary's Calendar view, and the sheets it opens, boxed. **Built 24 October.**
The selected day of the Calendar view and the three sheets that take a
lesson away from somebody were the last of the Diary drawn the old way:
a player's own lessons between hairlines with a 20px Cancel that ran
into the time at 320, the coach's lessons as pale 16px accent cards,
the call-off row a 0.5px rule with a rain glyph, the day named twice, a
span that lost its am across noon, a clinic at the diary's 45 minutes
on the coach's side, and the reasons a 1.2:1 hairline with the chosen
one a 1.09:1 tint. WCAG 1.4.10 asks that content work at 320 CSS pixels
without loss; WCAG 2.5.8 sets 24px as the least target and 2.5.5 44px
as the enhanced one, Apple's own minimum. The visual item of the day;
`calendar-day.cjs`. With it, one small functional fix: the first yes is
the player's coach, a second coach's Accept refused in words.

### 27. A member says Not going to one group lesson. **Built 25 October.**
The notices of item 25 told every member of a clinic when it was
booked, rained off or cancelled, and a member still had no way to say
they would miss one session: a parent texted the coach, or the coach
found out at the register. Every product aimed at training answers for
one session, and a parent answers for a child: Spond's Attending or
Decline, its recommended setting for weekly training enrolling
everyone so members "only need to unsubscribe" (help.spond.com
articles 129730, 67817); Heja's Going or Not going, tapped by a parent
for a child (help.heja.io article 14643676); TeamSnap's Yes · Maybe ·
No (helpme.teamsnap.com article 94); Teamer's Accepted or Declined with
a reason only admins see; SportMember's attending or not with an alert
to the coach; 360Player's parent switching to each child to accept or
decline; CourtReserve's Withdraw Registration for a clinic. Answers
stay apart from the register, which the coach takes and can override
(Spond, 360Player). Nosca takes Spond's training default — everyone is
going and only a no is stored — with no unanswered state, no Maybe and
no nagging: Not going, then Going to undo it, on the member's block,
for an adult or a parent answering for a junior; the coach told by
name with the day, the count on the day and the names on the lesson,
and those members already Absent on a register not yet taken; a member
out not reminded the evening before. The field research could open no
vendor page directly (every fetch refused); its claims are from the
vendors' own help pages as search excerpts. The functional item of the
day; `rsvp.cjs`, behaviour.sql 8h. With it, one small visual fix: the
header's controls answer a finger 44 tall without a glyph moving
(Saved, Search and Alerts 35 wide, 27 in the feed's pill, as wide as
their spacing allows without overlapping); Back, the month chevrons and
the diary's pencil 44 square; `hit-areas.cjs`.

### Next candidates (unranked until read against the field)
- One person row (visual, about a day): the face-and-name row is drawn
  about ten ways — eight face sizes from 30 to 46px, the name starting
  57 to 73px into the box, rows 56 to 76 tall — and at 320 the item on
  the right cuts the name or the time on four surfaces. A shared row
  with one face, one inset and a trailing slot that yields first.
- A reason on Not going, optional, read by the coach first as a
  cancellation's is (Teamer, TeamSnap, SportMember, 360Player): a
  `reason` column and the Why sheet. And answers locked once the
  register is taken (Spond, CourtReserve).
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
- https://help.v1sports.com/en/articles/2337963-video-analysis-in-the-v1-golf-app-with-ios (V1 Golf: frame forward and back; full, half and quarter speed)
- https://kinovea.readthedocs.io/en/stable/observation/playback_ui.html (Kinovea: the working zone the play head loops inside; a frame back and forward)
- https://glasgowarchers1948.co.uk/2022/06/20/onform-video-analysis/ (OnForm: playback down to frame by frame)
- https://blog.dartfish.com/2014/04/03/nine-things-you-can-do-with-a-key-position-or-still-shot/ (Dartfish: a key position held and studied)
- https://apps.apple.com/app/id596598472 (CoachNow: Smart Lists segment athletes by their activity)
- https://apps.apple.com/app/id1433835828 (TennisLocker Coach: session-based attendance, player evals)
- https://support.pga.com/en/articles/4810156-managing-when-you-re-available-to-coach (PGA Coach: recurring availability, open time, Blocked Times for vacations, tournaments, closures)
- https://freshlearn.com/support/availability (FreshLearn: days off on a calendar; a day switched off with sessions cancels them and tells the members)
- https://news.simplybook.asia/?p=1868 (SimplyBook.me: a golf tutor blocks times they will not be available)
- https://help.playbypoint.com/en/articles/12864625-how-players-book-lessons-through-book-a-pro (Book a Pro: a day with no times says "Go to next available date")
- https://help.v1sports.com/en/articles/6244813-quick-start-guide-v1-golf (V1 Golf: the alignment guide on the capture screen, DTL and Face On guides, not in the video)
- https://swing-analysis.v1sports.com/swing-analysis/swing-recording.md (V1: face-on and down-the-line, camera at hip/hand height, a stable mount)
- https://www.golf.com/instruction/2019/08/31/record-golf-swing-video-6-things/ (filming a swing: hand height, along the target line, far enough back)
- https://practical-golf.com/how-to-record-your-golf-swing-properly (the same setup rules, with distances)
- https://apps.apple.com/app/swingdraw/id6746954769 (SwingDraw: a grid over the swing)
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
- https://sportmember.co.uk/en/faq/coach/members--3 (SportMember: private notes only the writing coach sees)
- https://intercom.help/bridgeathletic/en/articles/5507324-managing-athlete-notes-in-bridgeathletic (BridgeAthletic: athlete notes tied to the coach who wrote them)
- https://help.trainingpeaks.com/hc/en-us/articles/38758068849805-Private-Notes-FAQ (TrainingPeaks: private notes)
- https://apps.apple.com/app/id6475751909 (Tennispreneur: a player's journal the coach reads and comments on)
- https://mwm.ai/apps/tennispreneur/6475751909 (Tennispreneur: reflections after every lesson and match)
- https://apps.apple.com/mx/app/ace-it-app/id6746839427 (Ace It: a practice log with a coach dashboard)
- https://austintennisacademy.com/?p=6280 (TennisLocker: attendance with a tap; parents see when their player attended)
- https://usta.clubspark.com/providers/coaches (USTA Serve: registration, attendance capture, communication with players and parents)
- https://www.teamsnap.com/blog/general-sports/learn-how-to-sync-your-personal-calendar-to-your-teamsnap-calendar (Sync Calendar / Export; Subscribe in the app)
- https://coachnow.io/blog/what-athletes-see (read receipts: who viewed and when)
- https://help.v1sports.com/en/articles/2981457-send-swings-to-instructor (Sent · Accepted · Completed on the athlete's Lessons tab)
- https://skillest.com/blog/app-why-skillest (the coach's analysis sent back inside the lesson)
- https://help.coachnow.io/en/articles/362744-how-do-i-post-media and https://coachnow.io/athletes (reply with video, text or audio; the fist bump)
- https://helpme.teamsnap.com/article/979-cancel-or-delete-games-and-events (TeamSnap: a cancelled game's reason in Notes, Notify Team)
- https://help.gorendezvous.com/en/articles/8561483-keep-a-canceled-appointment-on-the-schedule-and-or-share-the-cancellation-reason-with-the-client (GoRendezvous: the reason in the client's cancellation notice)
- https://community.calendly.com/how-do-i-40/can-i-give-reason-why-a-appointment-was-cancelled-in-the-automated-mail-1665 (Calendly: the host's optional message reaches the invitee's cancellation mail)
- https://help.teamer.net/knowledge/app/manage-events (Teamer: a cancelled event carries a message to the team)
- https://help.gethealthie.com/article/1264-deep-dive-cancellations-report (Healthie: cancellation reasons reported back to the practice)
- https://developer.apple.com/design/human-interface-guidelines/typography (Apple HIG: Caption 1 at 12pt, Caption 2 at 11pt, the minimum)
- https://developer.apple.com/design/human-interface-guidelines/tab-bars (Apple HIG: tab bar labels, the one exception's warrant)
- https://developer.android.com/reference/kotlin/androidx/compose/material3/Typography (Material 3: body-small 12sp, label-small 11sp)
- https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html (WCAG: no minimum size, 200% resize)
- https://coachnow.io/blog/eliminate-repetition (CoachNow Lists: one post into each athlete's own Space)
- https://help.coachnow.io/en/articles/402775-what-is-a-list (CoachNow: athletes do not see who else received a List post; replies come back privately)
- https://www.lta.org.uk/about-us/safeguarding/parents-and-carers/parents-tips-and-resources/ (LTA: a coach messages an under-18 only through a channel that includes a parent)
- https://www.williamfry.com/knowledge/do-sports-clubs-whatsapp-groups-breach-the-gdpr/ (William Fry: club WhatsApp groups and the GDPR)
- https://help.teamsnap.com/article/2005-overview-of-message-types-on-teamsnap-one (TeamSnap: team chat and direct messages as separate kinds)
- https://developer.apple.com/design/human-interface-guidelines/lists-and-tables (Apple: lists and tables, one style for a kind of content)
- https://m3.material.io/components/lists/guidelines (Material 3: a list as one container of consistent items)
- https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html (WCAG 1.4.11: 3:1 for the visual parts of a control needed to identify it)
- https://developer.apple.com/design/human-interface-guidelines/buttons (Apple: a button's glyph and fill, consistent across an app)
- https://developer.android.com/develop/ui/views/notifications/navigation (Android: a notification's tap opens the content it describes)
- https://support.google.com/calendar/answer/37113 (Google Calendar: delete this event, this and following events, or all events in a series)
- https://helpme.teamsnap.com/article/307-manage-repeating-events (TeamSnap: Update All Repeated, Update All Future, Update This Only)
- https://www.fresha.com/help-center/knowledge-base/calendar/261-create-repeat-appointments-1 (Fresha: cancelling a repeating appointment asks whether it applies to the whole series)
- https://support.unifiedpractice.com/en/knowledge/repeat-appointments (Unified Practice: cancel one appointment or all remaining in a series)
- https://support.therapyappointment.com/article/362-how-do-i-delete-repeating-appointments (Therapy Appointment: Cancel All Future Occurrences)
- https://timetap.atlassian.net/wiki/x/ToCAAw (TimeTap: one notice when staff cancel a whole repeating series)
- https://github.com/signalapp/Signal-Desktop/blob/main/ts/util/timelineUtil.std.ts (Signal: a group is one author, one day, under three minutes; the time and status on the last line only)
- https://github.com/signalapp/Signal-Desktop/blob/main/stylesheets/_modules.scss (Signal: 2px inside a group, 12px between, the joined corner on the sender's side)
- https://github.com/signalapp/Signal-Desktop/blob/main/ts/components/conversation/Message.dom.tsx (Signal: in a group chat the author's name on the first line of a run)
- https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/ChatActivity.java (Telegram: bubbles pinned within five minutes, the same sender in a group)
- https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/Components/MessageDrawable.java (Telegram: the tail on the bottom bubble of a run only)
- https://help.calendly.com/hc/en-us/articles/360055073694 (Calendly: date-specific hours apart from the weekly hours)
- https://help.acuityscheduling.com/hc/articles/27016341585421 (Acuity: override hours for specific days)
- https://support.pga.com/en/articles/4810156-managing-when-you-re-available-to-coach (PGA Coach: Recurring Hours, Open Time without changing the recurring schedule, Blocked Times)
- https://help.arketa.com/appointments/availability/overrides (Arketa: deleting an override restores the week)
- https://help.moego.pet/en/articles/11774243-date-override (MoeGo: date override)
- https://help.spond.com/en/articles/25854-how-do-i-cancel-or-delete-a-single-event (Spond: Cancel and notify recipients)
- https://helpme.teamsnap.com/article/979-cancel-or-delete-games-and-events (TeamSnap: cancel an event, Notify your team)
- https://helpmanager.playtomic.com/hc/en-gb/articles/48825792808721 (Playtomic: cancelling a class or a series emails the enrolled players)
- https://helpme.teamsnap.com/article/267 (TeamSnap: reminders before an event)
- https://help.spond.com/en/articles/26059 (Spond: a reminder 48 hours before)
- https://support.pga.com/en/articles/15436955 (PGA Coach: a group event the coach books appears in the student's MyPGA app)

- https://www.w3.org/WAI/WCAG22/Understanding/reflow (WCAG 1.4.10: content at 320 CSS pixels without loss of information or two-way scrolling)
- https://dequeuniversity.com/rules/attest-ios/1.0/touch-target-size (touch targets: 44x44 points on iOS; WCAG 2.5.8 sets 24 CSS pixels as AA, 44 as AAA)

- https://help.spond.com/app/en/articles/129730-features-in-events (Spond: a weekly training event can enrol everyone, so members only need to unsubscribe)
- https://help.spond.com/en/articles/67817-faqs-events-in-the-spond-app (Spond: Attending or Decline; the organiser sees Going, Unanswered and Can't go)
- https://help.spond.com/en/articles/25931-spond-app-using-the-app-as-a-parent-or-guardian (Spond: a guardian answers for the child)
- https://help.spond.com/app/en/articles/131887-register-attendance-and-download-attendance-history-in-the-spond-app (Spond: the register is the coach's, apart from the answers)
- https://help.heja.io/en/articles/14643676-how-to-rsvp-to-an-activity-in-heja (Heja: Going or Not going, a parent for a child)
- https://helpme.teamsnap.com/article/94-set-game-and-event-availability (TeamSnap: Yes, Maybe or No per event)
- https://help.teamer.net/knowledge/member/events/view-team-events (Teamer: accept or decline, with a reason admins see)
- https://www.sportmember.co.uk/en/attendance-tracker (SportMember: attending or not, the coach alerted)
- https://help.360player.com/en/articles/10267995-respond-to-an-event-invite (360Player: a parent accepts or declines for each child)
- https://help.courtreserve.com/en/articles/11787240-public-booking-setup-guide-and-overview (CourtReserve: withdrawing from a clinic)
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced (WCAG 2.5.5: 44 by 44 CSS pixels, the enhanced target)
