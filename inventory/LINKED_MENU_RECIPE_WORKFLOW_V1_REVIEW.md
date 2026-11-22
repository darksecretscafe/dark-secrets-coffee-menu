# Linked Menu → Recipe Status → Costing v1 (DRAFT)

Created `inventory/menu-recipe-linked-workflow-v1-DRAFT.html` as a standalone browser-only demonstration in the unmerged inventory PR.

## Implemented in this demonstration
- Add a menu product once with a generated UUID; initial status **No Recipe**.
- Select the product in a searchable, filterable list; rename without changing its UUID or recipe association.
- Add cost-catalog items and recipe lines to that selected product.
- Calculate estimated variant costs with oat-milk and take-away-bottle replacement roles, display informational +PHP 30/+PHP 15 customer modifier charges.
- Assign target margin, mark simulated costing review, and simulate owner approval to reach **Completed**.
- Editing recipe lines or target margin invalidates Completed approval and returns to Draft; removing the last line returns to No Recipe.
- Reset clears browser-memory data.

## Limitations / required hardening
- This demo **does not read the real LIVE Menu Management product list**; UUIDs are generated only for temporary demo products.
- No persistence, authentication, owner verification, backend authorization, Supabase calls, stock deduction, or price updates.
- Catalog costs are set only on initial creation; production must invalidate approvals when ingredient costs or recipe-dependent item attributes change, with an explicit costing review policy.
- UI checks are not a replacement for server-side validation. Completed must be enforced by an authenticated admin/owner RPC with auditable approval metadata.
- Browser arithmetic is illustrative and excludes VAT, fees, discounts, rounding, and real stock valuation.
- No browser automation or PostgreSQL tests have run.

The LIVE website, database, prices, orders and printed QR remain untouched. PR #15 is unmerged.
