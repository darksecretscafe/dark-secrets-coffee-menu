# Existing order integration findings — code inspection, REVIEW ONLY

**Date:** 2026-11-18. Source: GitHub default-branch `admin.js` and `order.js` inspected directly. This document is not a database migration or deployment.

## Verified from existing frontend source

- Admin `admin.js` active status transitions: `Pending → Accepted → Preparing → Ready → Out for Delivery → Completed`. Pending also has `Decline → Declined`. History includes `Cancelled`.
- Admin status changes use a guarded Supabase update `db.from('orders').update({status:next}).eq('id',order.id).eq('status',order.status)`. This guards against stale UI status, but it is **not proof** of server-side authorization or complete transition enforcement.
- Admin orders query selects `order_items(product_name,packaging,quantity,unit_price,subtotal)`; it does **not** select order-item IDs, `product_id`, or oat modifier fields. A new read-only schema inspection is needed.
- Customer cart distinguishes variants by `cartKey(name, packaging, oatMilk)`. Exact frontend packaging strings: `Regular Cup`, `Take Away Bottle`. Checkout payload includes `name`, `packaging`, `quantity`, `oatMilk`, `expectedUnitPrice`.
- The frontend payload does **not establish** that the database stores `oatMilk` separately or that `order_items` contains a stable unique line ID. Inspect the actual order submission backend and table schema before implementing consumption.
- Existing database trigger names previously verified: `ds_guard_order_status_change_trigger`, `ds_preparation_hold_trigger`, `trg_record_order_status_history`. Their **function bodies have not yet been inspected**.

## Cancellation rules

- Customer may cancel only before branch acceptance (existing owner policy).
- Once `Preparing` starts, customer cancellation is forbidden; this must be server-enforced.
- Branch/admin exceptions, if any, require separate permission and waste/restock policy.
- Inventory code must only respond to **committed authorized** status transitions; never bypass or rewrite the existing order guard triggers.

## Read-only Supabase inspection queries (run manually only when ready)

These queries read metadata only and do not change tables, data, or triggers.

```sql
-- A. Order and order-item column names, types, nullability
select table_name,column_name,data_type,udt_name,is_nullable
from information_schema.columns
where table_schema='public'
  and table_name in ('orders','order_items','order_status_history','order_cancellation_requests')
order by table_name,ordinal_position;

-- B. Order-item primary/unique keys and foreign keys
select tc.table_name,tc.constraint_name,tc.constraint_type,
       string_agg(kcu.column_name,', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name=tc.constraint_name
 and kcu.constraint_schema=tc.constraint_schema
 and kcu.table_name=tc.table_name
where tc.table_schema='public' and tc.table_name in ('orders','order_items')
  and tc.constraint_type in ('PRIMARY KEY','UNIQUE','FOREIGN KEY')
group by tc.table_name,tc.constraint_name,tc.constraint_type
order by tc.table_name,tc.constraint_type,tc.constraint_name;

-- C. Existing order-related triggers and full trigger definitions
select event_object_table,trigger_name,action_timing,event_manipulation,
       action_statement
from information_schema.triggers
where event_object_schema='public'
  and event_object_table in ('orders','order_items')
order by event_object_table,trigger_name,event_manipulation;

-- D. Function definitions for cancellation/status guards (READ ONLY)
select n.nspname as schema_name,p.proname as function_name,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('ds_guard_order_status_change',
                    'ds_guard_preparation_on_cancellation',
                    'ds_record_order_status_history')
order by p.proname;

-- E. Check constraints and status defaults
select c.relname as table_name,con.conname as constraint_name,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('orders','order_items')
  and con.contype='c'
order by c.relname,con.conname;
```

## Next gate

Do **not** write or execute lifecycle migration SQL until the stable `order_items` identifier, actual persisted modifier representation, allowed cancellation transitions, and trigger function behavior are verified. Keep `automatic_inventory_enabled=false`. Never edit LIVE code or database during this review.
