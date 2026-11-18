# Phase 2 v014 — Stock Master RPC static review

**Source check:** 7/7 passed. **Not executed in PostgreSQL. No LIVE changes.**

New draft RPC `inventory_save_item_draft` validates admin authentication, names/codes, item type, base/purchase unit family, minimum stock, and optional metadata length. It prevents changes to item type or base unit after ledger/recipe usage. Direct authenticated item writes were removed from the draft; authenticated admins retain RLS-protected read access. This design requires frontend calls to the new RPC rather than direct Supabase table writes.

**Important unresolved concerns:** verify PL/pgSQL compilation and PostgreSQL function privileges, concurrent item edits, unique item_code errors, recipe/receiving/wastage RPC behavior, WAC and numeric limits. Direct privileged DB access is outside browser grants. No runtime test environment or verified backup/restore is available yet. **Do not deploy or run 014 on LIVE.**
