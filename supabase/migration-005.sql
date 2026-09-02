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
