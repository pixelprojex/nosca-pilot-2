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
