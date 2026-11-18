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

## Verified LIVE trigger behavior (user-supplied read-only function definitions, 2026-11-18)

- `ds_guard_order_status_change()`: no-op for unchanged status; rejects **all** changes when old status is `Completed`. For previously `Paid` orders transitioning to `Cancelled` or `Declined`, requires `Cancelled` from `Pending`/`Accepted` and an approved full-refund request with specified GCash/Maya refund destination details. **This does not establish a universal ban on `Preparing → Cancelled` for unpaid orders.**
- `ds_guard_preparation_on_cancellation()`: blocks transition **into `Preparing`** when a cancellation request has `request_status='Requested'`. It does **not** itself block transition **out of `Preparing` to `Cancelled`**.
- `ds_record_order_status_history()`: AFTER UPDATE writes one history row on status change, with `clock_timestamp()`. `order_status_history.id` is a bigint primary key (verified). It is a potential idempotency source for later processing; ordering, transaction integration, and exact event delivery semantics still need review.
- The combined function bodies alone do not prove a customer can cancel after preparation; the customer-facing cancellation endpoint and RLS may enforce additional restrictions. **Do not assert the live system is vulnerable without checking those layers.**
- Owner rule remains: customer cancellation only before acceptance; **never after preparation starts**. Future enforcement must be server-side and independently tested for paid/unpaid paths. No LIVE edits authorized.

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

## Verified customer cancellation RPCs (read-only inspection, 2026-11-18)

- Both LIVE overloads of `public.customer_request_cancellation` use `SECURITY DEFINER`, `search_path=''`, validate a 64-character lowercase hex tracking token and 10–500-character reason, and lock the matching `orders` row with `FOR UPDATE`.
- Both explicitly allow cancellation **requests** when the order status is `Pending` **or `Accepted`**; requests are rejected for `Preparing`, `Ready`, `Out for Delivery`, `Completed`, and other statuses. This is a request eligibility check, not proof that all direct order status updates are blocked.
- Both refuse a second cancellation request if one already exists for the order. The two-argument overload rejects paid orders; the six-argument overload supports paid orders subject to GCash/Maya refund destination validation, and accepts unpaid orders without refund details.
- This LIVE behavior differs from owner's stricter target policy of customer cancellation **only before acceptance**. Preserve LIVE as-is pending explicit decision/approval; do not silently tighten existing RPCs or change their grants.
- Review admin cancellation/refund approval RPCs and relevant RLS/grants separately before claiming universal cancellation enforcement. Keep inventory changes review-only, auto-deduction OFF.

## Verified admin cancellation approval RPC (read-only inspection, 2026-11-18)

- `public.admin_review_cancellation(p_request_id uuid,p_decision text)` is `SECURITY DEFINER`, checks `auth.uid()` and `public.is_admin()`, accepts only `Approved`/`Rejected`, locks the associated order then cancellation request `FOR UPDATE`, and rejects already-reviewed requests.
- Approval requires order status `Pending` or `Accepted`. For paid orders it validates verified payment and complete refund destination, marks request `Approved` and `refund_status='Refund Required'` with full `refund_amount=final_total`; for unpaid orders marks request `Approved`. Then updates order to `Cancelled` (existing AFTER UPDATE history trigger records status change). Rejection changes request to `Rejected` without changing order status.
- The inspected customer request and admin approval RPCs both prevent cancellation at `Preparing` and later, but direct order status updates, other privileged functions, and RLS/grants still require separate review before asserting universal protection.
- Planned inventory behavior: release reservation if accepted order is cancelled before preparation; do not auto-restock consumed ingredients after preparation; deduct only at completion per agreed target. Do not wire to LIVE triggers yet.

## Verified LIVE CHECK constraints (read-only inspection, 2026-11-18)

- `orders.status` permits exactly: `Pending`, `Accepted`, `Declined`, `Preparing`, `Ready`, `Out for Delivery`, `Completed`, `Cancelled`. A CHECK constraint limits values but **does not** enforce transitions.
- `order_items.packaging` permits `Regular Cup`, `Take Away Bottle`, `Add-on`; quantity 1–15, unit price >0, subtotal = unit_price * quantity. The `Add-on` meaning is **not yet established**. No oat modifier column was found in the inspected `order_items` schema.
- `orders.order_method` permits only `Delivery`; payment method and status and refund request fields have validation CHECK constraints.
- Inventory modifier mapping must not infer oat milk from price or `Add-on` without inspecting the checkout persistence implementation; bottle packaging replaces regular packaging and oat milk replaces dairy in proposed recipe mapping. Auto-deduction stays OFF.

## Verified LIVE checkout oat modifier persistence (user-supplied function definitions, 2026-11-18)

- `create_customer_order_secure` delegates to `create_customer_order_once`, which delegates to `create_customer_order` for order creation. Secure checkout uses idempotency locking and a checkout credential hash; preserve as-is.
- `create_customer_order` determines oat substitution by the **exact suffix** ` · Sub Oat Milk` in `p_items[].product_name`. It validates `products.oat_eligible` and calculates unit price as product base price + 30 if oat + 15 if Take Away Bottle. It persists the full `product_name` (suffix included) and `packaging` to `order_items`; no separate oat column is required for the currently inspected checkout path.
- `assign_order_item_product_id` uses the portion before ` · ` to match the base product name to `products.id`, preserving product linkage for oat variants.
- Checkout accepts only `Regular Cup` or `Take Away Bottle` packaging, despite `order_items` CHECK allowing `Add-on`. No `Add-on` rows were found in the user-run query; **do not** treat `Add-on` as oat milk in the inventory mapping.
- Inventory recipe logic should recognize oat substitution by exact suffix and use oat milk **instead of** dairy milk; bottle packaging replaces regular cup components. Verify exact live product names and recipe quantities before any automation. Never infer modifier from unit price alone.
