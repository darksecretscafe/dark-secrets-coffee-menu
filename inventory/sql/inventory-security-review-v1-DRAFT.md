# Phase 3.6 — Inventory security review (DRAFT)

## Evidence provided by the user
- `public.products.id` is UUID and primary key; `products.category_id` references `categories.id`.
- `products` and `categories` have RLS enabled.
- Admin management policies use `(SELECT is_admin()) = true`.
- Customer product SELECT allows only active products.
- `public.is_admin()` takes no arguments, returns boolean, is STABLE and SECURITY DEFINER.
- The inspected inventory table names did not appear in the column query.

## What remains unverified
- Function body, owner, `search_path`, function EXECUTE privileges.
- Effective table privileges, any other role grants, and policy combinations.
- Whether actual deployed schema changed since inspection.
- Server-side transactional functions for receiving, WAC, approvals, stock deductions, and reversals.

## Policy plan
1. Admin-only SELECT for five inventory tables; no anonymous SELECT.
2. Admin recipe and recipe-ingredient editing in draft, subject to workflow checks.
3. No direct browser writes for stock balance, receiving, or stock movement tables.
4. No browser deletion of recipes, receipts, or movements.
5. Restrict table privileges explicitly in a later reviewed migration. RLS is not a replacement for grants.
6. Use authenticated server-side functions to atomically post receipts, lock stock rows, recalculate WAC, and record immutable ledger movements. Prevent duplicate posting with idempotency keys.
7. Protect completed recipe transitions and avoid edits bypassing review.
8. Test with anonymous, authenticated non-admin, and admin users in a disposable DEV database.

## Cautions
- `inventory-rls-policy-v1-DRAFT.sql` is a design fragment, **not executable against LIVE**. It assumes tables exist and must not be run before review.
- No `GRANT` is included; without privileges, even authorized admin users may be denied. This is deliberate pending review.
- PostgreSQL permissive policies combine with OR. Check for other policies before deployment.
- No production migration or data access has occurred in this phase.

## Next read-only verification
Inspect function definition, owner, search_path and EXECUTE grants for `public.is_admin()` before any deployment decisions. Share only schema/function metadata, never secrets or customer records.
