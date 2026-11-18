-- Dark Secrets Coffee Inventory — Phase 1 foundation (REVIEW ONLY).
-- DO NOT run on LIVE Supabase until separately approved.
-- Additive schema only. Does not change products, orders, checkout, or prices.
-- Uses existing public.is_admin() RPC for admin-only access.
begin;

create table if not exists public.inventory_items (
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

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening','receive','adjustment','wastage','order_deduction','reversal')),
  quantity_delta numeric(16,4) not null check (quantity_delta <> 0),
  unit_cost numeric(16,6) check (unit_cost >= 0),
  reference text,
  supplier text,
  invoice_number text,
  batch_number text,
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists inventory_movements_item_created_idx
  on public.inventory_stock_movements(item_id, created_at desc);

create table if not exists public.inventory_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete restrict,
  is_configured boolean not null default false,
  target_margin_percent numeric(6,3) check (target_margin_percent >= 0 and target_margin_percent < 100),
  updated_at timestamptz not null default now()
);
create table if not exists public.inventory_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.inventory_recipes(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_base numeric(16,4) not null check (quantity_base > 0),
  unique (recipe_id, item_id)
);

create table if not exists public.inventory_settings (
  singleton boolean primary key default true check (singleton),
  automatic_inventory_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.inventory_settings(singleton, automatic_inventory_enabled)
values (true,false) on conflict (singleton) do nothing;

-- RLS is an additional gate; explicit privileges below also restrict direct ledger writes.
-- Deny all access by default except authenticated admins via existing is_admin().
-- Service roles retain their normal elevated access.
alter table public.inventory_items enable row level security;
alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_recipes enable row level security;
alter table public.inventory_recipe_lines enable row level security;
alter table public.inventory_settings enable row level security;

create policy inventory_items_admin on public.inventory_items
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
-- Ledger is read-only to browser clients, including admins. Future server-side
-- transactional RPCs must append entries with validation and an audit trail.
-- No direct INSERT, UPDATE, or DELETE from the client.
revoke all on public.inventory_stock_movements from public, anon, authenticated;
grant select on public.inventory_stock_movements to authenticated;
create policy inventory_movements_admin_read on public.inventory_stock_movements
  for select to authenticated using ((select public.is_admin()));
create policy inventory_recipes_admin on public.inventory_recipes
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy inventory_recipe_lines_admin on public.inventory_recipe_lines
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy inventory_settings_admin on public.inventory_settings
  for select to authenticated using ((select public.is_admin()));

-- The inventory settings table is read-only to browser clients.
-- Other inventory tables still require privilege/RLS verification before deployment.
-- No client-side update policy for activation. Activation must be implemented
-- later through a verified, server-side admin-only function with validation.
commit;
