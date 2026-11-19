# Inventory RPC adapter integration boundary — draft

**Status:** Adapter committed and source-checked. Not browser-tested or connected to any Supabase environment.

The file `inventory-rpc-adapter-DRAFT.js` exports `createInventoryDraftApi(client)` and maps the four draft RPCs from `sql/016_phase2_recipe_item_lock_REVIEW_ONLY_DO_NOT_RUN.sql`. It accepts an externally supplied authenticated Supabase client. No credentials, project URLs, order writes, or automatic deductions are added. The existing `integrated-preview.html` remains an in-memory demo and does not import this module.

**Important:** The API requires the unexecuted SQL draft; calling it against LIVE will fail because the inventory functions/tables have not been installed. Do not attach it to the LIVE website or invoke it against LIVE. A future approved isolated test UI must handle loading/authentication, UUID generation and persistence of idempotency request keys across retries, validation/error states, and refresh.

**Source checks:** 5/5 passed. Runtime SQL and browser integration remain untested. No LIVE changes.
