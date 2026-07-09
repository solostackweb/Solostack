-- Allow first-party support operations to be recorded in admin_actions.

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
    'support_ticket'
  ));