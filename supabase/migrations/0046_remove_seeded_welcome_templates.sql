-- =============================================================================
-- 0046_remove_seeded_welcome_templates.sql
--
-- Welcome document system templates are now code-owned in
-- src/features/welcome-documents/templates.ts. Remove old seeded database
-- system templates so stale rows cannot override or duplicate the curated
-- in-app templates. User-saved templates are untouched.
-- =============================================================================

delete from public.welcome_document_templates
where is_system = true
  and user_id is null;

