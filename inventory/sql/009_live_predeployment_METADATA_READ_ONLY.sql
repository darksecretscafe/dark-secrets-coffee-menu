-- DARK SECRETS COFFEE — LIVE READ-ONLY INVENTORY PRECHECK
-- This query only reads metadata. Do not execute any migration from this file.
-- Use in existing Supabase SQL Editor only after confirming project selection.
select current_database() as database_name, current_user as executing_role,
       now() as checked_at;
select n.nspname as schema_name, c.relname as object_name,
       c.relkind as object_type, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
 'products','inventory_items','inventory_stock_movements',
 'inventory_recipes','inventory_recipe_lines','inventory_settings',
 'inventory_stock_state','inventory_request_registry')
order by c.relname;
select p.proname as function_name, pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       pg_catalog.pg_get_userbyid(p.proowner) as function_owner
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('is_admin','inventory_receive_stock_draft','inventory_correct_stock_draft','inventory_save_recipe_draft')
order by p.proname;
select column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public' and table_name='products'
and column_name in ('id','name','price','is_active','category_id')
order by ordinal_position;
-- Read-only. No INSERT, UPDATE, DELETE, CREATE, ALTER, DROP or GRANT.
