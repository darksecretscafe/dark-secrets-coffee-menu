# Existing LIVE Supabase — inventory release gate (NO DEPLOYMENT)

**Status:** blocked; no SQL migration executed. No new Supabase project required.

## Safety rules
- Preserve LIVE website, backend, data, checkout, prices, public URL and printed QR.
- Auto order deduction OFF; no new triggers on products/orders.
- SQL files 001–008 are drafts, **not approved production migrations**.
- SQL 007 and its copy 008 still contain a malformed anonymous DO block delimiter. Do not execute either file.
- The GitHub editor update attempts did not produce a changed blob for that block; treat the syntax defect as unresolved, regardless of earlier status wording.

## Read-only precheck
Run only `inventory/sql/009_live_predeployment_METADATA_READ_ONLY.sql` after verifying the selected Supabase project. This reads metadata and returns database name, role, existing inventory object collisions, function owners, and product column metadata. Do not post passwords, API keys, tokens, or connection strings.

## Backup prerequisites
1. Verify an accessible recent database backup and an independent recovery path suitable for the current Supabase plan.
2. Capture a current schema snapshot and inventory-related object list; keep a separate record of any new objects introduced.
3. Define a restore point and owner-approved maintenance window; document rollback feasibility and recovery time.
4. Rehearse recovery in a disposable/local environment before production deployment.

## Migration review blockers
- Repair malformed SQL anonymous DO delimiters and verify against actual PostgreSQL parser.
- Validate public.is_admin() implementation and SECURITY DEFINER ownership.
- Verify exact schema/grants/RLS; never blindly assume existing inventory objects are absent.
- Audit append-only movement history and privileged write access.
- Validate global request-key idempotency, replay response, concurrency, WAC rounding and numeric overflow.
- Confirm no direct changes to public.products, orders, checkout, or LIVE prices.
- Test full recipe rename, inactive product, wastage, receiving and no negative stock.
- Require separate explicit approval for exact production SQL and rollback plan.

## Deployment decision
**NO-GO** until blockers resolved and test evidence recorded. Do not run migration or attach production owner UI yet.
