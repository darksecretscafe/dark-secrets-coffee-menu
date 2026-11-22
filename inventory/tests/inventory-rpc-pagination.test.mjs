import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('inventory/inventory-rpc-adapter-v2-DRAFT.js','utf8');
const {createInventoryDraftApi}=await import('data:text/javascript,'+encodeURIComponent(source));
const all=Array.from({length:1203},(_,i)=>({id:String(i).padStart(5,'0')}));
const requests=[];
const client={
  rpc:async()=>({data:null,error:null}),
  from:table=>({
    select:columns=>({
      order:(key,opts)=>({
        range:async(from,to)=>{
          requests.push({table,columns,key,opts,from,to});
          return {data:all.slice(from,to+1),error:null};
        }
      })
    })
  })
};
const api=createInventoryDraftApi(client);
const rows=await api.listMovements();
assert.equal(rows.length,1203);
assert.deepEqual(requests.map(x=>[x.from,x.to]),[[0,499],[500,999],[1000,1499]]);
assert.ok(requests.every(x=>x.key==='id'&&x.opts.ascending===true));
requests.length=0;
assert.equal((await api.listItems()).length,1203);
assert.equal(requests.length,3);
const failing=createInventoryDraftApi({rpc:client.rpc,from:()=>({
  select:()=>({order:()=>({range:async()=>({data:null,error:new Error('Network failure')})})})
})});
await assert.rejects(failing.listMovements(),/Network failure/);
console.log('PASS: inventory reads fetch all pages with stable ordering and propagate errors');
