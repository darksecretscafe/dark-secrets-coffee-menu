# Menu Management → Recipe Management read-only integration review (DRAFT)

## Existing implementation inspected
The repository's `admin-products.js` loads menu products with:
```js
await db.from('products')
  .select('id,product_code,name,price,category,is_active,oat_eligible,description,image_path')
  .order('product_code');
```
The admin code calls `checkAdmin()` before its own query. Inventory must independently verify authentication and actual RLS permissions; do not assume the presence of an admin UI grants table access.

## New adapter
`inventory/menu-products-readonly-adapter-v1-DRAFT.js` exposes `DSInventoryMenuReader.createMenuProductReader(client).load()`. It requires a caller-injected, authenticated Supabase client. It contains **no connection initialization, credentials, live imports, writes, or automatic invocation**. It selects the same menu fields and sorts by product_code, validates UUIDs and names, and returns immutable normalized product records. It deliberately includes inactive products so their recipes can be retained; the eventual UI should visibly mark inactive items.

## Proposed data flow
1. Menu Management is the only product-creation/editing screen.
2. On approved authenticated inventory screen load, the adapter reads the existing products table.
3. Recipe status is derived by joining recipe data to immutable `products.id`: No Recipe if no lines; Draft if incomplete/edited/review-needed; Completed only if approved.
4. Filter/sort defaults: No Recipe → Draft → Completed, then product name. Search and 5-row pagination remain.
5. Product rename keeps the UUID and recipe relationship. Inactive products remain visible in appropriate management views.
6. No LIVE price writes. Cost estimates are separate from menu selling prices.

## Not yet implemented / prerequisites
- This is **not yet wired** to the standalone UI; it still uses clearly labeled read-only sample menu products.
- Confirm real table schema and RLS SELECT policy for the inventory role before approved integration.
- Recipe persistence and real owner approval do not exist in the standalone demo.
- No Supabase queries were executed. No LIVE migrations, database changes, deployment or PR merge.
- Keep LIVE site, orders, prices, existing Supabase project, URL and QR unchanged.
