-- Extend reusable document templates to welcome documents.

alter table public.document_templates
  drop constraint if exists document_templates_template_type_check;

alter table public.document_templates
  add constraint document_templates_template_type_check
  check (template_type in (
    'proposal',
    'contract',
    'welcome_doc',
    'invoice_note',
    'email'
  ));

notify pgrst, 'reload schema';
