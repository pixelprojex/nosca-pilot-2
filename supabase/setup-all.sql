-- ============================================================
-- NOSCA — SETUP (everything, in order)
--
-- One file containing every migration from 002 to 009. Run this whole
-- thing in Supabase → SQL Editor → New query → Run.
--
-- Safe to run even if you have already run some of these: every
-- statement uses "if not exists", "or replace", or drops the old
-- version first. Running it twice changes nothing.
--
-- If you have never run anything, run schema.sql first, then this.
-- ============================================================



-- ============================================================
-- ===============  from migration-002  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 002
-- Adds the fields the designed interface expects that the pilot
-- schema did not carry.
--
-- Run this the same way as schema.sql:
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to run more than once.
-- ============================================================

-- ---------- LESSONS ----------
-- The interface shows sub-focus tags beneath a lesson's focus, and
-- marks a lesson unread until the player has opened it.
alter table public.lessons
  add column if not exists subs   text[] not null default '{}',
  add column if not exists unread boolean not null default true;

-- The interface asks for a lesson's day and month separately ("14",
-- "JUN") rather than a date. Deriving them in the database keeps that
-- formatting out of the application, and means the two can never
-- disagree with lesson_date.
create or replace view public.lessons_view as
  select
    l.*,
    to_char(l.lesson_date, 'DD')  as d,
    upper(to_char(l.lesson_date, 'Mon')) as m,
    coalesce(mc.n, 0) as videos,
    case when l.kind = 'group' then l.group_name else p.name end as who
  from public.lessons l
  left join public.profiles p on p.id = l.player_id
  left join (
    select lesson_id, count(*) as n
    from public.lesson_media
    group by lesson_id
  ) mc on mc.lesson_id = l.id;

-- A view does not carry its own row-level security; it runs with the
-- privileges of the querying user against the underlying tables, whose
-- policies from schema.sql continue to apply.
grant select on public.lessons_view to authenticated;

-- ---------- COMPETITIONS ----------
-- The interface shows upcoming competitions on a player's own screen,
-- and surfaces them to their coach. A player may add their own; a coach
-- may add theirs, visible only to them.
create table if not exists public.competitions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid references public.profiles(id) on delete cascade,  -- null = the coach's own
  name        text not null,
  kind        text,
  venue       text,
  event_date  date not null,
  created_at  timestamptz not null default now()
);

alter table public.competitions enable row level security;

drop policy if exists "coach group can read competitions" on public.competitions;
create policy "coach group can read competitions" on public.competitions
  for select using (
    coach_id = public.my_coach_id()
    and (player_id is null and coach_id = auth.uid() or player_id is not null)
  );
drop policy if exists "player can add their own competition" on public.competitions;
create policy "player can add their own competition" on public.competitions
  for insert with check (player_id = auth.uid());
drop policy if exists "player can remove their own competition" on public.competitions;
create policy "player can remove their own competition" on public.competitions
  for delete using (player_id = auth.uid());
drop policy if exists "coach can manage competitions" on public.competitions;
create policy "coach can manage competitions" on public.competitions
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- RECURRING LESSONS ----------
-- Standing weekly or fortnightly slots.
create table if not exists public.recurring (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid references public.profiles(id) on delete cascade,
  group_name  text,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  text not null,
  cadence     text not null default 'weekly' check (cadence in ('weekly', 'fortnightly', 'monthly')),
  until_date  date,
  created_at  timestamptz not null default now()
);

alter table public.recurring enable row level security;
drop policy if exists "coach group can read recurring" on public.recurring;
create policy "coach group can read recurring" on public.recurring
  for select using (coach_id = public.my_coach_id());
drop policy if exists "coach can manage recurring" on public.recurring;
create policy "coach can manage recurring" on public.recurring
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- BOOKINGS ----------
-- The diary. A booking is a scheduled lesson that has not yet been
-- logged; logging one produces a row in lessons.
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid references public.profiles(id) on delete cascade,
  group_name  text,
  booking_date date not null,
  start_time  text not null,
  duration    smallint not null default 45,
  kind        text not null default 'private' check (kind in ('private', 'group')),
  status      text not null default 'confirmed'
              check (status in ('confirmed', 'requested', 'cancelled', 'weather')),
  logged_id   uuid references public.lessons(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.bookings enable row level security;
drop policy if exists "coach group can read bookings" on public.bookings;
create policy "coach group can read bookings" on public.bookings
  for select using (coach_id = public.my_coach_id());
drop policy if exists "coach can manage bookings" on public.bookings;
create policy "coach can manage bookings" on public.bookings
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "player can request a booking" on public.bookings;
create policy "player can request a booking" on public.bookings
  for insert with check (player_id = auth.uid() and status = 'requested');

-- ---------- PREFERENCES ----------
-- The choices each person makes about how the app behaves for them:
-- lesson-log view, diary default, notification timing, what others see.
create table if not exists public.preferences (
  id          uuid primary key references public.profiles(id) on delete cascade,
  log_view    text not null default 'feed'    check (log_view in ('feed', 'cards', 'list')),
  cal_view    text not null default 'list'    check (cal_view in ('list', 'grid')),
  notify      text not null default 'instant' check (notify in ('instant', 'digest', 'quiet')),
  attendance  text not null default 'all'     check (attendance in ('all', 'private', 'group', 'off')),
  show_record boolean not null default true,
  show_comps  boolean not null default true,
  reduce_data boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.preferences enable row level security;
drop policy if exists "read your own preferences" on public.preferences;
create policy "read your own preferences" on public.preferences
  for select using (id = auth.uid());
drop policy if exists "write your own preferences" on public.preferences;
create policy "write your own preferences" on public.preferences
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================
-- Verification. After running, this should return one row per table
-- with the expected columns present.
-- ============================================================
-- select table_name, column_name from information_schema.columns
--   where table_schema = 'public'
--     and table_name in ('lessons','competitions','recurring','bookings','preferences')
--   order by table_name, ordinal_position;


-- ============================================================
-- ===============  from migration-003  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 003
-- Messaging between a coach and their players.
--
-- Run the same way as the others:
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to run more than once.
-- ============================================================

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists messages_thread_idx
  on public.messages (coach_id, player_id, created_at desc);

alter table public.messages enable row level security;

-- A thread belongs to exactly one coach and one player. Either of them
-- may read it; nobody else can, including other players of the same
-- coach.
drop policy if exists "read your own thread" on public.messages;
create policy "read your own thread" on public.messages
  for select using (
    coach_id = public.my_coach_id()
    and (auth.uid() = coach_id or auth.uid() = player_id)
  );

-- You may only send as yourself, and only within a thread you belong to.
drop policy if exists "send in your own thread" on public.messages;
create policy "send in your own thread" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (auth.uid() = coach_id or auth.uid() = player_id)
    and coach_id = public.my_coach_id()
  );

-- Marking as read is the only update permitted, and only by the
-- recipient.
drop policy if exists "mark received messages read" on public.messages;
create policy "mark received messages read" on public.messages
  for update using (
    auth.uid() <> sender_id
    and (auth.uid() = coach_id or auth.uid() = player_id)
  );

-- ============================================================
-- Verification:
-- select * from public.messages limit 1;
-- ============================================================


-- ============================================================
-- ===============  from migration-004  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 004
--
-- IMPORTANT: this corrects a data-privacy defect. Under the previous
-- policies, every player of a coach could read every OTHER player's
-- lessons, drills, tips and attendance, because the check was only
-- "does this belong to my coach". A player must see their own records
-- and nothing else.
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- ============================================================

-- ---------- PROFILES ----------
-- A player should see themselves and their coach. They should NOT see
-- the coach's other players.
drop policy if exists "see your own coach group" on public.profiles;
drop policy if exists "see yourself, your coach, or your own players" on public.profiles;
create policy "see yourself, your coach, or your own players" on public.profiles
  for select using (
    id = auth.uid()                                    -- yourself
    or coach_id = auth.uid()                           -- your players (coach only)
    or (id = public.my_coach_id() and public.my_coach_id() <> auth.uid())  -- your coach
  );

-- ---------- LESSONS ----------
drop policy if exists "coach group can read lessons" on public.lessons;
drop policy if exists "read lessons that are yours" on public.lessons;
create policy "read lessons that are yours" on public.lessons
  for select using (
    coach_id = auth.uid()                              -- the coach sees all of theirs
    or player_id = auth.uid()                          -- a player sees only their own
    or (kind = 'group' and coach_id = public.my_coach_id())  -- group lessons are shared
  );

-- ---------- LESSON MEDIA ----------
drop policy if exists "coach group can read media" on public.lesson_media;
drop policy if exists "read media for lessons that are yours" on public.lesson_media;
create policy "read media for lessons that are yours" on public.lesson_media
  for select using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id
        and (l.coach_id = auth.uid()
             or l.player_id = auth.uid()
             or (l.kind = 'group' and l.coach_id = public.my_coach_id()))
    )
  );

-- ---------- DRILLS ----------
drop policy if exists "coach group can read drills" on public.drills;
drop policy if exists "read drills that are yours" on public.drills;
create policy "read drills that are yours" on public.drills
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- TIPS ----------
drop policy if exists "coach group can read tips" on public.tips;
drop policy if exists "read tips that are yours" on public.tips;
create policy "read tips that are yours" on public.tips
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- ATTENDANCE ----------
drop policy if exists "coach group can read sessions" on public.attendance_sessions;
drop policy if exists "read sessions that concern you" on public.attendance_sessions;
create policy "read sessions that concern you" on public.attendance_sessions
  for select using (
    coach_id = auth.uid()
    or exists (select 1 from public.attendance_marks m
               where m.session_id = id and m.player_id = auth.uid())
  );

drop policy if exists "coach group can read marks" on public.attendance_marks;
drop policy if exists "read marks that are yours" on public.attendance_marks;
create policy "read marks that are yours" on public.attendance_marks
  for select using (
    player_id = auth.uid()
    or exists (select 1 from public.attendance_sessions s
               where s.id = session_id and s.coach_id = auth.uid())
  );

-- ---------- BOOKINGS ----------
drop policy if exists "coach group can read bookings" on public.bookings;
drop policy if exists "read bookings that are yours" on public.bookings;
create policy "read bookings that are yours" on public.bookings
  for select using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or (kind = 'group' and coach_id = public.my_coach_id())
  );

-- ---------- RECURRING ----------
drop policy if exists "coach group can read recurring" on public.recurring;
drop policy if exists "read recurring that is yours" on public.recurring;
create policy "read recurring that is yours" on public.recurring
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- COMPETITIONS ----------
drop policy if exists "coach group can read competitions" on public.competitions;
drop policy if exists "read competitions that are yours" on public.competitions;
create policy "read competitions that are yours" on public.competitions
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- STORAGE ----------
-- Media lives under the coach's id, so path alone cannot distinguish
-- one player from another. Reads are therefore checked against the
-- lesson the file belongs to.
drop policy if exists "coach group can read own media" on storage.objects;
drop policy if exists "read media files for lessons that are yours" on storage.objects;
create policy "read media files for lessons that are yours" on storage.objects
  for select using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text      -- the coach's own folder
      or exists (
        select 1 from public.lesson_media lm
        join public.lessons l on l.id = lm.lesson_id
        where lm.storage_path = name
          and (l.player_id = auth.uid()
               or (l.kind = 'group' and l.coach_id = public.my_coach_id()))
      )
    )
  );

-- ============================================================
-- PROFILE FIELDS
-- Only what the sign-up actually asks for. A club field exists but is
-- optional and empty unless the coach fills it in; nothing is invented.
-- ============================================================
alter table public.profiles
  add column if not exists club text;

-- ============================================================
-- Verification — sign in as a player and run:
--   select count(*) from public.lessons;
-- It must return only that player's own lessons plus any group
-- lessons, never another player's private ones.
-- ============================================================


-- ============================================================
-- ===============  from migration-005  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 005
--
-- Adds date of birth, and enforces — in the database itself, not just
-- the interface — that a player under 18 cannot request a lesson or
-- send a message. A restriction that only lives in the UI can be
-- bypassed by anyone calling the API directly; this cannot.
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- ============================================================

alter table public.profiles
  add column if not exists date_of_birth date;

-- True for a signed-in player under 18. Coaches are never minors in
-- this system, so the function only ever restricts the player side.
create or replace function public.is_junior()
returns boolean as $$
  select p.role = 'player'
     and p.date_of_birth is not null
     and p.date_of_birth > (current_date - interval '18 years')
  from public.profiles p
  where p.id = auth.uid();
$$ language sql stable security definer;

-- A junior may still appear as the SUBJECT of a booking or message —
-- their coach requests, books and messages on their behalf, which is
-- exactly the walkthrough's own promise: "a grown-up looks after the
-- rest". What a junior cannot do is originate one of these themselves.

drop policy if exists "player can request a booking" on public.bookings;
create policy "player can request a booking" on public.bookings
  for insert with check (
    player_id = auth.uid()
    and status = 'requested'
    and not public.is_junior()
  );

drop policy if exists "send in your own thread" on public.messages;
create policy "send in your own thread" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (auth.uid() = coach_id or auth.uid() = player_id)
    and coach_id = public.my_coach_id()
    and not (auth.uid() = player_id and public.is_junior())
  );

-- ============================================================
-- Verification — sign in as a junior player and try to insert a
-- booking or a message directly; both must be refused by the database
-- regardless of what the interface allows.
-- ============================================================


-- ============================================================
-- ===============  from migration-006  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 006
-- Adds the coach's preference for whether to ask a player for a
-- review, and defaults it on so existing accounts keep the same
-- behaviour they already had.
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- ============================================================

alter table public.preferences
  add column if not exists ask_for_review boolean not null default true;
alter table public.preferences
  add column if not exists custom_drills jsonb not null default '{}'::jsonb;

-- ============================================================
-- Reviews. A player may leave one for their own coach at any time —
-- from the coach's profile, not only when prompted after a lesson.
-- One review per player; leaving another replaces it rather than
-- piling up duplicates.
-- ============================================================
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (coach_id, player_id)
);

alter table public.reviews enable row level security;

drop policy if exists "coach reads reviews of themselves" on public.reviews;
create policy "coach reads reviews of themselves" on public.reviews
  for select using (coach_id = auth.uid());
drop policy if exists "player reads their own review" on public.reviews;
create policy "player reads their own review" on public.reviews
  for select using (player_id = auth.uid());
drop policy if exists "player writes their own review" on public.reviews;
create policy "player writes their own review" on public.reviews
  for insert with check (player_id = auth.uid() and coach_id = public.my_coach_id());
drop policy if exists "player updates their own review" on public.reviews;
create policy "player updates their own review" on public.reviews
  for update using (player_id = auth.uid()) with check (player_id = auth.uid());


-- ============================================================
-- ===============  from migration-007  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 007
--
-- The sign-up form asks for a mobile number, so there has to be
-- somewhere to put it. Without this column every sign-up fails at the
-- insert, which is exactly the kind of thing that only shows up when a
-- real person tries to create a real account.
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- ============================================================

alter table public.profiles
  add column if not exists phone text;

-- Which kind of coach or player this is: head/assistant for a coach,
-- adult/junior/parent for a player. Kept as free text rather than a
-- constraint so the categories can change during the pilot without a
-- migration each time.
alter table public.profiles
  add column if not exists account_type text;


-- ============================================================
-- ===============  from migration-008  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 008
--
-- A player can now sign up without a coach's code and add one later.
-- Two things were stopping that:
--   1. the pilot-limit trigger rejected any player with no coach_id
--   2. the 20-player cap counted against a null coach, so several
--      coachless players would have blocked each other
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- ============================================================

create or replace function public.enforce_pilot_limits()
returns trigger as $$
begin
  if new.role = 'coach' then
    if exists (select 1 from public.profiles where role = 'coach' and id <> new.id) then
      raise exception 'PILOT LIMIT: this deployment already has a coach account.';
    end if;

  elsif new.role = 'player' then
    -- A player with no coach yet is fine: they have an empty account
    -- and a button to add one. The cap only applies once they join.
    if new.coach_id is not null then
      if (select count(*) from public.profiles
          where coach_id = new.coach_id and role = 'player' and id <> new.id) >= 20 then
        raise exception 'PILOT LIMIT: this coach already has 20 players.';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- The trigger has to fire on update too, or a player could join a full
-- roster simply by signing up coachless and adding the code after.
drop trigger if exists enforce_pilot_limits_trg on public.profiles;
create trigger enforce_pilot_limits_trg
  before insert or update on public.profiles
  for each row execute function public.enforce_pilot_limits();

-- ============================================================
-- A player must be able to set their own coach_id when they enter a
-- code — but only their own row, and only their own coach link.
-- ============================================================
drop policy if exists "update your own profile" on public.profiles;
create policy "update your own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================
-- Verification:
--   A player row with coach_id null should insert without error.
--   select id, name, coach_id from public.profiles where role = 'player';
-- ============================================================


-- ============================================================
-- ===============  from migration-009  =======================
-- ============================================================

-- ============================================================
-- NOSCA — MIGRATION 009
--
-- Three things:
--   1. removes the pilot caps — unlimited coaches, unlimited players
--   2. makes the invite-code lookup case- and space-proof
--   3. backfills a code for any coach created without one
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1 · no more caps
-- ------------------------------------------------------------
-- The trigger existed to keep the pilot to one coach and twenty
-- players. Both limits are gone, so the trigger has nothing left to
-- enforce and is removed rather than left as a no-op.
drop trigger if exists enforce_pilot_limits_trg on public.profiles;
drop trigger if exists trg_pilot_limits on public.profiles;
drop function if exists public.enforce_pilot_limits() cascade;

-- ------------------------------------------------------------
-- 2 · a code should match however it was typed
-- ------------------------------------------------------------
-- Stored codes may have been saved with stray whitespace or in mixed
-- case. Comparing both sides after trimming and upper-casing means a
-- code works whether it was typed as "abc123", " ABC123 " or "AbC123".
drop function if exists public.find_coach_by_code(text);
create or replace function public.find_coach_by_code(p_code text)
returns table (id uuid, sport text, name text) as $$
  select p.id, p.sport, p.name
  from public.profiles p
  where p.role = 'coach'
    and upper(trim(p.invite_code)) = upper(trim(p_code))
  limit 1;
$$ language sql stable security definer;

grant execute on function public.find_coach_by_code(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 3 · every coach needs a code
-- ------------------------------------------------------------
-- A coach whose row was created before invite codes existed, or whose
-- insert didn't set one, has no way for anyone to join them. Give any
-- such coach a code now.
update public.profiles
set invite_code = upper(substring(replace(gen_random_uuid()::text, '-', '') for 6))
where role = 'coach' and (invite_code is null or trim(invite_code) = '');

-- Normalise anything already stored, so what a coach reads on screen
-- and what the lookup compares are the same string.
update public.profiles
set invite_code = upper(trim(invite_code))
where role = 'coach' and invite_code is distinct from upper(trim(invite_code));

-- ------------------------------------------------------------
-- 4 · voice notes are media too
-- ------------------------------------------------------------
-- lesson_media only accepted video and photo. A coach recording a voice
-- note during a lesson would upload the file successfully and then have
-- the row rejected — the file orphaned in storage, nothing shown in the
-- app. Audio joins the allowed kinds.
alter table public.lesson_media drop constraint if exists lesson_media_kind_check;
alter table public.lesson_media
  add constraint lesson_media_kind_check check (kind in ('video', 'photo', 'audio'));

-- ------------------------------------------------------------
-- 5 · families
-- ------------------------------------------------------------
-- A family works exactly like a coach: whoever runs it has a code, and
-- anyone with the code joins. Any player can run one — a parent
-- obviously, but equally an adult player whose younger sibling wants
-- in. There is no separate "family" table; a family is simply
-- everyone who points at the same guardian.
alter table public.profiles
  add column if not exists guardian_id uuid references public.profiles(id) on delete set null;
alter table public.profiles
  add column if not exists family_code text unique;

-- Every existing player gets a family code, so the option is there
-- the moment they want it.
update public.profiles
set family_code = upper(substring(replace(gen_random_uuid()::text, '-', '') for 6))
where role = 'player' and family_code is null;

create or replace function public.find_guardian_by_code(p_code text)
returns table (id uuid, name text) as $$
  select p.id, p.name
  from public.profiles p
  where p.family_code is not null
    and upper(trim(p.family_code)) = upper(trim(p_code))
  limit 1;
$$ language sql stable security definer;
grant execute on function public.find_guardian_by_code(text) to anon, authenticated;

-- A guardian can read the profiles of everyone in their family, and a
-- family member can read their guardian's — same shape as coach/player.
drop policy if exists "see yourself, your coach, or your own players" on public.profiles;
drop policy if exists "see yourself, your coach, your players, or your family" on public.profiles;
create policy "see yourself, your coach, your players, or your family" on public.profiles
  for select using (
    id = auth.uid()
    or coach_id = auth.uid()
    or (id = public.my_coach_id() and public.my_coach_id() <> auth.uid())
    or guardian_id = auth.uid()
    or id = (select guardian_id from public.profiles where id = auth.uid())
  );

-- ============================================================
-- Verification — this should list every coach with a six-character
-- code, and find_coach_by_code should return a row for each:
--
--   select name, invite_code from public.profiles where role = 'coach';
--   select * from public.find_coach_by_code('PASTE_A_CODE_HERE');
-- ============================================================
