/** Approved v16 layout: first LIVE-data integration slice (Dashboard + Stock Master).
 * Feature branch only. Not wired into production until complete v16 workflow passes.
 * No demo data, no order mutations, no new Supabase client.
 */
import { createInventoryAdminSessionGateway } from './inventory-admin-session-gateway-DRAFT.js';
import { createInventoryPersistenceController } from './inventory-persistence-controller-DRAFT.js';
import { calculateInventoryCosting } from './inventory-costing-snapshot-DRAFT.js';

export async function mountInventoryV16Dashboard(root, client) {
  if (!root || !client) throw new TypeError('Inventory root and authenticated client required');
  const session = await createInventoryAdminSessionGateway(client);
  const controller = createInventoryPersistenceController(session);
  const doc = root.ownerDocument;
  const el = (tag, text = '', className = '') => {
    const node = doc.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const shell = el('div', '', 'shell');
  shell.id = 'inventoryV16';
  const heading = el('header');
  heading.append(el('h1', '☕ Dark Secrets Coffee'), el('p', 'Inventory Management', 'muted'));
  const tabs = el('nav', '', 'tabs');
  tabs.setAttribute('aria-label', 'Inventory sections');
  const homeButton = el('button', 'Dashboard');
  const stockButton = el('button', 'Stock Master');
  const receiveButton = el('button', 'Receive Stock');
  const recipesButton = el('button', 'Recipes & Costing');
  for (const b of [homeButton, stockButton, receiveButton, recipesButton]) b.type = 'button';
  tabs.append(homeButton, stockButton, receiveButton, recipesButton);
  const status = el('p', 'Loading inventory…', 'status');
  status.setAttribute('role', 'status');
  const home = el('section');
  const stats = el('div', '', 'stats');
  const count = el('div', '', 'stat');
  const low = el('div', '', 'stat');
  const pending = el('div', '', 'stat');
  stats.append(count, low, pending);
  const actions = el('div', '', 'card');
  actions.append(el('h2', 'Quick actions'));
  const openStock = el('button', 'Add stock item');
  openStock.type = 'button';
  actions.append(openStock);
  const how = el('div', '', 'card');
  how.append(el('h2', 'How it works'), el('p', 'Register ingredients in Stock Master, receive purchases, then use those same items when building recipes.'));
  home.append(stats, actions, how);
  const stock = el('section');
  stock.hidden = true;
  const formCard = el('div', '', 'card');
  formCard.append(el('h2', 'Stock Master'));
  const form = el('form');
  form.className = 'grid';
  const field = (title, input) => {
    const label = el('label', title);
    label.append(input);
    form.append(label);
    return input;
  };
  const name = field('Ingredient / packaging name', el('input'));
  name.required = true;
  name.maxLength = 80;
  const code = field('Unique item code', el('input'));
  code.required = true;
  code.maxLength = 60;
  const category = field('Category', el('input'));
  category.required = true;
  const type = field('Item type', el('select'));
  for (const value of ['ingredient','packaging']) {
    const option = el('option', value);
    option.value = value;
    type.append(option);
  }
  const unit = field('Base unit', el('select'));
  for (const value of ['g','ml','pcs']) {
    const option = el('option', value);
    option.value = value;
    unit.append(option);
  }
  const purchaseUnit = field('Purchase unit', el('select'));
  const min = field('Minimum stock', el('input'));
  min.type = 'number'; min.min = '0'; min.step = 'any'; min.value = '0'; min.required = true;
  const supplier = field('Supplier (optional)', el('input'));
  const save = el('button', 'Add stock item');
  save.type = 'submit';
  form.append(save);
  formCard.append(form);
  const listCard = el('div', '', 'card');
  listCard.append(el('h2', 'Registered stock items'));
  const scroll = el('div', '', 'scroll');
  const table = el('table');
  const thead = el('thead');
  const tr = el('tr');
  for (const title of ['Item','Balance','Average cost / unit','Status']) tr.append(el('th', title));
  thead.append(tr);
  const tbody = el('tbody');
  table.append(thead, tbody);
  scroll.append(table);
  listCard.append(scroll);
  stock.append(formCard, listCard);
  const receive = el('section');
  receive.hidden = true;
  const receiveCard = el('div', '', 'card');
  receiveCard.append(el('h2', 'Receive Stock'));
  const receiveForm = el('form');
  receiveForm.className = 'grid';
  const receiveField = (labelText, input) => {
    const label = el('label', labelText);
    label.append(input);
    receiveForm.append(label);
    return input;
  };
  const receiveItem = receiveField('Existing stock item', el('select'));
  receiveItem.required = true;
  const receiveQty = receiveField('Purchase quantity', el('input'));
  receiveQty.type = 'number'; receiveQty.min = '0.0001'; receiveQty.step = 'any'; receiveQty.required = true;
  const receiveUnit = receiveField('Purchase unit', el('select'));
  const receiveCost = receiveField('Total purchase cost (₱)', el('input'));
  receiveCost.type = 'number'; receiveCost.min = '0'; receiveCost.step = 'any'; receiveCost.required = true;
  const receiveReference = receiveField('Supplier reference', el('input'));
  receiveReference.required = true; receiveReference.maxLength = 80;
  const receiveSave = el('button', 'Record receiving');
  receiveSave.type = 'submit';
  receiveForm.append(receiveSave);
  receiveCard.append(receiveForm);
  const historyCard = el('div', '', 'card');
  historyCard.append(el('h2', 'Recent receiving'));
  const historyScroll = el('div', '', 'scroll');
  const historyTable = el('table');
  const historyHead = el('thead');
  const historyRow = el('tr');
  for (const title of ['Ingredient','Received','Previous WAC','New WAC','Supplier reference']) historyRow.append(el('th', title));
  historyHead.append(historyRow);
  const historyBody = el('tbody');
  historyTable.append(historyHead, historyBody);
  historyScroll.append(historyTable);
  historyCard.append(historyScroll);
  receive.append(receiveCard, historyCard);
  const recipesSection = el('section');
  recipesSection.hidden = true;
  const recipeListCard = el('div', '', 'card');
  recipeListCard.append(el('h2', 'Menu products · Recipe Status'));
  const recipeSearch = el('input');
  recipeSearch.placeholder = 'Search menu products';
  const recipeFilter = el('select');
  for (const [value, label] of [['all','All'],['no','No Recipe'],['draft','Draft'],['done','Completed']]) {
    const option = el('option', label); option.value = value; recipeFilter.append(option);
  }
  const recipeControls = el('div', '', 'grid');
  const searchLabel = el('label', 'Find product'); searchLabel.append(recipeSearch);
  const filterLabel = el('label', 'Filter by Recipe Status'); filterLabel.append(recipeFilter);
  recipeControls.append(searchLabel, filterLabel);
  recipeListCard.append(recipeControls);
  const recipeTable = el('table', '', 'compact');
  const recipeHeader = el('thead');
  const recipeHeadRow = el('tr');
  for (const label of ['Menu product','Status','Action']) recipeHeadRow.append(el('th', label));
  recipeHeader.append(recipeHeadRow);
  const recipeBody = el('tbody');
  recipeTable.append(recipeHeader, recipeBody);
  const recipeScroll = el('div', '', 'scroll');
  recipeScroll.append(recipeTable);
  recipeListCard.append(recipeScroll);
  const recipeEditor = el('div', '', 'card');
  recipeEditor.hidden = true;
  recipeEditor.append(el('h2', 'Recipe Management & Costing'));
  const recipeSelected = el('p', 'Select a menu product.', 'muted');
  const ingredientForm = el('form');
  ingredientForm.className = 'grid';
  const ingredientItem = el('select');
  const ingredientLabel = el('label', 'Existing ingredient / packaging');
  ingredientLabel.append(ingredientItem);
  const ingredientQty = el('input');
  ingredientQty.type = 'number'; ingredientQty.min = '0.0001'; ingredientQty.step = 'any';
  const ingredientQtyLabel = el('label', 'Quantity per serving (base unit)');
  ingredientQtyLabel.append(ingredientQty);
  const addIngredient = el('button', 'Add selected ingredient'); addIngredient.type = 'submit';
  ingredientForm.append(ingredientLabel, ingredientQtyLabel, addIngredient);
  const ingredientRows = el('div', '', 'scroll');
  const costing = el('section', 'Select a product to view costing.', 'costing-panel');
  const finalize = el('div', '', 'finalize');
  const saveRecipe = el('button', 'Save recipe'); saveRecipe.type = 'button';
  const discardRecipe = el('button', 'Discard unsaved edits'); discardRecipe.type = 'button';
  const reviewConfirmLabel = el('label', 'I checked the saved selling price and recipe costing');
  const reviewConfirm = el('input'); reviewConfirm.type = 'checkbox';
  reviewConfirmLabel.prepend(reviewConfirm);
  const reviewPrice = el('button', 'Review saved menu price'); reviewPrice.type = 'button';
  const approveRecipe = el('button', 'Approve recipe'); approveRecipe.type = 'button';
  finalize.append(saveRecipe, discardRecipe, reviewConfirmLabel, reviewPrice, approveRecipe);
  recipeEditor.append(recipeSelected, ingredientForm, ingredientRows, costing, finalize);
  recipesSection.append(recipeListCard, recipeEditor);
  shell.append(heading, tabs, home, stock, receive, recipesSection, status);
  root.replaceChildren(shell);

  function setSection(name) {
    home.hidden = name !== 'home';
    stock.hidden = name !== 'stock';
    receive.hidden = name !== 'receive';
    recipesSection.hidden = name !== 'recipes';
    homeButton.setAttribute('aria-selected', String(name === 'home'));
    stockButton.setAttribute('aria-selected', String(name === 'stock'));
    receiveButton.setAttribute('aria-selected', String(name === 'receive'));
    recipesButton.setAttribute('aria-selected', String(name === 'recipes'));
  }
  homeButton.addEventListener('click', () => setSection('home'));
  stockButton.addEventListener('click', () => setSection('stock'));
  receiveButton.addEventListener('click', () => setSection('receive'));
  recipesButton.addEventListener('click', () => setSection('recipes'));
  openStock.addEventListener('click', () => setSection('stock'));
  function syncUnits() {
    const family = {g:['g','kg'],ml:['ml','l'],pcs:['pcs']}[unit.value];
    purchaseUnit.replaceChildren();
    for (const value of family) {
      const option = el('option', value);
      option.value = value;
      purchaseUnit.append(option);
    }
  }
  unit.addEventListener('change', syncUnits);
  syncUnits();
  let pendingReceipt = null;
  let currentSnapshot = null;
  let products = [];
  let selectedProductId = null;
  let draftLines = [];
  let recipeDirty = false;
  function syncReceiveUnits() {
    const item = currentSnapshot?.items.find(i => i.id === receiveItem.value);
    receiveUnit.replaceChildren();
    if (!item) return;
    const allowed = {g:['g','kg'],ml:['ml','l'],pcs:['pcs']}[item.base_unit] || [item.preferred_purchase_unit];
    for (const value of allowed) {
      const option = el('option', value);
      option.value = value;
      receiveUnit.append(option);
    }
    receiveUnit.value = item.preferred_purchase_unit;
  }
  receiveItem.addEventListener('change', syncReceiveUnits);
  function recipeStatus(productId) {
    const recipe = currentSnapshot?.recipes.find(r => r.product_id === productId);
    if (!recipe) return 'no';
    const p = calculateInventoryCosting(currentSnapshot, products).recipes.find(r => r.productId === productId);
    return p?.approved ? 'done' : 'draft';
  }
  function showRecipeLines() {
    ingredientRows.replaceChildren();
    for (const [index, line] of draftLines.entries()) {
      const row = el('div', '', 'actions');
      row.append(el('span', line.name + ' — ' + line.quantityBase + ' ' + line.unit));
      const remove = el('button', 'Remove'); remove.type = 'button';
      remove.addEventListener('click', () => {
        draftLines.splice(index, 1); recipeDirty = true; reviewConfirm.checked = false; showRecipeLines();
      });
      row.append(remove); ingredientRows.append(row);
    }
    if (!draftLines.length) ingredientRows.append(el('p', 'No ingredients added yet.', 'muted'));
  }
  function selectProduct(productId, discard = false) {
    if (recipeDirty && !discard) {
      status.textContent = 'Save or discard your unsaved recipe edits first.';
      return;
    }
    selectedProductId = productId;
    const product = products.find(p => p.id === productId);
    const recipe = currentSnapshot?.recipes.find(r => r.product_id === productId);
    const itemById = new Map((currentSnapshot?.items || []).map(i => [i.id, i]));
    draftLines = (recipe ? currentSnapshot.recipeLines.filter(l => l.recipe_id === recipe.id) : []).map(l => {
      const item = itemById.get(l.item_id);
      if (!item) throw new Error('Saved recipe references an unknown inventory item');
      return {itemId:item.id, quantityBase:Number(l.quantity_base), name:item.name, unit:item.base_unit};
    });
    recipeDirty = false; reviewConfirm.checked = false;
    recipeEditor.hidden = !product;
    recipeSelected.textContent = product ? product.name + ' — saved menu price ₱' + product.price : 'Select a menu product';
    showRecipeLines();
    showCosting();
  }
  function showCosting() {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) { costing.textContent = 'Select a product to view costing.'; return; }
    const projection = calculateInventoryCosting(currentSnapshot, products);
    const balances = new Map(projection.balances.map(b => [b.itemId, b]));
    const draftCost = draftLines.reduce((sum, line) => sum + line.quantityBase * Number(balances.get(line.itemId)?.wac ?? 0), 0);
    const price = Number(product.price);
    const margin = price > 0 ? (price - draftCost) / price * 100 : null;
    costing.textContent = 'Recipe cost: ₱' + draftCost.toFixed(4) +
      ' | Saved selling price: ₱' + price.toFixed(2) +
      ' | Gross profit: ₱' + (price - draftCost).toFixed(4) +
      ' | Margin: ' + (margin == null ? 'N/A' : margin.toFixed(2) + '%') +
      (recipeDirty ? ' | UNSAVED EDITS' : '');
  }
  function renderRecipes() {
    const query = recipeSearch.value.trim().toLowerCase();
    const filter = recipeFilter.value;
    recipeBody.replaceChildren();
    const rows = products.filter(p => p.name.toLowerCase().includes(query))
      .filter(p => filter === 'all' || recipeStatus(p.id) === filter);
    const order = {no:0, draft:1, done:2};
    rows.sort((a,b) => order[recipeStatus(a.id)] - order[recipeStatus(b.id)] || a.name.localeCompare(b.name));
    for (const product of rows) {
      const row = el('tr');
      const state = recipeStatus(product.id);
      row.append(el('td', product.name), el('td', {no:'No Recipe',draft:'Draft',done:'Completed'}[state]));
      const actionCell = el('td');
      const action = el('button', state === 'no' ? 'Create recipe' : 'Open recipe');
      action.type = 'button';
      action.addEventListener('click', () => selectProduct(product.id));
      actionCell.append(action); row.append(actionCell); recipeBody.append(row);
    }
    if (!rows.length) {
      const row = el('tr'); const cell = el('td', 'No matching menu products.'); cell.colSpan = 3;
      row.append(cell); recipeBody.append(row);
    }
  }
  recipeSearch.addEventListener('input', renderRecipes);
  recipeFilter.addEventListener('change', renderRecipes);
  ingredientForm.addEventListener('submit', event => {
    event.preventDefault();
    const item = currentSnapshot?.items.find(i => i.id === ingredientItem.value && i.is_active);
    const quantityBase = Number(ingredientQty.value);
    if (!selectedProductId || !item || !Number.isFinite(quantityBase) || quantityBase <= 0 ||
        draftLines.some(l => l.itemId === item.id)) {
      status.textContent = 'Select a new ingredient with a valid positive quantity.';
      return;
    }
    draftLines.push({itemId:item.id, quantityBase, name:item.name, unit:item.base_unit});
    recipeDirty = true; reviewConfirm.checked = false; ingredientQty.value = '';
    showRecipeLines(); showCosting();
  });
  discardRecipe.addEventListener('click', () => selectProduct(selectedProductId, true));
  async function recipeMutation(method, payload, button) {
    if (!selectedProductId || button.disabled) return;
    button.disabled = true;
    try {
      const result = await controller[method](payload);
      currentSnapshot = result.snapshot;
      if (method === 'saveRecipe') {
        recipeDirty = false;
        selectProduct(selectedProductId, true);
      } else {
        reviewConfirm.checked = false;
        showCosting();
      }
      renderRecipes();
      status.textContent = method === 'approveRecipe' ? 'Recipe approval saved in Supabase.' :
        method === 'reviewRecipePrice' ? 'Saved menu price reviewed in Supabase.' :
        'Recipe saved and read back from Supabase.';
    } catch (error) {
      status.textContent = 'Action failed: ' + (error?.message || 'Unknown error');
    } finally { button.disabled = false; }
  }
  saveRecipe.addEventListener('click', () => {
    if (!selectedProductId || !draftLines.length) {
      status.textContent = 'Select a product and add ingredients first.'; return;
    }
    recipeMutation('saveRecipe', {productId:selectedProductId,
      lines:draftLines.map(l => ({itemId:l.itemId, quantityBase:l.quantityBase})), targetMarginPercent:null}, saveRecipe);
  });
  reviewPrice.addEventListener('click', () => {
    if (recipeDirty || !reviewConfirm.checked) {
      status.textContent = 'Save recipe changes and confirm the saved menu price first.'; return;
    }
    recipeMutation('reviewRecipePrice', selectedProductId, reviewPrice);
  });
  approveRecipe.addEventListener('click', () => {
    if (recipeDirty || !reviewConfirm.checked) {
      status.textContent = 'Save recipe changes and confirm the saved menu price before approval.'; return;
    }
    recipeMutation('approveRecipe', selectedProductId, approveRecipe);
  });
  function render(snapshot) {
    currentSnapshot = snapshot;
    const projection = calculateInventoryCosting(snapshot, []);
    const balances = new Map(projection.balances.map(b => [b.itemId, b]));
    const activeItems = snapshot.items.filter(i => i.is_active);
    const lowCount = activeItems.filter(i => Number(balances.get(i.id)?.quantity ?? 0) <= Number(i.minimum_stock ?? 0)).length;
    count.replaceChildren('Stock items', el('strong', String(activeItems.length)));
    low.replaceChildren('Low / out of stock', el('strong', String(lowCount)));
    const incomplete = snapshot.recipes.filter(r => r.status !== 'completed' && r.status !== 'approved').length;
    pending.replaceChildren('Recipes needing work', el('strong', String(incomplete)));
    tbody.replaceChildren();
    for (const item of snapshot.items) {
      const balance = balances.get(item.id);
      const row = el('tr');
      const values = [item.name, String(Number(balance?.quantity ?? 0))+' '+item.base_unit,
        String(Number(balance?.wac ?? 0)), item.is_active ? 'Active' : 'Inactive'];
      for (const value of values) row.append(el('td', value));
      tbody.append(row);
    }
    const selected = receiveItem.value;
    receiveItem.replaceChildren();
    for (const item of snapshot.items.filter(i => i.is_active)) {
      const option = el('option', item.name);
      option.value = item.id;
      receiveItem.append(option);
    }
    if (snapshot.items.some(i => i.id === selected && i.is_active)) receiveItem.value = selected;
    syncReceiveUnits();
    ingredientItem.replaceChildren();
    for (const item of snapshot.items.filter(i => i.is_active)) {
      const option = el('option', item.name + ' (' + item.base_unit + ')');
      option.value = item.id; ingredientItem.append(option);
    }
    renderRecipes();
    if (selectedProductId && !recipeDirty) selectProduct(selectedProductId, true);
    const itemById = new Map(snapshot.items.map(i => [i.id, i]));
    historyBody.replaceChildren();
    const receipts = snapshot.movements.filter(m => m.movement_type === 'receive');
    receipts.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
    for (const movement of receipts.slice(0, 50)) {
      const row = el('tr');
      const beforeQty = Number(movement.quantity_after) - Number(movement.quantity_delta);
      const afterQty = Number(movement.quantity_after);
      const beforeValue = Number(movement.value_after) - Number(movement.value_delta);
      const afterValue = Number(movement.value_after);
      const beforeWac = beforeQty > 0 ? beforeValue / beforeQty : 0;
      const afterWac = afterQty > 0 ? afterValue / afterQty : 0;
      for (const value of [
        itemById.get(movement.item_id)?.name || 'Unknown item',
        String(movement.quantity_delta ?? ''),
        Number.isFinite(beforeWac) ? beforeWac.toFixed(4) : '—',
        Number.isFinite(afterWac) ? afterWac.toFixed(4) : '—',
        String(movement.reference ?? '')
      ]) row.append(el('td', value));
      historyBody.append(row);
    }
    if (!receipts.length) {
      const row = el('tr');
      const cell = el('td', 'No receiving transactions yet.');
      cell.colSpan = 5;
      row.append(cell);
      historyBody.append(row);
    }
    if (!snapshot.items.length) {
      const row = el('tr');
      const cell = el('td', 'No stock items registered yet.');
      cell.colSpan = 4;
      row.append(cell);
      tbody.append(row);
    }
  }
  async function refresh() {
    const snapshot = await controller.refresh();
    if (!snapshot) throw new Error('Inventory refresh superseded');
    const {data, error} = await client.from('products').select('id,name,price').order('name');
    if (error) throw error;
    products = Array.isArray(data) ? data : [];
    render(snapshot);
    return snapshot;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (save.disabled) return;
    const minimumStock = Number(min.value);
    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      status.textContent = 'Enter a valid minimum stock.';
      return;
    }
    save.disabled = true;
    status.textContent = 'Saving stock item…';
    try {
      const outcome = await controller.saveItem({
        id:null, code:code.value.trim(), name:name.value.trim(),
        category:category.value.trim(), type:type.value, baseUnit:unit.value,
        purchaseUnit:purchaseUnit.value, minimumStock, active:true,
        supplier:supplier.value.trim() || null
      });
      render(outcome.snapshot);
      form.reset();
      syncUnits();
      status.textContent = 'Stock item saved and verified from Supabase.';
    } catch (error) {
      status.textContent = 'Save failed: ' + (error?.message || 'Unknown error');
    } finally {
      save.disabled = false;
    }
  });
  receiveForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (receiveSave.disabled) return;
    const item = currentSnapshot?.items.find(i => i.id === receiveItem.value);
    const quantity = Number(receiveQty.value);
    const totalCost = Number(receiveCost.value);
    const reference = receiveReference.value.trim();
    if (!item || !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(totalCost) || totalCost < 0 || !reference) {
      status.textContent = 'Enter a valid item, quantity, cost and supplier reference.';
      return;
    }
    const payload = {itemId:item.id, quantity, unit:receiveUnit.value, totalCost, reference};
    const fingerprint = JSON.stringify(payload);
    if (pendingReceipt && pendingReceipt.fingerprint !== fingerprint) {
      status.textContent = 'Previous receiving result is uncertain. Retry the same values before starting a different receipt.';
      return;
    }
    if (!pendingReceipt) {
      const requestKey = globalThis.crypto?.randomUUID?.();
      if (!requestKey) { status.textContent = 'Secure transaction ID unavailable.'; return; }
      pendingReceipt = {fingerprint, requestKey};
    }
    receiveSave.disabled = true;
    status.textContent = 'Saving stock receipt…';
    try {
      const outcome = await controller.receive({...payload, requestKey:pendingReceipt.requestKey});
      render(outcome.snapshot);
      pendingReceipt = null;
      receiveQty.value = ''; receiveCost.value = ''; receiveReference.value = '';
      status.textContent = 'Receiving saved and verified from Supabase.';
    } catch (error) {
      status.textContent = 'Receiving not confirmed: ' + (error?.message || 'Unknown error') + '. Retry with the same values.';
    } finally {
      receiveSave.disabled = false;
    }
  });
  await refresh();
  status.textContent = 'Inventory loaded from Supabase.';
  return { refresh, controller };
}
