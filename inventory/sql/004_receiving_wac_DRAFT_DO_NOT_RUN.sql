-- Dark Secrets Coffee — RECEIVING + WAC DESIGN DRAFT. DO NOT RUN ON LIVE.
-- Isolated testing only after security and foundation schema review.
-- Does not touch products, orders, menu prices or automatic deductions.
-- This is an additive extension of proposed 001 foundation, NOT a standalone migration.
begin;
do $$
begin
 if to_regclass('public.inventory_items') is null
    or to_regclass('public.inventory_stock_movements') is null then
   raise exception 'Foundation missing; stop';
 end if;
 if to_regclass('public.inventory_stock_state') is not null
    or to_regclass('public.inventory_receive_requests') is not null then
   raise exception 'Receiving draft objects already exist; stop and review';
 end if;
end $$;

-- State is a cached, locked balance and valuation; ledger remains historical record.
create table public.inventory_stock_state (
 item_id uuid primary key references public.inventory_items(id) on delete restrict,
 quantity_base numeric(20,4) not null default 0 check (quantity_base >= 0),
 stock_value numeric(24,6) not null default 0 check (stock_value >= 0),
 updated_at timestamptz not null default now(),
 constraint stock_zero_value check (quantity_base <> 0 or stock_value = 0)
);

-- One durable idempotency result per unique request; payload equality required on replay.
create table public.inventory_receive_requests (
 request_key uuid primary key,
 item_id uuid not null references public.inventory_items(id) on delete restrict,
 purchase_quantity numeric(20,4) not null,
 purchase_unit text not null,
 total_cost numeric(20,4) not null,
 reference text not null,
 movement_id uuid not null unique references public.inventory_stock_movements(id) on delete restrict,
 created_by uuid not null,
 created_at timestamptz not null default now()
);

revoke all on public.inventory_stock_state, public.inventory_receive_requests
 from public, anon, authenticated;
alter table public.inventory_stock_state enable row level security;
alter table public.inventory_receive_requests enable row level security;
grant select on public.inventory_stock_state to authenticated;
create policy stock_state_admin_read on public.inventory_stock_state
 for select to authenticated using ((select public.is_admin()));
-- No browser grants for idempotency requests, state writes, or movement inserts.

create function public.inventory_receive_stock_draft(
 p_item_id uuid, p_purchase_quantity numeric, p_purchase_unit text,
 p_total_cost numeric, p_reference text, p_request_key uuid
) returns table(movement_id uuid, balance_base numeric, average_unit_cost numeric)
language plpgsql security definer set search_path = ''
as $fn$
declare
 v_actor uuid;
 v_item record;
 v_factor numeric;
 v_base numeric;
 v_prior public.inventory_stock_state%rowtype;
 v_old public.inventory_receive_requests%rowtype;
 v_movement uuid;
 v_qty numeric;
 v_value numeric;
begin
 v_actor := auth.uid();
 if v_actor is null or (select public.is_admin()) is distinct from true then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 if p_item_id is null or p_request_key is null
    or p_purchase_quantity is null or p_purchase_quantity <= 0
    or p_total_cost is null or p_total_cost < 0
    or p_purchase_unit is null or p_reference is null
    or length(btrim(p_reference)) = 0 or length(p_reference) > 250 then
   raise exception 'Invalid receiving request';
 end if;
 if p_purchase_quantity > 999999999999.9999
    or p_purchase_quantity <> round(p_purchase_quantity,4)
    or p_total_cost > 999999999999.9999
    or p_total_cost <> round(p_total_cost,4) then
   raise exception 'Invalid numeric precision or amount';
 end if;
 -- Acquire idempotency lock before item lock to avoid lock-order inversion.
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
 -- Item row lock serializes receiving for this item, including same-key replay.
 select base_unit, is_active into v_item
 from public.inventory_items where id=p_item_id for update;
 if not found or v_item.is_active is distinct from true then
   raise exception 'Unknown or inactive inventory item';
 end if;
 v_factor := case
   when v_item.base_unit='g' and p_purchase_unit='kg' then 1000
   when v_item.base_unit='ml' and p_purchase_unit='l' then 1000
   when v_item.base_unit=p_purchase_unit then 1
   else null end;
 if v_factor is null then raise exception 'Incompatible purchase unit'; end if;
 v_base := p_purchase_quantity*v_factor;
 if v_base > 9999999999999999.9999 then
   raise exception 'Converted quantity exceeds storage capacity';
 end if;

 -- Same-key requests are serialized by the earlier advisory lock.
 select * into v_old from public.inventory_receive_requests
 where request_key=p_request_key;
 if found then
   if v_old.item_id is distinct from p_item_id
      or v_old.purchase_quantity is distinct from p_purchase_quantity
      or v_old.purchase_unit is distinct from p_purchase_unit
      or v_old.total_cost is distinct from p_total_cost
      or v_old.reference is distinct from p_reference
      or v_old.created_by is distinct from v_actor then
     raise exception 'Idempotency key reused with different request';
   end if;
   select quantity_base, stock_value into v_qty,v_value
   from public.inventory_stock_state where item_id=p_item_id;
   return query select v_old.movement_id, v_qty,
     case when v_qty > 0 then v_value/v_qty else null::numeric end;
   return;
 end if;

 insert into public.inventory_stock_state(item_id) values(p_item_id)
 on conflict(item_id) do nothing;
 select * into v_prior from public.inventory_stock_state
 where item_id=p_item_id for update;
 v_qty := v_prior.quantity_base + v_base;
 v_value := v_prior.stock_value + p_total_cost;
 if v_qty > 9999999999999999.9999
    or v_value > 999999999999999999.999999 then
   raise exception 'Stock state exceeds storage capacity';
 end if;

 insert into public.inventory_stock_movements
 (item_id,movement_type,quantity_delta,unit_cost,reference,notes,created_by)
 values (p_item_id,'receive',v_base,
         round(p_total_cost/v_base,6),p_reference,
         'Purchase quantity '||p_purchase_quantity||' '||p_purchase_unit||
         '; total cost '||p_total_cost,v_actor)
 returning id into v_movement;
 update public.inventory_stock_state set quantity_base=v_qty,
 stock_value=v_value, updated_at=now() where item_id=p_item_id;
 insert into public.inventory_receive_requests
 (request_key,item_id,purchase_quantity,purchase_unit,total_cost,
  reference,movement_id,created_by)
 values(p_request_key,p_item_id,p_purchase_quantity,p_purchase_unit,
        p_total_cost,p_reference,v_movement,v_actor);
 return query select v_movement,v_qty,v_value/v_qty;
end;
$fn$;
revoke all on function public.inventory_receive_stock_draft(uuid,numeric,text,numeric,text,uuid)
 from public, anon, authenticated;
grant execute on function public.inventory_receive_stock_draft(uuid,numeric,text,numeric,text,uuid)
 to authenticated;
commit;

-- OPEN REVIEW ISSUES: Requires test of SECURITY DEFINER owner, RLS and is_admin,
-- audit of immutable ledger protection, and overflow/precision boundaries.
-- Idempotent replay returns CURRENT balance/WAC, not historical post-receipt snapshot.
-- Current stock movement ledger lacks total receipt cost as a first-class column:
-- historical WAC reconstruction should be designed before production.
