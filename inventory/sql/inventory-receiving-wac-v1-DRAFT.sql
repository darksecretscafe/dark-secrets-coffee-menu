-- DARK SECRETS COFFEE: RECEIVING + WAC v1 (DRAFT ONLY)
-- DO NOT RUN IN LIVE SUPABASE. DEV-ONLY PROTOTYPE, NOT APPROVED FOR DEPLOYMENT.
-- Requires inventory-foundation-v1-DRAFT.sql tables in an ISOLATED DEV database.
-- This SQL creates a SECURITY DEFINER function. Review owner/grants before use.
-- Intentionally no GRANT EXECUTE to authenticated, anon, or PUBLIC.
CREATE OR REPLACE FUNCTION public.inventory_receive_stock_draft(
 p_stock_item_id uuid,
 p_purchase_quantity numeric,
 p_purchase_unit text,
 p_total_cost numeric,
 p_supplier_reference text,
 p_idempotency_key uuid
)
RETURNS TABLE(receipt_id uuid, quantity_on_hand numeric, inventory_value numeric, weighted_average_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
 v_actor uuid;
 v_item public.inventory_stock_items%ROWTYPE;
 v_receipt public.inventory_receipts%ROWTYPE;
 v_base_qty numeric;
 v_multiplier numeric;
 v_new_qty numeric;
 v_new_value numeric;
 v_receipt_id uuid;
BEGIN
 v_actor := auth.uid();
 IF v_actor IS NULL OR (SELECT public.is_admin()) IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
 END IF;
 IF p_stock_item_id IS NULL OR p_idempotency_key IS NULL OR
    p_purchase_quantity IS NULL OR p_purchase_quantity <= 0 OR
    p_total_cost IS NULL OR p_total_cost < 0 OR
    p_purchase_unit IS NULL OR
    p_supplier_reference IS NULL OR
    length(pg_catalog.btrim(p_supplier_reference)) NOT BETWEEN 1 AND 150 THEN
   RAISE EXCEPTION 'Invalid receiving inputs';
 END IF;
 -- Serializes requests with the same idempotency key, including retries
 -- targeting different stock items. Lock is held until transaction end.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_idempotency_key::text, 0)
 );
 SELECT * INTO v_receipt
 FROM public.inventory_receipts r WHERE r.idempotency_key = p_idempotency_key;
 IF FOUND THEN
   IF v_receipt.stock_item_id IS DISTINCT FROM p_stock_item_id OR
      v_receipt.purchase_quantity IS DISTINCT FROM p_purchase_quantity OR
      v_receipt.purchase_unit IS DISTINCT FROM p_purchase_unit OR
      v_receipt.total_cost IS DISTINCT FROM p_total_cost OR
      v_receipt.supplier_reference IS DISTINCT FROM p_supplier_reference THEN
     RAISE EXCEPTION 'Idempotency key reused with different inputs';
   END IF;
   SELECT * INTO v_item FROM public.inventory_stock_items i WHERE i.id=v_receipt.stock_item_id;
   RETURN QUERY SELECT v_receipt.id, v_item.quantity_on_hand, v_item.inventory_value,
      CASE WHEN v_item.quantity_on_hand > 0
           THEN v_item.inventory_value / v_item.quantity_on_hand ELSE 0::numeric END;
   RETURN;
 END IF;
 SELECT * INTO v_item FROM public.inventory_stock_items i
 WHERE i.id=p_stock_item_id FOR UPDATE;
 IF NOT FOUND OR v_item.is_active IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Active stock item not found';
 END IF;
 v_multiplier := CASE
   WHEN v_item.base_unit = 'g' AND p_purchase_unit = 'kg' THEN 1000
   WHEN v_item.base_unit = 'ml' AND p_purchase_unit = 'l' THEN 1000
   WHEN v_item.base_unit = p_purchase_unit THEN 1
   ELSE NULL END;
 IF v_multiplier IS NULL THEN RAISE EXCEPTION 'Purchase unit incompatible with stock base unit'; END IF;
 v_base_qty := p_purchase_quantity * v_multiplier;
 IF v_base_qty <= 0 OR v_base_qty <> pg_catalog.round(v_base_qty, 4) THEN
   RAISE EXCEPTION 'Base quantity exceeds 4 decimal places or is invalid';
 END IF;
 IF p_purchase_quantity <> pg_catalog.round(p_purchase_quantity,4) OR
    p_total_cost <> pg_catalog.round(p_total_cost,6) THEN
   RAISE EXCEPTION 'Purchase quantity or cost precision exceeds table limits';
 END IF;
 v_new_qty := v_item.quantity_on_hand + v_base_qty;
 v_new_value := v_item.inventory_value + p_total_cost;
 -- Numeric column constraints also guard overflow and invalid values.
 INSERT INTO public.inventory_receipts
  (stock_item_id,purchase_quantity,purchase_unit,base_quantity,total_cost,
   supplier_reference,created_by,idempotency_key)
 VALUES
  (p_stock_item_id,p_purchase_quantity,p_purchase_unit,v_base_qty,p_total_cost,
   p_supplier_reference,v_actor,p_idempotency_key)
 RETURNING id INTO v_receipt_id;
 UPDATE public.inventory_stock_items
 SET quantity_on_hand=v_new_qty, inventory_value=v_new_value, updated_at=pg_catalog.now()
 WHERE id=p_stock_item_id;
 INSERT INTO public.inventory_stock_movements
  (stock_item_id,receipt_id,movement_type,quantity_delta,value_delta,reference,created_by)
 VALUES
  (p_stock_item_id,v_receipt_id,'receipt',v_base_qty,p_total_cost,p_supplier_reference,v_actor);
 RETURN QUERY SELECT v_receipt_id,v_new_qty,v_new_value,
   v_new_value / v_new_qty;
END;
$fn$;

-- DEV test prerequisite: explicitly review and control EXECUTE privileges.
-- PostgreSQL functions can have PUBLIC EXECUTE by default, even when no GRANT
-- appears in this file. These REVOKEs prevent accidental public invocation.
REVOKE ALL ON FUNCTION public.inventory_receive_stock_draft(uuid,numeric,text,numeric,text,uuid)
 FROM PUBLIC, anon, authenticated;
-- No production access is enabled by this draft.
