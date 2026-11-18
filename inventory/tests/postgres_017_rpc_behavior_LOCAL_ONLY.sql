-- LOCAL DISPOSABLE POSTGRES ONLY; after bootstrap + SQL 017.
-- Function-level behavior checks with mock auth.uid()/is_admin().
-- This does NOT impersonate actual Supabase roles or prove RLS correctness.
begin;
do $$
declare
  v_item uuid;
  v_recipe uuid;
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  v_item := public.inventory_save_item_draft(
    null,'TEST-BEAN-001','Local test beans','Coffee','ingredient',
    'g','kg',0,true,'Local only',null,null
  );
  if v_item is null then raise exception 'Item RPC returned NULL'; end if;

  v_recipe := public.inventory_save_recipe_draft(
    '22222222-2222-4222-8222-222222222222'::uuid,
    jsonb_build_array(jsonb_build_object('item_id',v_item,'quantity_base',18)),
    65
  );
  if v_recipe is null then raise exception 'Recipe RPC returned NULL'; end if;

  select count(*) into v_count from public.inventory_recipe_lines
   where recipe_id=v_recipe and item_id=v_item and quantity_base=18;
  if v_count <> 1 then raise exception 'Recipe line not persisted in transaction'; end if;

  -- Check function-level rejection when mock auth is not an admin.
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  begin
    perform public.inventory_save_recipe_draft(
      '22222222-2222-4222-8222-222222222222'::uuid,'[]'::jsonb,null
    );
    raise exception 'SECURITY FAILURE: nonadmin recipe save unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  -- Check anonymous mock rejection.
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.inventory_save_item_draft(
      null,'TEST-DENIED','Denied','Coffee','ingredient','g','kg',0,true,
      null,null,null
    );
    raise exception 'SECURITY FAILURE: anonymous item save unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'PASS: mock admin item+recipe writes and mock nonadmin/anonymous RPC denials';
end $$;
rollback;
-- Rollback guarantees this behavioral smoke test leaves no inventory test rows.
