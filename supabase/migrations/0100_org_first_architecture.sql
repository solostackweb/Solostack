-- =============================================================================
-- 0100_org_first_architecture.sql
-- Make organizations the top-level entity for all business data
-- Run AFTER 0099_org_auto_create.sql (personal orgs exist)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ADD organization_id COLUMNS (nullable first for backfill)
-- =============================================================================

-- Core business tables
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Portal tables
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Time tracking
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Document Templates
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Welcome documents
ALTER TABLE public.welcome_documents
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Lead forms
ALTER TABLE public.lead_forms
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Recurring invoices
ALTER TABLE public.recurring_invoices
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Questionnaires
ALTER TABLE public.questionnaires
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Project costs
ALTER TABLE public.project_costs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Project members
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Invoice items (via parent invoice, but add for direct queries)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- =============================================================================
-- 2. BACKFILL: Assign existing data to user's personal organization
-- =============================================================================

-- First, ensure every user with data has a personal organization
-- Create missing organizations for users who have data but no org
DO $$
DECLARE
  u RECORD;
BEGIN
  -- Create orgs for users who have clients but no organization
  FOR u IN 
    SELECT DISTINCT c.user_id FROM public.clients c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organizations o 
      WHERE o.owner_user_id = c.user_id AND o.deleted_at IS NULL
    )
  LOOP
    INSERT INTO public.organizations (name, slug, owner_user_id)
    VALUES (
      COALESCE((SELECT full_name FROM public.user_profiles WHERE id = u.user_id), 'User') || '''s Organization',
      'user-' || substr(u.user_id::text, 1, 8) || '-' || substr(gen_random_uuid()::text, 1, 6),
      u.user_id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Create orgs for users who have projects but no organization
  FOR u IN 
    SELECT DISTINCT p.user_id FROM public.projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organizations o 
      WHERE o.owner_user_id = p.user_id AND o.deleted_at IS NULL
    )
  LOOP
    INSERT INTO public.organizations (name, slug, owner_user_id)
    VALUES (
      COALESCE((SELECT full_name FROM public.user_profiles WHERE id = u.user_id), 'User') || '''s Organization',
      'user-' || substr(u.user_id::text, 1, 8) || '-' || substr(gen_random_uuid()::text, 1, 6),
      u.user_id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Create orgs for users who have invoices but no organization
  FOR u IN 
    SELECT DISTINCT i.user_id FROM public.invoices i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organizations o 
      WHERE o.owner_user_id = i.user_id AND o.deleted_at IS NULL
    )
  LOOP
    INSERT INTO public.organizations (name, slug, owner_user_id)
    VALUES (
      COALESCE((SELECT full_name FROM public.user_profiles WHERE id = u.user_id), 'User') || '''s Organization',
      'user-' || substr(u.user_id::text, 1, 8) || '-' || substr(gen_random_uuid()::text, 1, 6),
      u.user_id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Create orgs for users who have other data but no organization
  FOR u IN 
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.contracts
      UNION SELECT user_id FROM public.files
      UNION SELECT user_id FROM public.notifications
      UNION SELECT owner_user_id AS user_id FROM public.portals
      UNION SELECT user_id FROM public.time_entries
      UNION SELECT user_id FROM public.proposals
      UNION SELECT user_id FROM public.document_templates
      UNION SELECT user_id FROM public.welcome_documents
      UNION SELECT user_id FROM public.lead_forms
      UNION SELECT user_id FROM public.recurring_invoices
      UNION SELECT user_id FROM public.meetings
      UNION SELECT user_id FROM public.questionnaires
      UNION SELECT user_id FROM public.project_costs
    ) all_users
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organizations o 
      WHERE o.owner_user_id = all_users.user_id AND o.deleted_at IS NULL
    )
  LOOP
    INSERT INTO public.organizations (name, slug, owner_user_id)
    VALUES (
      COALESCE((SELECT full_name FROM public.user_profiles WHERE id = u.user_id), 'User') || '''s Organization',
      'user-' || substr(u.user_id::text, 1, 8) || '-' || substr(gen_random_uuid()::text, 1, 6),
      u.user_id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Helper: get user's personal org (the one they own)
-- We use the org where owner_user_id = user_id

UPDATE public.clients c
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = c.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE c.organization_id IS NULL;

UPDATE public.projects p
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = p.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE p.organization_id IS NULL;

UPDATE public.invoices i
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = i.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE i.organization_id IS NULL;

UPDATE public.contracts c
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = c.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE c.organization_id IS NULL;

UPDATE public.files f
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = f.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE f.organization_id IS NULL;

UPDATE public.notifications n
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = n.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE n.organization_id IS NULL;

UPDATE public.portals p
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = p.owner_user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE p.organization_id IS NULL;

UPDATE public.time_entries t
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = t.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE t.organization_id IS NULL;

UPDATE public.proposals p
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = p.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE p.organization_id IS NULL;

UPDATE public.document_templates t
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = t.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE t.organization_id IS NULL;

UPDATE public.welcome_documents w
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = w.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE w.organization_id IS NULL;

UPDATE public.lead_forms l
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = l.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE l.organization_id IS NULL;

UPDATE public.recurring_invoices r
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = r.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE r.organization_id IS NULL;

UPDATE public.meetings m
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = m.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE m.organization_id IS NULL;

UPDATE public.questionnaires q
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = q.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE q.organization_id IS NULL;

UPDATE public.project_costs pc
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = pc.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE pc.organization_id IS NULL;

UPDATE public.project_members pm
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = (
    SELECT p.user_id FROM public.projects p WHERE p.id = pm.project_id
  ) AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE pm.organization_id IS NULL;

UPDATE public.invoice_items ii
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = (
    SELECT i.user_id FROM public.invoices i WHERE i.id = ii.invoice_id
  ) AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE ii.organization_id IS NULL;

-- =============================================================================
-- 3. MAKE organization_id NOT NULL (after backfill)
-- =============================================================================

ALTER TABLE public.clients
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.projects
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.invoices
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.contracts
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.files
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.notifications
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.portals
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.time_entries
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.proposals
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.document_templates
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.welcome_documents
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.lead_forms
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.recurring_invoices
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.meetings
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.questionnaires
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.project_costs
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.project_members
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.invoice_items
  ALTER COLUMN organization_id SET NOT NULL;

-- =============================================================================
-- 4. INDEXES for organization_id
-- =============================================================================

CREATE INDEX IF NOT EXISTS clients_organization_id_idx ON public.clients (organization_id);
CREATE INDEX IF NOT EXISTS projects_organization_id_idx ON public.projects (organization_id);
CREATE INDEX IF NOT EXISTS invoices_organization_id_idx ON public.invoices (organization_id);
CREATE INDEX IF NOT EXISTS contracts_organization_id_idx ON public.contracts (organization_id);
CREATE INDEX IF NOT EXISTS files_organization_id_idx ON public.files (organization_id);
CREATE INDEX IF NOT EXISTS notifications_organization_id_idx ON public.notifications (organization_id);
CREATE INDEX IF NOT EXISTS portals_organization_id_idx ON public.portals (organization_id);
CREATE INDEX IF NOT EXISTS time_entries_organization_id_idx ON public.time_entries (organization_id);
CREATE INDEX IF NOT EXISTS proposals_organization_id_idx ON public.proposals (organization_id);
CREATE INDEX IF NOT EXISTS document_templates_organization_id_idx ON public.document_templates (organization_id);
CREATE INDEX IF NOT EXISTS welcome_documents_organization_id_idx ON public.welcome_documents (organization_id);
CREATE INDEX IF NOT EXISTS lead_forms_organization_id_idx ON public.lead_forms (organization_id);
CREATE INDEX IF NOT EXISTS recurring_invoices_organization_id_idx ON public.recurring_invoices (organization_id);
CREATE INDEX IF NOT EXISTS meetings_organization_id_idx ON public.meetings (organization_id);
CREATE INDEX IF NOT EXISTS questionnaires_organization_id_idx ON public.questionnaires (organization_id);
CREATE INDEX IF NOT EXISTS project_costs_organization_id_idx ON public.project_costs (organization_id);
CREATE INDEX IF NOT EXISTS project_members_organization_id_idx ON public.project_members (organization_id);
CREATE INDEX IF NOT EXISTS invoice_items_organization_id_idx ON public.invoice_items (organization_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS clients_org_user_idx ON public.clients (organization_id, user_id);
CREATE INDEX IF NOT EXISTS projects_org_user_idx ON public.projects (organization_id, user_id);
CREATE INDEX IF NOT EXISTS invoices_org_user_idx ON public.invoices (organization_id, user_id);
CREATE INDEX IF NOT EXISTS contracts_org_user_idx ON public.contracts (organization_id, user_id);

-- =============================================================================
-- 5. UPDATE UNIQUE CONSTRAINTS to be per-organization
-- =============================================================================

-- invoices: invoice_number unique per organization (not per user)
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_user_id_invoice_number_key,
  ADD CONSTRAINT invoices_org_invoice_number_unique UNIQUE (organization_id, invoice_number);

-- clients: email unique per organization (optional, but useful)
-- ALTER TABLE public.clients ADD CONSTRAINT clients_org_email_unique UNIQUE (organization_id, email) WHERE email IS NOT NULL;

-- =============================================================================
-- 6. UPDATE RLS POLICIES to check organization membership
-- =============================================================================

-- Helper function for RLS: check if user is active member of organization
-- (Already exists from 0098: public.is_org_member)

-- Drop old user_id-based policies and create org-based ones
-- We do this table by table

-- --- clients ---
DROP POLICY IF EXISTS clients_select_own ON public.clients;
DROP POLICY IF EXISTS clients_insert_own ON public.clients;
DROP POLICY IF EXISTS clients_update_own ON public.clients;
DROP POLICY IF EXISTS clients_delete_own ON public.clients;

CREATE POLICY clients_select_org ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY clients_insert_org ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
  );

CREATE POLICY clients_update_org ON public.clients
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

CREATE POLICY clients_delete_org ON public.clients
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

-- --- projects ---
DROP POLICY IF EXISTS projects_select_own ON public.projects;
DROP POLICY IF EXISTS projects_insert_own ON public.projects;
DROP POLICY IF EXISTS projects_update_own ON public.projects;
DROP POLICY IF EXISTS projects_delete_own ON public.projects;

CREATE POLICY projects_select_org ON public.projects
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY projects_insert_org ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
  );

CREATE POLICY projects_update_org ON public.projects
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

CREATE POLICY projects_delete_org ON public.projects
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

-- --- invoices ---
DROP POLICY IF EXISTS invoices_select_own ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_own ON public.invoices;
DROP POLICY IF EXISTS invoices_update_own ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_own ON public.invoices;

CREATE POLICY invoices_select_org ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY invoices_insert_org ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
  );

CREATE POLICY invoices_update_org ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

CREATE POLICY invoices_delete_org ON public.invoices
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

-- --- invoice_items ---
DROP POLICY IF EXISTS invoice_items_select_own ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_insert_own ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_update_own ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_delete_own ON public.invoice_items;

CREATE POLICY invoice_items_select_org ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.is_org_member(i.organization_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY invoice_items_insert_org ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.has_org_role(i.organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
    )
  );

CREATE POLICY invoice_items_update_org ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.has_org_role(i.organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.has_org_role(i.organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
    )
  );

CREATE POLICY invoice_items_delete_org ON public.invoice_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.has_org_role(i.organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[])
    )
  );

-- --- contracts ---
DROP POLICY IF EXISTS contracts_select_own ON public.contracts;
DROP POLICY IF EXISTS contracts_insert_own ON public.contracts;
DROP POLICY IF EXISTS contracts_update_own ON public.contracts;
DROP POLICY IF EXISTS contracts_delete_own ON public.contracts;
DROP POLICY IF EXISTS contracts_public_token_read ON public.contracts;

CREATE POLICY contracts_select_org ON public.contracts
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY contracts_insert_org ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
  );

CREATE POLICY contracts_update_org ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

CREATE POLICY contracts_delete_org ON public.contracts
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

-- Public token read for signing page
CREATE POLICY contracts_public_token_read ON public.contracts
  FOR SELECT TO anon
  USING (public_token IS NOT NULL);

-- --- files ---
DROP POLICY IF EXISTS files_select_own ON public.files;
DROP POLICY IF EXISTS files_insert_own ON public.files;
DROP POLICY IF EXISTS files_update_own ON public.files;
DROP POLICY IF EXISTS files_delete_own ON public.files;

CREATE POLICY files_select_org ON public.files
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY files_insert_org ON public.files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
  );

CREATE POLICY files_update_org ON public.files
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

CREATE POLICY files_delete_org ON public.files
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

-- --- notifications ---
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;

CREATE POLICY notifications_select_org ON public.notifications
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY notifications_update_org ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())))
  WITH CHECK (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY notifications_delete_org ON public.notifications
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

-- --- portals ---
DROP POLICY IF EXISTS portals_select_own ON public.portals;
DROP POLICY IF EXISTS portals_insert_own ON public.portals;
DROP POLICY IF EXISTS portals_update_own ON public.portals;
DROP POLICY IF EXISTS portals_delete_own ON public.portals;

-- (Recreate with org_id check - portals already have organization_id from 0098)
-- Note: portals may have existing policies, drop them first
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'portals' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || pol.policyname || ' ON public.portals';
  END LOOP;
END $$;

CREATE POLICY portals_select_org ON public.portals
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

CREATE POLICY portals_insert_org ON public.portals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
  );

CREATE POLICY portals_update_org ON public.portals
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

CREATE POLICY portals_delete_org ON public.portals
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

-- =============================================================================
-- 7. UPDATE SUBSCRIPTIONS: Move to organization-level billing
-- =============================================================================

-- Subscriptions currently per user. For org-first, we need org_subscriptions
-- But keep user subscriptions for backward compat during transition
-- Add organization_id to subscriptions (nullable for now)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS subscriptions_organization_id_idx ON public.subscriptions (organization_id);

-- Update existing subscriptions to point to user's personal org
UPDATE public.subscriptions s
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = s.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE s.organization_id IS NULL;

-- =============================================================================
-- 8. UPDATE USAGE_COUNTERS to be organization-scoped
-- =============================================================================

ALTER TABLE public.usage_counters
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS usage_counters_organization_id_idx ON public.usage_counters (organization_id);

-- Backfill
UPDATE public.usage_counters uc
SET organization_id = (
  SELECT o.id FROM public.organizations o
  WHERE o.owner_user_id = uc.user_id AND o.deleted_at IS NULL
  LIMIT 1
)
WHERE uc.organization_id IS NULL;

-- Update RLS for usage_counters
DROP POLICY IF EXISTS usage_counters_select_own ON public.usage_counters;

CREATE POLICY usage_counters_select_org ON public.usage_counters
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, (SELECT auth.uid())));

-- =============================================================================
-- 9. UPDATE TIME_ENTRIES RLS
-- =============================================================================

DROP POLICY IF EXISTS time_entries_select_own ON public.time_entries;
DROP POLICY IF EXISTS time_entries_insert_own ON public.time_entries;
DROP POLICY IF EXISTS time_entries_update_own ON public.time_entries;
DROP POLICY IF EXISTS time_entries_delete_own ON public.time_entries;

-- Recreate with org check (time_entries table may not exist yet - check)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_entries') THEN
    CREATE POLICY time_entries_select_org ON public.time_entries
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY time_entries_insert_org ON public.time_entries
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY time_entries_update_org ON public.time_entries
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY time_entries_delete_org ON public.time_entries
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 10. UPDATE PROPOSALS RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proposals') THEN
    -- Drop old policies
    DROP POLICY IF EXISTS proposals_select_own ON public.proposals;
    DROP POLICY IF EXISTS proposals_insert_own ON public.proposals;
    DROP POLICY IF EXISTS proposals_update_own ON public.proposals;
    DROP POLICY IF EXISTS proposals_delete_own ON public.proposals;

    CREATE POLICY proposals_select_org ON public.proposals
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY proposals_insert_org ON public.proposals
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY proposals_update_org ON public.proposals
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY proposals_delete_org ON public.proposals
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 11. UPDATE DOCUMENT_TEMPLATES RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_templates') THEN
    DROP POLICY IF EXISTS document_templates_select_own ON public.document_templates;
    DROP POLICY IF EXISTS document_templates_insert_own ON public.document_templates;
    DROP POLICY IF EXISTS document_templates_update_own ON public.document_templates;
    DROP POLICY IF EXISTS document_templates_delete_own ON public.document_templates;

    CREATE POLICY document_templates_select_org ON public.document_templates
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY document_templates_insert_org ON public.document_templates
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY document_templates_update_org ON public.document_templates
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY document_templates_delete_org ON public.document_templates
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 12. UPDATE WELCOME_DOCUMENTS RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'welcome_documents') THEN
    DROP POLICY IF EXISTS welcome_documents_select_own ON public.welcome_documents;
    DROP POLICY IF EXISTS welcome_documents_insert_own ON public.welcome_documents;
    DROP POLICY IF EXISTS welcome_documents_update_own ON public.welcome_documents;
    DROP POLICY IF EXISTS welcome_documents_delete_own ON public.welcome_documents;

    CREATE POLICY welcome_documents_select_org ON public.welcome_documents
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY welcome_documents_insert_org ON public.welcome_documents
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY welcome_documents_update_org ON public.welcome_documents
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY welcome_documents_delete_org ON public.welcome_documents
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 13. UPDATE LEAD_FORMS RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_forms') THEN
    DROP POLICY IF EXISTS lead_forms_select_own ON public.lead_forms;
    DROP POLICY IF EXISTS lead_forms_insert_own ON public.lead_forms;
    DROP POLICY IF EXISTS lead_forms_update_own ON public.lead_forms;
    DROP POLICY IF EXISTS lead_forms_delete_own ON public.lead_forms;

    CREATE POLICY lead_forms_select_org ON public.lead_forms
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY lead_forms_insert_org ON public.lead_forms
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY lead_forms_update_org ON public.lead_forms
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY lead_forms_delete_org ON public.lead_forms
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 14. UPDATE RECURRING_INVOICES RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recurring_invoices') THEN
    DROP POLICY IF EXISTS recurring_invoices_select_own ON public.recurring_invoices;
    DROP POLICY IF EXISTS recurring_invoices_insert_own ON public.recurring_invoices;
    DROP POLICY IF EXISTS recurring_invoices_update_own ON public.recurring_invoices;
    DROP POLICY IF EXISTS recurring_invoices_delete_own ON public.recurring_invoices;

    CREATE POLICY recurring_invoices_select_org ON public.recurring_invoices
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY recurring_invoices_insert_org ON public.recurring_invoices
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY recurring_invoices_update_org ON public.recurring_invoices
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY recurring_invoices_delete_org ON public.recurring_invoices
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 15. UPDATE MEETINGS RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meetings') THEN
    DROP POLICY IF EXISTS meetings_select_own ON public.meetings;
    DROP POLICY IF EXISTS meetings_insert_own ON public.meetings;
    DROP POLICY IF EXISTS meetings_update_own ON public.meetings;
    DROP POLICY IF EXISTS meetings_delete_own ON public.meetings;

    CREATE POLICY meetings_select_org ON public.meetings
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY meetings_insert_org ON public.meetings
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY meetings_update_org ON public.meetings
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY meetings_delete_org ON public.meetings
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 16. UPDATE QUESTIONNAIRES RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'questionnaires') THEN
    DROP POLICY IF EXISTS questionnaires_select_own ON public.questionnaires;
    DROP POLICY IF EXISTS questionnaires_insert_own ON public.questionnaires;
    DROP POLICY IF EXISTS questionnaires_update_own ON public.questionnaires;
    DROP POLICY IF EXISTS questionnaires_delete_own ON public.questionnaires;

    CREATE POLICY questionnaires_select_org ON public.questionnaires
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY questionnaires_insert_org ON public.questionnaires
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
      );

    CREATE POLICY questionnaires_update_org ON public.questionnaires
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY questionnaires_delete_org ON public.questionnaires
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 17. UPDATE PROJECT_COSTS RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_costs') THEN
    DROP POLICY IF EXISTS project_costs_select ON public.project_costs;
    DROP POLICY IF EXISTS project_costs_insert_owner ON public.project_costs;
    DROP POLICY IF EXISTS project_costs_update_owner ON public.project_costs;
    DROP POLICY IF EXISTS project_costs_delete_owner ON public.project_costs;

    CREATE POLICY project_costs_select_org ON public.project_costs
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY project_costs_insert_org ON public.project_costs
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[])
        AND user_id = (SELECT auth.uid())
      );

    CREATE POLICY project_costs_update_org ON public.project_costs
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin','member']::public.org_role[]));

    CREATE POLICY project_costs_delete_org ON public.project_costs
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 18. UPDATE PROJECT_MEMBERS RLS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_members') THEN
    DROP POLICY IF EXISTS project_members_select ON public.project_members;
    DROP POLICY IF EXISTS project_members_insert_owner ON public.project_members;
    DROP POLICY IF EXISTS project_members_update_owner ON public.project_members;
    DROP POLICY IF EXISTS project_members_delete_owner ON public.project_members;

    CREATE POLICY project_members_select_org ON public.project_members
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, (SELECT auth.uid())));

    CREATE POLICY project_members_insert_org ON public.project_members
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[])
      );

    CREATE POLICY project_members_update_org ON public.project_members
      FOR UPDATE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]))
      WITH CHECK (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));

    CREATE POLICY project_members_delete_org ON public.project_members
      FOR DELETE TO authenticated
      USING (public.has_org_role(organization_id, (SELECT auth.uid()), ARRAY['owner','admin']::public.org_role[]));
  END IF;
END $$;

-- =============================================================================
-- 19. TRIGGERS: Auto-set organization_id on insert
-- =============================================================================

-- Function to auto-set organization_id from user's current org context
-- This requires the user to have an active org in their session
CREATE OR REPLACE FUNCTION public.set_organization_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to get organization_id from the request context
  -- This is set by the application via SET LOCAL
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := current_setting('app.current_organization_id', true)::uuid;
  END IF;
  
  -- Fallback: use user's personal org
  IF NEW.organization_id IS NULL THEN
    SELECT o.id INTO NEW.organization_id
    FROM public.organizations o
    WHERE o.owner_user_id = NEW.user_id
      AND o.deleted_at IS NULL
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END $$;

-- Apply trigger to all tables with organization_id
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN 
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND column_name = 'organization_id'
      AND table_name IN (
        'clients','projects','invoices','contracts','files',
        'portals','time_entries','proposals','document_templates',
        'welcome_documents','lead_forms','recurring_invoices',
        'meetings','questionnaires','project_costs',
        'project_members','invoice_items','notifications'
      )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_org_id_on_insert ON public.%I; 
       CREATE TRIGGER set_org_id_on_insert 
       BEFORE INSERT ON public.%I 
       FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();',
      t.table_name, t.table_name
    );
  END LOOP;
END $$;

-- =============================================================================
-- 20. UPDATE DASHBOARD SHELL CONTEXT: Add current_org_id to JWT claims
-- =============================================================================

-- This is handled in application code (middleware sets app.current_organization_id)
-- But we can add a helper function for server-side code

CREATE OR REPLACE FUNCTION public.get_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_organization_id() TO authenticated;

-- =============================================================================
-- 21. HELPER: Get user's organizations with roles (for switching)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_organizations(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  role public.org_role,
  is_owner boolean,
  member_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    o.id,
    o.name,
    o.slug,
    om.role,
    (o.owner_user_id = p_user_id) AS is_owner,
    (
      SELECT COUNT(*) FROM public.organization_members om2
      WHERE om2.organization_id = o.id
        AND om2.joined_at IS NOT NULL
        AND om2.revoked_at IS NULL
    ) AS member_count
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = p_user_id
    AND om.joined_at IS NOT NULL
    AND om.revoked_at IS NULL
    AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_organizations(uuid) TO authenticated;

COMMIT;

-- =============================================================================
-- END
-- =============================================================================