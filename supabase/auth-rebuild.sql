-- ============================================================
-- NOSCA — AUTH REBUILD
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- Run it AFTER setup-all.sql (or after schema.sql + setup-all.sql).
-- Safe to run more than once.
--
-- WHY THIS EXISTS
--
-- Sign-up used to work like this: the app called signUp(), then made a
-- second call to insert the profile row. That second call is guarded
-- by row-level security requiring an active session — and when
-- Supabase's "Confirm email" setting is on, signUp() returns no
-- session. So the insert was refused, leaving an account that could
-- authenticate but had no profile, and could never be used.
--
-- The fix is the approach Supabase itself documents: the database
-- creates the profile automatically, the moment the account is
-- created, from data passed with the sign-up. There is no second call
-- to fail, no session to wait for, and no way to end up half-created.
-- ============================================================


-- ------------------------------------------------------------
-- 1 · START CLEAN
-- Deletes every account. Everything else cascades from auth.users.
-- ------------------------------------------------------------
delete from auth.users;


-- ------------------------------------------------------------
-- 2 · A SHORT, UNAMBIGUOUS CODE
--
-- No 0/O or 1/I, so a code read aloud or copied off a screen can't be
-- mistyped. Loops until it finds one nobody is using.
-- ------------------------------------------------------------
create or replace function public.new_code()
returns text as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.profiles
      where invite_code = candidate or family_code = candidate
    );
  end loop;
  return candidate;
end;
$$ language plpgsql volatile security definer set search_path = public;


-- ------------------------------------------------------------
-- 3 · THE PROFILE IS CREATED BY THE DATABASE
--
-- Everything the sign-up form collected arrives in raw_user_meta_data.
-- This reads it and writes the profile row in the same transaction as
-- the account itself, so the two can never disagree.
--
-- It is deliberately forgiving: if anything unexpected arrives, it
-- still creates a usable profile rather than raising, because an
-- exception here makes signUp() fail outright with "Database error
-- saving new user" and the person cannot sign up at all.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role      text  := coalesce(nullif(meta->>'role', ''), 'player');
  v_name      text  := coalesce(nullif(meta->>'name', ''), split_part(new.email, '@', 1));
  v_sport     text  := coalesce(nullif(meta->>'sport', ''), 'golf');
  v_type      text  := nullif(meta->>'account_type', '');
  v_phone     text  := nullif(meta->>'phone', '');
  v_dob       date;
  v_code      text  := upper(trim(coalesce(meta->>'coach_code', '')));
  v_coach     uuid;
begin
  -- A malformed date must not stop the account being created.
  begin
    v_dob := nullif(meta->>'date_of_birth', '')::date;
  exception when others then
    v_dob := null;
  end;

  -- Only a coach may be created as a coach, and a player who supplied
  -- a code is linked to that coach immediately.
  if v_role <> 'coach' then
    v_role := 'player';
    if v_code <> '' then
      select p.id into v_coach
      from public.profiles p
      where p.role = 'coach' and upper(trim(p.invite_code)) = v_code
      limit 1;
    end if;
  end if;

  insert into public.profiles (
    id, role, name, sport, account_type, phone, date_of_birth,
    coach_id, invite_code, family_code
  ) values (
    new.id,
    v_role,
    v_name,
    v_sport,
    v_type,
    v_phone,
    v_dob,
    v_coach,
    case when v_role = 'coach' then public.new_code() else null end,
    public.new_code()          -- everyone can start a family
  );

  return new;
exception when others then
  -- Last resort: never block account creation. A bare profile can be
  -- completed in the app; a failed sign-up cannot be recovered at all.
  begin
    insert into public.profiles (id, role, name, sport, family_code)
    values (new.id, 'player', coalesce(new.email, 'Player'), 'golf', public.new_code())
    on conflict (id) do nothing;
  exception when others then
    null;
  end;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 4 · THE APP NO LONGER INSERTS PROFILES
--
-- With the trigger doing it, a client-side insert is both unnecessary
-- and a way for someone to write a row that doesn't match their
-- account. Removing the policy closes that off.
-- ------------------------------------------------------------
drop policy if exists "insert your own profile once" on public.profiles;


-- ------------------------------------------------------------
-- 5 · JOINING A COACH LATER
--
-- A player who signed up without a code needs to set coach_id
-- afterwards. They may only change their own row.
-- ------------------------------------------------------------
drop policy if exists "update your own profile" on public.profiles;
create policy "update your own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());


-- ------------------------------------------------------------
-- 6 · LOOKUPS
-- Both callable before sign-in, so a code can be checked on the way in.
-- ------------------------------------------------------------
drop function if exists public.find_coach_by_code(text);
create or replace function public.find_coach_by_code(p_code text)
returns table (id uuid, sport text, name text) as $$
  select p.id, p.sport, p.name
  from public.profiles p
  where p.role = 'coach'
    and upper(trim(p.invite_code)) = upper(trim(p_code))
  limit 1;
$$ language sql stable security definer set search_path = public;
grant execute on function public.find_coach_by_code(text) to anon, authenticated;

drop function if exists public.find_guardian_by_code(text);
create or replace function public.find_guardian_by_code(p_code text)
returns table (id uuid, name text) as $$
  select p.id, p.name
  from public.profiles p
  where p.family_code is not null
    and upper(trim(p.family_code)) = upper(trim(p_code))
  limit 1;
$$ language sql stable security definer set search_path = public;
grant execute on function public.find_guardian_by_code(text) to anon, authenticated;


-- ============================================================
-- CHECK IT WORKED
--
-- Should show 0 accounts, 0 profiles, and the trigger present.
-- ============================================================
select
  (select count(*) from auth.users)      as accounts,
  (select count(*) from public.profiles) as profiles,
  (select exists (
     select 1 from pg_trigger
     where tgname = 'on_auth_user_created' and not tgisinternal
   ))                                    as trigger_installed;

-- ============================================================
-- ONE MORE THING, IN THE DASHBOARD
--
-- Authentication → Sign In / Providers → Email → turn OFF
-- "Confirm email", then Save.
--
-- With it on, nobody can use the app until they click a link in an
-- email, which for a pilot is friction with no benefit. The trigger
-- above means sign-up now works either way — but with it off, people
-- are straight in.
-- ============================================================
