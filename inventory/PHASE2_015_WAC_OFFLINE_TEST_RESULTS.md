# Phase 2 v015 — WAC and Stock Master progress

**Status:** DRAFT; no LIVE deployment or SQL execution.

## Changes
- `sql/015_phase2_item_unit_state_guard_REVIEW_ONLY_DO_NOT_RUN.sql`: protects an item's base unit and item type once any stock state, ledger movement, or recipe line references it. A zero-balance stock state counts as initialized.
- `tests/wac_arithmetic_model.py`: standalone Python Decimal arithmetic model. No Supabase credentials or database access required.

## Offline arithmetic checks
- 2 kg for 400 => 2000 g, value 400, WAC 0.2/g.
- Additional 1 kg for 500 => 3000 g, value 900, WAC 0.3/g.
- Waste 500 g => 2500 g, value 750, WAC 0.3/g.
- Overdraw 3000 g rejected in arithmetic model.
- Full depletion => quantity 0, value 0.
- Receive 100 g for 40 => WAC 0.4/g.

**Execution evidence:** arithmetic model executed in isolated Python environment and passed. This does NOT validate PostgreSQL syntax, RPCs, grants, RLS, advisory locks, concurrency, or rollback.

## Remaining blockers
- PostgreSQL execution and security test in disposable/local environment.
- Verify backup and restoration before any approved production migration.
- Review item RPC concurrency and recipe/item state races.
- Connect inventory UI to validated RPCs; do not connect LIVE prematurely.
- Require explicit approval for final exact migration.
