-- DARK SECRETS COFFEE — INVENTORY FOUNDATION (DRAFT ONLY)
-- DESIGN PROPOSAL. DO NOT EXECUTE ON LIVE SUPABASE.
-- Prerequisite: verify public.products.id is UUID, and review existing RLS,
-- admin authentication, migrations, and product deletion policies.
-- No grants or permissive RLS policies are included.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.inventory_stock_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 150),
 category text NOT NULL DEFAULT 'Ingredient',
 base_unit text NOT NULL CHECK (base_unit IN ('g','ml','pcs')),
 minimum_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
 quantity_on_hand numeric(18,4) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
 inventory_value numeric(18,6) NOT NULL DEFAULT 0 CHECK (inventory_value >= 0),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_items_name_ci_unique
 ON public.inventory_stock_items (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.inventory_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 stock_item_id uuid NOT NULL REFERENCES public.inventory_stock_items(id) ON DELETE RESTRICT,
 purchase_quantity numeric(18,4) NOT NULL CHECK (purchase_quantity > 0),
 purchase_unit text NOT NULL CHECK (purchase_unit IN ('g','kg','ml','l','pcs')),
 base_quantity numeric(18,4) NOT NULL CHECK (base_quantity > 0),
 total_cost numeric(18,6) NOT NULL CHECK (total_cost >= 0),
 supplier_reference text NOT NULL CHECK (length(btrim(supplier_reference)) BETWEEN 1 AND 150),
 received_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid,
 idempotency_key uuid NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.inventory_recipes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 -- Link to the EXISTING product row, not a duplicated inventory product.
 product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'no_recipe'
   CHECK (status IN ('no_recipe','draft','completed')),
 reviewed_at timestamptz,
 reviewed_by uuid,
 approved_at timestamptz,
 approved_by uuid,
 custom_selling_price numeric(12,2)
   CHECK (custom_selling_price IS NULL OR custom_selling_price >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_recipe_ingredients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipe_id uuid NOT NULL REFERENCES public.inventory_recipes(id) ON DELETE CASCADE,
 stock_item_id uuid NOT NULL REFERENCES public.inventory_stock_items(id) ON DELETE RESTRICT,
 quantity_per_serving numeric(18,4) NOT NULL CHECK (quantity_per_serving > 0),
 UNIQUE(recipe_id,stock_item_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 stock_item_id uuid NOT NULL REFERENCES public.inventory_stock_items(id) ON DELETE RESTRICT,
 receipt_id uuid UNIQUE REFERENCES public.inventory_receipts(id) ON DELETE RESTRICT,
 movement_type text NOT NULL CHECK (movement_type IN ('receipt','usage','adjustment','reversal')),
 quantity_delta numeric(18,4) NOT NULL CHECK (quantity_delta <> 0),
 value_delta numeric(18,6) NOT NULL,
 reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid
);
CREATE INDEX IF NOT EXISTS inventory_receipts_item_time_idx
 ON public.inventory_receipts(stock_item_id,received_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_item_time_idx
 ON public.inventory_stock_movements(stock_item_id,created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_recipe_ingredients_stock_idx
 ON public.inventory_recipe_ingredients(stock_item_id);

-- Explicitly block browser roles until reviewed admin-only RLS policies,
-- server-side transaction functions, and privileges are designed.
ALTER TABLE public.inventory_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: Schema alone does NOT implement receiving or WAC.
-- Receipt + stock balance/value + movement must be one atomic, idempotent
-- server-side transaction using row locks. Never trust browser-side totals.
-- WAC = (old inventory_value + received_cost) /
--       (old quantity_on_hand + received_base_quantity).
-- Likewise, recipe approval and stock deduction need admin authorization
-- and transaction-safe server-side logic before production use.
COMMIT;
