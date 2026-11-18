#!/usr/bin/env bash
# Local disposable PostgreSQL only; NEVER point this script at Supabase.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" && "${PGHOST:-}" != "localhost" ]]; then
  echo "REFUSED: PGHOST must explicitly be 127.0.0.1 or localhost" >&2; exit 2
fi
if [[ "${PGDATABASE:-}" != "dsc_inventory_disposable_017" ]]; then
  echo "REFUSED: PGDATABASE must be dsc_inventory_disposable_017" >&2; exit 2
fi
if [[ -n "${DATABASE_URL:-}" || -n "${PGSERVICE:-}" || -n "${PGHOSTADDR:-}" ]]; then
  echo "REFUSED: remove DATABASE_URL, PGSERVICE and PGHOSTADDR overrides" >&2; exit 2
fi
psql -X -v ON_ERROR_STOP=1 -c "select current_database(), inet_server_addr();"
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_bootstrap_LOCAL_ONLY.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/sql/017_phase2_recipe_lock_rebuilt_REVIEW_ONLY_DO_NOT_RUN.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_catalog_assertions_LOCAL_ONLY.sql
echo "LOCAL 017 SQL smoke test completed; database remains disposable."
