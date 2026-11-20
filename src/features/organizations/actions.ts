"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { isOrgAccessError, requireOrgAccess } from "./server";
import { getOrgSubscription, listOrgInvitations, cancelOrgInvitation, resendOrgInvitation, updateOrgSettings, listOrgApiKeys, createOrgApiKey, deleteOrgApiKey, listOrgWebhooks, createOrgWebhook, updateOrgWebhook, deleteOrgWebhook, listOrgActivity, revokeAllOrgSessions, deleteOrg } from "./subscription";

/**
 * Switch the current organization for the user.
 * Sets the organization cookie and verifies the user is a member.
 */
export async function switchOrganizationAction(orgId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await requireOrgAccess(supabase, orgId, ["owner", "admin", "member", "viewer"]);
    
    // Set the cookie
    const cookieStore = await cookies();
    cookieStore.set("stackivo_current_org_id", orgId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    if (isOrgAccessError(e)) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Failed to switch organization" };
  }
}

/**
 * Get the current organization ID from cookie.
 */
export async function getCurrentOrganizationIdAction(): Promise<{ ok: boolean; orgId?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("stackivo_current_org_id")?.value;
  return { ok: true, orgId };
}

/**
 * Get the organization's subscription.
 */
export async function getOrgSubscriptionAction(orgId: string): Promise<{
  ok: boolean;
  subscription?: {
    plan: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    razorpaySubscriptionId: string | null;
  } | null;
  error?: string;
}> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await requireOrgAccess(supabase, orgId, ["owner", "admin", "member", "viewer"]);
    
    const subscription = await getOrgSubscription(orgId);
    return { ok: true, subscription };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load subscription" };
  }
}

/**
 * List pending organization invitations.
 */
export async function listOrgInvitationsAction(orgId: string): Promise<{
  ok: boolean;
  invitations?: Array<{
    id: string;
    email: string;
    role: string;
    expires_at: string;
    invited_by_name: string;
    invited_by_email: string;
    created_at: string;
  }>;
  error?: string;
}> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await requireOrgAccess(supabase, orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    const invitations = await listOrgInvitations(admin, orgId);
    return { ok: true, invitations };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load invitations" };
  }
}
/**
 * Cancel a pending organization invitation.
 */
export async function cancelOrgInvitationAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    invitationId: z.string().uuid(),
  }).safeParse({
    orgId: formData.get("orgId"),
    invitationId: formData.get("invitationId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    await cancelOrgInvitation(admin, parsed.data.orgId, parsed.data.invitationId, user.id);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}`);
    return { ok: true, message: "Invitation cancelled." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to cancel invitation" };
  }
}

/**
 * Resend a pending organization invitation.
 */
export async function resendOrgInvitationAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ token: string }>> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    invitationId: z.string().uuid(),
  }).safeParse({
    orgId: formData.get("orgId"),
    invitationId: formData.get("invitationId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    const { token } = await resendOrgInvitation(admin, parsed.data.orgId, parsed.data.invitationId, user.id);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}`);
    return { ok: true, data: { token }, message: "Invitation resent." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to resend invitation" };
  }
}

/**
 * Update organization settings.
 */
export async function updateOrgSettingsAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    settings: z.record(z.unknown()),
  }).safeParse({
    orgId: formData.get("orgId"),
    settings: formData.get("settings") ? JSON.parse(formData.get("settings") as string) : {},
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    await updateOrgSettings(admin, parsed.data.orgId, parsed.data.settings, user.id);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/settings`);
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save settings" };
  }
}

/**
 * List organization API keys.
 */
export async function listOrgApiKeysAction(orgId: string): Promise<ActionResult<{ apiKeys: Array<{
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  scopes: string[];
}> }>> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await requireOrgAccess(supabase, orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    const apiKeys = await listOrgApiKeys(admin, orgId);
    return { ok: true, data: { apiKeys } };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load API keys" };
  }
}

/**
 * Create organization API key.
 */
export async function createOrgApiKeyAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string; key_prefix: string; key: string; scopes: string[] }>> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    name: z.string().min(1).max(100),
    scopes: z.array(z.string()).min(1),
  }).safeParse({
    orgId: formData.get("orgId"),
    name: formData.get("name"),
    scopes: formData.get("scopes") ? JSON.parse(formData.get("scopes") as string) : [],
  });

  if (!parsed.success) return { ok: false, error: "Invalid input.", fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    const apiKey = await createOrgApiKey(admin, parsed.data.orgId, user.id, {
      name: parsed.data.name,
      scopes: parsed.data.scopes,
    });

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/settings`);
    return { ok: true, data: apiKey, message: "API key created." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create API key" };
  }
}

/**
 * Delete organization API key.
 */
export async function deleteOrgApiKeyAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    keyId: z.string().uuid(),
  }).safeParse({
    orgId: formData.get("orgId"),
    keyId: formData.get("keyId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    await deleteOrgApiKey(admin, parsed.data.orgId, parsed.data.keyId, user.id);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/settings`);
    return { ok: true, message: "API key deleted." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete API key" };
  }
}

/**
 * List organization webhooks.
 */
export async function listOrgWebhooksAction(orgId: string): Promise<ActionResult<{ webhooks: Array<{
  id: string;
  url: string;
  events: string[];
  status: string;
  created_at: string;
  secret_prefix: string;
}> }>> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await requireOrgAccess(supabase, orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    const webhooks = await listOrgWebhooks(admin, orgId);
    return { ok: true, data: { webhooks } };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load webhooks" };
  }
}

/**
 * Create organization webhook.
 */
export async function createOrgWebhookAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string; events: string[]; status: string; secret: string }>> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    url: z.string().url(),
    events: z.array(z.string()).min(1),
  }).safeParse({
    orgId: formData.get("orgId"),
    url: formData.get("url"),
    events: formData.get("events") ? JSON.parse(formData.get("events") as string) : [],
  });

  if (!parsed.success) return { ok: false, error: "Invalid input.", fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    const webhook = await createOrgWebhook(admin, parsed.data.orgId, user.id, {
      url: parsed.data.url,
      events: parsed.data.events,
    });

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/settings`);
    return { ok: true, data: webhook, message: "Webhook created." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create webhook" };
  }
}

/**
 * Update organization webhook.
 */
export async function updateOrgWebhookAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    webhookId: z.string().uuid(),
    url: z.string().url().optional(),
    events: z.array(z.string()).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  }).safeParse({
    orgId: formData.get("orgId"),
    webhookId: formData.get("webhookId"),
    url: formData.get("url") || undefined,
    events: formData.get("events") ? JSON.parse(formData.get("events") as string) : undefined,
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    await updateOrgWebhook(admin, parsed.data.orgId, parsed.data.webhookId, user.id, {
      url: parsed.data.url,
      events: parsed.data.events,
      status: parsed.data.status,
    });

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/settings`);
    return { ok: true, message: "Webhook updated." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update webhook" };
  }
}

/**
 * Delete organization webhook.
 */
export async function deleteOrgWebhookAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
    webhookId: z.string().uuid(),
  }).safeParse({
    orgId: formData.get("orgId"),
    webhookId: formData.get("webhookId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    await deleteOrgWebhook(admin, parsed.data.orgId, parsed.data.webhookId, user.id);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/settings`);
    return { ok: true, message: "Webhook deleted." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete webhook" };
  }
}

/**
 * List organization activity.
 */
export async function listOrgActivityAction(
  orgId: string,
  options: { page?: number; limit?: number; actor?: string; action?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<ActionResult<{ items: Array<{
  id: string;
  action: string;
  actor_name: string;
  actor_email: string;
  target_type: string;
  target_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
}>; total: number }>> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await requireOrgAccess(supabase, orgId, ["owner", "admin"]);
    
    const admin = getAdminSupabase();
    const result = await listOrgActivity(admin, orgId, options);
    return { ok: true, data: result };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load activity" };
  }
}

/**
 * Revoke all sessions for organization members.
 */
export async function revokeAllOrgSessionsAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
  }).safeParse({
    orgId: formData.get("orgId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner"]);
    
    const admin = getAdminSupabase();
    await revokeAllOrgSessions(admin, parsed.data.orgId, user.id);

    revalidatePath(`/dashboard/organizations/${parsed.data.orgId}/settings`);
    return { ok: true, message: "All sessions revoked." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to revoke sessions" };
  }
}

/**
 * Delete organization.
 */
export async function deleteOrgAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = z.object({
    orgId: z.string().uuid(),
  }).safeParse({
    orgId: formData.get("orgId"),
  });

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await requireOrgAccess(supabase, parsed.data.orgId, ["owner"]);
    
    const admin = getAdminSupabase();
    await deleteOrg(admin, parsed.data.orgId, user.id);

    revalidatePath("/dashboard/organizations");
    return { ok: true, message: "Organization deleted." };
  } catch (e) {
    if (isOrgAccessError(e)) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete organization" };
  }
}
