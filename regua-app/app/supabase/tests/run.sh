#!/usr/bin/env bash
# Runs migrations on a throwaway local Postgres database, then the access-rule tests.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="regua_test_$$"
TMP="$(mktemp -d)"; chmod 755 "$TMP"
cp "$DIR"/tests/*.sql "$DIR"/migrations/*.sql "$TMP"/; chmod 644 "$TMP"/*.sql
run() { su postgres -c "$1"; }
run "psql -q -c 'create database $DB'"
# Supabase's API roles live at cluster level; create them on a fresh local Postgres
for role in anon authenticated service_role; do
  run "psql -q -tc \"select 1 from pg_roles where rolname = '$role'\" | grep -q 1 || psql -q -c 'create role $role nologin'"
done
trap 'run "psql -q -c \"drop database if exists $DB\"" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
run "psql -q -v ON_ERROR_STOP=1 -d $DB -f $TMP/supabase_stub.sql" 2>/dev/null || true
for m in "$TMP"/0*.sql; do run "psql -q -v ON_ERROR_STOP=1 -d $DB -f $m"; done
run "psql -q -v ON_ERROR_STOP=1 -d $DB -f $TMP/after_migrate.sql"
status=0
for t in rls_test ingest_test billing_test events_test plate_test quota_test history_test; do
  echo "== $t"
  run "psql -X -d $DB -f $TMP/$t.sql" | tee "$TMP/$t.out"
  grep -q "ALL PASSED" "$TMP/$t.out" || status=1
  # each test file starts from a clean catalog
  run "psql -q -d $DB -c 'truncate reference_months, brands, auth.users cascade'" >/dev/null
done
exit $status
