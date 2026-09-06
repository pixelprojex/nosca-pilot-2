-- Nosca — start again.
--
-- Removes every account and every row. Deleting from auth.users
-- cascades through profiles and every table that hangs off them —
-- lessons, bookings, messages, notifications, push subscriptions.
--
-- Files: this clears the rows behind the "media" and "avatars"
-- buckets, so their listings come back empty, but the stored files
-- themselves are only truly removed by the script version,
-- `node scripts/wipe.mjs --yes` — that one is the thorough way.
--
-- It cannot be undone. Paste the whole file into the SQL editor and
-- run it; the last statement shows what is left (all zeros).

delete from storage.objects where bucket_id in ('media', 'avatars');

delete from auth.users;
delete from public.families;   -- nothing hangs off these once the members are gone

select
  (select count(*) from auth.users)                                              as users,
  (select count(*) from public.profiles)                                         as profiles,
  (select count(*) from storage.objects where bucket_id in ('media', 'avatars')) as storage_objects;
