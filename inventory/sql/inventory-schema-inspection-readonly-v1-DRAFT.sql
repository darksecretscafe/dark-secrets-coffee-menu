-- READ-ONLY SCHEMA INSPECTION — DRAFT CHECKLIST
-- Execute ONLY if you explicitly choose to inspect your own Supabase project.
-- SELECT queries only; no migrations or changes.
-- Do not paste secrets, access tokens, customer/order data into chat.
SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public'
AND table_name IN ('products','categories','inventory_stock_items','inventory_receipts','inventory_recipes','inventory_recipe_ingredients','inventory_stock_movements')
ORDER BY table_name,ordinal_position;

SELECT tc.table_name,tc.constraint_name,tc.constraint_type,
       kcu.column_name,ccu.table_name AS foreign_table,ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
 ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
 ON tc.constraint_name=ccu.constraint_name AND tc.table_schema=ccu.table_schema
WHERE tc.table_schema='public'
AND tc.table_name IN ('products','categories','inventory_stock_items','inventory_receipts','inventory_recipes','inventory_recipe_ingredients','inventory_stock_movements')
ORDER BY tc.table_name,tc.constraint_name;

SELECT schemaname,tablename,rowsecurity
FROM pg_tables
WHERE schemaname='public'
AND tablename IN ('products','categories','inventory_stock_items','inventory_receipts','inventory_recipes','inventory_recipe_ingredients','inventory_stock_movements')
ORDER BY tablename;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public'
AND tablename IN ('products','categories','inventory_stock_items','inventory_receipts','inventory_recipes','inventory_recipe_ingredients','inventory_stock_movements')
ORDER BY tablename,policyname;

SELECT n.nspname AS schema_name,p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
AND (p.proname='is_admin' OR p.proname LIKE 'inventory_%')
ORDER BY p.proname;
