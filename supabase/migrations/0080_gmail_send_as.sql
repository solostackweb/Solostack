-- Gmail send-as: an opt-in, per-user choice to route client-facing document
-- email (invoices, contracts, welcome documents, proposals) through the
-- freelancer's own Gmail address instead of Stackivo's sending domain.
--
-- Rides on the Google connection that already exists for Calendar. Two things
-- must both be true before anything changes: the stored OAuth grant includes
-- the gmail.send scope, and the freelancer has switched this on. Default false
-- means every existing connection keeps sending through Brevo untouched.

alter table public.calendar_connections
  add column if not exists send_as_gmail boolean not null default false;
