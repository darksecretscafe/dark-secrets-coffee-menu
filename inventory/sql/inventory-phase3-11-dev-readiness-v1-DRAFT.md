# Phase 3.11 — DEV readiness and SQL static review

**Status: prepared, not deployed or database-tested.** No isolated DEV Supabase project has been confirmed in this conversation. Do not run these files in the LIVE project.

## Change in v2
The draft receiving function and its REVOKE statements are now wrapped in a single `BEGIN … COMMIT` transaction. This closes the interval in which a newly created PostgreSQL SECURITY DEFINER function might otherwise be executable by PUBLIC before REVOKE commits.

## Critical design notes
- The proposed `inventory_receive_stock_draft` uses `auth.uid()` plus `public.is_admin()`; it intentionally has no client EXECUTE grant.
- The function locks a receipt idempotency key and the stock item row before posting.
- Existing draft stock balance and inventory value columns are mutable by privileged database roles; application policies must not grant direct writes.
- On repeated receipt requests, it returns the **current** WAC/balance, not a historical snapshot.
- The receipt ledger cannot yet handle sales deductions, returns, wastage, or corrections; none are ready for production.
- The v1 SQL and earlier claims of offline test success do **not** establish PostgreSQL compatibility. No SQL execution results are available.
- Function CREATE OR REPLACE is not a migration rollback plan; DEV deployments need versioned migrations and rollback scripts.
- Review function owner, function body, schema/table privileges, RLS, and transaction race behavior before enabling EXECUTE.

## Isolated DEV setup checklist
1. Create a separate Supabase project (different project URL and credentials), or local disposable PostgreSQL/Supabase instance.
2. Confirm the DEV `public.products(id uuid)` schema exists or create a synthetic minimal test table in DEV only.
3. Run the foundation schema and reviewed RLS policies in DEV only.
4. Run the receiving function v2 in DEV only; verify PUBLIC, anon, authenticated have no EXECUTE privilege.
5. Create synthetic admin and non-admin identities; do not copy LIVE user records.
6. Test receipt posting, retry, conflicting key, concurrent receipts, rollback, numeric precision, and unauthorized users.
7. Record actual query outputs; do not report tests as passed until they run.

**No changes to LIVE website, Supabase database, or production configuration.**
