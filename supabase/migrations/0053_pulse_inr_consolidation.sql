-- =============================================================================
-- 0053_pulse_inr_consolidation.sql
-- -----------------------------------------------------------------------------
-- Multi-currency Pulse: the invoice_status_summary RPC (used for the dashboard
-- "paid / outstanding" status totals) summed raw total_amount, which for
-- foreign-currency invoices is in the client's currency. Switch it to the
-- locked INR equivalent (falling back to total_amount for INR / legacy rows)
-- so status totals roll up correctly in INR. JS-side Pulse aggregations were
-- already switched to `inr_equivalent ?? total_amount`.
-- =============================================================================

create or replace function public.invoice_status_summary(
  p_status text
) returns table (
  invoice_count bigint,
  total_amount  numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select count(*)::bigint,
         coalesce(sum(coalesce(inr_equivalent, total_amount)), 0)::numeric
    from public.invoices
   where status = p_status;
$$;
