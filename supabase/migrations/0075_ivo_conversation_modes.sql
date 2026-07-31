-- Keep durable Ivo conversation state aligned with every workflow the runtime
-- can enter. Proposal and meeting were added after the original constraint.
alter table public.ivo_conversations
  drop constraint if exists ivo_conversations_current_mode_check;

alter table public.ivo_conversations
  add constraint ivo_conversations_current_mode_check
  check (current_mode in (
    'general', 'invoice', 'contract', 'proposal', 'welcome_document',
    'client', 'project', 'time_entry', 'meeting', 'support'
  ));
