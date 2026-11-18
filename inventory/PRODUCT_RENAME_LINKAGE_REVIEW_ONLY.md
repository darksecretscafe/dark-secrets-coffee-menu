# Product rename-safe recipe linkage — REVIEW ONLY

Status: design and test contract only. No LIVE Supabase changes, no migrations executed, no PR merge.

## Canonical linkage
- Link `public.inventory_recipes.product_id` (UUID, unique, NOT NULL) to `public.products.id` via foreign key `ON DELETE RESTRICT`, as already proposed in `sql/001_foundation_REVIEW_ONLY.sql`.
- The owner interface must load products from the authoritative products table and display the current product name by joining `inventory_recipes.product_id = products.id`. Do **not** copy product names into recipe records as a source of truth.
- Product rename: UPDATE product display name, preserve `products.id`; the recipe lines, quantities, costs, and owner-set target margin remain linked to the same UUID. A name change is not a new recipe.
- Product inactive/hidden: retain the recipe and costing history; filter availability separately from recipe existence.
- Never auto-create a recipe for a newly created product; show `Not configured` until the owner adds lines.
- No automatic inventory reservation/deduction or LIVE price publishing.

## Safety gates
- Inspect actual products table primary key, name field, active/hidden fields and menu-edit behavior using read-only queries before implementing a live join. Do not assume field names beyond the already verified UUID `products.id`.
- Verify whether the menu editor mutates the existing product row or deletes/recreates it. A delete/recreate workflow changes UUID and must be explicitly blocked or migrated with owner review; a name-based fallback is unsafe.
- Verify that legacy `order_items.product_id` references and order history remain intact on rename.
- If a product is deleted, the proposed `ON DELETE RESTRICT` prevents orphaning a recipe; show an explicit error and require an archive workflow rather than cascading deletion.
- Existing demo `inventory/integrated-preview.html` still uses drink-name keys in browser memory. It is **not** rename-safe until replaced with real UUID-linked data in an isolated authenticated implementation.

## Manual acceptance tests (pending)
1. Configure recipe for product UUID A; rename product A; reload inventory screen; new display name appears, same recipe ID and lines.
2. Deactivate product A; verify recipe remains accessible to owner and is not deleted.
3. Create product B with identical name; verify product B does not inherit product A's recipe.
4. Attempt to delete product A with a recipe; verify restrict behavior and no recipe loss.
5. Change draft price/target margin; verify no LIVE menu price changes.
6. Non-admin and anonymous users must not read or write inventory recipe records.

## Scope
This document defines behavior for Phase 2. Persistent storage, product join, auth/RLS tests and browser acceptance tests are not yet implemented. Owner must approve deployment separately.

## Verified product metadata from owner read-only inspection (2026-11-18)
- `public.products.id`: UUID, NOT NULL, primary key.
- `name`: text NOT NULL; `price`: numeric NOT NULL; `is_active`: boolean NOT NULL; `oat_eligible`: boolean NOT NULL.
- `product_code`: text NOT NULL; `category_id`: bigint NOT NULL.
- Other columns: `category` text NOT NULL, `created_at` and `updated_at` timestamptz NOT NULL, `image_path` nullable text, `description` nullable varchar.
- Owner supplied product policies: admin-only INSERT, UPDATE, DELETE, all-product SELECT; active-product SELECT for anon/authenticated. RLS enablement and `is_admin()` implementation not yet verified by these results.
- Do not modify LIVE price or products. Proposed recipe join: `inventory_recipes.product_id = products.id`, read `products.name` dynamically. A draft selling price must remain separate from `products.price`.

## Remaining blocking verification
- Check product editor code for UPDATE-in-place vs DELETE/INSERT and triggers affecting ID.
- Confirm RLS enabled and existing FK/deletion behavior before approving a production migration.
