-- DARK SECRETS COFFEE — DRAFT ONLY / DO NOT RUN ON LIVE
-- Requires review and isolated test after 001_foundation_REVIEW_ONLY.sql.
-- This file is NOT deployed, NOT tested, and must NOT be executed on production.
-- Product name is read from public.products; recipe references immutable product UUID.
-- No changes to products, prices, orders or inventory movements.
begin;

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
