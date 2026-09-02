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
create policy "read your own thread" on public.messages
  for select using (
    coach_id = public.my_coach_id()
    and (auth.uid() = coach_id or auth.uid() = player_id)
  );

-- You may only send as yourself, and only within a thread you belong to.
create policy "send in your own thread" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (auth.uid() = coach_id or auth.uid() = player_id)
    and coach_id = public.my_coach_id()
  );

-- Marking as read is the only update permitted, and only by the
-- recipient.
create policy "mark received messages read" on public.messages
  for update using (
    auth.uid() <> sender_id
    and (auth.uid() = coach_id or auth.uid() = player_id)
  );

-- ============================================================
-- Verification:
-- select * from public.messages limit 1;
-- ============================================================
