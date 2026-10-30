import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import type { Database } from "@/lib/supabase/types";
import type { OrgRole, OrganizationRow, OrganizationMemberRow, OrganizationInvitationRow, ProjectMemberRole } from "./types";

let adminClient: SupabaseClient<Database> | null = null;

function getAdmin(): SupabaseClient<Database> {
  if (adminClient) return adminClient;
  adminClient = createClient<Database>(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return adminClient;
}

const ORG_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export class OrgAccessError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "forbidden" | "not_found" | "invalid_slug" | "slug_taken",
    message: string,
  ) {
    super(message);
    this.name = "OrgAccessError";
  }
}

/** Verify the caller has the required org role. */
export async function requireOrgAccess(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  requiredRoles: OrgRole[] = ["owner", "admin", "member"],
): Promise<{ userId: string; role: OrgRole }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new OrgAccessError("unauthenticated", "Please sign in.");

  const { data: member, error } = await supabase
    .from("organization_members")
    .select("role, joined_at, revoked_at")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new OrgAccessError("forbidden", error.message);
  if (!member || !member.joined_at || member.revoked_at) {
    throw new OrgAccessError("forbidden", "You don't have access to this organization.");
  }
  if (!requiredRoles.includes(member.role as OrgRole)) {
    throw new OrgAccessError("forbidden", "You don't have permission to do that.");
  }
  return { userId: user.id, role: member.role as OrgRole };
}

/** Check if user is org member (active). */
export async function isOrgMember(
  admin: SupabaseClient<Database>,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin.rpc("is_org_member", { p_org_id: orgId, p_user_id: userId });
  return data === true;
}

/** Check if user has org role. */
export async function hasOrgRole(
  admin: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  roles: OrgRole[],
): Promise<boolean> {
  const { data } = await admin.rpc("has_org_role", { p_org_id: orgId, p_user_id: userId, p_roles: roles });
  return data === true;
}

/** Validate slug format. */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length < 2 || slug.length > 50) {
    return { valid: false, error: "Slug must be 2-50 characters." };
  }
  if (!ORG_SLUG_REGEX.test(slug)) {
    return { valid: false, error: "Slug can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)." };
  }
  return { valid: true };
}

/** Generate a unique slug from a name. */
export async function generateUniqueSlug(admin: SupabaseClient<Database>, base: string): Promise<string> {
  const baseSlug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = baseSlug || "org";
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${slug}-${suffix}`;
}

/** Get user's organizations (active). */
export async function getUserOrganizations(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<Array<{ id: string; name: string; slug: string; role: OrgRole; is_owner: boolean; member_count: number }>> {
  const { data } = await admin
    .from("organization_members")
    .select(`
      role,
      organization_id,
      organizations!inner (
        id,
        name,
        slug,
        owner_user_id,
        created_at
      )
    `)
    .eq("user_id", userId)
    .not("joined_at", "is", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((row) => ({
    id: row.organizations.id,
    name: row.organizations.name,
    slug: row.organizations.slug,
    role: row.role as OrgRole,
    is_owner: row.organizations.owner_user_id === userId,
    member_count: 0, // populated separately if needed
  }));
}

/** Get organization by slug. */
export async function getOrgBySlug(admin: SupabaseClient<Database>, slug: string): Promise<OrganizationRow | null> {
  const { data } = await admin
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  return data as OrganizationRow | null;
}

/** Get organization by id. */
export async function getOrgById(admin: SupabaseClient<Database>, id: string): Promise<OrganizationRow | null> {
  const { data } = await admin
    .from("organizations")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data as OrganizationRow | null;
}

/** Get organization with member count and user's role. */
export async function getOrgWithDetails(
  admin: SupabaseClient<Database>,
  orgId: string,
  userId: string,
): Promise<{ org: OrganizationRow; member_count: number; user_role: OrgRole | null; is_owner: boolean } | null> {
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!org) return null;

  const { count: memberCount } = await admin
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .not("joined_at", "is", null)
    .is("revoked_at", null);

  const { data: member } = await admin
    .from("organization_members")
    .select("role, joined_at, revoked_at")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    org: org as OrganizationRow,
    member_count: memberCount ?? 0,
    user_role: member?.joined_at && !member?.revoked_at ? (member.role as OrgRole) : null,
    is_owner: org.owner_user_id === userId,
  };
}

/** Create a new organization. */
export async function createOrganization(
  admin: SupabaseClient<Database>,
  userId: string,
  input: { name: string; slug?: string },
): Promise<{ org: OrganizationRow; member: { id: string; role: OrgRole } }> {
  const slug = input.slug && (await validateSlug(input.slug)).valid
    ? input.slug
    : await generateUniqueSlug(admin, input.name);

  // Check slug availability
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) throw new OrgAccessError("slug_taken", "That slug is already taken.");

  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      name: input.name,
      slug,
      owner_user_id: userId,
    })
    .select("*")
    .single();

  if (error || !org) throw new OrgAccessError("forbidden", error?.message ?? "Could not create organization.");

  // Add owner as member
  const { data: member, error: memberError } = await admin
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: userId,
      role: "owner",
      joined_at: new Date().toISOString(),
    })
    .select("id, role")
    .single();

  if (memberError || !member) {
    // Rollback org creation
    await admin.from("organizations").delete().eq("id", org.id);
    throw new OrgAccessError("forbidden", "Could not add owner as member.");
  }

  return { org: org as OrganizationRow, member: { id: member.id, role: "owner" } };
}

/** Update organization. */
export async function updateOrganization(
  admin: SupabaseClient<Database>,
  orgId: string,
  patch: Partial<Pick<OrganizationRow, "name" | "brand_color" | "brand_tagline" | "logo_url" | "settings">>,
): Promise<OrganizationRow> {
  const { data, error } = await admin
    .from("organizations")
    .update(patch)
    .eq("id", orgId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error || !data) throw new OrgAccessError("forbidden", error?.message ?? "Could not update organization.");
  return data as OrganizationRow;
}

/** Soft-delete organization. */
export async function deleteOrganization(admin: SupabaseClient<Database>, orgId: string): Promise<void> {
  const { error } = await admin
    .from("organizations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orgId);
  if (error) throw new OrgAccessError("forbidden", error.message);
}

/** List organization members. */
export async function listOrgMembers(
  admin: SupabaseClient<Database>,
  orgId: string,
): Promise<Array<OrganizationMemberRow & { user_email: string; user_name: string }>> {
  const { data } = await admin
    .from("organization_members")
    .select(`
      *,
      user:auth.users!inner (email, raw_user_meta_data)
    `)
    .eq("organization_id", orgId)
    .order("role", { ascending: true })
    .order("joined_at", { ascending: true });

  return (data ?? []).map((row) => ({
    ...row,
    user_email: (row as any).user?.email ?? "",
    user_name: (row as any).user?.raw_user_meta_data?.full_name ?? (row as any).user?.raw_user_meta_data?.display_name ?? "",
  })) as Array<OrganizationMemberRow & { user_email: string; user_name: string }>;
}

/** Invite user to organization. */
export async function inviteOrgMember(
  admin: SupabaseClient<Database>,
  orgId: string,
  invitedBy: string,
  input: { email: string; role: OrgRole },
): Promise<{ invitation: OrganizationInvitationRow; token: string }> {
  const email = input.email.trim().toLowerCase();

  // Check if already member
  const { data: existingMember } = await admin
    .from("organization_members")
    .select("id, joined_at, revoked_at")
    .eq("organization_id", orgId)
    .eq("user_id", (await admin.from("user_profiles").select("id").eq("email", email).maybeSingle())?.data?.id ?? "")
    .maybeSingle();

  if (existingMember?.joined_at && !existingMember.revoked_at) {
    throw new OrgAccessError("forbidden", "User is already a member.");
  }

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = await hashToken(token);

  const { data: invitation, error } = await admin
    .from("organization_invitations")
    .upsert(
      {
        organization_id: orgId,
        email,
        role: input.role,
        token_hash: tokenHash,
        invited_by: invitedBy,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "organization_id,email" },
    )
    .select("*")
    .single();

  if (error || !invitation) throw new OrgAccessError("forbidden", error?.message ?? "Could not create invitation.");

  return { invitation: invitation as OrganizationInvitationRow, token };
}

/** Accept organization invitation. */
export async function acceptOrgInvitation(
  admin: SupabaseClient<Database>,
  userId: string,
  token: string,
): Promise<{ alreadyMember: boolean; organization_id: string }> {
  const tokenHash = await hashToken(token);

const { data: invitation, error: invitationError } = await admin
    .from("organization_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .maybeSingle();

  if (invitationError || !invitation) {
    return { alreadyMember: false, organization_id: "" };
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return { alreadyMember: false, organization_id: "" };
  }

  // Check if already member
  const { data: existing, error: memberError } = await admin
    .from("organization_members")
    .select("id, joined_at, revoked_at")
    .eq("organization_id", invitation.organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);

  if (existing?.joined_at && !existing.revoked_at) {
    // Mark invitation accepted anyway
    await admin
      .from("organization_invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", invitation.id);
    return { alreadyMember: true, organization_id: invitation.organization_id };
  }

  // Add as member
  const upsertData = {
    organization_id: invitation.organization_id,
    user_id: userId,
    role: invitation.role,
    invited_by: invitation.invited_by,
    joined_at: new Date().toISOString(),
    revoked_at: null,
  };

  const { error: upsertError } = await admin
    .from("organization_members")
    .upsert(upsertData, { onConflict: "organization_id,user_id" });

  if (upsertError) throw new Error(upsertError.message);

  // Mark invitation accepted
  await admin
    .from("organization_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq("id", invitation.id);

  return { alreadyMember: false, organization_id: invitation.organization_id };
}

/** Remove member from organization. */
export async function removeOrgMember(
  admin: SupabaseClient<Database>,
  orgId: string,
  targetUserId: string,
  actorId: string,
): Promise<void> {
  const { data: actorMember } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", actorId)
    .maybeSingle();

  if (!actorMember || !["owner", "admin"].includes(actorMember.role)) {
    throw new OrgAccessError("forbidden", "Only owners and admins can remove members.");
  }

  if (actorId === targetUserId) {
    const { data: ownerCount } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "owner")
      .not("revoked_at", "is", null);

    if ((ownerCount ?? 0) <= 1) {
      throw new OrgAccessError("forbidden", "Cannot remove the last owner. Transfer ownership first.");
    }
  }

  await admin
    .from("organization_members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId);
}

/** Transfer ownership. */
export async function transferOwnership(
  admin: SupabaseClient<Database>,
  orgId: string,
  newOwnerId: string,
  actorId: string,
): Promise<void> {
  // Verify actor is current owner
  const { data: actorMember } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", actorId)
    .maybeSingle();

  if (!actorMember || actorMember.role !== "owner") {
    throw new OrgAccessError("forbidden", "Only the owner can transfer ownership.");
  }

  // Verify new owner is member
  const { data: newOwnerMember } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", newOwnerId)
    .not("joined_at", "is", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (!newOwnerMember) {
    throw new OrgAccessError("forbidden", "New owner must be an active member.");
  }

  // Demote current owner, promote new owner
  await admin
    .from("organization_members")
    .update({ role: "admin" })
    .eq("organization_id", orgId)
    .eq("user_id", actorId);

  await admin
    .from("organization_members")
    .update({ role: "owner" })
    .eq("organization_id", orgId)
    .eq("user_id", newOwnerId);

  // Update org owner
  await admin
    .from("organizations")
    .update({ owner_user_id: newOwnerId })
    .eq("id", orgId);
}

/** Hash token using SHA-256. */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// Project Members (Collaborators)
// =============================================================================

export async function addProjectMember(
  admin: SupabaseClient<Database>,
  projectId: string,
  actorId: string,
  input: { userId: string; role: ProjectMemberRole },
): Promise<void> {
  // Verify actor owns the project
  const { data: project } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || project.user_id !== actorId) {
    throw new OrgAccessError("forbidden", "Only the project owner can add collaborators.");
  }

  await admin
    .from("project_members")
    .upsert(
      {
        project_id: projectId,
        user_id: input.userId,
        role: input.role,
        invited_by: actorId,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "project_id,user_id" },
    );
}

export async function removeProjectMember(
  admin: SupabaseClient<Database>,
  projectId: string,
  actorId: string,
  targetUserId: string,
): Promise<void> {
  const { data: project } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || project.user_id !== actorId) {
    throw new OrgAccessError("forbidden", "Only the project owner can remove collaborators.");
  }

  await admin
    .from("project_members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("user_id", targetUserId);
}

export async function listProjectMembers(
  admin: SupabaseClient<Database>,
  projectId: string,
): Promise<Array<{ id: string; user_id: string; role: string; joined_at: string | null; user_email: string; user_name: string }>> {
  const { data } = await admin
    .from("project_members")
    .select(`
      id, user_id, role, joined_at,
      user:auth.users!inner (email, raw_user_meta_data)
    `)
    .eq("project_id", projectId)
    .is("revoked_at", null);

  return (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    user_email: (row as any).user?.email ?? "",
    user_name: (row as any).user?.raw_user_meta_data?.full_name ?? (row as any).user?.raw_user_meta_data?.display_name ?? "",
  }));
}

/** Calculate project profitability: revenue - costs. */
export async function calculateProjectProfitability(
  admin: SupabaseClient<Database>,
  projectId: string,
): Promise<{
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  costsByCategory: Record<string, number>;
  costsByMember: Record<string, { name: string; email: string; total: number }>;
}> {
  // Revenue from paid invoices
  const { data: invoices } = await admin
    .from("invoices")
    .select("total_amount, currency")
    .eq("project_id", projectId)
    .eq("status", "paid");

  const revenue = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.total_amount ?? 0), 0);

  // Costs from project_costs table
  const { data: costs } = await admin
    .from("project_costs")
    .select("amount, category, user_id")
    .eq("project_id", projectId);

  const costItems = (costs ?? []) as Array<{ amount: number | string; category: string | null; user_id: string }>;
  const totalCosts = costItems.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

  // Costs by category
  const costsByCategory: Record<string, number> = {};
  for (const c of costItems) {
    const cat = c.category ?? "uncategorized";
    costsByCategory[cat] = (costsByCategory[cat] ?? 0) + Number(c.amount ?? 0);
  }

  // Costs by member (with user lookup)
  const costsByMember: Record<string, { name: string; email: string; total: number }> = {};
  for (const c of costItems) {
    const key = c.user_id;
    if (!costsByMember[key]) {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", c.user_id)
        .maybeSingle();
      costsByMember[key] = {
        name: profile?.full_name ?? "Unknown",
        email: profile?.email ?? "",
        total: 0,
      };
    }
    costsByMember[key].total += Number(c.amount ?? 0);
  }

  const profit = revenue - totalCosts;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    revenue,
    costs: totalCosts,
    profit,
    margin,
    costsByCategory,
    costsByMember,
  };
}

/** Get org-level profitability across all projects. */
export async function getOrgProfitability(
  admin: SupabaseClient<Database>,
  orgId: string,
): Promise<{
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  overallMargin: number;
  projects: Array<{
    project_id: string;
    project_name: string;
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
  }>;
}> {
  // Get all projects in org (via portals)
  const { data: portals } = await admin
    .from("portals")
    .select("id")
    .eq("organization_id", orgId);

  const portalIds = (portals ?? []).map((p) => p.id);
  if (portalIds.length === 0) {
    return { totalRevenue: 0, totalCosts: 0, totalProfit: 0, overallMargin: 0, projects: [] };
  }

  // Get projects linked to these portals
  const { data: projects } = await admin
    .from("portal_projects")
    .select("project_id")
    .in("portal_id", portalIds);

  const projectIds = (projects ?? []).map((p) => p.project_id);
  if (projectIds.length === 0) {
    return { totalRevenue: 0, totalCosts: 0, totalProfit: 0, overallMargin: 0, projects: [] };
  }

  // Revenue from paid invoices for these projects
  const { data: invoices } = await admin
    .from("invoices")
    .select("project_id, total_amount")
    .in("project_id", projectIds)
    .eq("status", "paid");

  // Costs from project_costs
  const { data: costs } = await admin
    .from("project_costs")
    .select("project_id, amount")
    .in("project_id", projectIds);

  const revenueByProject: Record<string, number> = {};
  for (const inv of invoices ?? []) {
    revenueByProject[inv.project_id] = (revenueByProject[inv.project_id] ?? 0) + Number(inv.total_amount ?? 0);
  }

  const costsByProject: Record<string, number> = {};
  for (const c of costs ?? []) {
    costsByProject[c.project_id] = (costsByProject[c.project_id] ?? 0) + Number(c.amount ?? 0);
  }

  const projectDetails = await Promise.all(
    projectIds.map(async (pid) => {
      const rev = revenueByProject[pid] ?? 0;
      const cst = costsByProject[pid] ?? 0;
      const prof = rev - cst;
      const mrg = rev > 0 ? (prof / rev) * 100 : 0;

      const { data: proj } = await admin
        .from("projects")
        .select("name")
        .eq("id", pid)
        .maybeSingle();

      return {
        project_id: pid,
        project_name: proj?.name ?? "Unknown",
        revenue: rev,
        costs: cst,
        profit: prof,
        margin: mrg,
      };
    })
  );

  const totalRevenue = Object.values(revenueByProject).reduce((a, b) => a + b, 0);
  const totalCosts = Object.values(costsByProject).reduce((a, b) => a + b, 0);
  const totalProfit = totalRevenue - totalCosts;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCosts,
    totalProfit,
    overallMargin,
    projects: projectDetails,
  };
}