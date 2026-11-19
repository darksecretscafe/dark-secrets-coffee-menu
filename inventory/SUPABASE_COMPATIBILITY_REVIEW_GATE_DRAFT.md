# Supabase compatibility and security gate — DRAFT, not LIVE approved

## Verified in GitHub Actions (temporary environments only)
- Offline Inventory adapter contract tests: passed on commit be8e9be4cd99e7f736217ffcd01bd831bc53a498.
- Offline Chromium preview smoke test: passed on the same commit.
- SQL 017 migration + disposable PostgreSQL 16 acceptance suite: passed on the same commit.
- These results do **not** establish Supabase compatibility, real admin authorization, or a production backup.

## Differences from real Supabase that must be resolved
1. The disposable bootstrap creates `auth.uid()` as a local stub driven by `request.jwt.claim.sub`. Production Supabase Auth JWT handling must be tested separately.
2. The disposable bootstrap creates `public.is_admin()` as a fixed UUID comparison. Confirm the actual existing project's admin role source, security-definer behavior, search path, and permission grants before proposing SQL changes.
3. The disposable bootstrap creates a minimal `public.products(id,name)`. Verify real product primary keys, product ID types, schema names, and menu price/availability fields before joining recipes.
4. Confirm SQL 017 does not collide with any existing `inventory_*` tables, functions, policies, constraints, triggers, or sequences.
5. Test RLS with actual Supabase anon, authenticated non-admin, and authenticated admin sessions in a separate disposable Supabase project. Do not use service-role keys in browser code.
6. Review all SECURITY DEFINER function owners, EXECUTE grants, SQL search paths, and access to inventory request registry and stock movement ledger.
7. Verify the exact schema/response mapping expected by `inventory-rpc-adapter-v2-DRAFT.js` and the read-only provider. Check numeric precision and pagination.
8. Verify no stock deductions happen automatically when customer orders are placed, paid, cancelled, or refunded. Automatic deduction remains OFF until separately designed and approved.
9. Obtain a verified **restorable** backup of the existing production database and a rollback procedure. No verified backup is available in this workflow.
10. Run end-to-end user acceptance tests in an isolated project: stock receipts, WAC, adjustments/wastage, recipes, Menu Management price review, and approval gating. Check concurrent transactions and idempotent retries.

## Strict release decision
- **Current decision: BLOCK LIVE MIGRATION.**
- Do not execute SQL 017 on production, merge PR #15 into the deployed branch, or replace LIVE assets until all items above are completed and reviewed.
- Keep approved v16 UI unchanged. Do not change the existing ordering system, Supabase project, customer data, LIVE URL, or printed QR.

## Next safe work
Prepare an inventory of production schema metadata using an authorized read-only export or screenshots, **without credentials or customer rows**, or use a new disposable Supabase project to validate auth/RLS. Compare the real metadata to the SQL 017 assumptions. The production database must not be modified during this review.
