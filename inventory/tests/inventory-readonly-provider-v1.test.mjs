import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync('inventory/inventory-readonly-provider-v1-DRAFT.js', 'utf8');
const { createInventoryReadOnlyProvider } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
assert.throws(() => createInventoryReadOnlyProvider(null), TypeError);
let rows = [{ id: 'one', name: 'Beans' }];
const api = {
  listItems: async () => rows,
  listMovements: async () => [],
  listRecipes: async () => [],
  listRecipeLines: async () => []
};
const provider = createInventoryReadOnlyProvider(api);
assert.equal(provider.current(), null);
const snap = await provider.refresh();
assert.equal(snap.items[0].name, 'Beans');
assert(Object.isFrozen(snap) && Object.isFrozen(snap.items) && Object.isFrozen(snap.items[0]));
rows[0].name = 'Changed externally';
assert.equal(snap.items[0].name, 'Beans', 'Snapshot must not expose source row mutation');
provider.invalidate();
assert.equal(provider.current(), null);
let resolveOld;
const slow = createInventoryReadOnlyProvider({
  ...api,
  listItems: () => new Promise(resolve => { resolveOld = resolve; })
});
const pending = slow.refresh();
slow.invalidate();
resolveOld([{ id: 'stale' }]);
assert.equal(await pending, null, 'Invalidated request must not repopulate snapshot');
assert.equal(slow.current(), null);

// When two refreshes overlap, only the newest response may be committed.
let resolveFirst;
let invocation = 0;
const racing = createInventoryReadOnlyProvider({
  ...api,
  listItems: () => (++invocation === 1
    ? new Promise(resolve => { resolveFirst = resolve; })
    : Promise.resolve([{ id: 'newest' }]))
});
const oldRefresh = racing.refresh();
const newestSnapshot = await racing.refresh();
assert.equal(newestSnapshot.items[0].id, 'newest');
resolveFirst([{ id: 'outdated' }]);
assert.equal(await oldRefresh, null);
assert.equal(racing.current().items[0].id, 'newest', 'Late response must not overwrite newest snapshot');
const broken = createInventoryReadOnlyProvider({ ...api, listRecipes: async () => ({ bad: true }) });
await assert.rejects(() => broken.refresh(), TypeError);
assert.equal(broken.current(), null, 'Invalid data must never be committed');
console.log('PASS: read-only provider snapshots, invalidation, stale-request and invalid-row protection');
