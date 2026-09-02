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
