-- Dark Secrets Coffee — product rename linkage preflight (READ ONLY).
-- Run manually in Supabase SQL Editor; share metadata results only.
-- Does NOT change LIVE products, orders, prices, or inventory.
-- Do not run any inventory migration yet.

-- 1. Actual product columns and types (identify canonical name/status columns).
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='products'
order by ordinal_position;

-- 2. Primary key and foreign keys involving products.
select con.conname as constraint_name, con.contype as constraint_type,
       con.conrelid::regclass::text as source_table,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid='public.products'::regclass
   or con.confrelid='public.products'::regclass
order by con.conrelid::regclass::text, con.conname;

-- 3. Product triggers: verify whether rename could change identity or cascade.
select tgname as trigger_name, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid='public.products'::regclass and not t.tgisinternal
order by tgname;

-- 4. Product RLS and table privileges (metadata only).
select c.relname, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c where c.oid='public.products'::regclass;
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='products'
order by grantee, privilege_type;

-- 5. Current inventory table presence, without touching any data.
select table_name from information_schema.tables
where table_schema='public' and table_name in
('inventory_items','inventory_stock_movements','inventory_recipes','inventory_recipe_lines','inventory_settings')
order by table_name;

-- NOTE: The application menu-editor code must be reviewed separately to verify
-- UPDATE-in-place vs DELETE/INSERT. SQL metadata alone cannot prove that behavior.
