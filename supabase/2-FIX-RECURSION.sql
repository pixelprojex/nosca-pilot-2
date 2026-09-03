-- ============================================================
-- NOSCA — FIX: RECURSIVE SECURITY POLICY
--
-- Run this in Supabase → SQL Editor → New query. It is safe to run
-- more than once, and safe to run whether or not you ran the previous
-- rebuild script.
--
--
-- WHAT WAS WRONG
--
-- The policy deciding who may read a row of `profiles` contained a
-- subquery that itself read `profiles`:
--
--     or id = (select p.coach_id from public.profiles p
--              where p.id = auth.uid())
--
-- Reading a profile runs the policy. The policy reads a profile. That
-- read runs the policy again. Postgres spots the loop and aborts with
--
--     infinite recursion detected in policy for relation "profiles"
--
-- Every read of the table failed — which is why sign-in and sign-up
-- broke in exactly the same way, and why "your account isn't
-- finished" appeared every single time. The profile row was being
-- created correctly all along; it simply could never be read back.
--
--
-- THE FIX
--
-- A policy may not query the table it protects. It CAN call a
-- SECURITY DEFINER function, which runs as the table's owner and so
-- skips policy checks entirely — no second evaluation, no loop. The
-- original schema had exactly such a helper for this reason; the
-- rewrite replaced it with an inline subquery and reintroduced the
-- problem it existed to prevent.
-- ============================================================


-- ------------------------------------------------------------
-- 1 · HELPERS THAT DO NOT RECURSE
-- ------------------------------------------------------------
-- security definer is the whole point: these read `profiles` without
-- triggering the policy that calls them.

create or replace function public.my_coach_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.role = 'coach' then p.id else p.coach_id end
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.my_guardian_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.guardian_id
  from public.profiles p
  where p.id = auth.uid();
$$;

grant execute on function public.my_coach_id()    to authenticated;
grant execute on function public.my_guardian_id() to authenticated;


-- ------------------------------------------------------------
-- 2 · THE POLICY, WITHOUT THE LOOP
-- ------------------------------------------------------------
-- Every previous name is dropped, because leaving an old recursive
-- policy in place would keep breaking every read on its own.
drop policy if exists "see your own coach group"                                on public.profiles;
drop policy if exists "see yourself, your coach, or your own players"           on public.profiles;
drop policy if exists "see yourself, your coach, your players, or your family"  on public.profiles;
drop policy if exists "read profiles you are connected to"                     on public.profiles;

create policy "read profiles you are connected to" on public.profiles
  for select using (
    -- your own row. Checked first and needs no function call, so the
    -- common case is a plain column comparison.
    id = auth.uid()
    -- your players, if you are a coach
    or coach_id = auth.uid()
    -- your coach
    or id = public.my_coach_id()
    -- your family
    or guardian_id = auth.uid()
    or id = public.my_guardian_id()
  );

drop policy if exists "insert your own profile once" on public.profiles;
create policy "insert your own profile once" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "update your own profile" on public.profiles;
create policy "update your own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());


-- ------------------------------------------------------------
-- 3 · ANY OTHER POLICY WITH THE SAME FLAW
-- ------------------------------------------------------------
-- Same rule everywhere: a policy on a table must not query that
-- table. These all go through the helper instead.

drop policy if exists "read lessons that are yours" on public.lessons;
create policy "read lessons that are yours" on public.lessons
  for select using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or (kind = 'group' and coach_id = public.my_coach_id())
  );

drop policy if exists "send in your own thread" on public.messages;
create policy "send in your own thread" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (auth.uid() = coach_id or auth.uid() = player_id)
  );

drop policy if exists "read your own thread" on public.messages;
create policy "read your own thread" on public.messages
  for select using (auth.uid() = coach_id or auth.uid() = player_id);


-- ------------------------------------------------------------
-- 4 · DELETING AN ACCOUNT, PROPERLY
-- ------------------------------------------------------------
-- A browser cannot delete from auth.users — that needs privileges no
-- public key should ever carry. A security definer function can, and
-- because it hard-codes auth.uid() it can only ever delete the caller's
-- own account. There is no argument to tamper with.
--
-- Everything referencing the profile cascades: lessons, media rows,
-- drills, tips, attendance, bookings, competitions, recurring slots,
-- preferences, messages, reviews.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.';
  end if;

  -- Media rows first: the storage objects themselves are removed by
  -- the app before this runs, and the rows would cascade anyway, but
  -- being explicit keeps the intent clear.
  delete from public.lesson_media
  where lesson_id in (select id from public.lessons where coach_id = me or player_id = me);

  -- Anyone this account was guardian to is released rather than
  -- deleted — their own account is theirs, not a dependency of this one.
  update public.profiles set guardian_id = null where guardian_id = me;

  -- A coach's players keep their accounts and simply have no coach.
  update public.profiles set coach_id = null where coach_id = me;

  -- This cascades to public.profiles and everything under it.
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- ============================================================
-- CHECK IT WORKED
--
-- recursive_policies must be 0. If it is anything else, an old policy
-- survived and reads will still fail.
-- ============================================================
select
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'profiles')        as profile_policies,
  (select count(*) from pg_policies
     where schemaname = 'public'
       and tablename = 'profiles'
       and qual like '%from public.profiles%')                      as recursive_policies,
  (select exists (select 1 from pg_proc where proname = 'my_coach_id'))       as helper_installed,
  (select exists (select 1 from pg_proc where proname = 'delete_my_account')) as delete_installed,
  (select exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')) as signup_trigger;
