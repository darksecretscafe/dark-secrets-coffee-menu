# Phase 2 — structural audit after v011

**Status: 8/8 source-text checks passed. Not runtime tested. NO-GO for LIVE deployment.**

Checked against `inventory/sql/011_phase2_replay_fix_REVIEW_ONLY_DO_NOT_RUN.sql`:
1. Equal number of anonymous DO openings and closings.
2. No malformed `do $` opening.
3. Exactly one top-level BEGIN and COMMIT.
4. Three inventory RPC declarations.
5. Receiving request registry lookup occurs before checking active item status.
6. Receiving and corrections share the request registry.
7. Auto-deduction setting defaults to FALSE.
8. No textual UPDATE/DELETE/ALTER against public.products.

**Important limits:** text checks do not parse or execute SQL, validate RLS behavior, WAC arithmetic, concurrent transactions, or security-definer execution. An isolated PostgreSQL test environment is not available in the current workflow. Do not use LIVE as a test substitute.

**Review blocker:** direct authenticated-admin INSERT/UPDATE privileges exist for inventory_items, inventory_recipes and inventory_recipe_lines. Although RLS restricts to admin, these bypass RPC-level validation and recipe consistency rules. Decide and enforce the intended mutation boundary before deployment.

**Additional blocker:** no verified backup and restore rehearsal, no isolated runtime test, no exact production migration approved.

The read-only `inventory/sql/012_postinstall_SECURITY_AUDIT_READ_ONLY.sql` has been prepared for use only after an approved installation; it does not install anything.
