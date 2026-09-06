-- ============================================================
-- NOSCA — THE DATABASE
--
-- The one file. Run it in full in Supabase → SQL Editor → New query →
-- Run. It sets up a brand-new project, and it brings an older project
-- up to date whatever mix of the earlier files was run on it. Run it
-- again whenever you like: a second run changes nothing.
--
-- Nothing here deletes an account. The one block that does is
-- commented out, directly below, and stays that way unless you mean it.
--
-- The SQL editor runs the whole file as one transaction and shows only
-- the result of the last statement — so the file ends with a single
-- row that says what state everything is in. If anything is wrong the
-- file stops with an error and nothing is changed.
-- ============================================================


-- ============================================================
-- OPTIONAL — start again
--
-- Uncomment these two lines to wipe every account and everything that
-- belongs to one. Every table hangs off auth.users, so the two deletes
-- clear the lot. It cannot be undone.
--
-- Uploaded files are not rows: scripts/wipe.mjs removes them and the
-- accounts properly; supabase/wipe.sql is the SQL-editor version.
-- ============================================================
-- delete from public.families;
-- delete from auth.users;


-- ============================================================
-- 1 · TABLES
--
-- Each table is created in its full shape for a new project, then has
-- every column added since the first version put back with
-- "add column if not exists" for a project that already had it. Both
-- paths end with the same table.
-- ============================================================

-- ---------- profiles ----------
-- One row per person, created by the sign-up trigger in section 5.
-- A coach has an invite_code that players enter to ask to join them
-- (the coach accepts — see coach_requests). Nobody has a family until
-- they create or join one: family_id points at a row in families,
-- and a family is everyone who shares that row.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          text not null check (role in ('coach', 'player')),
  name          text not null,
  sport         text not null default 'golf',
  account_type  text,                                  -- coach · adult · junior · parent
  coach_id      uuid references public.profiles (id) on delete set null,
  invite_code   text,                                  -- coaches only
  date_of_birth date,
  phone         text,
  club          text,
  avatar_path   text,                                  -- <id>/avatar.jpg in the avatars bucket
  bio           text,                                  -- a line about them, shown on their profile
  created_at    timestamptz not null default now()
);
alter table public.profiles add column if not exists account_type  text;
alter table public.profiles add column if not exists coach_id      uuid references public.profiles (id) on delete set null;
alter table public.profiles add column if not exists invite_code   text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists club          text;
alter table public.profiles add column if not exists avatar_path   text;
alter table public.profiles add column if not exists bio           text;

-- ---------- families ----------
-- Created on purpose, by whoever wants one, from You → Family. The
-- code is what the rest of the household enters to join. An under-18
-- must join one at sign-up; anyone else may or may not. Whether a
-- member counts as an adult or a junior is their own row's business
-- (is_junior_of, section 7), not a column here.
create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text,                                     -- optional; "Your family" when null
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists family_id uuid references public.families (id) on delete set null;

-- ---------- coach_requests ----------
-- A player entering a coach's code asks; the coach accepts or declines.
-- Only an accepted request sets profiles.coach_id, and only through
-- respond_to_request() in section 8.
create table if not exists public.coach_requests (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles (id) on delete cascade,
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ---------- lessons ----------
-- A group lesson has no player_id and a group_name instead.
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  player_id   uuid references public.profiles (id) on delete cascade,
  group_name  text,
  kind        text not null default 'private' check (kind in ('private', 'group')),
  focus       text not null,
  subs        text[] not null default '{}',            -- sub-focus tags under the focus
  notes       text,
  lesson_date date not null default current_date,
  unread      boolean not null default true,           -- until the player opens it
  created_at  timestamptz not null default now()
);
alter table public.lessons add column if not exists subs   text[] not null default '{}';
alter table public.lessons add column if not exists unread boolean not null default true;
-- the coach asked, on this lesson, for a rating; the player is prompted once
alter table public.lessons add column if not exists rating_requested boolean not null default false;

-- ---------- lesson_media ----------
-- One row per uploaded file. storage_path is the path inside the
-- "media" bucket, which is always <coach id>/<lesson id>/<file>.
create table if not exists public.lesson_media (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  kind         text not null check (kind in ('video', 'photo', 'audio')),
  storage_path text not null,
  created_at   timestamptz not null default now()
);

-- ---------- lesson_attendees ----------
-- Who was actually at a group lesson. A private lesson carries its one
-- person in lessons.player_id; a group lesson carries a name and, until
-- now, nobody — so every per-player count and per-player list was of
-- private lessons only. A player in a weekly squad read as "1 lesson"
-- on their coach's screen, and their own log was empty.
-- One row per player per lesson, written when the lesson is logged.
-- Nothing is filled in for lessons logged before this table existed:
-- who is in a group today is not who was there in March, and a number
-- that is missing is honest where an invented one is not.
create table if not exists public.lesson_attendees (
  lesson_id  uuid not null references public.lessons  (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lesson_id, player_id)
);
-- the primary key answers "who was at this lesson"; this answers
-- "which lessons was this person at", which is the one the app asks
create index if not exists lesson_attendees_player_idx
  on public.lesson_attendees (player_id);

-- ---------- drills & tips ----------
create table if not exists public.drills (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tips (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  body       text,
  created_at timestamptz not null default now()
);

-- ---------- attendance ----------
create table if not exists public.attendance_sessions (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  label        text not null,                          -- "Summer clinic", or a player's name
  session_date date not null default current_date,
  created_at   timestamptz not null default now()
);

create table if not exists public.attendance_marks (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  state      text not null check (state in ('in', 'out')),
  unique (session_id, player_id)
);

-- ---------- bookings ----------
-- The diary. Logging a booking produces a lesson; logged_id points at it.
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  player_id    uuid references public.profiles (id) on delete cascade,
  group_name   text,
  booking_date date not null,
  start_time   text not null,
  duration     smallint not null default 45,
  kind         text not null default 'private' check (kind in ('private', 'group')),
  status       text not null default 'confirmed'
               check (status in ('confirmed', 'requested', 'cancelled', 'weather')),
  logged_id    uuid references public.lessons (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------- competitions ----------
-- A player's own upcoming events, or a coach's own (player_id null).
-- coach_id is optional: a player can add one before they have a coach,
-- and keeps it if the coach goes.
create table if not exists public.competitions (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid references public.profiles (id) on delete set null,
  player_id  uuid references public.profiles (id) on delete cascade,
  name       text not null,
  kind       text,
  venue      text,
  event_date date not null,
  created_at timestamptz not null default now()
);

-- ---------- recurring ----------
-- Standing weekly, fortnightly or monthly slots.
create table if not exists public.recurring (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  player_id  uuid references public.profiles (id) on delete cascade,
  group_name text,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time text not null,
  cadence    text not null default 'weekly' check (cadence in ('weekly', 'fortnightly', 'monthly')),
  until_date date,
  created_at timestamptz not null default now()
);

-- ---------- preferences ----------
-- How the app behaves for one person. The app upserts the whole row.
create table if not exists public.preferences (
  id             uuid primary key references public.profiles (id) on delete cascade,
  log_view       text not null default 'feed'    check (log_view in ('feed', 'cards', 'list')),
  cal_view       text not null default 'list'    check (cal_view in ('list', 'grid')),
  notify         text not null default 'instant' check (notify in ('instant', 'digest', 'quiet')),
  attendance     text not null default 'all'     check (attendance in ('all', 'private', 'group', 'off')),
  show_record    boolean not null default true,
  show_comps     boolean not null default true,
  reduce_data    boolean not null default false,
  ask_for_review boolean not null default true,
  custom_drills  jsonb not null default '{}'::jsonb,   -- the coach's own drills, keyed by sport
  availability   jsonb not null default '{}'::jsonb,   -- a coach's weekly hours (see coach_availability)
  groups         jsonb not null default '[]'::jsonb,   -- a coach's groups: name, members, day, time
  updated_at     timestamptz not null default now()
);
alter table public.preferences add column if not exists ask_for_review boolean not null default true;
alter table public.preferences add column if not exists custom_drills  jsonb not null default '{}'::jsonb;
-- { days: { "0": ["9:00 am", …], … "6": [] }, duration: 45, slots: [...], blocked: ["2026-09-08|9:00 am"] }
-- Day keys are Monday-first (0 = Monday), the same as everywhere in the app.
alter table public.preferences add column if not exists availability   jsonb not null default '{}'::jsonb;
-- [ { id, name, members: [player ids], names: [player names], day, time, weeks } ]
alter table public.preferences add column if not exists groups         jsonb not null default '[]'::jsonb;
-- When the daily summary last went out to this person. Only used when
-- notify = 'digest': netlify/functions/digest.mjs sends everything
-- unread since this moment and then moves it on, so nothing is
-- summarised twice and nothing that arrived while the job was down is
-- skipped. Null means they have never had one.
alter table public.preferences add column if not exists digest_at      timestamptz;

-- ---------- messages ----------
-- A thread is one coach and one player. sender_id is whoever wrote the
-- message: the coach, the player, or the player's guardian.
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- reviews ----------
-- One per player per coach; leaving another replaces it.
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (coach_id, player_id)
);

-- ---------- notifications ----------
-- One row per thing a person should be told about, written by the
-- triggers in section 10 — never by the app. The app reads them for
-- the bell and the "since you were away" list, marks them read, and
-- the push function (netlify/functions/push.mjs) forwards new ones to
-- any phone that asked for them.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,                            -- lesson · request · accepted · booking · message · drill · tip · weather · family
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,       -- { screen, id } — where a tap should land
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- push_subscriptions ----------
-- A browser that agreed to receive push: its endpoint and keys. One
-- row per device; the push function removes a row when the endpoint
-- has gone.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 2 · CONSTRAINTS, KEYS AND INDEXES
-- ============================================================

-- A player can sign up before they have a coach, and a competition
-- can belong to a player who has none.
alter table public.profiles     alter column coach_id drop not null;
alter table public.competitions alter column coach_id drop not null;

-- ---------- every foreign key, with the right "on delete" ----------
-- Deleting an account (section 9) removes the auth.users row and lets
-- the database take it from there, so every link to a person has to
-- say what happens when that person goes:
--   cascade   — the row was theirs and goes with them
--   set null  — the link was optional and is simply dropped
-- The first version of profiles.coach_id was "cascade", which would
-- have deleted every player's account along with their coach. This
-- block checks each key as it actually is and replaces any that is
-- missing or wrong, whatever it was named.
do $fk$
declare
  want record;
  have record;
  ok   boolean;
begin
  for want in
    select * from (values
      ('profiles',            'id',          'auth.users',                 'c'),
      ('profiles',            'coach_id',    'public.profiles',            'n'),
      ('profiles',            'family_id',   'public.families',            'n'),
      ('families',            'created_by',  'public.profiles',            'n'),
      ('coach_requests',      'player_id',   'public.profiles',            'c'),
      ('coach_requests',      'coach_id',    'public.profiles',            'c'),
      ('notifications',       'user_id',     'public.profiles',            'c'),
      ('push_subscriptions',  'user_id',     'public.profiles',            'c'),
      ('lessons',             'coach_id',    'public.profiles',            'c'),
      ('lessons',             'player_id',   'public.profiles',            'c'),
      ('lesson_media',        'lesson_id',   'public.lessons',             'c'),
      ('drills',              'coach_id',    'public.profiles',            'c'),
      ('drills',              'player_id',   'public.profiles',            'c'),
      ('tips',                'coach_id',    'public.profiles',            'c'),
      ('tips',                'player_id',   'public.profiles',            'c'),
      ('attendance_sessions', 'coach_id',    'public.profiles',            'c'),
      ('attendance_marks',    'session_id',  'public.attendance_sessions', 'c'),
      ('attendance_marks',    'player_id',   'public.profiles',            'c'),
      ('bookings',            'coach_id',    'public.profiles',            'c'),
      ('bookings',            'player_id',   'public.profiles',            'c'),
      ('bookings',            'logged_id',   'public.lessons',             'n'),
      ('competitions',        'coach_id',    'public.profiles',            'n'),
      ('competitions',        'player_id',   'public.profiles',            'c'),
      ('recurring',           'coach_id',    'public.profiles',            'c'),
      ('recurring',           'player_id',   'public.profiles',            'c'),
      ('preferences',         'id',          'public.profiles',            'c'),
      ('messages',            'coach_id',    'public.profiles',            'c'),
      ('messages',            'player_id',   'public.profiles',            'c'),
      ('messages',            'sender_id',   'public.profiles',            'c'),
      ('reviews',             'coach_id',    'public.profiles',            'c'),
      ('reviews',             'player_id',   'public.profiles',            'c')
    ) as t (tbl, col, ref, del)
  loop
    ok := false;
    for have in
      select c.conname, c.confdeltype, c.confrelid
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f'
        and c.conrelid = ('public.' || want.tbl)::regclass
        and array_length(c.conkey, 1) = 1
        and a.attname = want.col
    loop
      if have.confdeltype = want.del and have.confrelid = want.ref::regclass then
        ok := true;
      else
        execute format('alter table public.%I drop constraint %I', want.tbl, have.conname);
      end if;
    end loop;
    if not ok then
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references %s (id) on delete %s',
        want.tbl, want.tbl || '_' || want.col || '_fkey', want.col, want.ref,
        case want.del when 'c' then 'cascade' else 'set null' end);
    end if;
  end loop;
end
$fk$;

-- ---------- voice notes are media too ----------
-- The first version allowed only video and photo. Replaced only if the
-- constraint on this project is still the old one.
do $kind$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conrelid = 'public.lesson_media'::regclass and conname = 'lesson_media_kind_check';
  if def is null or def not like '%audio%' then
    alter table public.lesson_media drop constraint if exists lesson_media_kind_check;
    alter table public.lesson_media
      add constraint lesson_media_kind_check check (kind in ('video', 'photo', 'audio'));
  end if;
end
$kind$;

-- ---------- account_type ----------
-- A coach is a coach; a player is an adult, a junior, or a parent.
-- Older rows may carry values from an earlier scheme ("head",
-- "assistant"); they are brought into line before the rule is added.
update public.profiles
set account_type = lower(btrim(account_type))
where account_type is distinct from lower(btrim(account_type));
update public.profiles
set account_type = 'coach'
where role = 'coach' and account_type is distinct from 'coach';
update public.profiles
set account_type = null
where role = 'player' and account_type is not null
  and account_type not in ('adult', 'junior', 'parent');

do $type$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_account_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type is null or account_type in ('coach', 'adult', 'junior', 'parent'));
  end if;
end
$type$;

-- ---------- codes are unique, or they are nothing ----------
-- Older projects have these as unique constraints under the same
-- names; "if not exists" leaves those alone.
create unique index if not exists profiles_invite_code_key
  on public.profiles (invite_code) where invite_code is not null;

-- One open request per player per coach; a decided one stays as history.
create unique index if not exists coach_requests_open_key
  on public.coach_requests (player_id, coach_id) where status = 'pending';
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
-- the sender looks a person's devices up by user_id and nothing else
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- The app upserts a review on (coach_id, player_id) and a register
-- mark on (session_id, player_id); both need a unique key to land on.
create unique index if not exists reviews_coach_id_player_id_key
  on public.reviews (coach_id, player_id);
create unique index if not exists attendance_marks_session_id_player_id_key
  on public.attendance_marks (session_id, player_id);

-- A thread is read newest-last, one coach and one player at a time.
create index if not exists messages_thread_idx
  on public.messages (coach_id, player_id, created_at desc);


-- ============================================================
-- 3 · LEFTOVERS FROM EARLIER VERSIONS
-- ============================================================

-- The pilot caps (one coach, twenty players) are gone. The trigger
-- that enforced them also refused any player without a coach, which
-- failed sign-ups outright — so it is removed, not left as a no-op.
drop trigger if exists trg_pilot_limits         on public.profiles;
drop trigger if exists enforce_pilot_limits_trg on public.profiles;
drop function if exists public.enforce_pilot_limits() cascade;

-- These have changed what they return since they were first written,
-- and "create or replace" cannot change a return type. Nothing else
-- depends on them, so they can go and come back.
drop function if exists public.find_coach_by_code(text);
drop function if exists public.find_guardian_by_code(text) cascade;

-- The guardian link and the per-person family code are replaced by
-- the families table (section 4 carries anyone who had one across).
-- The helpers built on them go here; anything that referenced them —
-- old policies included — is rebuilt further down.
drop function if exists public.my_guardian_id() cascade;
drop function if exists public.coach_availability() cascade;   -- now takes a player, section 7


-- ============================================================
-- 4 · A SIX-CHARACTER CODE
--
-- No O or 0, no I or 1: these are read aloud and typed by hand. One
-- alphabet for invite codes and family codes, so a code is never
-- ambiguous about which kind it is.
-- ============================================================
create or replace function public.new_code()
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- a collision is vanishingly unlikely, but it would fail a sign-up,
    -- so check rather than hope
    exit when not exists (select 1 from public.profiles where invite_code = candidate)
         and not exists (select 1 from public.families where code = candidate);
  end loop;
  return candidate;
end;
$fn$;

-- Only the sign-up trigger and this file call it.
revoke all on function public.new_code() from public, anon, authenticated;

-- Anyone created before codes existed, or whose code was saved with
-- stray spaces or in lower case, gets one now.
update public.profiles
set invite_code = upper(btrim(invite_code))
where invite_code is distinct from upper(btrim(invite_code));
update public.profiles
set invite_code = public.new_code()
where role = 'coach' and (invite_code is null or invite_code = '');

-- ---------- families, carried over ----------
-- An older project linked people with profiles.guardian_id. Each
-- guardian who had anyone becomes a family, with everyone who named
-- them in it; then the old columns go. Nobody is unlinked by this.
do $fam$
declare
  g   record;
  fid uuid;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'guardian_id') then
    for g in
      execute 'select distinct guardian_id as id from public.profiles where guardian_id is not null'
    loop
      select family_id into fid from public.profiles where id = g.id;
      if fid is null then
        insert into public.families (code, created_by) values (public.new_code(), g.id) returning id into fid;
        update public.profiles set family_id = fid where id = g.id;
      end if;
      execute 'update public.profiles set family_id = $1 where guardian_id = $2 and family_id is null' using fid, g.id;
    end loop;
  end if;
end
$fam$;
alter table public.profiles drop column if exists guardian_id cascade;
alter table public.profiles drop column if exists family_code cascade;


-- ============================================================
-- 5 · SIGN-UP
--
-- The browser makes one signUp() call with everything as metadata.
-- This trigger writes the profile row in the same transaction as the
-- auth user, so the two can never disagree and there is no second
-- step to fail.
--
-- It must never raise. An exception here surfaces as "Database error
-- saving new user" and the person cannot sign up at all — so every
-- value is defended, and the last resort is a bare profile the person
-- can finish in the app.
--
-- Metadata keys read: role, name, sport, account_type, date_of_birth,
-- phone, coach_code, family_code.
--
-- A coach code becomes a request the coach sees and accepts; a family
-- code joins the family at once (it is shared within a household). A
-- parent who enters no family code has one created for them — that
-- is what they came for — and its code is shown on arrival.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role   text  := lower(btrim(coalesce(meta->>'role', '')));
  v_name   text  := nullif(btrim(coalesce(meta->>'name', '')), '');
  v_sport  text  := lower(btrim(coalesce(meta->>'sport', '')));
  v_type   text  := lower(btrim(coalesce(meta->>'account_type', '')));
  v_phone  text  := nullif(btrim(coalesce(meta->>'phone', '')), '');
  v_ccode  text  := upper(btrim(coalesce(meta->>'coach_code', '')));
  v_fcode  text  := upper(btrim(coalesce(meta->>'family_code', '')));
  v_dob    date;
  v_coach  uuid;
  v_fam    uuid;
begin
  -- role has a check constraint; anything unexpected is a player
  if v_role not in ('coach', 'player') then
    v_role := 'player';
  end if;

  -- name is not null on the table; the email's local part will do
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'Player'), '@', 1);
  end if;

  if v_sport = '' then
    v_sport := 'golf';
  end if;

  -- a coach's type is implied by the role; a player's must be one of
  -- the three or nothing
  if v_role = 'coach' then
    v_type := 'coach';
  elsif v_type not in ('adult', 'junior', 'parent') then
    v_type := null;
  end if;

  -- a bad date must not take the sign-up down with it
  begin
    v_dob := (nullif(meta->>'date_of_birth', ''))::date;
  exception when others then
    v_dob := null;
  end;

  -- A code that matches is used at once. One that doesn't is not an
  -- error: the account is created unlinked and the person adds their
  -- coach or family from the app. Coaches enter no coach code — they
  -- hand theirs out — but may join a family like anyone else.
  if v_role = 'player' and v_ccode <> '' then
    select p.id into v_coach
    from public.profiles p
    where p.role = 'coach' and upper(btrim(p.invite_code)) = v_ccode
    limit 1;
  end if;
  if v_fcode <> '' then
    select f.id into v_fam from public.families f where f.code = v_fcode limit 1;
  end if;

  insert into public.profiles (
    id, role, name, sport, account_type, date_of_birth, phone, invite_code, family_id
  ) values (
    new.id,
    v_role,
    v_name,
    v_sport,
    v_type,
    v_dob,
    v_phone,
    case when v_role = 'coach' then public.new_code() else null end,   -- only a coach invites
    v_fam
  )
  on conflict (id) do nothing;

  -- a parent with nowhere to join starts a family of their own
  if v_fam is null and v_type = 'parent' then
    insert into public.families (code, created_by) values (public.new_code(), new.id) returning id into v_fam;
    update public.profiles set family_id = v_fam where id = new.id;
  end if;

  -- the coach code asks; the coach answers from the app
  if v_coach is not null then
    insert into public.coach_requests (player_id, coach_id) values (new.id, v_coach)
    on conflict do nothing;
  end if;

  return new;

exception when others then
  -- Last resort: a plain profile rather than no account. Whatever went
  -- wrong above can be fixed in the app; a failed sign-up cannot.
  begin
    insert into public.profiles (id, role, name, sport)
    values (new.id, 'player', split_part(coalesce(new.email, 'Player'), '@', 1), 'golf')
    on conflict (id) do nothing;
  exception when others then
    null;
  end;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 6 · LOOKING UP A CODE
--
-- Callable before sign-in — a player entering a code during sign-up
-- has no session yet. Each returns only a name and what is needed to
-- confirm the match, never a whole profile. Both sides are trimmed
-- and upper-cased so a code matches however it was typed.
-- ============================================================
create or replace function public.find_coach_by_code(p_code text)
returns table (id uuid, sport text, name text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.id, p.sport, p.name
  from public.profiles p
  where p.role = 'coach'
    and upper(btrim(p.invite_code)) = upper(btrim(p_code))
  limit 1;
$fn$;

-- A family: its id, its name (the creator's when it has none), and how
-- many people are in it — enough to confirm "join the Kellys?", no more.
drop function if exists public.find_family_by_code(text);
create or replace function public.find_family_by_code(p_code text)
returns table (id uuid, name text, members int)
language sql
stable
security definer
set search_path = ''
as $fn$
  select f.id,
         coalesce(f.name, (select split_part(c.name, ' ', 1) || '''s family' from public.profiles c where c.id = f.created_by), 'A family') as name,
         (select count(*)::int from public.profiles m where m.family_id = f.id) as members
  from public.families f
  where f.code = upper(btrim(p_code))
  limit 1;
$fn$;

grant execute on function public.find_coach_by_code(text)  to anon, authenticated;
grant execute on function public.find_family_by_code(text) to anon, authenticated;


-- ============================================================
-- 7 · WHO IS LINKED TO WHOM
--
-- The rule every security policy below lives by: a policy on a table
-- must not read that table. Postgres runs the policy on the read, the
-- read runs the policy, and every query fails with 42P17 "infinite
-- recursion detected in policy". A security-definer function runs as
-- the table's owner, outside the policies, so it can read profiles
-- from inside a profiles policy without starting the loop. That is
-- all these are for.
--
-- Family words, used throughout: a member is a "junior" if they chose
-- so at sign-up or their date of birth says under 18; everyone else
-- in the family is an "adult". Adults see and act for the juniors;
-- juniors see themselves and who is in the family.
-- ============================================================

-- your coach (null for a coach, or a player who has none yet)
create or replace function public.my_coach_id()
returns uuid language sql stable security definer set search_path = ''
as $fn$ select p.coach_id from public.profiles p where p.id = auth.uid(); $fn$;

-- is this person a junior? Either answer marks them as one — what they
-- chose at sign-up, or their date of birth — the same rule the app uses.
create or replace function public.is_junior_of(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select coalesce((select p.role = 'player'
                      and (p.account_type = 'junior'
                           or (p.date_of_birth is not null
                               and p.date_of_birth > (current_date - interval '18 years')))
                   from public.profiles p where p.id = p_id), false);
$fn$;

-- A junior cannot request a booking or message a coach themselves;
-- an adult in their family does it for them.
create or replace function public.is_junior()
returns boolean language sql stable security definer set search_path = ''
as $fn$ select public.is_junior_of(auth.uid()); $fn$;

-- your family (null until you create or join one)
create or replace function public.my_family_id()
returns uuid language sql stable security definer set search_path = ''
as $fn$ select p.family_id from public.profiles p where p.id = auth.uid(); $fn$;

-- everyone else in your family
create or replace function public.my_family_member_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select p.id from public.profiles p
  where p.family_id is not null and p.family_id = public.my_family_id() and p.id <> auth.uid();
$fn$;

-- the people you look after: the juniors in your family, if you are an
-- adult in it. Every policy that says "your family's" means this.
create or replace function public.my_family_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select p.id from public.profiles p
  where p.family_id is not null and p.family_id = public.my_family_id()
    and p.id <> auth.uid()
    and not public.is_junior()
    and public.is_junior_of(p.id);
$fn$;

-- the coaches of the people you look after, so you can see who they are
create or replace function public.my_family_coach_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select p.coach_id from public.profiles p
  where p.id in (select public.my_family_ids()) and p.coach_id is not null;
$fn$;

-- the adults who look after your junior players, so a coach can see who
-- handles a junior (and who is writing in that junior's thread)
create or replace function public.my_players_guardian_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select a.id
  from public.profiles j
  join public.profiles a on a.family_id = j.family_id and a.id <> j.id
  where j.coach_id = auth.uid() and j.family_id is not null
    and public.is_junior_of(j.id) and not public.is_junior_of(a.id);
$fn$;

-- the coach of a given player
create or replace function public.coach_of(p_player uuid)
returns uuid language sql stable security definer set search_path = ''
as $fn$ select p.coach_id from public.profiles p where p.id = p_player; $fn$;

-- coaches you have asked to join: while they decide, so their name can
-- be shown next to "request sent" — and for a month after a refusal,
-- so the screen can say who it was
create or replace function public.my_pending_coach_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select r.coach_id from public.coach_requests r
  where r.player_id = auth.uid()
    and (r.status = 'pending'
         or (r.status = 'declined' and r.decided_at > now() - interval '30 days'));
$fn$;

-- players asking to join you, so their name shows on the request
create or replace function public.my_requesting_player_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select r.player_id from public.coach_requests r
  where r.coach_id = auth.uid() and r.status = 'pending';
$fn$;

-- A coach's weekly hours, for booking into. Preferences are otherwise
-- theirs alone, and a player needs exactly one thing from their
-- coach's row — the hours — so this returns that and nothing else.
-- With no argument: your own coach's. With a player's id: that
-- player's coach's, allowed when the player is you or someone you look
-- after (an adult booking for a junior). Nothing set, or no right to
-- ask, reads as an empty object.
create or replace function public.coach_availability(p_player uuid default null)
returns jsonb language sql stable security definer set search_path = ''
as $fn$
  select case
    when p_player is null or p_player = auth.uid()
      then coalesce((select pr.availability from public.preferences pr
                     where pr.id = public.my_coach_id()), '{}'::jsonb)
    when p_player in (select public.my_family_ids())
      then coalesce((select pr.availability from public.preferences pr
                     where pr.id = public.coach_of(p_player)), '{}'::jsonb)
    else '{}'::jsonb
  end;
$fn$;

-- registers you, or someone you look after, were marked in. The
-- sessions policy needs this because it may not read the marks table
-- directly: the marks policy reads sessions, and two tables reading
-- each other recurse just as one reading itself does.
create or replace function public.my_attendance_session_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select m.session_id from public.attendance_marks m
  where m.player_id = auth.uid()
     or m.player_id in (select public.my_family_ids());
$fn$;

-- Group lessons you, or someone you look after, were at. The lessons
-- policy needs this because it may not read lesson_attendees directly:
-- the lesson_attendees policy reads lessons, and two tables reading
-- each other recurse just as one reading itself does. Being security
-- definer, this reads the attendee list outside the policies, which is
-- what stops the loop — the same reason my_attendance_session_ids()
-- exists.
create or replace function public.my_lesson_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $fn$
  select a.lesson_id from public.lesson_attendees a
  where a.player_id = auth.uid()
     or a.player_id in (select public.my_family_ids());
$fn$;

-- Policies run as the signed-in person, so that role must be allowed
-- to call these. Nobody else needs to.
do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'my_coach_id()', 'is_junior_of(uuid)', 'is_junior()', 'my_family_id()', 'my_family_member_ids()',
    'my_family_ids()', 'my_family_coach_ids()', 'my_players_guardian_ids()', 'coach_of(uuid)',
    'my_pending_coach_ids()', 'my_requesting_player_ids()', 'coach_availability(uuid)',
    'my_attendance_session_ids()', 'my_lesson_ids()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end
$grants$;


-- ============================================================
-- 8 · JOINING, LEAVING, ASKING AND ANSWERING
--
-- One call each, for a signed-in person. The checks and the write
-- happen together in the database, so the app cannot show "joined"
-- while the row stayed as it was. The messages raised here are shown
-- to people word for word.
-- ============================================================

-- A player asks to join a coach. Returns {id, name, sport, status} of
-- the coach: status 'pending' for a new or existing request.
create or replace function public.join_coach(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  me      uuid := auth.uid();
  code    text := upper(btrim(coalesce(p_code, '')));
  my_role text;
  my_coach uuid;
  c       record;
begin
  if me is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  if code = '' then
    raise exception 'Enter your coach''s code.';
  end if;

  select p.id, p.name, p.sport into c
  from public.profiles p
  where p.role = 'coach' and upper(btrim(p.invite_code)) = code
  limit 1;
  if not found then
    raise exception 'That code doesn''t match a coach.';
  end if;
  if c.id = me then
    raise exception 'That''s your own code.';
  end if;

  select p.role, p.coach_id into my_role, my_coach from public.profiles p where p.id = me;
  if my_role is null then
    raise exception 'Your account isn''t finished. Sign out, sign back in, and try again.';
  end if;
  if my_role = 'coach' then
    raise exception 'A coach account can''t join another coach as a player.';
  end if;
  if my_coach = c.id then
    raise exception 'You''re with % already.', c.name;
  end if;
  if my_coach is not null then
    raise exception 'Leave your current coach first — open their profile from Home.';
  end if;

  insert into public.coach_requests (player_id, coach_id) values (me, c.id)
  on conflict do nothing;

  return jsonb_build_object('id', c.id, 'name', c.name, 'sport', c.sport, 'status', 'pending');
end;
$fn$;

-- The coach answers. Accepting links the player; either way the
-- request is kept as history and the player is told (section 10).
create or replace function public.respond_to_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  me uuid := auth.uid();
  r  record;
begin
  if me is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  select * into r from public.coach_requests where id = p_id and coach_id = me and status = 'pending';
  if not found then
    raise exception 'That request isn''t waiting any more.';
  end if;
  update public.coach_requests
  set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
  where id = p_id;
  if p_accept then
    update public.profiles set coach_id = me where id = r.player_id;
  end if;
end;
$fn$;

-- The player withdraws a request they made.
create or replace function public.cancel_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  update public.coach_requests set status = 'cancelled', decided_at = now()
  where id = p_id and player_id = auth.uid() and status = 'pending';
end;
$fn$;

create or replace function public.leave_coach()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  update public.profiles set coach_id = null where id = auth.uid();
end;
$fn$;

-- Start a family. Returns {id, code, name}.
create or replace function public.create_family(p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  me     uuid := auth.uid();
  fid    uuid;
  v_code text;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if me is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  if public.my_family_id() is not null then
    raise exception 'You''re in a family already. Leave it first to start another.';
  end if;
  v_code := public.new_code();
  insert into public.families (code, name, created_by) values (v_code, v_name, me) returning id into fid;
  update public.profiles set family_id = fid where id = me;
  return jsonb_build_object('id', fid, 'code', v_code, 'name', v_name);
end;
$fn$;

-- Join a family by its code. Returns {id, code, name, members}.
create or replace function public.join_family(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  me     uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  f      record;
  n      int;
begin
  if me is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  if v_code = '' then
    raise exception 'Enter the family code.';
  end if;
  select * into f from public.families fam where fam.code = v_code limit 1;
  if not found then
    raise exception 'That code doesn''t match a family.';
  end if;
  if public.my_family_id() = f.id then
    raise exception 'You''re in this family already.';
  end if;
  if public.my_family_id() is not null then
    raise exception 'You''re in a family already. Leave it first to join another.';
  end if;
  update public.profiles set family_id = f.id where id = me;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Couldn''t join that family. Please try again.';
  end if;
  select count(*) into n from public.profiles where family_id = f.id;
  return jsonb_build_object('id', f.id, 'code', f.code, 'name', f.name, 'members', n);
end;
$fn$;

-- Any adult in the family may name it.
create or replace function public.rename_family(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  if public.my_family_id() is null then
    raise exception 'You''re not in a family.';
  end if;
  if public.is_junior() then
    raise exception 'An adult in the family names it.';
  end if;
  update public.families set name = nullif(btrim(coalesce(p_name, '')), '') where id = public.my_family_id();
end;
$fn$;

-- Leave; an empty family is removed with you.
create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  fid uuid := public.my_family_id();
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to do that.';
  end if;
  update public.profiles set family_id = null where id = auth.uid();
  if fid is not null and not exists (select 1 from public.profiles where family_id = fid) then
    delete from public.families where id = fid;
  end if;
end;
$fn$;

do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'join_coach(text)', 'respond_to_request(uuid, boolean)', 'cancel_request(uuid)', 'leave_coach()',
    'create_family(text)', 'join_family(text)', 'rename_family(text)', 'leave_family()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end
$grants$;


-- ============================================================
-- 9 · DELETING YOUR OWN ACCOUNT
--
-- A signed-in person has no rights over auth.users. This runs as its
-- owner and only ever deletes auth.uid() — there is no argument to
-- point it at anyone else. Removing the auth.users row cascades
-- through profiles and every table that hangs off it; the foreign
-- keys in section 2 are what make that safe.
-- ============================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'You need to be signed in to do that.';
  end if;

  -- People linked to this account keep their own, minus the link. The
  -- foreign keys would do this anyway; saying it here keeps the intent
  -- where it can be read. A family left empty goes too.
  update public.profiles set coach_id = null where coach_id = me;
  perform public.leave_family();

  -- A coach's own competitions have nobody left to belong to.
  delete from public.competitions where coach_id = me and player_id is null;

  -- Media rows for lessons this person was part of. The files themselves
  -- are removed by the app before it calls this.
  delete from public.lesson_media
  where lesson_id in (select l.id from public.lessons l
                      where l.coach_id = me or l.player_id = me);

  -- And their place on any group lesson. The row cascades when their
  -- profile goes, but a coach deleting their account takes the lessons
  -- with them, so clear both directions explicitly.
  delete from public.lesson_attendees
  where player_id = me
     or lesson_id in (select l.id from public.lessons l where l.coach_id = me);

  -- Some projects record who uploaded each file with a key to
  -- auth.users; a file left behind would then hold the account open.
  -- Clearing the owner releases it. Guarded, because the column and
  -- the right to touch it vary between projects.
  begin
    update storage.objects set owner = null where owner = me;
  exception when others then
    null;
  end;

  delete from auth.users where id = me;
end;
$fn$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- ============================================================
-- 10 · TELLING PEOPLE
--
-- Every notification is written here, by a trigger, in the same
-- transaction as the thing it is about — a lesson logged, a request
-- made or answered, a booking asked for, confirmed or called off, a
-- message, a drill, a tip. The app never inserts one. Each trigger
-- runs as the owner so it can write the row whoever caused it, and
-- each is wrapped so that a notification failing can never fail the
-- thing it describes.
-- ============================================================

-- One row for one person. Internal: nothing but the triggers call it.
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb));
exception when others then
  null;
end;
$fn$;
revoke all on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- The adults who look after a junior — told the same things the junior
-- is. An adult player's own family is not told about their lessons.
create or replace function public.adults_for(p_player uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select a.id
  from public.profiles j
  join public.profiles a on a.family_id = j.family_id and a.id <> j.id
  where j.id = p_player and j.family_id is not null
    and public.is_junior_of(j.id) and not public.is_junior_of(a.id);
$fn$;
revoke all on function public.adults_for(uuid) from public, anon, authenticated;

create or replace function public.name_of(p_id uuid)
returns text language sql stable security definer set search_path = ''
as $fn$ select coalesce((select p.name from public.profiles p where p.id = p_id), 'Someone'); $fn$;
revoke all on function public.name_of(uuid) from public, anon, authenticated;

create or replace function public.first_name_of(p_id uuid)
returns text language sql stable security definer set search_path = ''
as $fn$ select split_part(public.name_of(p_id), ' ', 1); $fn$;
revoke all on function public.first_name_of(uuid) from public, anon, authenticated;

create or replace function public.nice_date(p_date date)
returns text language sql immutable set search_path = ''
as $fn$ select trim(to_char(p_date, 'Dy DD Mon')); $fn$;

-- ---------- a lesson is logged ----------
create or replace function public.trg_lessons_notify()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare a uuid;
begin
  if new.player_id is not null then
    perform public.notify(new.player_id, 'lesson', 'New lesson logged',
      new.focus || ' · ' || public.name_of(new.coach_id), jsonb_build_object('screen', 'lesson', 'id', new.id));
    for a in select public.adults_for(new.player_id) loop
      perform public.notify(a, 'lesson', public.first_name_of(new.player_id) || '''s lesson was logged',
        new.focus || ' · ' || public.name_of(new.coach_id), jsonb_build_object('screen', 'family', 'id', new.id));
    end loop;
  end if;
  return new;
exception when others then return new;
end $fn$;
drop trigger if exists lessons_notify on public.lessons;
create trigger lessons_notify after insert on public.lessons
  for each row execute function public.trg_lessons_notify();

-- ---------- a player asks to join; the coach answers ----------
create or replace function public.trg_requests_notify()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.coach_id, 'request', public.name_of(new.player_id) || ' asked to join you',
      'Tap to accept or decline.', jsonb_build_object('screen', 'requests', 'id', new.id));
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'accepted' then
      perform public.notify(new.player_id, 'accepted', public.name_of(new.coach_id) || ' accepted you',
        'Your lessons, drills and messages start here.', jsonb_build_object('screen', 'home', 'id', new.id));
    elsif new.status = 'declined' then
      perform public.notify(new.player_id, 'declined', public.name_of(new.coach_id) || ' couldn''t take you on',
        'You can ask another coach with their code.', jsonb_build_object('screen', 'home', 'id', new.id));
    end if;
  end if;
  return new;
exception when others then return new;
end $fn$;
drop trigger if exists requests_notify on public.coach_requests;
create trigger requests_notify after insert or update on public.coach_requests
  for each row execute function public.trg_requests_notify();

-- ---------- bookings: asked for, confirmed, cancelled, weather ----------
create or replace function public.trg_bookings_notify()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  a     uuid;
  whn   text := public.nice_date(new.booking_date) || ' ' || new.start_time;
  actor uuid := auth.uid();
begin
  if new.player_id is null then return new; end if;   -- a group slot tells nobody
  if tg_op = 'INSERT' then
    if new.status = 'requested' then
      perform public.notify(new.coach_id, 'booking', public.name_of(new.player_id) || ' asked for a lesson',
        whn, jsonb_build_object('screen', 'today', 'id', new.id));
    elsif new.status = 'confirmed' then
      perform public.notify(new.player_id, 'booking', 'Lesson booked', whn || ' · ' || public.name_of(new.coach_id),
        jsonb_build_object('screen', 'calendar', 'id', new.id));
      for a in select public.adults_for(new.player_id) loop
        perform public.notify(a, 'booking', public.first_name_of(new.player_id) || ' has a lesson booked', whn,
          jsonb_build_object('screen', 'family', 'id', new.id));
      end loop;
    end if;
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'confirmed' then
      perform public.notify(new.player_id, 'booking', 'Lesson confirmed', whn || ' · ' || public.name_of(new.coach_id),
        jsonb_build_object('screen', 'calendar', 'id', new.id));
      for a in select public.adults_for(new.player_id) loop
        perform public.notify(a, 'booking', public.first_name_of(new.player_id) || '''s lesson is confirmed', whn,
          jsonb_build_object('screen', 'family', 'id', new.id));
      end loop;
    elsif new.status = 'weather' then
      perform public.notify(new.player_id, 'weather', 'Called off for weather', whn || ' · ' || public.name_of(new.coach_id),
        jsonb_build_object('screen', 'calendar', 'id', new.id));
      for a in select public.adults_for(new.player_id) loop
        perform public.notify(a, 'weather', public.first_name_of(new.player_id) || '''s lesson is called off', whn || ' · weather',
          jsonb_build_object('screen', 'family', 'id', new.id));
      end loop;
    elsif new.status = 'cancelled' then
      if actor is not null and actor = new.coach_id then
        perform public.notify(new.player_id, 'booking', 'Lesson cancelled', whn || ' · ' || public.name_of(new.coach_id),
          jsonb_build_object('screen', 'calendar', 'id', new.id));
        for a in select public.adults_for(new.player_id) loop
          perform public.notify(a, 'booking', public.first_name_of(new.player_id) || '''s lesson is cancelled', whn,
            jsonb_build_object('screen', 'family', 'id', new.id));
        end loop;
      else
        perform public.notify(new.coach_id, 'booking', public.name_of(new.player_id) || ' cancelled', whn,
          jsonb_build_object('screen', 'calendar', 'id', new.id));
      end if;
    end if;
  end if;
  return new;
exception when others then return new;
end $fn$;
drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify after insert or update on public.bookings
  for each row execute function public.trg_bookings_notify();

-- ---------- a message ----------
create or replace function public.trg_messages_notify()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  a    uuid;
  snip text := left(new.body, 90);
begin
  if new.sender_id = new.coach_id then
    perform public.notify(new.player_id, 'message', public.name_of(new.coach_id), snip,
      jsonb_build_object('screen', 'thread', 'id', new.player_id));
    for a in select public.adults_for(new.player_id) loop
      perform public.notify(a, 'message', public.name_of(new.coach_id) || ' → ' || public.first_name_of(new.player_id), snip,
        jsonb_build_object('screen', 'thread', 'id', new.player_id));
    end loop;
  else
    perform public.notify(new.coach_id, 'message', public.name_of(new.sender_id), snip,
      jsonb_build_object('screen', 'thread', 'id', new.player_id));
  end if;
  return new;
exception when others then return new;
end $fn$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.trg_messages_notify();

-- ---------- drills, once per player per save ----------
create or replace function public.trg_drills_notify()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare r record; a uuid;
begin
  for r in select player_id, coach_id, count(*) as n, min(title) as one from new_rows group by player_id, coach_id loop
    perform public.notify(r.player_id, 'drill',
      case when r.n = 1 then 'New drill: ' || r.one else r.n || ' new drills' end,
      public.name_of(r.coach_id), jsonb_build_object('screen', 'practice'));
    for a in select public.adults_for(r.player_id) loop
      perform public.notify(a, 'drill', public.first_name_of(r.player_id) || ' has ' || case when r.n = 1 then 'a new drill' else r.n || ' new drills' end,
        public.name_of(r.coach_id), jsonb_build_object('screen', 'family'));
    end loop;
  end loop;
  return null;
exception when others then return null;
end $fn$;
drop trigger if exists drills_notify on public.drills;
create trigger drills_notify after insert on public.drills
  referencing new table as new_rows
  for each statement execute function public.trg_drills_notify();

-- ---------- a tip ----------
create or replace function public.trg_tips_notify()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare a uuid;
begin
  perform public.notify(new.player_id, 'tip', 'Something to work on', new.title || ' · ' || public.name_of(new.coach_id),
    jsonb_build_object('screen', 'tips'));
  for a in select public.adults_for(new.player_id) loop
    perform public.notify(a, 'tip', public.first_name_of(new.player_id) || ' has something to work on', new.title,
      jsonb_build_object('screen', 'family'));
  end loop;
  return new;
exception when others then return new;
end $fn$;
drop trigger if exists tips_notify on public.tips;
create trigger tips_notify after insert on public.tips
  for each row execute function public.trg_tips_notify();

-- ---------- someone joins your family ----------
create or replace function public.trg_family_notify()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare m uuid;
begin
  if new.family_id is not null and (tg_op = 'INSERT' or new.family_id is distinct from old.family_id) then
    for m in select id from public.profiles where family_id = new.family_id and id <> new.id loop
      perform public.notify(m, 'family', new.name || ' joined your family', null, jsonb_build_object('screen', 'family'));
    end loop;
  end if;
  return new;
exception when others then return new;
end $fn$;
drop trigger if exists family_notify on public.profiles;
create trigger family_notify after insert or update of family_id on public.profiles
  for each row execute function public.trg_family_notify();

-- New rows reach an open app the moment they are written, when the
-- project's realtime publication exists (it does on Supabase; the
-- local test cluster has none, so this is allowed to do nothing).
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when others then
  null;
end
$rt$;


-- ============================================================
-- 10b · CALLING THE SENDER
--
-- Sections 5 to 10 write a notification row for everything worth
-- telling someone about. That row lights the bell inside the app. To
-- reach a phone with the app CLOSED it has to leave the database, and
-- this is the hop that carries it: an after-insert trigger that posts
-- the row to the relay (netlify/functions/push.mjs), which signs it
-- with the VAPID keys and hands it to each of that person's devices.
--
-- It lived only as a dashboard click before, described in the README
-- and in no file — so a fresh project set up by running this script
-- wrote every notification and pushed none of them, silently. It is
-- here now, because this file is the source of truth.
--
-- WHAT THE FOUNDER FILLS IN, once, after the first run:
--   insert into public.app_settings (key, value) values
--     ('push_url',    'https://<your-site>.netlify.app/.netlify/functions/push'),
--     ('push_secret', '<the same string as PUSH_SECRET on Netlify>')
--   on conflict (key) do update set value = excluded.value;
--
-- Until both rows exist the trigger does nothing at all — no error, no
-- delay, no half-sent notification. Section 14 reports which state it
-- is in.
--
-- pg_net posts without waiting for the answer, so a slow or missing
-- relay can never hold up the write that caused it. If the extension
-- is unavailable the block below is skipped and the app behaves
-- exactly as it does today: the bell works, the phone stays quiet.
-- ============================================================

-- Settings the database itself needs. Only the service role may read
-- it: the secret in here must never reach a browser, and nothing in
-- the app has any reason to ask for it.
create table if not exists public.app_settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
-- No policy is granted to authenticated or anon on purpose. RLS with no
-- policy denies everyone except the service role, which is what we want.
drop policy if exists "app_settings: nobody" on public.app_settings;

-- pg_net is present on Supabase and absent on a bare Postgres, so this
-- may not be possible — and must never stop the file when it is not.
do $net$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net unavailable (%) — the bell works, phones stay quiet', sqlerrm;
end
$net$;

create or replace function public.notify_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  url  text;
  key  text;
begin
  select value into url from public.app_settings where key = 'push_url';
  select value into key from public.app_settings where key = 'push_secret';
  -- not configured yet: the bell still works, nothing is sent
  if url is null or key is null or url = '' or key = '' then
    return new;
  end if;
  perform extensions.net_http_post(
    url     := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nosca-secret', key),
    body    := jsonb_build_object(
                 'user_id', new.user_id,
                 'title',   new.title,
                 'body',    new.body,
                 'kind',    new.kind,
                 'data',    coalesce(new.data, '{}'::jsonb)),
    timeout_milliseconds := 4000);
  return new;
exception when others then
  -- A notification is never lost because the push failed to leave.
  return new;
end
$$;

do $push$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where p.proname = 'net_http_post' and n.nspname = 'extensions') then
    drop trigger if exists notifications_push on public.notifications;
    create trigger notifications_push
      after insert on public.notifications
      for each row execute function public.notify_push();
  else
    raise notice 'pg_net not available — the bell works, phones stay quiet until it is enabled';
  end if;
end
$push$;


-- ============================================================
-- 11 · THE LESSONS VIEW
--
-- What the app reads instead of the lessons table: each lesson with
-- the day and month already formatted, how many files it carries,
-- who it was with, and the coach's name.
--
-- security_invoker matters. A view normally runs as the user who
-- created it — here the database owner, who is not subject to
-- row-level security — so a plain view would have handed every
-- lesson to everyone. With it, the view runs as the person reading
-- and the policies on lessons, profiles and lesson_media apply.
--
-- Dropped and recreated rather than replaced: "create or replace"
-- cannot reorder or remove a view's columns, and the shape here is
-- the one the app reads.
-- ============================================================
drop view if exists public.lessons_view;
create view public.lessons_view
with (security_invoker = true)
as
select
  l.id,
  l.coach_id,
  l.player_id,
  l.group_name,
  l.kind,
  l.focus,
  l.subs,
  l.notes,
  l.lesson_date,
  l.unread,
  l.rating_requested,
  l.created_at,
  to_char(l.lesson_date, 'DD')          as d,
  upper(to_char(l.lesson_date, 'Mon'))  as m,
  coalesce(mc.videos, 0)::int           as videos,     -- clips only; a card that says "2 clips" means 2 clips
  coalesce(mc.photos, 0)::int           as photos,
  coalesce(mc.audio, 0)::int            as audio,      -- voice notes
  coalesce(mc.n, 0)::int                as media,      -- everything attached
  case when l.kind = 'group' then l.group_name else p.name end as who,
  c.name                                as coach_name
from public.lessons l
left join public.profiles p on p.id = l.player_id
left join public.profiles c on c.id = l.coach_id
left join (
  select lesson_id,
         count(*)                               as n,
         count(*) filter (where kind = 'video') as videos,
         count(*) filter (where kind = 'photo') as photos,
         count(*) filter (where kind = 'audio') as audio
  from public.lesson_media
  group by lesson_id
) mc on mc.lesson_id = l.id;


-- ============================================================
-- 12 · WHO CAN SEE AND CHANGE WHAT
--
-- In short:
--   a coach     reads and writes their own rows, sees their players and
--               the people asking to join them
--   a player    sees their own rows, their coach and their family; may
--               request a booking, tick a drill, add a competition,
--               message, and review
--   an adult in a family sees everything of the juniors in it, and may
--               request a booking or message on their behalf
--   a junior    may not request or message themselves
--   anyone else nothing
--
-- Every policy is granted to the authenticated role only, so a request
-- with no sign-in never evaluates one. And no policy reads its own
-- table: anything that needs another person's row goes through the
-- functions in section 7.
-- ============================================================

-- ---------- start from nothing ----------
-- Every policy on these tables is dropped, whatever it was called. The
-- names changed with every earlier migration, and a single old one left
-- behind — the recursive profiles policy, say — is enough to break
-- every read. This file is the whole truth about policies.
do $drop$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'families', 'coach_requests', 'lessons', 'lesson_media', 'lesson_attendees',
                        'drills', 'tips', 'attendance_sessions', 'attendance_marks', 'bookings',
                        'competitions', 'recurring', 'preferences', 'messages', 'reviews',
                        'notifications', 'push_subscriptions')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$drop$;

alter table public.profiles            enable row level security;
alter table public.families            enable row level security;
alter table public.coach_requests      enable row level security;
alter table public.notifications       enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_media        enable row level security;
alter table public.lesson_attendees    enable row level security;
alter table public.drills              enable row level security;
alter table public.tips                enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_marks    enable row level security;
alter table public.bookings            enable row level security;
alter table public.competitions        enable row level security;
alter table public.recurring           enable row level security;
alter table public.preferences         enable row level security;
alter table public.messages            enable row level security;
alter table public.reviews             enable row level security;

-- ---------- table privileges ----------
-- Policies decide which rows; these decide which verbs. Nobody
-- reaches a table without signing in — the two code lookups above
-- are the only thing the sign-up screen needs. Profiles are created
-- by the trigger and deleted through delete_my_account(), never by
-- the app directly.
grant usage on schema public to anon, authenticated;

revoke all on public.profiles, public.families, public.coach_requests, public.notifications,
              public.push_subscriptions, public.lessons, public.lesson_media, public.lesson_attendees, public.drills,
              public.tips, public.attendance_sessions, public.attendance_marks,
              public.bookings, public.competitions, public.recurring,
              public.preferences, public.messages, public.reviews, public.lessons_view
  from anon;

revoke all on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;
-- families and requests change only through the functions in section 8;
-- notifications are written only by the triggers in section 10
revoke all on public.families, public.coach_requests, public.notifications from authenticated;
grant select on public.families, public.coach_requests to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

grant select, insert, update, delete on
  public.lessons, public.lesson_media, public.lesson_attendees, public.drills, public.tips,
  public.attendance_sessions, public.attendance_marks, public.bookings,
  public.competitions, public.recurring, public.preferences,
  public.messages, public.reviews
  to authenticated;

grant select on public.lessons_view to authenticated;

-- ---------- profiles ----------
create policy "profiles: the people you are linked to" on public.profiles
  for select to authenticated using (
    id = auth.uid()                                          -- yourself
    or coach_id = auth.uid()                                 -- your players
    or id = public.my_coach_id()                             -- your coach
    or (family_id is not null
        and family_id = public.my_family_id())               -- your family
    or id in (select public.my_family_coach_ids())           -- who coaches the juniors you look after
    or id in (select public.my_players_guardian_ids())       -- who looks after your junior players
    or id in (select public.my_pending_coach_ids())          -- a coach you have asked to join
    or id in (select public.my_requesting_player_ids())      -- players asking to join you
  );

-- Your own row, and only the columns that are yours to change: the
-- links (coach_id, family_id) move only through the functions.
create policy "profiles: change your own row" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid()
              and coach_id is not distinct from public.my_coach_id()
              and family_id is not distinct from public.my_family_id());

-- ---------- families ----------
create policy "families: yours" on public.families
  for select to authenticated using (id = public.my_family_id());

-- ---------- coach_requests ----------
create policy "coach_requests: ones you made or received" on public.coach_requests
  for select to authenticated using (player_id = auth.uid() or coach_id = auth.uid());

-- ---------- notifications ----------
create policy "notifications: yours" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: mark your own read" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: clear your own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------- push_subscriptions ----------
create policy "push_subscriptions: your own devices" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- lessons ----------
create policy "lessons: yours, your family's, and your coach's group lessons" on public.lessons
  for select to authenticated using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or player_id in (select public.my_family_ids())
    or (kind = 'group'
        and (coach_id = public.my_coach_id()
             or coach_id in (select public.my_family_coach_ids())))
    -- a group lesson you were actually marked at stays yours even after
    -- you leave that coach
    or id in (select public.my_lesson_ids())
  );

create policy "lessons: the coach writes them" on public.lessons
  for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- lesson_media ----------
-- Whether you may see a file follows from whether you may see its
-- lesson; the lessons policy is applied inside the subquery.
create policy "lesson_media: files of lessons you can see" on public.lesson_media
  for select to authenticated using (
    exists (select 1 from public.lessons l where l.id = lesson_id)
  );

create policy "lesson_media: the lesson's coach writes them" on public.lesson_media
  for all to authenticated
  using      (exists (select 1 from public.lessons l where l.id = lesson_id and l.coach_id = auth.uid()))
  with check (exists (select 1 from public.lessons l where l.id = lesson_id and l.coach_id = auth.uid()));

-- ---------- lesson_attendees ----------
-- Same shape as lesson_media: whether you may see who was at a lesson
-- follows from whether you may see the lesson, and the lessons policy
-- is applied inside the subquery. This table never reads itself, and
-- the lessons policy reaches it only through my_lesson_ids(), which is
-- security definer — so neither recurses into the other.
create policy "lesson_attendees: of lessons you can see" on public.lesson_attendees
  for select to authenticated using (
    exists (select 1 from public.lessons l where l.id = lesson_id)
  );

create policy "lesson_attendees: the lesson's coach writes them" on public.lesson_attendees
  for all to authenticated
  using      (exists (select 1 from public.lessons l where l.id = lesson_id and l.coach_id = auth.uid()))
  with check (exists (select 1 from public.lessons l where l.id = lesson_id and l.coach_id = auth.uid()));

-- ---------- drills ----------
create policy "drills: yours or your family's" on public.drills
  for select to authenticated using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or player_id in (select public.my_family_ids())
  );

create policy "drills: the coach sets them" on public.drills
  for insert to authenticated with check (coach_id = auth.uid());

create policy "drills: the coach edits, the player ticks" on public.drills
  for update to authenticated
  using      (coach_id = auth.uid() or player_id = auth.uid())
  with check (coach_id = auth.uid() or player_id = auth.uid());

create policy "drills: the coach removes them" on public.drills
  for delete to authenticated using (coach_id = auth.uid());

-- ---------- tips ----------
create policy "tips: yours or your family's" on public.tips
  for select to authenticated using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or player_id in (select public.my_family_ids())
  );

create policy "tips: the coach writes them" on public.tips
  for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- attendance ----------
create policy "attendance_sessions: yours, or ones you were marked in" on public.attendance_sessions
  for select to authenticated using (
    coach_id = auth.uid()
    or id in (select public.my_attendance_session_ids())
  );

create policy "attendance_sessions: the coach takes them" on public.attendance_sessions
  for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy "attendance_marks: yours, your family's, or your register" on public.attendance_marks
  for select to authenticated using (
    player_id = auth.uid()
    or player_id in (select public.my_family_ids())
    or exists (select 1 from public.attendance_sessions s
               where s.id = session_id and s.coach_id = auth.uid())
  );

create policy "attendance_marks: the coach marks them" on public.attendance_marks
  for all to authenticated
  using      (exists (select 1 from public.attendance_sessions s where s.id = session_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from public.attendance_sessions s where s.id = session_id and s.coach_id = auth.uid()));

-- ---------- bookings ----------
create policy "bookings: yours, your family's, and your coach's group slots" on public.bookings
  for select to authenticated using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or player_id in (select public.my_family_ids())
    or (kind = 'group'
        and (coach_id = public.my_coach_id()
             or coach_id in (select public.my_family_coach_ids())))
  );

create policy "bookings: the coach manages the diary" on public.bookings
  for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- A player may only ask; the coach confirms. A junior's guardian asks
-- for them.
create policy "bookings: a player requests one with their coach" on public.bookings
  for insert to authenticated with check (
    player_id = auth.uid()
    and coach_id = public.my_coach_id()
    and status = 'requested'
    and not public.is_junior()
  );

create policy "bookings: a guardian requests one for their family" on public.bookings
  for insert to authenticated with check (
    player_id in (select public.my_family_ids())
    and coach_id = public.coach_of(player_id)
    and status = 'requested'
  );

-- A player, or their guardian, may cancel one of their own bookings and
-- nothing else about it: the only value the new row may carry is
-- status = 'cancelled'. Without this the app's Cancel said "Cancelled"
-- while the update touched zero rows.
create policy "bookings: a player or guardian cancels their own" on public.bookings
  for update to authenticated
  using (player_id = auth.uid() or player_id in (select public.my_family_ids()))
  with check (status = 'cancelled');

-- ---------- competitions ----------
create policy "competitions: yours or your family's" on public.competitions
  for select to authenticated using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or player_id in (select public.my_family_ids())
  );

create policy "competitions: the coach manages theirs and their players'" on public.competitions
  for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy "competitions: a player adds their own" on public.competitions
  for insert to authenticated with check (
    player_id = auth.uid()
    and (coach_id is null or coach_id = public.my_coach_id())
  );

create policy "competitions: a player removes their own" on public.competitions
  for delete to authenticated using (player_id = auth.uid());

-- ---------- recurring ----------
create policy "recurring: yours or your family's" on public.recurring
  for select to authenticated using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or player_id in (select public.my_family_ids())
  );

create policy "recurring: the coach sets the slots" on public.recurring
  for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- preferences ----------
create policy "preferences: yours alone" on public.preferences
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- messages ----------
create policy "messages: threads you belong to" on public.messages
  for select to authenticated using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or player_id in (select public.my_family_ids())
  );

-- Always as yourself, always in a thread that is really between that
-- coach and that player. A junior's guardian writes for them.
create policy "messages: send as yourself in your own thread" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and (
      (coach_id = auth.uid() and public.coach_of(player_id) = auth.uid())
      or (player_id = auth.uid() and coach_id = public.my_coach_id() and not public.is_junior())
      or (player_id in (select public.my_family_ids()) and coach_id = public.coach_of(player_id))
    )
  );

-- Marking as read is the only change allowed, and only by a recipient.
create policy "messages: a recipient marks it read" on public.messages
  for update to authenticated
  using (
    sender_id <> auth.uid()
    and (coach_id = auth.uid() or player_id = auth.uid()
         or player_id in (select public.my_family_ids()))
  )
  with check (
    sender_id <> auth.uid()
    and (coach_id = auth.uid() or player_id = auth.uid()
         or player_id in (select public.my_family_ids()))
  );

-- ---------- reviews ----------
create policy "reviews: of you, or by you" on public.reviews
  for select to authenticated using (coach_id = auth.uid() or player_id = auth.uid());

create policy "reviews: a player reviews their own coach" on public.reviews
  for insert to authenticated with check (
    player_id = auth.uid() and coach_id = public.my_coach_id()
  );

create policy "reviews: a player changes their own review" on public.reviews
  for update to authenticated
  using      (player_id = auth.uid())
  with check (player_id = auth.uid() and coach_id = public.my_coach_id());


-- ============================================================
-- 13 · STORAGE
--
-- Files live in a private bucket called "media", under a folder named
-- for the coach who uploaded them. Supabase does not always let the
-- SQL editor create policies on storage.objects ("must be owner of
-- table objects") — that is a platform rule, not a fault in this
-- file. So the attempt is made here, and if it is refused the final
-- row says "create in the dashboard" and the README says how.
-- ============================================================

-- The report at the end reads from this. Created here because storage
-- is the first section with something to report.
create temp table if not exists nosca_check (item text primary key, result text);
delete from nosca_check;

do $bucket$
begin
  insert into storage.buckets (id, name, public)
  values ('media', 'media', false)
  on conflict (id) do nothing;
  -- profile pictures: public, because a picture is shown to everyone
  -- the person is linked to and a signed link per avatar would be
  -- churn for nothing; the path is the account's own id, so it is
  -- not guessable and not listed anywhere
  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
  insert into nosca_check values ('storage_bucket', 'OK — media (private), avatars (public)');
exception when others then
  insert into nosca_check values
    ('storage_bucket', format('create in the dashboard — Storage → New bucket → "media" (Public off) and "avatars" (Public on) (%s)', sqlerrm));
end
$bucket$;

do $storage$
declare
  legacy text;
begin
  -- earlier names, from earlier files and from the README's dashboard
  -- steps, plus the current ones so a re-run is clean
  foreach legacy in array array[
    'coach group can read own media',
    'coach can upload own media',
    'read media files for lessons that are yours',
    'media: your own folder, or a file from a lesson you can see',
    'media: upload into your own folder',
    'media: delete from your own folder',
    'avatars: anyone can see a picture',
    'avatars: put your own picture in your own folder',
    'avatars: replace your own picture',
    'avatars: remove your own picture'
  ] loop
    execute format('drop policy if exists %I on storage.objects', legacy);
  end loop;

  -- Reading: your own folder, or any file whose lesson_media row you
  -- are allowed to see — which is decided by the policies above.
  execute $p$
    create policy "media: your own folder, or a file from a lesson you can see" on storage.objects
      for select to authenticated using (
        bucket_id = 'media'
        and ((storage.foldername(name))[1] = auth.uid()::text
             or exists (select 1 from public.lesson_media lm where lm.storage_path = name))
      )
  $p$;

  execute $p$
    create policy "media: upload into your own folder" on storage.objects
      for insert to authenticated with check (
        bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute $p$
    create policy "media: delete from your own folder" on storage.objects
      for delete to authenticated using (
        bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute $p$
    create policy "avatars: anyone can see a picture" on storage.objects
      for select to anon, authenticated using (bucket_id = 'avatars')
  $p$;
  execute $p$
    create policy "avatars: put your own picture in your own folder" on storage.objects
      for insert to authenticated with check (
        bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;
  execute $p$
    create policy "avatars: replace your own picture" on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy "avatars: remove your own picture" on storage.objects
      for delete to authenticated using (
        bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  insert into nosca_check values ('storage_policies', 'OK — 3 policies on media, 4 on avatars');
exception when others then
  insert into nosca_check values
    ('storage_policies', format('create in the dashboard — see README, "Storage" (%s, %s)', sqlerrm, sqlstate));
end
$storage$;


-- ============================================================
-- 14 · CHECK IT WORKED
--
-- The SQL editor runs as the owner of every table, and row-level
-- security never applies to the owner — so a plain "select" here says
-- nothing about the policies. The profiles policy once recursed on
-- every read while the editor reported everything fine. This block
-- runs the same reads as a signed-in stranger, and again with no
-- sign-in at all, and stops the whole file if any table errors or
-- shows that stranger a row. It cannot end looking healthy when it
-- isn't.
-- ============================================================
do $check$
declare
  fake  constant text := '00000000-0000-0000-0000-000000000000';
  every constant text[] := array['profiles', 'families', 'coach_requests', 'notifications', 'push_subscriptions',
                                 'lessons', 'lessons_view', 'lesson_media', 'lesson_attendees', 'drills',
                                 'tips', 'attendance_sessions', 'attendance_marks', 'bookings',
                                 'competitions', 'recurring', 'preferences', 'messages', 'reviews'];
  tbl        text;
  n          bigint;
  as_user    text := '';
  as_anon    text := '';
  profiles_r text;
  anon_r     text;
begin
  -- ---- as a signed-in person nobody is linked to ----
  begin
    execute 'set local role authenticated';
  exception when insufficient_privilege then
    insert into nosca_check values
      ('profiles_policy', 'NOT CHECKED — could not switch to the authenticated role here; sign in through the app to verify'),
      ('tables_as_user',  'NOT CHECKED'),
      ('tables_as_anon',  'NOT CHECKED');
    return;
  end;
  -- both spellings: auth.uid() reads one or the other depending on the project's age
  perform set_config('request.jwt.claim.sub', fake, true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', fake), true);

  begin
    select count(*) into n from public.profiles;
    profiles_r := format('OK — a signed-in stranger sees %s row(s); 0 is right', n);
  exception when others then
    execute 'reset role';
    raise exception 'profiles policy is broken — every sign-in would fail: % (%)', sqlerrm, sqlstate;
  end;

  foreach tbl in array every loop
    if tbl = 'profiles' then continue; end if;
    begin
      execute format('select count(*) from public.%I', tbl) into n;
      if n > 0 then
        as_user := as_user || format('%s shows %s row(s) to a stranger; ', tbl, n);
      end if;
    exception when others then
      as_user := as_user || format('%s: %s (%s); ', tbl, sqlerrm, sqlstate);
    end;
  end loop;
  execute 'reset role';

  -- ---- with no sign-in at all ----
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    execute 'set local role anon';
    foreach tbl in array every loop
      begin
        execute format('select count(*) from public.%I', tbl) into n;
        if n > 0 then
          as_anon := as_anon || format('%s shows %s row(s) without sign-in; ', tbl, n);
        end if;
      exception
        when insufficient_privilege then null;   -- no access at all is the right answer
        when others then as_anon := as_anon || format('%s: %s (%s); ', tbl, sqlerrm, sqlstate);
      end;
    end loop;
    execute 'reset role';
    anon_r := 'OK — nothing visible without signing in';
  exception when insufficient_privilege then
    execute 'reset role';
    anon_r := 'NOT CHECKED — could not switch to the anon role here';
  end;

  if as_user <> '' or as_anon <> '' then
    raise exception 'row-level security check failed — %', as_user || as_anon;
  end if;

  insert into nosca_check values
    ('profiles_policy', profiles_r),
    ('tables_as_user',  'OK — every table readable as a signed-in stranger, all empty'),
    ('tables_as_anon',  anon_r);
end
$check$;

-- The one row the editor shows. Everything meaningful is in it.
with
  want_tables as (
    select unnest(array['profiles', 'families', 'coach_requests', 'notifications', 'push_subscriptions',
                        'lessons', 'lesson_media', 'lesson_attendees', 'drills', 'tips',
                        'attendance_sessions', 'attendance_marks', 'bookings', 'competitions',
                        'recurring', 'preferences', 'messages', 'reviews']) as t
  ),
  want_functions as (
    select unnest(array['new_code', 'handle_new_user', 'find_coach_by_code', 'find_family_by_code',
                        'my_coach_id', 'is_junior_of', 'is_junior', 'my_family_id', 'my_family_member_ids',
                        'my_family_ids', 'my_family_coach_ids', 'my_players_guardian_ids', 'coach_of',
                        'my_pending_coach_ids', 'my_requesting_player_ids', 'coach_availability',
                        'my_attendance_session_ids',
                        'join_coach', 'respond_to_request', 'cancel_request', 'leave_coach',
                        'create_family', 'join_family', 'rename_family', 'leave_family',
                        'notify', 'adults_for', 'trg_lessons_notify', 'trg_requests_notify', 'trg_bookings_notify',
                        'trg_messages_notify', 'trg_drills_notify', 'trg_tips_notify', 'trg_family_notify',
                        'delete_my_account']) as f
  ),
  have_functions as (
    select p.proname as f
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
  )
select
  (select format('%s of %s', count(*) filter (where to_regclass('public.' || t) is not null), count(*))
          || coalesce(' — missing: ' || string_agg(t, ', ') filter (where to_regclass('public.' || t) is null), '')
   from want_tables)                                                                as tables,

  (select case
     when to_regclass('public.lessons_view') is null then 'MISSING'
     when exists (select 1 from pg_class
                  where oid = 'public.lessons_view'::regclass
                    and 'security_invoker=true' = any (reloptions)) then 'OK'
     else 'RUNS AS OWNER — would show every lesson to everyone'
   end)                                                                             as lessons_view,

  (select exists (select 1 from pg_trigger
                  where tgname = 'on_auth_user_created'
                    and tgrelid = 'auth.users'::regclass))                          as signup_trigger,

  (select format('%s of %s', count(*) filter (where f in (select f from have_functions)), count(*))
          || coalesce(' — missing: ' || string_agg(f, ', ') filter (where f not in (select f from have_functions)), '')
   from want_functions)                                                             as functions,

  (select string_agg(tablename || ' ' || n, ', ' order by tablename)
   from (select tablename, count(*) as n
         from pg_policies where schemaname = 'public' group by tablename) x)        as policies,

  (select result from nosca_check where item = 'profiles_policy')                   as profiles_policy,
  (select result from nosca_check where item = 'tables_as_user')                    as tables_as_user,
  (select result from nosca_check where item = 'tables_as_anon')                    as tables_as_anon,
  (select result from nosca_check where item = 'storage_bucket')                    as storage_bucket,
  (select result from nosca_check where item = 'storage_policies')                  as storage_policies,

  (select count(*) from pg_trigger where tgname in ('lessons_notify', 'requests_notify', 'bookings_notify',
                                                    'messages_notify', 'drills_notify', 'tips_notify', 'family_notify'))
                                                                                    as notify_triggers,

  -- Is a notification able to LEAVE the database? The bell works either
  -- way; this says whether a phone hears about it with the app closed.
  (select case
     when not exists (select 1 from pg_trigger where tgname = 'notifications_push')
       then 'no — pg_net is not enabled, so nothing is sent'
     when not exists (select 1 from public.app_settings where key = 'push_url'    and value <> '')
       or not exists (select 1 from public.app_settings where key = 'push_secret' and value <> '')
       then 'trigger ready — add push_url and push_secret to app_settings'
     else 'yes — notifications post to the relay'
   end)                                                                             as push,
  (select count(*) from auth.users)                                                 as accounts,
  (select count(*) from public.profiles)                                            as profiles,
  (select count(*) from public.families)                                            as families;
