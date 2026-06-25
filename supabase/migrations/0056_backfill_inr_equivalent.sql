-- =============================================================================
-- 0056_backfill_inr_equivalent.sql
-- -----------------------------------------------------------------------------
-- Older invoices (created before the multi-currency FX wiring) have a NULL
-- inr_equivalent, so INR roll-ups (invoice KPIs, Pulse) fell back to the raw
-- total_amount — making a $140 invoice read as ₹140. Backfill a best-effort
-- INR equivalent from the locked fx_rate_to_inr:
--   • INR invoices            → inr_equivalent = total_amount
--   • foreign w/ a real rate  → inr_equivalent = total_amount × fx_rate_to_inr
-- Foreign invoices that predate FX (rate defaulted to 1) cannot be recovered
-- here — re-issue those so a live rate is locked in.
-- =============================================================================

update public.invoices
   set inr_equivalent = round(total_amount::numeric, 2)
 where inr_equivalent is null
   and (currency is null or upper(currency) = 'INR');

update public.invoices
   set inr_equivalent = round((total_amount * fx_rate_to_inr)::numeric, 2)
 where inr_equivalent is null
   and currency is not null
   and upper(currency) <> 'INR'
   and fx_rate_to_inr is not null
   and fx_rate_to_inr > 1;
