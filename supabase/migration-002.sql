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

create policy "coach group can read competitions" on public.competitions
  for select using (
    coach_id = public.my_coach_id()
    and (player_id is null and coach_id = auth.uid() or player_id is not null)
  );
create policy "player can add their own competition" on public.competitions
  for insert with check (player_id = auth.uid());
create policy "player can remove their own competition" on public.competitions
  for delete using (player_id = auth.uid());
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
create policy "coach group can read recurring" on public.recurring
  for select using (coach_id = public.my_coach_id());
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
create policy "coach group can read bookings" on public.bookings
  for select using (coach_id = public.my_coach_id());
create policy "coach can manage bookings" on public.bookings
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
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
create policy "read your own preferences" on public.preferences
  for select using (id = auth.uid());
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
