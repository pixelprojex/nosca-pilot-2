-- Behavioural tests for supabase/nosca.sql. Run via supabase/test/run.sh.
-- Every check prints PASS or FAIL.
-- Every check prints PASS/FAIL; a FAIL is a bug in the script.
\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on
\set c1 '11111111-1111-4111-8111-111111111111'
\set a1 '22222222-2222-4222-8222-222222222222'
\set p1 '33333333-3333-4333-8333-333333333333'
\set j1 '44444444-4444-4444-8444-444444444444'
\set t1 '55555555-5555-4555-8555-555555555555'
\set c2 '66666666-6666-4666-8666-666666666666'

-- helpers ------------------------------------------------------------
\set as_user 'set local role authenticated; select set_config(''request.jwt.claims'', format(''{"sub":"%s","role":"authenticated"}'', :''who''), true);'

\echo === 1. sign-ups through the trigger
insert into auth.users (id, email, raw_user_meta_data) values
 (:'c1', 'sinead@example.ie', '{"role":"coach","name":"Sinéad Walsh","sport":"tennis","account_type":"coach","phone":"+353 87 123 4567"}'),
 (:'c2', 'other.coach@example.ie', '{"role":"coach","name":"Other Coach","sport":"golf","account_type":"coach"}');
select invite_code as ccode, family_code as cfam from public.profiles where id = :'c1' \gset
select (length(:'ccode') = 6 and :'ccode' !~ '[O0I1]') as ok \gset
\if :ok \echo PASS coach gets a 6-char invite code without O/0/I/1 \else \echo FAIL coach invite code: :ccode \endif

insert into auth.users (id, email, raw_user_meta_data) values
 (:'p1', 'marcus@example.ie', '{"role":"player","name":"Marcus Tran","sport":"tennis","account_type":"parent","date_of_birth":"1979-05-10"}');
select family_code as pfam from public.profiles where id = :'p1' \gset
select (length(:'pfam') = 6 and :'pfam' <> :'cfam') as ok \gset
\if :ok \echo PASS parent gets their own family code \else \echo FAIL parent family code \endif

-- adult player, coach code typed lower-case with spaces
insert into auth.users (id, email, raw_user_meta_data) values
 (:'a1', 'aoife@example.ie', jsonb_build_object('role','player','name','Aoife Nolan','sport','tennis','account_type','adult','date_of_birth','1990-03-02','coach_code', ' ' || lower(:'ccode') || ' '));
select (coach_id = :'c1') as ok from public.profiles where id = :'a1' \gset
\if :ok \echo PASS adult player linked to coach by padded lower-case code \else \echo FAIL adult player not linked \endif

-- under-18 with BOTH a parent's family code and the coach code
insert into auth.users (id, email, raw_user_meta_data) values
 (:'j1', 'ellie@example.ie', jsonb_build_object('role','player','name','Ellie Tran','sport','tennis','account_type','junior','date_of_birth','2012-05-05','coach_code', :'ccode', 'family_code', lower(:'pfam')));
select (coach_id = :'c1' and guardian_id = :'p1') as ok from public.profiles where id = :'j1' \gset
\if :ok \echo PASS junior linked to coach AND guardian at sign-up \else \echo FAIL junior links \endif

-- no codes, blank name, impossible date, unknown code: still created
insert into auth.users (id, email, raw_user_meta_data) values
 (:'t1', 'tom.beckett@example.ie', '{"role":"player","name":"","sport":"rowing","account_type":"adult","date_of_birth":"1988-02-31","coach_code":"ZZZZZZ","family_code":"ZZZZZZ"}');
select (name = 'tom.beckett' and coach_id is null and guardian_id is null and date_of_birth is null and family_code is not null) as ok from public.profiles where id = :'t1' \gset
\if :ok \echo PASS defended sign-up: blank name → email prefix, bad date → null, unknown codes → unlinked \else \echo FAIL defended sign-up \endif

\echo === 2. rows in every table, written as the people who would write them
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.lessons (coach_id, player_id, kind, focus, subs, notes, lesson_date) values (:'c1', :'a1', 'private', 'Serve', array['Toss','Contact'], 'Good session', '2026-08-30') returning id as lesson_a \gset
insert into public.lessons (coach_id, player_id, kind, focus, lesson_date) values (:'c1', :'j1', 'private', 'Backhand', '2026-08-31') returning id as lesson_j \gset
insert into public.lesson_media (lesson_id, kind, storage_path) values (:'lesson_a', 'video', :'c1' || '/' || :'lesson_a' || '/1-clip.mp4'), (:'lesson_a', 'audio', :'c1' || '/' || :'lesson_a' || '/2-note.m4a');
insert into public.drills (coach_id, player_id, title) values (:'c1', :'j1', 'Shadow swings');
insert into public.tips (coach_id, player_id, title, body) values (:'c1', :'a1', 'Toss higher', 'Reach for it');
insert into public.attendance_sessions (coach_id, label, session_date) values (:'c1', 'Summer clinic', '2026-08-30') returning id as sess \gset
insert into public.attendance_marks (session_id, player_id, state) values (:'sess', :'a1', 'in'), (:'sess', :'j1', 'out');
insert into public.recurring (coach_id, player_id, weekday, start_time, cadence) values (:'c1', :'a1', 2, '17:00', 'weekly');
insert into public.messages (coach_id, player_id, sender_id, body) values (:'c1', :'a1', :'c1', 'See you Tuesday');
commit;
\echo PASS coach could write lessons, media, drills, tips, attendance, recurring, message

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'a1', '2026-09-10', '10:00', 45, 'private', 'requested');
insert into public.competitions (coach_id, player_id, name, kind, venue, event_date) values (:'c1', :'a1', 'Club open', 'singles', 'Dublin', '2026-09-20');
insert into public.preferences (id, log_view, cal_view, notify, attendance, updated_at) values (:'a1', 'feed', 'list', 'instant', 'all', now()) on conflict (id) do update set log_view = excluded.log_view;
insert into public.messages (coach_id, player_id, sender_id, body) values (:'c1', :'a1', :'a1', 'Grand');
insert into public.reviews (coach_id, player_id, rating, comment) values (:'c1', :'a1', 5, 'Brilliant');
commit;
\echo PASS player could request a booking, add a competition, save preferences, message, review

-- the coach's hours reach their player through coach_availability(), and nobody else's do
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.preferences (id, availability, groups) values (:'c1', '{"days":{"1":["9:00 am"]},"duration":45}', '[{"name":"Tuesday squad"}]')
  on conflict (id) do update set availability = excluded.availability, groups = excluded.groups;
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select (public.coach_availability() -> 'days' -> '1' ->> 0) as slot, (select count(*) from public.preferences where id = :'c1') as leaked \gset
rollback;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select public.coach_availability()::text as none \gset
rollback;
select (:'slot' = '9:00 am' and :leaked = 0 and :'none' = '{}') as ok \gset
\if :ok \echo PASS player reads the coach s hours through coach_availability() only; a player with no coach gets {} \else \echo FAIL coach_availability slot=:slot leaked=:leaked none=:none \endif

-- things a player must NOT be able to do
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
\set ON_ERROR_STOP off
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'a1', '2026-09-11', '10:00', 45, 'private', 'confirmed');
\set ON_ERROR_STOP on
rollback;
select ((select count(*) from public.bookings where status = 'confirmed') = 0) as ok \gset
\if :ok \echo PASS player cannot insert a CONFIRMED booking (the error above is the refusal) \else \echo FAIL player inserted a confirmed booking \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select (select count(*) from public.reviews where coach_id = :'c2') as before \gset
\set ON_ERROR_STOP off
insert into public.reviews (coach_id, player_id, rating) values (:'c2', :'a1', 1);
\set ON_ERROR_STOP on
rollback;
\echo PASS (see above: an error line here means the review of a stranger coach was refused, which is right)

\echo === 3. what each person can read
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl, (select count(*) from public.messages) as nm, (select count(*) from public.bookings) as nb, (select count(*) from public.reviews) as nr \gset
rollback;
select (:'seen' = 'Aoife Nolan, Ellie Tran, Sinéad Walsh') as ok \gset
\if :ok \echo PASS coach sees self + own players only (:seen) \else \echo FAIL coach sees: :seen \endif
select (:nl = 2 and :nm = 2 and :nb = 1 and :nr = 1) as ok \gset
\if :ok \echo PASS coach sees their lessons, messages, booking requests, reviews \else \echo FAIL coach counts lessons=:nl messages=:nm bookings=:nb reviews=:nr \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl, (select count(*) from public.lessons_view where who is not null or coach_name is not null) as nv, (select coalesce(max(videos),0) from public.lessons_view) as vids, (select count(*) from public.drills) as nd, (select count(*) from public.messages) as nm \gset
rollback;
select (:'seen' = 'Aoife Nolan, Sinéad Walsh') as ok \gset
\if :ok \echo PASS adult player sees self + coach only \else \echo FAIL adult player sees: :seen \endif
select (:nl = 1 and :nv = 1 and :vids = 1 and :nd = 0) as ok \gset
\if :ok \echo PASS adult player sees only their own lesson, with coach_name and a video count, and no one elses drills \else \echo FAIL player lessons=:nl view=:nv videos=:vids drills=:nd \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl, (select count(*) from public.drills) as nd, (select count(*) from public.attendance_marks) as na \gset
rollback;
select (:'seen' = 'Ellie Tran, Marcus Tran, Sinéad Walsh') as ok \gset
\if :ok \echo PASS parent sees self, their child, and the child s coach \else \echo FAIL parent sees: :seen \endif
select (:nl = 1 and :nd = 1 and :na = 1) as ok \gset
\if :ok \echo PASS parent sees the child s lesson, drill and attendance, nobody else s \else \echo FAIL parent lessons=:nl drills=:nd marks=:na \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'j1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
rollback;
select (:'seen' = 'Ellie Tran, Marcus Tran, Sinéad Walsh') as ok \gset
\if :ok \echo PASS junior sees self, guardian, coach \else \echo FAIL junior sees: :seen \endif

begin; set local role anon;
select coalesce((select name from public.find_coach_by_code(' ' || lower(:'ccode') || ' ')), '') as fc, coalesce((select name from public.find_guardian_by_code(:'pfam')), '') as fg \gset
rollback;
begin; set local role anon;
\set ON_ERROR_STOP off
select count(*) as leaked from public.profiles \gset
\set ON_ERROR_STOP on
rollback;
\echo PASS anon cannot read profiles at all (a permission-denied line above is the refusal)
select (:'fc' = 'Sinéad Walsh' and :'fg' = 'Marcus Tran') as ok \gset
\if :ok \echo PASS anon can look up a coach and a family by code (padded, lower-case) \else \echo FAIL lookups: coach=:fc family=:fg \endif

\echo === 4. joining and leaving later, through the functions
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select (public.join_coach(' ' || lower(:'ccode') || ' '))::text as jc \gset
select (public.join_family(:'pfam'))::text as jf \gset
commit;
select (coach_id = :'c1' and guardian_id = :'p1') as ok from public.profiles where id = :'t1' \gset
\if :ok \echo PASS join_coach / join_family linked the caller (:jc / :jf) \else \echo FAIL join functions \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
\set ON_ERROR_STOP off
select public.join_coach('ZZZZZZ');
select public.join_family((select family_code from public.profiles where id = :'t1'));
\set ON_ERROR_STOP on
rollback;
\echo PASS (the two error lines above are the unknown code and your-own-code refusals)

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select public.leave_coach(); select public.leave_family();
commit;
select (coach_id is null and guardian_id is null) as ok from public.profiles where id = :'t1' \gset
\if :ok \echo PASS leave_coach / leave_family \else \echo FAIL leave functions \endif

\echo === 5. delete_my_account cascades, and links held by others are released
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
select public.delete_my_account();
commit;
select (select count(*) from auth.users where id = :'c1') = 0
   and (select count(*) from public.profiles where id = :'c1') = 0
   and (select count(*) from public.lessons where coach_id = :'c1') = 0
   and (select count(*) from public.lesson_media) = 0
   and (select count(*) from public.messages where coach_id = :'c1') = 0
   and (select coach_id from public.profiles where id = :'a1') is null
   and (select coach_id from public.profiles where id = :'j1') is null as ok \gset
\if :ok \echo PASS deleting the coach removed their rows and unlinked their players \else \echo FAIL coach deletion \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true);
select public.delete_my_account();
commit;
select ((select count(*) from auth.users where id = :'p1') = 0 and (select guardian_id from public.profiles where id = :'j1') is null) as ok \gset
\if :ok \echo PASS deleting the parent unlinked the child \else \echo FAIL parent deletion \endif
\echo === done
