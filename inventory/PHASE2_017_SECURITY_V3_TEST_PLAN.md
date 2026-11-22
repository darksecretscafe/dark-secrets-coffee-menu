# SQL 017 isolated security verification — v3

**Committed but NOT EXECUTED in PostgreSQL.** PostgreSQL client/server are unavailable in this environment. No LIVE connection.

The v3 runner preserves v2 fail-closed host/database/confirmation checks and runs the additional `postgres_017_security_assertions_v2_LOCAL_ONLY.sql` after the schema smoke tests. It checks all seven inventory tables for RLS, denies anonymous SELECT, denies direct INSERT/UPDATE/DELETE to authenticated users, confirms all four RPC signatures exist, confirms authenticated-only EXECUTE and SECURITY DEFINER, and verifies automatic deduction defaults OFF.

Run only on a verified disposable local PostgreSQL instance, with a fresh database and the operator confirmation documented in `PHASE2_017_LOCAL_POSTGRES_SMOKE_TEST_GUIDE.md`:

```sh
bash inventory/tests/run_postgres_017_LOCAL_ONLY_v3.sh
```

**Caution:** This is a catalog/privilege smoke test, not proof of policy correctness, actual role behavior, function ownership safety, idempotency, or transaction concurrency. If an assertion fails, do not bypass it; review and revise the SQL candidate. Do not run any draft migration against LIVE.
