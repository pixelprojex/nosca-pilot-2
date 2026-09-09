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
$PS -d postgres -f "$HERE/fixture.sql"
grep -v "^create role\|^grant anon, authenticated, service_role to supa" "$HERE/fixture.sql" > "$D/fixture-db.sql"
for db in fresh upgrade; do createdb -h "$D" -p $PORT -U super -O supa $db; $PS -d $db -f "$D/fixture-db.sql"; done
echo "== fresh project: nosca.sql"; $PU -d fresh --single-transaction -f "$ROOT/supabase/nosca.sql" | tail -3
echo "== again (must be a no-op)"; $PU -d fresh --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null && echo ok
echo "== behaviour"; $PU -d fresh -f "$HERE/behaviour.sql" 2>&1 | grep -E "^(PASS|FAIL)"
echo "== upgrade path: old schema.sql, then nosca.sql"; git -C "$ROOT" show b164831:supabase/schema.sql | $PU -d upgrade -f - >/dev/null 2>&1 || true
$PU -d upgrade --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null && $PU -d upgrade -f "$HERE/behaviour.sql" 2>&1 | grep -E "^(PASS|FAIL)" | sort | uniq -c | sort -rn | sed -n 1,3p
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
fi
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

fails=$($PU -d fresh -f "$HERE/behaviour.sql" 2>&1 | grep -c "^FAIL" || true)
echo "== FAIL count: $((fails + extra))"; [ "$((fails + extra))" = "0" ]
