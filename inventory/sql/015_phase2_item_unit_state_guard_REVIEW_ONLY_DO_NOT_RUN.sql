-- REVISION 015: item base-unit changes blocked when stock state exists,
-- including zero-balance initialized items. REVIEW ONLY; NEVER RUN ON LIVE.
-- REVISION 014: inventory item metadata via admin RPC; no direct browser writes.
-- UNTESTED DRAFT. DO NOT RUN ON LIVE.
-- REVISION 013: recipe writes via validated admin RPC only; item metadata remains admin-writable.
-- UNTESTED REVIEW DRAFT. DO NOT RUN ON LIVE.
-- REVISION 011: receiving replay before item-active check; correct stale comments.
-- UNTESTED REVIEW DRAFT. DO NOT RUN ON LIVE.
-- REVISED DRAFT; NEVER RUN ON LIVE; not runtime tested.
-- PHASE 2 UNIFIED CANDIDATE — ISOLATED TEST ONLY, NEVER RUN ON LIVE
-- NOT EXECUTED OR VERIFIED IN POSTGRES/SUPABASE. Requires independent security review.
-- No order deductions, live price updates, or changes to existing public.products.
-- Atomic single transaction; inspect each section and test in disposable database.
begin;
-- Dark Secrets Coffee Inventory — Phase 1 foundation (REVIEW ONLY).
-- DO NOT run on LIVE Supabase until separately approved.
-- Additive schema only. Does not change products, orders, checkout, or prices.
-- Uses existing public.is_admin() RPC for admin-only access.

-- Fail closed if an inventory object already exists. Do not silently adopt
-- pre-existing tables with unknown columns, grants, policies or data.
do $$
declare v_name text;
begin
  foreach v_name in array array[
    'inventory_items','inventory_stock_movements','inventory_recipes',
    'inventory_recipe_lines','inventory_settings',
    'inventory_stock_state','inventory_request_registry'
  ] loop
    if to_regclass('public.' || v_name) is not null then
      raise exception 'Inventory table already exists: %. Stop and review.', v_name;
    end if;
  end loop;
end $$;

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique,
  name text not null,
  category text not null,
  item_type text not null check (item_type in ('ingredient','packaging')),
  base_unit text not null check (base_unit in ('ml','g','pcs')),
  preferred_purchase_unit text not null check (preferred_purchase_unit in ('ml','l','g','kg','pcs')),
  minimum_stock numeric(16,4) not null default 0 check (minimum_stock >= 0),
  preferred_supplier text,
  brand text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_item_unit_family check (
    (base_unit='ml' and preferred_purchase_unit in ('ml','l')) or
    (base_unit='g' and preferred_purchase_unit in ('g','kg')) or
    (base_unit='pcs' and preferred_purchase_unit='pcs')
  )
);

create table public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening','receive','adjustment','wastage','order_deduction','reversal')),
  quantity_delta numeric(20,4) not null check (quantity_delta <> 0),
  unit_cost numeric check (unit_cost >= 0),
  value_delta numeric(24,6) not null,
  request_key uuid not null unique,
  quantity_after numeric(20,4) not null check (quantity_after >= 0),
  value_after numeric(24,6) not null check (value_after >= 0),
  reference text,
  supplier text,
  invoice_number text,
  batch_number text,
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);
create index inventory_movements_item_created_idx
  on public.inventory_stock_movements(item_id, created_at desc);

create table public.inventory_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete restrict,
  is_configured boolean not null default false,
  target_margin_percent numeric(6,3) check (target_margin_percent >= 0 and target_margin_percent < 100),
  updated_at timestamptz not null default now()
);
create table public.inventory_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.inventory_recipes(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_base numeric(16,4) not null check (quantity_base > 0),
  unique (recipe_id, item_id)
);

create table public.inventory_settings (
  singleton boolean primary key default true check (singleton),
  automatic_inventory_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.inventory_settings(singleton, automatic_inventory_enabled)
values (true,false);

-- RLS is an additional gate; explicit privileges below also restrict direct ledger writes.
-- Privilege model: item and recipe writes must pass validated admin RPCs.
-- Recipe writes must use the validated inventory_save_recipe_draft RPC.
-- Browser roles cannot directly modify items, recipes, ledger, balances, registry or settings.
-- RLS additionally restricts inventory SELECT to admins.
revoke all on public.inventory_items, public.inventory_stock_movements,
  public.inventory_recipes, public.inventory_recipe_lines,
  public.inventory_settings from public, anon, authenticated;
grant select on public.inventory_items to authenticated;
grant select on public.inventory_stock_movements to authenticated;
grant select on public.inventory_recipes to authenticated;
grant select on public.inventory_recipe_lines to authenticated;
grant select on public.inventory_settings to authenticated;

-- Deny all access by default except authenticated admins via existing is_admin().
-- Service roles retain their normal elevated access.
alter table public.inventory_items enable row level security;
alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_recipes enable row level security;
alter table public.inventory_recipe_lines enable row level security;
alter table public.inventory_settings enable row level security;

create policy inventory_items_admin_read on public.inventory_items
  for select to authenticated using ((select public.is_admin()));
-- Ledger is read-only to browser clients, including admins. Future server-side
-- transactional RPCs must append entries with validation and an audit trail.
-- No direct INSERT, UPDATE, or DELETE from the client.
create policy inventory_movements_admin_read on public.inventory_stock_movements
  for select to authenticated using ((select public.is_admin()));
create policy inventory_recipes_admin_read on public.inventory_recipes
  for select to authenticated using ((select public.is_admin()));
create policy inventory_recipe_lines_admin_read on public.inventory_recipe_lines
  for select to authenticated using ((select public.is_admin()));
create policy inventory_settings_admin on public.inventory_settings
  for select to authenticated using ((select public.is_admin()));

-- The inventory settings table is read-only to browser clients.
-- Do not grant direct INSERT, UPDATE or DELETE on inventory tables to browser roles.
-- Other inventory tables still require privilege/RLS verification before deployment.
-- No client-side update policy for activation. Activation must be implemented
-- later through a verified, server-side admin-only function with validation.


-- Item metadata must be saved through this validated admin-only function.
-- Stock quantities and costs are intentionally not accepted here.
create function public.inventory_save_item_draft(
 p_item_id uuid, p_item_code text, p_name text, p_category text,
 p_item_type text, p_base_unit text, p_purchase_unit text,
 p_minimum_stock numeric, p_is_active boolean,
 p_supplier text default null, p_brand text default null, p_notes text default null
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_id uuid;
begin
 if auth.uid() is null or (select public.is_admin()) is distinct from true then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 if p_item_code is null or length(btrim(p_item_code)) not between 1 and 50
    or p_name is null or length(btrim(p_name)) not between 1 and 150
    or p_category is null or length(btrim(p_category)) not between 1 and 80
    or p_item_type is null or p_item_type not in ('ingredient','packaging')
    or p_base_unit is null or p_base_unit not in ('g','ml','pcs')
    or p_purchase_unit is null or p_purchase_unit not in ('g','kg','ml','l','pcs')
    or p_minimum_stock is null or p_minimum_stock < 0
    or p_minimum_stock > 999999999999.9999
    or p_minimum_stock <> round(p_minimum_stock,4)
    or p_is_active is null
    or (p_supplier is not null and length(p_supplier)>150)
    or (p_brand is not null and length(p_brand)>150)
    or (p_notes is not null and length(p_notes)>1000)
    or not (
      (p_base_unit='g' and p_purchase_unit in ('g','kg')) or
      (p_base_unit='ml' and p_purchase_unit in ('ml','l')) or
      (p_base_unit='pcs' and p_purchase_unit='pcs')
    ) then
   raise exception 'Invalid inventory item metadata';
 end if;
 if p_item_id is null then
   insert into public.inventory_items
     (item_code,name,category,item_type,base_unit,preferred_purchase_unit,
      minimum_stock,is_active,preferred_supplier,brand,notes)
   values (btrim(p_item_code),btrim(p_name),btrim(p_category),p_item_type,
           p_base_unit,p_purchase_unit,p_minimum_stock,p_is_active,
           p_supplier,p_brand,p_notes)
   returning id into v_id;
 else
   -- Unit changes after any ledger or recipe use would invalidate history.
   perform 1 from public.inventory_items where id=p_item_id for update;
   if not found then raise exception 'Unknown inventory item'; end if;
   if exists (select 1 from public.inventory_stock_movements where item_id=p_item_id)
      or exists (select 1 from public.inventory_stock_state where item_id=p_item_id)
      or exists (select 1 from public.inventory_recipe_lines where item_id=p_item_id) then
     if exists (
       select 1 from public.inventory_items where id=p_item_id
         and (item_type is distinct from p_item_type
           or base_unit is distinct from p_base_unit)
     ) then
       raise exception 'Cannot change item type or base unit after use';
     end if;
   end if;
   update public.inventory_items
   set item_code=btrim(p_item_code),name=btrim(p_name),category=btrim(p_category),
       item_type=p_item_type,base_unit=p_base_unit,
       preferred_purchase_unit=p_purchase_unit,minimum_stock=p_minimum_stock,
       is_active=p_is_active,preferred_supplier=p_supplier,brand=p_brand,
       notes=p_notes,updated_at=now()
   where id=p_item_id
   returning id into v_id;
 end if;
 return v_id;
end;
$fn$;
revoke all on function public.inventory_save_item_draft(uuid,text,text,text,text,text,text,numeric,boolean,text,text,text)
 from public,anon,authenticated;
grant execute on function public.inventory_save_item_draft(uuid,text,text,text,text,text,text,numeric,boolean,text,text,text)
 to authenticated;

-- Dark Secrets Coffee — RECEIVING + WAC DESIGN DRAFT. DO NOT RUN ON LIVE.
-- Isolated testing only after security and foundation schema review.
-- Does not touch products, orders, menu prices or automatic deductions.
-- This is an additive extension of proposed 001 foundation, NOT a standalone migration.

do $$
begin
 if to_regclass('public.inventory_items') is null
    or to_regclass('public.inventory_stock_movements') is null then
   raise exception 'Foundation missing; stop';
 end if;
 if to_regclass('public.inventory_stock_state') is not null
    or to_regclass('public.inventory_request_registry') is not null then
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

create table public.inventory_request_registry (
 request_key uuid primary key,
 operation text not null check(operation in ('receive','adjustment','wastage')),
 item_id uuid not null references public.inventory_items(id) on delete restrict,
 payload jsonb not null,
 movement_id uuid not null unique references public.inventory_stock_movements(id) on delete restrict,
 created_by uuid not null,
 quantity_after numeric(20,4) not null,
 value_after numeric(24,6) not null,
 created_at timestamptz not null default now()
);

revoke all on public.inventory_stock_state, public.inventory_request_registry
 from public, anon, authenticated;
alter table public.inventory_stock_state enable row level security;
alter table public.inventory_request_registry enable row level security;
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
 v_old public.inventory_request_registry%rowtype;
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
 -- Replay check must precede item active-state validation, so a valid
 -- retry succeeds even if the item was subsequently deactivated.
 -- Same-key requests are serialized by the earlier advisory lock.
 select * into v_old from public.inventory_request_registry
 where request_key=p_request_key;
 if found then
   if v_old.item_id is distinct from p_item_id
      or v_old.operation <> 'receive'
      or v_old.payload is distinct from jsonb_build_object('purchase_quantity',p_purchase_quantity,'purchase_unit',p_purchase_unit,'total_cost',p_total_cost,'reference',p_reference)
      or v_old.created_by is distinct from v_actor then
     raise exception 'Idempotency key reused with different request';
   end if;
   return query select v_old.movement_id, v_old.quantity_after,
     case when v_old.quantity_after > 0 then v_old.value_after/v_old.quantity_after else null::numeric end;
   return;
 end if;

 -- Item row lock serializes NEW receiving requests after replay is checked.
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
 (item_id,movement_type,quantity_delta,unit_cost,value_delta,request_key,quantity_after,value_after,reference,notes,created_by)
 values (p_item_id,'receive',v_base,
         p_total_cost/v_base,p_total_cost,p_request_key,v_qty,v_value,p_reference,
         'Purchase quantity '||p_purchase_quantity||' '||p_purchase_unit||
         '; total cost '||p_total_cost,v_actor)
 returning id into v_movement;
 update public.inventory_stock_state set quantity_base=v_qty,
 stock_value=v_value, updated_at=now() where item_id=p_item_id;
 insert into public.inventory_request_registry
 (request_key,operation,item_id,payload,movement_id,created_by,quantity_after,value_after)
 values(p_request_key,'receive',p_item_id,
 jsonb_build_object('purchase_quantity',p_purchase_quantity,'purchase_unit',p_purchase_unit,'total_cost',p_total_cost,'reference',p_reference),
 v_movement,v_actor,v_qty,v_value);
 return query select v_movement,v_qty,v_value/v_qty;
end;
$fn$;
revoke all on function public.inventory_receive_stock_draft(uuid,numeric,text,numeric,text,uuid)
 from public, anon, authenticated;
grant execute on function public.inventory_receive_stock_draft(uuid,numeric,text,numeric,text,uuid)
 to authenticated;

-- OPEN REVIEW ISSUES: Requires test of SECURITY DEFINER owner, RLS and is_admin,
-- audit of immutable ledger protection, and overflow/precision boundaries.
-- Idempotent replay returns the original recorded post-receipt balance/WAC snapshot.
-- The ledger stores exact value_delta; validate historical WAC reconstruction before production.

-- Dark Secrets Coffee — STOCK ADJUSTMENTS & WASTAGE (DRAFT ONLY)
-- DO NOT RUN ON LIVE. For isolated database review/testing only.
-- Depends on proposed 001 foundation and 004 receiving/WAC draft.
-- No menu, products, orders, LIVE prices or automatic deductions modified.

do $$
begin
 if to_regclass('public.inventory_items') is null
 or to_regclass('public.inventory_stock_state') is null
 or to_regclass('public.inventory_stock_movements') is null then
   raise exception 'Inventory foundation and stock state missing';
 end if;
end $$;

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
 v_old public.inventory_request_registry%rowtype;
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
 select * into v_old from public.inventory_request_registry
 where request_key=p_request_key;
 if found then
   if v_old.item_id is distinct from p_item_id
      or v_old.operation is distinct from p_correction_type
      or v_old.payload is distinct from jsonb_build_object('quantity_delta',p_quantity_delta,'added_value',p_added_value,'reason',p_reason)
      or v_old.created_by is distinct from v_actor then
     raise exception 'Idempotency key reused with different correction';
   end if;
   return query select v_old.movement_id,v_old.quantity_after,
     case when v_old.quantity_after>0 then v_old.value_after/v_old.quantity_after else null::numeric end;
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
 (item_id,movement_type,quantity_delta,unit_cost,value_delta,request_key,quantity_after,value_after,reference,notes,created_by)
 values (p_item_id,p_correction_type,p_quantity_delta,
         v_unit_cost,case when p_quantity_delta<0 then -v_removed_value else p_added_value end,p_request_key,v_qty,v_value,p_request_key::text,p_reason,v_actor)
 returning id into v_movement;
 update public.inventory_stock_state
 set quantity_base=v_qty,stock_value=v_value,updated_at=now()
 where item_id=p_item_id;
 insert into public.inventory_request_registry
 (request_key,operation,item_id,payload,movement_id,created_by,quantity_after,value_after)
 values (p_request_key,p_correction_type,p_item_id,
 jsonb_build_object('quantity_delta',p_quantity_delta,'added_value',p_added_value,'reason',p_reason),
 v_movement,v_actor,v_qty,v_value);
 return query select v_movement,v_qty,
   case when v_qty>0 then v_value/v_qty else null::numeric end;
end;
$fn$;
revoke all on function public.inventory_correct_stock_draft(uuid,text,numeric,numeric,text,uuid)
 from public, anon, authenticated;
grant execute on function public.inventory_correct_stock_draft(uuid,text,numeric,numeric,text,uuid)
 to authenticated;

-- REVIEW GATES (not resolved):
-- 1. Validate function owner, RLS and public.is_admin() against real schema.
-- 2. Prevent direct ledger mutations by any untrusted role; add append-only
--    protections and a first-class valuation delta for reproducible audits.
-- 3. Isolated tests: insufficient stock, concurrency, same-key replay,
--    zero-value positive adjustment, exact full depletion and precision.
-- 4. Consider whether zero-value positive adjustments should be permitted
--    under owner-approved documented policy; do not treat missing as zero.
-- 5. The shared request registry enforces cross-operation key uniqueness;
--    verify collision behavior and concurrent replays in PostgreSQL.
-- 6. Replay returns the original recorded post-operation snapshot.

-- DARK SECRETS COFFEE — DRAFT ONLY / DO NOT RUN ON LIVE
-- Requires review and isolated test after 001_foundation_REVIEW_ONLY.sql.
-- This file is NOT deployed, NOT tested, and must NOT be executed on production.
-- Product name is read from public.products; recipe references immutable product UUID.
-- No changes to products, prices, orders or inventory movements.

-- Fail closed if the expected inventory tables do not exist.
do $$
begin
  if to_regclass('public.inventory_recipes') is null
     or to_regclass('public.inventory_recipe_lines') is null
     or to_regclass('public.inventory_items') is null then
    raise exception 'Inventory foundation missing; do not install recipe RPC';
  end if;
end $$;

-- No public function execute permission, including PostgreSQL's default PUBLIC grant.
create or replace function public.inventory_save_recipe_draft(
  p_product_id uuid,
  p_lines jsonb,
  p_target_margin_percent numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_recipe_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_count integer := 0;
  v_seen uuid[] := array[]::uuid[];
begin
  if auth.uid() is null or (select public.is_admin()) is distinct from true then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_product_id is null or not exists
    (select 1 from public.products where id=p_product_id) then
    raise exception 'Unknown product';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Recipe lines must be a JSON array';
  end if;
  if p_target_margin_percent is not null and
     (p_target_margin_percent < 0 or p_target_margin_percent >= 100) then
    raise exception 'Target margin must be between 0 and below 100';
  end if;
  if jsonb_array_length(p_lines) > 200 then
    raise exception 'Too many recipe lines';
  end if;

  -- Validate everything BEFORE replacing lines.
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line) <> 'object'
       or (v_line - 'item_id' - 'quantity_base') <> '{}'::jsonb
       or jsonb_typeof(v_line->'item_id') <> 'string'
       or jsonb_typeof(v_line->'quantity_base') <> 'number' then
      raise exception 'Invalid recipe line format';
    end if;
    begin
      v_item_id := (v_line->>'item_id')::uuid;
      v_qty := (v_line->>'quantity_base')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid recipe line value';
    end;
    if v_item_id is null or v_qty is null or v_qty <= 0
       or v_qty > 999999999999.9999 or v_qty <> round(v_qty,4) then
      raise exception 'Invalid recipe quantity';
    end if;
    if v_item_id = any(v_seen) then
      raise exception 'Duplicate ingredient or packaging item';
    end if;
    if not exists (select 1 from public.inventory_items
                   where id=v_item_id and is_active=true) then
      raise exception 'Unknown or inactive inventory item';
    end if;
    v_seen := array_append(v_seen,v_item_id);
    v_count := v_count + 1;
  end loop;

  -- Serialize concurrent saves for the same product, including first creation.
  perform 1 from public.products where id=p_product_id for update;
  insert into public.inventory_recipes(product_id,is_configured,target_margin_percent)
  values(p_product_id,v_count>0,p_target_margin_percent)
  on conflict(product_id) do update
  set is_configured=excluded.is_configured,
      target_margin_percent=excluded.target_margin_percent,
      updated_at=now()
  returning id into v_recipe_id;

  delete from public.inventory_recipe_lines where recipe_id=v_recipe_id;
  insert into public.inventory_recipe_lines(recipe_id,item_id,quantity_base)
  select v_recipe_id, (value->>'item_id')::uuid,
         (value->>'quantity_base')::numeric
  from jsonb_array_elements(p_lines);
  return v_recipe_id;
end;
$fn$;

revoke all on function public.inventory_save_recipe_draft(uuid,jsonb,numeric)
  from public, anon, authenticated;
grant execute on function public.inventory_save_recipe_draft(uuid,jsonb,numeric)
  to authenticated;

-- SECURITY NOTE: function owner must be a reviewed privileged role.
-- SECURITY DEFINER bypass behavior, function EXECUTE grants, RLS and is_admin()
-- must be audited in an isolated test project before any production decision.

commit;
-- IMPORTANT: Migration remains unverified. Check definer ownership, is_admin(),
-- RLS/grants, exact schema, overflow, concurrency and replay in isolated project.
-- Ledger append-only is enforced for browser roles via REVOKE and RLS, not
-- against privileged database owners/service roles. Audit elevated roles.
