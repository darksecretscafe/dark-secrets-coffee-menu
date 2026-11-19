-- Inventory Phase 2: post-install security audit (READ ONLY)
-- DO NOT RUN BEFORE REVIEWED DEPLOYMENT. NO DDL/DML.
-- Run AFTER a separately approved migration; not a deployment script.
select n.nspname as schema_name,c.relname as table_name,
 c.relrowsecurity as rls_enabled,
 pg_catalog.has_table_privilege('anon',c.oid,'INSERT') as anon_insert,
 pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
 pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update,
 pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_delete
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
and c.relname like 'inventory_%'
order by c.relname;
select p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
 p.prosecdef as security_definer, pg_catalog.pg_get_userbyid(p.proowner) as owner,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'inventory_%'
order by p.proname;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_catalog.pg_policies
where schemaname='public' and tablename like 'inventory_%'
order by tablename,policyname;
