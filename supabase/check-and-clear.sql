-- ============================================================
-- NOSCA — CHECK AND CLEAR
--
-- Run this in Supabase → SQL Editor BEFORE deploying anything else.
-- It costs nothing and needs no Netlify build.
--
-- Part 1 tells you what state things are actually in.
-- Part 2 clears out the half-created accounts from failed sign-ups.
-- ============================================================


-- ------------------------------------------------------------
-- PART 1 · WHAT STATE ARE THINGS IN?
-- Run this on its own first and read the result.
-- ------------------------------------------------------------
select
  (select count(*) from auth.users)                         as auth_accounts,
  (select count(*) from public.profiles)                    as profiles,
  -- accounts that can sign in but have no profile: these are the
  -- broken ones. Any number above zero explains the problem.
  (select count(*) from auth.users u
     where not exists (select 1 from public.profiles p where p.id = u.id))
                                                            as broken_accounts,
  -- accounts whose email was never confirmed
  (select count(*) from auth.users where email_confirmed_at is null)
                                                            as unconfirmed,
  -- has the setup SQL been run?
  (select exists (select 1 from information_schema.columns
     where table_name = 'profiles' and column_name = 'family_code'))
                                                            as setup_sql_done;


-- ------------------------------------------------------------
-- PART 2 · CLEAR THE BROKEN ACCOUNTS
--
-- Deletes only accounts that have NO profile — the half-created ones.
-- Accounts that work are left completely alone.
--
-- Run this second, then sign up again with the same email.
-- ------------------------------------------------------------
delete from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);


-- ------------------------------------------------------------
-- PART 3 · CONFIRM EVERY REMAINING EMAIL
--
-- If "Confirm email" was on, existing accounts are stuck waiting for a
-- link. This marks them confirmed so they can sign in immediately.
-- ------------------------------------------------------------
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;


-- ------------------------------------------------------------
-- Check again — broken_accounts and unconfirmed should now be 0.
-- ------------------------------------------------------------
select
  (select count(*) from auth.users)      as auth_accounts,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from auth.users u
     where not exists (select 1 from public.profiles p where p.id = u.id))
                                         as broken_accounts,
  (select count(*) from auth.users where email_confirmed_at is null)
                                         as unconfirmed;
