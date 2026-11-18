# Phase 2 inventory RPC contract — REVIEW ONLY

**Not deployed or tested.** This is a security/behavior specification for future isolated implementation. No changes to LIVE Supabase, orders, products, or prices. Automatic stock deduction remains OFF.

## Identity and authorization
Every write RPC must require `auth.uid() IS NOT NULL AND public.is_admin() = true`. Use explicit `SECURITY DEFINER SET search_path = ''`, schema-qualify every referenced object, revoke EXECUTE from PUBLIC and anon, grant EXECUTE only to authenticated. Verify existing `is_admin()` implementation before trusting it. Do not expose the service-role key in the browser.

## Inventory movement storage requirements
Existing `001_foundation_REVIEW_ONLY.sql` is a preliminary proposal. Before implementation, extend it with a unique idempotency key (per operation), a reliable per-item valuation/balance state or a lockable equivalent, and a ledger structure sufficient to reproduce historical weighted-average costing. Do not apply the preliminary SQL as-is.

### `inventory_receive_stock(p_item_id uuid, p_purchase_quantity numeric, p_purchase_unit text, p_total_cost numeric, p_reference text, p_idempotency_key uuid, ...)`
- Reject missing item, inactive item, nonpositive quantity, negative/missing cost, mismatched units, invalid precision and invalid key.
- Convert kg→g (×1000), l→ml (×1000), pcs→pcs (×1); optionally accept matching base unit.
- Lock the item/valuation row and apply one transaction. Weighted-average unit cost = (prior valued stock + receipt total cost) / new quantity. If existing stock valuation is unknown, refuse an automatic WAC rather than assuming zero.
- Append one immutable `receive` ledger entry, with authenticated actor, invoice/reference, unit conversion and cost basis.
- Duplicate idempotency key with identical payload returns original result; same key with different payload errors. Never post duplicate stock.

### `inventory_adjust_stock(p_item_id uuid, p_quantity_delta numeric, p_reason text, p_idempotency_key uuid)`
- Require signed nonzero base-unit delta and reason. For a positive adjustment, require documented valuation basis; do not invent cost.
- Negative adjustment must not exceed available on-hand quantity; use locking and server validation.
- Append `adjustment` ledger entry, never edit/delete historical entries.

### `inventory_record_wastage(p_item_id uuid, p_quantity_base numeric, p_reason text, p_idempotency_key uuid)`
- Require positive quantity, nonempty reason and sufficient on-hand quantity.
- Deduct at existing WAC (or block if valuation is incomplete), append negative `wastage` movement.
- Do not link to live orders.

### `inventory_save_recipe(p_product_id uuid, p_lines jsonb, p_target_margin_percent numeric, ...)`
- Resolve product by UUID, never name. Require existing product and admin.
- Validate array of unique item UUIDs and strictly positive quantities with correct precision. Reject unknown or inactive ingredients; enforce atomic replacement of recipe lines.
- Support explicit unconfigured/empty draft recipes without allowing stock deduction.
- Preserve product UUID and recipe ID across product name edits. Load display name from `public.products.name` dynamically.
- Save target margin in inventory only. Draft selling price must be stored in a separate inventory field/table if persistence is approved; **never update `public.products.price`**.
- Variant substitution configuration (regular milk→oat milk; cup components→bottle) needs its own validated model before implementing variant RPCs.

## Read model
Admin-only product recipe view: product ID, current name, product_code, is_active, oat_eligible, recipe ID, configured state, lines, draft price and margin if implemented. Return products with no recipe as `Not configured`; avoid fabricating recipe lines. Keep customer-facing menu queries untouched.

## Acceptance tests (not yet run)
1. Anonymous/non-admin calls rejected; admin calls permitted only with valid data.
2. Repeated receive request with same key does not duplicate balance or ledger.
3. Concurrent stock withdrawals cannot make balance negative.
4. Receipt 1000 g for ₱600 then 1000 g for ₱800 yields WAC ₱0.70/g.
5. Wastage 100 g reduces stock to 1900 g and value to ₱1330, leaving WAC unchanged.
6. Rename product via existing menu editor, reload recipe view, verify current name and unchanged UUID/lines.
7. Inactivate product: recipe retained; new product with similar name never inherits it.
8. Draft price never updates LIVE `products.price`; order processing never deducts stock while disabled.
9. Attempt direct browser ledger INSERT/UPDATE/DELETE fails.

## Deployment gates
- Obtain read-only inspection of `public.is_admin()`, existing inventory object names, relevant product FKs and grants.
- Review SQL schema/RPC definitions for idempotency, concurrency, unit precision, ledger immutability and RLS.
- Execute tests in isolated Supabase project or transactionally isolated disposable environment.
- Explicit owner approval of specific migration and rollback plan required before touching LIVE.
