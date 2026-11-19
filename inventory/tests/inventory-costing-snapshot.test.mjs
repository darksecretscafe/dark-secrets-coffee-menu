import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('inventory/inventory-costing-snapshot-DRAFT.js','utf8');
const {calculateInventoryCosting}=await import('data:text/javascript,'+encodeURIComponent(source));
const base={
 items:[{id:'beans',name:'Beans',base_unit:'g'}],
 movements:[
 {id:'m1',item_id:'beans',quantity_after:1000,value_after:20,created_at:'2026-01-01T00:00:00Z'},
 {id:'m2',item_id:'beans',quantity_after:2000,value_after:50,created_at:'2026-01-02T00:00:00Z'}],
 recipes:[{id:'recipe',product_id:'coffee',recipe_revision:2,approved_revision:2,approved_price:5}],
 recipeLines:[{recipe_id:'recipe',item_id:'beans',quantity_base:20}]
};
const result=calculateInventoryCosting(base,[{id:'coffee',name:'Coffee',price:5}]);
assert.equal(result.balances[0].wac,0.025);
assert.equal(result.recipes[0].cost,0.5);
assert.equal(result.recipes[0].profit,4.5);
assert.equal(result.recipes[0].margin,90);
assert.equal(result.recipes[0].approved,true);
assert.equal(calculateInventoryCosting(base,[{id:'coffee',price:6}]).recipes[0].approved,false);
assert.equal(calculateInventoryCosting({...base,movements:[]},[]).balances[0].wac,0);
assert.throws(()=>calculateInventoryCosting({...base,recipeLines:[{recipe_id:'recipe',item_id:'missing',quantity_base:1}]},[]),/unknown inventory item/);
console.log('PASS: persisted-ledger WAC, recipe cost, margin, stale price approval');
