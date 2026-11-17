-- Run in Supabase SQL Editor BEFORE deploying category-management UI.
-- Existing categories and products.category_id were created in earlier steps.
BEGIN;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_valid;
CREATE OR REPLACE FUNCTION public.sync_product_category()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE matched_id bigint; matched_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.category IS DISTINCT FROM OLD.category AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id THEN
    SELECT id INTO matched_id FROM public.categories WHERE name = NEW.category;
    IF matched_id IS NULL THEN RAISE EXCEPTION 'Unknown category: %', NEW.category; END IF;
    NEW.category_id := matched_id;
  ELSIF NEW.category_id IS NOT NULL THEN
    SELECT name INTO matched_name FROM public.categories WHERE id = NEW.category_id;
    IF matched_name IS NULL THEN RAISE EXCEPTION 'Unknown category ID: %', NEW.category_id; END IF;
    NEW.category := matched_name;
  ELSE
    SELECT id INTO matched_id FROM public.categories WHERE name = NEW.category;
    IF matched_id IS NULL THEN RAISE EXCEPTION 'Unknown category: %', NEW.category; END IF;
    NEW.category_id := matched_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_product_category ON public.products;
CREATE TRIGGER trg_sync_product_category BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_category();

CREATE OR REPLACE FUNCTION public.sync_category_rename()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.products SET category = NEW.name WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_category_rename ON public.categories;
CREATE TRIGGER trg_sync_category_rename AFTER UPDATE OF name ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.sync_category_rename();
COMMIT;
-- Check after applying:
-- SELECT p.category, c.name FROM public.products p JOIN public.categories c ON c.id=p.category_id;
