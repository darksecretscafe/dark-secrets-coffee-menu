-- DARK SECRETS COFFEE — INVENTORY RLS POLICY DESIGN v1
-- DRAFT ONLY. DO NOT EXECUTE ON LIVE SUPABASE.
-- Prerequisites: inventory foundation tables exist in a disposable DEV DB,
-- public.is_admin() implementation, function owner, search_path and EXECUTE
-- privileges have been reviewed, and authenticated role grants are approved.
-- This file is NOT a standalone migration and deliberately contains NO GRANT.
BEGIN;
ALTER TABLE public.inventory_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;

-- Read-only admin visibility for all five tables.
CREATE POLICY inventory_stock_items_admin_select ON public.inventory_stock_items
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_receipts_admin_select ON public.inventory_receipts
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_recipes_admin_select ON public.inventory_recipes
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_recipe_ingredients_admin_select ON public.inventory_recipe_ingredients
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_stock_movements_admin_select ON public.inventory_stock_movements
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()) = true);

-- Recipe editing can be allowed to admins after workflow validation.
-- Completed recipe approval must ultimately be enforced by server-side
-- functions: an RLS admin check alone does NOT enforce approval transitions.
CREATE POLICY inventory_recipes_admin_insert ON public.inventory_recipes
 FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_recipes_admin_update ON public.inventory_recipes
 FOR UPDATE TO authenticated
 USING ((SELECT public.is_admin()) = true)
 WITH CHECK ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_recipe_ingredients_admin_insert ON public.inventory_recipe_ingredients
 FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_recipe_ingredients_admin_update ON public.inventory_recipe_ingredients
 FOR UPDATE TO authenticated
 USING ((SELECT public.is_admin()) = true)
 WITH CHECK ((SELECT public.is_admin()) = true);
CREATE POLICY inventory_recipe_ingredients_admin_delete ON public.inventory_recipe_ingredients
 FOR DELETE TO authenticated USING ((SELECT public.is_admin()) = true);

-- Intentionally NO browser INSERT/UPDATE/DELETE policies on:
-- stock_items, receipts, stock_movements. These must be changed only by
-- reviewed transaction-safe server functions with explicit admin checks.
-- Also NO anonymous policies, and NO recipe DELETE policy.
-- NOTE: PostgreSQL policies are permissive by default and OR together.
-- Existing policies/grants must be audited; don't assume these override others.
COMMIT;
