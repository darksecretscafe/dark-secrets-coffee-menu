# SQL 017 local RPC behavior smoke tests (v4)

**Committed; NOT executed in PostgreSQL.** This environment has Node.js but no working PostgreSQL client/server. An attempt to install a PostgreSQL SQL parser (`pglast`) was blocked by unavailable package-network access.

Added `tests/postgres_017_rpc_behavior_LOCAL_ONLY.sql`, which runs in a transaction and ends with `ROLLBACK`. Using mock `auth.uid()` and `is_admin()` from the local bootstrap, it attempts to:
1. Save a local test inventory item as mock admin.
2. Save a recipe for the local mock product and check the recipe line.
3. Confirm mock nonadmin recipe writes raise `insufficient_privilege`.
4. Confirm mock anonymous item writes raise `insufficient_privilege`.

The v4 runner executes this after the schema and catalog/security assertions. The existing runner still requires an explicitly verified disposable localhost database and a manual confirmation token. No production database or Supabase project is used.

**Limits:** Even if the local behavior smoke test passes, it does not prove real Supabase RLS, SECURITY DEFINER ownership, receiving/WAC correctness, concurrency, replay, or deployment safety. Do not run SQL 017 on LIVE. PR #15 stays unmerged.
