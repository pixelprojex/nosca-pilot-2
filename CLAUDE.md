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
   as failures), `coach-day.cjs` for the plus, the call-off and Cancel
   behind their passwords and the Download discs, `dead-ends.cjs` which
   taps every control as every role
   and fails on any that does nothing, and `polish-shots.cjs` for a
   screenshot of every screen the founder looks at first.

Deploys cost credits. Get it right locally first.

A Routine runs `docs/cycles/README.md` every morning: research, one to
three small items, the full verification, merge, and a dated summary in
`docs/cycles/` that the next run reads first. Steer it with an issue
titled "Cycle".

A deploy reaches a phone only when the app is fully relaunched: a
home-screen app that is merely backgrounded resumes the bundle it was
opened with. So the build stamps its time into the bundle and into
`/version.json` (vite.config.js), Settings › Version shows which build
a phone is running, and the app compares itself against the server on
every return to the front and reloads itself when it is newer and
nothing is open. **Sync**, the row beneath Version, is the same check
by hand (`syncBuild`): the newest build loads, or the toast says "Up to
date" with the build it has, or why the server could not be asked —
the founder asked for one tap to be sure of being current. Before
chasing a fix that "did not come through", ask for the Version row —
three rounds were spent on fixes that had landed.

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
- **Uploads never fail silently, and nothing waits on them.** Every
  attached file uploads in parallel with a status per file
  (`data.uploads`), shown on Today with the reason and a Retry.
  `logLesson` returns the moment the row is written and the files
  follow behind the coach's back — Log it read "Logging…" until the
  last clip was in, which on a range is a minute of watching a button;
  the founder asked for every upload to go on in the background rather
  than stall a page. The same for a file added to a logged lesson, a
  mark-up take, a still, a comparison: the screen is left at once and
  Today's banner carries it ("Uploading 2 files", "Making 1 clip"). The per-file limit is `MAX_UPLOAD_MB`
  (50, Supabase's default; `VITE_MAX_UPLOAD_MB` if the project's limit
  is raised).
- **Capture is the phone's camera, not a form.** `LiveCapture` is an
  overlay of its own (rendered after the app's `<Sheet>`, never inside
  it — a fixed layer inside the sheet's transform is positioned against
  the sheet): the live picture fills the screen and comes up on open
  with no tap to start it; PHOTO · VIDEO · VOICE along the bottom,
  chosen by a tap on the word or a swipe across the picture; the
  shutter under them, white for a still, red for a clip or a voice
  note, the red square to stop; the last capture as a thumbnail
  bottom-left that opens the roll (and Remove); Choose a file
  bottom-right; and what it files under as a pill up top that cycles
  today's bookings. Its chrome is the app's, not the phone's: paper
  pills with the ink on them over the picture, the modes as the app's
  own `Segmented` on the paper, an ink-ring shutter, the roll and the
  file on the wash — it was black glass and white capitals for a round
  and the founder asked for the app's style. One camera stream serves
  all three modes — a voice note records off its microphone track
  (`useCapture.record`). It was
  a 3:4 viewfinder in a sheet behind "Tap to use the camera" with a
  segmented control, and the founder could not see what they were
  filming. `scripts/e2e/capture.cjs` drives it with a fake camera.
- **Every clip live capture records is also handed to the phone.**
  `saveToDevice()` in `LiveCapture` fires a download the moment the
  recorder stops (`nosca-<player>-<date>-<hhmm>.<ext>`), because until
  the lesson is logged the clip exists nowhere else and a swipe on the
  log takes it off for good. The app never depends on that copy being
  there and says nothing about it that it cannot see.
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
  repeated as a literal in `scripts/icons.mjs`, the manifest's
  `background_color` and `public/sw.js`, which run outside the bundle —
  change them together. Contrast: paper on it 11:1, white 12:1. The
  `theme-color` meta in index.html and the manifest's `theme_color` are
  NOT the brand: they are the paper (see below).
- **There is no loading page; the sport splash is the front door.**
  `BrandLoader` in `brandmark.jsx` is white and empty: the mark appears
  only after three seconds, as a sign that something is taking too
  long, and the way out after longer still. The splash (`Splash`, the
  mark landing on the sport's colour) plays on every open, for every
  account — it was gated to once every twelve hours for an hour and the
  founder wanted it back immediately. The loader was the brand green
  with a grey ring, then paper with a ring, then paper with the mark;
  the founder wanted it gone, not redesigned.
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
- **Hours: nothing goes by a tap.** `Availability`'s start times are a
  grid of tiles under "Slots and lesson length"; **Edit** (top right of
  the grid) turns each tile's corner into a red minus and only then
  does a tap remove one, **Done** puts it back; **Add a time** is one
  tap on the half hours not yet in the list (`HALF_HOURS`, six in the
  morning to half nine at night). A tap on a time deleted it for a
  round, and typing "7:30 pm" into a box was the only way to add one;
  the founder asked for the phone's Edit. The pool starts as
  `DEFAULT_SLOTS` — nine to nine, an hour each, the last lesson
  starting at eight — and a day switched on takes the whole pool. The
  week itself still starts empty: nothing is offered to a player until
  the coach has said when. The diary's per-day sheet (`EditDay`) offers
  the same pool.
- **The mark sits top-left on every root screen, as tall as the icons
  across from it.** `Screen` puts `Mark` (`HEADER_MARK`: 36 wide at a
  weight of 3, so the rings stand the 18px the search and the bell's
  glyphs do, in the sport's `mark` tone) in the corner a root screen
  leaves empty — where a pushed screen has its Back chevron; the
  walkthrough's own header carries the same one. It is the one piece
  of branding inside the app: no wordmark, no header logo, no band.
  The founder asked for slightly more branding, unobtrusive, then for
  the mark bigger and bolder to the height of the icons: at 20px it
  read as a detail beside them.
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
- **Settings is a list, not a page, and it is searchable.** `Settings`
  builds `groups` of rows ({ label, sub, icon, onTap, right, tour, keys })
  and renders them through one loop; the search field under the profile
  row filters every row by label, value and `keys`. Add a setting by
  adding a row with keys; keep its `tour` id if the walkthrough rings
  it. The search was cut once and the founder called that a big miss —
  it stays. No text-size control: the type is set once for everyone.
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
  `TileGrid` in a `Card` — the tile is the surface. **A rim is for the
  prominent few.** `TileGrid` with more than six children (and
  `TimeGrid` with more than six times) provides `ClusterCtx`, and a
  quiet tile inside it drops its edge and takes the wash instead —
  eight rimmed boxes on the plus, a dozen on the log's focus grid, read
  busy and the founder said so. The board's six, a pair, a single tile
  keep the sport's edge. `R.pill` stays: the
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
  safe to add anywhere — and where it exists but cannot start, every
  failure is said in a line ("Microphone access was declined", "No
  microphone found", "Dictation needs a connection", "Didn't catch
  that", "Couldn't start the microphone"): a mic that went quiet with
  no word was a dead end to the coach holding the phone, and the one
  thing the dead-ends crawl kept finding.
- **A grid fills its rows.** `evenCols(n)` picks the column count so a
  four-tile grid goes two by two rather than three and a widow. Any
  grid whose length varies with the data uses it.
- **Search is the field and the results, nothing else.** No "Try"
  suggestions under an empty search — they were cut at the founder's
  ask — and one microphone that gives way to the clear cross.
- **A control for narrowing a list appears when the list needs
  narrowing, and there is only ever one of them.** The roster's search
  above eight people, the drill library's filter above eight drills, the
  alert list's above a screenful, and the lesson archive's search and
  three filter rows above eight lessons. Three filter rows over a
  player's four lessons is a filing cabinet in front of a postcard, and
  a filter row over a sort switch is two things to read before the first
  row. A tab bar to a list that is empty is not a choice either — the
  roster's Groups half appears with the first group.
  The Who page is the one exception, at the founder's ask: its search
  and its filter tiles are always there.
- **The board and the plus are one list of actions, and the coach owns
  it.** `COACH_ACTIONS` is the nine (Log · Register · Capture · Tip ·
  Drills · Add player · New group · Call off · Competition), each with
  one name and one glyph — never "Register" on one surface and
  "Attendance" on the other. Call off took Message's place: a coach
  can open Chat, and calling lessons off is the thing they need in one
  tap. The plus sheet is Log a lesson full width at the top, then
  `QUICK_ORDER` — the eight, two to a row, `ActTile wrap` so a word
  like Competition takes two lines rather than an ellipsis — with Call
  off among them in red (`tone="danger"`, the only red tile in the
  app). Call off sat beside Log in a top row for one round and the
  founder called it messy; it lives in the grid. The eight went four
  to a row for one round and the founder asked for two to a row back
  the same day: the old way looked nicer.
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
  keeps every tile of `QUICK_ORDER` under Log a lesson.
  The plus was removed once in favour of "the plus opens the log"
  and the founder wanted every row back the same day. Register and
  capture are also on the lesson itself (the peek sheet), drills and
  tips on the player file.
- **Logging a lesson is two screens: a face, then one page.** Who? is
  faces: the search at the top whatever the roster's size; a row of
  filter tiles under it — All, the age bands somebody on the roster is
  in (U10 to U18, `WIZ_BANDS` and `ageBandOf`; a junior with no date of
  birth is U18 by their own word), Adults, and each group, only what
  has somebody in it (`wiz-who-filter`); then on now and today first,
  then the groups, then **Everyone as the same grid of face tiles**,
  the surname under the first name so two of a name are two tiles —
  never rows: one person in a box over a list of the rest was the
  thing the founder called very strange. A filter narrows the page to
  one grid that names itself; the search narrows further (prefix on
  any word, diacritic-insensitive; Return picks the top match); one
  tap picks and returns. `scripts/e2e/who.cjs`. Everything else is one scroll: the name and the day, the
  level they are already on (`HI 18.4`, `Green ball · U10`) which is
  touched only when it has changed and reads **`Set level`** in ink
  when there is none (the accent is spent on Log it) — and never blocks
  Log it; a grid of
  tiles for what was worked on, one per area in the sport's verified
  taxonomy, carrying the word and no glyph, **a tap per area worked
  on** — Short game and Driving in one lesson are two ink tiles, joined
  with " · " in `focus` (the archive's Worked on filter splits on it),
  and there is no second grid of sub-areas underneath and no follow-up
  button; Video, Photo and Voice as three big boxes that open the
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
  colours never change. Golf is `#2F6B3A`, a deep grass green (hue 131°,
  saturation 39%) — white on it is 6.4:1 (4.5:1 is the floor for a
  filled button's label). It was a mustard, `#896B27` then `#957019`,
  and the founder called that obnoxious and not sporty; then `#1C6E3A`,
  which sat too close to tennis' court teal `#0F7A69` (hue 170°) and
  the founder asked for the two to be more distinct; then `#3A8032`, a
  brighter fairway green the founder found not grown up enough — green
  is right, quieter and deeper is the professional version. Tennis is
  the reference for how a sport colour should feel — saturated, modern,
  the sport's own; golf is grass, tennis is teal, forty degrees apart.
  It was collapsed to one palette once and the
  founder called the result outrageous within the hour; the tint is the
  approved look. The accent appears once a screen (the one action).
- **A sport tile is its sport's colour.** `SportGrid` (sign-up's sport,
  the profile's Sports you coach and Add another, a player's main
  sport) fills each tile with that sport's wash, edges and dots it with
  that sport's mark, and fills it with the mark once chosen — the one
  grid where the palette is the subject, so it says what each sport's
  colour is. An add tile carries one plus, the glyph, and the word
  alone; it carried a "+ " in the word as well for a round.
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
  above the list — the weather call-off is on the plus and in the
  diary on the day.
- **Call off is a reason, the days, the lessons, the password.**
  `CallOff` (the `weather` sheet, opened from the plus, the peek and the
  diary) has nothing to do with weather in its name or its glyph — a
  calendar with an X — because a coach calls off for a bug or a closed
  course as often as for rain. Why first (`CALL_OFF_REASONS`: Weather
  and the coach's cancel reasons), then Which days — every day ahead
  with lessons, from `callOffDays()`, as tiles carrying the count, as
  many as they like, the day they came from already picked — then
  Which lessons, all ticked, untick any that still go ahead, then the
  password. Weather writes the `weather` status; any other reason is a
  `cancelled` booking, because those are the two statuses a booking
  has, and the notification trigger tells the player which. Never a
  "whole day or one lesson" fork: the ticks are that.
- **Taking away somebody else's lesson ends on the coach's password.**
  The call-off, the peek's Cancel (the `cancelLesson` sheet —
  it was "No show", and the word is Cancel everywhere now, the toast
  "Cancelled") and Move's "Cancel the lesson" all finish on
  `ConfirmPassword` with `data.verifyPassword`, which signs the coach
  in again with their own email: a wrong password is refused and
  nothing is written, and the way back reads `closeLabel` ("Keep it",
  "Back"). A player cancelling their own lesson is not asked — it is
  theirs. `scripts/e2e/coach-day.cjs` walks both, wrong password first.
- **All lessons is its own row on the coach's home, never under
  Actions.** The archive is not a chore; `today-archive` sits in a box
  of its own under the Actions list, carrying the count.
- **The coach's home is Today, the next day folded, then Actions.**
  Today's column is today's lessons only. The next day with lessons —
  "Tomorrow", or the day it is — is one row under it carrying the
  count, which opens to its rows on a tap (`today-nextday`); its first
  lesson sat at the foot of Today's column once and the founder read
  the column as every future lesson in one list. **Actions** (it was
  "To do") is there only when something wants the coach: booking
  requests with Accept · Decline, To write up, Join requests, Messages,
  Drifting, Competitions; past two kinds of thing a row of tiles (All ·
  each kind) narrows it, and under two there is no filter to read
  before the first row.
- **Downloads are inside the app, the way Netflix keeps them, and a
  download is every part of the log.** The founder asked for this in
  those words: the disc used to hand the lesson out as an HTML file
  through the share sheet, which is not a download anyone recognises.
  Now `DownloadDisc` (38px on every `LessonRow`, 40px on every
  `FeedCard`, and the foot of the lesson page in words) has four
  states: the arrow (not on the phone), a ring filling with the
  percentage inside it (coming down), a filled disc with a tick (on
  the phone), the arrow in red (it failed; a tap retries). One tap
  saves the lesson whole onto the phone — the record (focus, subs, the
  day, who, the note, the tip and the drills set alongside it, the
  register's mark, the coach's name) and every file as a blob — into
  IndexedDB (`src/lib/offline.js`: `lessons`, `files`, `snapshots`,
  each row carrying its owner, so a shared phone never shows one
  account the other's). `src/lib/useDownloads.js` is the hook: per-file
  progress from the stream, a failure said with its reason and kept in
  the list with Retry (files that landed stay), the same tap on a
  downloaded lesson opening its sheet — **Open · Update · Share as a
  file · Remove** (Update fetches what changed and keeps the old copy
  if it fails; Share as a file is the old HTML export, now with the
  drills and the tip from the record); while it comes down the sheet
  is how far and **Cancel** (an `AbortController` in the hook; a first
  download cancelled leaves nothing behind, an update cancelled keeps
  the old copy); after a failure it is why, **Retry** and **Remove**.
  The ring carries no figures — nothing in the app goes below 12px,
  and a percentage inside a 38px disc was — the arrow fades inside it
  instead, and the tick pops in (`tickIn`, via `usePop`) when the ring
  completes. `DownloadCtx` (provided by Nosca) is how every surface
  reads it; `downloadLesson` is the one tap. Downloads live in
  **Saved** (below) — they were a row under All lessons and above the
  player's list for a day, and the founder could not find them there;
  Settings › Downloads opens the same half. **A downloaded lesson
  plays from the phone, online or not**:
  every reader of a lesson's files goes through `mediaFor` in Nosca,
  which hands back the phone's copy (object urls) where there is one
  and signs from the server where there is not; offline and never
  downloaded, the lesson page says "Not downloaded" rather than a
  skeleton that never ends. A row's grey line carries the whole name:
  two players with one first name are two files. A deleted account
  takes its downloads with it. `scripts/e2e/downloads.cjs` walks all
  of it, offline included; `coach-day.cjs` (e) and `core-loop.cjs`
  (b) share the file through the sheet.
- **Saved is one star in the header, on every home, for both sides:
  Starred and Downloads as the two halves of one screen, each with
  List · Feed.** `IconBtn tour="saved"` sits before Search on
  `navRight`, `slimRight` and `juvRight`; it opens on Downloads when
  nothing is starred and something is on the phone, else on Starred.
  The screen is `CoachArchive` (routes `saved`, `saved:starred`,
  `saved:downloads`; the old `starred` and `downloads` names land
  there too) with `head` (the `Segmented` Starred · Downloads,
  `saved-kind`), `plain` (the search and the filters only past eight
  lessons), `metaText` ("3 starred" · "2 downloads · 84 MB"),
  `factsFor` (whose, or the day; the size, how far, or why it failed),
  `onRemove` (each row in a `SwipeRow`, `downloads-row`) and `foot`
  (Remove all past one). The Downloads half's posters and its feed come
  from the phone: `downloadMediaMap` in Nosca is the local copies in
  the shape of `liveMedia`, merged over it. "Nothing starred" and
  "Nothing downloaded" are the empty halves. The founder asked for
  both to be somewhere intuitive and viewable in the feed view; rows
  at the foot of lists were neither.
- **Motion is a glide, never a cut — and every piece of it honours
  Reduce Motion through `.calm`.** A tab arrives with `tabIn` (a short
  rise, `backwards` fill, keyed `root:<tab>` so it plays once per
  change; a pushed screen keeps `pushIn`, a popped one `popIn`); the
  `Segmented` control has one thumb that slides to the chosen option
  (`translateX` on an absolutely placed surface) rather than a surface
  that jumps; a `Poster` fades in when its picture has loaded, and
  after 900ms regardless; a star pops when it fills (`starPop`) and
  the download disc when its ring completes (`tickIn`), both through
  `usePop(on)`, which is true for a beat after `on` turns true and
  never on first paint. None of it changes a layout; the founder asked
  for the app to be easier to glide through, not for it to look
  different.
- **The app opens with no network, on its kept copy — and the network
  comes first whenever there is one.** Three pieces. `public/sw.js`
  keeps this build's shell (the files `/precache.json` lists, written
  by `vite.config.js` at build) and serves it only when a navigation
  fails; online, every navigation goes to Netlify, `/version.json` is
  never cached, and the hashed files under `/assets/` are immutable so
  a cached one is never wrong. The app says `nosca:precache` to the
  worker on every open and the worker refreshes its copy when the
  build has changed. This is the whole difference from the app-shell
  caching this file used to refuse: a cached shell served instead of
  the network made a deploy appear to do nothing; a cached shell
  served only when the network is gone is what lets a download open
  on a plane. `useNoscaData` writes the last good load to the offline
  store (`putSnapshot`, after a load where the profile and the lessons
  both came back) and serves it only when a load fails for want of a
  network — the phone saying it is offline, or the client's own
  "Failed to fetch" on both of those queries — with `data.offline`
  true until a load succeeds again (the `online` event triggers one);
  any other failure still shows the error page. `AuthContext` keeps
  the profile row in localStorage the same way. The strip above the
  screen (`offline-strip`, the CAUTION colour, "Offline · 2
  downloads") is the phone's own word or the kept copy, and it goes
  the moment a load succeeds. Nothing is written offline; a write
  says what the client said.
- **A swipe row is the iPhone's.** `SwipeRow`: the first 88px reveal
  Remove and the row rests there; pulling on, the red follows the
  thumb across the row, and past 60% of its width the label jumps to
  the far edge with one firm tick (`haptic(14)`; a lighter one coming
  back under). Letting go past the mark deletes; letting go before it
  does not; nothing goes while the thumb is down, a cancelled pointer
  never deletes, and the click the browser fires after a drag is
  swallowed so a swipe that began on the row's own button never
  presses it. It deleted mid-drag at 140px for one round and the
  founder asked for the stretch and the haptic. Rows are keyed by
  `captureSeq()`, never `Date.now()` (the harness pins the clock, so
  two clips got one id and a swipe took both) and never the index (the
  row that moved up inherited the swiped-away one's state).
- **`TOP_AIR` (12px) sits above every header, on purpose.** The
  `Screen` header row and the feed's header pill start 12px lower than
  they need to, so the top of a screen is never under a phone's status
  bar or a browser's chrome. The founder saw the old cream band there
  as a blur three times; the air is the intentional version of that
  space, and it stays the same on every screen.
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
- **The feed is the player's home, and it stays.** A player's Home tab
  (the house icon; there is no separate Lessons tab for a player) opens
  on the feed: a full-bleed clip that runs from the very top of the
  screen to the very bottom — `LessonFeed` sets `BleedCtx` while it is
  mounted, the shell drops the safe-area spacer and lays the tab bar
  over the content instead of above it, and the bar's glass goes
  nearly solid (`TabBar solid`) so its labels read over a clip; the
  glass panel and the fade sit `BAR_H` higher to stay clear of it —
  the List · Feed switch top left (the same `Segmented` as the player
  file, the archive and the list view, at the height of the header
  pill; the feed had its own two-icon pill once and the founder asked
  for one style), the
  header's own controls (profile pill, search, bell) on a light pill
  top right so they are reachable from every screen, a glass panel
  bottom (the focus in display type as a set of areas — split on the
  " · " the log joined them with, each kept whole, the size stepping
  down with the count so five areas read on two balanced lines rather
  than one line cut mid-word; one tag line of the day, the kind and
  the level, never the coach's name — a player has one and a coach
  knows their own, and the founder asked for the box cleaned; the note
  cut to a line with "more", the sound toggle beside the title for a
  video; the sound and the ½× are kept for the sitting in
  `FEED_MEMORY`, because the feed unmounts under every lesson page and
  a state that started over turned the sound off again every time a
  lesson was opened and closed) ending on a full-width **View lesson**
  button with the star beside it, and the strip. Between areas the dot
  rides inside the next area's nowrap span, so a line never ends on it. No
  arrow-in-a-disc and no coach's face: the founder found the arrow
  unclear and the face confusing. List is the second view — a poster
  of the first file, the focus, one grey line — and the lesson page is
  the player (`LessonStage`: one play disc, the clip at its own shape,
  browser controls only once it plays). A parent keeps the Family tab
  as home and Lessons as the feed. A lesson with nothing attached is
  `SportGround` — the sport's mark with its glyph high on the card —
  never a black void (which read as a clip that failed) and never a
  drawn picture the lesson did not take. The feed was deleted once on
  a research finding that no competitor has one; the founder wanted it
  back within the hour — improve it, never remove it.
- **One clip plays, and the picture is the player.** `Evidence` has
  one rule, `live`: the card on screen plays from its start with the
  sound the switch says, and every other card is paused, muted and
  back on its first frame — and the clip that starts hushes every
  other feed video in the document (`hushOthers`). No `autoPlay`
  attribute anywhere in the feed: it started every mounted neighbour
  the moment it loaded, and the sound switch reached all of them, so a
  scroll with the sound on was three clips talking over each other,
  which the founder called the most important thing to get right. A
  voice note stops with its card. A tap on the picture pauses (a
  translucent play disc, and a tap resumes); **½×** beside the sound
  button halves the speed and stays on from card to card, because a
  swing is watched slow; the **strip** under the panel is one line per
  file — before full, the one on screen filling, after empty — a thumb
  on the playing segment holds the clip and scrubs it with the time on
  a pill, a tap on another segment goes to that file (it replaced a row
  of dots and a separate progress line); **every clip fills the
  screen**, a landscape one too — the feed is looked at, and the lesson
  page is where a clip takes its own shape (landscape clips were
  contained for a round and the founder wanted the full screen back).
  **Leaving the app stops the clip dead**: on `visibilitychange` to
  hidden (and `pagehide`) every feed video is paused, muted and has its
  source let go, so the phone's lock screen and control centre have
  nothing to offer play on — a merely paused clip stayed there as a Now
  Playing card with a play button, which no social feed does; coming
  back, the card on screen picks its clip up again. The gradient floor
  under the panel is `pointer-events: none`, or it eats the taps on the
  lower half of the picture. `scripts/e2e/feed.cjs` walks all of it.
- **Starred, never favourites.** A person's own mark on a lesson — a
  coach's on the ones they taught, a player's on their own — is
  `preferences.starred`, a list of lesson ids, theirs alone and never
  shown to the other side (the founder's word: a coach "favouriting"
  clips of children reads wrong). `StarCtx` (provided by Nosca:
  `ids`, `has(id)`, `toggle(lesson)`) is how every surface reads it, so
  nothing threads it through props. The control is a star: beside View
  lesson on the feed card (`feed-star`), in the header of the lesson
  page (`lesson-star`), filled once starred; a starred row carries a
  small filled star as a value, not a control. The section is the
  Starred half of **Saved** (below); it was a row above a player's
  lesson list and under All lessons on the coach's home for a day, and
  the founder could not find it there. Until the SQL has been
  re-run the star lives on the device (`nosca.starred.<id>` in
  localStorage) and the preferences write fails quietly; once it has,
  the row wins whenever it carries the list. No toast on a star — the
  fill is the confirmation. The Starred screen with nothing on it reads
  "Nothing starred", never the archive's "No lessons yet". `feed.cjs`
  (k) and (l) walk both sides.
- **A player's profile pill is the switcher.** Face, first name and a
  chevron in the header; tapping it opens `FamilySheet`: their coaches
  (or Add a coach), Family (their code and who is in it, or Start /
  Join), and Settings. It was cut to a bare face that opened Settings
  once, and the founder asked for it back the same day. A coach's face
  still opens their settings directly.
- **A list is a column of boxes, and every edge is the sport's own
  dark tone, 1.5px, with nothing glowing around it.** `EDGE(t)` is the
  sport's `mark` at 72% over the paper (the brand green before a sport)
  — never black or ink — and `EDGE_W` is 1.5. It is the `--edge` of
  `.nsc-list` boxes, `.nsc-day`, `ActTile`, `Card`, `Tile` and
  `TimeGrid` (so the setup's Days · Length · Times read as the same
  tile as the board), and a bordered surface casts no shadow (the resting shadow under a bordered
  tile read as a glow; the founder asked for it gone). Depth stays on
  the raised plus, the filled `Button`, the sheet and a dragged tile.
  `.nsc-list` draws every child as its own surface — a fill, the edge,
  8px corners, 10px between — and `.nsc-day` boxes a diary day with its
  times as rows inside. A child that pads itself (a swipe row, a
  Settings row that unfolds) is `.nsc-swipe` / `.nsc-flush`, or its
  label sits 20px further in than the row above it.
- **The paper is `#FEFEFE`, one step off pure white, the same for
  every sport.** Every theme's `page` is that value; `surface` is
  white; the sport's colour lives in `wash`, the accent, the mark, the
  edges and the tab bar, which stays as it was. The off-white creams
  read as busy and the founder asked three times for backgrounds
  closer to white. The `<body>` background in index.html, the
  `theme-color` meta, the manifest's `theme_color`, `LOADER_PAPER` and
  the gate's error page are the same value, because a phone paints the
  status bar (and Safari its chrome) from them: a cream body and a
  green theme-colour put a band of another colour above a white app,
  which the founder saw as blank space at the top.
  `apple-mobile-web-app-status-bar-style` stays `default` —
  `black-translucent` paints the clock white, invisible on this paper. The bell, Chat, the coach's day (`Ruled`), the diary and the
  Lessons list all use it. Rows of text separated by hairlines were the
  thing the founder called out on the bell, Chat and the diary; a box
  per item is what reads as compartmentalised. Square-ish corners are
  fine; the app does not need round-edged boxes everywhere.
- **Tapping a lesson on the coach's home opens the lesson, never the
  diary.** Today's rows and tomorrow's foot row open `LessonPeek`, whose
  Profile action opens the player's file; the foot row used to jump to
  the diary and the founder did not want to be taken there.
- **The coach's day is two lists, not one.** *To log* is everything
  finished and not written up — today's, then the days before that were
  never written up — and every row carries Log. Below it is what is
  still to come, with the live one marked. One list where a lesson at
  nine this morning and one at five this evening were the same row was
  the thing the founder could not read.
- **A player's file is simple, and shows the lessons the way the player
  sees them.** The four tiles first, then the last five lessons as
  `LessonRow`s in a boxed list — the lesson's first file as a 56px
  poster, or the sport's glyph (`SportGlyph`: flag, racket, oar, squash
  racket, padel bat, horseshoe) in the same box when nothing was filmed,
  so every row lines up — with the app's full-width `Segmented` List ·
  Feed above the list (the same control as the Diary's List · Calendar;
  the small pill beside a heading was missed, and the founder asked
  twice for the switch to be easier to find; the feed is `LessonFeed`
  over that player's lessons, with Back on its header pill) and an
  "All N lessons" button under them. No hero count
  above the tiles. Settings › Lesson logs (`LessonLogs`) is the same
  boxed poster rows with a Download disc on each. `CoachArchive` (the roster's
  foot, the coach home's To do row, the file's All lessons) always
  shows its search and its filters — Year, Month, Player, Worked on,
  Kind, behind one Filter row that unfolds (what is set reads on the
  row while it is folded) — one boxed list of the same `LessonRow`s
  with the same poster box, no month headings, and the same full-width
  List · Feed `Segmented` at the top: the feed runs over whatever the
  filters left, so a coach flicks through a month's clips the way a
  player does. The
  archive is the player file's lesson list at full length, not a
  different screen.
- **Mark it up is a coach drawing on a clip, and the take is a new clip
  on the lesson — with or without a voice.** `ClipReview` (route
  `review:<lessonId>:<mediaId>`, reached from "Mark it up" under a
  video on the coach's lesson page) is laid out like a phone's markup
  sheet over a screenshot: the clip on a dark stage that fills the
  screen from the header to a compact bar (`Screen fill`, the route is
  `bare` so no tab bar sits under it; the canvas is sized to the
  measured stage in real pixels, never object-fit, because the pointer
  maths reads its box), Undo and Clear in the header, one row of icon
  tools (pen · line · arrow · circle · angle — the angle reads degrees
  from vertical, for a swing plane or a spine) with the three inks, the
  transport (play, a frame either way, scrub, ½×), a pinch to zoom the
  working view (a `1×` pill resets; the take is always the whole
  frame), and **two actions, never only a Record**. **Every mark
  belongs to a moment — the video time it was drawn at.** Pausing
  somewhere new and drawing starts a new moment and the old marks fade
  (`FADE_MS`); on playback a moment's marks draw themselves in when
  the head reaches its time and stay until the next moment's. That is
  what the coach sees pressing Play in the editor, what the take
  holds, and so what the player sees — never every mark at 0:00 (it
  was that for a round and the founder saw the drawings out of time
  with the clip). **Save** is the end of it for the coach: the
  moments and the clip go to `startTakeJob()`, a video and a canvas on
  a 2px host on the body (`nosca-take-host`), created inside the tap so
  the one `play()` a browser wants a gesture for has one, which plays
  the clip through once from the start, resting on each moment
  (`HOLD_MS` after its marks arrive) then going on, records the canvas
  as it goes with no microphone asked for (the clip's own sound rides
  along through Web Audio where the browser allows it; the recorder is
  fed a steady 30 frames a second by `requestFrame`, because a canvas
  track left to itself came back from Safari running fast) and then
  uploads the take — the coach is back on the lesson the moment they
  tap, Today's banner reads "Making 1 clip" and then "Uploading", and
  a failed render is there with Retry (`queueTake`; from the log,
  `queueWizardTake`: the row reads "Making…", the file joins the
  attachments if it is ready before Log it and follows the lesson up
  if not, `claimTakes` in `publish()`; the clip it was drawn on comes
  back if the take fails). It played through on the screen with a timer
  for a round, and the founder did not want to sit and watch it; **Talk over it**
  takes the microphone, lets the coach play, pause, scrub and draw
  live — the pause and the fade are in the take — and plays it back
  (Again · Save) before it goes. **The take stands in for the clip it
  was drawn on**: `onSend(file, original)` adds the take and removes
  the original, so a lesson carries one video, not two (the founder
  asked; a live-capture clip already has its copy on the phone). The
  camera in the tool row is **Photo**: the frame as it stands, marks
  and all, onto the lesson as a still (`onStill`), the coach staying
  where they are. The feed carries no badge for a marked-up clip: a
  pencil sat beside the focus for a round and the founder cut it — the
  drawing is in the clip, and the clip says so itself. Both paths use
  the same MediaRecorder negotiation as live
  capture (`pickMime`, `VIDEO_TYPES` from useCapture) and
  `addLessonMedia`. It was one Record button with no Save for a round,
  at 330px tall under the tab bar, and the founder found no way to
  keep a drawing and could not work at that size. The drawing is IN
  the recording — never a layer only this app could replay — and
  `review.cjs` decodes the file the app sent and reads the ink's
  pixels back out of it. This is the shape of OnForm, CoachNow,
  Dartfish and Coach's Eye: the athlete receives a recording of the
  coach's own session; drawings anchored to a moment (Dartfish still
  shots, Kinovea key images) rather than persisting through the whole
  clip, which is a complaint about Coach's Eye; a camera icon for a
  snapshot (CoachNow); CoachNow replaces the original when a pending
  post is marked up. The viewer sees every mark drawn
  live: a stroke made while recording is in the take as it happens,
  and marks drawn before Record reveal themselves one after another
  over `REVEAL_MS` when it starts (`paintShape(g, sh, w, h, f)` draws a
  fraction of a shape), so a prepared page never pops in whole. No microphone records the
  picture alone and says so; a declined microphone stops and says why.
  The `<video>` the canvas reads must carry `crossOrigin="anonymous"`
  or the canvas is tainted and `captureStream` throws. A file added to
  a lesson more than half an hour after it was logged is news of its
  own: `trg_lesson_media_notify` tells the player (and a junior's
  adults) "New clip on <focus>" and opens the lesson; the mock's
  `onMediaInsert` says the same. The old harness `VideoAnnotate` is the
  design sketch this replaced and is reached only from the harness.
  The headless test browser has no microphone at all, so
  `scripts/e2e/review.cjs` exercises the picture-only path end to end;
  the microphone path is the same code as live capture. **It is also
  reached from the log itself**: every clip row on the write-up carries
  a Mark it up button, `ClipReview` takes the File directly (`file=`,
  no lesson yet), and the take joins the attachments and uploads with
  the lesson like any other file. The founder could not find annotation
  from the log once; it stays on the row.
- **Compare is two clips of the same player side by side, and both
  sides have it.** `ClipCompare` (route `compare:<lessonId>:<mediaId>`,
  reached from **Compare** beside Mark it up under a video on the
  lesson page — the coach's row carries both, the player's Compare
  alone) is the one tool every video-coaching product carries (V1,
  OnForm, CoachNow, Skillest) and the first thing a golf or tennis
  coach reaches for after drawing. The picker first: this clip at the
  top, then every other clip of that person's lessons as rows, newest
  first, `Clip 1 · Clip 2` where a lesson has several (the person's
  lessons come in as `compareLessons`, `sameSubject()` keeps the same
  player's or the same group's, `compareable()` decides whether the
  button is there at all — another clip on this lesson, or another
  lesson with a clip where its files are known and anything attached
  where they are not; a player with nothing to set a clip beside is
  not offered it). Then the two stages on a dark `Screen fill`: two
  portrait clips stand side by side, anything else stacks; one
  transport for both (play, a frame either way, the scrub, ½×, the
  time), A leading and B pulled back into step whenever it drifts more
  than a few frames; each clip lined up on its own — the ‹ › on its
  pill nudge only that clip a frame, a drag across its picture scrubs
  only it — and from then on they run locked, the pair ending when
  the first clip does; **Swap**, **Change** (the picker again) and the
  coach's **Save**, which leaves the screen at once: the pair, lined
  up as the coach left it, goes to `startCompareJob` on the off-screen
  host (`queueCompare` in Nosca, the same making → uploading → Retry
  shape as a take), which plays it through once drawing both halves to
  a recorded canvas and puts the file on the lesson as a new clip
  (`addLessonMedia`; the originals stay; the trigger tells the player
  "New clip on <focus>"), so the player sees the comparison in their
  feed. It played through on the stage under a Saving pill for a
  round; the founder asked for every render and upload to happen
  behind the coach's back. Sound is off throughout: two clips talking
  at once is noise, and a comparison is looked at. Save is the
  coach's because only the lesson's coach may add to it, the same
  asymmetry as Mark it up. The title names the other person — the
  coach's player, a parent's child — never the person themselves. A
  clip a browser recorded can carry no length in its header; asking
  for a time past its end makes the browser find the real one
  (`onMeta`). The harness's `VideoCompare` sheet is the design sketch
  this replaced and is reached only from the harness.
  `scripts/e2e/compare.cjs` walks the coach, the player, a parent on a
  child's lesson, and a player with nothing to compare; the mock serves
  a `compare-<n>.webm` take as a real clip like a markup take.
- **Progress is a player's journey read off the lessons, the same
  screen on both sides, and it stores nothing.** `ProgressScreen`
  (route `progress` for your own, `progress:<id>` for a player's) is
  reached from the first foot row of the coach's player file
  (`player-progress`), from the profile pill's switcher for a player
  (`sheet-progress`), and from the child's screen for a parent
  (`kid-progress`). `progressOf()` reads the lessons: the level over
  time as one hand-drawn SVG line (`LevelLine`) where the sport's stage
  is a number (HI, WTN, a padel level — the number behind the stage tag
  on each lesson, first and last labelled), or the ladder with the
  steps reached ticked and the current one carrying "since" its first
  lesson where the stage is a name (the tennis balls, J15, the ball
  dot, the Pony Club tests — golf shows both when both are there);
  what was worked on as counts with a bar, split on the " · " the log
  joined; the last six months as columns (`MonthBars`); drills done of
  set. With no lessons it says "No lessons yet" and draws nothing.
  Nothing is asked and no SQL: it is what TennisLocker draws for the
  parents and the golf apps chart as the handicap, and perceived
  progress is most of why a paying client stays. The calendar's `today`
  is a 1-based month and a day with the year beside it, never a Date —
  `progressToday()` turns it into one. `scripts/e2e/progress.cjs`
  walks the coach, the player, a parent on a child, a player with
  nothing and a tennis ladder.
- **A season report is Progress as one page for the share sheet.**
  `shareSeasonReport()` at the foot of `ProgressScreen` ("Share a
  report", `progress-report`) writes `seasonReportHtml()` — the lesson
  log's own style: the player, the span of the lessons and the coach;
  the level then and now (or the ladder's steps reached); the lessons
  by month; what was worked on; the drills set and done; the coach's
  tips; every lesson with the first line of its note — and hands it
  out through `shareHtmlFile()`, the share-or-download path the lesson
  log uses too. The coach's names the coach, a player's names their
  coach, a parent's is the child's under the child's name (the child
  comes from `data.dependants`, which knows the child's coach; the
  roster's row for the same child does not). It is what TennisLocker
  sells to parents as an evaluation at the end of a term. Nothing in
  it is invented; a section with nothing to say is left out.
  `progress.cjs` (f2)–(f4), (i2), (l2) read the file back.
- **The feed's header is one row, and nothing in it overlaps.** The
  List · Feed switch top left and the header's pill top right were two
  absolutely placed boxes, the switch a fixed 172 wide; on a home whose
  pill carried a longer first name the pill sat over the word Feed.
  They are one flex row now — the switch takes what is left, never
  wider than 172 nor narrower than 108, the pill never shrinks — with
  the row letting taps through to the picture and only the controls
  taking them. `progress.cjs` (m2) measures it on a junior's home.
- **A boxed row carries no hairline of its own.** Inside `.nsc-list`
  the box is the edge; a row that also drew its 0.5px foot rule
  (`DayRow` on the home with `last={false}`, the bell's `Line` and
  `Ask`) put a dark line inside every box, visible on the coach's home
  and the alerts. Pass `last`, or leave the rule off.
- **A drill carries a day, and the day comes from the next lesson.**
  `drills.due` is one date column (`alter table … add column if not
  exists`). The Set-drills sheet (`AssignBody`) carries a **By** row
  (`assign-due`, the second Settings shape) above Set, offering No day,
  Next lesson · `Thu 8 Oct`, Tomorrow, In a week and In two weeks
  (`dueOptions`), each a named day and never a native value; it opens
  on the player's next booked lesson (`nextLessonIsoFor`, read off
  `data.bookings`), because a drill is practice for the next lesson
  and a coach should not have to say so. `assignDrills(playerId,
  titles, due)` sends the day only when the column exists: the hook
  probes `drills.due` once (`drillsDue`) and the sheet shows no By row
  until the SQL has been re-run, so a drill still saves. The player's
  Drills screen (`PlayerPractice`) orders the dated ones first, soonest
  first, then the undated, done last, and each dated row carries one
  grey line — "By Thu 8 Oct", "By today", or "Was by Thu 1 Oct" in the
  warning colour once the day has gone (`dueLine`). The notification
  that sets it reads "Gate drill · by Thu 8 Oct" (`trg_drills_notify`),
  and `remind_due_drills()` writes "Gate drill due today" once per
  drill per day, at the hour the player chose (two bullets on;
  `nosca-drill-reminders` on pg_cron, hourly; the status row's
  `drill_reminders` says whether the extension is on). Skillest attaches a due date to a
  follow-up drill; nothing else in the field does, and a dated drill is
  what brings a player back between lessons. `scripts/e2e/drills-due.cjs`
  walks the coach, the player and a project without the column.
- **The Drills tab is what is to do; All drills is the record.**
  `PlayerPractice` shows every drill not yet done, every drill from the
  last day drills were set (so a set reads whole once it is ticked
  off), and anything ticked this sitting (`justDone`, kept) — a drill
  never vanishes under the thumb. Under the list, "All N drills"
  (`drills-all`) opens `PlayerDrillLibrary` (route `drillsAll`; Settings
  › Drills carries the count and opens it too): every drill ever set
  under the day it was set (`setDayOf` on `createdAt` — Today ·
  Yesterday · `Thu 1 Oct`, newest day first), done ones ticked and
  struck, a search above eight, and the same `DrillRow` on both screens
  so a drill looks the same wherever it is read; a tap there toggles it
  for real. The founder asked for a library of past drills and when
  they were given, easy to reach and plain. `scripts/e2e/drill-library.cjs`.
- **The day's reminder arrives at the hour the person chose.**
  `preferences.reminder_time` (a `time`, on the hour; null is eight in
  the morning; Ireland's clock). `remind_due_drills(p_hour)` runs on
  pg_cron every hour (`0 * * * *`) and says a drill due today once, in
  the player's own hour — the zero-argument version is dropped first,
  because `create or replace` cannot change a signature and a second
  overload is what the job would have gone on calling. Set from the
  Reminder row at the foot of the Drills tab (`drills-reminder`, a
  `FilterRow` in a `Card`, there once the first drills land) and from
  Settings › Reminder (`settings-reminder`, the second shape, 6:00 am to
  9:00 pm); a coach is offered it only when they take lessons
  themselves. The database sends it, so nothing lives on the phone: the
  hook probes the column once (`reminderOn`) and until the SQL has been
  re-run no row is offered anywhere — a setting that stores nothing is
  worse than none. It is not asked at sign-up; nothing joins that flow.
  `supabase/test/run.sh` now adds up a FAIL from the upgrade-path run
  of behaviour.sql as well — one printed under a `uniq -c` count for a
  day and was never counted.
- **Ask for a rating answers on the burst, and the player is told.**
  The Logged burst's button (`PublishedBurst`, `data-ask`) marks the
  lesson (`requestRating`, `.select()` proving the row changed) and
  turns into **Asked** with a tick; a refused write is said on the burst
  in red with **Try again** under it; once asked, with nothing else to
  offer, the burst clears itself. Its only word back used to be a toast
  drawn under the burst (the toast was layer 50, the burst 70), so the
  coach tapped and saw nothing happen — the founder reported it dead.
  The toast now sits above every layer (90). A `rating_requested` that
  flips true on a logged lesson fires `trg_lessons_rating_notify`:
  "<Coach> asked for a rating", the focus as the body, kind `rating`,
  landing on the lesson (each attendee, for a group); the mock's
  `onRatingAsk` says the same. The lesson page's "<Coach> asked for a
  rating" line goes to the coach's profile, where the review is left
  for real (`submitReview`, one per player per coach); the `rate` sheet
  (`RateLesson`) is the harness's sketch and writes nothing, so no live
  path opens it. `scripts/e2e/rating.cjs` walks both sides and a project
  whose lessons table has no `rating_requested` column.
- **One face per person, everywhere.** `FaceCtx` (provided by Nosca)
  is a lookup by name over the roster, the family, the coach and me;
  `Avatar` falls back to it whenever it is not handed a `src`, so a
  person's photo is the same disc on the home rows, the roster, Chat,
  the bell, the register and the pill. Half the surfaces drew a photo
  and half drew initials for the same person, which read as two people.
- **There is no player home page besides the feed.** `PlayerHome` (next
  lesson, tip, coming up, recent lessons) is no longer routed; the
  founder asked for Home and Lessons to be one thing. Booking lives in
  the Diary, the tip on the lesson and the player file, the coach in
  the profile pill's switcher.
- **Nothing blurs, except the tab bar's own frosted glass.** `Screen`'s
  header, the thread's header and composer, the sheet's scrim, the
  feed's switch and glass panel, the celebration: none carries a
  `backdropFilter`. A header that blurred what scrolled under it hid
  the top of every screen; the founder asked three times for the blur
  gone, so the only frosted surface left is the tab bar, which they
  asked to keep as it was.
- **The approved look has depth: a tile rests on `ELEV.rest`, the
  plus is raised out of the bar.** `ActTile`, `Card`, `Tile`, the
  segmented control, the face tiles and the time grid carry the soft
  resting shadow; a filled `Button` carries `ELEV.cast`; the tab bar is
  cut by `barPath(w, true)` around a 56px plus in the sport's ink with
  the sliding mark-tinted bubble under the active tab. Every one of
  these was flattened to a hairline in one round on the strength of
  the reference sets, and the founder called the result terrible the
  same day, and asked where the plus had gone. Do not flatten it again.
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
  "Sept", never a time stripped of am/pm to fit a column. The time
  column on the bell and in Chat is `relTime` in `useNoscaData`, the
  one place: `3:24 pm` today, Yesterday, else `Thu 24 Sep` — it read
  "30m" and a 24-hour "15:24" once. A notification's own date comes
  from `nice_date()` in nosca.sql, `Tue 8 Sep` with no leading zero,
  and the mock's `niceDate` says the same.
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
- **Back puts you where you were.** Every navigation remounts the
  screen (the route is the last entry of `stack`), so React keeps
  nothing across a Back on its own. `NavCtx` carries the screen's key
  — `depth:screen`, or `"sc"` inside the walkthrough's showcase where
  nothing is kept — and `SCREEN_MEMORY`, a module Map, holds what a
  screen wants back under that key. `Screen` keeps its scroll (the box
  is `data-scroll="screen"`) and puts it back before the first paint,
  then again over the next moments while skeletons become rows;
  `LessonFeed` keeps the card it was on and jumps there with its smooth
  scroll switched off. `useKept(name, initial)` is `useState` that
  survives the remount: the archive's List · Feed, search, filters and
  page; the player file's view; the roster's tab and search; the home's
  folded day and Actions filter; the Diary's month, day, For and
  List · Calendar; the drill library's filter and the drill unfolded;
  Settings' search and the row unfolded; the bell's filter; the tips
  filter; the lesson-logs page; a practice row. `push` drops the new
  key's memory so a fresh open starts at the top; `pop` drops the key
  it leaves; `go` (a tab) drops everything deeper than the roots, so a
  tab away and back lands on that root where it was; a notification's
  deep link (`land`) does the same. The tab you are already on, at its
  root, goes to its top (`nosca:top`, the phone's own convention), and
  the memory is cleared when the account changes, so a second person on
  the same phone starts every screen fresh. Before this every Back landed at
  the top of a fresh screen, which the founder called very, very
  frustrating. `scripts/e2e/back.cjs` walks both sides — a lesson
  opened from deep in the archive and two Backs, the feed's card, a
  filter, a tab away, the Diary.
- **Default view: a coach opens on List, a player on Feed, and Settings
  › Default view changes it.** `preferences.default_view` (`list` |
  `feed`; null means the role's own) with the phone's copy in
  `nosca.view.<uid>`, so a project whose SQL has not been re-run still
  does what was asked; `defaultView` in Nosca resolves the row, then
  the phone, then the role; `homeView` is the sitting's own switch on
  top of it, and the archive and the player file start on
  `nav.defaultView`. The row is the first of Coaching / Playing
  (`settings-view`), the second Settings shape (a value and rows that
  unfold), so it is found in a second and by the search. Saved opens on
  its list whoever is looking (`startView="list"`): a row is where a
  download's size, how far it is and why it failed are read, and where
  a swipe removes it; the feed is the tap beside it.
- **The plus never opens on a swipe up.** The phone's home gesture
  starts on the tab bar: the bar's `pointerdown` began a drag along the
  tabs and `pointercancel` — which is what the phone sends when it
  takes the gesture — committed to the cell under the finger, so every
  swipe up to leave the app opened the plus, and the founder saw it
  every time. `TabBar` now selects only on a `pointerup` that was
  neither vertical (`|dy| > 10` and more than `|dx|`) nor cancelled,
  and ignores the click the browser fires after a drag while `settle()`
  holds; a real tap still opens the plus. `back.cjs` (h), (h2), (i).
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
