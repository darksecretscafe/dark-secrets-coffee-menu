# Phase 2 v016 — isolated PostgreSQL test runbook

**Draft only. Do not run on LIVE Supabase. No separate Supabase project required.**

## Why this exists
No PostgreSQL executable (`psql`, `postgres`, `initdb`) or Docker was available in the current execution environment, so the draft has **not** been parsed or executed by PostgreSQL. Previous WAC tests were standalone arithmetic checks only.

## Setup on a disposable local PostgreSQL instance
1. Start an empty disposable PostgreSQL database. Never point `psql` at LIVE.
2. Create mock `anon` and `authenticated` roles, mock `auth.uid()`, a mock `public.is_admin()` based on session user, and a minimal `public.products(id uuid primary key)` fixture. These mocks are only for local SQL tests, not a Supabase security equivalence claim.
3. Apply ONLY the newest complete candidate `sql/016_phase2_recipe_item_lock_REVIEW_ONLY_DO_NOT_RUN.sql` in the disposable DB (do not stack 001–016). Record parser errors and abort on the first failure.
4. Inspect table privileges, RLS policies and RPC execute grants; test unauthenticated, non-admin authenticated and admin sessions.
5. Create one ingredient with the item RPC, receive 2 kg at 400, retry the same request key, receive 1 kg at 500, waste 500 g, then fully deplete and attempt overdraw. Verify the exact ledger and state values against `PHASE2_REPLAY_WAC_TEST_MATRIX_REVIEW_ONLY.md`.
6. Test recipe saves and duplicate ingredient rejection. In two separate local DB sessions, hold an item metadata update while attempting recipe save; verify that recipe validation waits and rejects an item deactivated by the other transaction. Repeat with a base-unit change.
7. Verify no mutation of products.price, checkout/orders, or automatic inventory deduction. Confirm the automatic setting remains FALSE.
8. Drop the disposable DB. Save logs, expected/actual values and any fixes to a new versioned candidate.

## Release gate
Even if local tests pass, the LIVE release still requires independent permission review, verified backup/restore, exact deployment review and explicit owner approval. Never treat this runbook as authorization to deploy.
