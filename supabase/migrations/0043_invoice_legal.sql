-- Invoice legal compliance: HSN/SAC code (invoice-level, optional).
-- HSN (goods) / SAC (services) codes are required on GST tax invoices.
-- Modeled at invoice level to match the existing single-rate GST design.
alter table public.invoices
  add column if not exists hsn_sac text;
