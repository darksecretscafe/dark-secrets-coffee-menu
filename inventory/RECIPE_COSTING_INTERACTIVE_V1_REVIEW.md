# Interactive Recipe Costing v1 — Draft review

Added standalone `inventory/recipe-costing-interactive-v1-DRAFT.html` to the unmerged PR branch.

Capabilities:
- Enter cost-catalog items with base unit and per-base-unit cost.
- Create or update an in-memory draft recipe with owner-defined target gross margin.
- Add and remove ingredient/packaging recipe lines.
- Compute per-variant recipe cost and suggested price using `cost / (1 - margin/100)`.
- Replace regular milk lines with oat milk lines, and regular container lines with bottle container lines, depending on selected variant.
- Display informational customer modifier charges of +PHP 30 oat and +PHP 15 bottle, without applying them to LIVE menu prices.

Important: Replacement requires correctly assigned roles; missing role lines can produce incomplete estimates. User-entered data is session-only and clears on refresh. No Supabase client, API, persistence, order integration or automatic stock deduction. JavaScript arithmetic is illustrative, not accounting-grade. VAT, payment/marketplace fees, discounts and price rounding are excluded. No browser automation or PostgreSQL testing has been performed. Real owner-approved recipes and cost data are still needed.

LIVE site, database, orders, prices and QR remain unchanged; PR #15 unmerged.
