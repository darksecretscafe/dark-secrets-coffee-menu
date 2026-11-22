# Inventory database foundation — DRAFT design review

**Do not run this SQL in LIVE Supabase.** This is a proposal committed only to the DRAFT GitHub branch.

## Intended entities
- `inventory_stock_items`: ingredient/packaging master, base units, on-hand balance and value.
- `inventory_receipts`: purchase receiving records with idempotency keys.
- `inventory_recipes`: one recipe per existing Menu Management product UUID.
- `inventory_recipe_ingredients`: quantities per serving.
- `inventory_stock_movements`: auditable receipt/usage/adjustment/reversal ledger.

## Mandatory checks before any database execution
1. Confirm the actual `public.products.id` column type and deletion behavior; this draft assumes UUID.
2. Review current schema, RLS policies, auth/admin functions and role privileges.
3. Test in an isolated Supabase development database, never the existing LIVE project.
4. Design transactional, idempotent stock receiving and weighted-average-cost functions.
5. Design safe order-completion deduction and reversal rules; avoid double deduction.
6. Decide inventory approval permissions and how recipe revisions affect Completed status.
7. Define stock conversion/precision, reporting, backup and rollback strategy.
8. Review any existing inventory-related tables before applying new names.

**Current status:** database design only; no migrations executed, no LIVE code or data changed.
