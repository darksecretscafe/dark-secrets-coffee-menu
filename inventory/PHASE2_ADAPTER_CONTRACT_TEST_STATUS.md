# Offline RPC adapter contract tests

Added `inventory/tests/inventory-rpc-adapter.test.mjs` on the unmerged inventory branch. The test uses a mocked Supabase client to check RPC names, argument mapping, read-only table selection, frozen API, invalid client rejection, and propagation of database permission errors.

**Execution status: NOT RUN.** The GitHub file was fetched back and statically verified, but no Node test runner was invoked on this repository file. Run locally from the repository root:

```sh
node inventory/tests/inventory-rpc-adapter.test.mjs
```

The test is offline and does not contact Supabase. Passing it would only verify JavaScript adapter contracts; PostgreSQL functions, RLS, concurrency, and browser integration still require independent testing. No LIVE changes.
