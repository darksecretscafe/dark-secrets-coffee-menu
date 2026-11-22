# Inventory Phase 2 — Receiving replay and WAC validation matrix (REVIEW ONLY)

**Status:** planned test cases, not executed. No LIVE changes.

## Receiving replay regression
1. Create an admin-authenticated isolated test context and one active ingredient. Receive 2 kg for total cost 400 using request UUID A. Expect one ledger row, 2000 g, stock value 400, WAC 0.2/g.
2. Deactivate that ingredient. Repeat exactly the same request UUID A and same actor/payload. Expect same movement ID, original 2000 g balance and WAC 0.2/g; no new ledger row.
3. Attempt a NEW request UUID B on inactive ingredient. Expect rejection and no ledger/state change.
4. Reuse UUID A with different cost, item, operation or actor. Expect rejection and no new ledger/state change.
5. Receive 1 kg for total cost 500 with new UUID after reactivation. Expect 3000 g, value 900, WAC 0.3/g. Replay UUID A afterward must still return original 2000 g / 0.2/g snapshot, not current state.
6. Two concurrent calls using same UUID A must yield one ledger row and identical results; different UUIDs for same item must serialize correctly.

## Corrections and WAC
7. From 3000 g/value 900, waste 500 g: remaining 2500 g/value 750; WAC 0.3/g.
8. Attempt waste of 3000 g when 2500 g remain: reject without state or ledger changes.
9. Waste remaining 2500 g: zero quantity and zero value, no residual.
10. Positive adjustment 100 g with explicit cost 40: quantity 100 g, value 40, WAC 0.4/g.
11. Reject invalid precision, negative costs, incompatible purchase units, missing reason, null request UUID and duplicate key with different payload.
12. Confirm ledger sum(quantity_delta) equals stock state quantity and sum(value_delta) equals stock state value for each item; test 6-decimal rounding and numeric boundaries.

## Security and non-regression
13. anon, ordinary authenticated user, authenticated admin, and privileged role must each have documented expected access to tables and RPCs.
14. Verify product rename retains UUID-linked recipe; no updates to public.products.price.
15. Confirm automatic inventory setting FALSE and no order or checkout triggers installed.
16. Validate backup/restore and rollback plan separately before any LIVE deployment.

**Do not use production customer/order data in testing.** These cases require an actual disposable/local PostgreSQL execution environment; this document is not evidence they passed.
