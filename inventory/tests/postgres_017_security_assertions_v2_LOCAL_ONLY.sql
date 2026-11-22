-- LOCAL DISPOSABLE POSTGRES ONLY. Execute AFTER bootstrap + SQL 017.
-- Catalog checks do not replace real authenticated RLS integration tests.
do $$
declare
 v_table text;
 v_rpc text;
 v_signature text;
 v_is_definer boolean;
begin
 foreach v_table in array array[
   'inventory_items','inventory_stock_movements','inventory_recipes',
   'inventory_recipe_lines','inventory_settings','inventory_stock_state',
   'inventory_request_registry'
 ] loop
   if to_regclass('public.' || v_table) is null then
     raise exception 'Missing table: %', v_table;
   end if;
   if not (select relrowsecurity from pg_class where oid=to_regclass('public.' || v_table)) then
     raise exception 'RLS disabled: %', v_table;
   end if;
   if has_table_privilege('anon','public.' || v_table,'SELECT') then
     raise exception 'Anon can SELECT %',v_table;
   end if;
   if has_table_privilege('authenticated','public.' || v_table,'INSERT')
      or has_table_privilege('authenticated','public.' || v_table,'UPDATE')
      or has_table_privilege('authenticated','public.' || v_table,'DELETE') then
     raise exception 'Direct browser writes permitted on %',v_table;
   end if;
 end loop;

 foreach v_signature in array array[
  'public.inventory_save_item_draft(uuid,text,text,text,text,text,text,numeric,boolean,text,text,text)',
  'public.inventory_receive_stock_draft(uuid,numeric,text,numeric,text,uuid)',
  'public.inventory_correct_stock_draft(uuid,text,numeric,numeric,text,uuid)',
  'public.inventory_save_recipe_draft(uuid,jsonb,numeric)'
 ] loop
   if to_regprocedure(v_signature) is null then
     raise exception 'Missing RPC: %',v_signature;
   end if;
   if has_function_privilege('anon',v_signature,'EXECUTE') then
     raise exception 'Anon can execute RPC: %',v_signature;
   end if;
   if not has_function_privilege('authenticated',v_signature,'EXECUTE') then
     raise exception 'Authenticated cannot execute RPC: %',v_signature;
   end if;
   select prosecdef into v_is_definer from pg_proc
    where oid=to_regprocedure(v_signature);
   if v_is_definer is distinct from true then
     raise exception 'RPC not SECURITY DEFINER: %',v_signature;
   end if;
 end loop;

 if (select automatic_inventory_enabled from public.inventory_settings where singleton=true)
    is distinct from false then
   raise exception 'Automatic stock deduction must remain OFF';
 end if;
 raise notice 'PASS: seven tables, RLS, direct-write denial, four RPC grants/definer and auto deduction OFF';
end $$;
