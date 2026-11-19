// Offline Node contract test for inventory-rpc-adapter-v2-DRAFT.js.
// Run from repository root: node inventory/tests/inventory-rpc-adapter-v2-contract.test.mjs
// No network, Supabase credentials, or LIVE database required.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('inventory/inventory-rpc-adapter-v2-DRAFT.js', 'utf8');
const { createInventoryDraftApi } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));
const calls = [];
const client = {
  rpc: async (name, args) => { calls.push({ name, args }); return { data: { ok: true }, error: null }; },
  from: table => ({ select: async columns => { calls.push({ table, columns }); return { data: [], error: null }; } })
};
const api = createInventoryDraftApi(client);
const key = '123e4567-e89b-42d3-a456-426614174000';
assert(Object.isFrozen(api));
assert.throws(() => createInventoryDraftApi(null), TypeError);
for (const bad of [undefined, '', 'receive-key', '123e4567-e89b-42d3-a456-42661417400z']) {
  assert.throws(() => api.receive({ itemId: 'item-1', quantity: 1, unit: 'kg', totalCost: 100, reference: 'R1', requestKey: bad }), TypeError);
  assert.throws(() => api.correct({ itemId: 'item-1', type: 'wastage', quantityDelta: -1, reason: 'Spill', requestKey: bad }), TypeError);
}
assert.equal(calls.length, 0, 'Invalid request keys must never invoke RPC');
const receipt = { itemId: 'item-1', quantity: 2, unit: 'kg', totalCost: 400, reference: 'R1', requestKey: key };
await api.receive(receipt);
await api.receive(receipt); // Explicit caller retry uses identical request key.
await api.correct({ itemId: 'item-1', type: 'wastage', quantityDelta: -100, reason: 'Spill', requestKey: key });
await api.saveRecipe({ productId: 'product-uuid', lines: [{ itemId: 'item-1', quantityBase: 18 }] });
await api.saveItem({ code: 'BEAN', name: 'Beans', category: 'Coffee', type: 'ingredient', baseUnit: 'g', purchaseUnit: 'kg', minimumStock: 0, active: true });
for (const fn of ['listItems','listMovements','listRecipes','listRecipeLines']) await api[fn]();
assert.deepEqual(calls.slice(0,5).map(x=>x.name), [
  'inventory_receive_stock_draft','inventory_receive_stock_draft','inventory_correct_stock_draft',
  'inventory_save_recipe_draft','inventory_save_item_draft'
]);
assert.equal(calls[0].args.p_request_key, key);
assert.equal(calls[1].args.p_request_key, key);
assert.equal(calls[2].args.p_request_key, key);
assert.deepEqual(calls[3].args.p_lines, [{ item_id: 'item-1', quantity_base: 18 }]);
assert.deepEqual(calls.slice(5).map(x=>x.table), [
  'inventory_items','inventory_stock_movements','inventory_recipes','inventory_recipe_lines'
]);
const denied = createInventoryDraftApi({
  rpc: async () => ({ data: null, error: { message: 'permission denied' } }),
  from: () => ({ select: async () => ({ data: null, error: { message: 'permission denied' } }) })
});
await assert.rejects(() => denied.saveRecipe({ productId: 'x', lines: [] }), { message: 'permission denied' });
await assert.rejects(() => denied.listItems(), { message: 'permission denied' });
console.log('PASS: v2 offline adapter mapping, UUID request-key guard, retry key stability, error propagation');
// NOTE: Does not prove server-side idempotency, RLS, WAC, or production readiness.
