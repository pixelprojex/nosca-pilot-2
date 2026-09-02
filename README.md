# Nosca — Pilot

A real, working version of Nosca: one coach account, up to 20 players,
real sign-up, real lesson logging with real video/photo upload, real
attendance, real drills and tips. No payments anywhere in the code.

**I (Claude) cannot create accounts or deploy this for you — my
environment has no internet access.** Everything below that needs an
account is yours to click through; it's about 10 minutes total, once.

---

## What's real in this build

- Coach sign-up (the database itself refuses a second coach account)
- Player sign-up by invite code (the database refuses a 21st player)
- **The full designed interface**, behind that real sign-in
- Log a lesson — private or group, notes, and real video/photo upload
- Lesson history — the coach sees everyone's; a player sees only theirs
- Attendance — the coach takes a real register; a player sees their own %
- Drills and tips — the coach sets them; a player ticks drills done

## Where the work stands

The full designed application is now in place at `src/Nosca.jsx` and
runs behind the real sign-in. It presently draws on its own seeded data
rather than the database; connecting each screen to Supabase is the next
stage, done one screen at a time so the app stays usable throughout.

Adding `?demo` to the URL brings back the design harness — the preview
toolbar, persona switcher and phone frame — without needing an account.

The plain pilot screens built first are preserved in `src/pages` and
`src/App.pilot.jsx.bak`; nothing has been discarded.

---

## Step 1 — Create the database (Supabase, free) — ~5 minutes

### Part 1 — the tables

1. Go to **supabase.com** → sign up → **New project**. Any name/password/region.
2. Once it's created, open **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase/schema.sql` in this folder, copy the whole file, paste
   it into the query box, click **Run**. This creates every table and
   the two hard limits (1 coach, 20 players) directly in the database.
4. Check **Table Editor** — you should see `profiles`, `lessons`,
   `drills`, `tips`, `attendance_sessions`, `attendance_marks`. If they're
   not there, the run failed — see **Troubleshooting** at the bottom.

### Part 2 — the second migration

Open `supabase/migration-002.sql`, copy the whole file, paste it into a
**New query** in the SQL Editor and **Run** it. This adds the fields the
designed interface expects: sub-focus tags and an unread flag on
lessons, plus tables for competitions, recurring lessons, bookings and
per-person preferences.

### Part 3 — the video/photo storage (done through the dashboard, not SQL)

Supabase currently blocks creating storage permissions via the SQL
Editor ("must be owner of table objects") — a platform restriction, not
a mistake in the schema. Do this instead, once:

1. Left sidebar → **Storage** → **New bucket** → name it exactly `media`
   → leave **Public bucket** switched **off** → Create.
2. Click into the `media` bucket → **Policies** tab → **New policy**.
3. Choose **"For full customization"** (a blank policy) and create
   **two** policies with these exact settings:

   **Policy 1 — reading**
   - Policy name: `coach group can read own media`
   - Allowed operation: `SELECT`
   - Target roles: `authenticated`
   - USING expression:
     ```
     bucket_id = 'media' and (storage.foldername(name))[1] = public.my_coach_id()::text
     ```

   **Policy 2 — uploading**
   - Policy name: `coach can upload own media`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - WITH CHECK expression:
     ```
     bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
     ```

### Part 4 — turn off email confirmation

Otherwise every sign-up has to click a verification link in an email
before they can use the app — unnecessary friction for a small pilot.

1. Left sidebar → **Authentication**
2. Tabs along the top → **Providers**
3. Click **Email** in the list
4. Find the toggle **Confirm email** → switch it **off** → save

### Part 5 — get your two keys

You'll paste these into Netlify in Step 3, so grab them now.

1. Left sidebar → the **gear icon**, **Project Settings**
2. Sub-menu → **API**
3. Near the top: **Project URL** — looks like `https://xxxxx.supabase.co`
4. Further down, under **Project API keys**: the one labelled
   **anon** / **public** — a long string of letters and numbers
5. Copy both somewhere safe for a minute (your phone's Notes app is fine)

## Step 2 — Put the code on GitHub — ~3 minutes

1. **Unzip** `nosca-pilot.zip` first — tap it, or choose "Extract" — you
   should end up with a folder called `nosca-web`.
2. Go to **github.com** → sign up if you don't have an account →
   **New repository** → name it `nosca-pilot` → **Create**.
3. On the new repo's page, click **uploading an existing file**.
4. Open the `nosca-web` folder and select **everything inside it**
   (`src`, `supabase`, `package.json`, all of it) and drag *that* in —
   not the `nosca-web` folder itself. If you drag the folder itself,
   everything ends up one level too deep and Step 3 won't find it.
5. Scroll down, click **Commit changes**.

(There's a git command-line alternative for people already using git
from a terminal — if that's not you, ignore it entirely; the steps
above are complete on their own.)

## Step 3 — Deploy it (Netlify, free) — ~3 minutes

1. Go to **netlify.com** → sign up → **Add new site → Import an
   existing project** → connect GitHub → pick `nosca-pilot`.
2. Netlify will detect the build settings from `netlify.toml`
   automatically. Before clicking Deploy, open **Site configuration →
   Environment variables → Add a variable**, and choose **Import from
   a .env file** (not "Add a single variable") — this avoids retyping
   the variable names, which have to match exactly.
   - Open `.env.example` from this project, copy its contents, paste
     them into the box Netlify gives you
   - Edit the two placeholder values to your real ones from Step 1,
     Part 5 — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Import/save
3. Click **Deploy**. In about a minute you'll have a real URL — something
   like `nosca-pilot.netlify.app`.

That's it. Open the URL, choose **I'm the coach**, sign up, copy the
invite code from the Roster tab, and send it to whoever's testing as a
player.

---

## If you want to run it on your own computer first

Needs [Node.js](https://nodejs.org) installed.

```
npm install
cp .env.example .env      # then fill in the two Supabase values
npm run dev
```

## Troubleshooting

**"Failed to get project's logs" right after running the schema** — this
is a Supabase dashboard quirk (it tries to fetch a log after your query
runs, and that separate fetch can fail) — it does not mean your SQL
failed. Check Table Editor; if the tables are there, ignore it.

**Table Editor shows nothing after running the schema** — the whole
paste runs as one transaction, so any single failing line rolls back
everything above it too. Re-run it and read the red text in the
results panel directly under the query (not a popup) for the real
error. If it says `must be owner of table objects`, you're running an
older copy of this file — the current `schema.sql` no longer touches
storage at all; that's Part 2 above instead.

**"relation already exists"** — harmless, it means an earlier run
already created that table.

## Resetting the pilot

If you want to wipe every account and lesson and start clean: in
Supabase → **Authentication → Users**, select all, delete. Everything
else (lessons, media, drills) cascades away automatically because of
how the database is built.
