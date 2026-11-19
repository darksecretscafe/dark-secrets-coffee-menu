import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('inventory/inventory-rpc-adapter-v2-DRAFT.js', 'utf8');
const { createInventoryDraftApi } = await import('data:text/javascript,' + encodeURIComponent(source));
const requests = [];
const client = {
  rpc: async (name, args) => {
    requests.push({ name, args });
    if (requests.length === 1) return { data: null, error: { message: 'network timeout' } };
    return { data: [{ movement_id: 'original-movement' }], error: null };
  },
  from: () => ({ select: async () => ({ data: [], error: null }) })
};
const api = createInventoryDraftApi(client);
const receipt = {
  itemId: '550e8400-e29b-41d4-a716-446655440001',
  quantity: 2, unit: 'kg', totalCost: 400, reference: 'INV-100',
  requestKey: '550e8400-e29b-41d4-a716-446655440002'
};
await assert.rejects(api.receive(receipt), { message: 'network timeout' });
assert.equal(requests.length, 1, 'adapter must not automatically retry a failed request');
const result = await api.receive(receipt);
assert.equal(result[0].movement_id, 'original-movement');
assert.equal(requests.length, 2);
assert.equal(requests[0].name, 'inventory_receive_stock_draft');
assert.deepEqual(requests[0].args, requests[1].args, 'retry must reuse exact payload and key');
assert.equal(receipt.requestKey, requests[1].args.p_request_key);
console.log('PASS: manual retry reuses exact request key and payload; no automatic retry (mock only)');
