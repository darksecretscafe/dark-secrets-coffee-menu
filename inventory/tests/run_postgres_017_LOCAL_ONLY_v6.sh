#!/usr/bin/env bash
# DISPOSABLE LOCAL POSTGRES ONLY. No Supabase or production use.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" && "${PGHOST:-}" != "localhost" ]]; then
  echo 'REFUSED: PGHOST must be explicit localhost' >&2; exit 2
fi
if [[ "${PGDATABASE:-}" != "dsc_inventory_disposable_017" ]]; then
  echo 'REFUSED: wrong database name' >&2; exit 2
fi
if [[ -n "${DATABASE_URL:-}" || -n "${PGSERVICE:-}" || -n "${PGHOSTADDR:-}" || -n "${PGOPTIONS:-}" ]]; then
  echo 'REFUSED: connection override present' >&2; exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo 'REFUSED: psql is not installed' >&2; exit 2
fi
# Query actual connection target before executing any DDL.
identity="$(psql -X -A -t -v ON_ERROR_STOP=1 -c "select current_database() || '|' || coalesce(host(inet_server_addr()),'SOCKET')")"
# Docker-published localhost ports report the container's private bridge IP.
# Allow that only on GitHub Actions with the explicit ephemeral-service marker.
allow_ephemeral_ci=false
if [[ "${GITHUB_ACTIONS:-}" == "true" && "${DSC_EPHEMERAL_POSTGRES_CI:-}" == "YES" &&
      "$identity" =~ ^dsc_inventory_disposable_017\\|172\\.(1[6-9]|2[0-9]|3[01])\\.[0-9]{1,3}\\.[0-9]{1,3}$ ]]; then
  allow_ephemeral_ci=true
fi
if [[ "$identity" != 'dsc_inventory_disposable_017|127.0.0.1' && "$identity" != 'dsc_inventory_disposable_017|::1' && "$allow_ephemeral_ci" != true ]]; then
  echo "REFUSED: unexpected PostgreSQL server identity: $identity" >&2; exit 2
fi
# Manual confirmation prevents accidental execution after an environment change.
if [[ "${DSC_DISPOSABLE_DB_CONFIRM:-}" != 'YES_DESTROY_DISPOSABLE_017' ]]; then
  echo 'REFUSED: set DSC_DISPOSABLE_DB_CONFIRM=YES_DESTROY_DISPOSABLE_017 after checking local server' >&2; exit 2
fi
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_bootstrap_LOCAL_ONLY.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/sql/017_phase2_recipe_lock_rebuilt_REVIEW_ONLY_DO_NOT_RUN.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_catalog_assertions_LOCAL_ONLY.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_security_assertions_v2_LOCAL_ONLY.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_rpc_behavior_LOCAL_ONLY.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_receiving_wac_replay_LOCAL_ONLY.sql
psql -X -v ON_ERROR_STOP=1 -f inventory/tests/postgres_017_correction_wastage_LOCAL_ONLY.sql
printf '%s\n' 'LOCAL SQL 017 smoke test complete; dispose of database after reviewing results.'
