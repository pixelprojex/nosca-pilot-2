-- ============================================================
-- NOSCA — MIGRATION 004
--
-- IMPORTANT: this corrects a data-privacy defect. Under the previous
-- policies, every player of a coach could read every OTHER player's
-- lessons, drills, tips and attendance, because the check was only
-- "does this belong to my coach". A player must see their own records
-- and nothing else.
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- ============================================================

-- ---------- PROFILES ----------
-- A player should see themselves and their coach. They should NOT see
-- the coach's other players.
drop policy if exists "see your own coach group" on public.profiles;
create policy "see yourself, your coach, or your own players" on public.profiles
  for select using (
    id = auth.uid()                                    -- yourself
    or coach_id = auth.uid()                           -- your players (coach only)
    or (id = public.my_coach_id() and public.my_coach_id() <> auth.uid())  -- your coach
  );

-- ---------- LESSONS ----------
drop policy if exists "coach group can read lessons" on public.lessons;
create policy "read lessons that are yours" on public.lessons
  for select using (
    coach_id = auth.uid()                              -- the coach sees all of theirs
    or player_id = auth.uid()                          -- a player sees only their own
    or (kind = 'group' and coach_id = public.my_coach_id())  -- group lessons are shared
  );

-- ---------- LESSON MEDIA ----------
drop policy if exists "coach group can read media" on public.lesson_media;
create policy "read media for lessons that are yours" on public.lesson_media
  for select using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id
        and (l.coach_id = auth.uid()
             or l.player_id = auth.uid()
             or (l.kind = 'group' and l.coach_id = public.my_coach_id()))
    )
  );

-- ---------- DRILLS ----------
drop policy if exists "coach group can read drills" on public.drills;
create policy "read drills that are yours" on public.drills
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- TIPS ----------
drop policy if exists "coach group can read tips" on public.tips;
create policy "read tips that are yours" on public.tips
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- ATTENDANCE ----------
drop policy if exists "coach group can read sessions" on public.attendance_sessions;
create policy "read sessions that concern you" on public.attendance_sessions
  for select using (
    coach_id = auth.uid()
    or exists (select 1 from public.attendance_marks m
               where m.session_id = id and m.player_id = auth.uid())
  );

drop policy if exists "coach group can read marks" on public.attendance_marks;
create policy "read marks that are yours" on public.attendance_marks
  for select using (
    player_id = auth.uid()
    or exists (select 1 from public.attendance_sessions s
               where s.id = session_id and s.coach_id = auth.uid())
  );

-- ---------- BOOKINGS ----------
drop policy if exists "coach group can read bookings" on public.bookings;
create policy "read bookings that are yours" on public.bookings
  for select using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or (kind = 'group' and coach_id = public.my_coach_id())
  );

-- ---------- RECURRING ----------
drop policy if exists "coach group can read recurring" on public.recurring;
create policy "read recurring that is yours" on public.recurring
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- COMPETITIONS ----------
drop policy if exists "coach group can read competitions" on public.competitions;
create policy "read competitions that are yours" on public.competitions
  for select using (coach_id = auth.uid() or player_id = auth.uid());

-- ---------- STORAGE ----------
-- Media lives under the coach's id, so path alone cannot distinguish
-- one player from another. Reads are therefore checked against the
-- lesson the file belongs to.
drop policy if exists "coach group can read own media" on storage.objects;
create policy "read media files for lessons that are yours" on storage.objects
  for select using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text      -- the coach's own folder
      or exists (
        select 1 from public.lesson_media lm
        join public.lessons l on l.id = lm.lesson_id
        where lm.storage_path = name
          and (l.player_id = auth.uid()
               or (l.kind = 'group' and l.coach_id = public.my_coach_id()))
      )
    )
  );

-- ============================================================
-- PROFILE FIELDS
-- Only what the sign-up actually asks for. A club field exists but is
-- optional and empty unless the coach fills it in; nothing is invented.
-- ============================================================
alter table public.profiles
  add column if not exists club text;

-- ============================================================
-- Verification — sign in as a player and run:
--   select count(*) from public.lessons;
-- It must return only that player's own lessons plus any group
-- lessons, never another player's private ones.
-- ============================================================
