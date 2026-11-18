# Inventory Phase 1 — Review checklist

**Status:** Draft, not deployed. This is a proposed foundation, not a complete inventory implementation.

## Scope
- Stock master with ingredient/packaging types, stable UUIDs, minimum stock and base units (mL/g/pcs).
- Stock movement ledger for receiving, opening, adjustments and wastage; optional supplier/batch/expiry per receipt.
- Product-to-recipe links using existing `products.id`; recipe lines link to stock IDs, never free-text ingredient names.
- Owner target margin metadata; existing `products.price` remains unchanged.
- Singleton manual activation flag defaults **OFF**.
- Admin-only RLS using the existing `is_admin()` function.

## Explicitly not implemented
- No automatic stock reservation, deduction, cancellation/refund handling, or low-stock push.
- No price writes, inventory.html, stock counting workflow, or weighted-average calculation yet.
- No changes to existing tables, pages, order flow, or deployed website.

## Before any Supabase execution
1. Verify actual `products.id` type is UUID and `is_admin()` signature/security behavior.
2. Inspect existing database tables/functions/triggers and ensure no name conflicts.
3. Verify RLS and privileges (including grants/revokes), and prevent manual ledger edits/deletes once operations go live.
4. Design transactional receiving, weighted-average costing, audit trail, and idempotent order deduction.
5. Validate recipe modifiers (oat milk replacement; bottle replaces cup), historical cost snapshots, and batch handling.
6. Review with owner; execute only after explicit separate approval and backup.

## Free plan
Keep ledger compact; avoid frequent polling, unnecessary storage and repeated queries.
