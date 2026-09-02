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
drop function if exists public.enforce_pilot_limits();

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
