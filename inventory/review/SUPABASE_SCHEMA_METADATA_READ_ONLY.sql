-- READ-ONLY schema metadata review. No DDL/DML, credentials, customer rows or secrets.
-- Optional: run ONLY in an authorized Supabase SQL editor after reviewing queries.
-- This script is NOT a backup and does NOT validate real Auth JWT behavior.
-- Outputs metadata about compatibility with inventory SQL 017.
select 'product_columns' as section, table_schema, table_name, column_name,
       data_type, udt_name, is_nullable
from information_schema.columns
where table_schema='public' and table_name='products'
order by ordinal_position;

select 'existing_inventory_relations' as section, n.nspname as schema_name,
       c.relname as object_name, c.relkind as object_type, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'inventory\\_%' escape '\\'
order by c.relname;

select 'existing_inventory_routines' as section, n.nspname as schema_name,
       p.proname as function_name, pg_get_function_identity_arguments(p.oid) as argument_types,
       p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'inventory\\_%' escape '\\'
order by p.proname;

select 'admin_function' as section, n.nspname as schema_name,
       p.proname as function_name, pg_get_function_identity_arguments(p.oid) as argument_types,
       p.prosecdef as security_definer,
       p.proconfig as function_settings
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='is_admin';

select 'product_primary_key' as section, tc.table_schema, tc.table_name,
       kcu.column_name, c.data_type
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
 on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema
 and kcu.table_name=tc.table_name
join information_schema.columns c
 on c.table_schema=kcu.table_schema and c.table_name=kcu.table_name
 and c.column_name=kcu.column_name
where tc.table_schema='public' and tc.table_name='products'
 and tc.constraint_type='PRIMARY KEY'
order by kcu.ordinal_position;

-- Share only reviewed metadata results; do not share credentials, customer rows,
-- JWTs, database connection strings, or full function definitions.
