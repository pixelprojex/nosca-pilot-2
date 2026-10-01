# Rendering the app to prove it — the Playwright scripts

These drive the built app in headless Chromium against a mocked Supabase
(every request to the Supabase URL is answered in-process, shaped like
the real API after `supabase/nosca.sql`). They need no account, no
network and no credits. They are how every change in this repo was
verified before it was pushed.

Needs: Node 20+, Playwright 1.48 or later (`npm i -g playwright` and
`npx playwright install chromium`, or set `PLAYWRIGHT_MODULE` to a
checkout's path and `CHROMIUM_PATH` to a Chromium binary).

Build once against the mock URL, then point a script at the build:

```sh
VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=mock VITE_SUPPORT_EMAIL=help@nosca.ie \
  npx vite build --outDir /tmp/nosca-dist
node scripts/e2e/signup.cjs /tmp/nosca-dist 4181 /tmp/nosca-out/signup
```

## The mock — `mock.cjs`

One in-process Supabase, shared by every script. It carries the tables
the app reads (`profiles`, `families`, `coach_requests`,
`notifications`, `lessons` through `lessons_view`, `lesson_media`,
`drills`, `tips`, attendance, `bookings`, `competitions`, `recurring`,
`preferences`, `messages`, `reviews`, `push_subscriptions`), the RPCs of
sections 6, 8 and 9 (`find_*_by_code`, `join_coach`,
`respond_to_request`, `cancel_request`, `leave_coach`, `create_family`,
`join_family`, `rename_family`, `leave_family`, `coach_availability`,
`delete_my_account`) with their human error sentences, the sign-up
trigger of section 5 (a coach code becomes a *pending request*, a family
code joins, a parent with no code gets a family made), the notification
triggers of section 10 (the mock writes the same rows the database
would, so the bell and the catch-up have something real to show), and
both storage buckets (`media` signed, `avatars` public). The realtime
socket is swallowed.

`db.offline = true` makes every request fail as a lost connection;
`db.failFetch = (path) => true` makes one signed file answer 500; and
the build's service worker runs in every suite's browser, so the shell
it keeps is exercised whenever a page reloads.

Every read is filtered from the caller's JWT the way the row-level
security policies filter it, and every write is checked the way the
with-check policies check it (refused writes come back 403) — so a
player never receives a row the database would not give them, and a
leak the app has is a leak these tests can see. When a policy or a
trigger changes in `nosca.sql`, change it here too.

Scripts share a fixture shape: Niamh Byrne coaches (code `QW7X2M`),
Cian Murphy is an adult player of hers, Orla Kelly is a parent whose
family (`KEL7Y2`) holds Saoirse Kelly, a junior coached by Niamh. Each
script adds the people its scenarios need.

| script | what it proves |
|---|---|
| `signup.cjs` | the whole sign-up and sign-in flow: coach / parent / adult / under-18, codes checked live (`find_coach_by_code`, `find_family_by_code` showing "name · N people"), what the trigger makes of each — a coach code is a pending request ("You've asked …", then Request sent), a parent with no code gets a family created and sees its code, a parent with a code joins, an under-18 must enter a family code, the parent's codes step has no coach field — the arrival screens, forgot password and the recovery link, `?join=` and `?family=` deep links pre-filling the boxes, check-your-inbox, existing email, Ask to join / Withdraw from the home screen, join links opened while signed in |
| `auth-basics.cjs` | the smaller set: sign in, wrong password, session across reload, the four sign-ups and what the trigger makes of each, a wrong code, asking a coach from home |
| `families-requests.cjs` | one database across every role: a player withdraws a request (`cancel_request`); the coach sees who asked on Today, accepts (`respond_to_request` true → `coach_id`) and declines; the accepted and declined players' openings; an adult starts a family (`create_family`, code + Copy), a second joins by code (lookup, `join_family`, the family notification), the dashboard lists both, then leaves (`leave_family`); a parent lands on Family with Family / Lessons / Diary / Chat, the junior's card with Next / Last lesson / To practise, Book a lesson into the child's coach's hours (a requested booking for the junior), Message coach; the junior's own view has nothing to book, no code and no Leave |
| `notifications.cjs` | three unread rows → the catch-up on opening, a tap lands on the lesson and marks only that row read, the bell count, the alerts list, a message notification opens the thread, Carry on marks all read, a fresh open with nothing unread shows no overlay, Clear all deletes the person's rows only, a coach's pending request as a job in the list, `?open=family` on load |
| `delete-account.cjs` | You → Your profile → Delete account → wrong password refused → right password: media files removed by full path, the profile picture removed from `avatars`, `delete_my_account` called, signed out, landing |
| `seed-sweep.cjs` | signs in as each role (session injected) and crawls every screen it can tap into, then walks to family, its settings, the profile, alerts, notifications, requests and a player's file on purpose, failing on any seeded name, number, email or code; reports 0 hits, 0 page errors, every newer screen reached |
| `dead-ends.cjs` | signs in as each role and taps every button, tab and link on the home, every tab, the profile, the alerts and the plus, once each, back on the very same screen before every tap (the role's saved preferences are put back, and the control is found again by its label and its place among controls with that label, skipped if it is already in the state it would put you in); anything that does nothing — no screen, sheet, toast, navigation, dialog, file input, share, or change of its own state or label — is a dead end, and console noise fails too |
| `core-loop.cjs` | lessons open by id with real media, download a lesson log, real chat (send, read, message everyone), attendance and live capture on today's bookings, the wizard's real voice note, the roster row's real lesson count and the player file listing that player's lessons newest first, and two attached files uploading at once with one refused 413 — the status strip on Today names the file and the reason and Retry lands it; the mock's triggers tell the player and the family — 46 checks as coach, adult and under-18 |
| `diary.cjs` | booking requests and confirmations, drills and tips set outside the wizard, competitions, recurring lessons, the diary's Your hours card (Not set yet → N slots a week, tapping it opens Availability), Your profile (name, sport, date of birth, club, a photo through the avatars bucket and the header, password), the Notifications screen's push switch, invite routes, and the honesty pass — 68 checks (build with `VITE_SUPPORT_EMAIL` set) |
| `walkthrough-alignment.cjs` | opens `/?demo`, runs all four walkthroughs step by step and asserts each ring encloses its target; serve the build first: `npx vite preview --outDir /tmp/nosca-dist --port 4190` |
| `review.cjs` | Mark it up: the clip on a full-screen stage, marks anchored to their moment (a new moment fades the last), pinch zoom, Photo of the frame, Save with no microphone and Talk over it, the take standing in for the clip, the file the app sent decoded and its ink read back, and the same from the log — with a fake camera and microphone |
| `capture.cjs` | the camera: Capture opens live on the whole screen, PHOTO · VIDEO · VOICE by tap or swipe, a clip, a still and a voice note kept, the roll and Remove, the filing pill, and the captures already on the lesson when it is logged |
| `compare.cjs` | Compare: the button beside Mark it up under a clip (the player's on its own), the picker of the player's other clips newest first with Clip 1 · Clip 2 on a lesson with several, two clips side by side muted, Play and Pause on both, a frame on moving both, the pill's › nudging one clip alone and the pair keeping the offset, ½× on both, the scrub back to the lined-up starts, Swap, Change, the coach's Save recording the pair as a new 1280×720 clip on the lesson with both halves drawn and the player told, a parent on a child's lesson with the child named, and a player with one clip and nothing else not offered it |
| `downloads.cjs` | downloads and Saved: the disc saves a lesson whole onto the phone (the record with its note, tip and drills, whose it is, and every file as a blob — read back out of IndexedDB), the tick, the header's Saved opening on Downloads with the count and the size, Settings › Downloads landing there too, the row with the poster from the phone, the Downloads half as a feed playing from the phone, a slow file's ring with no figures in it and the sheet's Cancel leaving nothing behind, the lesson page playing from the phone, the sheet (Update saving a newer copy, Share as a file with the note, the tip and the drills in it), a file that will not fetch failing with its reason and Retry from the list, the app opening with no network at all on the worker's shell and the last load with Offline said, a downloaded lesson playing offline and one never downloaded saying so, the network coming back, a swipe removing one with its files and Remove all; the player from the feed card; a parent on a child's lesson |
| `feed.cjs` | the feed: real files play, the panel says what the lesson was, one clip plays at a time with the sound following the scroll (the rest paused, muted, on their first frame), a tap on the picture pauses, ½× stays on from card to card, the strip scrubs and switches files, a landscape clip fills the screen like a portrait one, leaving the app stops the clip and lets it go, a star on the card and on the lesson page with Saved › Starred on both sides (as a list and as a feed), and a player with nothing yet is told so |
| `back.cjs` | Back puts you where you were: a lesson opened from deep in the archive and two Backs land on the archive and then the player file exactly where they were; a fresh open starts at the top; the feed comes back on the card it was on with the filter still set; a tab away and back keeps the home's scroll; the Diary keeps Calendar, the month and the day; a swipe up over the plus (a `pointercancel`, the phone taking the gesture) and a hold that turns into one open nothing, and a tap does; a coach's player file opens on List and a player's home on the feed, Settings › Default view (first row, both sides) changes it, writes `preferences.default_view` and the phone's copy, and holds after a reload. |
| `progress.cjs` | Progress: the coach opens it from the first foot row of the player file and reads the level now and then with a point per reading, the areas worked on counted most first, a bar per month with a lesson in the last six, drills done of set, and Back lands on the file; the player opens the same journey from the profile pill; a player with nothing reads "No lessons yet" and nothing is drawn; a parent opens the child's from the child's screen under the child's name; a tennis player sees the ladder with the steps reached ticked and the current one dated, and no line. |

Every script takes `<absolute dist dir> <port> <absolute output dir>`
(except the walkthrough one, which reads a running server on its PORT)
and prints PASS/FAIL lines, screenshots to the output dir, and exits 0
so you can read the lines rather than parse an exit code. A FAIL line
is either a broken script or a real finding; the scripts say which
they believe in the line itself.
