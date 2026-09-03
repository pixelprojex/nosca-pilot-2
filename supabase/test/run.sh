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
$PS -d postgres -f "$HERE/fixture.sql"
grep -v "^create role\|^grant anon, authenticated, service_role to supa" "$HERE/fixture.sql" > "$D/fixture-db.sql"
for db in fresh upgrade; do createdb -h "$D" -p $PORT -U super -O supa $db; $PS -d $db -f "$D/fixture-db.sql"; done
echo "== fresh project: nosca.sql"; $PU -d fresh --single-transaction -f "$ROOT/supabase/nosca.sql" | tail -3
echo "== again (must be a no-op)"; $PU -d fresh --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null && echo ok
echo "== behaviour"; $PU -d fresh -f "$HERE/behaviour.sql" 2>&1 | grep -E "^(PASS|FAIL)"
echo "== upgrade path: old schema.sql, then nosca.sql"; git -C "$ROOT" show b164831:supabase/schema.sql | $PU -d upgrade -f - >/dev/null 2>&1 || true
$PU -d upgrade --single-transaction -f "$ROOT/supabase/nosca.sql" >/dev/null && $PU -d upgrade -f "$HERE/behaviour.sql" 2>&1 | grep -E "^(PASS|FAIL)" | sort | uniq -c | sort -rn | head -3
fails=$($PU -d fresh -f "$HERE/behaviour.sql" 2>&1 | grep -c "^FAIL" || true)
echo "== FAIL count: $fails"; [ "$fails" = "0" ]
