-- ISOLATED LOCAL POSTGRES ONLY. Never run against Supabase or LIVE.
-- Execute inside a brand-new disposable PostgreSQL database.
begin;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.products (
  id uuid primary key,
  name text not null
);
create function public.is_admin() returns boolean language sql stable as $$
  select auth.uid() = '11111111-1111-4111-8111-111111111111'::uuid
$$;
insert into public.products(id,name) values
 ('22222222-2222-4222-8222-222222222222','Local test drink');
commit;
