DARK SECRETS COFFEE — ADDITIVE INTEGRATION DRAFT (15 NOV 2026)

STATUS: REVIEW/STAGING ONLY. DO NOT DEPLOY TO LIVE YET.

BASE: LIVE GitHub ZIP provided 15 Nov 2026.
ADDED: Admin Products tab/panel in admin.html and admin-products.js from TEST.
UNCHANGED: All other LIVE files, including customer checkout, tracking, admin.js, delivery, payment, refunds, cancellation, service workers, URLs and assets.

IMPORTANT: The TEST and LIVE frontend share the same Supabase project and products table. Product edits made through this tab can affect TEST immediately and may affect other consumers of that table. Do not use it for editing production products until RLS, permissions and workflow have been verified.

NOT INCLUDED: Dynamic customer menu or UUID checkout. These require a compatible production Edge Function and database validation migration, plus end-to-end regression testing.

TESTS REQUIRED: Admin sign-in and role check, Products tab navigation, products read/write RLS, all original admin tabs, order lifecycle, and frontend regression.

DEPLOYMENT: No deployment was performed. Maintain backup and rollback before any production release.
