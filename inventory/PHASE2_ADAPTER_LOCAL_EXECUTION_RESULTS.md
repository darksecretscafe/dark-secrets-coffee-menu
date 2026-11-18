# Adapter offline execution — 18 November 2026

## Observed execution
- Node.js v22.16.0 was available.
- A local mirror of the GitHub draft adapter and contract test was executed using an injected mock client; **no Supabase credentials, network, or database were involved**.
- Initial execution failed at `assert.rejects(..., /permission denied/)` because the mock rejects with a plain object `{message:'permission denied'}`, whose string representation is `[object Object]`.
- Replacing those two assertions with `assert.rejects(..., { message: 'permission denied' })` resulted in **PASS** on the local mirror.
- The corresponding correction is saved as `inventory/tests/inventory-rpc-adapter-fixed.test.mjs`. The exact fetched GitHub file has not itself been executed by Node in this environment.

## Limits
This checks JavaScript request mapping and error handling with mocks only. It does not establish PostgreSQL SQL validity, Supabase permissions, RLS, concurrency, WAC transaction correctness, or browser integration. LIVE is unchanged.

## Next
Run the corrected repository test in a checked-out clone and validate the SQL candidate in an isolated PostgreSQL database before connecting any persistent UI.
