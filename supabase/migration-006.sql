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
