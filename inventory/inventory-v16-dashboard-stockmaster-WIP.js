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
  for (const b of [homeButton, stockButton, receiveButton]) b.type = 'button';
  tabs.append(homeButton, stockButton, receiveButton);
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
  shell.append(heading, tabs, home, stock, receive, status);
  root.replaceChildren(shell);

  function setSection(name) {
    home.hidden = name !== 'home';
    stock.hidden = name !== 'stock';
    receive.hidden = name !== 'receive';
    homeButton.setAttribute('aria-selected', String(name === 'home'));
    stockButton.setAttribute('aria-selected', String(name === 'stock'));
    receiveButton.setAttribute('aria-selected', String(name === 'receive'));
  }
  homeButton.addEventListener('click', () => setSection('home'));
  stockButton.addEventListener('click', () => setSection('stock'));
  receiveButton.addEventListener('click', () => setSection('receive'));
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
