/** Feature branch integration only. Lazy-load inventory after explicit admin tab selection.
 * Existing admin auth, order lifecycle and customer site remain unchanged.
 * Backend is authoritative for RLS and admin RPC permissions.
 */
import { mountApprovedV16Inventory } from './inventory-v16-approved-live-controller.js?v=20261123-receive-search';

const tab = document.getElementById('tabInventory');
const root = document.getElementById('inventoryPersistentRoot');
let mounted = false;
let mounting = false;
let generation = 0;
let authWatchInstalled = false;

function resetInventory() {
  generation += 1;
  mounted = false;
  root?.replaceChildren();
  if (root) {
    const notice = document.createElement('p');
    notice.textContent = 'Select Inventory to load your saved inventory.';
    root.append(notice);
  }
}

function watchSession(client) {
  if (authWatchInstalled) return;
  authWatchInstalled = true;
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') resetInventory();
  });
}

async function loadInventory() {
  if (mounted || mounting || !root || !tab) return;
  mounting = true;
  const requestedGeneration = generation;
  try {
    // Reuse the exact authenticated Supabase client created by existing admin.js.
    // Do not create a second session, and never use a service-role key in browser code.
    const client = window.DS_adminDb;
    if (!client) throw new Error('Admin session not ready. Sign in and retry.');
    watchSession(client);
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error('Sign in as an admin to access inventory.');
    await mountApprovedV16Inventory(root, client);
    // A sign-out may happen while the async mount is fetching records.
    // The pending mount must not restore inventory DOM after resetInventory.
    if (requestedGeneration !== generation) {
      root.replaceChildren();
      return;
    }
    const { data: afterMount, error: afterError } = await client.auth.getUser();
    if (afterError || !afterMount?.user || afterMount.user.id !== data.user.id) {
      resetInventory();
      return;
    }
    mounted = true;
  } catch (error) {
    if (requestedGeneration !== generation) return;
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
