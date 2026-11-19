/* Dark Secrets Coffee — inventory offline receiving test bench v1
 * DRAFT only. No network, Supabase, localStorage or LIVE mutations.
 * Run in browser console or Node. Pure in-memory simulation.
 */
(function(root){
"use strict";
const units={g:{g:1,kg:1000},ml:{ml:1,l:1000},pcs:{pcs:1}};
function dec(v,label){if(typeof v!=="number"||!Number.isFinite(v))throw Error(label+" must be finite");return v;}
function precise(v,d){return Math.abs(v-Number(v.toFixed(d)))<1e-9;}
function createStore(){
 const items=new Map(),receipts=new Map(),movements=[];
 function register(id,baseUnit){if(!units[baseUnit]||items.has(id))throw Error("Invalid stock item");items.set(id,{id,baseUnit,qty:0,value:0,active:true});}
 function receive(x){
  const {itemId,quantity,unit,totalCost,supplier,key}=x;
  dec(quantity,"quantity");dec(totalCost,"totalCost");
  if(quantity<=0||totalCost<0||!precise(quantity,4)||!precise(totalCost,6))throw Error("Invalid quantity/cost");
  if(typeof supplier!=="string"||!supplier.trim()||supplier.trim().length>150||!key)throw Error("Invalid supplier/key");
  const normalized=JSON.stringify([itemId,quantity,unit,totalCost,supplier]);
  if(receipts.has(key)){
    const prior=receipts.get(key);
    if(prior.payload!==normalized)throw Error("Conflicting idempotency key");
    return {duplicate:true,receiptId:prior.id,...balance(prior.itemId)};
  }
  const item=items.get(itemId);
  if(!item||!item.active)throw Error("Stock item unavailable");
  const factor=units[item.baseUnit][unit];
  if(!factor)throw Error("Incompatible unit");
  const baseQuantity=quantity*factor;
  if(!precise(baseQuantity,4)||baseQuantity<=0)throw Error("Invalid base quantity");
  const nextQty=item.qty+baseQuantity,nextValue=item.value+totalCost;
  if(!Number.isFinite(nextQty)||!Number.isFinite(nextValue))throw Error("Overflow");
  const receiptId="draft-receipt-"+(receipts.size+1);
  item.qty=nextQty;item.value=nextValue;
  receipts.set(key,{id:receiptId,itemId,payload:normalized});
  movements.push({receiptId,itemId,baseQuantity,valueDelta:totalCost});
  return {duplicate:false,receiptId,...balance(itemId)};
 }
 function balance(id){const i=items.get(id);return {quantity:i.qty,value:i.value,wac:i.qty?i.value/i.qty:0};}
 function snapshot(){return {items:Array.from(items.values()).map(i=>({...i})),receipts:receipts.size,movements:movements.map(m=>({...m}))};}
 return {register,receive,balance,snapshot};
}
function runTests(){
 const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
 const assert=(v,msg)=>{if(!v)throw Error(msg||"Assertion failed");};
 const fails=(fn)=>{let failed=false;try{fn();}catch(_){failed=true;}assert(failed,"Expected rejection");};
 test("WAC: 1000g ₱800 + 500g ₱500",()=>{const s=createStore();s.register("beans","g");s.receive({itemId:"beans",quantity:1000,unit:"g",totalCost:800,supplier:"A",key:"1"});s.receive({itemId:"beans",quantity:500,unit:"g",totalCost:500,supplier:"A",key:"2"});assert(s.balance("beans").qty===1500);assert(Math.abs(s.balance("beans").wac-1300/1500)<1e-10);});
 test("kg to g",()=>{const s=createStore();s.register("b","g");s.receive({itemId:"b",quantity:1.5,unit:"kg",totalCost:1200,supplier:"A",key:"1"});assert(s.balance("b").quantity===1500);});
 test("l to ml",()=>{const s=createStore();s.register("m","ml");s.receive({itemId:"m",quantity:2,unit:"l",totalCost:240,supplier:"A",key:"1"});assert(s.balance("m").quantity===2000);});
 test("same-key retry does not double post",()=>{const s=createStore();s.register("b","g");const x={itemId:"b",quantity:100,unit:"g",totalCost:20,supplier:"A",key:"1"};s.receive(x);assert(s.receive(x).duplicate);assert(s.snapshot().receipts===1&&s.snapshot().movements.length===1);});
 test("conflicting key rejected",()=>{const s=createStore();s.register("b","g");const x={itemId:"b",quantity:100,unit:"g",totalCost:20,supplier:"A",key:"1"};s.receive(x);fails(()=>s.receive({...x,totalCost:21}));});
 test("incompatible unit rejected",()=>{const s=createStore();s.register("b","g");fails(()=>s.receive({itemId:"b",quantity:1,unit:"ml",totalCost:1,supplier:"A",key:"1"}));});
 test("negative quantity rejected",()=>{const s=createStore();s.register("b","g");fails(()=>s.receive({itemId:"b",quantity:-1,unit:"g",totalCost:1,supplier:"A",key:"1"}));});
 test("negative cost rejected",()=>{const s=createStore();s.register("b","g");fails(()=>s.receive({itemId:"b",quantity:1,unit:"g",totalCost:-1,supplier:"A",key:"1"}));});
 test("missing supplier rejected",()=>{const s=createStore();s.register("b","g");fails(()=>s.receive({itemId:"b",quantity:1,unit:"g",totalCost:1,supplier:" ",key:"1"}));});
 test("excess precision rejected",()=>{const s=createStore();s.register("b","g");fails(()=>s.receive({itemId:"b",quantity:0.00001,unit:"g",totalCost:1,supplier:"A",key:"1"}));});
 test("zero-cost receipt accepted",()=>{const s=createStore();s.register("b","pcs");s.receive({itemId:"b",quantity:2,unit:"pcs",totalCost:0,supplier:"A",key:"1"});assert(s.balance("b").wac===0);});
 test("failed receipt leaves state unchanged",()=>{const s=createStore();s.register("b","g");const before=JSON.stringify(s.snapshot());fails(()=>s.receive({itemId:"b",quantity:1,unit:"pcs",totalCost:1,supplier:"A",key:"1"}));assert(JSON.stringify(s.snapshot())===before);});
 return {passed:results.filter(x=>x.pass).length,total:results.length,results};
}
root.DSInventoryOfflineTestBench={createStore,runTests};
if(typeof module!=="undefined"&&module.exports)module.exports=root.DSInventoryOfflineTestBench;
})(typeof globalThis!=="undefined"?globalThis:this);
