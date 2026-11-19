/** VERSION 2 DRAFT: Require stable UUID idempotency keys for stock writes.
 * Generate a new key once per intended transaction, and reuse that SAME key
 * for retries. Do not regenerate keys automatically after network failures.
 * No LIVE integration or Supabase connection is included.
 */
/**
 * Dark Secrets Coffee inventory RPC adapter — DRAFT ONLY.
 * NOT imported by the LIVE site or the in-memory integrated preview.
 * Inject an already-authenticated Supabase client only in an approved test UI.
 * Never embed service_role keys or auto-deduct stock from orders.
 */
export function createInventoryDraftApi(client) {
  if (!client || typeof client.rpc !== 'function' || typeof client.from !== 'function') {
    throw new TypeError('An authenticated Supabase client is required');
  }
  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }
  async function read(table, columns = '*') {
    const { data, error } = await client.from(table).select(columns);
    if (error) throw error;
    return data;
  }
  function requireRequestKey(value) {
    if (typeof value !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new TypeError('A stable UUID requestKey is required for stock transactions');
    }
    return value;
  }
  return Object.freeze({
    listItems: () => read('inventory_items'),
    listMovements: () => read('inventory_stock_movements'),
    listRecipes: () => read('inventory_recipes'),
    listRecipeLines: () => read('inventory_recipe_lines'),
    saveItem: (item) => rpc('inventory_save_item_draft', {
      p_item_id: item.id ?? null,
      p_item_code: item.code,
      p_name: item.name,
      p_category: item.category,
      p_item_type: item.type,
      p_base_unit: item.baseUnit,
      p_purchase_unit: item.purchaseUnit,
      p_minimum_stock: item.minimumStock,
      p_is_active: item.active,
      p_supplier: item.supplier ?? null,
      p_brand: item.brand ?? null,
      p_notes: item.notes ?? null
    }),
    receive: (receipt) => rpc('inventory_receive_stock_draft', {
      p_item_id: receipt.itemId,
      p_purchase_quantity: receipt.quantity,
      p_purchase_unit: receipt.unit,
      p_total_cost: receipt.totalCost,
      p_reference: receipt.reference,
      p_request_key: requireRequestKey(receipt.requestKey)
    }),
    correct: (correction) => rpc('inventory_correct_stock_draft', {
      p_item_id: correction.itemId,
      p_correction_type: correction.type,
      p_quantity_delta: correction.quantityDelta,
      p_added_value: correction.addedValue ?? null,
      p_reason: correction.reason,
      p_request_key: requireRequestKey(correction.requestKey)
    }),
    reviewRecipePrice: (productId) => rpc('inventory_review_recipe_price_draft', { p_product_id: productId }),
    approveRecipe: (productId) => rpc('inventory_approve_recipe_draft', { p_product_id: productId }),
    saveRecipe: (recipe) => rpc('inventory_save_recipe_draft', {
      p_product_id: recipe.productId,
      p_lines: recipe.lines.map(line => ({
        item_id: line.itemId,
        quantity_base: line.quantityBase
      })),
      p_target_margin_percent: recipe.targetMarginPercent ?? null
    })
  });
}
