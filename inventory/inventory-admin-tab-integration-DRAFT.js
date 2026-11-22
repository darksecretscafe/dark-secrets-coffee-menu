/** Feature branch integration only. Lazy-load inventory after explicit admin tab selection.
 * Existing admin auth, order lifecycle and customer site remain unchanged.
 * Backend is authoritative for RLS and admin RPC permissions.
 */
import { mountInventoryPersistentAdminPanel } from './inventory-persistent-admin-panel-DRAFT.js';

const tab = document.getElementById('tabInventory');
const root = document.getElementById('inventoryPersistentRoot');
let mounted = false;
let mounting = false;

async function loadInventory() {
  if (mounted || mounting || !root || !tab) return;
  mounting = true;
  try {
    // Reuse the exact authenticated Supabase client created by existing admin.js.
    // Do not create a second session, and never use a service-role key in browser code.
    const client = window.DS_adminDb;
    if (!client) throw new Error('Admin session not ready. Sign in and retry.');
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error('Sign in as an admin to access inventory.');
    await mountInventoryPersistentAdminPanel(root, client);
    mounted = true;
  } catch (error) {
    // DOM textContent prevents HTML injection from server messages.
    root.replaceChildren();
    const status = document.createElement('p');
    status.setAttribute('role', 'alert');
    status.textContent = 'Inventory unavailable: ' + (error?.message || 'Unable to load');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry inventory';
    retry.addEventListener('click', loadInventory);
    root.append(status, retry);
  } finally {
    mounting = false;
  }
}

tab?.addEventListener('click', () => { void loadInventory(); });
