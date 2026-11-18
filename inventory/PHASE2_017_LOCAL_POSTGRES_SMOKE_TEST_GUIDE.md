# SQL 017 — Disposable local PostgreSQL smoke test

**Status:** Harness committed, **NOT EXECUTED**. No PostgreSQL server/client was available in the authoring container. No Supabase connection or LIVE changes.

This harness is for a **fresh local disposable PostgreSQL database**, NOT a second Supabase project. It mocks `auth.uid()`, `public.is_admin()`, `public.products`, and browser roles only for catalog smoke testing. It does **not** reproduce actual Supabase auth/RLS behavior.

Files:
- `tests/postgres_017_bootstrap_LOCAL_ONLY.sql`
- `sql/017_phase2_recipe_lock_rebuilt_REVIEW_ONLY_DO_NOT_RUN.sql`
- `tests/postgres_017_catalog_assertions_LOCAL_ONLY.sql`
- `tests/run_postgres_017_LOCAL_ONLY.sh`

**Operator prerequisites:** install PostgreSQL locally, use a local administrator, confirm the host is your own disposable PostgreSQL server (not a tunnel/proxy to production), and create a brand-new database named `dsc_inventory_disposable_017`. Ensure the test user can create local roles/schemas/functions. Set `PGHOST=127.0.0.1` and `PGDATABASE=dsc_inventory_disposable_017`; unset `DATABASE_URL`, `PGSERVICE`, `PGHOSTADDR`. Run from the repository root:

```sh
bash inventory/tests/run_postgres_017_LOCAL_ONLY.sh
```

**Checks:** SQL candidate execution (syntax and DDL), seven expected inventory tables, RLS enabled, automatic deduction OFF, and anon/authenticated recipe RPC grants.

**Limitations:** localhost guards cannot detect SSH tunnels or port forwarding; operator must verify server identity. A PASS would not prove business correctness, full Supabase security, idempotency, WAC, race-free transactions, or production readiness. Future integration tests must include role impersonation, real auth/RLS, concurrency, rollback and backup recovery. Never execute against LIVE.
