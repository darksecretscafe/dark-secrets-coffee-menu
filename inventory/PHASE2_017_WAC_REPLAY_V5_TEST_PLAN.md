# SQL 017 receiving/WAC/replay test plan (v5)

**Status: tests authored, NOT executed in PostgreSQL.** The environment lacks a PostgreSQL client/server. No LIVE access.

The rollback-only `postgres_017_receiving_wac_replay_LOCAL_ONLY.sql` test:
1. Creates a mock-admin ingredient item with base unit g and purchase unit kg.
2. Receives 1 kg at 100 units cost; expects 1,000 g at 0.1 per g.
3. Replays identical request key/payload; expects original movement ID, balance and WAC, and only one ledger row.
4. Receives another 1 kg at 300 units cost under a new key; expects 2,000 g and WAC 0.2 per g.
5. Attempts to reuse the first key with a different total cost; expects explicit rejection.
6. Confirms exactly two ledger movements and rolls back all test rows.

The v5 runner retains v4 catalog, privilege and mock authorization checks, localhost and database-name guards, and explicit operator confirmation.

**Not yet tested:** concurrent receipts, rounding edge cases, negative stock, real Supabase security, function ownership, real operational data. These tests are only a proposal until run in a verified disposable PostgreSQL instance. No LIVE migration, price updates or stock deductions.
