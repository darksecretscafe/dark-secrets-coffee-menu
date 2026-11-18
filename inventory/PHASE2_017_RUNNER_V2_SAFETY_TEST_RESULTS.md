# SQL 017 local runner v2 — safety checks

**Status:** Shell syntax and refusal paths tested locally. **SQL 017 has NOT been executed** because PostgreSQL client/server are unavailable in this environment.

New file: `inventory/tests/run_postgres_017_LOCAL_ONLY_v2.sh`.

Verified locally:
- `bash -n` passed.
- Remote `PGHOST` refused before any database call.
- Incorrect `PGDATABASE` refused before any database call.
- Missing `psql` refused without executing SQL.

The v2 runner additionally checks `DATABASE_URL`, `PGSERVICE`, `PGHOSTADDR`, `PGOPTIONS`; verifies the connected database and server IP via a read-only query; and requires `DSC_DISPOSABLE_DB_CONFIRM=YES_DESTROY_DISPOSABLE_017` before executing any SQL.

**Operator warning:** localhost does not rule out port forwarding, proxying, or a local production instance. Verify the database is genuinely disposable and isolated before setting confirmation. The bootstrap creates local roles and objects, so use a fresh disposable PostgreSQL cluster/database. Do not run against LIVE Supabase.

**Remaining:** Actual PostgreSQL DDL parsing/execution, catalog assertions, RPC security, WAC arithmetic, replay, and concurrent transaction tests. PR #15 remains unmerged and LIVE unchanged.
