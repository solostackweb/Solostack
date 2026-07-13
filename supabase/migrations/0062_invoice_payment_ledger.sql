-- Invoice payment ledger for partial/offline/international payment tracking.

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual'
    check (source in ('manual', 'razorpay', 'webhook', 'import')),
  method text not null default 'upi'
    check (method in ('upi', 'bank', 'wire', 'wise', 'paypal', 'stripe', 'razorpay', 'cash', 'other')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'INR',
  received_amount numeric(14,2) not null check (received_amount > 0),
  received_currency text not null default 'INR',
  fx_rate_to_invoice numeric(14,6) not null default 1 check (fx_rate_to_invoice > 0),
  inr_equivalent numeric(14,2),
  paid_at timestamptz not null default now(),
  reference text,
  proof_url text,
  notes text,
  receipt_id uuid references public.invoice_receipts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_idx
  on public.invoice_payments (invoice_id, paid_at desc);
create index if not exists invoice_payments_user_idx
  on public.invoice_payments (user_id, created_at desc);
create index if not exists invoice_payments_receipt_idx
  on public.invoice_payments (receipt_id);

alter table public.invoice_payments enable row level security;

drop policy if exists invoice_payments_owner_select on public.invoice_payments;
drop policy if exists invoice_payments_owner_insert on public.invoice_payments;
drop policy if exists invoice_payments_owner_update on public.invoice_payments;
drop policy if exists invoice_payments_owner_delete on public.invoice_payments;

create policy invoice_payments_owner_select on public.invoice_payments
  for select using (auth.uid() = user_id);

create policy invoice_payments_owner_insert on public.invoice_payments
  for insert with check (auth.uid() = user_id);

create policy invoice_payments_owner_update on public.invoice_payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy invoice_payments_owner_delete on public.invoice_payments
  for delete using (auth.uid() = user_id);
