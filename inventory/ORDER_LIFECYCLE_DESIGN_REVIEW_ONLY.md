# Inventory order lifecycle — database design (REVIEW ONLY)

**Status: proposal, not executed.** No LIVE database changes, no deployed code, no enabled automatic deduction. This document does not authorize migration or activation.

## Grounded existing constraints

- Existing `products.id` is UUID and `order_items.product_id` is nullable UUID; existing `order_items.quantity` is integer.
- Existing `public.is_admin()` checks `admin_users` using `auth.uid()`.
- Existing `orders` has status guard, preparation cancellation guard, status history and push triggers. Existing `order_items` has product-ID assignment trigger. **Do not replace or modify these triggers.**
- Existing inventory foundation proposes a ledger and recipes but does not include reservations, variants or order-item consumption.
- Confirm the real order status values, cancellation/refund behavior, `order_items` primary key, modifier columns and whether items can change after acceptance before writing a migration.

## Proposed additive entities (not yet SQL)

1. `inventory_order_reservations`: immutable reservation ID, `order_id`, `order_item_id`, `inventory_item_id`, quantity in base unit, status (active/released/consumed), recipe revision/snapshot, modifier snapshot, created/released/consumed timestamps. A unique reservation identity must include order item + inventory item + reservation revision; **do not assume product ID uniquely identifies an order line**.
2. `inventory_order_events`: event ID, order ID, source order status event/version, event kind, processing status, processed timestamp, error/retry state, unique idempotency key. Never use timestamp alone as the key.
3. `inventory_order_consumption`: one row per order item + inventory item + consumption event, with quantity, weighted-average unit cost snapshot, total cost, ledger movement ID and unique idempotency key. Add foreign keys after verifying existing order/order-item PKs.
4. `inventory_recipe_versions` and variant override rules: immutable approved recipe snapshots for accepted orders; oat replaces regular milk and bottle replaces applicable cup/lid/straw. Exact modifier payload values must be verified from checkout and persisted order items before implementation.
5. A reconciliation/audit view (or admin query) that compares accepted reservations, completed consumption, stock movement ledger and order status history.

## Cancellation permission and preparation lock (owner clarification)

- Customer (CS) may cancel **only before branch acceptance**, consistent with existing checkout rules. Once accepted, customer cancellation is unavailable even if kitchen preparation has not started.
- Once preparation has started, **customer cancellation must remain blocked**. Do not treat an inventory reservation release as permission to cancel an order.
- Branch/admin cancellation or refund is a **separate, privileged workflow** requiring explicit business rules. The presence of a backend cancellation endpoint does not imply the customer can call it.
- Enforce these restrictions **server-side** using the existing order-status and preparation guards; hiding a button is not sufficient. Inspect actual status values and guard logic before implementing.
- If an authorized exception occurs after preparation starts, do **not** automatically return consumed or prepared ingredients to stock. Determine wastage/reversal policy separately.
- Inventory event processing must observe the *authorized committed status transition*, not independently change order status or bypass cancellation guards.

## State machine

| From | To | Inventory effect | Repeat event |
|---|---|---|---|
| Pending | Accepted | Snapshot recipe and modifiers; reserve required base units | No duplicate reservation |
| Pending | Cancelled | Customer cancellation permitted before branch acceptance; no reservation or deduction | No-op |
| Accepted | Completed | Atomically append negative ledger movements and cost snapshots, mark reservations consumed | No duplicate deduction |
| Accepted | Cancelled | **Privileged exception only** if allowed by existing status/preparation guards; release reservation only if ingredients not consumed | No-op |
| Completed | Completed | No-op | No-op |
| Cancelled | Cancelled | No-op | No-op |
| Completed | Cancelled/refunded | **Needs explicit policy**: refund does not necessarily restore consumed ingredients | Do not automatically restock |

Other transitions must follow the existing order status guards; do not invent new statuses. If orders can be edited after acceptance, define a reservation revision transaction that releases and rebuilds reservation snapshots.

## Available stock

`on_hand = sum(inventory_stock_movements.quantity_delta)` for committed movements; `reserved = sum(active reservation quantities)`; `available = on_hand - reserved`.

**Warning-only shortage policy:** acceptance may create a reservation even if available stock becomes negative. Show a clear warning and record it for admin review. Do not silently alter inventory on hand, manufacture receipts or drop recipe lines.

## Transaction and concurrency rules

- All mutations must occur through privileged server-side functions/service code with verified authorization. Never grant browser clients direct INSERT/UPDATE/DELETE on the ledger or lifecycle event tables.
- On status change, lock the relevant order and reservation/event rows; lock inventory item balance/valuation rows in deterministic ID order to avoid races. Re-check current order status and source event/version inside the same transaction.
- Generate a deterministic, unique idempotency key for each order status transition and order-item consumption (e.g., source event UUID + item UUID + inventory item UUID + action), and enforce it with database UNIQUE constraints.
- Complete deduction in one transaction: validate immutable recipe snapshot; compute WAC from serialized valuation state; append ledger movement with negative quantity and cost; append consumption record; mark reservations consumed; mark event processed; commit together. A retry must return the original result, not write a second movement.
- Reservation is not a physical stock movement. Cancellation before completion releases reservation only. Wastage and adjustments remain separately audited.
- No direct client updates to lifecycle rows. Prefer append-only event records plus controlled state changes; prevent manual deletion and destructive edits.
- When recipe, item, or modifier mapping is missing, record a processing error and surface an alert; do not mark the event processed or silently skip an ingredient.
- On-hand and WAC calculations must use numeric precision with explicit rounding rules and an atomic valuation strategy. Do not use the latest receipt price as WAC.

## Security and rollout gates

1. Confirm order status enum/text values, order-item PK and order modifier fields from actual schema.
2. Review any existing order status trigger's transactional behavior; select an integration point that avoids recursive triggers and extra frequent polling.
3. Prepare **separate review-only SQL migration** with foreign keys, indexes, RLS, grants, functions and rollback notes; do not execute yet.
4. Test on an isolated database with fixture orders: duplicate Accepted/Completed; concurrency; insufficient stock warning; cancelled Accepted; oat replacement; bottle replacement; missing recipe; repeated webhook; refund; stock adjustments during reservation.
5. Confirm backup and restore process before any production schema change. Keep `automatic_inventory_enabled = false` throughout testing.
6. Require explicit separate approval before any LIVE deployment and another separate activation approval after end-to-end testing.

## Outstanding decisions

- Completed order subsequently cancelled/refunded: whether wastage, return, or no stock reversal applies (default **no automatic restock** pending owner approval).
- Whether any privileged cancellation after acceptance is allowed by existing guards; never expose this as a customer capability.
- Whether existing order status updates can happen offline or be reordered, and which event ID is stable.
- Exact product modifier payloads and packaging components.
- Whether recipe versions can change while an order is accepted.
