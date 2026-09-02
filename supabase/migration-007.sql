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
