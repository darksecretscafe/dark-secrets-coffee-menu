-- Inventory Phase 1 preflight: READ ONLY.
-- Run in Supabase SQL Editor and share the results (no customer/order rows returned).
-- Do not run the inventory migration yet.

-- 1. Existing inventory object names (avoid collisions).
select table_name from information_schema.tables
where table_schema='public' and table_name like 'inventory_%'
order by table_name;

-- 2. Product primary key and deletion behavior (existing FKs).
select tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name as foreign_table,
       ccu.column_name as foreign_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name=ccu.constraint_name and tc.table_schema=ccu.table_schema
where tc.table_schema='public' and tc.table_name in ('products','orders','order_items')
  and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY')
order by tc.table_name,tc.constraint_name,kcu.ordinal_position;

-- 3. is_admin function metadata (signature alone does not prove security).
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as returns,
       p.prosecdef as security_definer, p.provolatile as volatility,
       p.proconfig as function_settings,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='is_admin';

-- 4. Existing public table RLS status.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('products','orders','order_items')
order by c.relname;

-- 5. Existing triggers on products/orders/order_items (names and definitions only).
select event_object_table as table_name, trigger_name, event_manipulation,
       action_timing, action_statement
from information_schema.triggers
where event_object_schema='public'
  and event_object_table in ('products','orders','order_items')
order by event_object_table,trigger_name,event_manipulation;

-- 6. Available storage budget (approximate size; no customer data).
select pg_size_pretty(pg_database_size(current_database())) as current_database_size;
