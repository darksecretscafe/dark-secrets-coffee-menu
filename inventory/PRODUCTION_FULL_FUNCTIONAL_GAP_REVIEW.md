# Fully working LIVE Inventory — implementation gap review

Status: INCOMPLETE. Production database and website unchanged. Do not represent as deployed.

## Confirmed by owner's read-only Supabase metadata checks (November 2026)
- public.products has UUID primary key id, name text, price numeric, category text, is_active boolean, category_id bigint.
- No public inventory_* tables, routines or other pg_class objects were reported.
- public.is_admin() is STABLE SECURITY DEFINER, postgres-owned, empty search_path; returns EXISTS from public.admin_users where user_id = auth.uid().
- public.admin_users RLS enabled; no direct anon/authenticated INSERT, authenticated UPDATE/DELETE grants reported; no explicit policies reported.
- products BEFORE INSERT/UPDATE trigger sync_product_category() synchronizes category and category_id.
- No verified restorable backup; Supabase Free plan. User declined local PostgreSQL backup setup.

## Verified in repository
- SQL 017 defines only four RPCs: inventory_save_item_draft, inventory_receive_stock_draft, inventory_correct_stock_draft, inventory_save_recipe_draft.
- SQL 017 does not implement server-side recipe approval, price review acknowledgement, or approval audit. Offline v16 flags cannot be treated as persisted authorization.
- Draft adapter and in-memory relay are NOT wired into the live admin application.
- Disposable PostgreSQL CI and browser/contract tests are NOT real Supabase E2E tests.

## Work needed before fully working release
1. Implement persistent server-side recipe review and approval state with admin-only RPC, audit fields, recipe version and saved-price verification. Approval must invalidate on ingredient edits and price changes as specified by approved workflow.
2. Implement actual admin UI Supabase integration, including session checks, item/receipt/correction/recipe read-write, error handling, loading states, idempotency keys and WAC refresh.
3. Integrate the approved recipe costing overview and Menu Management price-save handshake without modifying existing product category trigger behavior.
4. Run isolated real Supabase project auth/RLS and concurrent receiving/idempotency E2E tests; verify anon and non-admin denied.
5. Verify a recoverable production backup/rollback path before any production migration, and confirm release/rollback owner approval.
6. Deploy incrementally preserving existing ordering, payment, tracking, URLs, QR, customer records and Supabase project. Keep automatic order stock deductions OFF.

## Release decision
BLOCK production SQL execution and merging draft PR #15. A frontend-only deployment is not the user's requested fully working outcome. Do not call this release complete until every workflow persists and passes end-to-end.
