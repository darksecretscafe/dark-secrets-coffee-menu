# Inventory dashboard UI v1 — review-only

Created `inventory/dashboard-ui-v1-DRAFT.html` on the unmerged inventory branch.

This is a responsive **read-only browser prototype** containing:
- Overview metrics: stock items, low stock, out of stock, estimated stock value.
- Stock Master table with example balances, minimum levels, base units, and weighted-average unit cost.
- Activity list and recipe costing illustration with suggested selling price derived from target margin.
- Tab navigation between Overview, Stock Master, Activity, Recipes.

**All sample items, costs, recipes and transactions are fictional** and not owner-provided. Values are explicitly labeled sample. There are no network calls, Supabase imports, credentials, storage, database writes, or order deductions. This page does not replace existing previews or LIVE assets.

Next development work: refine accessible empty states and owner-data entry UX in draft, then wire to the authenticated RPC adapter only after security and database validation. Do not deploy or merge without separate approval. LIVE website, Supabase, menu prices, orders and printed QR are unchanged.
