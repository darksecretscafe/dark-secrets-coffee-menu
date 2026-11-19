# Inventory Phase 2 — corrected SQL static review (2026-11-18)

**Scope:** unmerged draft only. No SQL executed against LIVE. No new Supabase project.

## Completed
- Verified the corrected 010 draft contains 4 `do $$` blocks and 4 `end $$;` closings; 0 malformed `do $` delimiters.
- Verified one top-level BEGIN/COMMIT and three inventory RPC definitions (two CREATE FUNCTION and one CREATE OR REPLACE FUNCTION).
- User's read-only LIVE checks: no inventory_% public tables or functions; products UUID; is_admin SECURITY DEFINER owned by postgres, checks public.admin_users via auth.uid; anon cannot execute; authenticated can execute; admin_users RLS on, no policies and no ordinary client table grants; UUID and hash helpers available.

## Blockers identified in source (010)
1. **Idempotency replay order:** receive RPC locks item and checks active status before looking up the existing request key; a valid historical retry can fail if item was later deactivated. Correction RPC checks registry first. Standardize replay before item-state validation while maintaining lock order and payload checks.
2. **Misleading inherited comments:** draft comments claim replay returns current WAC and separate key tables, but current registry stores a snapshot and is shared. Correct comments before release.
3. **Security:** authenticated role has direct INSERT/UPDATE grants on inventory items, recipes, and lines (RLS admin only). Decide whether direct writes are acceptable or all mutations must be RPC controlled. Validate SECURITY DEFINER owner and public.is_admin() permissions in the actual deployment.
4. **WAC:** validate exact rounding at 6 decimals, negative corrections and full depletion, value conservation and cost input bounds with executable PostgreSQL tests.
5. **Concurrency:** advisory lock on request UUID then row lock; verify concurrent same-key and different-key requests, and collision behavior. Check rollback on failure.
6. **Operational readiness:** verified backup/restore and reversible release plan not provided. No isolated PostgreSQL runtime test completed.
7. **No order deduction:** settings automatic_inventory_enabled defaults FALSE and no order deduction trigger should be deployed.

## Release gate
**NO-GO.** Do not run 007, 008, or 010 on LIVE. Continue source corrections, then a disposable/local PostgreSQL test, verify backup, and request separate approval for the exact final production SQL.
