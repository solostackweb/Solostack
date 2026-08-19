-- Widen the delivery_logs CHECK constraints, and add the meeting reminder kind.
--
-- 0008 pinned `kind` to nine values and `entity_type` to four, but the app has
-- since grown welcome documents, proposals, portals, and questionnaires. Those
-- inserts violate the constraint, and insertDeliveryLog() swallows the error
-- and returns null — so the email still sends while its ledger row is silently
-- lost. Anything outside the original list has had no audit trail.
--
-- This brings the constraints in line with DeliveryKind / entity_type in
-- src/lib/supabase/types.ts and adds 'meeting_reminder' + 'meeting' for the
-- pre-call reminder cron.

alter table public.delivery_logs
  drop constraint if exists delivery_logs_kind_check;

alter table public.delivery_logs
  add constraint delivery_logs_kind_check
  check (kind in (
    'invoice_sent','invoice_reminder','invoice_viewed','invoice_paid',
    'contract_sent','contract_signed','contract_declined',
    'proposal_sent',
    'welcome_document_sent','welcome_document_acknowledged',
    'portal_invite','portal_digest','portal_update','portal_meeting',
    'portal_file',
    'questionnaire_sent','questionnaire_completed',
    'meeting_reminder',
    'subscription_renewal',
    'custom'
  ));

alter table public.delivery_logs
  drop constraint if exists delivery_logs_entity_type_check;

alter table public.delivery_logs
  add constraint delivery_logs_entity_type_check
  check (entity_type in (
    'invoice','contract','welcome_document','client','portal',
    'questionnaire','meeting','system'
  ));
