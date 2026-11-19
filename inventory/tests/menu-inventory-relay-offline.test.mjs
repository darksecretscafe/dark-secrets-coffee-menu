// Offline Menu Management -> Inventory relay tests; no network or Supabase.
// Run from repo root: node inventory/tests/menu-inventory-relay-offline.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({});
for (const path of [
  'inventory/menu-products-snapshot-contract-v3-DRAFT.js',
  'inventory/admin-menu-inventory-relay-v1-DRAFT.js'
]) vm.runInContext(readFileSync(path, 'utf8'), ctx, { filename: path });
const id = '22222222-2222-4222-8222-222222222222';
const id2 = '33333333-3333-4333-8333-333333333333';
const received = [];
const detach = ctx.DS_DRAFT_attachInventoryReceiver(rows => received.push(rows));
assert.equal(ctx.DS_DRAFT_publishMenuRows([{ id, name: '  Cafe Latte  ', price: 115, is_active: true }]), 1);
assert.equal(received.length, 1);
assert.equal(received[0][0].name, 'Cafe Latte');
assert.equal(received[0][0].price, 115);
assert.equal(received[0][0].id, id);
assert(Object.isFrozen(received[0]));
assert(Object.isFrozen(received[0][0]));
const prior = ctx.DS_DRAFT_currentMenuRows();
for (const invalid of [
  [{ id, name: 'Latte', price: -1 }],
  [{ id: 'bad-id', name: 'Latte', price: 115 }],
  [{ id, name: 'Latte', price: 115 }, { id, name: 'Latte', price: 115 }],
  [{ id, name: '', price: 115 }],
  [{ id, name: 'Latte', price: Infinity }]
]) assert.throws(() => ctx.DS_DRAFT_publishMenuRows(invalid));
assert.equal(ctx.DS_DRAFT_currentMenuRows(), prior, 'Bad snapshots must not overwrite good state');
assert.equal(received.length, 1, 'Bad snapshots must not notify inventory');
// Attaching a receiver replays the latest snapshot immediately.
assert.throws(() => ctx.DS_DRAFT_attachInventoryReceiver(() => { throw Error('receiver refused'); }), /receiver refused/);
assert.equal(ctx.DS_DRAFT_currentMenuRows(), prior, 'Rejected attachment must preserve last good snapshot');
// A receiver that accepts the replay can still reject a later publish.
const reject = ctx.DS_DRAFT_attachInventoryReceiver(rows => {
  if (rows[0].id === id2) throw Error('receiver refused');
});
assert.throws(() => ctx.DS_DRAFT_publishMenuRows([{ id: id2, name: 'Americano', price: 100 }]), /receiver refused/);
assert.equal(ctx.DS_DRAFT_currentMenuRows(), prior, 'Receiver rejection must preserve last good snapshot');
reject();
const reattached = [];
const detach2 = ctx.DS_DRAFT_attachInventoryReceiver(rows => reattached.push(rows));
assert.equal(reattached.length, 1, 'New receiver must receive last valid snapshot');
assert.equal(reattached[0], prior);
detach2();
detach();
assert.equal(ctx.DS_DRAFT_publishMenuRows([{ id: id2, name: 'Americano', price: 100 }]), 1);
assert.equal(ctx.DS_DRAFT_currentMenuRows()[0].id, id2);
console.log('PASS: offline menu snapshot validation, UUID linkage, atomic relay, detach/replay');
// This is a browser relay contract test, NOT a production authorization test.
