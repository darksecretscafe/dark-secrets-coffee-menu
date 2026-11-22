-- Disposable PostgreSQL only. This tests actual SET ROLE and RLS, but uses mock auth.uid().
-- Do not run on LIVE Supabase. All fixture changes are rolled back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$
declare n integer;
begin
 select count(*) into n from public.inventory_items;
 if n <> 0 then raise exception 'RLS FAILURE: nonadmin can read inventory items'; end if;
 select count(*) into n from public.inventory_settings;
 if n <> 0 then raise exception 'RLS FAILURE: nonadmin can read inventory settings'; end if;
 select count(*) into n from public.inventory_stock_movements;
 if n <> 0 then raise exception 'RLS FAILURE: nonadmin can read stock ledger'; end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
 select count(*) into n from public.inventory_settings;
 if n <> 1 then raise exception 'RLS FAILURE: admin cannot read inventory settings'; end if;
end $$;
reset role;
set local role anon;
do $$
declare n integer;
begin
 if has_table_privilege(current_user,'public.inventory_items','SELECT') then
   raise exception 'RLS FAILURE: anon SELECT privilege on items';
 end if;
 if has_function_privilege(current_user,'public.inventory_save_recipe_draft(uuid,jsonb,numeric)','EXECUTE') then
   raise exception 'RLS FAILURE: anon EXECUTE privilege on recipe RPC';
 end if;
end $$;
reset role;
rollback;
-- Note: Supabase JWT/auth role handling still requires isolated Supabase validation.
