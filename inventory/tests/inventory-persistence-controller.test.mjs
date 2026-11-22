import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const provider=readFileSync('inventory/inventory-readonly-provider-v1-DRAFT.js','utf8').replace('export function','function');
const controller=readFileSync('inventory/inventory-persistence-controller-DRAFT.js','utf8').replace(/^import .*;\n/m,'').replace('export function','function');
const {createInventoryPersistenceController}=await import('data:text/javascript,'+encodeURIComponent(provider+'\n'+controller+'\nexport {createInventoryPersistenceController}'));
let writes=0,checks=0,fail=false;
const api={
 listItems:async()=>[{id:1,stock:writes}],
 listMovements:async()=>[],listRecipes:async()=>[],listRecipeLines:async()=>[],
 saveRecipe:async()=>{if(fail)throw Error('DB rejected');return ++writes},
 receive:async()=>++writes,saveItem:async()=>++writes,correct:async()=>++writes,
 reviewRecipePrice:async()=>++writes,approveRecipe:async()=>++writes
};
const c=createInventoryPersistenceController({api,verifyBeforeWrite:async()=>{checks++}});
assert.equal((await c.refresh()).items[0].stock,0);
const a=await c.saveRecipe({productId:'x'});
assert.equal(a.snapshot.items[0].stock,1);
assert.equal(c.current().items[0].stock,1);
assert.equal(checks,1);
fail=true;
await assert.rejects(()=>c.saveRecipe({}),/DB rejected/);
assert.equal(c.current(),null,'failed writes invalidate cached data');
fail=false;
assert.equal((await c.approveRecipe('x')).snapshot.items[0].stock,2);
assert.equal(checks,3);

// A denied admin session must never invoke a database mutation.
let deniedWrites=0;
const deniedApi={...api,receive:async()=>{deniedWrites++;throw Error('MUTATION SHOULD NOT RUN')}};
const denied=createInventoryPersistenceController({
  api:deniedApi,
  verifyBeforeWrite:async()=>{throw Error('Inventory admin privileges revoked')}
});
await assert.rejects(()=>denied.receive({itemId:'x'}),/admin privileges revoked/);
assert.equal(deniedWrites,0,'auth denial must block the mutation');
assert.equal(denied.current(),null,'denied write must invalidate any cached snapshot');

// Failed refresh after a successful mutation must not fabricate a confirmed save.
let saved=0;
const refreshApi={...api,receive:async()=>{saved++;return 'receipt-id'},listItems:async()=>{throw Error('Readback unavailable')}};
const uncertain=createInventoryPersistenceController({api:refreshApi,verifyBeforeWrite:async()=>true});
await assert.rejects(()=>uncertain.receive({itemId:'x'}),/Readback unavailable/);
assert.equal(saved,1,'write was attempted once');
assert.equal(uncertain.current(),null,'unconfirmed write must not be shown as saved');
console.log('PASS: post-write persistent refresh, auth checks, failed-write cache invalidation, denied-write guard, unconfirmed readback');
