# Simple Inventory Workspace v1 — draft review

Created `inventory/simple-inventory-workspace-v1-DRAFT.html` in the unmerged inventory PR.

## UX simplification
Four tabs only: Dashboard, Stock Master, Receive Stock, Recipes & Costing. One-time stock-item registration; recipe editor selects those existing stock items. Stock Receiving calculates illustrative weighted-average unit cost, and recipe costing uses that current cost. Status counters, low-stock indicators, recipe-status filter, product search, and quick actions are included.

## Recipe status rules (demonstration)
- New demo menu product starts as No Recipe.
- First recipe line moves it to Draft.
- Completed requires at least one line, available WAC for every ingredient, target margin, simulated costing review, and user confirmation.
- Editing recipe lines or target margin reverts Completed to Draft.
- Any receiving that affects a Completed recipe conservatively reverts it to Draft for cost review.

## Scope and limitations
- **Not connected to LIVE Menu Management**; adding demo products is temporary UI scaffolding and should disappear once existing menu products are read by immutable UUID.
- **No persistence or Supabase calls**, no real approval/authentication, no stock deductions, no menu price changes.
- Browser floating-point cost arithmetic is illustrative; no real accounting guarantees or multi-user concurrency.
- Variant-specific oat-milk and take-away-bottle replacement costing is **not yet included in this simplified page**; it remains separately demonstrated in `recipe-costing-interactive-v1-DRAFT.html`.
- All data clears on refresh. Static source verification only; no automated browser tests performed.

LIVE website, Supabase database, orders, prices and printed QR unchanged. PR #15 unmerged.
