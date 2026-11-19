'use strict';
/* DRAFT-only in-memory Menu Management -> Inventory Management relay.
   Include this BEFORE the draft admin-products hook and AFTER the inventory
   snapshot contract. Never load it on the production admin page.
   It does not query Supabase, persist data, or modify menu products. */
(function(root){
 let latest=null,receiver=null;
 const normalize=rows=>root.DSInventoryProductSnapshot.normalize(rows);
 root.DS_DRAFT_publishMenuRows=function(alreadyLoadedRows){
  const next=normalize(alreadyLoadedRows);
  // Do not replace the last good snapshot if receiver rejects it.
  if(receiver)receiver(next);
  latest=next;
  return next.length;
 };
 root.DS_DRAFT_attachInventoryReceiver=function(callback){
  if(typeof callback!=='function')throw new TypeError('Inventory receiver callback required.');
  if(latest)callback(latest);
  receiver=callback;
  return function detach(){if(receiver===callback)receiver=null;};
 };
 root.DS_DRAFT_currentMenuRows=function(){return latest;};
})(typeof window!=='undefined'?window:globalThis);
