/**
 * Isolated DRAFT UI mount. Must be called by an authenticated admin page with
 * an injected Supabase client. Does not run in LIVE or the offline v16 preview.
 * Menu prices are READ ONLY here; save prices in existing Menu Management.
 */
import { createInventoryAdminSessionGateway } from './inventory-admin-session-gateway-DRAFT.js';
import { createInventoryPersistenceController } from './inventory-persistence-controller-DRAFT.js';

export async function mountInventoryPersistentAdminPanel(root, client) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('DOM root required');
  const session = await createInventoryAdminSessionGateway(client);
  const controller = createInventoryPersistenceController(session);
  const doc = root.ownerDocument;
  const el = (tag, text = '') => { const node = doc.createElement(tag); node.textContent = text; return node; };
  const title = el('h2','Inventory Management — persistent draft');
  const status = el('p','Loading inventory…');
  status.setAttribute('role','status');
  const refreshButton = el('button','Refresh from Supabase');
  refreshButton.type='button';
  const table = el('table');
  const header = el('thead');
  const tr = el('tr');
  for (const heading of ['Item','Unit','Active']) tr.append(el('th',heading));
  header.append(tr);
  const body = el('tbody');
  table.append(header,body);
  const stockTitle=el('h3','Receive stock');
  const stockItem=el('select');
  const qty=el('input');qty.type='number';qty.min='0.0001';qty.step='any';qty.placeholder='Purchase quantity';
  const totalCost=el('input');totalCost.type='number';totalCost.min='0';totalCost.step='any';totalCost.placeholder='Total cost';
  const reference=el('input');reference.placeholder='Supplier invoice / reference';
  const receiveButton=el('button','Save stock receipt');receiveButton.type='button';
  const recipeEditTitle=el('h3','Save recipe ingredients');
  const ingredientItem=el('select');
  const ingredientQty=el('input');ingredientQty.type='number';ingredientQty.min='0.0001';ingredientQty.step='any';ingredientQty.placeholder='Quantity in base unit';
  const addLineButton=el('button','Add ingredient');addLineButton.type='button';
  const draftLines=el('ul');
  const saveRecipeButton=el('button','Save recipe draft');saveRecipeButton.type='button';
  let lines=[];
  let pendingReceipt=null;
  const renderLines=()=>{
    draftLines.replaceChildren();
    for(const [index,line] of lines.entries()){
      const li=el('li',line.name+' — '+line.quantityBase+' '+line.unit+' ');
      const remove=el('button','Remove');remove.type='button';
      remove.addEventListener('click',()=>{lines.splice(index,1);renderLines();});
      li.append(remove);draftLines.append(li);
    }
  };
  const recipeTitle = el('h3','Recipe review and approval');
  const productSelect = el('select');
  const reviewButton = el('button','Confirm saved menu price reviewed');
  const approveButton = el('button','Approve recipe');
  reviewButton.type='button';approveButton.type='button';
  const priceNote=el('p','Change and save selling prices in Menu Management before review.');
  root.replaceChildren(title,status,refreshButton,table,stockTitle,stockItem,qty,totalCost,reference,receiveButton,recipeTitle,productSelect,recipeEditTitle,ingredientItem,ingredientQty,addLineButton,draftLines,saveRecipeButton,priceNote,reviewButton,approveButton);
  let products=[];
  async function loadProducts() {
    const { data,error }=await client.from('products').select('id,name,price');
    if(error)throw error;
    products=Array.isArray(data)?data:[];
    productSelect.replaceChildren();
    for(const product of products) {
      const option=el('option',product.name+' — '+String(product.price??'No price'));
      option.value=product.id;
      productSelect.append(option);
    }
  }
  async function refresh() {
    refreshButton.disabled=true;
    try {
      const snapshot=await controller.refresh();
      if(!snapshot)return;
      body.replaceChildren();
      stockItem.replaceChildren();ingredientItem.replaceChildren();
      for(const item of snapshot.items) {
        if(item.is_active){
          for(const select of [stockItem,ingredientItem]){
            const option=el('option',item.name+' ('+item.base_unit+')');option.value=item.id;select.append(option);
          }
        }
        const row=el('tr');
        for(const value of [item.name??'',item.base_unit??'',item.is_active?'Yes':'No'])row.append(el('td',String(value)));
        body.append(row);
      }
      await loadProducts();
      status.textContent='Loaded '+snapshot.items.length+' inventory items from Supabase';
    } catch(error) {
      status.textContent='Refresh failed: '+error.message;
      throw error;
    } finally {refreshButton.disabled=false;}
  }
  async function mutate(method) {
    if(!productSelect.value) {status.textContent='Select a product first';return;}
    reviewButton.disabled=true;approveButton.disabled=true;
    try {
      const outcome=await controller[method](productSelect.value);
      status.textContent=(method==='approveRecipe'?'Recipe approved':'Saved menu price reviewed')+' in database';
      body.replaceChildren();
      for(const item of outcome.snapshot.items) {
        const row=el('tr');
        for(const value of [item.name??'',item.base_unit??'',item.is_active?'Yes':'No'])row.append(el('td',String(value)));
        body.append(row);
      }
    }catch(error){status.textContent='Save failed: '+error.message;}
    finally{reviewButton.disabled=false;approveButton.disabled=false;}
  }
  addLineButton.addEventListener('click',()=>{
    const item=controller.current()?.items.find(x=>x.id===ingredientItem.value);
    const amount=Number(ingredientQty.value);
    if(!item||!Number.isFinite(amount)||amount<=0){status.textContent='Select an ingredient and positive quantity';return;}
    if(lines.some(x=>x.itemId===item.id)){status.textContent='Ingredient already added';return;}
    lines.push({itemId:item.id,quantityBase:amount,name:item.name,unit:item.base_unit});
    renderLines();ingredientQty.value='';
  });
  async function saveAction(method,payload,button){
    button.disabled=true;
    try{
      const {snapshot}=await controller[method](payload);
      status.textContent='Saved successfully to database. '+snapshot.items.length+' items refreshed.';
      if(method==='saveRecipe'){lines=[];renderLines();}
      if(method==='receive'){pendingReceipt=null;qty.value='';totalCost.value='';reference.value='';}
    }catch(error){status.textContent='Save failed: '+error.message;}
    finally{button.disabled=false;}
  }
  saveRecipeButton.addEventListener('click',()=>{
    if(!productSelect.value||!lines.length){status.textContent='Select product and add ingredients first';return;}
    saveAction('saveRecipe',{productId:productSelect.value,lines:lines.map(({itemId,quantityBase})=>({itemId,quantityBase})),targetMarginPercent:null},saveRecipeButton);
  });
  receiveButton.addEventListener('click',()=>{
    const item=controller.current()?.items.find(x=>x.id===stockItem.value);
    const quantity=Number(qty.value),cost=Number(totalCost.value);
    if(!item||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(cost)||cost<0||!reference.value.trim()){
      status.textContent='Enter valid quantity, cost, and reference';return;
    }
    const receipt={itemId:item.id,quantity,unit:item.preferred_purchase_unit,totalCost:cost,reference:reference.value.trim()};
    if(!receipt.unit){status.textContent='Item purchase unit missing';return;}
    const fingerprint=JSON.stringify(receipt);
    if(pendingReceipt && pendingReceipt.fingerprint!==fingerprint){
      status.textContent='Previous receipt outcome is uncertain. Restore the previous values to retry, or refresh and reconcile stock before submitting a different receipt.';
      return;
    }
    if(!pendingReceipt){
      const requestKey=globalThis.crypto?.randomUUID?.();
      if(!requestKey){status.textContent='Secure request ID unavailable';return;}
      pendingReceipt={fingerprint,requestKey};
    }
    saveAction('receive',{...receipt,requestKey:pendingReceipt.requestKey},receiveButton);
  });
  refreshButton.addEventListener('click',()=>{refresh().catch(()=>{});});
  reviewButton.addEventListener('click',()=>{mutate('reviewRecipePrice');});
  approveButton.addEventListener('click',()=>{mutate('approveRecipe');});
  await refresh();
  return Object.freeze({refresh,controller});
}
