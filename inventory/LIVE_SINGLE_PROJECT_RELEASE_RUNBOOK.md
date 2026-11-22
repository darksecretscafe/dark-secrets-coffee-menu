# Inventory release runbook — single existing LIVE Supabase project

Status: PREPARATION ONLY. No production SQL has been executed by this runbook.

## Preconditions
- Preserve the current LIVE ordering website, Supabase project, existing products, orders, checkout, payment, tracking, and printed QR.
- Automatic stock deduction stays OFF.
- No paid backup or separate Supabase project is assumed.
- Latest SQL 017 and 018 disposable PostgreSQL, browser and offline contract workflows must be green.
- Record the existing Supabase project ID, timestamp, and the SQL Editor execution account (do not place secrets in GitHub).
- OWNER ACCEPTED NO-RESTORABLE-BACKUP RISK on 2026-11-22 and explicitly authorized proceeding with additive-only inventory migration in the existing LIVE project. No paid backup required. A SQL transaction only rolls back uncommitted work; a later DROP script is not a data backup.

## Confirmed LIVE metadata from owner (2026-11-22)
- public.products: id uuid, name text, price numeric, is_active boolean, category_id bigint.
- No inventory_* tables or functions reported by owner from read-only metadata queries.
- public.is_admin(): SQL STABLE SECURITY DEFINER, owner postgres, empty search_path; checks admin_users.user_id = auth.uid().
- public.admin_users has RLS enabled; anon/authenticated have no direct SELECT/INSERT/UPDATE/DELETE grants.
- UUID generator available, authenticated can EXECUTE public.is_admin(), products table exists.
- These checks do **not** prove end-user JWT/RLS behavior or production recoverability.

## Release sequence (do not skip gates)
1. Owner explicitly accepted proceeding without a restorable backup (2026-11-22). Record this waiver and the migration timestamp. No paid backup or additional backup approval is required; do not misrepresent a schema cleanup as full backup.
2. Review SQL 017/018 for ownership, grants, RLS, product references and conflicts against current LIVE metadata. Do not paste unreviewed SQL.
3. Execute migration only with owner approval, record exact timestamp and SQL output. SQL 017 creates inventory schema and SQL 018 adds review/approval persistence.
4. Immediately verify catalog objects, authenticated admin read/RPC access, non-admin denial, and that automatic_inventory_enabled=false.
5. Perform a single controlled admin inventory item create, receive, correction, recipe save, price review and approval; verify persisted readback and audit entries. Use clearly labeled test inventory records, not customer orders.
6. Mount existing persistent admin panel only after the database passes; do not replace customer UI or existing admin functionality.
7. Confirm existing ordering, checkout, payments, tracking, push, live URL and QR still work.
8. If any gate fails, stop and use the *verified* recovery procedure. Never blindly rerun non-idempotent migrations.

## Explicit unresolved blockers
- No direct Supabase connector/credentials available to the assistant, so it cannot perform or witness LIVE SQL execution.
- No restorable database backup; owner explicitly accepted the residual production risk.
- Real authenticated and non-admin JWT/RLS tests are pending.
- Admin panel is still isolated from the LIVE entrypoint.
