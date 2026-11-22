# Phase 3.9 — Stock receiving & WAC transaction (DRAFT)

**GitHub DRAFT only; do not execute against LIVE Supabase.**

## Function
`inventory_receive_stock_draft(stock_item_id, purchase_quantity, purchase_unit, total_cost, supplier_reference, idempotency_key)`

Designed to run atomically within one PostgreSQL statement:
1. Require authenticated `auth.uid()` and `public.is_admin()`.
2. Lock by idempotency key, reject reuse with conflicting input.
3. Lock the stock-item row, validate active item and compatible units.
4. Convert kg→g or l→ml; otherwise same unit only.
5. Insert receipt; update quantity/value; insert matching movement.
6. Return current balance and WAC (value divided by quantity).

Example: 1,000 g at ₱800 + 500 g at ₱500 = 1,500 g, ₱1,300 value, WAC ≈ ₱0.866667/g.

## Important limits
- This is a **design prototype, not tested SQL**. Requires the draft foundation tables in a disposable DEV database.
- It intentionally revokes PUBLIC, anon and authenticated EXECUTE. A later reviewed deployment must explicitly grant a narrowly scoped role permission. No frontend can call this yet.
- Retried idempotency keys return the receipt ID and **current** stock balance/WAC, which may differ from the balance immediately after the original receipt if other transactions posted later.
- Numeric overflow, permission grants, function ownership, concurrency and rollback behavior require DEV tests.
- No usage deductions, refund reversals, product recipes, order integration or approval transitions are implemented here.
- Security-definer owner must be tightly controlled. Review admin_users integrity and other privileged functions before any deployment.
- Keep inventory DRAFT branch unmerged; do not change existing production files or Supabase configuration.

## DEV acceptance tests to run later
- Valid same-unit receipt; kg→g and l→ml conversion.
- Reused idempotency key with same inputs: only one receipt and one movement.
- Reused key with different inputs: error, no mutation.
- Two concurrent receipts for one stock item: serialized, correct final balance.
- Invalid unit, negative/zero quantity, invalid supplier, excessive precision: rejected.
- Non-admin/anonymous invocation denied.
- Force movement insert failure: entire transaction rolls back.
- WAC arithmetic matches known examples; no double posting.
