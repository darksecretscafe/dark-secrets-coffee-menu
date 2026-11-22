# Integrated costing validation — DRAFT ONLY

Scope: `inventory/integrated-preview.html` on the unmerged inventory branch. No Supabase connection, no LIVE deployment, and no automatic order deduction. These are **manual browser test cases to run**, not claims that the browser tests passed.

## Owner setup / no fabricated recipes
1. Open preview and Recipes. All drinks should have no recipe lines, incomplete costs, and disabled suggested-price button.
2. In Stock Master add actual owner-chosen ingredients and packaging with unique codes, appropriate type and base units (g/ml/pcs).
3. In Stock Receiving enter purchase quantities and total costs. Check kg→g and l→ml conversions and WAC. Zero-quantity or negative receipts must be rejected.
4. Add recipe lines with owner-chosen quantities. If any line lacks a valued receipt, variant cost and suggestion must remain incomplete.

## Variant replacement
5. For a drink with regular milk in the base recipe, select that milk and an oat-milk item (both ingredient/ml). Select oat variant: regular milk cost must be removed and the same ml of oat milk used; do not add both.
6. For a base recipe containing cup, lid and straw, enter their exact comma-separated item codes, select a packaging/pcs bottle and its owner-chosen quantity. Select bottle variant: remove selected packaging lines and add bottle.
7. Select oat+bottle: apply both replacements. If a mapping or WAC cost is missing, block price suggestion rather than silently treating it as zero.
8. Select another drink, then return: per-drink draft pricing and variant configuration should remain within the same browser tab.

## Draft pricing
9. Set a base selling price and target gross margin. Display gross profit = base price + variant surcharge − selected variant cost; gross margin = gross profit ÷ total variant selling price.
10. Preview surcharge only: oat +₱30, bottle +₱15, both +₱45. Suggested **base** price = max(0, variant cost ÷ (1 − target gross margin) − variant surcharge). This does not set LIVE prices.
11. Empty, negative, or nonnumeric base prices should not produce profit/margin. Target margin outside 0–99.99% should not produce a suggestion. Zero selling price should not produce a percentage.
12. Click Use Suggested Price: it should change only the draft base price, not the LIVE menu.

## WAC and audit behavior
13. Receive 1 kg at ₱600 then 1 kg at ₱800: average ₱0.70/g. Waste 100 g: stock 1,900 g, value ₱1,330, same WAC.
14. Negative adjustment or wastage exceeding balance must be rejected. Positive adjustments without a cost should flag valuation as incomplete.
15. Reload page: demo data disappears. Verify the LIVE menu, orders, Supabase tables, and published prices remain unchanged.

## Known limitations / gates
- No persistent storage, real authentication/RLS, database RPCs, or transactional ledger in this preview.
- Owner must confirm actual packaging replacement rules and whether oat substitution is always same volume.
- Manual browser testing is pending. Do not merge or deploy before review.
