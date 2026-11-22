/**
 * DRAFT integration controller. Inject an authenticated admin session gateway.
 * Reads persisted Supabase data after writes, never invents local success state.
 * No LIVE imports, schema changes, order deduction or credentials.
 */
import { createInventoryReadOnlyProvider } from './inventory-readonly-provider-v1-DRAFT.js';

export function createInventoryPersistenceController(session) {
  if (!session?.api || typeof session.verifyBeforeWrite !== 'function') {
    throw new TypeError('Verified inventory admin session required');
  }
  const api = session.api;
  const provider = createInventoryReadOnlyProvider(api);
  let pending = Promise.resolve();
  let busy = 0;
  let lastError = null;
  async function refresh() {
    try {
      const result = await provider.refresh();
      lastError = null;
      return result;
    } catch (error) {
      provider.invalidate();
      lastError = error;
      throw error;
    }
  }
  function write(method, payload) {
    // Serialize mutations so UI never displays out-of-order results.
    const task = pending.catch(() => {}).then(async () => {
      busy++;
      try {
        await session.verifyBeforeWrite();
        const result = await api[method](payload);
        provider.invalidate();
        const snapshot = await refresh();
        if (snapshot === null) throw new Error('Inventory snapshot superseded; refresh again');
        return Object.freeze({ result, snapshot });
      } catch (error) {
        provider.invalidate();
        lastError = error;
        throw error;
      } finally {
        busy--;
      }
    });
    pending = task;
    return task;
  }
  return Object.freeze({
    current: provider.current,
    refresh,
    status: () => Object.freeze({ busy: busy > 0, error: lastError }),
    saveItem: item => write('saveItem', item),
    receive: receipt => write('receive', receipt),
    correct: correction => write('correct', correction),
    saveRecipe: recipe => write('saveRecipe', recipe),
    reviewRecipePrice: productId => write('reviewRecipePrice', productId),
    approveRecipe: productId => write('approveRecipe', productId)
  });
}
