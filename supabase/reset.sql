-- ============================================================
-- NOSCA — RESET
--
-- Deletes every account and everything belonging to it, so the app is
-- a genuine blank slate. Use this before a real pilot, or any time the
-- test accounts need clearing.
--
-- Supabase → SQL Editor → New query → paste → Run.
--
-- THIS CANNOT BE UNDONE.
-- ============================================================

-- NOTE: uploaded files in the 'media' storage bucket must be cleared
-- separately. Go to Supabase → Storage → media → select all → Delete.
-- Do that first, then run this script.

-- Every account. All the tables below reference profiles, which
-- references auth.users, with "on delete cascade" throughout — so
-- removing the users clears lessons, media rows, drills, tips,
-- attendance, bookings, competitions, recurring slots, preferences and
-- messages along with them.
delete from auth.users;

-- ============================================================
-- Confirm it worked — every count below should be zero.
-- ============================================================
select
  (select count(*) from auth.users)            as accounts,
  (select count(*) from public.profiles)       as profiles,
  (select count(*) from public.lessons)        as lessons,
  (select count(*) from public.lesson_media)   as media_rows,
  (select count(*) from public.drills)         as drills,
  (select count(*) from public.tips)           as tips,
  (select count(*) from public.bookings)       as bookings,
  (select count(*) from public.messages)       as messages,
  (select count(*) from storage.objects
     where bucket_id = 'media')                as media_files;
