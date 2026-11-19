# Phase 2 v013 — recipe write hardening review

**Result:** 8/8 static checks passed. Source inspection only; no PostgreSQL execution.

The draft grants authenticated admins read-only access to recipe headers/lines, with direct INSERT/UPDATE/DELETE revoked. Recipe edits are intended to go through the validated `inventory_save_recipe_draft` SECURITY DEFINER RPC. Inventory item metadata remains directly admin-writable and requires further policy/design review. The stock ledger, state, registry and settings remain browser read-only or inaccessible as drafted.

**Outstanding:** PostgreSQL parser/runtime testing, WAC rounding/concurrency, permissions and definer behavior, backup and restore rehearsal, review of item metadata writes, frontend persistence integration, final deployment approval.

**DO NOT RUN 013 ON LIVE.** All changes remain on unmerged draft PR #15.
