# v16 LIVE integration mapping (feature branch only)

The approved UI is `admin-inventory-integrated-v16-price-review-gated-approval-DRAFT.html`. Its inline JavaScript is an offline simulation and MUST NOT be copied to production. Existing LIVE inventory RPCs and auth gateway are authoritative.

| Approved v16 control | LIVE source/action | Gap |
|---|---|---|
| Dashboard stock count / low stock | Read-only inventory snapshot items and stock state | Bind v16 counters |
| Stock Master item registration | `inventory_save_item_draft` via persistence controller | Map category/code/purchase unit; verify required fields |
| Stock Master balances/WAC | Read-only provider snapshot | Bind table |
| Receive Stock | `inventory_receive_stock_draft` with UUID idempotency key | Bind form, disable while saving, read back |
| Recent Receiving / Cost History | `inventory_stock_movements` via read-only provider | Verify historical WAC fields and map UI |
| Menu products / Recipe Status | Existing `products` by immutable UUID + recipes | Bind search/filter/pagination |
| Recipe ingredient editing | `inventory_save_recipe_draft` | Guard unsaved changes and read back |
| Costing / margin | `calculateInventoryCosting` on saved snapshot | Bind tiles |
| Price review | `inventory_review_recipe_price_draft` | Explicit saved price confirmation |
| Final approval | `inventory_approve_recipe_draft` | Block dirty edits; enforce server validation |

**Release gate:** No sample products, no in-memory-only saves, no offline demo controls, no draft/test labels in customer-facing UI. Existing order flows, admin login, public URLs, payments, and automatic stock deduction OFF remain unchanged. Do not replace LIVE panel until all v16 actions are wired and tested.
