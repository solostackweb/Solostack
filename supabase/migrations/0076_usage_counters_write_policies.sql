-- 0076: usage_counters write policies
--
-- `usage_counters` shipped with SELECT-only RLS (0003) on the assumption that
-- writes flow through service-role code. They don't: `incrementUsage()` in
-- `features/subscription/usage.ts` calls `public.increment_usage()` over the
-- user-scoped server client. That function is SECURITY INVOKER, so the upsert
-- inside it runs with the caller's privileges and every authenticated call
-- failed with 42501 (`new row violates row-level security policy for table
-- "usage_counters"`). AI-message counting has silently never incremented.
--
-- Fix: grant owners INSERT + UPDATE on their own rows, matching every other
-- business table's `auth.uid() = user_id` policy shape. The function's
-- month-bucket upsert needs both policies because ON CONFLICT DO UPDATE
-- performs an INSERT that may flip to an UPDATE. The unique key on
-- (user_id, metric, period_start) plus `count = count + excluded.count`
-- keep increments atomic and self-scoped.

create policy usage_counters_insert_own on public.usage_counters
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy usage_counters_update_own on public.usage_counters
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
