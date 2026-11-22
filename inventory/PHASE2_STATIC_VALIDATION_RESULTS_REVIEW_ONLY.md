# Phase 2 SQL static validation — REVIEW ONLY

Date: 2026-11-18. Source: inventory/sql/007_phase2_unified_ISOLATED_TEST_CANDIDATE_DO_NOT_RUN_LIVE.sql.

## Completed checks
- Inspected the consolidated source in GitHub.
- Found and corrected a malformed PostgreSQL anonymous block delimiter (`do $` / `end $` to `do $$` / `end $$`).
- Checked delimiter occurrence counts after correction: 6 `$$` tokens, 6 `$fn$` tokens.
- Confirmed the unified candidate contains three RPC definitions and uses one global request registry table rather than the two old per-operation request tables.
- Confirmed source text contains a single top-level BEGIN and COMMIT.
- No database connection, SQL execution, or Supabase deployment occurred.

## Remaining blockers / required verification
1. This is static text inspection, **not** PostgreSQL parse, compile, migration or runtime testing.
2. Verify `public.is_admin()`, `auth.uid()`, schema privileges and SECURITY DEFINER ownership in a disposable Supabase project.
3. Confirm every function signature and table constraint compiles with the actual schema; do not assume SQL is executable.
4. Test role restrictions (anon, authenticated non-admin, authenticated admin), including direct table writes.
5. Test WAC, exact valuation delta, full depletion, rounding, overflows and negative-stock rejection.
6. Test same-key replay, cross-operation key collision, altered payload replay and concurrent requests.
7. Verify immutable ledger protections for elevated roles; browser REVOKE alone is not full append-only enforcement.
8. Verify all SQL identifiers, constraints, and RLS policies against a disposable copy of expected schema.
9. Do not use the live Supabase project for these tests without separate explicit approval.
10. Owner UI remains browser-only demonstration; no real persistent inventory workflow has been tested.

## Safe next gate
Provision or identify an **isolated** Supabase/Postgres test environment, then run a reviewed disposable test plan there. Obtain separate approval before any LIVE migration.
