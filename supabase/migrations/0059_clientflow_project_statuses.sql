-- Clientflow lifecycle statuses for proposals, contracts, invoices, and payments.

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (
    status in (
      'lead',
      'planning',
      'proposal_sent',
      'contract_sent',
      'active',
      'waiting_on_client',
      'revision',
      'review',
      'completed',
      'invoiced',
      'paid',
      'on_hold',
      'cancelled',
      'archived'
    )
  );

create index if not exists projects_clientflow_status_idx
  on public.projects (user_id, status, updated_at desc);
