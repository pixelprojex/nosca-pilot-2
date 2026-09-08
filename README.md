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
- Player sign-up — with the coach's code, or without one and added later.
  A code sends a request; the coach accepts or declines it from Today,
  Roster or You → Requests, and the player is told
- **The full designed interface**, behind that real sign-in
- Log a lesson — private or group, notes, and real video/photo upload
- Lesson history — the coach sees everyone's; a player sees only theirs
- Attendance — the coach takes a real register; a player sees their own %
- Drills and tips — the coach sets them; a player ticks drills done
- Families — optional, and made on purpose: You → Family creates a
  code or joins with one. The adults in a family see a young player's
  lessons, drills and bookings, book into their coach's hours and
  write to the coach; the young player sees who is in it. A parent
  signing up gets a family made; an under-18 must join one
- Notifications — a lesson logged, a request answered, a booking asked
  for or confirmed, a message, drills, a tip: written by the database,
  listed under the bell, shown once on opening when they landed while
  the app was closed, and pushed to the phone once push is set up
- Your profile — photo, name, sport, date of birth, phone, club, a
  line about you, password, family, sign out, delete: one screen

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
   say `17 of 17`, `signup_trigger` `true`, `notify_triggers` `7`,
   `profiles_policy` should begin `OK`, and so should `tables_as_user`
   and `tables_as_anon`. `storage_bucket` should name both buckets. If
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

### Part 3 — three authentication settings

1. Left sidebar → **Authentication** → **Sign In / Providers** → **Email**.
   - **Confirm email**: switch it **off** for the pilot, so nobody has to
     find a verification email before they can use the app. (If you
     leave it on, the app copes: it shows "Check your inbox" with a
     Resend button, and the person's code is shown the first time they
     sign in.)
   - **Minimum password length**: set it to **8**. The app already
     insists on eight characters; this makes the server agree.
2. **Authentication** → **URL Configuration**: set **Site URL** to your
   Netlify address (for example `https://nosca.netlify.app`) and add the
   same address under **Redirect URLs**. Without this, the "Forgot
   password?" email links land on the wrong page.
3. Optional: in Netlify's environment variables add
   `VITE_SUPPORT_EMAIL` with the address you want "Email support" and
   "Report a problem" to write to. Until it is set, those rows are hidden
   rather than pointing nowhere.

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

## Push notifications

In-app notifications need none of this — the bell and the "since you
were away" list read the `notifications` table directly. Push is
additive: it lets a phone hear about a new one while Nosca is closed.
Setting it up is done once and takes about ten minutes.

1. Generate a key pair on your computer:
   ```
   npx web-push generate-vapid-keys
   ```
   It prints a public key and a private key. Keep both.
2. On Netlify → **Site configuration → Environment variables**, add:
   - `VITE_VAPID_PUBLIC_KEY` — the public key (this one is built into
     the app, which is why it carries the `VITE_` prefix)
   - `VAPID_PUBLIC_KEY` — the same public key again
   - `VAPID_PRIVATE_KEY` — the private key
   - `VAPID_SUBJECT` — `mailto:` followed by your email address
   - `SUPABASE_URL` — the Project URL from Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API →
     the key labelled **service_role**
   - `PUSH_WEBHOOK_SECRET` — any long random string you make up
3. Redeploy (Deploys → Trigger deploy) so the public key goes into the
   build and the function picks up the rest.
4. In Supabase → **SQL Editor**, tell the database where to send them
   (`nosca.sql` created the table this goes in; the trigger that reads
   it is already there and does nothing until both rows exist):
   ```sql
   insert into public.app_settings (key, value) values
     ('push_url',    'https://<your site>/.netlify/functions/push'),
     ('push_secret', '<the same string as PUSH_WEBHOOK_SECRET above>')
   on conflict (key) do update set value = excluded.value;
   ```
   Run `nosca.sql` again afterwards if you like — its last line will
   now say push is configured.

That is all. Each new row in `notifications` now reaches every device
its person has turned notifications on from.

> Older instructions had you create a **Database → Webhook** pointing
> at the same URL. That still works, but do **one or the other** — with
> both, every notification arrives twice.

Worth knowing:

- **"When to tell you"** on the Notifications screen is real, and it is
  about the phone only: the bell inside Nosca always shows everything.
  *As they happen* sends each one; *Only urgent* sends a lesson called
  off, a booking, a request, an answer to one and a message, and holds
  the rest; *Once a day* holds everything for a single summary sent by
  `netlify/functions/digest.mjs` at 06:00 UTC — 7am in Ireland for most
  of the year. Netlify runs that one on its own; there is nothing to
  set up.
- A phone whose subscription rotates tells us its new address itself
  (`pushsubscriptionchange` in `public/sw.js` →
  `netlify/functions/resub.mjs`), so it keeps hearing things without
  waiting for the app to be opened. That request proves itself with the
  old subscription's own secret, so knowing somebody's endpoint is not
  enough to redirect it.

- On iPhone and iPad (iOS 16.4 or later) push only works once Nosca has
  been added to the Home Screen — Share → **Add to Home Screen** — and
  opened from there. Android and desktop Chrome work straight from the
  browser.
- The service role key bypasses every row-level security rule. It goes
  in `SUPABASE_SERVICE_ROLE_KEY` only — never in any variable that
  starts with `VITE_`, because those are built into the app anyone can
  download.
- The pieces: `src/lib/push.js` (the browser subscribes),
  `public/sw.js` (the service worker shows the notification and repairs
  a rotated subscription), `netlify/functions/push.mjs` (the relay the
  database calls), `netlify/functions/digest.mjs` (the daily summary),
  `netlify/functions/resub.mjs` (the repair), and
  `netlify/functions/lib/push-shared.mjs` (what they share — a
  subdirectory, so Netlify does not make a URL of it).
- `node scripts/e2e/push-relay.mjs` runs the relay against a stubbed
  network: which payloads it accepts, what each preference holds back,
  and how a rejected send reports itself. No keys or connection needed.
- **If a notification does not arrive**, the relay's own answer says
  where it stopped. Read it in the SQL editor:
  ```sql
  select status_code, content, created
  from net._http_response order by created desc limit 5;
  ```
  - `{"status":"ignored"}` — the row never looked like a notification.
  - `push_subscriptions read failed` — `SUPABASE_URL` is wrong. It is
    the project URL, `https://<ref>.supabase.co`, not the REST endpoint.
  - `{"sent":0,"failed":N,"errors":[…]}` — it reached the push service
    and was turned away; each error names the status, the service and
    its reason. `403 BadJwtToken` or `VapidPkHashMismatch` means the
    keys disagree: `VAPID_PUBLIC_KEY` must be the same string as
    `VITE_VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` its own half of
    that pair. Generating a new pair means every device has to
    subscribe again.
  - `{"sent":N}` — it left. Anything after that is the phone's.

## Starting again

To wipe every account, lesson, message and file and begin from nothing,
either:

- **The script** (thorough — removes the stored files too):
  ```
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service role key> \
  node scripts/wipe.mjs --yes
  ```
  It prints what it removes and what is left. Without `--yes` it
  refuses to run.
- **The SQL editor**: paste `supabase/wipe.sql` and run it. This deletes
  every account and row; the bucket listings come back empty, though
  the files behind them are only truly gone via the script.

Neither can be undone. Both leave the tables, policies and buckets in
place, so the app works again immediately with the first new sign-up.
