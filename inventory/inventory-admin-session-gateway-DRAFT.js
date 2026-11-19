/**
 * DRAFT only: authenticated admin gate for Inventory RPC adapter.
 * No LIVE imports, no credentials, no database schema writes.
 * The server-side is_admin() + RLS/RPC checks remain authoritative.
 */
import { createInventoryDraftApi } from './inventory-rpc-adapter-v2-DRAFT.js';

export async function createInventoryAdminSessionGateway(client) {
  if (!client?.auth?.getUser || typeof client.rpc !== 'function') {
    throw new TypeError('Supabase client with auth.getUser and rpc is required');
  }
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData?.user?.id) throw new Error('Inventory access requires sign-in');
  const { data: isAdmin, error: adminError } = await client.rpc('is_admin');
  if (adminError) throw adminError;
  if (isAdmin !== true) throw new Error('Inventory access requires admin privileges');
  const api = createInventoryDraftApi(client);
  return Object.freeze({
    userId: userData.user.id,
    api,
    async verifyBeforeWrite() {
      const { data: current, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (!current?.user?.id || current.user.id !== userData.user.id) {
        throw new Error('Inventory session changed; sign in again');
      }
      const { data: permitted, error: permissionError } = await client.rpc('is_admin');
      if (permissionError) throw permissionError;
      if (permitted !== true) throw new Error('Inventory admin privileges revoked');
      return true;
    }
  });
}
