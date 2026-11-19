// Offline contract tests for the DRAFT inventory adapter.
// No network, Supabase, LIVE writes, or external dependencies.
// Run: node inventory/tests/inventory-rpc-adapter.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'inventory/inventory-rpc-adapter-DRAFT.js'), 'utf8');
const mod = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));
const { createInventoryDraftApi } = mod;
assert.throws(() => createInventoryDraftApi(null), TypeError);
const calls = [];
const client = {
  rpc: async (name, args) => { calls.push({ name, args }); return { data: [{ ok: true }], error: null }; },
  from: table => ({ select: async columns => { calls.push({ table, columns }); return { data: [], error: null }; } })
};
const api = createInventoryDraftApi(client);
assert(Object.isFrozen(api));
await api.saveItem({ id: null, code: 'ING-1', name: 'Coffee', category: 'Beans', type: 'ingredient', baseUnit: 'g', purchaseUnit: 'kg', minimumStock: 0, active: true });
await api.receive({ itemId: 'item-uuid', quantity: 2, unit: 'kg', totalCost: 400, reference: 'INV-1', requestKey: 'receive-key' });
await api.correct({ itemId: 'item-uuid', type: 'wastage', quantityDelta: -500, reason: 'Spill', requestKey: 'waste-key' });
await api.saveRecipe({ productId: 'product-uuid', lines: [{ itemId: 'item-uuid', quantityBase: 18 }], targetMarginPercent: 65 });
for (const fn of ['listItems', 'listMovements', 'listRecipes', 'listRecipeLines']) await api[fn]();
assert.deepEqual(calls.slice(0,4).map(x=>x.name), [
  'inventory_save_item_draft', 'inventory_receive_stock_draft',
  'inventory_correct_stock_draft', 'inventory_save_recipe_draft'
]);
assert.deepEqual(calls[1].args, {
  p_item_id: 'item-uuid', p_purchase_quantity: 2, p_purchase_unit: 'kg',
  p_total_cost: 400, p_reference: 'INV-1', p_request_key: 'receive-key'
});
assert.deepEqual(calls[3].args.p_lines, [{ item_id: 'item-uuid', quantity_base: 18 }]);
assert.deepEqual(calls.slice(4).map(x=>x.table), [
  'inventory_items', 'inventory_stock_movements', 'inventory_recipes', 'inventory_recipe_lines'
]);
const denied = createInventoryDraftApi({
  rpc: async () => ({ data: null, error: { message: 'permission denied' } }),
  from: () => ({ select: async () => ({ data: null, error: { message: 'permission denied' } }) })
});
await assert.rejects(denied.receive({}), { message: 'permission denied' });
await assert.rejects(denied.listItems(), { message: 'permission denied' });
console.log('PASS: offline adapter contract assertions; no database contacted.');
