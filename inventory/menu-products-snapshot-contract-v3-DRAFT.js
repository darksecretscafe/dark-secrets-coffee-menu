'use strict';
/**
 * DRAFT-only Menu -> Inventory product snapshot contract.
 * No Supabase imports, queries, credentials, persistence, or production hooks.
 * The authenticated Menu Management host explicitly supplies its already-loaded rows.
 */
(function(root){
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function normalize(rows){
  if(!Array.isArray(rows))throw new TypeError('Menu snapshot must be an array.');
  if(rows.length>1000)throw new RangeError('Menu snapshot exceeds 1000 products.');
  const seen=new Set();
  return Object.freeze(rows.map((row,index)=>{
   if(!row||!UUID.test(String(row.id||'')))throw new Error('Invalid product UUID at row '+(index+1));
   const id=String(row.id).toLowerCase(),name=String(row.name||'').trim();
   if(seen.has(id))throw new Error('Duplicate product UUID: '+id);
   if(!name||name.length>150)throw new Error('Invalid product name at row '+(index+1));
   const price=Number(row.price);
   if(row.price==null||row.price===''||!Number.isFinite(price)||price<0)throw new Error('Invalid product price at row '+(index+1));
   seen.add(id);
   return Object.freeze({id,name,price,is_active:row.is_active===true,
    product_code:row.product_code==null?null:String(row.product_code),
    category:row.category==null?'':String(row.category)});
  }));
 }
 function createBridge(onSnapshot){
  if(typeof onSnapshot!=='function')throw new TypeError('Snapshot receiver required.');
  let last=Object.freeze([]);
  return Object.freeze({
   acceptAlreadyAuthorizedMenuRows(rows){
    const snapshot=normalize(rows);
    onSnapshot(snapshot);
    last=snapshot;
    return snapshot.length;
   },
   current(){return last;}
  });
 }
 root.DSInventoryProductSnapshot=Object.freeze({normalize,createBridge});
})(typeof window!=='undefined'?window:globalThis);
