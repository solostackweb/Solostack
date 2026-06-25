-- =============================================================================
-- 0054_contracts_currency_consolidation.sql
-- -----------------------------------------------------------------------------
-- Contract values can be captured in a foreign client's invoice currency. Store
-- the locked INR equivalent so contract list stats and dashboard aggregates do
-- not mix USD/EUR/etc. as raw INR.
-- =============================================================================

alter table public.contracts
  add column if not exists fx_rate_to_inr numeric(18, 6) not null default 1,
  add column if not exists inr_equivalent numeric(14, 2);

update public.contracts
   set inr_equivalent = value_amount
 where inr_equivalent is null
   and value_amount is not null
   and upper(coalesce(currency, 'INR')) = 'INR';
