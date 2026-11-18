# Phase 2 — v2 request-key test execution

**Result:** PASS in local Node.js v22.16.0 using a mock Supabase client. No database connection, production writes or credentials.

- Original GitHub v2 test failed because it used `assert.rejects()` for a synchronous `TypeError` thrown while constructing RPC arguments.
- Replaced the two assertions with `assert.throws(() => ..., TypeError)`.
- Reran the locally mirrored test: `PASS: offline request-key contract checks (no database access)`.
- Saved the corrected test as `inventory/tests/inventory-rpc-adapter-v2-key-fixed.test.mjs` on the draft branch. The GitHub-hosted corrected file was not directly executed; the identical correction was executed locally.
- Valid retry retains the original UUID request key. Missing, empty, null and malformed keys are rejected before mock RPC invocation.

**Not tested:** PostgreSQL parser, Supabase functions, RLS, idempotency registry persistence, transaction isolation, WAC concurrency or live UI. Do not deploy draft SQL to LIVE.
