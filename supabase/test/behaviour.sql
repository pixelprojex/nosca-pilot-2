-- Behavioural tests for supabase/nosca.sql. Run via supabase/test/run.sh.
-- Every check prints PASS or FAIL; a FAIL is a bug in the script.
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

\echo === 1. sign-ups through the trigger
insert into auth.users (id, email, raw_user_meta_data) values
 (:'c1', 'sinead@example.ie', '{"role":"coach","name":"Sinéad Walsh","sport":"tennis","account_type":"coach","phone":"+353 87 123 4567"}'),
 (:'c2', 'other.coach@example.ie', '{"role":"coach","name":"Other Coach","sport":"golf","account_type":"coach"}');
select invite_code as ccode from public.profiles where id = :'c1' \gset
select (length(:'ccode') = 6 and :'ccode' !~ '[O0I1]') as ok \gset
\if :ok \echo PASS coach gets a 6-char invite code without O/0/I/1 \else \echo FAIL coach invite code: :ccode \endif
select (family_id is null) as ok from public.profiles where id = :'c1' \gset
\if :ok \echo PASS a coach starts with no family — nobody is given one automatically \else \echo FAIL coach has a family \endif

-- a parent with no code to enter gets a family of their own
insert into auth.users (id, email, raw_user_meta_data) values
 (:'p1', 'marcus@example.ie', '{"role":"player","name":"Marcus Tran","sport":"tennis","account_type":"parent","date_of_birth":"1979-05-10"}');
select f.code as pfam, f.id as fam1 from public.profiles p join public.families f on f.id = p.family_id where p.id = :'p1' \gset
select (length(:'pfam') = 6 and :'pfam' <> :'ccode' and (select created_by from public.families where id = :'fam1') = :'p1') as ok \gset
\if :ok \echo PASS a parent signing up with no family code gets a family created, with its own code \else \echo FAIL parent family \endif

-- adult player, coach code typed lower-case with spaces: a REQUEST, not a link
insert into auth.users (id, email, raw_user_meta_data) values
 (:'a1', 'aoife@example.ie', jsonb_build_object('role','player','name','Aoife Nolan','sport','tennis','account_type','adult','date_of_birth','1990-03-02','coach_code', ' ' || lower(:'ccode') || ' '));
select (coach_id is null and family_id is null) as ok from public.profiles where id = :'a1' \gset
select id as req_a from public.coach_requests where player_id = :'a1' and coach_id = :'c1' and status = 'pending' \gset
select (:'ok'::boolean and :'req_a' <> '') as ok \gset
\if :ok \echo PASS adult player with a coach code is NOT linked yet: a pending request waits for the coach; no family \else \echo FAIL adult sign-up request \endif

-- under-18 with BOTH a parent's family code and the coach code
insert into auth.users (id, email, raw_user_meta_data) values
 (:'j1', 'ellie@example.ie', jsonb_build_object('role','player','name','Ellie Tran','sport','tennis','account_type','junior','date_of_birth','2012-05-05','coach_code', :'ccode', 'family_code', lower(:'pfam')));
select (family_id = :'fam1' and coach_id is null) as ok from public.profiles where id = :'j1' \gset
select id as req_j from public.coach_requests where player_id = :'j1' and coach_id = :'c1' and status = 'pending' \gset
select (:'ok'::boolean and :'req_j' <> '') as ok \gset
\if :ok \echo PASS junior joined the family at sign-up and asked the coach \else \echo FAIL junior links \endif
select (select count(*) from public.notifications where user_id = :'p1' and kind = 'family') as n \gset
\if :n \echo PASS the parent was told someone joined the family \else \echo FAIL no family notification for the parent \endif

-- no codes, blank name, impossible date, unknown code: still created
insert into auth.users (id, email, raw_user_meta_data) values
 (:'t1', 'tom.beckett@example.ie', '{"role":"player","name":"","sport":"rowing","account_type":"adult","date_of_birth":"1988-02-31","coach_code":"ZZZZZZ","family_code":"ZZZZZZ"}');
select (name = 'tom.beckett' and coach_id is null and family_id is null and date_of_birth is null) as ok from public.profiles where id = :'t1' \gset
select (:'ok'::boolean and (select count(*) from public.coach_requests where player_id = :'t1') = 0) as ok \gset
\if :ok \echo PASS defended sign-up: blank name → email prefix, bad date → null, unknown codes → nothing \else \echo FAIL defended sign-up \endif

\echo === 2. the coach answers the requests
select (select count(*) from public.notifications where user_id = :'c1' and kind = 'request') as n \gset
select (:n = 2) as ok \gset
\if :ok \echo PASS the coach was told about both requests \else \echo FAIL coach request notifications: :n \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select public.respond_to_request(:'req_a', true);
select public.respond_to_request(:'req_j', true);
commit;
select (:'seen' = 'Aoife Nolan, Ellie Tran, Sinéad Walsh') as ok \gset
\if :ok \echo PASS while requests wait, the coach can see who is asking (:seen) \else \echo FAIL coach sees while pending: :seen \endif
select ((select coach_id from public.profiles where id = :'a1') = :'c1' and (select coach_id from public.profiles where id = :'j1') = :'c1') as ok \gset
\if :ok \echo PASS accepting links both players to the coach \else \echo FAIL accept did not link \endif
select ((select count(*) from public.notifications where user_id = :'a1' and kind = 'accepted') = 1
    and (select count(*) from public.notifications where user_id = :'j1' and kind = 'accepted') = 1) as ok \gset
\if :ok \echo PASS both players were told they were accepted \else \echo FAIL accepted notifications \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c2'), true);
\set ON_ERROR_STOP off
select public.respond_to_request(:'req_a', false);
\set ON_ERROR_STOP on
rollback;
select (status = 'accepted') as ok from public.coach_requests where id = :'req_a' \gset
\if :ok \echo PASS another coach cannot answer a request that is not theirs (the error above is the refusal) \else \echo FAIL stranger coach changed a request \endif

\echo === 3. rows in every table, written as the people who would write them
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.lessons (coach_id, player_id, kind, focus, subs, notes, lesson_date) values (:'c1', :'a1', 'private', 'Serve', array['Toss','Contact'], 'Good session', '2026-08-30') returning id as lesson_a \gset
insert into public.lessons (coach_id, player_id, kind, focus, lesson_date) values (:'c1', :'j1', 'private', 'Backhand', '2026-08-31') returning id as lesson_j \gset
insert into public.lesson_media (lesson_id, kind, storage_path) values (:'lesson_a', 'video', :'c1' || '/' || :'lesson_a' || '/1-clip.mp4'), (:'lesson_a', 'audio', :'c1' || '/' || :'lesson_a' || '/2-note.m4a');
insert into public.drills (coach_id, player_id, title) values (:'c1', :'j1', 'Shadow swings'), (:'c1', :'j1', 'Wall rallies'), (:'c1', :'a1', 'Toss drill');
insert into public.tips (coach_id, player_id, title, body) values (:'c1', :'a1', 'Toss higher', 'Reach for it');
insert into public.attendance_sessions (coach_id, label, session_date) values (:'c1', 'Summer clinic', '2026-08-30') returning id as sess \gset
insert into public.attendance_marks (session_id, player_id, state) values (:'sess', :'a1', 'in'), (:'sess', :'j1', 'out');
insert into public.recurring (coach_id, player_id, weekday, start_time, cadence) values (:'c1', :'a1', 2, '17:00', 'weekly');
insert into public.messages (coach_id, player_id, sender_id, body) values (:'c1', :'a1', :'c1', 'See you Tuesday');
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'j1', '2026-09-12', '15:00', 45, 'private', 'confirmed') returning id as bk_j \gset
commit;
\echo PASS coach could write lessons, media, drills, tips, attendance, recurring, message, booking

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'a1', '2026-09-10', '10:00', 45, 'private', 'requested');
insert into public.competitions (coach_id, player_id, name, kind, venue, event_date) values (:'c1', :'a1', 'Club open', 'singles', 'Dublin', '2026-09-20');
insert into public.preferences (id, log_view, cal_view, notify, attendance, updated_at) values (:'a1', 'feed', 'list', 'instant', 'all', now()) on conflict (id) do update set log_view = excluded.log_view;
insert into public.messages (coach_id, player_id, sender_id, body) values (:'c1', :'a1', :'a1', 'Grand');
insert into public.reviews (coach_id, player_id, rating, comment) values (:'c1', :'a1', 5, 'Brilliant');
commit;
\echo PASS player could request a booking, add a competition, save preferences, message, review

\echo === 4. the triggers told the right people
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'lesson') as la,
       (select count(*) from public.notifications where user_id = :'j1' and kind = 'lesson') as lj,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'lesson') as lp \gset
select (:la = 1 and :lj = 1 and :lp = 1) as ok \gset
\if :ok \echo PASS a logged lesson tells the player, and a junior s lesson tells the adult in the family too (not the adult player s) \else \echo FAIL lesson notifications a=:la j=:lj p=:lp \endif
select (select count(*) from public.notifications where user_id = :'j1' and kind = 'drill') as dj,
       (select title from public.notifications where user_id = :'j1' and kind = 'drill') as dt,
       (select count(*) from public.notifications where user_id = :'a1' and kind = 'drill') as da \gset
select (:dj = 1 and :'dt' = '2 new drills' and :da = 1) as ok \gset
\if :ok \echo PASS drills set together arrive as one notification per player ("2 new drills") \else \echo FAIL drill notifications j=:dj t=:dt a=:da \endif
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'tip') as nt,
       (select count(*) from public.notifications where user_id = :'a1' and kind = 'message') as nm,
       (select count(*) from public.notifications where user_id = :'c1' and kind = 'message') as cm,
       (select count(*) from public.notifications where user_id = :'c1' and kind = 'booking') as cb,
       (select count(*) from public.notifications where user_id = :'j1' and kind = 'booking') as jb,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'booking') as pb \gset
select (:nt = 1 and :nm = 1 and :cm = 1 and :cb = 1 and :jb = 1 and :pb = 1) as ok \gset
\if :ok \echo PASS tip → player; message → the other side; booking request → coach; a booked lesson → junior and parent \else \echo FAIL tip=:nt msg=:nm coachmsg=:cm coachbk=:cb jb=:jb pb=:pb \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select count(*) as mine from public.notifications \gset
with u as (update public.notifications set read_at = now() where read_at is null returning id) select count(*) as marked from u \gset
\set ON_ERROR_STOP off
insert into public.notifications (user_id, kind, title) values (:'a1', 'lesson', 'forged');
\set ON_ERROR_STOP on
commit;
select (:mine = (select count(*) from public.notifications where user_id = :'a1') and :marked = :mine and (select count(*) from public.notifications where title = 'forged') = 0) as ok \gset
\if :ok \echo PASS a person reads and marks read only their own notifications, and cannot write one (the error above is the refusal) \else \echo FAIL notifications rls mine=:mine marked=:marked \endif

\echo === 5. hours: your own coach s, or the coach of a junior you look after
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.preferences (id, availability, groups) values (:'c1', '{"days":{"1":["9:00 am"]},"duration":45}', '[{"name":"Tuesday squad"}]')
  on conflict (id) do update set availability = excluded.availability, groups = excluded.groups;
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select (public.coach_availability() -> 'days' -> '1' ->> 0) as slot, (select count(*) from public.preferences where id = :'c1') as leaked, public.coach_availability(:'j1')::text as notmine \gset
rollback;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true);
select (public.coach_availability(:'j1') -> 'days' -> '1' ->> 0) as forkid, public.coach_availability()::text as own \gset
rollback;
select (:'slot' = '9:00 am' and :leaked = 0 and :'notmine' = '{}' and :'forkid' = '9:00 am' and :'own' = '{}') as ok \gset
\if :ok \echo PASS coach_availability(): own coach for a player, the child s coach for the parent, {} for anyone else \else \echo FAIL coach_availability slot=:slot leaked=:leaked notmine=:notmine forkid=:forkid own=:own \endif

-- the parent books for the junior; the junior cannot book for themselves
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true);
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'j1', '2026-09-14', '15:00', 45, 'private', 'requested') returning id as bk_p \gset
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'j1'), true);
\set ON_ERROR_STOP off
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'j1', '2026-09-15', '15:00', 45, 'private', 'requested');
\set ON_ERROR_STOP on
rollback;
select ((select count(*) from public.bookings where player_id = :'j1' and status = 'requested') = 1) as ok \gset
\if :ok \echo PASS an adult in the family requests for the junior; the junior cannot (the error above is the refusal) \else \echo FAIL family booking \endif

\echo === 6. things a player must NOT be able to do
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
\set ON_ERROR_STOP off
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'a1', '2026-09-11', '10:00', 45, 'private', 'confirmed');
\set ON_ERROR_STOP on
rollback;
select ((select count(*) from public.bookings where status = 'confirmed' and player_id = :'a1') = 0) as ok \gset
\if :ok \echo PASS player cannot insert a CONFIRMED booking (the error above is the refusal) \else \echo FAIL player inserted a confirmed booking \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
\set ON_ERROR_STOP off
update public.profiles set coach_id = :'c2' where id = :'a1';
\set ON_ERROR_STOP on
rollback;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
\set ON_ERROR_STOP off
update public.profiles set family_id = :'fam1' where id = :'a1';
\set ON_ERROR_STOP on
rollback;
select (coach_id = :'c1' and family_id is null) as ok from public.profiles where id = :'a1' \gset
\if :ok \echo PASS a player cannot move their own coach_id or family_id by editing their row (the errors above are the refusals) \else \echo FAIL profile links were editable \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
update public.profiles set phone = '+353 1 234' , bio = 'Left-hander' where id = :'a1';
commit;
select (phone = '+353 1 234' and bio = 'Left-hander') as ok from public.profiles where id = :'a1' \gset
\if :ok \echo PASS …but can change their own details \else \echo FAIL own details not saved \endif

\echo === 7. what each person can read
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl, (select count(*) from public.messages) as nm, (select count(*) from public.bookings) as nb, (select count(*) from public.reviews) as nr, (select count(*) from public.coach_requests) as nq, (select count(*) from public.families) as nf \gset
rollback;
select (:'seen' = 'Aoife Nolan, Ellie Tran, Marcus Tran, Sinéad Walsh') as ok \gset
\if :ok \echo PASS coach sees self, own players, and the adult who looks after the junior (:seen) \else \echo FAIL coach sees: :seen \endif
select (:nl = 2 and :nm = 2 and :nb = 3 and :nr = 1 and :nq = 2 and :nf = 0) as ok \gset
\if :ok \echo PASS coach sees their lessons, messages, bookings, reviews, requests — and no family that is not theirs \else \echo FAIL coach counts lessons=:nl messages=:nm bookings=:nb reviews=:nr requests=:nq families=:nf \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl, (select count(*) from public.lessons_view where who is not null or coach_name is not null) as nv, (select coalesce(max(videos),0) from public.lessons_view) as vids, (select count(*) from public.drills) as nd, (select count(*) from public.notifications) as nn \gset
rollback;
select (:'seen' = 'Aoife Nolan, Sinéad Walsh') as ok \gset
\if :ok \echo PASS adult player sees self + coach only \else \echo FAIL adult player sees: :seen \endif
select (:nl = 1 and :nv = 1 and :vids = 1 and :nd = 1) as ok \gset
\if :ok \echo PASS adult player sees only their own lesson, with coach_name and a video count, and only their own drill \else \echo FAIL player lessons=:nl view=:nv videos=:vids drills=:nd \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl, (select count(*) from public.drills) as nd, (select count(*) from public.attendance_marks) as na, (select count(*) from public.families) as nf, (select count(*) from public.bookings) as nb \gset
rollback;
select (:'seen' = 'Ellie Tran, Marcus Tran, Sinéad Walsh') as ok \gset
\if :ok \echo PASS parent sees self, the junior in the family, and the junior s coach \else \echo FAIL parent sees: :seen \endif
select (:nl = 1 and :nd = 2 and :na = 1 and :nf = 1 and :nb = 2) as ok \gset
\if :ok \echo PASS parent sees the junior s lesson, drills, attendance, bookings, and their own family row \else \echo FAIL parent lessons=:nl drills=:nd marks=:na families=:nf bookings=:nb \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'j1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl \gset
rollback;
select (:'seen' = 'Ellie Tran, Marcus Tran, Sinéad Walsh' and :nl = 1) as ok \gset
\if :ok \echo PASS junior sees self, the family, the coach — and only their own lesson \else \echo FAIL junior sees: :seen lessons=:nl \endif

begin; set local role anon;
select coalesce((select name from public.find_coach_by_code(' ' || lower(:'ccode') || ' ')), '') as fc, coalesce((select name || '/' || members from public.find_family_by_code(lower(:'pfam'))), '') as ff \gset
rollback;
begin; set local role anon;
\set ON_ERROR_STOP off
select count(*) as leaked from public.profiles \gset
select count(*) as leaked2 from public.notifications \gset
\set ON_ERROR_STOP on
rollback;
\echo PASS anon cannot read profiles or notifications at all (the permission-denied lines above are the refusals)
select (:'fc' = 'Sinéad Walsh' and :'ff' = 'Marcus''s family/2') as ok \gset
\if :ok \echo PASS anon can look up a coach and a family by code (padded, lower-case); the family answers with a name and a head count \else \echo FAIL lookups: coach=:fc family=:ff \endif

\echo === 8. joining, asking, starting a family — later, through the functions
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select (public.join_coach(' ' || lower(:'ccode') || ' ') ->> 'status') as st \gset
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
commit;
select (:'st' = 'pending' and (select coach_id from public.profiles where id = :'t1') is null and :'seen' = 'Sinéad Walsh, tom.beckett') as ok \gset
\if :ok \echo PASS join_coach makes a request, and the asker can already see the coach s name (:seen) \else \echo FAIL join_coach st=:st seen=:seen \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
\set ON_ERROR_STOP off
select public.join_coach('ZZZZZZ');
\set ON_ERROR_STOP on
rollback;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select (public.join_coach(:'ccode') ->> 'status') as again \gset
select public.cancel_request((select id from public.coach_requests where player_id = :'t1' and status = 'pending'));
commit;
select (:'again' = 'pending' and (select count(*) from public.coach_requests where player_id = :'t1' and status = 'cancelled') = 1
    and (select count(*) from public.coach_requests where player_id = :'t1' and status = 'pending') = 0) as ok \gset
\if :ok \echo PASS unknown code refused; asking twice is a no-op; the player can withdraw (errors above are the refusals) \else \echo FAIL cancel_request \endif

begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select (public.create_family('The Nolans') ->> 'code') as afam \gset
commit;
select (length(:'afam') = 6 and (select f.name from public.families f join public.profiles p on p.family_id = f.id where p.id = :'a1') = 'The Nolans') as ok \gset
\if :ok \echo PASS create_family: a code, a name, and the creator is in it \else \echo FAIL create_family \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select (public.join_family(lower(:'afam')) ->> 'members')::int as members \gset
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
\set ON_ERROR_STOP off
select public.join_family(:'pfam');
\set ON_ERROR_STOP on
rollback;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
\set ON_ERROR_STOP off
select public.create_family();
\set ON_ERROR_STOP on
rollback;
select (:members = 2 and (select family_id from public.profiles where id = :'t1') = (select family_id from public.profiles where id = :'a1')) as ok \gset
\if :ok \echo PASS join_family joins; a second family is refused until you leave (errors above are the refusals) \else \echo FAIL join_family members=:members \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
rollback;
select (:'seen' = 'Aoife Nolan, Sinéad Walsh, tom.beckett') as ok \gset
\if :ok \echo PASS two adults in a family see each other, and neither sees the other s lessons as a junior s (:seen) \else \echo FAIL adults in family see: :seen \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select public.rename_family('Nolan & Beckett');
select public.leave_family();
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select public.leave_family();
commit;
select ((select count(*) from public.families where code = :'afam') = 0 and (select family_id from public.profiles where id = :'a1') is null) as ok \gset
\if :ok \echo PASS leave_family; the last one out removes the empty family \else \echo FAIL leave_family \endif

-- a refusal: the player is told, and can still see who it was for a while
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select public.join_coach(:'ccode'); commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
select public.respond_to_request((select id from public.coach_requests where player_id = :'t1' and status = 'pending'), false); commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true);
select (select count(*) from public.profiles where id = :'c1') as sees, (select count(*) from public.notifications where user_id = :'t1' and kind = 'declined') as told \gset
rollback;
select (:sees = 1 and :told = 1 and (select coach_id from public.profiles where id = :'t1') is null) as ok \gset
\if :ok \echo PASS a declined player is told, stays unlinked, and can still see the coach s name \else \echo FAIL decline sees=:sees told=:told \endif

\echo === 9. delete_my_account cascades, and links held by others are released
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
select public.delete_my_account();
commit;
select (select count(*) from auth.users where id = :'c1') = 0
   and (select count(*) from public.profiles where id = :'c1') = 0
   and (select count(*) from public.lessons where coach_id = :'c1') = 0
   and (select count(*) from public.lesson_media) = 0
   and (select count(*) from public.messages where coach_id = :'c1') = 0
   and (select count(*) from public.coach_requests where coach_id = :'c1') = 0
   and (select count(*) from public.notifications where user_id = :'c1') = 0
   and (select coach_id from public.profiles where id = :'a1') is null
   and (select coach_id from public.profiles where id = :'j1') is null as ok \gset
\if :ok \echo PASS deleting the coach removed their rows, requests and notifications, and unlinked their players \else \echo FAIL coach deletion \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true);
select public.delete_my_account();
commit;
select ((select count(*) from auth.users where id = :'p1') = 0 and (select family_id from public.profiles where id = :'j1') = :'fam1' and (select count(*) from public.families where id = :'fam1') = 1) as ok \gset
\if :ok \echo PASS deleting the parent leaves the junior in the family (it still exists for whoever else joins) \else \echo FAIL parent deletion \endif
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'j1'), true);
select public.delete_my_account();
commit;
select ((select count(*) from public.families where id = :'fam1') = 0) as ok \gset
\if :ok \echo PASS the last member leaving by deletion removes the family \else \echo FAIL family left behind \endif

\echo === 10. a player cancels their own booking, and only that
insert into auth.users (id, email, raw_user_meta_data) values ('77777777-7777-4777-8777-777777777777', 'coach2@example.ie', '{"role":"coach","name":"Second Coach","sport":"golf","account_type":"coach"}');
insert into auth.users (id, email, raw_user_meta_data) values ('88888888-8888-4888-8888-888888888888', 'player2@example.ie', jsonb_build_object('role','player','name','Player Two','sport','golf','account_type','adult','date_of_birth','1995-01-01','coach_code', (select invite_code from public.profiles where id = '77777777-7777-4777-8777-777777777777')));
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true) \gset _
select public.respond_to_request((select id from public.coach_requests where player_id = '88888888-8888-4888-8888-888888888888' and status = 'pending'), true);
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '2026-10-10', '10:00', 45, 'private', 'requested') returning id as bk \gset
with u as (update public.bookings set status = 'cancelled' where id = :'bk' returning id) select count(*) as n1 from u \gset
commit;
\if :n1 \echo PASS a player can cancel their own booking \else \echo FAIL player could not cancel their own booking \endif
select ((select count(*) from public.notifications where user_id = '77777777-7777-4777-8777-777777777777' and kind = 'booking' and title like '%cancelled') = 1) as ok \gset
\if :ok \echo PASS …and the coach is told who cancelled \else \echo FAIL no cancel notification for the coach \endif
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
\set ON_ERROR_STOP off
update public.bookings set status = 'confirmed' where id = :'bk';
\set ON_ERROR_STOP on
rollback;
select (status = 'cancelled') as ok from public.bookings where id = :'bk' \gset
\if :ok \echo PASS a player cannot confirm a booking (the error above is the refusal) \else \echo FAIL player changed a booking to confirmed \endif
\echo === done
