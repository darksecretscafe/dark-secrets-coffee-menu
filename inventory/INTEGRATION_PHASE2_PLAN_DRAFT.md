# Dark Secrets Coffee — Inventory Integration Phase 2 (DRAFT / REVIEW ONLY)

**Status:** Planning only. No migration executed, no production integration, no LIVE reads/writes.

## Approved UI baseline
- `admin-inventory-integrated-v16-price-review-gated-approval-DRAFT.html` is the accepted standalone offline UI.
- Separate Inventory Management tab alongside Menu Management.
- Progressive guidance: select product → ingredients → quantity → add → costing → review selling price in Menu Management → save → return to finalization → review & approve → success popup → recipe status list, with selected editor cleared.
- Cancel from Menu Management returns to costing without saving.
- Recipe approval is distinct from selling-price approval. WAC changes flag cost review without automatically revoking Completed.

## Existing source review (feature branch only)
- `inventory/sql/001_foundation_REVIEW_ONLY.sql`: proposed additive inventory tables; references existing `public.is_admin()`.
- `inventory/sql/003_recipe_rpc_DRAFT_DO_NOT_RUN.sql`: proposed recipe draft save RPC keyed by `public.products.id` UUID.
- `inventory/sql/004_receiving_wac_DRAFT_DO_NOT_RUN.sql`: proposed receiving ledger / weighted average costing extension.
- All SQL remains **DO NOT RUN**; presence in GitHub does not imply production deployment.

## Proposed data boundaries
1. **Menu Management remains the sole owner of selling prices.** Inventory reads `public.products.id`, name, and price only through an authenticated admin-approved integration. Do not duplicate the authoritative selling price in inventory.
2. **Inventory owns** stock master, stock receipts/movements, recipe lines, recipe status and costing snapshots/audit (schema still subject to review).
3. **Price change workflow:** propose from costing → Menu Management explicitly validates and saves price → return to selected recipe; only then allow final approval. A cancelled price edit must not mark price review complete.
4. **Approval security:** the offline UI's `confirm()` and in-memory flags are not authorization. Production requires an admin-authorized server-side operation validating recipe lines, positive stock costing inputs, saved menu price, and review/approval rights. Define audit fields (actor, timestamp, recipe version, cost snapshot) before enabling writes.
5. **Receiving:** only explicit receiving transactions change stock and WAC. No automatic deduction from customer orders in this phase.

## Integration order (no production changes in this plan)
1. Confirm existing LIVE admin page structure, current product schema, and authorization policies **by code inspection or separately approved read-only checks**.
2. Build a standalone mock adapter with the same menu snapshot contract as v16; test product UUID preservation, name/price updates, cancellation, and return navigation without Supabase.
3. Review SQL/RPC security and constraints, including admin checks, RLS, EXECUTE grants, duplicate receipt prevention, concurrent WAC updates, and error handling. Do not execute migrations.
4. Define a safe rollout/rollback and backup checklist; request explicit approval before any LIVE DB access, migrations, or deployment.
5. Only after approval, test integration in an authorized isolated environment or with an approved non-destructive procedure that does not require a second Supabase project.

## Acceptance checklist
- [ ] Products in Inventory match Menu Management by immutable UUID.
- [ ] Existing menu price remains unchanged until Menu Management Save.
- [ ] Cancel returns to Recipe Costing and does not alter price.
- [ ] Recipe approval cannot be forged by browser-side flags.
- [ ] Completed recipes survive receiving/WAC updates; ingredient edits require re-review.
- [ ] No regressions to orders, checkout, payments, notifications, URL, QR or LIVE admin UI.
- [ ] No production change without explicit authorization.

**Safety:** Feature branch only. Existing single Supabase project, LIVE URL/QR, database, and production branch are untouched.
