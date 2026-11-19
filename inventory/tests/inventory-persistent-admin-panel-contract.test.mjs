// Offline contract checks for receipt idempotency and schema mapping.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('inventory/inventory-persistent-admin-panel-DRAFT.js','utf8');
assert.match(source,/unit:item\.preferred_purchase_unit/,'Use real SQL 017 purchase-unit column');
assert.doesNotMatch(source,/unit:item\.purchase_unit/,'Do not use nonexistent purchase_unit');
assert.match(source,/pendingReceipt\.requestKey/,'Retry must reuse same request key');
assert.match(source,/pendingReceipt\.fingerprint!==fingerprint/,'Prevent ambiguous changed receipt retry');
assert.match(source,/pendingReceipt=null;qty\.value/,'Clear retry key only after confirmed success');
assert.match(source,/controller\[method\]\(payload\)/,'Writes go through persistence controller');
assert.match(source,/controller\.current\(\)\?\.items/,'Ingredients originate from loaded snapshot');
console.log('PASS: draft UI purchase-unit mapping and receipt retry guard');
