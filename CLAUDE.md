# Nosca — working notes for Claude Code

Nosca (Irish *nasc*, "to link") is a premium multi-sport coaching app:
golf, tennis, rowing, squash, padel, equestrian. A coach side and a
player side, plus parent and under-18 variants. Ireland-only,
English-only pilot. Vite + React + Tailwind + Supabase, deployed on
Netlify. The look is deliberately restrained — sport colour tints, it
never floods.

## Before every push

1. `npm run check` — undeclared names, JSX tags that resolve to nothing,
   duplicate attributes. The build does not catch these; they build
   clean and crash in the browser. A sign-in that blanked the whole app
   with "loadError is not defined" was exactly this.
2. `npm run build` — the deploy runs this. A failed build leaves Netlify
   serving the last good one, so fixes appear to do nothing.
3. `supabase/test/run.sh` whenever `supabase/nosca.sql` changed — runs
   it on a throwaway Postgres, twice, plus 50 behavioural checks and
   three upgrade paths. The push path stubs `net.http_post` and asserts
   that one notification enqueues exactly one request: `notify_push()`
   swallows every error by design, so a broken one passes any test that
   only checks the trigger exists — two such breakages shipped.
4. Render it. The Playwright scripts under `scripts/e2e/` drive the
   built app against a mocked Supabase: sign-up for every role, codes
   both ways, deletion, the walkthrough's ring alignment, a seed sweep
   that crawls every screen as each role (and records console warnings
   as failures), `dead-ends.cjs` which taps every control as every role
   and fails on any that does nothing, and `polish-shots.cjs` for a
   screenshot of every screen the founder looks at first.

Deploys cost credits. Get it right locally first.

## The live tree — nothing else is reached

```
main.jsx → App.jsx (auth gate)
             ├── lib/AuthContext.jsx   session + profile
             ├── pages/Auth.jsx        sign-up / sign-in
             ├── lib/useNoscaData.js   every database read and write
             └── Nosca.jsx             the entire UI (~14k lines, ~360 components)
                   └── lib/useCapture.js
```

`src/Nosca.jsx` is both the design prototype and the production UI.
`src/pages/*` (except Auth.jsx), `src/components/*` and
`App.pilot.jsx.bak` are dead code from an abandoned multi-file
approach. `?demo`, `#demo` or `/demo` renders the design harness with
seeded data and no account.

## Rules — each of these cost a deploy to learn

- **RLS: no policy on table X may query table X.** It recurses and
  every read fails with 42P17. Lookups go in `security definer`
  functions (`my_coach_id()`, `my_family_id()`, `my_family_ids()`).
- **Links move only through functions.** `coach_id` is set by
  `respond_to_request()` when a coach accepts; `family_id` by
  `create_family()` / `join_family()` / `leave_family()`. The profiles
  update policy refuses a row that changes either. A coach's code makes
  a `coach_requests` row, never a link; a family code joins at once.
- **Nobody is given a family.** A family is a row someone created. An
  adult in it looks after its juniors (`my_family_ids()`); a junior sees
  the family and nothing they cannot do. `data.family` is the family,
  `data.dependants` the juniors an adult looks after.
- **Notifications are written by triggers only** (section 10 of
  nosca.sql), in the same transaction as the thing they describe. The
  app reads, marks read and clears; it never inserts. New kinds go in
  the trigger, and the mock in `scripts/e2e/` must produce them too.
- **Uploads never fail silently.** Every attached file uploads in
  parallel with a status per file (`data.uploads`), shown on Today
  with the reason and a Retry. The per-file limit is `MAX_UPLOAD_MB`
  (50, Supabase's default; `VITE_MAX_UPLOAD_MB` if the project's limit
  is raised).
- **Sign-up is a database trigger** (`on_auth_user_created` →
  `handle_new_user()`). The browser sends everything as metadata in one
  `signUp` call and never touches `profiles` during sign-up. Nothing on
  `profiles` may reject an insert — the trigger must never raise.
- **Seed data must never reach a real account.** With `data` present a
  screen reads real values; seeds are for the harness only. The gate is
  the `LiveCtx` context (`useLive()`, provided by Nosca as `!!account`);
  the seed generators take `live` as a parameter. The tell is a
  component reading a top-level const like `MONTHLY`, `THREADS`,
  `ROSTER` without checking `data` or `useLive()` first. A real account
  either does the real thing through `useNoscaData` or does not show
  the control — nothing may toast and pretend.
- **One brand colour: `BRAND` in `src/lib/brandmark.jsx` (#123C30).**
  Deep bottle green. It is the loading screen, the app icon, the splash
  before a sport, the manifest, and `NEUTRAL.accent`/`mark` on sign-up
  and sign-in. Sport palettes tint the app only inside a sport. It is
  repeated as a literal in `scripts/icons.mjs`, `manifest.webmanifest`,
  `index.html` and `public/sw.js`, which run outside the bundle — change
  all five together. Contrast: paper on it 11:1, white 12:1.
- **The loading screen is the brand colour and one small grey ring.**
  No text, no mark, no wordmark. `BrandLoader` in `brandmark.jsx`; the
  only thing that ever joins the ring is the way out after a long wait.
- **One mark.** `brandmark.jsx` owns the two rings, because the gate in
  App.jsx renders before Nosca.jsx exists. The rings weave — each is
  broken by a gap where the other passes over — so nothing is knocked
  out with a background colour and the mark works on any surface. The
  app icons and the favicon are generated from the same numbers by
  `node scripts/icons.mjs` (heavier stroke than on screen, so the 29px
  settings icon iOS shrinks from the 180 still reads); change the
  geometry, run it, commit what it writes. Nothing may import Nosca
  from that file.
- **A date column is a day, not a moment.** `localDate("2026-09-08")`
  from `useNoscaData`, never `new Date("2026-09-08")` — the latter is
  midnight UTC, the evening before on any phone west of Greenwich.
- **Realtime is every readable table, and the database decides.** The
  hook's one channel listens to notifications, lessons, bookings,
  messages, requests, drills, tips, registers, profiles and preferences
  and debounces one `load()`. RLS applies to realtime as to a select,
  so nothing is filtered client-side. New tables go in the publication
  block of nosca.sql AND the channel's list.
- **pg_net lives in `net`.** `net.http_post`, whatever schema the
  extension was created in. `extensions.net_http_post` existed nowhere,
  the trigger swallowed the error, and every notification was written
  and none sent.
- **A confirmation is a line, not a ceremony.** `done(text, sub)`
  raises the toast with a tick — that is what every everyday action
  answers with. The full-screen `Celebration` is for the few moments
  that earn it: called off for weather, joining a coach or a family.
  Logging a lesson keeps its own burst; opening the app keeps the
  splash. Anything a coach does a dozen times in a sitting gets the
  toast.
- **Notifications are one shape.** The title carries the fact and
  nothing else; the body carries the detail that did not fit, and is
  null when there is none. No instructions, no encouragement, no full
  stops. It is read on a lock screen among twenty others.
- **Nothing is offered in the past.** The calendar context carries
  `nowMins` as well as the date (the harness is pinned to 9am so its
  screens are identical every run). `openTimes` drops today's times
  that have been and gone.
- **The walkthrough belongs to sign-up.** `pages/Arrival.jsx` is the
  only thing that opens it (a `nosca.tour.now` hand-off), and Arrival is
  only reached from sign-up. It used to key off a localStorage flag, so
  signing in on a new phone replayed the whole thing. Settings →
  Walkthrough is the way back to it.
- **Set yourself up.** A coach is offered `CoachSetup` once — three
  screens, hours · drills · tips, grids and rows, a body that scrolls
  — remembered as `preferences.setup_done`, and reachable again from
  Settings. Nobody is asked which stats they track, in either mode:
  nothing stores the answer, and a screen that asks and forgets is
  worse than one that never asked. It does not use `SignupShell`, whose
  body deliberately does not scroll.
- **One drill library.** A live coach's drills are `custom_drills` in
  their preferences — what they picked in setup plus what they wrote —
  held in `library[sport]`. The wizard, the Set-drills sheet and the
  Drills screen all read that one list; none of them reads the sport's
  starter set directly (the wizard used to, and offered drills the
  sheet had never heard of). `myLibrary` falls back to the sport's
  starter set while the list is empty, so a coach who skipped setup
  still has drills to set — a read only, nothing is written to their
  preferences. The harness, with no account, seeds the starter set in.
- **A coach's sport never changes.** `profiles.sport` is what their
  invite code was handed out under. Another sport goes in
  `preferences.extra_sports`, and `activeSport` is which of them they
  are working in; `coachSport` follows it, so the drill library, the
  tips and the groups all move together.
- **A parent's message is the parent's.** In a junior's thread three
  people can write: the coach, and any adult in the family on the
  child's behalf. Every message row carries `senderId` and `fromCoach`;
  a line that is neither mine nor the coach's is labelled with the
  adult's first name and "parent" (or just "Parent" where the coach
  cannot read the name). A parent's Chat lists their own conversation
  and the children's apart, the children's under the coach's name and
  marked "For <child>". Never let a parent's line read as the child's.
- **Who a booking is for is chosen before the slot.** The diary carries
  a "For" strip for any adult with a bookable child — themselves (if
  they have a coach) and each child — and the hours shown are that
  person's coach's. A parent with no coach of their own opens on the
  first bookable child. The request sheet and its button name the child.
- **Haptics happen inside the gesture.** iOS honours the switch trick
  only synchronously within the user's tap; a `setTimeout`, even of 0,
  is outside it. `buzz()` fires its first beat at once. Call `haptic*()`
  before any `await`, and never from an effect expecting it to be felt.
- **A screen's subtitle carries a value or it is not there.** `meta` is
  a count, a name, a date — never a sentence restating the title, and
  never a nought ("2 players · 0 groups"). The same goes for a Settings
  row's `sub`, and for the foot of a list: the diary ended on "End of
  your hours", which told a coach what they could already see, and
  carries Recurring lessons there now.
- **Settings is a list, not a page.** `Settings` builds `groups` of rows
  ({ label, sub, icon, onTap, right, tour, keys }) and renders them
  through one loop, so the search field filters everything and every
  row is drawn one way. Add a setting by adding a row; keep its `tour`
  id if the walkthrough rings it. No text-size control: the type is set
  once for everyone.
- **A coach may also be somebody's player.** `request_coach()` allows
  it, so `data.lessons` holds both what they taught and what they took.
  `taught()` is every coach-side list; `mineOnly()` is their own.
- **Only tips. No goals.** Competitions are the goals.
- **Space is a scale, not a number at the call site.** `SPACE.tight`
  between a label and the thing it labels, `SPACE.row` between two
  controls doing the same job, `SPACE.block` between two different
  things on a page, `SPACE.section` where the page changes subject.
  Before this the gaps were written inline — 22 here, mt-3 there — and
  the app read cramped in some places and loose in others, which is
  worse than either. The type scale came down a step for the same
  reason; nothing goes below 12px, which is the floor for a coach
  reading a phone at arm's length on a range. Every screen's H1 is
  `TYPE.screen`, one size, never `hero`.
- **One tile. A set you choose FROM is a grid of tiles; a named being
  in a list is a row; a value already chosen is plain grey text.**
  Nothing in between — the wrapping rails of round pills this replaced
  were one control drawn eight ways, and most of them ran off the right
  of the screen. `ActTile` (icon, one word, optional count or dot) in a
  `TileGrid`; a hairline at rest so a grid reads as separate things,
  ink when selected, the accent **once a screen** and only on the one
  action. Five shared pickers cover every case: `TimeGrid`,
  `PersonPicker`, `DrillPicker`, `FocusGrid`, `SportGrid`. Never wrap a
  `TileGrid` in a `Card` — the tile is the surface. `R.pill` stays: the
  tab bar, unread badges, avatars, search fields and the toggle knob
  are legitimately pills.
- **A tile's icon is optional, and usually wrong.** Where the word is
  the whole meaning — a focus area, a level, an option — pass no `Icon`
  and the label centres on its own. A table used to map each of the
  fifty focus areas to a glyph: a lightning bolt for the golf swing, a
  brain for the mental side, a heart for squash fitness. Every one had
  to be invented, none meant anything to a coach, and together they
  were the clearest tell that a machine laid the screen out. The icons
  that stay are the plain ones a phone already uses — plus, tick,
  camera, bell, calendar, chevron. No sparkles, no broadcast mast for
  weather, no bookshelf for a lesson. Settings rows carry no glyph at
  all, bar the red bin on Delete account, which is a warning rather
  than decoration.
- **Anything you can type in words, you can say.** Every field a person
  writes words into carries dictation — through `VoiceInput`,
  `VoiceArea` or `InlineField`, or as a `MicBtn` beside the input. The
  exceptions are the machine formats: a password, the six-character
  codes, an email address and a phone number, where speech hands back
  "Q W seven X two M" or "at gmail dot com" and the button would look
  broken. `Field` drops the mic for `type="password" | "email" | "tel"`
  itself, so a form gets this right without thinking about it. `MicBtn`
  renders nothing where the browser has no speech recognition, so it is
  safe to add anywhere.
- **A grid fills its rows.** `evenCols(n)` picks the column count so a
  four-tile grid goes two by two rather than three and a widow. Any
  grid whose length varies with the data uses it.
- **A control for narrowing a list appears when the list needs
  narrowing, and there is only ever one of them.** The roster's search
  above eight people, the drill library's filter above eight drills, the
  alert list's above a screenful, and the lesson archive's search and
  three filter rows above eight lessons. Three filter rows over a
  player's four lessons is a filing cabinet in front of a postcard, and
  a filter row over a sort switch is two things to read before the first
  row. A tab bar to a list that is empty is not a choice either — the
  roster's Groups half appears with the first group.
- **The board and the plus are one list of actions, and the coach owns
  it.** `COACH_ACTIONS` is the nine, each with one name and one glyph —
  never "Register" on one surface and "Attendance" on the other.
  `BOARD_ORDER` and `QUICK_ORDER` are the defaults; what a coach keeps
  rides on `preferences.layout` as `{ board, boardCols, quick }` and is
  read through `pickLayout`, which drops an id it does not recognise
  rather than drawing a blank tile. The editor is `LayoutEditor`,
  reached from the foot of the plus sheet and from Settings — never a
  permanent link under the board. The last remaining action cannot be
  removed. The save also goes to `localStorage`, so a project whose SQL
  has not been re-run still does what the coach asked.
- **The one behaviour: a coach picks up the phone mid-lesson, does one
  thing in seconds, puts it down.** Every coach screen is judged
  against that. Three surfaces reach the same handlers and nothing is
  ever taken away from one to feed another: the coach home's board (Log
  · Register · Capture · Tip · Drills · Add player, always on screen,
  and its verbs act on the lesson that is running when there is one —
  there used to be a filled block above it carrying Register, Capture
  and Log for that lesson, which put the word Register on the screen
  three times); the day's own rows, where the live lesson is marked and
  carries its register; and the raised plus, which
  keeps all eight of `QUICK_ORDER` with Log a lesson as its accent
  tile. The plus was removed once in favour of "the plus opens the log"
  and the founder wanted every row back the same day. Register and
  capture are also on the lesson itself (the peek sheet), drills and
  tips on the player file.
- **Logging a lesson is two screens: a face, then one page.** Who? is
  faces — on now and today first, then the groups, then Everyone as
  rows, with a search pill above eight people (prefix on any word,
  diacritic-insensitive; Return picks the top match); one tap picks and
  returns. Everything else is one scroll: the name and the day, the
  level they are already on (`HI 18.4`, `Green ball · U10`) which is
  touched only when it has changed and reads **`Set level`** in ink
  when there is none (the accent is spent on Log it) — and never blocks
  Log it; a grid of
  tiles for what was worked on, one per area in the sport's verified
  taxonomy, carrying the word and no glyph, **one tap and done** — there
  is no second grid of sub-areas underneath and no follow-up button; Video, Photo and Voice as three big boxes that open the
  camera itself; everything captured mid-lesson already attached, a
  swipe to the left taking one off for good; the note on the page, not
  behind a tap; Drills and Tip opening in place as tick rows; and
  **Log it**. The level and the horse are one page deep, inside the
  Wizard's own `view` state — never the app's single `<Sheet>`. A
  riding coach taps the horse from the ones they have been writing
  down. The date reads Today / Yesterday / `Sat 19 Sep`, never a native
  value; the transparent `<input type="date">` sits over that line only
  when no booking anchored the day. From a booking: one tile and Log
  it. `publish()` writes the lesson first and only then sets the drills
  and the tip for every recipient (the wizard's ids win over a saved
  group's members) and raises the burst; a failed write is said, never
  celebrated, and Log it reads "Logging…" while the write runs.
- **Every sport's taxonomy is the real one, verified against the
  governing body — never invented.** `SPORTS[x].stages` is the ladder a
  coach places a player on before anything else (tennis Red · Orange ·
  Green · Yellow then WTN; golf Handicap Index and the Passport levels;
  rowing J13–J18B and Novice → Senior; squash the ball dot; padel a 0–7
  level; equestrian Pony Club tests and riding-school stages), `extras`
  the second axis where one exists (boat, dressage level, fence
  height), `focus` what was worked on, `drills` the practice a coach
  sets, `statCatalog` the measures. Sources and the terms a real coach
  would flag are in the sweep report; do not "improve" a label without
  a source.
- **The stage rides on the lesson as a tag.** `subs` carries the stage
  label (or `HI 18.4` / `WTN 22` / `Level 3.5` for an input stage), any
  extras, the chosen sub-areas, and `on <horse>` for a rider; nothing
  changed in the database. `stageOf()`, `extraOf()`, `mountOf()` and
  `areaSubsOf()` read them back; `lastFor` remembers each player's last
  stage so the log opens on it. A riding lesson without the horse on it
  is the biggest tell to a riding coach.
- **The sport tints the app inside a sport; `NEUTRAL` before one.**
  `const base = inApp ? cfg.theme : NEUTRAL` — paper, ink and the greys
  are shared, the accent and wash are the sport's, and the four semantic
  colours never change. It was collapsed to one palette once and the
  founder called the result outrageous within the hour; the tint is the
  approved look. The accent appears once a screen (the one action).
- **A player's diary knows the coach's taken times, never whose.**
  `coach_busy_slots(p_player)` is a security-definer function returning
  date, time and length of the coach's requested and confirmed
  bookings for the next 90 days, excluding the asker's own; the booking
  rows themselves stay unreadable. `useNoscaData` exposes `busySlots`
  (mine) and `busyByPlayer` (per child), and the diary merges them into
  the day with `withBusy()` before drawing free slots.
- **Chat lists conversations, and the plus starts one.** The list is
  every thread with a message, unread first then newest; a coach's
  picker leads with "Everyone", which is the broadcast. Nothing else sits
  above the list — the weather call-off lives in the diary on the day.
- **The bell reads itself.** Opening the list shows Today, Yesterday and
  Earlier with the unread ones in ink; tapping one marks it, and closing
  the list marks the rest read. The right-hand button is "Mark all read"
  while anything is unread and "Clear all" after. The away card's
  Dismiss is the same mark-all.
- **An alert is a face and a badge.** Whatever happened, happened
  because of a person, and a face is read before any word beside it:
  `faceFor` matches the name the title opens with, and falls back to the
  coach for the kinds only a coach sends a player (`tip`, `lesson`,
  `drill`, `rating`). The kind rides as a small glyph badged on the
  corner of that face, so the line does not have to spell it out; where
  nobody is named the glyph is the disc itself and there is no badge. A
  filter over the list appears only past a screenful, like every other
  narrowing control.
- **Lessons is a list, and the lesson is the player.** A player's
  Lessons tab is the lessons newest first — a poster of the first file,
  the focus, one grey line — on the same paper as every other tab. The
  clip plays on the lesson page and only when tapped: `LessonStage`
  renders `<video>` without `controls` under one play disc, sized to
  the clip's own shape (a portrait clip stands portrait, no black bars),
  and hands the browser's controls over once it is playing. There was a
  full-bleed autoplaying swipe feed here once; no professional coaching
  tool (Hudl, CoachNow, Onform, TrainingPeaks) presents a coach's clips
  that way, and it put a dark screen under a paper tab bar.
- **The coach's day is two lists, not one.** *To log* is everything
  finished and not written up — today's, then the days before that were
  never written up — and every row carries Log. Below it is what is
  still to come, with the live one marked. One list where a lesson at
  nine this morning and one at five this evening were the same row was
  the thing the founder could not read.
- **A player's file opens on their history.** The first thing on it is a
  block the size of the thing it leads to: the number of lessons, when
  the last one was, and the whole archive behind it. Nothing above it,
  and the header does not repeat those two facts in small grey type.
- **A player's home leads with when they are next on**, at the size the
  coach's date is. The board comes before the tip, because the loudest
  thing on the screen should be something to do; the tip is a bordered
  block, never a filled slab of the accent. Under it the page is the
  coach's page: *Coming up* is the rest of what is booked and *Recent
  lessons* the last three with the way through to the rest, both as
  `RowHead` over a column of hairline rows — the same two sections the
  coach's day is built from. The two sides are read by the same
  household; a shape that means one thing on one and another on the
  other is a bug.
- **A surface is a fill and a hairline, never a shadow.** Tiles, cards,
  settings groups, the time grid, the segmented control: white on the
  paper with a 1px `HAIR(t.ink, 0.14)` edge at rest, ink when selected.
  Shadows belong to the bottom sheet, the raised plus and a dragged
  item, and to nothing else. White tiles floating on the tinted paper
  under a soft blur was the one thing every reference set (Linear,
  Stripe, Apple, Things, Hudl) named first as the "template kit" look.
- **One name per thing.** The tab label is the screen's H1 — Diary opens
  "Diary" for everyone, Drills opens "Drills" — and a control carries the
  same word on every surface: the plus sheet's foot says "Edit" and the
  Settings row "Shortcuts", and the tile says Drills, not Practise. A
  title is a noun or a verb, never a sentence or a question: "Who",
  "Book", "Request", "Hours". A placeholder is the noun of what goes in
  it ("Notes", "Tip").
  Labels never carry "you", "yourself", "someone" or "it" — "Log it" is
  the one the founder chose and keeps.
- **A count lives in one place, and only where it is acted on.** The tab
  bar badges unread messages and nothing else; a tile carries a plain
  figure only for what is undone (drills to do, lessons to log), never a
  total of the list beneath it; unread is one ink dot. No countdowns
  ("13h 39m away"), no relative ages ("1 day ago") — a row states the
  day and time. Two facts on a grey line, never three.
- **One date, one time.** `Thu 24 Sep`, `9:00 am`, everywhere — rows,
  headers, sheets, the diary's rail. Never an uppercase month, never
  "Sept", never a time stripped of am/pm to fit a column.
- **Rows, not cards, and one accent action a screen.** Roster, Drifting,
  Chat, Coming up, the family's people, the bell: hairline rows with an
  avatar, a name and one grey line. A search field appears only when
  the list is long (Roster: more than eight). Settings rows carry a
  `sub` only when it holds a value (the coach's name, the address),
  never a sentence explaining the label. A border is earned by the
  bottom `Sheet` and the player's tip block, and by nothing else.
- **Settings is three shapes and no fourth.** Label and chevron; label,
  a value on the right and a list that unfolds as rows with a tick; or
  label and a toggle. No bespoke control ever lives inside the list.
- **Chat is a list of people, so it is rows.** Do not tile it, the
  thread, the alerts list, the roster or the Who page's Everyone
  section. One unread signal a surface: a dot beside the time in the
  list, the number only in the tab bar. A parent's own conversation and
  their children's are two sections; the adult's name sits inside the
  bubble it belongs to, never floating above it.
- **Routes carry ids.** `player:`, `history:` and `archive:` take the
  roster id; `byKey()` in Nosca resolves a name from an older entry
  point. Two players with one name are two files.
- **The walkthrough is seven steps at most a role**, each an imperative
  naming the control it rings (Log a lesson · Tap what you worked on ·
  Add a clip · Log it · Take the register · Book a lesson · Add a
  player), a body of five words or none, dots for progress, Skip and one
  button. No area label, no breadcrumb, no counter, no Back. It was 26
  steps narrating settings rows; the founder asked for "Add a player".
- **The walkthrough is the app.** Each tour step renders a second
  `<Nosca showcase={…}>` (harness data, inert, scaled) and rings a real
  control found by its `data-tour` attribute. Add a step by adding the
  attribute and a TOUR entry; never type ring coordinates.
- **One bottom sheet.** Nosca renders sheet bodies inside its single
  `<Sheet>`; a body that wraps itself in another `<Sheet>` ends up 760px
  off-screen with pointer events off (Delete account and Live capture
  opened empty panels this way). Overlays that stay mounted while idle
  must set `pointer-events: none` (the toast strip swallowed taps).
- **A fill-mode of `both` pins what it ends on, and beats an inline
  style.** An animation that is filling wins over the element's own
  `style=` in the cascade, forever, because `both` holds the 100%
  frame after the animation ends. Three separate bugs in one round
  were this: `headerSettle` ended at `opacity: 1` over an inline
  `opacity: y > 24 ? 0 : 1`, so the large header never faded on
  scroll; `setIn` ended at `transform: none` over the press's
  `scale(0.985)`, so every tile in the app lost its movement and kept
  only its shadow; and `celebFade` ends at `opacity: 0`, which under
  Reduce Motion — where duration is forced to 0.01ms — held the
  Celebration invisible for its whole 1750ms while it blocked every
  tap. Use `backwards`: it applies the FROM frame during the delay
  and releases the element afterwards, so the element's own style is
  what remains. Anything whose visible state comes only from an
  animation needs that state in its `style=` as well.
- **Don't unmount the app on a refresh.** `loading` in `useNoscaData`
  is true for the first load only; the gate keeps `SignedIn` mounted
  while a profile refresh runs; `account` is memoised on its fields.
  Any of these regressing sends people back to the splash on every
  save.
- **Links are read fresh.** `hasCoach` / `hasGuardian` come from the
  person's own row on each load, not the cached sign-in profile.
- **Supabase updates blocked by RLS return success with zero rows.**
  Always `.select()` and check the length.
- **iOS Safari has no `navigator.vibrate`.** Haptics go through a hidden
  switch-type checkbox label click. Don't "fix" this.
- **Safari media URLs:** video needs object URLs; photos need data URLs.
- **Netlify's catch-all redirect strips query strings** unless
  `query = {}` is set in `netlify.toml`.
- Search for `new Date(20` before trusting any date logic.
- No pricing anywhere. No progress bar in sign-up. No region or
  language screens. Plain labels, no sales copy.

## Database

`supabase/nosca.sql` is the only SQL file. Adding a column is one
`alter table … add column if not exists` line beside the others, and
`supabase/test/run.sh` must pass before it ships; the project itself
only picks it up when the file is re-run in the SQL editor, so anything
that writes a new column degrades gracefully until then
(`preferences.layout` keeps the coach's board on the device).
 It sets up a fresh project
and upgrades an existing one, and is safe to run again — every
statement is idempotent, nothing in it deletes an account (the wipe at
the top is commented out). Every policy, function, foreign key and
storage rule lives there; change the database by changing that file
and re-running it. Its final block runs the reads as the
`authenticated` and `anon` roles — the only way to exercise row-level
security from the SQL editor, which otherwise runs as the table owner
and bypasses policies entirely — and stops the file if a policy errors
or leaks. The editor shows only the last statement's result, so the
file ends with one row that says what state everything is in.

## How the founder works

Root cause, not patches. Verify before claiming — render it, build it,
prove it. Fewer clicks, less clutter; every extra step gets challenged.
Coach and player parity: asymmetries are bugs. Feedback is direct and
usually precisely right about what is wrong, even when the cause is
somewhere unexpected.
