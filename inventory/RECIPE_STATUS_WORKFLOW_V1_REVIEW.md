# Recipe Status Workflow v1 — Review-only

Standalone browser-only prototype: `inventory/recipe-status-workflow-v1-DRAFT.html`.

Agreed workflow:
1. A new product is added to Menu Management and referenced by its stable product UUID in the future backend.
2. Recipe status starts as **No Recipe**.
3. Adding recipe lines and saving moves it to **Draft**.
4. **Completed** requires recipe lines, costing review, and owner/admin approval.
5. Editing a Completed recipe reverts to **Draft**, invalidating previous costing review/approval.

The prototype provides status counters, search, filter, simulated new product entry, selection, draft save, simulated approval, and edit reversion.

**Important limitations:** This page uses generated demonstration IDs, not actual LIVE product UUIDs. Recipe line count, costing review and owner approval are manually simulated and are **not proof** of real ingredient lines, costing completeness, or authenticated owner approval. It has no Supabase integration, no persistence, and no changes to products, orders, prices, stock or printed QR. Approval must eventually be enforced server-side, not merely in browser UI. The branch/PR is unmerged.

Static GitHub source verification completed; no automated browser testing or PostgreSQL validation performed.
