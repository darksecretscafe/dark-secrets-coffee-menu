-- DRAFT ONLY: depends on SQL 017; do not run on LIVE.
-- Additive review/approval persistence, with server-side admin validation.
-- A menu price change or recipe save invalidates approval eligibility.
begin;
alter table public.inventory_recipes
  add column recipe_revision bigint not null default 1,
  add column price_review_revision bigint,
  add column reviewed_price numeric,
  add column price_reviewed_by uuid,
  add column price_reviewed_at timestamptz,
  add column approved_revision bigint,
  add column approved_price numeric,
  add column approved_by uuid,
  add column approved_at timestamptz;

-- SQL 017 recipe writes must invalidate previous price review/approval.
-- Trigger runs in same transaction as save_recipe_draft, including existing recipes.
create function public.inventory_recipe_invalidate_review_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.recipe_revision := old.recipe_revision + 1;
    new.price_review_revision := null;
    new.reviewed_price := null;
    new.price_reviewed_by := null;
    new.price_reviewed_at := null;
    new.approved_revision := null;
    new.approved_price := null;
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;
create trigger inventory_recipe_invalidate_review_draft
before update of is_configured, target_margin_percent, updated_at on public.inventory_recipes
for each row execute function public.inventory_recipe_invalidate_review_draft();

-- Price review must follow a successfully saved menu price.
-- Do not write to public.products here: Menu Management remains price owner.
create function public.inventory_review_recipe_price_draft(p_product_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_recipe public.inventory_recipes%rowtype; v_price numeric; v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null or (select public.is_admin()) is distinct from true then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select * into v_recipe from public.inventory_recipes
   where product_id=p_product_id for update;
  if not found or not v_recipe.is_configured then
    raise exception 'Configured recipe required';
  end if;
  if not exists (select 1 from public.inventory_recipe_lines where recipe_id=v_recipe.id) then
    raise exception 'Recipe must contain ingredients';
  end if;
  select price into v_price from public.products where id=p_product_id;
  if v_price is null or v_price <= 0 then raise exception 'Saved selling price must be positive'; end if;
  update public.inventory_recipes set
    price_review_revision=recipe_revision,
    reviewed_price=v_price,
    price_reviewed_by=v_actor,
    price_reviewed_at=now(),
    approved_revision=null,
    approved_price=null,
    approved_by=null,
    approved_at=null
   where id=v_recipe.id;
  return v_recipe.id;
end $$;

create function public.inventory_approve_recipe_draft(p_product_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_recipe public.inventory_recipes%rowtype; v_price numeric; v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null or (select public.is_admin()) is distinct from true then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select * into v_recipe from public.inventory_recipes
   where product_id=p_product_id for update;
  if not found or not v_recipe.is_configured then raise exception 'Configured recipe required'; end if;
  if not exists (select 1 from public.inventory_recipe_lines where recipe_id=v_recipe.id) then
    raise exception 'Recipe must contain ingredients';
  end if;
  select price into v_price from public.products where id=p_product_id;
  if v_price is null or v_price <= 0
     or v_recipe.price_review_revision is distinct from v_recipe.recipe_revision
     or v_recipe.reviewed_price is distinct from v_price then
    raise exception 'Review and save current menu price before approval';
  end if;
  update public.inventory_recipes set
    approved_revision=recipe_revision,
    approved_price=v_price,
    approved_by=v_actor,
    approved_at=now()
   where id=v_recipe.id;
  return v_recipe.id;
end $$;

revoke all on function public.inventory_review_recipe_price_draft(uuid) from public,anon,authenticated;
revoke all on function public.inventory_approve_recipe_draft(uuid) from public,anon,authenticated;
grant execute on function public.inventory_review_recipe_price_draft(uuid) to authenticated;
grant execute on function public.inventory_approve_recipe_draft(uuid) to authenticated;
commit;

-- NOTE: price review RPC records CURRENT database price; it cannot by itself
-- prove a human opened Menu Management. UI must enforce explicit review.
-- An update to public.products.price AFTER approval must be reflected as
-- stale status by comparing approved_price to the current product price.
-- Do not deploy without isolated Supabase E2E/security tests and rollback.
