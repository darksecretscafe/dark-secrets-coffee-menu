# Phase 3.10 — Offline test results and DEV release gate

**Completed:** 10/10 offline JavaScript business-rule simulations passed in the local execution environment. These do not execute PostgreSQL and do not verify SQL function correctness.

Covered: WAC 1000g ₱800 + 500g ₱500, kg→g, l→ml, same-key retry, conflicting key, incompatible units, invalid quantities/cost, missing supplier, excessive precision, zero-cost receiving.

**Not yet tested:** PostgreSQL SQL syntax, actual transactions/rollback, row locking and concurrency, function owner and grants, RLS, idempotency under concurrent requests, and integration with Supabase Auth.

## DEV database test plan (not executed)
1. Use a disposable isolated Supabase project/local DB with synthetic identities; never clone customer records or secrets.
2. Review foundation schema and SECURITY DEFINER function owner, privileges, and default PUBLIC EXECUTE.
3. Apply draft schema/functions only in isolated DEV after code review.
4. Verify anon/non-admin denied; admin allowed with narrowly scoped grants.
5. Verify receipt + stock balance + movement atomicity and forced-failure rollback.
6. Verify two simultaneous receipts and repeated idempotency keys.
7. Verify precision, overflow, inactive items, units, and WAC against known calculations.
8. Reconcile test outcomes and revise DRAFT before requesting separate production deployment approval.

**Caveat:** Retrying an existing receipt returns the current stock balance/WAC, not necessarily the original post-receipt values. The UI must label these as current.

**Release gate:** No LIVE Supabase SQL, no merge, no production configuration or website changes without explicit approval and successful DEV database tests.
