-- DISPOSABLE LOCAL POSTGRES ONLY. Requires bootstrap + SQL 017.
-- Rollback-only receiving, WAC, idempotency and payload mismatch smoke test.
begin;
do $$
declare
  v_item uuid;
  v_key uuid := '44444444-4444-4444-8444-444444444444';
  v_key2 uuid := '55555555-5555-4555-8555-555555555555';
  v_movement uuid;
  v_replay uuid;
  v_qty numeric;
  v_cost numeric;
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  v_item := public.inventory_save_item_draft(
    null,'TEST-WAC-001','Local WAC beans','Coffee','ingredient',
    'g','kg',0,true,null,null,null
  );

  select movement_id,balance_base,average_unit_cost
    into v_movement,v_qty,v_cost
  from public.inventory_receive_stock_draft(v_item,1,'kg',100,'LOCAL-WAC-1',v_key);
  if v_qty <> 1000 or v_cost <> 0.1 then
    raise exception 'First receipt WAC wrong: qty %, cost %',v_qty,v_cost;
  end if;

  select movement_id,balance_base,average_unit_cost
    into v_replay,v_qty,v_cost
  from public.inventory_receive_stock_draft(v_item,1,'kg',100,'LOCAL-WAC-1',v_key);
  if v_replay is distinct from v_movement or v_qty <> 1000 or v_cost <> 0.1 then
    raise exception 'Same-key replay changed result';
  end if;

  select count(*) into v_count from public.inventory_stock_movements where item_id=v_item;
  if v_count <> 1 then raise exception 'Replay generated extra ledger movement'; end if;

  select balance_base,average_unit_cost into v_qty,v_cost
  from public.inventory_receive_stock_draft(v_item,1,'kg',300,'LOCAL-WAC-2',v_key2);
  if v_qty <> 2000 or v_cost <> 0.2 then
    raise exception 'Weighted average wrong: qty %, cost %',v_qty,v_cost;
  end if;

  begin
    perform public.inventory_receive_stock_draft(v_item,1,'kg',999,'LOCAL-WAC-1',v_key);
    raise exception 'TEST FAILURE: changed-payload replay accepted';
  exception
    when raise_exception then
      if sqlerrm = 'TEST FAILURE: changed-payload replay accepted' then
        raise;
      end if;
      if sqlerrm <> 'Idempotency key reused with different request' then
        raise exception 'Unexpected changed-payload error: %',sqlerrm;
      end if;
  end;

  select count(*) into v_count from public.inventory_stock_movements where item_id=v_item;
  if v_count <> 2 then raise exception 'Expected exactly two ledger movements'; end if;
  raise notice 'PASS: receipt conversion, WAC, same-key replay and payload conflict';
end $$;
rollback;
