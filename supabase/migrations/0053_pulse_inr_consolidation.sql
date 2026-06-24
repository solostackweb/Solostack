-- =============================================================================
-- 0053_pulse_inr_consolidation.sql
-- -----------------------------------------------------------------------------
-- Multi-currency Pulse: aggregation RPCs summed raw total_amount, which for
-- foreign-currency invoices is in the client's currency. Switch them to the
-- locked INR equivalent (falling back to total_amount for INR / legacy rows)
-- so status totals, client revenue, and client profile metrics roll up in INR.
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

create or replace function public.client_revenue_summary(
  p_limit int default 5
) returns table (
  client_id     uuid,
  total_paid    numeric,
  invoice_count bigint
)
language sql
security invoker
stable
set search_path = public
as $$
  select client_id,
         sum(coalesce(inr_equivalent, total_amount))::numeric as total_paid,
         count(*)::bigint                                    as invoice_count
    from public.invoices
   where status    = 'paid'
     and client_id is not null
   group by client_id
   order by total_paid desc nulls last
   limit greatest(coalesce(p_limit, 5), 1);
$$;

create or replace function public.client_invoice_metrics(
  p_client_id uuid
) returns table (
  invoice_count bigint,
  paid_total    numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select count(*)::bigint,
         coalesce(sum(coalesce(inr_equivalent, total_amount)), 0)::numeric
    from public.invoices
   where client_id = p_client_id
     and status    = 'paid';
$$;
