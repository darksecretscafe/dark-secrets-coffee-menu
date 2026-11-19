'use strict';
/**
 * Dark Secrets Coffee — draft read-only Menu Management product adapter.
 * This file does not create a Supabase client, import LIVE config, or run a query
 * on its own. Call createMenuProductReader(injectedAuthenticatedClient).load()
 * only after explicit approval to connect the inventory UI to the existing DB.
 */
(function(root){
  const COLUMNS='id,product_code,name,price,category,is_active,oat_eligible,description,image_path';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function normalize(row){
    if(!row || !UUID.test(String(row.id||'')))throw new Error('Invalid menu product UUID in response.');
    const name=String(row.name||'').trim();
    if(!name)throw new Error('Menu product name is missing.');
    return Object.freeze({
      id:String(row.id).toLowerCase(),
      product_code:row.product_code==null?null:String(row.product_code),
      name,
      price:typeof row.price==='number'&&Number.isFinite(row.price)?row.price:null,
      category:row.category==null?'':String(row.category),
      is_active:row.is_active===true,
      oat_eligible:row.oat_eligible===true
    });
  }
  function createMenuProductReader(client){
    if(!client || typeof client.from!=='function')throw new TypeError('An authenticated Supabase client must be injected.');
    return Object.freeze({
      async load(){
        // RLS must authorize this read for the signed-in user.
        const {data,error}=await client.from('products').select(COLUMNS).order('product_code');
        if(error)throw new Error('Menu product read failed: '+(error.message||'unknown error'));
        if(!Array.isArray(data))throw new Error('Menu product response was not an array.');
        const ids=new Set();
        return data.map(row=>{
          const p=normalize(row);
          if(ids.has(p.id))throw new Error('Duplicate product UUID in menu response.');
          ids.add(p.id);
          return p;
        });
      }
    });
  }
  root.DSInventoryMenuReader=Object.freeze({createMenuProductReader,normalize,COLUMNS});
})(typeof window!=='undefined'?window:globalThis);
