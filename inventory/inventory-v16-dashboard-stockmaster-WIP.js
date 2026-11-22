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
  for (const b of [homeButton, stockButton]) b.type = 'button';
  tabs.append(homeButton, stockButton);
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
  shell.append(heading, tabs, home, stock, status);
  root.replaceChildren(shell);

  function setSection(name) {
    home.hidden = name !== 'home';
    stock.hidden = name !== 'stock';
    homeButton.setAttribute('aria-selected', String(name === 'home'));
    stockButton.setAttribute('aria-selected', String(name === 'stock'));
  }
  homeButton.addEventListener('click', () => setSection('home'));
  stockButton.addEventListener('click', () => setSection('stock'));
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
  function render(snapshot) {
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
  await refresh();
  status.textContent = 'Inventory loaded from Supabase.';
  return { refresh, controller };
}
