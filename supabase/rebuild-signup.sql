-- ============================================================
-- NOSCA — SIGN-UP REBUILD
--
-- Run this ONCE, in full, in Supabase → SQL Editor → New query.
-- It wipes every existing account and rebuilds sign-up properly.
--
-- WHY THIS IS DIFFERENT
--
-- Sign-up used to be two separate steps from the browser: create the
-- auth user, then insert the profile row. Any failure between them —
-- email confirmation, row-level security, a dropped connection — left
-- an account that could authenticate but had no profile, and no way
-- to recover. That is what has been breaking.
--
-- A database trigger fixes this at the root. The profile is created
-- by Postgres, in the same transaction as the user, the instant the
-- user row appears. Either both exist or neither does. The browser
-- cannot get this wrong, because the browser is no longer involved.
-- ============================================================


-- ------------------------------------------------------------
-- 1 · CLEAN SLATE
-- ------------------------------------------------------------
-- Storage first: files can't be removed by SQL once their rows are
-- gone, so this must happen before the cascade. If you have uploaded
-- media, clear it in Supabase → Storage → media as well.
delete from public.lesson_media;

-- Deleting the auth users cascades through profiles and everything
-- that references them.
delete from auth.users;


-- ------------------------------------------------------------
-- 2 · EVERY COLUMN SIGN-UP NEEDS
-- ------------------------------------------------------------
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists account_type  text;
alter table public.profiles add column if not exists family_code   text;
alter table public.profiles add column if not exists guardian_id   uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists club          text;

-- coach_id must be optional: a player can sign up before they have a
-- code, and add their coach afterwards.
alter table public.profiles alter column coach_id drop not null;

-- Codes have to be unique to be worth anything.
create unique index if not exists profiles_invite_code_key on public.profiles (invite_code) where invite_code is not null;
create unique index if not exists profiles_family_code_key on public.profiles (family_code) where family_code is not null;


-- ------------------------------------------------------------
-- 3 · NOTHING THAT CAN REJECT A SIGN-UP
-- ------------------------------------------------------------
-- The old pilot-limit trigger raised an exception for any player
-- without a coach. A raised exception inside a sign-up transaction
-- fails the whole sign-up, which is exactly what was happening.
drop trigger if exists enforce_pilot_limits_trg on public.profiles;
drop function if exists public.enforce_pilot_limits();


-- ------------------------------------------------------------
-- 4 · A SIX-CHARACTER CODE THAT IS ACTUALLY UNIQUE
-- ------------------------------------------------------------
-- Ambiguous characters are left out on purpose: no O/0, no I/1. These
-- codes get read aloud and typed by hand.
create or replace function public.new_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
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
    -- vanishingly unlikely, but a collision would break a sign-up, so
    -- check rather than hope
    exit when not exists (
      select 1 from public.profiles
      where invite_code = candidate or family_code = candidate
    );
  end loop;
  return candidate;
end;
$$;


-- ------------------------------------------------------------
-- 5 · THE TRIGGER
-- ------------------------------------------------------------
-- Runs as the database owner (security definer), so row-level
-- security cannot block it and it works whether or not the new user
-- has a session yet — which is what makes email confirmation
-- harmless.
--
-- search_path is empty, per Supabase's own guidance, so every table
-- is written out in full.
--
-- Every value is defended: a missing field falls back to something
-- sensible, and a malformed date becomes null rather than raising.
-- If this function ever raised, sign-up would fail outright with
-- "Database error saving new user", so it is written not to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role      text  := lower(coalesce(nullif(meta->>'role', ''), 'player'));
  v_name      text  := nullif(btrim(coalesce(meta->>'name', '')), '');
  v_sport     text  := lower(coalesce(nullif(meta->>'sport', ''), 'golf'));
  v_type      text  := nullif(meta->>'account_type', '');
  v_phone     text  := nullif(btrim(coalesce(meta->>'phone', '')), '');
  v_code      text  := upper(btrim(coalesce(meta->>'coach_code', '')));
  v_dob       date;
  v_coach     uuid;
begin
  -- role has a check constraint; anything unexpected becomes a player
  if v_role not in ('coach', 'player') then
    v_role := 'player';
  end if;

  -- name is NOT NULL on the table, so it must never be blank
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'Player'), '@', 1);
  end if;

  -- a bad date must not take the sign-up down with it
  begin
    v_dob := (nullif(meta->>'date_of_birth', ''))::date;
  exception when others then
    v_dob := null;
  end;

  -- resolve the coach's code if one was given. An unrecognised code is
  -- not an error: the account is created without a coach and the
  -- person adds one from their home screen.
  if v_code <> '' then
    select p.id into v_coach
    from public.profiles p
    where p.role = 'coach'
      and upper(btrim(p.invite_code)) = v_code
    limit 1;
  end if;

  insert into public.profiles (
    id, role, name, sport, account_type, date_of_birth, phone,
    coach_id, invite_code, family_code
  ) values (
    new.id,
    v_role,
    v_name,
    v_sport,
    v_type,
    v_dob,
    v_phone,
    case when v_role = 'player' then v_coach else null end,
    -- only a coach hands out an invite code
    case when v_role = 'coach'  then public.new_code() else null end,
    -- everyone gets a family code, so the option always exists
    public.new_code()
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 6 · LOOKING UP A CODE
-- ------------------------------------------------------------
-- Both sides are trimmed and upper-cased, so a code matches however
-- it was typed or stored. Callable before sign-in, because a player
-- entering a code during sign-up has no session yet.
drop function if exists public.find_coach_by_code(text);
create or replace function public.find_coach_by_code(p_code text)
returns table (id uuid, sport text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.sport, p.name
  from public.profiles p
  where p.role = 'coach'
    and upper(btrim(p.invite_code)) = upper(btrim(p_code))
  limit 1;
$$;
grant execute on function public.find_coach_by_code(text) to anon, authenticated;

drop function if exists public.find_guardian_by_code(text);
create or replace function public.find_guardian_by_code(p_code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name
  from public.profiles p
  where p.family_code is not null
    and upper(btrim(p.family_code)) = upper(btrim(p_code))
  limit 1;
$$;
grant execute on function public.find_guardian_by_code(text) to anon, authenticated;


-- ------------------------------------------------------------
-- 7 · WHO CAN SEE AND CHANGE WHAT
-- ------------------------------------------------------------
-- The trigger no longer needs an insert policy, but one stays for
-- anything that writes a profile directly.
drop policy if exists "insert your own profile once" on public.profiles;
create policy "insert your own profile once" on public.profiles
  for insert with check (id = auth.uid());

-- Joining a coach or a family is an update to your own row.
drop policy if exists "update your own profile" on public.profiles;
create policy "update your own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Yourself, your coach, your players, your family.
drop policy if exists "see your own coach group" on public.profiles;
drop policy if exists "see yourself, your coach, or your own players" on public.profiles;
drop policy if exists "see yourself, your coach, your players, or your family" on public.profiles;
create policy "see yourself, your coach, your players, or your family" on public.profiles
  for select using (
    id = auth.uid()
    or coach_id = auth.uid()
    or id = (select p.coach_id    from public.profiles p where p.id = auth.uid())
    or guardian_id = auth.uid()
    or id = (select p.guardian_id from public.profiles p where p.id = auth.uid())
  );


-- ============================================================
-- CHECK IT WORKED
--
-- Everything should be zero — you just wiped it. What matters is that
-- trigger_installed is true.
-- ============================================================
select
  (select count(*) from auth.users)      as auth_accounts,
  (select count(*) from public.profiles) as profiles,
  (select exists (
     select 1 from pg_trigger
     where tgname = 'on_auth_user_created'
   ))                                    as trigger_installed;
