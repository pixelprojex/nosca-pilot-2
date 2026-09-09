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
- **Set yourself up.** A coach is offered `CoachSetup` once — hours,
  drills, tips — remembered as `preferences.setup_done`, and reachable
  again from Settings. Its live mode leaves out the stats step, because
  nothing stores which stats a coach picked.
- **One drill library.** A live coach's drills are `custom_drills` in
  their preferences — what they picked in setup plus what they wrote —
  held in `library[sport]`. The wizard's chips, the Set-drills sheet and
  the Drills screen all read that one list; none of them reads the
  sport's starter set directly (the wizard used to, and offered drills
  the sheet had never heard of). The harness, with no account, seeds
  the starter set into the library so every screen still has content.
- **A coach's sport never changes.** `profiles.sport` is what their
  invite code was handed out under. Another sport goes in
  `preferences.extra_sports`, and `activeSport` is which of them they
  are working in; `coachSport` follows it, so the drill library, the
  tips and the groups all move together.
- **A coach may also be somebody's player.** `request_coach()` allows
  it, so `data.lessons` holds both what they taught and what they took.
  `taught()` is every coach-side list; `mineOnly()` is their own.
- **Only tips. No goals.** Competitions are the goals.
- **The walkthrough is the app.** Each tour step renders a second
  `<Nosca showcase={…}>` (harness data, inert, scaled) and rings a real
  control found by its `data-tour` attribute. Add a step by adding the
  attribute and a TOUR entry; never type ring coordinates.
- **One bottom sheet.** Nosca renders sheet bodies inside its single
  `<Sheet>`; a body that wraps itself in another `<Sheet>` ends up 760px
  off-screen with pointer events off (Delete account and Live capture
  opened empty panels this way). Overlays that stay mounted while idle
  must set `pointer-events: none` (the toast strip swallowed taps).
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

`supabase/nosca.sql` is the only SQL file. It sets up a fresh project
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
