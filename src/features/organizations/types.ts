/**
 * Organization types
 */

import type { OrgRole, ProjectMemberRole } from "@/lib/supabase/types";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  brand_color: string | null;
  brand_tagline: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInvitationRow {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  token_hash: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithMemberCount extends OrganizationRow {
  member_count: number;
}

export interface OrganizationWithDetails extends OrganizationRow {
  member_count: number;
  user_role: OrgRole | null;
  is_owner: boolean;
}