# SQL candidate 016 corruption and 017 rebuild review

**Critical:** `016_phase2_recipe_item_lock_REVIEW_ONLY_DO_NOT_RUN.sql` is malformed. A regular expression/string in the recipe-locking section is truncated, and an extra duplicate recipe-function tail occurs after the first `commit;`. **DO NOT RUN 016**.

Rebuilt candidate `017_phase2_recipe_lock_rebuilt_REVIEW_ONLY_DO_NOT_RUN.sql` from the previously intact `015_phase2_item_unit_state_guard_REVIEW_ONLY_DO_NOT_RUN.sql`. Added deterministic per-item `FOR SHARE` locking and a second active-state check *after* the locks are acquired, before replacing recipe lines. No other intended changes to the 015 foundation.

Static source verification of fetched 017:
- Exactly one standalone `commit;`.
- Exactly one `create or replace function public.inventory_save_recipe_draft`.
- Four `do $$` openings and four `end $$;` closings.
- Recipe lock loop and post-lock active check present.
- File ends in the original migration warning comments.

**Remaining risks:** SQL has NOT been parsed or executed in PostgreSQL. Lock-order/deadlock behavior and security-definer privileges need isolated concurrency/security tests. Do not run this candidate on LIVE or merge PR #15. Existing LIVE database, website, orders, prices and URL remain untouched.
