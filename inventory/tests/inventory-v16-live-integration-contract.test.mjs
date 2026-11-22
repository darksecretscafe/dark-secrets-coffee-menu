import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../inventory-v16-dashboard-stockmaster-WIP.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../inventory-v16-approved-style-WIP.css', import.meta.url), 'utf8');

test('v16 layout uses scoped approved styles, not global admin styles', () => {
  assert.match(source, /scope\.id = 'inventoryV16'/);
  assert.match(source, /scope\.append\(shell\)/);
  assert.match(css, /#inventoryV16 \.shell/);
  assert.doesNotMatch(source, /offline simulated|Clear demo|Restore Sample Menu/);
});

test('v16 inventory actions use persisted authenticated controller', () => {
  assert.match(source, /createInventoryAdminSessionGateway\(client\)/);
  assert.match(source, /createInventoryPersistenceController\(session\)/);
  for (const action of ['saveItem', 'receive', 'saveRecipe', 'reviewRecipePrice', 'approveRecipe']) {
    assert.match(source, new RegExp('controller\\.' + action + '\\('));
  }
  assert.match(source, /pendingReceipt\.requestKey/);
});

test('v16 recipe approval prevents unsaved changes and requires current review', () => {
  assert.match(source, /if \(recipeDirty \|\| !reviewConfirm\.checked\)/);
  assert.match(source, /Number\(recipe\.price_review_revision\) !== Number\(recipe\.recipe_revision\)/);
  assert.match(source, /recipe\.price_reviewed_at/);
});

test('v16 product list is read from existing products, never a sample array', () => {
  assert.match(source, /client\.from\('products'\)\.select\('id,name,price'\)/);
  assert.match(source, /recipeStatus\(product\.id\)/);
});
