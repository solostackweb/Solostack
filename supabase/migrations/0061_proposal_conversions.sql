-- Trace proposal conversions across projects, contracts, invoices, and activity.

alter table public.projects
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

alter table public.contracts
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

alter table public.invoices
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

create index if not exists projects_proposal_idx
  on public.projects (proposal_id);
create index if not exists contracts_proposal_idx
  on public.contracts (proposal_id);
create index if not exists invoices_proposal_idx
  on public.invoices (proposal_id);

alter table public.activity_events
  drop constraint if exists activity_events_entity_type_check;

alter table public.activity_events
  add constraint activity_events_entity_type_check
  check (entity_type in (
    'project',
    'client',
    'proposal',
    'invoice',
    'contract',
    'welcome_document',
    'time_entry',
    'file',
    'system'
  ));
