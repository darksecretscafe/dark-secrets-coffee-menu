# Phase 2 — Owner inventory storage and security (REVIEW ONLY)

**Status:** Design draft. No SQL executed, no Supabase connection, no LIVE website changes, no PR merge.

## Owner workflow
1. Existing authenticated owner/admin opens future inventory interface.
2. Create ingredient or packaging item (g/ml/pcs); owner supplies all actual names, units, suppliers and minimum levels. No fabricated seed data.
3. Receive stock with purchase unit (kg/l/pcs), quantity, invoice and total cost; server converts to base units and appends an immutable movement.
4. Configure base recipe per existing products.id UUID with ingredient/packaging quantities. Empty/unconfigured recipes are allowed and **must not deduct stock**.
5. Review stock balance, reserved stock, weighted-average cost, low-stock warnings, and audit records.
6. Automatic inventory stays OFF until a separate, explicitly approved phase.

## Existing draft foundation
`001_foundation_REVIEW_ONLY.sql` proposes inventory_items, inventory_stock_movements, inventory_recipes, inventory_recipe_lines and inventory_settings with admin RLS and no browser ledger writes. It is **not** a ready-to-run migration.

## Storage safeguards required before deployment
- Validate actual database schema, auth and public.is_admin() behavior against read-only inspection.
- Secure, server-side admin-only RPCs for receiving, opening stock, adjustments and wastage. Browser must not INSERT/UPDATE/DELETE stock ledger directly.
- Validate quantities, unit family, precision, nonnegative balance on removals, idempotency key, supplier/invoice metadata, and transaction concurrency with row locking.
- Every stock movement records authenticated actor, timestamp, item, signed base-unit delta, reason/reference and cost information; no edits/deletes to posted movements. Correct via explicit compensating entries.
- Weighted average cost is computed in chronological movement order; missing costs are flagged as incomplete. Never infer a cost of zero from absent receipts.
- Enforce admin-only access server-side; do not rely on hiding UI controls. Audit table grants, RLS, SECURITY DEFINER search_path and EXECUTE privileges.
- Keep owner setup separate from LIVE checkout/orders. Existing menu prices must remain unchanged.
- Draft recipe variants separately: oat milk replaces regular milk, and bottle packaging replaces regular cup components. Verify recipes before allowing automatic reservation/deduction.
- Confirm backup, restore and rollback plan; test in isolated environment first. No production deployment until owner explicitly approves the specific reviewed migration and security tests.

## Proposed implementation sequence
A. Review-only schema/RPC contract and preflight checklist.
B. Isolated database test of admin/non-admin/anonymous access, receiving, adjustments, costing and immutable ledger.
C. Build authenticated owner UI against test data only, including empty states and clear validation.
D. Separate go/no-go review for production database foundation; keep automatic deduction OFF.
E. Later separate review for order lifecycle integration and stock reservations.

## Current limitation
All integrated-preview entries remain in tab memory and disappear on refresh. The owner cannot yet save real inventory data.
