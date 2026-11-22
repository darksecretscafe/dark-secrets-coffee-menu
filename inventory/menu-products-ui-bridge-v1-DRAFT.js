'use strict';
/* DRAFT integration bridge: host supplies an authenticated client after approval.
   Does not initialize a client, read config, or issue queries automatically. */
(function(root){
  function attach({button,clientProvider,onProducts,onError,onStatus}){
    if(!button||typeof clientProvider!=='function'||typeof onProducts!=='function')throw new TypeError('Missing required UI integration arguments.');
    let busy=false;
    button.addEventListener('click',async function(){
      if(busy)return;
      const client=clientProvider();
      if(!client||typeof client.from!=='function'){
        onError?.('No approved authenticated client. Showing sample menu only.');
        return;
      }
      if(!root.confirm('Load existing menu products read-only? No product changes will be made.'))return;
      busy=true;button.disabled=true;
      try{
        const products=await root.DSInventoryMenuReader.createMenuProductReader(client).load();
        onProducts(products);
        onStatus?.('Loaded '+products.length+' existing menu products (read-only).');
      }catch(e){onError?.(e.message)}
      finally{busy=false;button.disabled=false}
    });
  }
  root.DSInventoryMenuBridge=Object.freeze({attach});
})(typeof window!=='undefined'?window:globalThis);
