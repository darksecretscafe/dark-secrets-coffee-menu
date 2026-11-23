import { createInventoryAdminSessionGateway } from './inventory-admin-session-gateway-DRAFT.js';
import { createInventoryPersistenceController } from './inventory-persistence-controller-DRAFT.js';
import { calculateInventoryCosting } from './inventory-costing-snapshot-DRAFT.js';

// Mounts the original approved v16 HTML structure; no replacement layout or sample data.
export async function mountApprovedV16Inventory(root, client) {
  const session = await createInventoryAdminSessionGateway(client);
  const doc = root.ownerDocument;
  if (!doc.querySelector('link[data-inventory-v16-style]')) {
    const style = doc.createElement('link');
    style.rel = 'stylesheet';
    style.dataset.inventoryV16Style = 'true';
    style.href = new URL('./inventory-v16-approved-style-WIP.css?v=20261123-dashboard-contrast', import.meta.url).href;
    doc.head.append(style);
  }
  const controller = createInventoryPersistenceController(session);
  const response = await fetch(new URL('./inventory-v16-approved-live-template.html?v=20261123-no-checkbox', import.meta.url));
  if (!response.ok) throw new Error('Approved v16 template could not load');
  const template = root.ownerDocument.createElement('template');
  template.innerHTML = await response.text();
  const scope = root.ownerDocument.createElement('div');
  scope.id = 'inventoryV16';
  scope.append(template.content.cloneNode(true));
  root.replaceChildren(scope);
  const $ = id => scope.querySelector('#' + id);
  const el = (tag, value = '') => {
    const node = root.ownerDocument.createElement(tag);
    node.textContent = String(value);
    return node;
  };
  const message = text => { $('message').textContent = text; };
  const num = value => Number(value || 0);
  const money = value => num(value).toFixed(4);
  let snapshot, products = [], selectedId = null, lines = [], dirty = false, page = 0;
  let pendingReceipt = null;
  const pageSize = 5;
  const findItem = id => snapshot?.items.find(i => i.id === id);
  const projection = () => calculateInventoryCosting(snapshot, products);
  const balances = () => new Map(projection().balances.map(b => [b.itemId, b]));
  const recipe = id => snapshot?.recipes.find(r => r.product_id === id);
  const recipeState = id => !recipe(id) ? 'no' :
    projection().recipes.find(r => r.productId === id)?.approved ? 'done' : 'draft';
  const option = (value, label) => { const node = el('option', label); node.value = value; return node; };
  const row = values => { const tr = el('tr'); values.forEach(v => tr.append(el('td', v))); return tr; };
  const showTab = name => {
    for (const key of ['home','stock','receive','recipes']) $(key).hidden = key !== name;
    for (const button of scope.querySelectorAll('[data-tab]')) button.setAttribute('aria-selected', String(button.dataset.tab === name));
    if (name === 'recipes') queueMicrotask(()=>guideNextStep());
    $('priceApproval').hidden = name !== 'recipes' || !selectedId;
  };
  scope.querySelectorAll('[data-tab],[data-go]').forEach(button =>
    button.addEventListener('click', () => showTab(button.dataset.tab || button.dataset.go)));
  const stockForm = $('stockForm');
  const syncReceiveUnit = () => {
    const item = findItem($('receiveItem').value);
    $('purchaseUnit').replaceChildren(...(item ? [option(item.preferred_purchase_unit,item.preferred_purchase_unit)] : []));
  };
  $('receiveItem').addEventListener('change', syncReceiveUnit);
  const costFor = id => num(balances().get(id)?.wac);
  const guideNextStep = () => {
    scope.querySelectorAll('.ds-guide-glow').forEach(node=>node.classList.remove('ds-guide-glow'));
    let next = null;
    if ($('recipes').hidden) return;
    if (!selectedId) next = $('productRows').querySelector('button');
    else if (!lines.length) next = $('recipeItem');
    else if (dirty) next = $('complete');
    else {
      const r=recipe(selectedId);
      if (!r?.price_reviewed_at || Number(r.price_review_revision)!==Number(r.recipe_revision))
        next = $('reviewPrice');
      else if (Number(r.approved_revision)!==Number(r.recipe_revision))
        next = $('approveRecipe');
    }
    if (next && !next.disabled) next.classList.add('ds-guide-glow');
  };
  const showLines = () => {
    $('lines').replaceChildren();
    for (const [index,line] of lines.entries()) {
      const item = findItem(line.itemId);
      const tr = row([item?.name || 'Unknown item', line.quantityBase + ' ' + (item?.base_unit || ''),
        '₱' + money(line.quantityBase * costFor(line.itemId))]);
      const cell = el('td');
      const remove = el('button','Remove'); remove.type = 'button'; remove.className = 'secondary';
      remove.addEventListener('click', () => {
        lines.splice(index,1); dirty = true; showLines();
      });
      const edit = el('button','Edit');edit.type='button';edit.className='secondary';
      edit.addEventListener('click',()=>{
        $('recipeItem').value=String(line.itemId);
        $('recipeQty').value=String(line.quantityBase);
        lines.splice(index,1);dirty=true;showLines();
        $('recipeQty').focus();guideNextStep();
        message('Edit quantity, then click Add selected ingredient to update this line.');
      });
      cell.append(edit,remove); tr.append(cell); $('lines').append(tr);
    }
    const product = products.find(p => p.id === selectedId);
    if (!product) return;
    const cost = lines.reduce((sum,l) => sum + l.quantityBase * costFor(l.itemId),0);
    const price = num(product.price);
    const profit = price - cost;
    const margin = price > 0 ? profit / price * 100 : null;
    const costPercent = price > 0 ? cost / price * 100 : null;
    const estimate = $('estimate');
    estimate.replaceChildren();
    const heading = el('div'); heading.className='costing-heading';
    const headingText=el('strong','RECIPE COSTING OVERVIEW');
    const tag=el('span',dirty?'Unsaved changes':'LIVE COSTING');tag.className='costing-tag';
    heading.append(headingText,tag);estimate.append(heading);
    const grid=el('div');grid.className='costing-grid';
    const tile=(label,value,highlight=false)=>{
      const box=el('div');box.className='costing-tile'+(highlight?' profit':'');
      box.append(el('small',label),el('strong',value));grid.append(box);
    };
    tile('Recipe Cost','₱'+money(cost));
    tile('Current Menu Price','₱'+money(price));
    tile('Proposed Selling Price','₱'+money(price),true);
    tile('Gross Profit','₱'+money(profit));
    tile('Recipe Cost %',costPercent===null?'—':costPercent.toFixed(1)+'%');
    tile('Recipe Gross Margin',margin===null?'—':margin.toFixed(1)+'%');
    estimate.append(grid);
    const controls=el('div');controls.className='price-controls';
    const priceLabel=el('label','Set your preferred selling price (₱)');
    const proposed=el('input');proposed.type='number';proposed.min='0.01';proposed.step='0.01';proposed.value=price.toFixed(2);
    proposed.id='customPriceInput';priceLabel.append(proposed);
    const review=el('button','Review in Menu Management');review.type='button';review.id='applyCustomPrice';
    review.addEventListener('click',()=>{
      const desired=Number(proposed.value);
      if(!Number.isFinite(desired)||desired<=0||desired>99999.99)
        return message('Enter a valid proposed selling price (₱0.01–₱99,999.99).');
      const tab=doc.getElementById('tabProducts');
      if(!tab || typeof doc.defaultView?.DS_selectAdminTab!=='function')
        return message('Menu Management is unavailable. No price was changed.');
      doc.defaultView.DS_selectAdminTab('Products');
      doc.defaultView.dispatchEvent(new CustomEvent('ds:inventory-price-review',{
        detail:{productId:String(selectedId),proposedPrice:desired}
      }));
    });
    const reset=el('button','Reset Proposal');reset.type='button';reset.id='resetCustomPrice';
    reset.addEventListener('click',()=>{proposed.value=price.toFixed(2);});
    controls.append(priceLabel,review,reset);estimate.append(controls);
    const bottom=el('div');bottom.className='costing-bottom';
    bottom.append(el('span','Recipe costing is calculated from ingredients and selling price.'));
    const marginBox=el('span');marginBox.className='target-box '+(margin===null?'unknown':margin<=0?'low':'good');
    marginBox.append(el('strong','Recipe Gross Margin: '+(margin===null?'—':margin.toFixed(1)+'%')));
    bottom.append(marginBox);estimate.append(bottom);
    const note=el('p','Recipe-level figures exclude operating expenses and other unallocated costs. Menu prices are only edited in Menu Management.');
    note.className='costing-footnote';estimate.append(note);
    $('priceDetails').textContent = 'Saved menu price: ₱' + price.toFixed(2) +
      ' · Recipe revision: ' + (recipe(selectedId)?.recipe_revision ?? 'Not saved');
    const saved=recipe(selectedId);
    const checks=[
      ['Ingredients & quantities',lines.length>0 && !dirty],
      ['Ingredient costs available',lines.length>0 && lines.every(l=>num(balances().get(l.itemId)?.quantity)>0 && costFor(l.itemId)>=0)],
      ['Selling price available',price>0],
      ['Costing reviewed',!!saved?.price_reviewed_at && saved?.price_review_revision===saved?.recipe_revision]
    ];
    $('readiness').textContent=checks.filter(x=>x[1]).length+' of 4 ready';
    $('requirements').replaceChildren(...checks.map(([label,ok])=>{
      const box=el('div',(ok?'✓ ':'○ ')+label);box.className='requirement '+(ok?'ok':'wait');return box;
    }));
    $('complete').textContent='Save Recipe';
    $('complete').disabled=!dirty;
    guideNextStep();

  };
  const selectProduct = (id, force = false) => {
    if (dirty && !force) { message('Save or discard unsaved recipe changes before switching products.'); return; }
    const product = products.find(p => p.id === id);
    if (!product) return;
    selectedId = id;
    const saved = recipe(id);
    lines = (saved ? snapshot.recipeLines.filter(l => l.recipe_id === saved.id) : []).map(l => {
      if (!findItem(l.item_id)) throw new Error('Saved recipe references missing inventory item');
      return {itemId:l.item_id,quantityBase:num(l.quantity_base)};
    });
    dirty = false;
   
    $('recipeEditor').hidden = false;
    $('priceApproval').hidden = $('recipes').hidden;
    $('selected').textContent = 'Selected: '+product.name+' · Product ID: '+product.id;
    showLines();
  };
  const renderProducts = () => {
    const query = $('productSearch').value.trim().toLowerCase();
    const filter = $('recipeFilter').value;
    const status = {no:'No Recipe',draft:'Draft',done:'Completed'};
    const order = {no:0,draft:1,done:2};
    const filtered = products.filter(p => p.name.toLowerCase().includes(query) &&
      (filter === 'all' || recipeState(p.id) === filter))
      .sort((a,b) => order[recipeState(a.id)] - order[recipeState(b.id)] || a.name.localeCompare(b.name));
    const maxPage = Math.max(0,Math.ceil(filtered.length/pageSize)-1);
    page = Math.min(page,maxPage);
    $('productRows').replaceChildren();
    for (const p of filtered.slice(page*pageSize,(page+1)*pageSize)) {
      const tr=el('tr');
      tr.append(el('td',p.name));
      const statusCell=el('td');
      const state=recipeState(p.id);
      const pill=el('span',status[state]);pill.className='pill '+(state==='done'?'done':state==='draft'?'draft':'');
      statusCell.append(pill);tr.append(statusCell);
      const cell=el('td');
      const button=el('button',state==='no'?'Select':state==='draft'?'Continue':'View');
      button.type='button';
      button.addEventListener('click',()=>selectProduct(p.id));
      cell.append(button);tr.append(cell);$('productRows').append(tr);
    }
    const pages=maxPage+1;
    $('pageInfo').textContent=filtered.length?'Showing '+(page*pageSize+1)+'–'+
      Math.min(filtered.length,(page+1)*pageSize)+' of '+filtered.length+
      ' · Page '+(page+1)+'/'+pages:'No matching products';
    $('prevPage').disabled = page === 0;
    $('nextPage').disabled = page >= maxPage;
    $('recipeSummary').replaceChildren();
    for(const [label,count] of [
      ['All',products.length],
      ['No Recipe',products.filter(p=>recipeState(p.id)==='no').length],
      ['Draft',products.filter(p=>recipeState(p.id)==='draft').length],
      ['Completed',products.filter(p=>recipeState(p.id)==='done').length]
    ]) {
      const badge=el('span');badge.append(el('strong',label+': '+count));
      $('recipeSummary').append(badge);
    }
  };
  $('productSearch').addEventListener('input',()=>{page=0;renderProducts();guideNextStep();});
  $('recipeFilter').addEventListener('change',()=>{page=0;renderProducts();guideNextStep();});
  $('prevPage').addEventListener('click',()=>{page--;renderProducts();});
  $('nextPage').addEventListener('click',()=>{page++;renderProducts();});
  let editingStockId=null;
  const stockItemPayload=(item,overrides={})=>({
    id:item.id,code:item.item_code,name:item.name,category:item.category,
    type:item.item_type,baseUnit:item.base_unit,
    purchaseUnit:item.preferred_purchase_unit,minimumStock:num(item.minimum_stock),
    active:item.is_active,supplier:item.supplier??null,brand:item.brand??null,
    notes:item.notes??null,...overrides
  });
  const cancelStockEdit=()=>{
    editingStockId=null;stockForm.reset();
    $('saveStockItem').textContent='Add stock item';
    $('cancelStockEdit').hidden=true;
    stockForm.elements.namedItem('unit').disabled=false;
  };
  $('cancelStockEdit').addEventListener('click',cancelStockEdit);
  const editStockItem=item=>{
    editingStockId=item.id;
    const f=stockForm.elements;
    f.namedItem('name').value=item.name;
    f.namedItem('type').value=item.item_type;
    f.namedItem('unit').value=item.base_unit;
    f.namedItem('min').value=String(item.minimum_stock);
    // Units are immutable once registered: movements and recipe lines use base units.
    f.namedItem('unit').disabled=true;
    $('saveStockItem').textContent='Save changes';
    $('cancelStockEdit').hidden=false;
    stockForm.scrollIntoView({behavior:'smooth',block:'start'});
    f.namedItem('name').focus();
  };
  const deleteStockItem=async(item,button)=>{
    const used=(snapshot.movements||[]).some(m=>String(m.item_id)===String(item.id)) ||
      (snapshot.recipeLines||snapshot.recipe_lines||[]).some(l=>String(l.item_id)===String(item.id));
    if(!doc.defaultView.confirm('Remove "'+item.name+'" from active Stock Master? This archives the item without deleting stock history or recipe records.'))return;
    button.disabled=true;
    try{
      const result=await controller.saveItem(stockItemPayload(item,{active:false}));
      snapshot=result.snapshot;
      if(editingStockId===item.id)cancelStockEdit();
      render();
      message('Stock item archived. Historical transactions and recipes remain intact.'+(used?' Item had existing usage.':''));
    }catch(e){message('Remove failed: '+e.message);}
    finally{button.disabled=false;}
  };
  const render = () => {
    const b = balances();
    $('count').textContent = snapshot.items.length;
    $('low').textContent = snapshot.items.filter(i => num(b.get(i.id)?.quantity) <= num(i.minimum_stock)).length;
    $('pending').textContent = products.filter(p=>recipeState(p.id)!=='done').length;
    $('stockRows').replaceChildren();
    for (const item of snapshot.items.filter(i=>i.is_active)) {
      const balance=b.get(item.id);
      const tr=row([item.name,money(balance?.quantity)+' '+item.base_unit,
        '₱'+money(balance?.wac),num(balance?.quantity)<=num(item.minimum_stock)?'Low':'OK']);
      const actions=el('td');
      const edit=el('button','Edit');edit.type='button';edit.className='secondary';
      edit.addEventListener('click',()=>editStockItem(item));
      const remove=el('button','Delete');remove.type='button';remove.className='secondary';
      remove.title='Archive this item; preserve receiving and recipe history';
      remove.addEventListener('click',()=>deleteStockItem(item,remove));
      actions.append(edit,remove);tr.append(actions);$('stockRows').append(tr);
    }
    const previous = $('receiveItem').value;
    const previousIngredient = $('recipeItem').value;
    const active = snapshot.items.filter(i => i.is_active);
    $('receiveItem').replaceChildren(...active.map(i=>option(i.id,i.name)));
    $('recipeItem').replaceChildren(...active.map(i=>option(i.id,i.name+' ('+i.base_unit+')')));
    if (active.some(i=>i.id===previous)) $('receiveItem').value=previous;
    if (active.some(i=>i.id===previousIngredient)) $('recipeItem').value=previousIngredient;
    syncReceiveUnit();
    const receipts = snapshot.movements.filter(m=>m.movement_type==='receive')
      .slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')) ||
        String(b.id).localeCompare(String(a.id))).slice(0,20);
    $('activity').textContent = receipts.length ? receipts.length+' recent receiving transaction(s)' : 'No transactions yet.';
    $('costHistoryRows').replaceChildren();
    for (const m of receipts) {
      const item = findItem(m.item_id);
      const beforeQty = num(m.quantity_after)-num(m.quantity_delta);
      const beforeValue = num(m.value_after)-num(m.value_delta);
      $('costHistoryRows').append(row([item?.name||'Unknown',money(m.quantity_delta),
        '₱'+money(beforeQty>0?beforeValue/beforeQty:0),
        '₱'+money(num(m.quantity_after)>0?num(m.value_after)/num(m.quantity_after):0),m.reference||'—']));
    }
    renderProducts();
    if (selectedId && !dirty) selectProduct(selectedId,true);
    guideNextStep();
  };
  const refresh = async () => {
    snapshot = await controller.refresh();
    const {data,error} = await client.from('products').select('id,name,price').order('name');
    if (error) throw error;
    products = data || [];
    render();
    message('Inventory loaded from Supabase.');
    return snapshot;
  };
  // Generated once per pending item, including retries after an uncertain save.
  let pendingStockCode=null;
  stockForm.addEventListener('input',()=>{pendingStockCode=null;});
  stockForm.addEventListener('change',()=>{pendingStockCode=null;});
  stockForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const f=stockForm.elements;
    const minimumStock=Number(f.namedItem('min').value);
    const name=f.namedItem('name').value.trim();
    const type=f.namedItem('type').value;
    const baseUnit=f.namedItem('unit').value;
    if(!name || !['ingredient','packaging'].includes(type) ||
       !['g','ml','pcs'].includes(baseUnit) ||
       !Number.isFinite(minimumStock)||minimumStock<0)
      return message('Enter valid stock item details.');
    const editingItem=editingStockId?findItem(editingStockId):null;
    if(editingStockId&&!editingItem)return message('Item no longer exists. Refresh Stock Master.');
    if(!editingItem&&!pendingStockCode){
      const uuid=globalThis.crypto?.randomUUID?.();
      if(!uuid)return message('Secure item code generation unavailable.');
      pendingStockCode='DSC-'+uuid;
    }
    const button=stockForm.querySelector('button[type="submit"],button:not([type])');
    button.disabled=true;
    try{
      const result=await controller.saveItem({
        id:editingItem?.id??null,code:editingItem?.item_code??pendingStockCode,name,
        category:type==='ingredient'?'Ingredient':'Packaging',type,
        baseUnit:editingItem?.base_unit??baseUnit,
        purchaseUnit:editingItem?.preferred_purchase_unit??baseUnit,
        minimumStock,active:true,supplier:editingItem?.supplier??null,
        brand:editingItem?.brand??null,notes:editingItem?.notes??null
      });
      snapshot=result.snapshot;const createdCode=editingItem?.item_code??pendingStockCode;
      cancelStockEdit();pendingStockCode=null;render();
      message(editingItem?'Stock item changes saved. Item code unchanged.':'Stock item saved to Supabase. Generated item code: '+createdCode);
    }catch(e){message('Save not confirmed: '+e.message+'. Check registered stock items before retrying.');}
    finally{button.disabled=false;}
  });
  $('receiveForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const item=findItem($('receiveItem').value),quantity=Number($('receiveQty').value),
      totalCost=Number($('receiveCost').value),reference=$('reference').value.trim();
    if (!item || !Number.isFinite(quantity)||quantity<=0||!Number.isFinite(totalCost)||
        totalCost<0||!reference) return message('Enter valid receipt details.');
    const payload={itemId:item.id,quantity,unit:$('purchaseUnit').value,totalCost,reference};
    const fingerprint=JSON.stringify(payload);
    if(pendingReceipt && pendingReceipt.fingerprint!==fingerprint)
      return message('Uncertain prior receipt. Retry same values or reconcile stock before another transaction.');
    if(!pendingReceipt) {
      const requestKey=globalThis.crypto?.randomUUID?.();
      if(!requestKey)return message('Secure transaction ID unavailable.');
      pendingReceipt={fingerprint,requestKey};
    }
    const button=$('receiveForm').querySelector('button');
    button.disabled=true;
    try {
      const result=await controller.receive({...payload,requestKey:pendingReceipt.requestKey});
      snapshot=result.snapshot;pendingReceipt=null;render();
      $('receiveQty').value='';$('receiveCost').value='';$('reference').value='';
      message('Receiving saved and verified from Supabase.');
    }catch(e){message('Receipt not confirmed: '+e.message+'; retry the same values.');}
    finally{button.disabled=false;}
  });
  $('recipeForm').addEventListener('submit',event=>{
    event.preventDefault();
    const item=findItem($('recipeItem').value),quantityBase=Number($('recipeQty').value);
    if(!selectedId||!item||!item.is_active||!Number.isFinite(quantityBase)||quantityBase<=0||
       lines.some(l=>l.itemId===item.id))return message('Select a new ingredient and positive quantity.');
    lines.push({itemId:item.id,quantityBase});
    dirty=true;$('recipeQty').value='';showLines();
  });
  const mutate = async (method,payload,button) => {
    button.disabled=true;
    try {
      const result=await controller[method](payload);
      snapshot=result.snapshot;
      if(method==='saveRecipe'){dirty=false;selectProduct(selectedId,true);}
      else
      render();
      message(method==='saveRecipe'?'Recipe saved to Supabase.':
        method==='reviewRecipePrice'?'Saved price reviewed.':'Recipe approved.');
    }catch(e){message('Action failed: '+e.message);}finally{button.disabled=false;}
  };
  $('complete').addEventListener('click',()=>{
    if(!selectedId||!lines.length)return message('Select a product and add ingredients first.');
    mutate('saveRecipe',{productId:selectedId,lines:lines.map(l=>({...l})),targetMarginPercent:null},$('complete'));
  });
  $('reviewPrice').addEventListener('click',()=>{
    if(dirty||!recipe(selectedId))return message('Save changes and confirm the saved price first.');
    mutate('reviewRecipePrice',selectedId,$('reviewPrice'));
  });
  $('approveRecipe').addEventListener('click',()=>{
    const r=recipe(selectedId);
    if(dirty||!r||!r.price_reviewed_at||
       Number(r.price_review_revision)!==Number(r.recipe_revision))
      return message('Save the recipe and review its current saved price before approval.');
    mutate('approveRecipe',selectedId,$('approveRecipe'));
  });
  doc.defaultView?.addEventListener('ds:inventory-price-saved',async event=>{
    if(String(event.detail?.productId)!==String(selectedId)) return;
    try{
      await refresh();
      showTab('recipes');
      selectProduct(selectedId,true);
      message('Menu price saved. Review the updated recipe costing, then confirm the saved price before recipe approval.');
    }catch(error){message('Menu price saved, but Inventory refresh failed: '+error.message);}
  });
  await refresh();
  return Object.freeze({refresh,controller});
}
