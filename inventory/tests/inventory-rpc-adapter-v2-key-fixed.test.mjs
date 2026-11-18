import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('inventory/inventory-rpc-adapter-v2-DRAFT.js','utf8');
const {createInventoryDraftApi}=await import('data:text/javascript,'+encodeURIComponent(source));
const calls=[];
const api=createInventoryDraftApi({
  rpc:async(name,args)=>{calls.push({name,args});return {data:[],error:null};},
  from:()=>({select:async()=>({data:[],error:null})})
});
const id='550e8400-e29b-41d4-a716-446655440000';
const receipt={itemId:id,quantity:2,unit:'kg',totalCost:400,reference:'INV-1',requestKey:id};
const correction={itemId:id,type:'wastage',quantityDelta:-5,reason:'spill',requestKey:id};
await api.receive(receipt);
await api.receive(receipt); // retry must preserve key
assert.equal(calls[0].args.p_request_key,calls[1].args.p_request_key);
await api.correct(correction);
assert.equal(calls[2].args.p_request_key,id);
for(const bad of [undefined,null,'', 'not-a-uuid']) {
  assert.throws(() => api.receive({...receipt,requestKey:bad}),TypeError);
  assert.throws(() => api.correct({...correction,requestKey:bad}),TypeError);
}
assert.equal(calls.length,3,'invalid keys must never reach Supabase');
console.log('PASS: offline request-key contract checks (no database access)');
