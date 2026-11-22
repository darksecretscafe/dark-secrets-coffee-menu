/**
 * Isolated DRAFT UI mount. Must be called by an authenticated admin page with
 * an injected Supabase client. Does not run in LIVE or the offline v16 preview.
 * Menu prices are READ ONLY here; save prices in existing Menu Management.
 */
import { createInventoryAdminSessionGateway } from './inventory-admin-session-gateway-DRAFT.js';
import { createInventoryPersistenceController } from './inventory-persistence-controller-DRAFT.js';
import { calculateInventoryCosting } from './inventory-costing-snapshot-DRAFT.js';

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
  for (const heading of ['Item','Unit','Stock','Stock value','WAC / base unit','Active']) tr.append(el('th',heading));
  header.append(tr);
  const body = el('tbody');
  table.append(header,body);
  const costingTitle=el('h3','Recipe costing overview');
  const costingTable=el('table');
  const costingHeader=el('thead');
  const costingHeadRow=el('tr');
  for(const heading of ['Product','Price','Recipe cost','Profit','Margin %','Approval'])costingHeadRow.append(el('th',heading));
  costingHeader.append(costingHeadRow);
  const costingBody=el('tbody');costingTable.append(costingHeader,costingBody);
  const stockTitle=el('h3','Receive stock');
  const stockItem=el('select');
  const qty=el('input');qty.type='number';qty.min='0.0001';qty.step='any';qty.placeholder='Purchase quantity';
  const totalCost=el('input');totalCost.type='number';totalCost.min='0';totalCost.step='any';totalCost.placeholder='Total cost';
  const reference=el('input');reference.placeholder='Supplier invoice / reference';
  const receiveButton=el('button','Save stock receipt');receiveButton.type='button';
  const correctionTitle=el('h3','Stock adjustment / wastage');
  const correctionItem=el('select');
  const correctionType=el('select');
  for(const type of ['adjustment','wastage']){const option=el('option',type);option.value=type;correctionType.append(option);}
  const correctionQuantity=el('input');correctionQuantity.type='number';correctionQuantity.step='any';correctionQuantity.placeholder='Signed base-unit quantity (negative for removal)';
  const correctionValue=el('input');correctionValue.type='number';correctionValue.step='any';correctionValue.min='0';correctionValue.placeholder='Added stock value (positive adjustments only)';
  const correctionReason=el('input');correctionReason.placeholder='Reason for correction';
  const correctionButton=el('button','Save stock correction');correctionButton.type='button';
  let pendingCorrection=null;
  const recipeEditTitle=el('h3','Save recipe ingredients');
  const ingredientItem=el('select');
  const ingredientQty=el('input');ingredientQty.type='number';ingredientQty.min='0.0001';ingredientQty.step='any';ingredientQty.placeholder='Quantity in base unit';
  const addLineButton=el('button','Add ingredient');addLineButton.type='button';
  const draftLines=el('ul');
  const saveRecipeButton=el('button','Save recipe draft');saveRecipeButton.type='button';
  let lines=[];
  let recipeDirty=false;
  let loadedRecipeProductId=null;
  let pendingReceipt=null;
  const renderLines=()=>{
    draftLines.replaceChildren();
    for(const [index,line] of lines.entries()){
      const li=el('li',line.name+' — '+line.quantityBase+' '+line.unit+' ');
      const remove=el('button','Remove');remove.type='button';
      remove.addEventListener('click',()=>{lines.splice(index,1);recipeDirty=true;priceConfirmation.checked=false;renderLines();});
      li.append(remove);draftLines.append(li);
    }
  };
  const recipeTitle = el('h3','Recipe review and approval');
  const productSelect = el('select');
  const reviewButton = el('button','Confirm saved menu price reviewed');
  const approveButton = el('button','Approve recipe');
  reviewButton.type='button';approveButton.type='button';
  const priceNote=el('p','Change and save selling prices in Menu Management before review.');
  const priceConfirmation=el('input');priceConfirmation.type='checkbox';
  const priceConfirmationLabel=el('label','I checked the saved menu price and recipe costing for this product');
  priceConfirmationLabel.prepend(priceConfirmation);
  const priceDetails=el('p','Select a product to inspect its saved price and costing.');
  root.replaceChildren(title,status,refreshButton,table,costingTitle,costingTable,stockTitle,stockItem,qty,totalCost,reference,receiveButton,correctionTitle,correctionItem,correctionType,correctionQuantity,correctionValue,correctionReason,correctionButton,recipeTitle,productSelect,recipeEditTitle,ingredientItem,ingredientQty,addLineButton,draftLines,saveRecipeButton,priceNote,priceDetails,priceConfirmationLabel,reviewButton,approveButton);
  let products=[];
  async function loadProducts() {
    const { data,error }=await client.from('products').select('id,name,price');
    if(error)throw error;
    products=Array.isArray(data)?data:[];
    const previousSelection=productSelect.value;
    productSelect.replaceChildren();
    for(const product of products) {
      const option=el('option',product.name+' — '+String(product.price??'No price'));
      option.value=product.id;
      productSelect.append(option);
    }
    if(products.some(product=>product.id===previousSelection))productSelect.value=previousSelection;
  }
  function loadSavedRecipe(productId,force=false){
    if(recipeDirty&&!force){
      status.textContent='Unsaved recipe edits: save them or discard before changing product';
      return false;
    }
    const snapshot=controller.current();
    if(!snapshot)return false;
    const recipe=snapshot.recipes.find(row=>row.product_id===productId);
    const itemById=new Map(snapshot.items.map(item=>[item.id,item]));
    lines=(recipe?snapshot.recipeLines.filter(line=>line.recipe_id===recipe.id):[]).map(line=>{
      const item=itemById.get(line.item_id);
      if(!item)throw new Error('Saved recipe references missing inventory item');
      return {itemId:item.id,quantityBase:Number(line.quantity_base),name:item.name,unit:item.base_unit};
    });
    loadedRecipeProductId=productId;
    recipeDirty=false;
    renderLines();
    return true;
  }
  productSelect.addEventListener('change',()=>{
    priceConfirmation.checked=false;
    if(!loadSavedRecipe(productSelect.value) && loadedRecipeProductId){
      productSelect.value=loadedRecipeProductId;
    }
    const snapshot=controller.current();
    if(snapshot)renderCosting(snapshot);
  });
  const discardRecipeButton=el('button','Discard unsaved recipe edits');
  discardRecipeButton.type='button';
  discardRecipeButton.addEventListener('click',()=>{
    loadSavedRecipe(productSelect.value,true);
    priceConfirmation.checked=false;
    status.textContent='Saved recipe restored from latest loaded snapshot';
  });
  root.insertBefore(discardRecipeButton,saveRecipeButton.nextSibling);
  const formatNumber=value=>Number.isFinite(value)?value.toFixed(4):'—';
  function renderCosting(snapshot){
    const projection=calculateInventoryCosting(snapshot,products);
    const selectedProduct=products.find(p=>p.id===productSelect.value);
    const selectedRecipe=projection.recipes.find(p=>p.productId===productSelect.value);
    priceDetails.textContent=selectedProduct ? 'Saved selling price: '+String(selectedProduct.price)+' | Recipe cost: '+(selectedRecipe?selectedRecipe.cost.toFixed(4):'No recipe')+' | Margin: '+(selectedRecipe?.margin==null?'N/A':selectedRecipe.margin.toFixed(2)+'%') : 'Select a product';
    const balances=new Map(projection.balances.map(balance=>[balance.itemId,balance]));
    body.replaceChildren();
    stockItem.replaceChildren();ingredientItem.replaceChildren();correctionItem.replaceChildren();
    for(const item of snapshot.items){
      if(item.is_active){
        for(const select of [stockItem,ingredientItem,correctionItem]){
          const option=el('option',item.name+' ('+item.base_unit+')');
          option.value=item.id;select.append(option);
        }
      }
      const balance=balances.get(item.id);
      const row=el('tr');
      for(const value of [item.name??'',item.base_unit??'',formatNumber(balance?.quantity??0),
        formatNumber(balance?.value??0),formatNumber(balance?.wac??0),item.is_active?'Yes':'No']){
        row.append(el('td',String(value)));
      }
      body.append(row);
    }
    costingBody.replaceChildren();
    for(const recipe of projection.recipes){
      const row=el('tr');
      for(const value of [recipe.productName,recipe.price==null?'—':formatNumber(recipe.price),
        formatNumber(recipe.cost),recipe.profit==null?'—':formatNumber(recipe.profit),
        recipe.margin==null?'—':recipe.margin.toFixed(2),
        recipe.approved?'Approved':'Not approved / stale']){
        row.append(el('td',String(value)));
      }
      costingBody.append(row);
    }
    return projection;
  }
  async function refresh() {
    refreshButton.disabled=true;
    try {
      const snapshot=await controller.refresh();
      if(!snapshot)return;
      await loadProducts();
      priceConfirmation.checked=false;
      const projection=renderCosting(snapshot);
      if(!recipeDirty)loadSavedRecipe(productSelect.value,true);
      status.textContent='Loaded '+snapshot.items.length+' inventory items and '+projection.recipes.length+' recipes from Supabase';
    } catch(error) {
      status.textContent='Refresh failed: '+error.message;
      throw error;
    } finally {refreshButton.disabled=false;}
  }
  async function mutate(method) {
    if(!productSelect.value) {status.textContent='Select a product first';return;}
    if(recipeDirty){status.textContent='Save or discard unsaved recipe edits before review or approval';return;}
    if(method==='reviewRecipePrice'&&!priceConfirmation.checked){status.textContent='Inspect the saved price and costing, then tick the confirmation';return;}
    reviewButton.disabled=true;approveButton.disabled=true;
    try {
      const outcome=await controller[method](productSelect.value);
      status.textContent=(method==='approveRecipe'?'Recipe approved':'Saved menu price reviewed')+' in database';
      renderCosting(outcome.snapshot);
      priceConfirmation.checked=false;
    }catch(error){status.textContent='Save failed: '+error.message;}
    finally{reviewButton.disabled=false;approveButton.disabled=false;}
  }
  addLineButton.addEventListener('click',()=>{
    const item=controller.current()?.items.find(x=>x.id===ingredientItem.value);
    const amount=Number(ingredientQty.value);
    if(!item||!Number.isFinite(amount)||amount<=0){status.textContent='Select an ingredient and positive quantity';return;}
    if(lines.some(x=>x.itemId===item.id)){status.textContent='Ingredient already added';return;}
    lines.push({itemId:item.id,quantityBase:amount,name:item.name,unit:item.base_unit});
    recipeDirty=true;
    priceConfirmation.checked=false;
    renderLines();ingredientQty.value='';
  });
  async function saveAction(method,payload,button){
    button.disabled=true;
    try{
      const {snapshot}=await controller[method](payload);
      renderCosting(snapshot);
      priceConfirmation.checked=false;
      status.textContent='Saved successfully to database. '+snapshot.items.length+' items refreshed.';
      if(method==='saveRecipe'){recipeDirty=false;loadSavedRecipe(productSelect.value,true);}
      if(method==='receive'){pendingReceipt=null;qty.value='';totalCost.value='';reference.value='';}
      if(method==='correct'){pendingCorrection=null;correctionQuantity.value='';correctionValue.value='';correctionReason.value='';}
    }catch(error){status.textContent='Save failed: '+error.message;}
    finally{button.disabled=false;}
  }
  saveRecipeButton.addEventListener('click',()=>{
    if(!productSelect.value||!lines.length||loadedRecipeProductId!==productSelect.value){status.textContent='Select product and add ingredients first';return;}
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
  correctionButton.addEventListener('click',()=>{
    const item=controller.current()?.items.find(x=>x.id===correctionItem.value);
    const quantityDelta=Number(correctionQuantity.value);
    const type=correctionType.value;
    const reason=correctionReason.value.trim();
    const addedValue=quantityDelta>0?Number(correctionValue.value):null;
    if(!item||!correctionQuantity.value.trim()||!Number.isFinite(quantityDelta)||quantityDelta===0||
       !Number.isFinite(quantityDelta*10000)||Math.abs(quantityDelta)>999999999999.9999||
       !reason||reason.length>250||(type==='wastage'&&quantityDelta>=0)||
       (quantityDelta>0&&(type!=='adjustment'||!correctionValue.value.trim()||!Number.isFinite(addedValue)||addedValue<0))){
      status.textContent='Enter valid signed quantity, reason, and added value for positive adjustments';return;
    }
    const correction={itemId:item.id,type,quantityDelta,addedValue,reason};
    const fingerprint=JSON.stringify(correction);
    if(pendingCorrection&&pendingCorrection.fingerprint!==fingerprint){
      status.textContent='Previous correction outcome uncertain. Reconcile stock before changing this request.';return;
    }
    if(!pendingCorrection){
      const requestKey=globalThis.crypto?.randomUUID?.();
      if(!requestKey){status.textContent='Secure request ID unavailable';return;}
      pendingCorrection={fingerprint,requestKey};
    }
    saveAction('correct',{...correction,requestKey:pendingCorrection.requestKey},correctionButton);
  });
  refreshButton.addEventListener('click',()=>{refresh().catch(()=>{});});
  reviewButton.addEventListener('click',()=>{mutate('reviewRecipePrice');});
  approveButton.addEventListener('click',()=>{mutate('approveRecipe');});
  await refresh();
  return Object.freeze({refresh,controller});
}
