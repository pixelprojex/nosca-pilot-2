# Nosca — Pilot

A real, working version of Nosca: coach and player sign-up, real
lesson logging with real video/photo/voice-note upload, real
attendance, real drills and tips, a diary, messaging, families for
under-18s. No payments anywhere in the code.

**I (Claude) cannot create accounts or deploy this for you — my
environment has no internet access.** Everything below that needs an
account is yours to click through; it's about 10 minutes total, once.

---

## What's real in this build

- Coach sign-up, with an invite code to hand to players
- Player sign-up — with the coach's code, or without one and added later
- **The full designed interface**, behind that real sign-in
- Log a lesson — private or group, notes, and real video/photo upload
- Lesson history — the coach sees everyone's; a player sees only theirs
- Attendance — the coach takes a real register; a player sees their own %
- Drills and tips — the coach sets them; a player ticks drills done
- Families — anyone can hand out a family code; whoever enters it
  joins that person's family, and the database lets a guardian see
  their family's lessons and book or message for them

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

### Part 1 — run the one SQL file

1. Go to **supabase.com** → sign up → **New project**. Any name/password/region.
2. Once it's created, open **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase/nosca.sql` in this folder, copy the whole file, paste
   it into the query box, click **Run**. Run it once, in full. It
   creates every table, the sign-up trigger, the security rules and the
   storage bucket, and checks its own work.
4. Read the one row that comes back under the query. `tables` should
   say `13 of 13`, `signup_trigger` `true`, `profiles_policy` should
   begin `OK`, and so should `tables_as_user` and `tables_as_anon`. If
   instead you see red text, nothing was changed — see
   **Troubleshooting** at the bottom.

You can run `nosca.sql` again at any time — after pulling a new
version of this code, or if you're not sure it ran. It is safe: it
never deletes an account, and running it twice changes nothing.

### Part 2 — the video/photo storage

The script creates the private `media` bucket itself. What it may not
be allowed to do is create the *permissions* on it: Supabase blocks
that from the SQL Editor on some projects ("must be owner of table
objects"), a platform restriction, not a mistake in the script.

Look at the `storage_policies` column of the row from Part 1:

- **`OK — 3 policies on the media bucket`** — done, skip to Part 3.
- **`create in the dashboard …`** — do this once, by hand:

1. Left sidebar → **Storage**. If there is no `media` bucket (the
   `storage_bucket` column will have said so), **New bucket** → name it
   exactly `media` → leave **Public bucket** switched **off** → Create.
2. Click into the `media` bucket → **Policies** tab → **New policy**.
3. Choose **"For full customization"** (a blank policy) and create
   **three** policies with these exact settings:

   **Policy 1 — reading**
   - Policy name: `media: your own folder, or a file from a lesson you can see`
   - Allowed operation: `SELECT`
   - Target roles: `authenticated`
   - USING expression:
     ```
     bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or exists (select 1 from public.lesson_media lm where lm.storage_path = name))
     ```

   **Policy 2 — uploading**
   - Policy name: `media: upload into your own folder`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - WITH CHECK expression:
     ```
     bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
     ```

   **Policy 3 — deleting**
   - Policy name: `media: delete from your own folder`
   - Allowed operation: `DELETE`
   - Target roles: `authenticated`
   - USING expression:
     ```
     bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
     ```

### Part 3 — turn off email confirmation

Otherwise every sign-up has to click a verification link in an email
before they can use the app — unnecessary friction for a small pilot.

1. Left sidebar → **Authentication**
2. Tabs along the top → **Sign In / Providers**
3. Click **Email** in the list
4. Find the toggle **Confirm email** → switch it **off** → save

### Part 4 — get your two keys

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
     Part 4 — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
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

**"Failed to get project's logs" right after running the SQL** — this
is a Supabase dashboard quirk (it tries to fetch a log after your query
runs, and that separate fetch can fail) — it does not mean your SQL
failed. Scroll down to the results panel; if the one-row summary is
there, it worked.

**Red text instead of the one-row summary** — the whole file runs as
one transaction, so any single failing line rolls back everything
above it too; nothing is half-done. Read the red text directly under
the query (not a popup) for the real error, then run the file again
once it's fixed. If it says `profiles policy is broken` or
`row-level security check failed`, the file caught the problem itself
— that is the check at the end doing its job.

**"relation already exists"** — you're running an older SQL file.
Only `supabase/nosca.sql` exists now, and it never says this.

**Sign-up says "The database rejected the sign-up"** — `nosca.sql`
hasn't been run on this project yet. Run it (Step 1, Part 1) and try
again.

## Resetting the pilot

If you want to wipe every account and lesson and start clean: open
`supabase/nosca.sql`, find the block at the very top titled
**OPTIONAL — start again**, remove the two `--` in front of the two
`delete` lines, and run the file. Everything else (lessons, media
rows, drills) cascades away automatically because of how the database
is built. Put the `--` back afterwards. Uploaded files are cleared
separately, in **Storage → media** → select all → Delete.
