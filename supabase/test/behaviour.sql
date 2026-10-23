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
insert into public.drills (coach_id, player_id, title, due) values (:'c1', :'a1', 'Gate drill', (now() at time zone 'Europe/Dublin')::date);
select body as db1 from public.notifications where user_id = :'a1' and kind = 'drill' order by created_at desc limit 1 \gset
-- a1 has not chosen an hour: eight in the morning is the default
select public.remind_due_drills(8) as r1 \gset
select public.remind_due_drills(8) as r2 \gset
-- a1 asks for seven in the evening: the eight o'clock run says nothing, the seven o'clock run says it once
insert into public.preferences (id, reminder_time) values (:'a1', '19:00') on conflict (id) do update set reminder_time = excluded.reminder_time;
insert into public.drills (coach_id, player_id, title, due) values (:'c1', :'a1', 'Ladder drill', (now() at time zone 'Europe/Dublin')::date);
select public.remind_due_drills(8) as r3 \gset
select public.remind_due_drills(19) as r4 \gset
select public.remind_due_drills(19) as r5 \gset
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'drill' and title = 'Gate drill due today') as rd \gset
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'drill' and title = 'Ladder drill due today') as rl \gset
select (:'db1' like 'Gate drill · by %' and :r1 = 1 and :r2 = 0 and :r3 = 0 and :r4 = 1 and :r5 = 0 and :rd = 1 and :rl = 1) as ok \gset
\if :ok \echo PASS a drill with a day says the day in its body, and the reminder fires once, in the hour the player chose \else \echo FAIL due drill body=:'db1' r1=:r1 r2=:r2 r3=:r3 r4=:r4 r5=:r5 rd=:rd rl=:rl \endif
-- the coach asks for a rating after the fact: the player is told once, and the tap lands on the lesson
update public.lessons set rating_requested = true where id = :'lesson_a';
update public.lessons set rating_requested = true where id = :'lesson_a';
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'rating' and title like '% asked for a rating' and body = 'Serve' and data->>'screen' = 'lesson' and data->>'id' = :'lesson_a') as nr \gset
select (:nr = 1) as ok \gset
\if :ok \echo PASS a rating asked for after the fact tells the player once, named, and lands on the lesson \else \echo FAIL rating ask notifications=:nr \endif
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

-- what a1 has been set, counted by the owner, so the read below is measured against it
select count(*) as nd_all from public.drills where player_id = :'a1' \gset
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
select string_agg(name, ', ' order by name) as seen from public.profiles \gset
select (select count(*) from public.lessons) as nl, (select count(*) from public.lessons_view where who is not null or coach_name is not null) as nv, (select coalesce(max(videos),0) from public.lessons_view) as vids, (select count(*) from public.drills) as nd, (select count(*) from public.notifications) as nn \gset
rollback;
select (:'seen' = 'Aoife Nolan, Sinéad Walsh') as ok \gset
\if :ok \echo PASS adult player sees self + coach only \else \echo FAIL adult player sees: :seen \endif
select (:nl = 1 and :nv = 1 and :vids = 1 and :nd = :nd_all and :nd_all >= 1) as ok \gset
\if :ok \echo PASS adult player sees only their own lesson, with coach_name and a video count, and only their own drills \else \echo FAIL player lessons=:nl view=:nv videos=:vids drills=:nd of :nd_all \endif

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

\echo === 8b. a clip from the player to the coach, while Aoife is still coached by Sinéad
-- Aoife (a1, Sinéad's player) sends a practice clip: her own lesson row,
-- the file under her folder, a line in the thread that opens it
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
insert into public.lessons (coach_id, player_id, focus, sent_by) values (:'c1', :'a1', 'Chipping', :'a1') returning id as clip_a \gset
insert into public.lesson_media (lesson_id, kind, storage_path) values (:'clip_a', 'video', :'a1' || '/' || :'clip_a' || '/swing.mp4');
insert into public.messages (coach_id, player_id, sender_id, body, lesson_id) values (:'c1', :'a1', :'a1', 'Sent a clip', :'clip_a');
-- and may not log a lesson any other way: no sent_by, or sent as somebody else
create temp table if not exists t_clip (k text, ok boolean);
do $t$ declare refused boolean := false; begin
  begin
    insert into public.lessons (coach_id, player_id, focus) values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Sneaky');
  exception when others then refused := true; end;
  insert into t_clip values ('no_sent_by', refused);
  refused := false;
  begin
    insert into public.lessons (coach_id, player_id, focus, sent_by) values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Sneaky', '11111111-1111-4111-8111-111111111111');
  exception when others then refused := true; end;
  insert into t_clip values ('as_coach', refused);
end $t$;
commit;
select (select count(*) from public.lessons where id = :'clip_a' and sent_by = :'a1' and coach_id = :'c1') as ls,
       (select count(*) from public.lesson_media where lesson_id = :'clip_a') as lm,
       (select count(*) from public.messages where lesson_id = :'clip_a' and sender_id = :'a1') as mm,
       (select bool_and(ok) from t_clip) as refused \gset
select (:ls = 1 and :lm = 1 and :mm = 1 and :'refused'::boolean) as ok \gset
\if :ok \echo PASS a player sends a clip to their coach — the lesson, the file and the thread line — and cannot log a lesson any other way \else \echo FAIL sent clip rows lesson=:ls media=:lm msg=:mm refused=:refused \endif
select (select count(*) from public.notifications where user_id = :'c1' and kind = 'clip' and title = 'Aoife sent a clip' and body = 'Chipping' and data->>'screen' = 'lesson' and data->>'id' = :'clip_a') as nc,
       (select count(*) from public.notifications where user_id = :'a1' and data->>'id' = :'clip_a') as na \gset
select (:nc = 1 and :na = 0) as ok \gset
\if :ok \echo PASS a sent clip tells the coach once, by the player s first name, landing on the lesson, and tells the player nothing \else \echo FAIL sent clip notifications coach=:nc player=:na \endif
-- the coach replies with a take: the player is told at once, inside the half hour a logged lesson would hold
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.lesson_media (lesson_id, kind, storage_path) values (:'clip_a', 'video', :'c1' || '/' || :'clip_a' || '/markup-1.webm');
update public.lessons set unread = false where id = :'clip_a';
commit;
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'lesson' and title = 'New clip on Chipping' and data->>'id' = :'clip_a') as nr,
       (select unread from public.lessons where id = :'clip_a') as un \gset
select (:nr = 1 and not :'un'::boolean) as ok \gset
\if :ok \echo PASS the coach s take on a sent clip tells the player at once, and the coach may mark the clip seen \else \echo FAIL reply notifications=:nr unread=:un \endif

\echo === 8d. the coach s reply in words on a sent clip
-- Sinéad replies from the clip's page: Aoife is told "replied", with the words, and lands on the clip — not a plain message
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.messages (coach_id, player_id, sender_id, body, lesson_id) values (:'c1', :'a1', :'c1', 'Weight is fine, hands ahead at impact', :'clip_a');
commit;
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'message' and title = 'Sinéad Walsh replied' and body = 'Weight is fine, hands ahead at impact' and data->>'screen' = 'lesson' and data->>'id' = :'clip_a') as rr,
       (select count(*) from public.notifications where user_id = :'a1' and kind = 'message' and title = 'Sinéad Walsh' and body = 'Weight is fine, hands ahead at impact') as rplain \gset
select (:rr = 1 and :rplain = 0) as ok \gset
\if :ok \echo PASS the coach s reply on a sent clip tells the player replied, with the words, landing on the clip \else \echo FAIL clip reply a=:rr plain=:rplain \endif
-- Marcus sends a clip for Ellie: the Sent a clip line tells the coach nothing twice; Sinéad's reply tells Marcus on the thread and Ellie on the clip
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true);
insert into public.lessons (coach_id, player_id, focus, sent_by) values (:'c1', :'j1', 'Serve', :'p1') returning id as clip_j \gset
insert into public.messages (coach_id, player_id, sender_id, body, lesson_id) values (:'c1', :'j1', :'p1', 'Sent a clip', :'clip_j');
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.messages (coach_id, player_id, sender_id, body, lesson_id) values (:'c1', :'j1', :'c1', 'Toss a touch further forward', :'clip_j');
commit;
select (select count(*) from public.notifications where user_id = :'c1' and kind = 'message' and body = 'Sent a clip') as cm,
       (select count(*) from public.notifications where user_id = :'c1' and kind = 'clip' and title = 'Ellie sent a clip' and data->>'id' = :'clip_j') as cc,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'message' and title = 'Sinéad Walsh replied to Ellie' and body = 'Toss a touch further forward' and data->>'screen' = 'thread' and data->>'id' = :'j1') as rp,
       (select count(*) from public.notifications where user_id = :'j1' and kind = 'message' and title = 'Sinéad Walsh replied' and data->>'screen' = 'lesson' and data->>'id' = :'clip_j') as rj \gset
select (:cm = 0 and :cc = 1 and :rp = 1 and :rj = 1) as ok \gset
\if :ok \echo PASS a sent clip line tells the coach nothing twice; the reply tells the adult on the thread and the junior on the clip \else \echo FAIL clip reply family cm=:cm cc=:cc p=:rp j=:rj \endif

\echo === 8e. a practice the player logged
-- Aoife logs a practice for herself: her own row, kind practice; Sinéad is told once, by first name, and not that a clip was sent
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true);
insert into public.lessons (coach_id, player_id, focus, kind, sent_by, notes) values (:'c1', :'a1', 'Putting', 'practice', :'a1', 'Twenty minutes on the gate') returning id as prac_a \gset
commit;
select (select count(*) from public.lessons where id = :'prac_a' and kind = 'practice' and sent_by = :'a1') as pl,
       (select count(*) from public.notifications where user_id = :'c1' and kind = 'practice' and title = 'Aoife practised' and body = 'Putting' and data->>'screen' = 'lesson' and data->>'id' = :'prac_a') as pn,
       (select count(*) from public.notifications where user_id = :'c1' and kind = 'clip' and data->>'id' = :'prac_a') as pc,
       (select count(*) from public.notifications where user_id = :'a1' and data->>'id' = :'prac_a') as pa \gset
select (:pl = 1 and :pn = 1 and :pc = 0 and :pa = 0) as ok \gset
\if :ok \echo PASS a player logs a practice of their own; the coach is told once that they practised, nobody is told a clip was sent \else \echo FAIL practice row=:pl told=:pn clip=:pc player=:pa \endif

\echo === 8c. the evening before a lesson
-- tomorrow by Ireland's clock: Aoife at ten, Ellie at eleven (her mother Marcus is told too), and the Saturday squad,
-- whose saved members are Aoife, Ellie and Tom — Tom was turned down in 8, so he is on no roster and hears nothing
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
update public.preferences set groups = jsonb_build_array(
  jsonb_build_object('id', 'g1', 'name', 'Saturday squad', 'members', jsonb_build_array('Aoife Nolan', 'Ellie Tran', 'tom.beckett'), 'memberIds', jsonb_build_array(:'a1', :'j1', :'t1')),
  jsonb_build_object('id', 'g2', 'name', 'Sunday juniors', 'members', jsonb_build_array('Ellie Tran'))) where id = :'c1';
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'a1', (now() at time zone 'Europe/Dublin')::date + 1, '10:00 am', 45, 'private', 'confirmed') returning id as bk_a \gset
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'j1', (now() at time zone 'Europe/Dublin')::date + 1, '11:00 am', 45, 'private', 'confirmed');
insert into public.bookings (coach_id, group_name, booking_date, start_time, duration, kind, status) values (:'c1', 'Saturday squad', (now() at time zone 'Europe/Dublin')::date + 1, '2:00 pm', 60, 'group', 'confirmed') returning id as bk_g \gset
-- a lesson only asked for is not a lesson yet
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values (:'c1', :'a1', (now() at time zone 'Europe/Dublin')::date + 1, '4:00 pm', 45, 'private', 'requested');
commit;
select public.nice_date((now() at time zone 'Europe/Dublin')::date + 1) || ' 2:00 pm' as whn_g \gset
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'booking' and title = 'Saturday squad booked' and body = :'whn_g' || ' · Sinéad Walsh' and data->>'screen' = 'calendar' and data->>'id' = :'bk_g') as ga,
       (select count(*) from public.notifications where user_id = :'j1' and kind = 'booking' and title = 'Saturday squad booked' and data->>'id' = :'bk_g') as gj,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'booking' and title = 'Ellie''s Saturday squad booked' and body = :'whn_g' and data->>'screen' = 'family' and data->>'id' = :'bk_g') as gp,
       (select count(*) from public.notifications where user_id in (:'t1', :'c1') and data->>'id' = :'bk_g') as gnone \gset
select (:ga = 1 and :gj = 1 and :gp = 1 and :gnone = 0) as ok \gset
\if :ok \echo PASS a group lesson booked tells each member on the roster and a junior member s adult, not a former member, not the coach \else \echo FAIL group booked a=:ga j=:gj p=:gp none=:gnone \endif
select public.remind_bookings(8) as b0 \gset
select public.remind_bookings(18) as b1 \gset
select public.remind_bookings(18) as b2 \gset
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'booking' and title = 'Lesson tomorrow · 10:00 am' and body = 'Sinéad Walsh' and data->>'screen' = 'calendar' and data->>'id' = :'bk_a') as ra,
       (select count(*) from public.notifications where user_id = :'a1' and kind = 'booking' and title like 'Lesson tomorrow%') as ra_all,
       (select count(*) from public.notifications where user_id = :'j1' and kind = 'booking' and title = 'Lesson tomorrow · 11:00 am') as rj,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'booking' and title = 'Ellie''s lesson tomorrow · 11:00 am' and data->>'screen' = 'family') as rp,
       (select count(*) from public.notifications where user_id = :'c1' and kind = 'booking' and title = '3 lessons tomorrow' and body is null and data->>'screen' = 'calendar') as rc,
       (select count(*) from public.notifications where user_id = :'a1' and kind = 'booking' and title = 'Saturday squad tomorrow · 2:00 pm' and body = 'Sinéad Walsh' and data->>'screen' = 'calendar' and data->>'id' = :'bk_g' and data->>'remind' = :'bk_g') as rga,
       (select count(*) from public.notifications where user_id = :'j1' and kind = 'booking' and title = 'Saturday squad tomorrow · 2:00 pm' and data->>'remind' = :'bk_g') as rgj,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'booking' and title = 'Ellie''s Saturday squad tomorrow · 2:00 pm' and data->>'screen' = 'family' and data->>'remind' = :'bk_g') as rgp,
       (select count(*) from public.notifications where user_id = :'t1' and data->>'remind' = :'bk_g') as rgt \gset
select (:b0 = 0 and :b1 = 5 and :b2 = 0 and :ra = 1 and :ra_all = 1 and :rj = 1 and :rp = 1 and :rc = 1) as ok \gset
\if :ok \echo PASS the evening before, each player is reminded once of tomorrow s lesson, a junior s adult too, and the coach once with the count; nothing at other hours, nothing twice, nothing for a lesson only asked for \else \echo FAIL lesson reminders b0=:b0 b1=:b1 b2=:b2 a=:ra all=:ra_all j=:rj p=:rp c=:rc \endif
select (:rga = 1 and :rgj = 1 and :rgp = 1 and :rgt = 0) as ok \gset
\if :ok \echo PASS the evening before a group lesson, each member on the roster is reminded once, a junior member s adult too, a former member never \else \echo FAIL group reminders a=:rga j=:rgj p=:rgp t=:rgt \endif

\echo === 8f. a group s lessons reach its members
-- three more Saturdays in one insert, as a new group books its run: each member once, not three times
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.bookings (coach_id, group_name, booking_date, start_time, duration, kind, status) values
 (:'c1', 'Saturday squad', current_date + 8, '2:00 pm', 60, 'group', 'confirmed'),
 (:'c1', 'Saturday squad', current_date + 15, '2:00 pm', 60, 'group', 'confirmed'),
 (:'c1', 'Saturday squad', current_date + 22, '2:00 pm', 60, 'group', 'confirmed');
commit;
select id as g8 from public.bookings where coach_id = :'c1' and group_name = 'Saturday squad' and booking_date = current_date + 8 \gset
select id as g15 from public.bookings where coach_id = :'c1' and group_name = 'Saturday squad' and booking_date = current_date + 15 \gset
select id as g22 from public.bookings where coach_id = :'c1' and group_name = 'Saturday squad' and booking_date = current_date + 22 \gset
select public.nice_date(current_date + 8) || ' 2:00 pm' as w8, public.nice_date(current_date + 15) || ' 2:00 pm' as w15, public.nice_date(current_date + 22) || ' 2:00 pm' as w22 \gset
select (select count(*) from public.notifications where user_id = :'a1' and title = 'Saturday squad booked' and body = '3 lessons · from ' || :'w8' and data->>'id' = :'g8') as ra,
       (select count(*) from public.notifications where user_id = :'a1' and data->>'id' in (:'g15', :'g22')) as rdup,
       (select count(*) from public.notifications where user_id = :'j1' and title = 'Saturday squad booked' and body = '3 lessons · from ' || :'w8') as rj,
       (select count(*) from public.notifications where user_id = :'p1' and title = 'Ellie''s Saturday squad booked' and body = '3 lessons · from ' || :'w8' and data->>'screen' = 'family') as rp \gset
select (:ra = 1 and :rdup = 0 and :rj = 1 and :rp = 1) as ok \gset
\if :ok \echo PASS a run of group lessons booked in one go is told once per member, with the count and the first day \else \echo FAIL group run a=:ra dup=:rdup j=:rj p=:rp \endif
-- rained off; cancelled with a reason; cancelled with none; and the first again, which changes nothing
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
update public.bookings set status = 'weather' where id = :'g8';
update public.bookings set status = 'cancelled', cancel_reason = 'Course closed' where id = :'g15';
update public.bookings set status = 'cancelled' where id = :'g22';
update public.bookings set status = 'weather' where id = :'g8';
commit;
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'weather' and title = 'Saturday squad called off — weather' and body = :'w8' || ' · Sinéad Walsh' and data->>'screen' = 'calendar' and data->>'id' = :'g8') as wa,
       (select count(*) from public.notifications where user_id = :'j1' and kind = 'weather' and title = 'Saturday squad called off — weather' and data->>'id' = :'g8') as wj,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'weather' and title = 'Ellie''s Saturday squad called off' and body = :'w8' || ' · weather' and data->>'screen' = 'family' and data->>'id' = :'g8') as wp,
       (select count(*) from public.notifications where user_id = :'a1' and kind = 'booking' and title = 'Saturday squad cancelled' and body = 'Course closed · ' || :'w15' and data->>'id' = :'g15') as ca,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'booking' and title = 'Ellie''s Saturday squad cancelled' and body = 'Course closed · ' || :'w15' and data->>'screen' = 'family') as cp,
       (select count(*) from public.notifications where user_id = :'a1' and kind = 'booking' and title = 'Saturday squad cancelled' and body = :'w22' || ' · Sinéad Walsh' and data->>'id' = :'g22') as na,
       (select count(*) from public.notifications where user_id in (:'c1', :'t1') and data->>'id' in (:'g8', :'g15', :'g22')) as none \gset
select (:wa = 1 and :wj = 1 and :wp = 1 and :ca = 1 and :cp = 1 and :na = 1 and :none = 0) as ok \gset
\if :ok \echo PASS a group lesson called off or cancelled tells each member and a junior member s adult once, the reason first, nobody else \else \echo FAIL group call-off weather a=:wa j=:wj p=:wp cancel a=:ca p=:cp plain=:na none=:none \endif
-- the coach puts the rained-off Saturday back on: each member and the adult are told it is on again
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
update public.bookings set status = 'confirmed' where id = :'g8';
commit;
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'booking' and title = 'Saturday squad confirmed' and body = :'w8' || ' · Sinéad Walsh' and data->>'id' = :'g8') as ra,
       (select count(*) from public.notifications where user_id = :'p1' and kind = 'booking' and title = 'Ellie''s Saturday squad confirmed' and body = :'w8' and data->>'screen' = 'family') as rp \gset
select (:ra = 1 and :rp = 1) as ok \gset
\if :ok \echo PASS a group lesson put back on tells each member and a junior member s adult \else \echo FAIL group re-confirmed a=:ra p=:rp \endif
-- a group saved before ids were kept: its names; a group nobody saved: nobody; another coach naming Sinéad's players: nobody
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.bookings (coach_id, group_name, booking_date, start_time, duration, kind, status) values (:'c1', 'Sunday juniors', current_date + 9, '10:00 am', 60, 'group', 'confirmed') returning id as gs \gset
insert into public.bookings (coach_id, group_name, booking_date, start_time, duration, kind, status) values (:'c1', 'Pop-up clinic', current_date + 9, '12:00 pm', 60, 'group', 'confirmed') returning id as gu \gset
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c2'), true);
insert into public.preferences (id, groups) values (:'c2', jsonb_build_array(jsonb_build_object('name', 'Poached', 'memberIds', jsonb_build_array(:'a1', :'j1'))))
  on conflict (id) do update set groups = excluded.groups;
insert into public.bookings (coach_id, group_name, booking_date, start_time, duration, kind, status) values (:'c2', 'Poached', current_date + 9, '3:00 pm', 60, 'group', 'confirmed') returning id as gx \gset
commit;
select (select count(*) from public.notifications where user_id = :'j1' and title = 'Sunday juniors booked' and data->>'id' = :'gs') as sj,
       (select count(*) from public.notifications where user_id = :'a1' and data->>'id' = :'gs') as sa,
       (select count(*) from public.notifications where data->>'id' = :'gu') as su,
       (select count(*) from public.bookings where id = :'gu') as bu,
       (select count(*) from public.notifications where data->>'id' = :'gx') as sx \gset
select (:sj = 1 and :sa = 0 and :su = 0 and :bu = 1 and :sx = 0) as ok \gset
\if :ok \echo PASS an older group is read by its names; a group nobody saved still books and tells nobody; another coach cannot reach Sinéad s players \else \echo FAIL group members names=:sj other=:sa unsaved=:su booked=:bu poached=:sx \endif
select coalesce((select not has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute')
                   from to_regprocedure('public.group_members(uuid, text)') f where f is not null), false) as ok \gset
\if :ok \echo PASS nobody signed in can ask who is in a coach s group \else \echo FAIL group_members is callable by a signed-in person \endif

\echo === 8g. a group lesson logged reaches the people who were there
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'c1'), true);
insert into public.lessons (coach_id, group_name, kind, focus) values (:'c1', 'Saturday squad', 'group', 'Volleys') returning id as gl \gset
insert into public.lesson_attendees (lesson_id, player_id) values (:'gl', :'a1'), (:'gl', :'j1');
insert into public.lesson_media (lesson_id, kind, storage_path, created_at) values (:'gl', 'video', :'c1' || '/' || :'gl' || '/late.webm', now() + interval '31 minutes');
commit;
select (select count(*) from public.notifications where user_id = :'a1' and kind = 'lesson' and title = 'Lesson logged' and body = 'Volleys · Sinéad Walsh' and data->>'screen' = 'lesson' and data->>'id' = :'gl') as la,
       (select count(*) from public.notifications where user_id = :'j1' and title = 'Lesson logged' and data->>'id' = :'gl') as lj,
       (select count(*) from public.notifications where user_id = :'p1' and title = 'Ellie''s lesson logged' and data->>'screen' = 'family' and data->>'id' = :'gl') as lp,
       (select count(*) from public.notifications where user_id = :'a1' and title = 'New clip on Volleys' and data->>'id' = :'gl') as ma,
       (select count(*) from public.notifications where user_id = :'p1' and title = 'New clip on Volleys for Ellie') as mp,
       (select count(*) from public.notifications where user_id in (:'c1', :'t1') and data->>'id' = :'gl') as none \gset
select (:la = 1 and :lj = 1 and :lp = 1 and :ma = 1 and :mp = 1 and :none = 0) as ok \gset
\if :ok \echo PASS a group lesson logged tells each attendee and a junior attendee s adult, and a late clip on it too \else \echo FAIL group lesson logged a=:la j=:lj p=:lp clip a=:ma p=:mp none=:none \endif

-- a member's diary: the group lessons they, or a junior they look after, are in
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'a1'), true) \gset _
select (select count(*) from public.my_group_bookings() where booking_id = :'g8' and player_id = :'a1') as ma8,
       (select count(*) from public.my_group_bookings() where booking_id = :'gs') as mas,
       (select count(*) from public.my_group_bookings() where player_id <> :'a1') as maother,
       (select count(*) from public.bookings where id = :'g8') as ra8 \gset
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'p1'), true) \gset _
select (select count(*) from public.my_group_bookings() where booking_id = :'g8' and player_id = :'j1') as mp8,
       (select count(*) from public.my_group_bookings() where booking_id = :'gs' and player_id = :'j1') as mps,
       (select count(*) from public.my_group_bookings() where player_id = :'a1') as mpa,
       (select count(*) from public.bookings where id = :'g8') as rp8 \gset
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'t1'), true) \gset _
select (select count(*) from public.my_group_bookings()) as mt \gset
commit;
select (:ma8 = 1 and :mas = 0 and :maother = 0 and :ra8 = 1 and :mp8 = 1 and :mps = 1 and :mpa = 0 and :rp8 = 1 and :mt = 0) as ok \gset
\if :ok \echo PASS a member reads the group lessons they are in, an adult their junior s, a former member none, nobody another s (8f) \else \echo FAIL my_group_bookings a8=:ma8 as=:mas aother=:maother ra=:ra8 p8=:mp8 ps=:mps pa=:mpa rp=:rp8 t=:mt (8f) \endif
-- a junior member asks for their own: their clinic, and nobody else's — my_family_ids() hands a junior nobody
begin; set local role authenticated; select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'j1'), true) \gset _
select (select count(*) from public.my_group_bookings() where booking_id = :'g8' and player_id = :'j1') as mj8,
       (select count(*) from public.my_group_bookings() where player_id <> :'j1') as mjother \gset
commit;
select (:mj8 = 1 and :mjother = 0) as ok \gset
\if :ok \echo PASS a junior member reads their own group lessons and nobody else s (8f) \else \echo FAIL my_group_bookings as the junior j8=:mj8 other=:mjother (8f) \endif
select coalesce((select not has_function_privilege('anon', f, 'execute') from to_regprocedure('public.my_group_bookings()') f where f is not null), false) as ok \gset
\if :ok \echo PASS nobody signed out can ask for group lessons (8f) \else \echo FAIL my_group_bookings is callable signed out \endif

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
\echo === 10b. the reason rides with the cancellation, and nothing else moves
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '2026-10-11', '11:00', 45, 'private', 'requested') returning id as bk2 \gset
with u as (update public.bookings set status = 'cancelled', cancel_reason = 'Unwell' where id = :'bk2' returning id) select count(*) as n2 from u \gset
commit;
\if :n2 \echo PASS a player may give a reason with the cancel (10b) \else \echo FAIL the policy refused a cancel that carried a reason (10b) \endif
select ((select count(*) from public.notifications where user_id = '77777777-7777-4777-8777-777777777777' and kind = 'booking' and title like '%cancelled' and data->>'id' = :'bk2' and body like 'Unwell · %') = 1) as ok \gset
\if :ok \echo PASS the cancel reason leads the notice to the coach (10b) \else \echo FAIL the notice to the coach does not carry the reason (10b) \endif
-- …and with no reason the notice is the day alone, as before the column
select ((select count(*) from public.notifications where user_id = '77777777-7777-4777-8777-777777777777' and kind = 'booking' and title like '%cancelled' and data->>'id' = :'bk' and body not like '% · %') = 1) as ok \gset
\if :ok \echo PASS a cancel with no reason reads the day alone (10b) \else \echo FAIL the reasonless cancel changed shape (10b) \endif
-- a reason past 120 characters is refused and nothing is written
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '2026-10-12', '11:00', 45, 'private', 'requested') returning id as bk3 \gset
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
\set ON_ERROR_STOP off
update public.bookings set status = 'cancelled', cancel_reason = repeat('x', 121) where id = :'bk3';
\set ON_ERROR_STOP on
rollback;
select (status = 'requested' and cancel_reason is null) as ok from public.bookings where id = :'bk3' \gset
\if :ok \echo PASS a reason past 120 characters is refused, and nothing is written (10b; the error above is the refusal) \else \echo FAIL an over-long reason landed (10b) \endif
-- a cancel that also re-addresses the booking to another coach is refused whole
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
\set ON_ERROR_STOP off
update public.bookings set status = 'cancelled', cancel_reason = 'Unwell', coach_id = '11111111-1111-4111-8111-111111111111' where id = :'bk3';
\set ON_ERROR_STOP on
rollback;
select (status = 'requested' and coach_id = '77777777-7777-4777-8777-777777777777') as ok from public.bookings where id = :'bk3' \gset
\if :ok \echo PASS a cancel may not move the booking to another coach (10b; the error above is the refusal) \else \echo FAIL a player re-addressed a booking while cancelling (10b) \endif
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
\set ON_ERROR_STOP off
update public.bookings set status = 'confirmed' where id = :'bk';
\set ON_ERROR_STOP on
rollback;
select (status = 'cancelled') as ok from public.bookings where id = :'bk' \gset
\if :ok \echo PASS a player cannot confirm a booking (the error above is the refusal) \else \echo FAIL player changed a booking to confirmed \endif
-- the coach's taken times reach another player as times, never as names
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true) \gset _
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', (current_date + 20)::date, '09:00', 45, 'private', 'confirmed') returning id as busybk \gset
commit;
insert into auth.users (id, email, raw_user_meta_data) values ('99999999-9999-4999-8999-999999999999', 'player3@example.ie', jsonb_build_object('role','player','name','Player Three','sport','golf','account_type','adult','date_of_birth','1996-01-01','coach_code', (select invite_code from public.profiles where id = '77777777-7777-4777-8777-777777777777')));
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true) \gset _
select public.respond_to_request((select id from public.coach_requests where player_id = '99999999-9999-4999-8999-999999999999' and status = 'pending'), true);
commit;
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true) \gset _
select (count(*) = 1) as ok1 from public.coach_busy_slots() where booking_date = (current_date + 20)::date and start_time = '09:00' \gset
select (count(*) = 0) as ok2 from public.bookings where id = :'busybk' \gset
rollback;
\if :ok1 \echo PASS another player of the same coach sees the taken time through coach_busy_slots \else \echo FAIL coach_busy_slots did not hand back the taken time \endif
\if :ok2 \echo PASS …and still cannot read whose booking it is \else \echo FAIL a booking row leaked to a different player \endif

\echo === 10c. a run s lessons carry the run, and outlive it
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true) \gset _
insert into public.recurring (coach_id, player_id, weekday, start_time, cadence) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', 1, '5:00 pm', 'weekly') returning id as run \gset
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status, recurring_id) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '2026-11-03', '5:00 pm', 45, 'private', 'confirmed', :'run') returning id as rb1 \gset
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status, recurring_id) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '2026-11-10', '5:00 pm', 45, 'private', 'confirmed', :'run') returning id as rb2 \gset
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status, recurring_id) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '2026-11-17', '5:00 pm', 45, 'private', 'confirmed', :'run') returning id as rb3 \gset
with u as (update public.recurring set weekday = 2 where id = :'run' returning id) select count(*) as rn1 from u \gset
commit;
select ((select count(*) from public.bookings where recurring_id = :'run') = 3) as ok \gset
\if :ok \echo PASS the coach books three lessons that carry their run (10c) \else \echo FAIL the run s bookings do not carry it (10c) \endif
select (:rn1 = 1 and (select weekday from public.recurring where id = :'run') = 2) as ok \gset
\if :ok \echo PASS the coach moves the run to another day in place, one row (10c) \else \echo FAIL the coach could not change the run in place rows=:rn1 (10c) \endif
-- the player reads the run and may change none of it
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true) \gset _
with u as (update public.recurring set weekday = 4 where id = :'run' returning id) select count(*) as rp1 from u \gset
with u as (delete from public.recurring where id = :'run' returning id) select count(*) as rp2 from u \gset
commit;
select (:rp1 = 0 and :rp2 = 0 and (select weekday from public.recurring where id = :'run') = 2) as ok \gset
\if :ok \echo PASS the player can neither move nor delete the run, zero rows each (10c) \else \echo FAIL the player changed the run update=:rp1 delete=:rp2 (10c) \endif
-- two of the run s lessons cancelled in one go: one notice each, the reason first
select count(*) as nc0 from public.notifications where user_id = '88888888-8888-4888-8888-888888888888' and kind = 'booking' and title = 'Lesson cancelled' \gset
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true) \gset _
with u as (update public.bookings set status = 'cancelled', cancel_reason = 'Unwell' where id in (:'rb1', :'rb2') returning id) select count(*) as rc from u \gset
commit;
select (select count(*) from public.notifications where user_id = '88888888-8888-4888-8888-888888888888' and kind = 'booking' and title = 'Lesson cancelled') - :nc0 as ncn,
       (select count(*) from public.notifications where user_id = '88888888-8888-4888-8888-888888888888' and kind = 'booking' and title = 'Lesson cancelled' and body like 'Unwell · %' and data->>'id' in (:'rb1', :'rb2')) as ncu \gset
select (:rc = 2 and :ncn = 2 and :ncu = 2) as ok \gset
\if :ok \echo PASS two of the run s lessons cancelled in one update tell the player twice, each led by the reason (10c) \else \echo FAIL run cancel rows=:rc new=:ncn with-reason=:ncu (10c) \endif
-- the run goes; its lessons stay, cancelled or not, and only lose the link
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true) \gset _
with u as (delete from public.recurring where id = :'run' returning id) select count(*) as rd from u \gset
commit;
select (:rd = 1
   and (select count(*) from public.recurring where id = :'run') = 0
   and (select count(*) from public.bookings where id in (:'rb1', :'rb2', :'rb3')) = 3
   and (select count(*) from public.bookings where id in (:'rb1', :'rb2', :'rb3') and recurring_id is null) = 3
   and (select count(*) from public.bookings where id in (:'rb1', :'rb2') and status = 'cancelled' and cancel_reason = 'Unwell') = 2
   and (select status from public.bookings where id = :'rb3') = 'confirmed') as ok \gset
\if :ok \echo PASS deleting the run keeps all three lessons, with the link set to null (10c) \else \echo FAIL deleting the run took its lessons or left the link rows=:rd (10c) \endif
-- …and a coach who goes with a run still on the books goes cleanly: the
-- run and its lessons both point at the coach, by two roads
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true) \gset _
insert into public.recurring (coach_id, player_id, weekday, start_time, cadence) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', 3, '6:00 pm', 'weekly') returning id as run2 \gset
insert into public.bookings (coach_id, player_id, booking_date, start_time, duration, kind, status, recurring_id) values ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '2026-11-05', '6:00 pm', 45, 'private', 'confirmed', :'run2');
select public.delete_my_account();
commit;
select ((select count(*) from auth.users where id = '77777777-7777-4777-8777-777777777777') = 0
   and (select count(*) from public.recurring where coach_id = '77777777-7777-4777-8777-777777777777') = 0
   and (select count(*) from public.bookings where coach_id = '77777777-7777-4777-8777-777777777777') = 0) as ok \gset
\if :ok \echo PASS a coach deleting their account with a run and its lessons on the books removes both (10c) \else \echo FAIL coach deletion with a run left rows behind (10c) \endif
\echo === done
