# SQL 017 v6 correction and wastage tests

**Status: Authored and committed; NOT executed in PostgreSQL.** No PostgreSQL runtime is available in this environment.

The rollback-only `postgres_017_correction_wastage_LOCAL_ONLY.sql` verifies the intended behavior of:
- Receiving 1 kg at total cost 200, yielding 1,000 g at WAC 0.2.
- Recording 250 g wastage; expect 750 g remaining at unchanged WAC 0.2.
- Replaying identical wastage request key; expect original movement ID and no duplicate deduction.
- Rejecting a 751 g wastage request with `Insufficient stock`.
- Adjusting the remaining -750 g to zero, with no residual stock value and NULL WAC.
- Expecting exactly three movements: receipt, wastage, final adjustment.
- Rolling back all inserted test data.

Runner v6 retains previous isolated schema, RLS, function grant, admin behavior, receiving, WAC, and replay tests. It must only be run on a verified disposable local PostgreSQL database with the explicit operator confirmation token.

**Still blocked:** Actual SQL execution and concurrency tests. A written test is not a passing test. LIVE website, Supabase project/database, orders, prices and QR remain unchanged. PR #15 is unmerged.
