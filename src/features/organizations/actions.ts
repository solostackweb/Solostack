"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase as getBaseAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase as getBaseServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  inviteOrgMember,
  removeOrgMember,
  transferOwnership,
  type OrgAccessError,
} from "./server";
import { recordActivity } from "@/features/activity/server";
import type { OrganizationDatabase, OrgRole, ProjectCostRow } from "@/lib/supabase/types";
import type { OrganizationMemberRow, OrganizationRow } from "./types";

type OrganizationMemberListItem = OrganizationMemberRow & {
  user_email: string;
  user_name: string;
};

type ProjectCollaboratorListItem = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string | null;
  user_email: string;
  user_name: string;
};

type UserOrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  is_owner: boolean;
  member_count: number;
};

type OrganizationSupabaseClient = SupabaseClient<OrganizationDatabase>;

function getAdminSupabase(): OrganizationSupabaseClient {
  return getBaseAdminSupabase() as unknown as OrganizationSupabaseClient;
}

async function getServerSupabase(): Promise<OrganizationSupabaseClient> {
  return (await getBaseServerSupabase()) as unknown as OrganizationSupabaseClient;
}

type ActionSuccess<T> = [T] extends [undefined]
  ? { ok: true; message?: string }
  : { ok: true; data: T; message?: string };

export type ActionResult<T = undefined> =
  | ActionSuccess<T>
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

function mapAccessError(err: OrgAccessError): string {
  switch (err.code) {
    case "unauthenticated":
      return "Please sign in.";
    case "forbidden":
      return err.message;
    case "not_found":
      return "Organization not found.";
    case "invalid_slug":
      return "Invalid slug format.";
    case "slug_taken":
      return "That slug is already taken.";
    default:
      return "An unexpected error occurred.";
  }
}

function isOrgAccessError(error: unknown): error is OrgAccessError {
  return error instanceof Error && "code" in error;
}

// --- Create Organization -----------------------------------------------------

const createOrgSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters").max(50, "Slug is too long").optional().or(z.literal("")),
});

export async function createOrgAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const admin = getAdminSupabase();
  try {
    const result = await createOrganization(admin, userId, parsed.data);
    revalidatePath("/dashboard/organizations");
    await recordActivity({
      kind: "organization_created",
      entityType: "organization",
      entityId: result.org.id,
      title: `Created organization ${result.org.name}`,
    });
    return { ok: true, data: { id: result.org.id }, message: "Organization created." };
  } catch (e) {
    if (isOrgAccessError(e)) {
      return { ok: false, error: mapAccessError(e) };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not create organization." };
  }
}

// --- Update Organization -----------------------------------------------------

const updateOrgSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  brand_color: z.string().max(7).optional().nullable(),
  brand_tagline: z.string().max(120).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

export async function updateOrgAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = updateOrgSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") || undefined,
    brand_color: formData.get("brand_color") || undefined,
    brand_tagline: formData.get("brand_tagline") || undefined,
    logo_url: formData.get("logo_url") || undefined,
    settings: formData.get("settings") ? JSON.parse(formData.get("settings") as string) : undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields." };
  }

  const { id, ...patch } = parsed.data;

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, parsed.data.id, ["owner", "admin"]);

    const admin = getAdminSupabase();
    await updateOrganization(admin, parsed.data.id, patch);

    revalidatePath("/dashboard/organizations");
    revalidatePath(`/dashboard/organizations/${parsed.data.id}`);
    return { ok: true, message: "Organization updated." };
  } catch (e) {
    if (isOrgAccessError(e)) {
      return { ok: false, error: mapAccessError(e) };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not update organization." };
  }
}

// --- Delete Organization -----------------------------------------------------

const deleteOrgSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteOrgAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = deleteOrgSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Invalid organization ID." };

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, parsed.data.id, ["owner"]);

    const admin = getAdminSupabase();
    await deleteOrganization(admin, parsed.data.id);

    revalidatePath("/dashboard/organizations");
    return { ok: true, message: "Organization deleted." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete organization." };
  }
}

// --- List Members ------------------------------------------------------------

export async function listOrgMembersAction(orgId: string): Promise<ActionResult<{ members: OrganizationMemberListItem[] }>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, orgId, ["owner", "admin", "member", "viewer"]);

    const admin = getAdminSupabase();
    const { listOrgMembers } = await import("./server");
    const members = await listOrgMembers(admin, orgId);
    return { ok: true, data: { members } };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not load members." };
  }
}

// --- Invite Member -----------------------------------------------------------

const inviteMemberSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export async function inviteOrgMemberAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ invitationId: string; token: string }>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = inviteMemberSchema.safeParse({
    orgId: formData.get("orgId"),
    email: formData.get("email"),
    role: formData.get("role") || "member",
  });

  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, parsed.data.orgId, ["owner", "admin"]);

    const admin = getAdminSupabase();
    const { inviteOrgMember } = await import("./server");
    const { invitation, token } = await inviteOrgMember(admin, parsed.data.orgId, userId, {
      email: parsed.data.email,
      role: parsed.data.role,
    });

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/members`);
    return { ok: true, data: { invitationId: invitation.id, token }, message: "Invitation sent." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not send invitation." };
  }
}

// --- Remove Member -----------------------------------------------------------

const removeMemberSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function removeOrgMemberAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = removeMemberSchema.safeParse({
    orgId: formData.get("orgId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, parsed.data.orgId, ["owner", "admin"]);

    const admin = getAdminSupabase();
    await removeOrgMember(admin, parsed.data.orgId, parsed.data.userId, userId);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/members`);
    return { ok: true, message: "Member removed." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove member." };
  }
}

// --- Transfer Ownership ------------------------------------------------------

const transferSchema = z.object({
  orgId: z.string().uuid(),
  newOwnerId: z.string().uuid(),
});

export async function transferOwnershipAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = transferSchema.safeParse({
    orgId: formData.get("orgId"),
    newOwnerId: formData.get("newOwnerId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, parsed.data.orgId, ["owner"]);

    const admin = getAdminSupabase();
    await transferOwnership(admin, parsed.data.orgId, parsed.data.newOwnerId, userId);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}`);
    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/members`);
    return { ok: true, message: "Ownership transferred." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not transfer ownership." };
  }
}

// --- Update Member Role ------------------------------------------------------

const updateMemberRoleSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["admin", "member", "viewer"]),
});

export async function updateOrgMemberRoleAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = updateMemberRoleSchema.safeParse({
    orgId: formData.get("orgId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, parsed.data.orgId, ["owner", "admin"]);

    const admin = getAdminSupabase();
    await updateOrgMemberRole(admin, parsed.data.orgId, parsed.data.userId, parsed.data.role, userId);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}`);
    return { ok: true, message: "Member role updated." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not update member role." };
  }
}

// --- Project Collaborators ---------------------------------------------------

const addCollaboratorSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["lead", "member", "viewer"]).default("member"),
});

export async function addProjectCollaboratorAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = addCollaboratorSchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    role: formData.get("role") || "member",
  });

  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { addProjectMember } = await import("./server");
    await addProjectMember(admin, parsed.data.projectId, userId, {
      userId: parsed.data.userId,
      role: parsed.data.role,
    });

    revalidatePath(`/dashboard/projects/${parsed.data.projectId}/collaborators`);
    return { ok: true, message: "Collaborator added." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not add collaborator." };
  }
}

export async function removeProjectCollaboratorAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = z
    .object({ projectId: z.string().uuid(), userId: z.string().uuid() })
    .safeParse({ projectId: formData.get("projectId"), userId: formData.get("userId") });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    const { removeProjectMember } = await import("./server");
    await removeProjectMember(admin, parsed.data.projectId, userId, parsed.data.userId);

    revalidatePath(`/dashboard/projects/${parsed.data.projectId}/collaborators`);
    return { ok: true, message: "Collaborator removed." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: mapAccessError(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove collaborator." };
  }
}

export async function listProjectCollaboratorsAction(projectId: string): Promise<ActionResult<{ collaborators: ProjectCollaboratorListItem[] }>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  try {
    const { listProjectMembers } = await import("./server");
    const collaborators = await listProjectMembers(admin, projectId);
    return { ok: true, data: { collaborators } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load collaborators." };
  }
}

// --- Project Costs (for profitability) ---------------------------------------

const addCostSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().trim().min(1).max(500).optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().length(3).default("INR"),
  costDate: z.string().optional(),
  category: z.string().max(50).optional(),
});

export async function addProjectCostAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = addCostSchema.safeParse({
    projectId: formData.get("projectId"),
    description: formData.get("description") || undefined,
    amount: formData.get("amount"),
    currency: formData.get("currency") || "INR",
    costDate: formData.get("costDate") || undefined,
    category: formData.get("category") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Verify user owns the project
  const { data: project } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", parsed.data.projectId)
    .maybeSingle();

  if (!project || project.user_id !== userId) {
    return { ok: false, error: "Only the project owner can add costs." };
  }

  try {
    const { data: compData, error: compErr } = await admin
      .from("project_costs")
      .insert({
        project_id: parsed.data.projectId,
        user_id: userId,
        description: parsed.data.description ?? null,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        cost_date: parsed.data.costDate ?? new Date().toISOString(),
        category: parsed.data.category ?? null,
      })
      .select("id")
      .single();

    if (compErr || !compData) {
      return { ok: false, error: compErr?.message ?? "Could not add cost." };
    }

    revalidatePath(`/dashboard/projects/${parsed.data.projectId}/profitability`);
    return { ok: true, data: { id: compData.id }, message: "Cost added." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add cost." };
  }
}

export async function listProjectCostsAction(projectId: string): Promise<ActionResult<{ costs: ProjectCostRow[] }>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();
  // Verify user owns the project
  const { data: project } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || project.user_id !== userId) {
    return { ok: false, error: "Project not found or access denied." };
  }

  try {
    const { data, error } = await admin
      .from("project_costs")
      .select("*")
      .eq("project_id", projectId)
      .order("cost_date", { ascending: false });

    if (error) return { ok: false, error: error.message };

    return { ok: true, data: { costs: data ?? [] } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load costs." };
  }
}

export async function deleteProjectCostAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  const parsed = z
    .object({ id: z.string().uuid() })
    .safeParse({ id: formData.get("id") });

  if (!parsed.success) return { ok: false, error: "Invalid cost ID." };

  try {
    // Verify ownership via project
    const { data: cost } = await admin
      .from("project_costs")
      .select("project_id")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!cost) return { ok: false, error: "Cost not found." };

    const { data: project } = await admin
      .from("projects")
      .select("user_id")
      .eq("id", cost.project_id)
      .maybeSingle();

    if (!project || project.user_id !== userId) {
      return { ok: false, error: "Access denied." };
    }

    const { error } = await admin
      .from("project_costs")
      .delete()
      .eq("id", parsed.data.id);

    if (error) return { ok: false, error: error.message };

    return { ok: true, message: "Cost deleted." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete cost." };
  }
}

// --- Project Profitability ---------------------------------------------------

export async function getProjectProfitabilityAction(projectId: string): Promise<ActionResult<{
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  costsByCategory: Record<string, number>;
  costsByMember: Record<string, { name: string; email: string; total: number }>;
}>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  try {
    // Verify user owns the project
    const { data: project } = await admin
      .from("projects")
      .select("user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project || project.user_id !== userId) {
      return { ok: false, error: "Project not found or access denied." };
    }

    const { calculateProjectProfitability } = await import("./server");
    const profitability = await calculateProjectProfitability(admin, projectId);
    return { ok: true, data: profitability };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not calculate profitability." };
  }
}

export async function getOrgProfitabilityAction(orgId: string): Promise<ActionResult<{
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
}>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(await supabase, orgId, ["owner", "admin"]);

    const { getOrgProfitability } = await import("./server");
    const profitability = await getOrgProfitability(admin, orgId);
    return { ok: true, data: profitability };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not calculate org profitability." };
  }
}

// --- List User's Organizations -----------------------------------------------

export async function listUserOrganizationsAction(): Promise<ActionResult<{ organizations: UserOrganizationListItem[] }>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  try {
    const { getUserOrganizations } = await import("./server");
    const orgs = await getUserOrganizations(admin, userId);
    return { ok: true, data: { organizations: orgs } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load organizations." };
  }
}

// --- Get Org Details ---------------------------------------------------------

export async function getOrgDetailsAction(orgId: string): Promise<ActionResult<{
  org: OrganizationRow;
  member_count: number;
  user_role: OrgRole;
  is_owner: boolean;
}>> {
  const userId = await requireUserId();
  const admin = getAdminSupabase();

  try {
    const { requireOrgAccess } = await import("./server");
    const supabase = await getServerSupabase();
    await requireOrgAccess(supabase, orgId, ["owner", "admin", "member", "viewer"]);

    const { getOrgWithDetails } = await import("./server");
    const details = await getOrgWithDetails(admin, orgId, userId);
    if (!details?.user_role) return { ok: false, error: "Organization not found." };
    return { ok: true, data: { org: details.org, member_count: details.member_count, user_role: details.user_role, is_owner: details.is_owner } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load organization." };
  }
}
