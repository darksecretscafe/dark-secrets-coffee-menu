# Phase 3.2 — Existing schema compatibility review (repository evidence)

**Status: partial review only.** GitHub code and migrations were inspected; the actual Supabase database catalog was **not** queried. This is not approval to run the inventory migration.

## Confirmed from repository
- `admin-products.js` fetches `products` columns `id,product_code,name,price,category,is_active,oat_eligible,description,image_path` and orders by `product_code`.
- It requires an authenticated user and `rpc('is_admin')` before fetching products.
- It also fetches `categories` fields `id,name,sort_order`.
- `migrations/20261117-category-management.sql` references `products.category_id`, and declares a `bigint` variable for `categories.id`. It defines product/category synchronization triggers.
- These files **do not prove** the deployed database's `products.id` type, actual constraints, or currently applied policies.

## Unverified blockers
1. `products.id` is UUID in deployed DB — **unverified**, required by inventory v1 FK.
2. Actual `products` deletion constraints and relationships — **unverified**.
3. Existing inventory tables and naming collisions — **unverified**.
4. Effective product RLS, admin grants, and inventory access — **unverified**.
5. Which historical migrations were applied to LIVE — **unverified**.
6. Transaction-safe WAC receiving and idempotent order deduction — **not implemented**.

## Next safe action
Run only the companion read-only introspection queries in an authorized environment (prefer isolated development database), and share schema metadata without customer data or secrets. Compare outputs to the draft SQL before revising the migration. **Do not execute inventory-foundation-v1-DRAFT.sql.**

## References inspected
- `admin-products.js`
- `migrations/20261117-category-management.sql`
- `inventory/sql/inventory-foundation-v1-DRAFT.sql`
