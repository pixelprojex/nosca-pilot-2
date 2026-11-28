#!/usr/bin/env bash
# Proves nosca.sql on a real Postgres before it goes anywhere near Supabase.
#
#   supabase/test/run.sh            needs PostgreSQL 16 binaries (initdb, pg_ctl, psql)
#
# It starts a throwaway cluster, loads a Supabase-shaped fixture (the
# anon/authenticated roles, an auth schema with auth.uid(), a storage
# schema owned by someone else, and a non-superuser owner that bypasses
# row-level security like the dashboard does), then:
#   1. runs nosca.sql on an empty project
#   2. runs it again — must change nothing
#   3. runs behaviour.sql — sign-ups through the trigger, codes both ways,
#      what each role can read, the join/leave functions, deletion
#   4. runs the old schema.sql from git history first, then nosca.sql —
#      the upgrade path an existing project takes
# Every check prints PASS or FAIL. Anything but all-PASS is a bug in nosca.sql.
# An upgrade path whose commit this clone does not have prints NOT RUN.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl || echo /usr/lib/postgresql/16/bin/pg_ctl)")}"
[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL binaries not found (set PGBIN)"; exit 2; }
D="$(mktemp -d /tmp/nosca-pg.XXXX)"; PORT=54329
RUNAS=""; if [ "$(id -u)" = "0" ]; then chown nobody "$D"; RUNAS="runuser -u nobody --"; fi
cleanup() { $RUNAS "$PGBIN/pg_ctl" -D "$D/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT
$RUNAS "$PGBIN/initdb" -D "$D/data" -U super --auth=trust -E UTF8 >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$D/data" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" start >/dev/null
sleep 1
PS="psql -h $D -p $PORT -U super -q -v ON_ERROR_STOP=1"; PU="psql -h $D -p $PORT -U supa -q -v ON_ERROR_STOP=1"
# One true/false query on stdin becomes a PASS or FAIL line, and a FAIL
# fails the run — the upgrade-path checks used to print FAIL and exit 0.
extra=0; VDB=fresh
verdict() { local r; r=$($PU -d "$VDB" -tA); if [ "$r" = "t" ]; then echo "PASS $1"; else echo "FAIL $2"; extra=$((extra+1)); fi; }
# A behaviour.sql run must reach its last line. One that stops part-way
# (an error under ON_ERROR_STOP) prints fewer checks, not a FAIL, so the
# end marker is a check of its own, and its absence names the error.
ended() { if grep -qx "=== done" <<<"$1"; then echo "PASS behaviour.sql ran to the end ($2)"
  else echo "FAIL behaviour.sql stopped part-way ($2): $({ grep "ERROR" <<<"$1" || echo "$1"; } | tail -1)"; extra=$((extra+1)); fi; }
$PS -d postgres -f "$HERE/fixture.sql"
grep -v "^create role\|^grant anon, authenticated, service_role to supa" "$HERE/fixture.sql" > "$D/fixture-db.sql"
for db in fresh upgrade; do createdb -h "$D" -p $PORT -U super -O supa $db; $PS -d $db -f "$D/fixture-db.sql"; done
echo "== fresh project: nosca.sql"; $PU -d fresh --single-transaction -f "$ROOT/supabase/nosca.sql" | tail -3
echo "== again (must be a no-op)"; $PU -d fresh --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null && echo ok
echo "== behaviour"; fresh=$($PU -d fresh -f "$HERE/behaviour.sql" 2>&1 || true); echo "$fresh" | grep -E "^(PASS|FAIL)" || true
ended "$fresh" "fresh project"
echo "== upgrade path: old schema.sql, then nosca.sql"
if git -C "$ROOT" cat-file -e b164831:supabase/schema.sql 2>/dev/null; then
  git -C "$ROOT" show b164831:supabase/schema.sql | $PU -d upgrade -f - >/dev/null 2>&1 || true
else echo "NOT RUN the old schema.sql: b164831 is not in this clone (git fetch --unshallow) — nosca.sql and behaviour.sql below run on an empty project"; fi
# the same behaviour checks on the upgraded project — and a FAIL here
# fails the run too: for a day one printed under a "uniq -c" count and
# was never added up
$PU -d upgrade --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null
up=$($PU -d upgrade -f "$HERE/behaviour.sql" 2>&1 || true); echo "$up" | grep -E "^(PASS|FAIL)" | sort | uniq -c | sort -rn | sed -n 1,3p
echo "$up" | grep "^FAIL" || true; extra=$((extra + $(echo "$up" | grep -c "^FAIL" || true)))
ended "$up" "upgrade path"
echo "== upgrade path: the previous nosca.sql with a guardian-linked family, then this one"
createdb -h "$D" -p $PORT -U super -O supa prev; $PS -d prev -f "$D/fixture-db.sql"
if git -C "$ROOT" show 51ca5a2:supabase/nosca.sql > "$D/prev.sql" 2>/dev/null; then
  $PU -d prev --single-transaction -f "$D/prev.sql" >/dev/null 2>&1
  $PU -d prev >/dev/null <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111', 'c@x.ie', '{"role":"coach","name":"Coach","sport":"golf","account_type":"coach"}'),
 ('33333333-3333-4333-8333-333333333333', 'p@x.ie', '{"role":"player","name":"Parent","sport":"golf","account_type":"parent"}');
insert into auth.users (id, email, raw_user_meta_data) values
 ('44444444-4444-4444-8444-444444444444', 'j@x.ie', jsonb_build_object('role','player','name','Kid','sport','golf','account_type','junior','date_of_birth','2012-05-05','family_code',(select family_code from public.profiles where id='33333333-3333-4333-8333-333333333333'),'coach_code',(select invite_code from public.profiles where id='11111111-1111-4111-8111-111111111111')));
SQL
  $PU -d prev --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null 2>&1
  VDB=prev verdict "a guardian link became a family the parent created, with the child in it and the coach kept" "guardian → family migration" <<'SQL'
select (select count(*) from public.families) = 1
   and (select family_id from public.profiles where id='44444444-4444-4444-8444-444444444444') = (select family_id from public.profiles where id='33333333-3333-4333-8333-333333333333')
   and (select coach_id from public.profiles where id='44444444-4444-4444-8444-444444444444') = '11111111-1111-4111-8111-111111111111'
   and (select created_by from public.families limit 1) = '33333333-3333-4333-8333-333333333333'
   and not exists (select 1 from information_schema.columns where table_name='profiles' and column_name in ('guardian_id','family_code'));
SQL
else echo "NOT RUN the guardian → family migration: 51ca5a2 is not in this clone (git fetch --unshallow)"; fi
echo "== upgrade path: a push trigger written by hand, then nosca.sql"
createdb -h "$D" -p $PORT -U super -O supa handmade; $PS -d handmade -f "$D/fixture-db.sql"
$PU -d handmade --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null 2>&1
# what the founder had before section 10b existed: the URL and the secret
# typed into the function body, under a trigger of their own naming
$PU -d handmade <<'SQL' >/dev/null 2>&1
drop trigger if exists notifications_push on public.notifications;
delete from public.app_settings;
create or replace function public.notify_push() returns trigger language plpgsql security definer as $hand$
begin
  perform net.http_post(url := 'https://nosca.example/.netlify/functions/push',
    headers := jsonb_build_object('Content-Type','application/json','x-nosca-secret','s3cret-typed-by-hand'),
    body := to_jsonb(NEW));
  return NEW;
end;
$hand$;
create trigger on_notification_insert after insert on public.notifications
  for each row execute function public.notify_push();
SQL
# pg_net, as far as the trigger can tell: a net schema with an http_post
# that writes down what it was asked to send. Without it nosca.sql leaves
# the trigger off, and a broken notify_push() passes by never running —
# which is how one that called a function that did not exist, and then
# one with an ambiguous variable name, both passed this suite while every
# phone stayed quiet.
$PU -d handmade <<'SQL' >/dev/null 2>&1
create schema if not exists net;
create table if not exists net.sent (url text, headers jsonb, body jsonb);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
                                         headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $stub$
begin insert into net.sent values (url, headers, body); return (select count(*) from net.sent); end
$stub$;
SQL
$PU -d handmade --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null 2>&1
VDB=handmade
verdict "a hand-written push trigger kept its URL and secret, and fires once" "hand-written push trigger was replaced by an unconfigured one" <<'SQL'
select (select value from public.app_settings where key='push_url') = 'https://nosca.example/.netlify/functions/push'
   and (select value from public.app_settings where key='push_secret') = 's3cret-typed-by-hand'
   and (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
        where c.relname='notifications' and not t.tgisinternal) = 1;
SQL
# and it must actually send: one notification in, one request out, to the
# URL that was typed in, carrying the secret and the row
$PU -d handmade >/dev/null 2>&1 <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
 ('55555555-5555-4555-8555-555555555555', 'push@x.ie', '{"role":"coach","name":"Push","sport":"golf","account_type":"coach"}');
insert into public.notifications (user_id, kind, title, body, data)
 values ('55555555-5555-4555-8555-555555555555', 'lesson', 'Lesson logged', 'Short game', '{"screen":"lessons"}');
SQL
verdict "a notification enqueues exactly one push request, with the secret and the row" "a notification did not reach net.http_post (notify_push is silently failing)" <<'SQL'
select (select count(*) from net.sent) = 1
   and (select url from net.sent limit 1) = 'https://nosca.example/.netlify/functions/push'
   and (select headers->>'x-nosca-secret' from net.sent limit 1) = 's3cret-typed-by-hand'
   and (select body->>'title' from net.sent limit 1) = 'Lesson logged'
   and (select body->>'user_id' from net.sent limit 1) = '55555555-5555-4555-8555-555555555555';
SQL

# A FINISHED IMPORT IS ONE PUSH PER PERSON TOLD. 80 lessons and 300 files
# in two waves, then done: one request for an adult player, two for a
# junior with one adult — never one per lesson or per file — and a
# removal one per person told. The same stub as above counts them.
$PU -d handmade >/dev/null 2>&1 <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
 ('61616161-6161-4161-8161-616161616161', 'imp.coach@x.ie', '{"role":"coach","name":"Imp Coach","sport":"golf","account_type":"coach"}'),
 ('62626262-6262-4262-8262-626262626262', 'imp.adult@x.ie', '{"role":"player","name":"Imp Adult","sport":"golf","account_type":"adult","date_of_birth":"1990-01-01"}'),
 ('63636363-6363-4363-8363-636363636363', 'imp.parent@x.ie', '{"role":"player","name":"Imp Parent","sport":"golf","account_type":"parent","date_of_birth":"1980-01-01"}');
insert into auth.users (id, email, raw_user_meta_data) values
 ('64646464-6464-4464-8464-646464646464', 'imp.kid@x.ie', jsonb_build_object('role','player','name','Imp Kid','sport','golf','account_type','junior','date_of_birth','2014-01-01',
   'family_code', (select f.code from public.families f join public.profiles p on p.family_id = f.id where p.id = '63636363-6363-4363-8363-636363636363')));
update public.profiles set coach_id = '61616161-6161-4161-8161-616161616161' where id in ('62626262-6262-4262-8262-626262626262', '64646464-6464-4464-8464-646464646464');
create table public.t_sent (k text primary key, n int);
do $t$
declare pl uuid; b uuid; c int; w jsonb; ls jsonb; who text;
begin
  foreach who in array array['adult', 'kid'] loop
    pl := case who when 'adult' then '62626262-6262-4262-8262-626262626262'::uuid else '64646464-6464-4464-8464-646464646464'::uuid end;
    b := gen_random_uuid();
    perform set_config('request.jwt.claims', '{"sub":"61616161-6161-4161-8161-616161616161","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.import_begin(b, pl, 'golf');
    execute 'reset role';
    -- 80 days, 300 files: four a day for the first 60, three for the last 20, every one uploaded
    select jsonb_agg(jsonb_build_object('day', (current_date - 400 + d)::text, 'focus', 'Putting', 'files',
             (select jsonb_agg(jsonb_build_object('path', 'import/' || b || '/' || gen_random_uuid() || '.jpg', 'kind', 'photo',
                                                  'hash', encode(sha256(convert_to(who || d || '-' || k, 'UTF8')), 'hex')))
                from generate_series(1, case when d <= 60 then 4 else 3 end) k)) order by d) into ls
      from generate_series(1, 80) d;
    insert into storage.objects (bucket_id, name) select 'media', f->>'path' from jsonb_array_elements(ls) l, jsonb_array_elements(l->'files') f;
    select count(*) into c from net.sent;
    perform set_config('request.jwt.claims', '{"sub":"61616161-6161-4161-8161-616161616161","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.import_lessons(b, (select jsonb_agg(x) from jsonb_array_elements(ls) with ordinality t(x, i) where i <= 50), false);
    perform public.import_lessons(b, (select jsonb_agg(x) from jsonb_array_elements(ls) with ordinality t(x, i) where i > 50), false);
    perform public.import_lessons(b, '[]'::jsonb, true);
    execute 'reset role';
    insert into public.t_sent values (who, (select count(*) from net.sent) - c);
    if who = 'adult' then
      select count(*) into c from net.sent;
      perform set_config('request.jwt.claims', '{"sub":"61616161-6161-4161-8161-616161616161","role":"authenticated"}', true);
      execute 'set local role authenticated';
      perform public.undo_import(b);
      execute 'reset role';
      insert into public.t_sent values ('removed', (select count(*) from net.sent) - c);
      insert into public.t_sent values ('files', (select count(*) from public.lesson_media where storage_path like 'import/%'));
    end if;
  end loop;
end $t$;
SQL
verdict "a finished import of 80 lessons and 300 files enqueues one push per person told (1 for an adult, 2 for a junior with one adult), and a removal one" "an import pushed per lesson or per file, or not at all" <<'SQL'
select (select n from public.t_sent where k = 'adult') = 1 and (select n from public.t_sent where k = 'kid') = 2
   and (select n from public.t_sent where k = 'removed') = 1
   and (select count(*) from public.lessons where import_id is not null) = 80
   and (select count(*) from public.lesson_media where import_id is not null) = 300
   and (select count(*) from net.sent where body->>'title' = '80 lessons imported') = 2
   and (select count(*) from net.sent where body->>'title' = 'Imp''s lessons imported') = 1;
SQL

echo "== upgrade path: the nosca.sql before imports, holding lessons and files, then this one"
createdb -h "$D" -p $PORT -U super -O supa withdata; $PS -d withdata -f "$D/fixture-db.sql"
if git -C "$ROOT" show 969a788:supabase/nosca.sql > "$D/pre-import.sql" 2>/dev/null; then
  $PU -d withdata --single-transaction -f "$D/pre-import.sql" >/dev/null 2>&1
  $PU -d withdata >/dev/null 2>&1 <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
 ('71717171-7171-4171-8171-717171717171', 'up.coach@x.ie', '{"role":"coach","name":"Up Coach","sport":"tennis","account_type":"coach"}'),
 ('72727272-7272-4272-8272-727272727272', 'up.player@x.ie', '{"role":"player","name":"Up Player","sport":"tennis","account_type":"adult","date_of_birth":"1991-01-01"}');
update public.profiles set coach_id = '71717171-7171-4171-8171-717171717171' where id = '72727272-7272-4272-8272-727272727272';
insert into public.lessons (id, coach_id, player_id, focus, lesson_date) values
 ('73737373-7373-4373-8373-737373737373', '71717171-7171-4171-8171-717171717171', '72727272-7272-4272-8272-727272727272', 'Serve', '2026-01-10'),
 ('74747474-7474-4474-8474-747474747474', '71717171-7171-4171-8171-717171717171', '72727272-7272-4272-8272-727272727272', 'Rally', '2026-02-10');
insert into public.lesson_media (lesson_id, kind, storage_path) values
 ('73737373-7373-4373-8373-737373737373', 'video', '71717171-7171-4171-8171-717171717171/73737373-7373-4373-8373-737373737373/1-a.mp4'),
 ('74747474-7474-4474-8474-747474747474', 'photo', '71717171-7171-4171-8171-717171717171/74747474-7474-4474-8474-747474747474/2-b.jpg');
SQL
  $PU -d withdata --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null
  $PU -d withdata --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null
  VDB=withdata verdict "an older project with lessons and files upgrades: the lessons view ends on the import columns, every row and file kept, the guard and the hold in place" "the upgrade over lessons and files went wrong" <<'SQL'
select (select string_agg(column_name, ',' order by ordinal_position desc) from (select column_name, ordinal_position from information_schema.columns
          where table_schema = 'public' and table_name = 'lessons_view' order by ordinal_position desc limit 2) x) = 'import_key,import_id'
   and (select count(*) from public.lessons_view where import_id is null) = 2
   and (select count(*) from public.lesson_media) = 2
   and (select count(*) from public.import_areas) > 40
   and exists (select 1 from pg_trigger where tgname = 'lesson_media_import_guard')
   and exists (select 1 from pg_policies where tablename = 'lessons' and policyname = 'lessons: an import is held until it is done' and permissive = 'RESTRICTIVE')
   and public.import_lessons(null, null, null) is null;
SQL
else echo "NOT RUN the upgrade over lessons and files: 969a788 is not in this clone (git fetch --unshallow)"; fi

# the fresh run's own FAILs, read from what it printed: running
# behaviour.sql a second time on the same database stopped at its first
# sign-up (the account was already there), counted nothing, and so no
# FAIL from the fresh run ever reached this total
fails=$(echo "$fresh" | grep -c "^FAIL" || true)
echo "== FAIL count: $((fails + extra))"; [ "$((fails + extra))" = "0" ]
