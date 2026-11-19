// Offline preflight only: does not prove SQL syntax, RLS, concurrency, or runtime behavior.
// Run: node inventory/tests/sql-017-preflight-static.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync('inventory/sql/017_phase2_recipe_lock_rebuilt_REVIEW_ONLY_DO_NOT_RUN.sql', 'utf8');
const runner = readFileSync('inventory/tests/run_postgres_017_LOCAL_ONLY_v6.sh', 'utf8');
const must = (re, label) => assert.match(sql, re, label);
assert.match(sql, /REVIEW ONLY|DO NOT RUN ON LIVE/i, 'SQL must retain explicit non-production warning');
must(/\bbegin\s*;/i, 'Migration must open a transaction');
must(/\bcommit\s*;/i, 'Migration must commit');
for (const name of ['inventory_save_item_draft','inventory_receive_stock_draft','inventory_correct_stock_draft','inventory_save_recipe_draft']) {
  must(new RegExp('(?:create\\s+(?:or\\s+replace\\s+)?function)\\s+public\\.' + name + '\\s*\\(', 'i'), name + ' function missing');
  must(new RegExp('revoke\\s+all\\s+on\\s+function\\s+public\\.' + name + '\\s*\\(', 'i'), name + ' revoke missing');
  must(new RegExp('grant\\s+execute\\s+on\\s+function\\s+public\\.' + name + '\\s*\\(', 'i'), name + ' grant missing');
}
for (const table of ['inventory_items','inventory_stock_movements','inventory_recipes','inventory_recipe_lines']) {
  must(new RegExp('alter\\s+table\\s+public\\.' + table + '\\s+enable\\s+row\\s+level\\s+security', 'i'), table + ' RLS enable missing');
}
must(/security\s+definer\s+set\s+search_path\s*=\s*''/i, 'Definer search path hardening missing');
must(/pg_advisory_xact_lock/i, 'Transaction-level idempotency serialization missing');
assert.match(runner, /PGDATABASE[^\n]*dsc_inventory_disposable_017/, 'Runner must require disposable DB');
assert.match(runner, /PGHOST[^\n]*127\.0\.0\.1/, 'Runner must require local host');
assert.match(runner, /DSC_DISPOSABLE_DB_CONFIRM/, 'Runner must require confirmation');
assert.match(runner, /psql\s+-X\s+-v\s+ON_ERROR_STOP=1/, 'Runner must stop on SQL errors');
console.log('PASS: SQL 017 static preflight guardrails (runtime validation still required)');
