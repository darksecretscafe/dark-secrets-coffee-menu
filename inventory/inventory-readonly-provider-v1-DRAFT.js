/** DRAFT read-only Inventory data provider.
 * Explicitly injected adapter only; never imports credentials, connects to Supabase,
 * mutates menu prices, or writes to a database. Not connected to LIVE admin.
 */
export function createInventoryReadOnlyProvider(api) {
  if (!api || ['listItems', 'listMovements', 'listRecipes', 'listRecipeLines']
    .some(method => typeof api[method] !== 'function')) {
    throw new TypeError('An inventory read adapter with four list methods is required');
  }
  let generation = 0;
  let last = null;
  const copyRows = (rows, label) => {
    if (!Array.isArray(rows)) throw new TypeError(label + ' must be an array');
    return Object.freeze(rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new TypeError(label + ' contains an invalid row');
      }
      return Object.freeze({ ...row });
    }));
  };
  return Object.freeze({
    current: () => last,
    invalidate: () => { generation++; last = null; },
    async refresh() {
      const request = ++generation;
      const [items, movements, recipes, recipeLines] = await Promise.all([
        api.listItems(), api.listMovements(), api.listRecipes(), api.listRecipeLines()
      ]);
      const snapshot = Object.freeze({
        items: copyRows(items, 'inventory_items'),
        movements: copyRows(movements, 'inventory_stock_movements'),
        recipes: copyRows(recipes, 'inventory_recipes'),
        recipeLines: copyRows(recipeLines, 'inventory_recipe_lines')
      });
      // A slower response cannot replace a newer refresh or invalidation.
      if (request !== generation) return null;
      last = snapshot;
      return snapshot;
    }
  });
}
