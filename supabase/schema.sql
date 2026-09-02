-- ============================================================
-- NOSCA — PILOT SCHEMA
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It is safe to run once. Re-running is not needed unless you want
-- to reset the pilot (see the DROP block commented out at the bottom).
-- ============================================================

-- ---------- PROFILES ----------
-- One row per signed-up person. A coach row has coach_id = null.
-- A player row has coach_id pointing at the coach they belong to.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('coach', 'player')),
  name        text not null,
  sport       text not null default 'golf',
  coach_id    uuid references public.profiles(id) on delete cascade,
  invite_code text unique,              -- only set for the coach row
  created_at  timestamptz not null default now()
);

-- The one thing this pilot is not allowed to become: a second coach,
-- or a 21st player. Enforced here so it can never be bypassed by a
-- bug in the app, only by editing this file.
create or replace function public.enforce_pilot_limits()
returns trigger as $$
begin
  if new.role = 'coach' then
    if exists (select 1 from public.profiles where role = 'coach') then
      raise exception 'PILOT LIMIT: this deployment already has a coach account.';
    end if;
  elsif new.role = 'player' then
    if new.coach_id is null then
      raise exception 'A player must belong to a coach.';
    end if;
    if (select count(*) from public.profiles
        where coach_id = new.coach_id and role = 'player') >= 20 then
      raise exception 'PILOT LIMIT: this coach already has 20 players.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_pilot_limits on public.profiles;
create trigger trg_pilot_limits
  before insert on public.profiles
  for each row execute function public.enforce_pilot_limits();

-- helper: which coach does the current signed-in user belong under?
-- (a coach belongs under themselves)
create or replace function public.my_coach_id()
returns uuid as $$
  select case when p.role = 'coach' then p.id else p.coach_id end
  from public.profiles p where p.id = auth.uid();
$$ language sql stable security definer;

-- ---------- LESSONS ----------
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid references public.profiles(id) on delete cascade,   -- null = group lesson
  group_name  text,                                                    -- set when player_id is null
  focus       text not null,
  notes       text,
  kind        text not null default 'private' check (kind in ('private', 'group')),
  lesson_date date not null default current_date,
  created_at  timestamptz not null default now()
);

create table if not exists public.lesson_media (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  kind        text not null check (kind in ('video', 'photo')),
  storage_path text not null,          -- path inside the 'media' bucket
  created_at  timestamptz not null default now()
);

-- ---------- DRILLS & TIPS ----------
create table if not exists public.drills (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.tips (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text,
  created_at  timestamptz not null default now()
);

-- ---------- ATTENDANCE ----------
create table if not exists public.attendance_sessions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  label       text not null,           -- e.g. "Summer clinic" or a player's name
  session_date date not null default current_date,
  created_at  timestamptz not null default now()
);

create table if not exists public.attendance_marks (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.attendance_sessions(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  state       text not null check (state in ('in', 'out')),
  unique (session_id, player_id)
);

-- A player entering an invite code hasn't signed up yet — they have no
-- session, so the row-security policy below (correctly) can't let them
-- browse the profiles table. This function is the one narrow exception:
-- it returns only the coach's id and sport, nothing else, and only for
-- an exact invite-code match.
create or replace function public.find_coach_by_code(p_code text)
returns table (id uuid, sport text) as $$
  select p.id, p.sport from public.profiles p
  where p.role = 'coach' and p.invite_code = upper(trim(p_code))
  limit 1;
$$ language sql stable security definer;

grant execute on function public.find_coach_by_code(text) to anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table: the coach can read/write everything under their own
-- coach_id. A player can read their own rows and write only the
-- narrow things a player should (ticking a drill done).
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.lessons            enable row level security;
alter table public.lesson_media       enable row level security;
alter table public.drills             enable row level security;
alter table public.tips               enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_marks   enable row level security;

-- profiles
create policy "see your own coach group" on public.profiles
  for select using (id = auth.uid() or coach_id = auth.uid() or public.my_coach_id() = coach_id or id = public.my_coach_id());
create policy "insert your own profile once" on public.profiles
  for insert with check (id = auth.uid());
create policy "update your own profile" on public.profiles
  for update using (id = auth.uid());

-- lessons
create policy "coach group can read lessons" on public.lessons
  for select using (coach_id = public.my_coach_id());
create policy "coach can write lessons" on public.lessons
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- lesson_media
create policy "coach group can read media" on public.lesson_media
  for select using (exists (select 1 from public.lessons l where l.id = lesson_id and l.coach_id = public.my_coach_id()));
create policy "coach can write media" on public.lesson_media
  for all using (exists (select 1 from public.lessons l where l.id = lesson_id and l.coach_id = auth.uid()));

-- drills
create policy "coach group can read drills" on public.drills
  for select using (coach_id = public.my_coach_id());
create policy "coach can write drills" on public.drills
  for insert with check (coach_id = auth.uid());
create policy "coach can delete drills" on public.drills
  for delete using (coach_id = auth.uid());
create policy "player can tick their own drill done" on public.drills
  for update using (player_id = auth.uid()) with check (player_id = auth.uid());

-- tips
create policy "coach group can read tips" on public.tips
  for select using (coach_id = public.my_coach_id());
create policy "coach can write tips" on public.tips
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- attendance
create policy "coach group can read sessions" on public.attendance_sessions
  for select using (coach_id = public.my_coach_id());
create policy "coach can write sessions" on public.attendance_sessions
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy "coach group can read marks" on public.attendance_marks
  for select using (exists (select 1 from public.attendance_sessions s where s.id = session_id and s.coach_id = public.my_coach_id()));
create policy "coach can write marks" on public.attendance_marks
  for all using (exists (select 1 from public.attendance_sessions s where s.id = session_id and s.coach_id = auth.uid()));

-- ============================================================
-- STORAGE is deliberately NOT set up here.
-- Supabase now blocks creating policies on storage.objects via SQL
-- Editor for the postgres role ("must be owner of table objects") —
-- a platform-side restriction, not a mistake in this file. Follow
-- "Part 2" of the setup guide to do this through the Storage tab in
-- the dashboard instead, which isn't subject to the restriction.
-- ============================================================

-- ============================================================
-- To wipe the pilot and start over, uncomment and run just this:
-- delete from auth.users;   -- cascades through every table above
-- ============================================================
