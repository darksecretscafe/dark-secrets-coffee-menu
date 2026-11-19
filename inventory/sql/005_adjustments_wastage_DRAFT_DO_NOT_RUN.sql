-- Dark Secrets Coffee — STOCK ADJUSTMENTS & WASTAGE (DRAFT ONLY)
-- DO NOT RUN ON LIVE. For isolated database review/testing only.
-- Depends on proposed 001 foundation and 004 receiving/WAC draft.
-- No menu, products, orders, LIVE prices or automatic deductions modified.
begin;
do $$
begin
 if to_regclass('public.inventory_items') is null
 or to_regclass('public.inventory_stock_state') is null
 or to_regclass('public.inventory_stock_movements') is null then
   raise exception 'Inventory foundation and stock state missing';
 end if;
 if to_regclass('public.inventory_correction_requests') is not null then
   raise exception 'Correction request table already exists; stop and review';
 end if;
end $$;

create table public.inventory_correction_requests (
 request_key uuid primary key,
 item_id uuid not null references public.inventory_items(id) on delete restrict,
 correction_type text not null check (correction_type in ('adjustment','wastage')),
 quantity_delta numeric(20,4) not null check (quantity_delta <> 0),
 added_value numeric(20,4),
 reason text not null,
 movement_id uuid not null unique references public.inventory_stock_movements(id) on delete restrict,
 created_by uuid not null,
 created_at timestamptz not null default now()
);
revoke all on public.inventory_correction_requests from public, anon, authenticated;
alter table public.inventory_correction_requests enable row level security;
-- No browser SELECT/INSERT/UPDATE/DELETE on correction requests.

create function public.inventory_correct_stock_draft(
 p_item_id uuid,
 p_correction_type text,
 p_quantity_delta numeric,
 p_added_value numeric,
 p_reason text,
 p_request_key uuid
)
returns table(movement_id uuid, balance_base numeric, average_unit_cost numeric)
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid;
 v_item public.inventory_items%rowtype;
 v_old public.inventory_correction_requests%rowtype;
 v_state public.inventory_stock_state%rowtype;
 v_qty numeric;
 v_value numeric;
 v_removed_value numeric;
 v_unit_cost numeric;
 v_movement uuid;
begin
 v_actor := auth.uid();
 if v_actor is null or (select public.is_admin()) is distinct from true then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 if p_item_id is null or p_request_key is null
    or p_correction_type not in ('adjustment','wastage')
    or p_correction_type is null
    or p_quantity_delta is null or p_quantity_delta=0
    or abs(p_quantity_delta)>999999999999.9999
    or p_quantity_delta<>round(p_quantity_delta,4)
    or p_reason is null or length(btrim(p_reason))=0
    or length(p_reason)>250 then
   raise exception 'Invalid stock correction';
 end if;
 if p_correction_type='wastage' and p_quantity_delta>=0 then
   raise exception 'Wastage must decrease stock';
 end if;
 if p_quantity_delta>0 then
   if p_correction_type<>'adjustment'
      or p_added_value is null or p_added_value<0
      or p_added_value>999999999999.9999
      or p_added_value<>round(p_added_value,4) then
     raise exception 'Positive adjustment requires explicit added stock value';
   end if;
 elsif p_added_value is not null then
   raise exception 'Negative correction must not specify added value';
 end if;

 -- Lock idempotency key first, then item. This is consistent with receiving.
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,0));
 select * into v_old from public.inventory_correction_requests
 where request_key=p_request_key;
 if found then
   if v_old.item_id is distinct from p_item_id
      or v_old.correction_type is distinct from p_correction_type
      or v_old.quantity_delta is distinct from p_quantity_delta
      or v_old.added_value is distinct from p_added_value
      or v_old.reason is distinct from p_reason
      or v_old.created_by is distinct from v_actor then
     raise exception 'Idempotency key reused with different correction';
   end if;
   select quantity_base,stock_value into v_qty,v_value
   from public.inventory_stock_state where item_id=p_item_id;
   return query select v_old.movement_id,v_qty,
     case when v_qty>0 then v_value/v_qty else null::numeric end;
   return;
 end if;

 select * into v_item from public.inventory_items where id=p_item_id for update;
 if not found or v_item.is_active is distinct from true then
   raise exception 'Unknown or inactive stock item';
 end if;
 insert into public.inventory_stock_state(item_id) values(p_item_id)
 on conflict(item_id) do nothing;
 select * into v_state from public.inventory_stock_state
 where item_id=p_item_id for update;

 if p_quantity_delta<0 then
   if v_state.quantity_base < abs(p_quantity_delta) then
     raise exception 'Insufficient stock';
   end if;
   if v_state.quantity_base<=0 then raise exception 'No valued stock available'; end if;
   v_unit_cost:=v_state.stock_value/v_state.quantity_base;
   -- Removing all stock removes all its value, avoiding rounding residuals.
   v_removed_value:=case when abs(p_quantity_delta)=v_state.quantity_base
     then v_state.stock_value
     else round(v_unit_cost*abs(p_quantity_delta),6) end;
   v_qty:=v_state.quantity_base+p_quantity_delta;
   v_value:=v_state.stock_value-v_removed_value;
 else
   v_qty:=v_state.quantity_base+p_quantity_delta;
   v_value:=v_state.stock_value+p_added_value;
   v_unit_cost:=p_added_value/p_quantity_delta;
 end if;
 if v_qty<0 or v_qty>9999999999999999.9999
    or v_value<0 or v_value>999999999999999999.999999 then
   raise exception 'Stock balance or valuation out of range';
 end if;

 insert into public.inventory_stock_movements
 (item_id,movement_type,quantity_delta,unit_cost,reference,notes,created_by)
 values (p_item_id,p_correction_type,p_quantity_delta,
         round(v_unit_cost,6),p_request_key::text,p_reason,v_actor)
 returning id into v_movement;
 update public.inventory_stock_state
 set quantity_base=v_qty,stock_value=v_value,updated_at=now()
 where item_id=p_item_id;
 insert into public.inventory_correction_requests
 (request_key,item_id,correction_type,quantity_delta,added_value,
  reason,movement_id,created_by)
 values (p_request_key,p_item_id,p_correction_type,p_quantity_delta,
         p_added_value,p_reason,v_movement,v_actor);
 return query select v_movement,v_qty,
   case when v_qty>0 then v_value/v_qty else null::numeric end;
end;
$fn$;
revoke all on function public.inventory_correct_stock_draft(uuid,text,numeric,numeric,text,uuid)
 from public, anon, authenticated;
grant execute on function public.inventory_correct_stock_draft(uuid,text,numeric,numeric,text,uuid)
 to authenticated;
commit;

-- REVIEW GATES (not resolved):
-- 1. Validate function owner, RLS and public.is_admin() against real schema.
-- 2. Prevent direct ledger mutations by any untrusted role; add append-only
--    protections and a first-class valuation delta for reproducible audits.
-- 3. Isolated tests: insufficient stock, concurrency, same-key replay,
--    zero-value positive adjustment, exact full depletion and precision.
-- 4. Consider whether zero-value positive adjustments should be permitted
--    under owner-approved documented policy; do not treat missing as zero.
-- 5. Coordinate unique request keys across receive and correction RPCs
--    (currently separate key tables; cross-operation reuse is possible).
-- 6. This RPC returns current balance on replay, not original snapshot.
