import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync('inventory/inventory-v16-approved-live-template.html','utf8');
const js = readFileSync('inventory/inventory-v16-approved-live-controller.js','utf8');
const css = readFileSync('inventory/inventory-v16-approved-style-WIP.css','utf8');
const integration = readFileSync('inventory/inventory-admin-tab-integration-DRAFT.js','utf8');

test('original approved v16 sections are preserved without demo actions',()=>{
  for (const name of ['Dashboard','Stock Master','Receive Stock','Recipes & Costing',
    'Recipe Management & Costing','Cost History']) assert.ok(html.includes(name),name);
  for (const id of ['stockForm','receiveForm','productRows','recipeEditor','recipeForm',
    'lines','estimate','saveRecipeDraft','complete','message'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.doesNotMatch(html,/id="priceConfirmed"|type="checkbox"|id="priceApproval"|id="reviewPrice"|id="approveRecipe"/);
  assert.doesNotMatch(js,/priceConfirmed/);
  assert.doesNotMatch(html,/Clear demo|Run Menu Sync Tests|Simulate Menu Management|Restore Sample Menu|DRAFT ONLY|illustrative examples/);
});
test('approved v16 is wired to existing authenticated Supabase controller',()=>{
  assert.match(integration,/mountApprovedV16Inventory\(root, client\)/);
  assert.match(js,/createInventoryAdminSessionGateway\(client\)/);
  assert.match(js,/createInventoryPersistenceController\(session\)/);
  assert.match(js,/controller\.saveItem\(/);
  assert.match(js,/controller\.receive\(/);
  assert.match(js,/controller\[method\]\(payload\)/);
  assert.match(js,/client\.from\('products'\)/);
  assert.match(js,/pendingReceipt\.requestKey/);
  assert.doesNotMatch(js,/createClient\(|service_role|sb_secret_/i);
});
test('approved v16 CSS is scoped away from existing admin',()=>{
  assert.match(css,/#inventoryV16 \.shell/);
  assert.match(css,/#inventoryV16 \.costing-panel/);
  assert.doesNotMatch(css,/@media\(max-width:680px\)\{\.costing-grid/);
  assert.doesNotMatch(css,/@media\(max-width:600px\)\{\.requirements/);
});
