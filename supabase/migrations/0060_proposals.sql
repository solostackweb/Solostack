-- Proposal documents for the clientflow phase.

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted')),
  currency text not null default 'INR',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  valid_until date,
  scope text,
  deliverables text,
  timeline text,
  terms text,
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_user_idx
  on public.proposals (user_id, created_at desc);
create index if not exists proposals_client_idx
  on public.proposals (client_id);
create index if not exists proposals_project_idx
  on public.proposals (project_id);
create index if not exists proposals_status_idx
  on public.proposals (status);
create index if not exists proposals_public_token_idx
  on public.proposals (public_token);
create index if not exists proposal_items_proposal_idx
  on public.proposal_items (proposal_id, sort_order);

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();

drop trigger if exists proposal_items_set_updated_at on public.proposal_items;
create trigger proposal_items_set_updated_at
before update on public.proposal_items
for each row execute function public.set_updated_at();

alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

drop policy if exists proposals_owner_select on public.proposals;
drop policy if exists proposals_owner_insert on public.proposals;
drop policy if exists proposals_owner_update on public.proposals;
drop policy if exists proposals_owner_delete on public.proposals;

create policy proposals_owner_select on public.proposals
  for select using (auth.uid() = user_id);
create policy proposals_owner_insert on public.proposals
  for insert with check (auth.uid() = user_id);
create policy proposals_owner_update on public.proposals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy proposals_owner_delete on public.proposals
  for delete using (auth.uid() = user_id);

drop policy if exists proposal_items_owner_select on public.proposal_items;
drop policy if exists proposal_items_owner_insert on public.proposal_items;
drop policy if exists proposal_items_owner_update on public.proposal_items;
drop policy if exists proposal_items_owner_delete on public.proposal_items;

create policy proposal_items_owner_select on public.proposal_items
  for select using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.user_id = auth.uid()
    )
  );

create policy proposal_items_owner_insert on public.proposal_items
  for insert with check (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.user_id = auth.uid()
    )
  );

create policy proposal_items_owner_update on public.proposal_items
  for update using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.user_id = auth.uid()
    )
  );

create policy proposal_items_owner_delete on public.proposal_items
  for delete using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.user_id = auth.uid()
    )
  );
