# Phase 2 integrated owner workflow — REVIEW ONLY

Status: review/test plan. Not connected to Supabase; no SQL executed, no live deployment, no PR merge.

## Owner interface flow
1. Sign in through existing admin authentication; verify admin status server-side.
2. Products list: fetch `products.id, name, product_code, is_active, oat_eligible, price`; use UUID for recipe identity. Show LIVE price as read-only reference.
3. Stock Master: create/edit ingredient or packaging records with correct unit family. Never fabricate costs or recipe quantities.
4. Stock Receiving: generate a fresh UUID request key for each intended posting. Disable submit while pending; retry uncertain responses with the SAME key and identical payload, never a new key.
5. Adjustments and Wastage: require item, signed quantity, reason, and valuation for positive adjustments; submit through secured RPC only.
6. Recipes: load existing products and recipe lines; save by UUID via `inventory_save_recipe_draft`; show `Not configured` if empty.
7. Costing: calculate using valued stock, mark missing costs incomplete; show draft selling price and gross margin separately from `products.price`.
8. Variant costing: oat replaces regular milk; bottle replaces configured cup packaging; show owner-reviewed substitution mappings.
9. Transaction History: read-only ledger with actor, timestamp, reason and reference; no browser mutation.
10. Auto order reservation/deduction stays OFF. No changes to checkout, menu, orders, published prices, URLs or QR.

## Proposed client calls (not implemented)
- `db.rpc('inventory_receive_stock_draft', {p_item_id, p_purchase_quantity, p_purchase_unit, p_total_cost, p_reference, p_request_key})`
- `db.rpc('inventory_correct_stock_draft', {p_item_id, p_correction_type, p_quantity_delta, p_added_value, p_reason, p_request_key})`
- `db.rpc('inventory_save_recipe_draft', {p_product_id, p_lines, p_target_margin_percent})`
Do NOT call these from the LIVE website; functions are only proposed and do not exist in production.

## Blocking issues found in draft SQL
1. **Audit fidelity**: `inventory_stock_movements` stores rounded unit_cost, not the exact value delta or full purchase cost; WAC cannot be reliably reconstructed from ledger alone. Add immutable `value_delta`, original purchase unit/quantity and request key before deployment.
2. **Idempotency scope**: receiving and corrections have separate key tables. Reusing a key across different RPC types is not globally prevented. Prefer a single request registry.
3. **Idempotent replay**: drafts return current stock balance/WAC, not the original transaction's snapshot; define stable response semantics.
4. **Positive adjustments**: draft allows explicitly zero added value. Decide and validate owner policy for free inventory vs unvalued stock.
5. **Ledger integrity**: verify no untrusted role can modify ledger; add explicit immutable/audit safeguards for privileged writes.
6. **Numeric overflow/rounding**: receiving `unit_cost numeric(16,6)` may overflow for very small quantities; validate before INSERT and test precision boundaries.
7. **Recipe race**: serialized saves use product row lock; validate definer ownership, privileges and concurrent behavior in an isolated environment.
8. **Security**: verify `is_admin()` implementation, function ownership, EXECUTE privileges, RLS policies and all direct table grants.
9. **Foundation collisions**: run read-only preflight; never install over existing inventory objects without reconciliation.
10. **Migration strategy**: schema drafts 001/003/004/005 are not a reviewed production migration bundle; no direct execution.

## Isolated acceptance test matrix (not executed)
| Test | Expected |
|---|---|
| Anonymous/non-admin read and RPC | Denied |
| Admin stock receive 1 kg at ₱600 | +1000 g, ₱600 value |
| Admin stock receive 1 kg at ₱800 | +1000 g, ₱800 value; WAC ₱0.70/g |
| Repeat exact receiving request key | No extra movement or stock |
| Reuse request key with altered payload | Error |
| Wastage 100 g | 1900 g, ₱1330, WAC unchanged |
| Wastage > available | Rejected, no partial write |
| Two simultaneous deductions exceeding stock | One rejected, never negative |
| Adjustment +100 g without value | Rejected |
| Recipe save with duplicate item IDs | Rejected |
| Recipe save with inactive item | Rejected |
| Product renamed through existing editor | Same UUID, same recipe lines, updated display name |
| Product made inactive | Recipe retained |
| Refresh owner UI | Stored test data persists |
| LIVE menu/order check | Unchanged |
| Auto deduction setting | OFF |

## Next implementation gates
A. Resolve SQL issues above and create a single coherent **isolated-only** migration.
B. Test with admin/non-admin identities in disposable Supabase project; capture actual results.
C. Build and test authenticated owner UI against isolated backend.
D. Obtain explicit approval for specific migration and rollback/backup plan before any production changes.
