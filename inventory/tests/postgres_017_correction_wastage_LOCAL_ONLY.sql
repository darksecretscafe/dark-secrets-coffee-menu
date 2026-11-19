-- LOCAL DISPOSABLE POSTGRES ONLY; after bootstrap + SQL 017.
-- Rollback-only correction, wastage, replay, depletion and rejection checks.
begin;
do $$
declare
 v_item uuid;
 v_movement uuid;
 v_replay uuid;
 v_qty numeric;
 v_wac numeric;
 v_count integer;
begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 v_item := public.inventory_save_item_draft(
   null,'TEST-CORR-001','Local correction beans','Coffee',
   'ingredient','g','kg',0,true,null,null,null
 );
 perform public.inventory_receive_stock_draft(
   v_item,1,'kg',200,'LOCAL-CORR-RECEIPT',
   '66666666-6666-4666-8666-666666666666'::uuid
 );
 select movement_id,balance_base,average_unit_cost
 into v_movement,v_qty,v_wac
 from public.inventory_correct_stock_draft(
   v_item,'wastage',-250,null,'Local spilled beans',
   '77777777-7777-4777-8777-777777777777'::uuid
 );
 if v_qty <> 750 or v_wac <> 0.2 then
   raise exception 'Wastage valuation wrong: quantity %, WAC %',v_qty,v_wac;
 end if;
 select movement_id,balance_base,average_unit_cost
 into v_replay,v_qty,v_wac
 from public.inventory_correct_stock_draft(
   v_item,'wastage',-250,null,'Local spilled beans',
   '77777777-7777-4777-8777-777777777777'::uuid
 );
 if v_replay is distinct from v_movement or v_qty <> 750 or v_wac <> 0.2 then
   raise exception 'Wastage replay changed result';
 end if;
 begin
   perform public.inventory_correct_stock_draft(
     v_item,'wastage',-751,null,'Too much wastage',
     '88888888-8888-4888-8888-888888888888'::uuid
   );
   raise exception 'TEST FAILURE: negative stock accepted';
 exception when raise_exception then
   if sqlerrm <> 'Insufficient stock' then raise; end if;
 end;
 select balance_base,average_unit_cost into v_qty,v_wac
 from public.inventory_correct_stock_draft(
   v_item,'adjustment',-750,null,'Full local stock depletion',
   '99999999-9999-4999-8999-999999999999'::uuid
 );
 if v_qty <> 0 or v_wac is not null then
   raise exception 'Full depletion wrong: qty %, WAC %',v_qty,v_wac;
 end if;
 if (select stock_value from public.inventory_stock_state where item_id=v_item) <> 0 then
   raise exception 'Full depletion left residual stock value';
 end if;
 select count(*) into v_count from public.inventory_stock_movements where item_id=v_item;
 if v_count <> 3 then
   raise exception 'Expected 3 movements (receive,wastage,deplete), found %',v_count;
 end if;
 raise notice 'PASS: wastage, idempotent replay, insufficient-stock denial and full depletion';
end $$;
rollback;
