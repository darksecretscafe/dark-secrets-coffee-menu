# Phase 3.6 — Verified is_admin() security (user-provided SQL inspection)

## Observed function
- Name: public.is_admin()
- Owner: postgres
- Returns boolean; STABLE; SECURITY DEFINER
- SET search_path TO ''
- EXECUTE: anon=false, authenticated=true
- Definition:
```sql
select exists (
  select 1
  from public.admin_users
  where user_id = (select auth.uid())
);
```

## Assessment
The function uses fully qualified `public.admin_users` and `auth.uid()`, and an empty search path, reducing object-shadowing risks. Anonymous EXECUTE is not granted; authenticated users can execute but should receive true only if their auth UID is in `public.admin_users`. This matches the existing products/categories RLS authorization pattern. No change to the function is proposed.

This verifies the function's declared configuration and body, **not** a full penetration test, table privilege audit, or end-to-end authorization test. It does not justify applying the draft RLS migration to LIVE.

## Remaining blockers
- Review admin_users access controls, ownership and whether non-admins can insert themselves.
- Review existing grants on proposed inventory tables in isolated DEV after creating them.
- Design/validate atomic receiving and WAC transaction, approval workflow, movement ledger, idempotency and order deduction.
- Validate authenticated non-admin/admin/anon behavior in isolated DEV.

## Next read-only check
Inspect `public.admin_users` RLS and policies plus its constraints. Do not expose user IDs or rows.
