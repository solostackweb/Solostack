-- Per-user default HSN/SAC code used to pre-fill new GST invoices.
alter table public.user_profiles
  add column if not exists invoice_default_hsn_sac text;
