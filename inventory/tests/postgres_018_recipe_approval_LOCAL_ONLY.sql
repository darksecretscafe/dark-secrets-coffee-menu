-- Disposable PostgreSQL ONLY. Requires bootstrap, SQL 017 and SQL 018.
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare v_item uuid; v_recipe uuid; v_rev bigint; v_approved bigint;
begin
 v_item:=public.inventory_save_item_draft(null,'APPROVAL-TEST-001','Approval test beans',
   'Coffee','ingredient','g','kg',0,true,null,null,null);
 v_recipe:=public.inventory_save_recipe_draft(
   '22222222-2222-4222-8222-222222222222'::uuid,
   jsonb_build_array(jsonb_build_object('item_id',v_item,'quantity_base',12)),60);
 -- Test fixture product has no price in local bootstrap; SQL 018 needs the real schema.
 -- The disposable bootstrap must provide a positive price for this test.
 perform public.inventory_review_recipe_price_draft('22222222-2222-4222-8222-222222222222'::uuid);
 perform public.inventory_approve_recipe_draft('22222222-2222-4222-8222-222222222222'::uuid);
 select recipe_revision,approved_revision into v_rev,v_approved
 from public.inventory_recipes where id=v_recipe;
 if v_rev is distinct from v_approved then
   raise exception 'Approval revision was invalidated by review/approval update';
 end if;
 perform public.inventory_save_recipe_draft(
   '22222222-2222-4222-8222-222222222222'::uuid,
   jsonb_build_array(jsonb_build_object('item_id',v_item,'quantity_base',15)),60);
 if exists(select 1 from public.inventory_recipes
   where id=v_recipe and (approved_revision is not null or price_review_revision is not null)) then
   raise exception 'Recipe modification did not invalidate approval';
 end if;
 raise notice 'PASS: approval persists and recipe edit invalidates review and approval';
end $$;
rollback;
