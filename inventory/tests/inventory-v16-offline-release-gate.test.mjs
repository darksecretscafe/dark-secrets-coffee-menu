// Static regression gate for the APPROVED offline v16 Inventory UI.
// This is NOT a browser test, database test, or production release approval.
// Run: node inventory/tests/inventory-v16-offline-release-gate.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('admin-inventory-integrated-v16-price-review-gated-approval-DRAFT.html', 'utf8');
const requirePattern = (pattern, message) => assert.match(source, pattern, message);
requirePattern(/Illustrative data/i, 'Costing overview must retain illustrative-data notice');
requirePattern(/draftPriceReviewedRecipeIds\s*=\s*new Set\(\)/, 'Price-review checkpoint must exist');
requirePattern(/draftPriceReviewedRecipeIds\.delete\(p\.id\)/, 'Recipe changes must invalidate price review');
requirePattern(/draftPriceReviewedRecipeIds\.has\(p\.id\)/, 'Approval must require price-review checkpoint');
requirePattern(/draftPriceReviewedRecipeIds\.add\(id\)/, 'Menu Save must mark review complete');
requirePattern(/p\.customPrice\s*!==\s*null/, 'Uncommitted proposed price must block approval');
requirePattern(/p\.status\s*===\s*['"]done['"]/, 'Completed recipes must be protected');
requirePattern(/function\s+updateRecipeGuide\s*\(/, 'Guided next-step behavior must remain');
requirePattern(/Review\s*(?:&|&amp;)\s*Approve\s*Recipe/, 'Final approval control must remain');
assert.doesNotMatch(source, /https?:\/\/[^"'\s]*supabase\.co\/rest\/v1/i, 'Offline preview must not hardcode Supabase REST endpoints');
assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/i, 'Offline preview must not embed service-role credentials');
console.log('PASS: approved v16 static workflow invariants (NOT runtime/browser tested)');
