-- LOCAL ONLY: catalog assertions after 017. No production access.
do $$
declare
 v_count integer;
 v_flag boolean;
begin
 select count(*) into v_count
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in (
   'inventory_items','inventory_stock_movements','inventory_recipes',
   'inventory_recipe_lines','inventory_settings','inventory_stock_state',
   'inventory_request_registry') and c.relkind='r';
 if v_count <> 7 then raise exception 'Expected seven inventory tables, found %',v_count; end if;

 select automatic_inventory_enabled into v_flag from public.inventory_settings;
 if v_flag is distinct from false then raise exception 'Auto inventory must default OFF'; end if;

 select count(*) into v_count from pg_class c
 join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname like 'inventory_%'
 and c.relkind='r' and not c.relrowsecurity;
 if v_count <> 0 then raise exception 'Inventory table without RLS: %',v_count; end if;

 if not has_function_privilege('authenticated',
   'public.inventory_save_recipe_draft(uuid,jsonb,numeric)','EXECUTE') then
   raise exception 'Authenticated recipe RPC grant missing';
 end if;
 if has_function_privilege('anon',
   'public.inventory_save_recipe_draft(uuid,jsonb,numeric)','EXECUTE') then
   raise exception 'Anon recipe RPC must not be executable';
 end if;
 raise notice 'PASS: inventory tables, RLS, disabled automatic inventory, recipe RPC grants';
end $$;
