# Inventory Phase 1 — Review checklist

**Status:** Draft, not deployed. This is a proposed foundation, not a complete inventory implementation.

## Scope
- Stock master with ingredient/packaging types, stable UUIDs, minimum stock and base units (mL/g/pcs).
- Stock movement ledger for receiving, opening, adjustments and wastage; optional supplier/batch/expiry per receipt.
- Product-to-recipe links using existing `products.id`; recipe lines link to stock IDs, never free-text ingredient names.
- Owner target margin metadata; existing `products.price` remains unchanged.
- Singleton manual activation flag defaults **OFF**.
- Admin-only RLS using the existing `is_admin()` function.
- Stock movement ledger is SELECT-only for authenticated admins; browser writes are denied. Future audited server-side transactional operations must append entries.

## Explicitly not implemented
- No automatic stock reservation, deduction, cancellation/refund handling, or low-stock push.
- No price writes, inventory.html, stock counting workflow, or weighted-average calculation yet.
- No changes to existing tables, pages, order flow, or deployed website.

## Variant and stock accounting design (not yet implemented)
- Base recipe links to `products.id` (UUID); do not infer recipes from display names.
- Oat milk: replace the regular milk quantity with oat milk (not add both); confirm product and modifier values from real checkout payloads before designing variant tables.
- Bottle packaging: replace cup/lid/straw packaging as applicable, rather than counting both; confirm actual `order_items.packaging` values.
- Record order-item-level ingredient and packaging consumption with unique idempotency keys, cost snapshots, and reversal references before enabling automatic deduction.
- No direct client ledger writes. Design secure RPCs for opening stock, receiving, adjustments, wastage and corrections; each transaction must validate quantities, permissions, and concurrency.
- The present one-recipe-per-product schema is a base recipe only. Variant overrides and weighted-average cost calculations require separate review before deployment.

## Proposed grants and safety boundaries
- `authenticated`: SELECT/INSERT/UPDATE for stock master and base recipes, with admin-only RLS; no DELETE.
- `authenticated`: SELECT only for stock movement ledger and activation settings, with admin-only RLS.
- `anon` and `PUBLIC`: no inventory table grants. Service role and table owner privileges must be audited separately.
- Migration aborts if any of the five proposed inventory tables already exists; this is intentional, not an idempotent upgrade.
- Confirm database backup restore procedure and prepare rollback via separately reviewed DROP statements, only if the new tables contain no production data.
- After any approved deployment, test anon, non-admin, admin, and service-role paths and verify settings flag remains OFF.
- The SQL has not been executed or validated against a disposable Supabase database; do not treat static review as deployment approval.

## Before any Supabase execution
1. Verify actual `products.id` type is UUID and `is_admin()` signature/security behavior.
2. Inspect existing database tables/functions/triggers and ensure no name conflicts.
3. Verify RLS and privileges (including grants/revokes) for all five tables; test authenticated admin/non-admin and anon access. The ledger must reject direct client INSERT/UPDATE/DELETE.
4. Design transactional receiving, weighted-average costing, audit trail, and idempotent order deduction.
5. Validate recipe modifiers (oat milk replacement; bottle replaces cup), historical cost snapshots, and batch handling.
6. Review with owner; execute only after explicit separate approval and backup.

## Free plan
Keep ledger compact; avoid frequent polling, unnecessary storage and repeated queries.
