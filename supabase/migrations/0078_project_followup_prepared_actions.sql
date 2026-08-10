-- Allow IVo to turn a conversational project/client reminder into the same
-- durable, approval-gated email artifact used by proactive follow-ups.
alter table public.ivo_prepared_actions
  drop constraint if exists ivo_prepared_actions_kind_check;

alter table public.ivo_prepared_actions
  add constraint ivo_prepared_actions_kind_check check (kind in (
    'payment_reminder', 'due_soon_reminder', 'proposal_followup',
    'contract_followup', 'lead_reply', 'project_followup'
  ));
