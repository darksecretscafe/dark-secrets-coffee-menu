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
  const recipeTitle = el('h3','Recipe review and approval');
  const productSelect = el('select');
  const reviewButton = el('button','Confirm saved menu price reviewed');
  const approveButton = el('button','Approve recipe');
  reviewButton.type='button';approveButton.type='button';
  const priceNote=el('p','Change and save selling prices in Menu Management before review.');
  root.replaceChildren(title,status,refreshButton,table,recipeTitle,productSelect,priceNote,reviewButton,approveButton);
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
      for(const item of snapshot.items) {
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
  refreshButton.addEventListener('click',()=>{refresh().catch(()=>{});});
  reviewButton.addEventListener('click',()=>{mutate('reviewRecipePrice');});
  approveButton.addEventListener('click',()=>{mutate('approveRecipe');});
  await refresh();
  return Object.freeze({refresh,controller});
}
