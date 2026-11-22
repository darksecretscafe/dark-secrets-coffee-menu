# Interactive Stock Workspace v1 — draft review

New standalone file: `inventory/stock-workspace-interactive-v1-DRAFT.html`.

Features:
- Create draft ingredient or packaging item with base unit g/ml/pcs and minimum stock.
- Receive draft stock in compatible units (g/kg, ml/l, pcs), calculate in-memory stock value and WAC.
- Record wastage with insufficient-stock rejection and full-depletion valuation cleanup.
- Show stock table, low/out-of-stock totals, value, and recent activity.
- Clear all session data manually; refresh also clears it.

Security/scope: **No persistence, no API/network calls, no authentication, no Supabase import, no actual database writes, no menu price changes, and no automatic stock deduction.** All input is preview data only. User-entered names and notes are HTML-escaped before table rendering.

Static source verification: all three forms and warning present; no Supabase client. **Not browser-automated tested.** This prototype is separate from the LIVE site and unmerged PR #15.

Known limitations: UI values use JavaScript floating point (not PostgreSQL NUMERIC); this is illustrative WAC, not accounting-grade valuation. No cross-session idempotency, supplier master, recipes editing, transaction reversal, concurrency, or backend security. Real data entry and operational use require approved persistent backend and tests.
