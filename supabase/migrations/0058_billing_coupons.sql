-- Billing coupons and checkout attribution.

create table if not exists public.billing_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'amount')),
  discount_value integer not null check (discount_value > 0),
  applies_to_plan text not null default 'all'
    check (applies_to_plan in ('all', 'pro', 'business')),
  applies_to_cycle text not null default 'all'
    check (applies_to_cycle in ('all', 'monthly', 'yearly')),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  max_redemptions_per_user integer not null default 1
    check (max_redemptions_per_user > 0),
  redeem_count integer not null default 0 check (redeem_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_coupons_active_idx
  on public.billing_coupons (active, expires_at);
create index if not exists billing_coupons_code_idx
  on public.billing_coupons (upper(code));

create trigger billing_coupons_set_updated_at
before update on public.billing_coupons
for each row execute function public.set_updated_at();

create table if not exists public.billing_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.billing_coupons(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_row_id uuid references public.subscriptions(id) on delete set null,
  razorpay_subscription_id text,
  razorpay_plan_id text,
  plan text not null check (plan in ('pro', 'business')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  subtotal_amount integer not null check (subtotal_amount >= 0),
  discount_amount integer not null check (discount_amount >= 0),
  final_amount integer not null check (final_amount >= 0),
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'applied', 'paid', 'void')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists billing_coupon_redemptions_coupon_idx
  on public.billing_coupon_redemptions (coupon_id);
create index if not exists billing_coupon_redemptions_user_idx
  on public.billing_coupon_redemptions (user_id, coupon_id);
create index if not exists billing_coupon_redemptions_rzp_sub_idx
  on public.billing_coupon_redemptions (razorpay_subscription_id);
create unique index if not exists billing_coupon_redemptions_rzp_sub_unique
  on public.billing_coupon_redemptions (razorpay_subscription_id)
  where razorpay_subscription_id is not null;

alter table public.subscriptions
  add column if not exists coupon_id uuid references public.billing_coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists coupon_discount_amount integer not null default 0,
  add column if not exists checkout_amount integer,
  add column if not exists checkout_currency text not null default 'INR';

alter table public.billing_payments
  add column if not exists coupon_id uuid references public.billing_coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount_amount integer not null default 0;

alter table public.admin_actions
  drop constraint if exists admin_actions_target_type_check;

alter table public.admin_actions
  add constraint admin_actions_target_type_check
  check (target_type in (
    'user',
    'subscription',
    'invoice',
    'contract',
    'file',
    'email',
    'notification',
    'security_event',
    'settings',
    'query',
    'system',
    'support_ticket',
    'coupon'
  ));

create or replace function public.increment_coupon_redemption(p_coupon_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billing_coupons
  set redeem_count = redeem_count + 1,
      updated_at = now()
  where id = p_coupon_id;
end;
$$;
