# Dark Secrets Coffee — additive integration staging

**NOT READY FOR PRODUCTION DEPLOYMENT**

Base: LIVE repository snapshot, Nov 15 2026. Preserve LIVE behavior and existing orders.

## Implemented in this staging package
- LIVE customer website and LIVE order.js unchanged.
- Existing LIVE admin/order/tracking/payment/refund files retained.
- Added TEST Products tab and admin-products.js (requires verification of product RLS/admin permissions).

## Not implemented yet — do not switch checkout
- Production-compatible UUID product checkout.
- Database-driven pricing for production orders.
- Server-side product quantity and checkout-credential protections for UUID flow.
- Production RPC integration and regression tests.

## Production integration design
1. Keep existing LIVE submit-order and create_customer_order_secure path intact until a separately tested version is ready.
2. Add a new versioned checkout endpoint and production RPC that use products.id, compute prices server-side, write to existing orders/order_items, preserve order_number/tracking_token/idempotency and checkout-credential validation, and enforce total <=100 and <=15 per product across variants.
3. Introduce dynamic menu in LIVE UI behind a feature flag, retaining the old menu and old checkout as fallback until the new endpoint is verified.
4. Verify full lifecycle: submit, retry, tracking, admin accept, delivery fee, payment instructions, cancellation, refund, push; test existing orders.
5. Only then enable feature and deploy with backup and rollback.

## Safety
Never deploy this ZIP directly to LIVE. Shared products table means admin changes may affect TEST even in staging.
