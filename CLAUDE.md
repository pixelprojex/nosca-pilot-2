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
   it on a throwaway Postgres, twice, plus 22 behavioural checks.
4. Render it. The Playwright scripts under `scripts/e2e/` drive the
   built app against a mocked Supabase: sign-up for every role, codes
   both ways, deletion, the walkthrough's ring alignment, and a seed
   sweep that crawls every screen as each role.

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
  functions (`my_coach_id()`, `my_guardian_id()`).
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
