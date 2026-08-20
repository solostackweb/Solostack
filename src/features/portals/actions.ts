"use server";

/**
 * Server actions for the Client Portal.
 *
 * Every action goes through one of two guards:
 *
 *   - `requireFeature("clients.portal")` — paid-plan gate. Free plan
 *     freelancers cannot create or manage portals.
 *   - `requirePortalAccess(portalId, { requireRole: "owner" })` — only
 *     the freelancer who owns the portal can mutate it. Members (clients)
 *     can post messages and view everything they're attached to.
 *
 * RLS is the back-stop, never the only gate.
 */

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendPushToPortal } from "./push";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { requireFeature } from "@/features/subscription/server";
import {
  PortalAccessError,
  recordPortalActivity,
  requirePortalAccess,
} from "./server";
import {
  PORTAL_DASHBOARD_INDEX,
  portalDashboardDetail,
  portalClientHome,
} from "./routes";
import { dispatchDelivery } from "@/features/email/send";
import { getEmailSender } from "@/features/email/senders";
import { env } from "@/config/env";
import { deleteObject } from "@/lib/r2/client";
import { renderPortalInviteEmail } from "@/features/email/templates";
import type { ActionResult } from "@/features/invoices/delivery";
import { acceptPortalInvitation } from "./invitations";
import { BRAND_PRIMARY } from "@/config/brand-colors";

// =============================================================================
// PORTAL CRUD
// =============================================================================

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clientId: z.string().uuid(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export async function createPortalAction(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ portalId: string }>> {
  const sub = await requireFeature("clients.portal");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, email, full_name, business_name")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  const client = clientRow as
    | {
        id: string;
        email: string | null;
        full_name: string | null;
        business_name: string | null;
      }
    | null;
  if (!client) {
    return { ok: false, error: "Client not found." };
  }
  if (!client.email) {
    return {
      ok: false,
      error: "Add an email to the client profile before creating a portal.",
    };
  }

  const { data: existing } = await supabase
    .from("portals")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("client_id", parsed.data.clientId)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1);
  if (existing && existing.length > 0) {
    return {
      ok: false,
      error: "This client already has an active portal.",
    };
  }

  const { data: created, error } = await supabase
    .from("portals")
    .insert({
      owner_user_id: user.id,
      name: parsed.data.name,
      client_id: parsed.data.clientId,
      brand_color: parsed.data.brandColor ?? BRAND_PRIMARY,
    } as never)
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: error?.message ?? "Could not create portal." };
  }
  const portalId = (created as { id: string }).id;

  await recordPortalActivity({
    portalId,
    actorId: user.id,
    type: "portal.created",
    payload: { name: parsed.data.name, plan: sub.plan },
  });

  const invite = await createAndSendPortalInvitation({
    portalId,
    portalName: parsed.data.name,
    clientId: parsed.data.clientId,
    userId: user.id,
    clientName: client.full_name ?? client.business_name ?? undefined,
    email: client.email,
  });

  revalidatePath(PORTAL_DASHBOARD_INDEX);
  revalidatePath(portalDashboardDetail(portalId));

  if (!invite.ok) {
    return {
      ok: true,
      data: { portalId },
      message: `Portal created, but the invitation was not sent: ${invite.error}`,
    };
  }

  return {
    ok: true,
    data: { portalId },
    message: `Portal created and invitation sent to ${client.email}.`,
  };
}

const renameSchema = z.object({
  portalId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
});

export async function renamePortalAction(
  input: z.infer<typeof renameSchema>,
): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await requireFeature("clients.portal");
  const access = await requirePortalAccess(parsed.data.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }

  const supabase = await getServerSupabase();
  await supabase
    .from("portals")
    .update({ name: parsed.data.name } as never)
    .eq("id", parsed.data.portalId);

  await recordPortalActivity({
    portalId: parsed.data.portalId,
    actorId: access.userId,
    type: "portal.renamed",
    payload: { name: parsed.data.name },
  });

  revalidatePath(portalDashboardDetail(parsed.data.portalId));
  return { ok: true, message: "Portal renamed." };
}

export async function archivePortalAction(input: {
  portalId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  // Use the admin client so any RLS misconfiguration is surfaced as a
  // real error rather than a silent 0-row update. We've already validated
  // ownership above, so service-role here is safe.
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("portals")
    .update({ status: "archived" } as never)
    .eq("id", input.portalId);
  if (error) {
    return {
      ok: false,
      error: `Could not deactivate portal: ${error.message}`,
    };
  }
  revalidatePath(PORTAL_DASHBOARD_INDEX);
  revalidatePath(portalDashboardDetail(input.portalId));
  return { ok: true, message: "Portal deactivated." };
}

export async function deletePortalAction(input: {
  portalId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }

  // SOFT delete — the migration (0024) explicitly models deletion as
  // setting `deleted_at` + status="deleted". Hard `.delete()` was prone
  // to FK constraint failures against portal_messages / portal_files /
  // portal_storage_usage and silently no-op'd in some environments. The
  // soft-delete path also lets us restore portals in support situations.
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("portals")
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
    } as never)
    .eq("id", input.portalId);
  if (error) {
    return {
      ok: false,
      error: `Could not delete portal: ${error.message}`,
    };
  }

  revalidatePath(PORTAL_DASHBOARD_INDEX);
  return { ok: true, message: "Portal deleted." };
}

// =============================================================================
// INVITATIONS
// =============================================================================

const inviteSchema = z.object({
  portalId: z.string().uuid(),
  email: z.string().email(),
  /** Optional human name shown in the invite email greeting. */
  name: z.string().trim().min(1).max(120).optional(),
});

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function invitePortalMemberAction(
  input: z.infer<typeof inviteSchema>,
): Promise<ActionResult<{ invitationId: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid email." };

  await requireFeature("clients.portal");
  const access = await requirePortalAccess(parsed.data.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }

  if (!access.portal.client_id) {
    return {
      ok: false,
      error: "This portal is not linked to a client yet.",
    };
  }

  const result = await createAndSendPortalInvitation({
    portalId: parsed.data.portalId,
    portalName: access.portal.name,
    clientId: access.portal.client_id,
    userId: access.userId,
    email: parsed.data.email,
    clientName: parsed.data.name,
  });

  if (result.ok) revalidatePath(portalDashboardDetail(parsed.data.portalId));
  return result;
}

const acceptSchema = z.object({ token: z.string().min(8) });

/**
 * Called by /portal/accept after the recipient signs in. Materialises a
 * portal_members row from a pending invitation. Idempotent — replaying
 * the same token after acceptance returns ok=true with `alreadyMember`.
 */
export async function acceptPortalInvitationAction(
  input: z.infer<typeof acceptSchema>,
): Promise<ActionResult<{ portalId: string; alreadyMember: boolean }>> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid token." };
  return acceptPortalInvitation(parsed.data.token, { revalidate: true });
}

export async function revokePortalMemberAction(input: {
  portalId: string;
  userId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  if (input.userId === access.userId) {
    return { ok: false, error: "You can't revoke yourself." };
  }
  const admin = getAdminSupabase();
  await admin
    .from("portal_members")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("portal_id", input.portalId)
    .eq("user_id", input.userId);
  await recordPortalActivity({
    portalId: input.portalId,
    actorId: access.userId,
    type: "portal.member_revoked",
    payload: { userId: input.userId },
  });
  revalidatePath(portalDashboardDetail(input.portalId));
  return { ok: true, message: "Member revoked." };
}

// =============================================================================
// ATTACH / DETACH PROPOSALS + CONTRACTS + INVOICES
// =============================================================================

export async function attachProposalToPortalAction(input: {
  portalId: string;
  proposalId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, user_id, title, status")
    .eq("id", input.proposalId)
    .maybeSingle();
  const p = proposal as
    | { id: string; user_id: string; title: string; status: string }
    | null;
  if (!p || p.user_id !== access.userId || p.status === "draft") {
    return { ok: false, error: "Proposal not found." };
  }

  await supabase
    .from("portal_proposals")
    .upsert(
      {
        portal_id: input.portalId,
        proposal_id: input.proposalId,
        added_by: access.userId,
      } as never,
      { onConflict: "portal_id,proposal_id" },
    );
  await recordPortalActivity({
    portalId: input.portalId,
    actorId: access.userId,
    type: "proposal.attached",
    payload: { proposalId: input.proposalId, title: p.title },
  });
  revalidatePath(portalDashboardDetail(input.portalId));
  revalidatePath(portalClientHome(input.portalId));
  return { ok: true, message: "Proposal attached." };
}

export async function detachProposalFromPortalAction(input: {
  portalId: string;
  proposalId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();
  await supabase
    .from("portal_proposals")
    .delete()
    .eq("portal_id", input.portalId)
    .eq("proposal_id", input.proposalId);
  revalidatePath(portalDashboardDetail(input.portalId));
  revalidatePath(portalClientHome(input.portalId));
  return { ok: true };
}

export async function attachContractToPortalAction(input: {
  portalId: string;
  contractId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();

  // Verify the contract belongs to this freelancer.
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, user_id, title")
    .eq("id", input.contractId)
    .maybeSingle();
  const c = contract as { id: string; user_id: string; title: string } | null;
  if (!c || c.user_id !== access.userId) {
    return { ok: false, error: "Contract not found." };
  }

  await supabase
    .from("portal_contracts")
    .upsert(
      {
        portal_id: input.portalId,
        contract_id: input.contractId,
        added_by: access.userId,
      } as never,
      { onConflict: "portal_id,contract_id" },
    );
  await recordPortalActivity({
    portalId: input.portalId,
    actorId: access.userId,
    type: "contract.attached",
    payload: { contractId: input.contractId, title: c.title },
  });
  revalidatePath(portalDashboardDetail(input.portalId));
  revalidatePath(portalClientHome(input.portalId));
  return { ok: true, message: "Contract attached." };
}

export async function detachContractFromPortalAction(input: {
  portalId: string;
  contractId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();
  await supabase
    .from("portal_contracts")
    .delete()
    .eq("portal_id", input.portalId)
    .eq("contract_id", input.contractId);
  revalidatePath(portalDashboardDetail(input.portalId));
  return { ok: true };
}

export async function attachInvoiceToPortalAction(input: {
  portalId: string;
  invoiceId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, user_id, invoice_number")
    .eq("id", input.invoiceId)
    .maybeSingle();
  const inv = invoice as
    | { id: string; user_id: string; invoice_number: string }
    | null;
  if (!inv || inv.user_id !== access.userId) {
    return { ok: false, error: "Invoice not found." };
  }
  await supabase
    .from("portal_invoices")
    .upsert(
      {
        portal_id: input.portalId,
        invoice_id: input.invoiceId,
        added_by: access.userId,
      } as never,
      { onConflict: "portal_id,invoice_id" },
    );
  await recordPortalActivity({
    portalId: input.portalId,
    actorId: access.userId,
    type: "invoice.attached",
    payload: { invoiceId: input.invoiceId, number: inv.invoice_number },
  });
  revalidatePath(portalDashboardDetail(input.portalId));
  revalidatePath(portalClientHome(input.portalId));
  return { ok: true, message: "Invoice attached." };
}

export async function detachInvoiceFromPortalAction(input: {
  portalId: string;
  invoiceId: string;
}): Promise<ActionResult> {
  await requireFeature("clients.portal");
  const access = await requirePortalAccess(input.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();
  await supabase
    .from("portal_invoices")
    .delete()
    .eq("portal_id", input.portalId)
    .eq("invoice_id", input.invoiceId);
  revalidatePath(portalDashboardDetail(input.portalId));
  return { ok: true };
}

// =============================================================================
// MESSAGES (chat)
// =============================================================================

const messageSchema = z.object({
  portalId: z.string().uuid(),
  body: z.string().trim().min(1).max(8000),
  parentId: z.string().uuid().optional(),
});

export async function postPortalMessageAction(
  input: z.infer<typeof messageSchema>,
): Promise<ActionResult<{ messageId: string }>> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Message must be 1–8000 characters." };
  }
  const access = await requirePortalAccess(parsed.data.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }

  const supabase = await getServerSupabase();
  const { data: row, error } = await supabase
    .from("portal_messages")
    .insert({
      portal_id: parsed.data.portalId,
      author_id: access.userId,
      parent_id: parsed.data.parentId ?? null,
      body: parsed.data.body,
    } as never)
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: error?.message ?? "Could not post message." };
  }
  const messageId = (row as { id: string }).id;

  await recordPortalActivity({
    portalId: parsed.data.portalId,
    actorId: access.userId,
    type: "message.posted",
    payload: { messageId, preview: parsed.data.body.slice(0, 80) },
  });

  // Fire-and-forget push to the other side (no-ops if push isn't configured).
  void sendPushToPortal(parsed.data.portalId, access.userId, {
    title: "New message",
    body: parsed.data.body.slice(0, 120),
    url: portalClientHome(parsed.data.portalId) + "/chat",
    tag: `portal-chat-${parsed.data.portalId}`,
  });

  revalidatePath(portalClientHome(parsed.data.portalId));
  revalidatePath(portalDashboardDetail(parsed.data.portalId));
  return { ok: true, data: { messageId } };
}

// =============================================================================
// READ RECEIPTS — mark the current member's last_read_at for a portal
// =============================================================================

export async function markPortalReadAction(input: {
  portalId: string;
}): Promise<ActionResult<{ at: string }>> {
  const access = await requirePortalAccess(input.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const at = new Date().toISOString();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("portal_members")
    .update({ last_read_at: at } as never)
    .eq("portal_id", input.portalId)
    .eq("user_id", access.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { at } };
}

// =============================================================================
// ONBOARDING — owner sets a welcome video + message for the client
// =============================================================================

const onboardingSchema = z.object({
  portalId: z.string().uuid(),
  welcomeVideoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  welcomeMessage: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updatePortalOnboardingAction(
  input: z.infer<typeof onboardingSchema>,
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const access = await requirePortalAccess(parsed.data.portalId, {
    requireRole: "owner",
  }).catch((e) => e as PortalAccessError);
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("portals")
    .update({
      welcome_video_url: parsed.data.welcomeVideoUrl || null,
      welcome_message: parsed.data.welcomeMessage || null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.portalId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(portalClientHome(parsed.data.portalId));
  revalidatePath(portalDashboardDetail(parsed.data.portalId));
  return { ok: true, message: "Onboarding updated." };
}

// =============================================================================
// VISIT MARKER — update last_seen_at (powers "what's new since last visit")
// =============================================================================

export async function markPortalSeenAction(input: {
  portalId: string;
}): Promise<ActionResult> {
  const access = await requirePortalAccess(input.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("portal_members")
    .update({ last_seen_at: new Date().toISOString() } as never)
    .eq("portal_id", input.portalId)
    .eq("user_id", access.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// =============================================================================
// FILES — soft-delete (the upload + commit flow lives in the route handlers
// since presigning + R2 PUT happens on the client).
// =============================================================================

export async function deletePortalFileAction(input: {
  portalId: string;
  fileId: string;
}): Promise<ActionResult> {
  const access = await requirePortalAccess(input.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: accessErrorMessage(access) };
  }

  const admin = getAdminSupabase();
  const { data: fileRow } = await admin
    .from("portal_files")
    .select("id, uploaded_by, r2_key, name, portal_id")
    .eq("id", input.fileId)
    .eq("portal_id", input.portalId)
    .maybeSingle();
  const file = fileRow as
    | { id: string; uploaded_by: string; r2_key: string; name: string }
    | null;
  if (!file) return { ok: false, error: "File not found." };

  // Only the uploader OR the portal owner can delete a file. Members
  // can't nuke the freelancer's deliverables.
  if (access.role !== "owner" && file.uploaded_by !== access.userId) {
    return { ok: false, error: "You can only delete your own uploads." };
  }

  await admin
    .from("portal_files")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", input.fileId);

  // Best-effort R2 cleanup. We don't fail the action if R2 is down — the
  // soft-delete row is the source of truth, and a periodic GC will reap
  // any orphaned objects later.
  try {
    await deleteObject(file.r2_key);
  } catch {
    /* swallow — see comment above */
  }

  await recordPortalActivity({
    portalId: input.portalId,
    actorId: access.userId,
    type: "file.deleted",
    payload: { fileId: file.id, name: file.name },
  });

  revalidatePath(portalClientHome(input.portalId));
  revalidatePath(portalDashboardDetail(input.portalId));
  return { ok: true, message: "File deleted." };
}

// =============================================================================
// helpers
// =============================================================================

function accessErrorMessage(err: PortalAccessError): string {
  switch (err.code) {
    case "unauthenticated":
      return "Please sign in.";
    case "forbidden":
      return "You don't have permission to do that.";
    case "not_found":
      return "Portal not found.";
  }
}

async function createAndSendPortalInvitation(input: {
  portalId: string;
  portalName: string;
  clientId: string;
  userId: string;
  email: string;
  clientName?: string | null;
}): Promise<ActionResult<{ invitationId: string }>> {
  const admin = getAdminSupabase();
  const { data: clientRow } = await admin
    .from("clients")
    .select("email")
    .eq("id", input.clientId)
    .maybeSingle();
  const clientEmail =
    (clientRow as { email: string | null } | null)?.email ?? null;
  if (!clientEmail) {
    return {
      ok: false,
      error: "Add an email to the client profile before inviting.",
    };
  }
  if (clientEmail.toLowerCase() !== input.email.toLowerCase()) {
    return {
      ok: false,
      error: "Invite must be sent to the client email on file.",
    };
  }

  const [{ data: activeMember }, { data: activeInvite }] = await Promise.all([
    admin
      .from("portal_members")
      .select("user_id")
      .eq("portal_id", input.portalId)
      .is("revoked_at", null)
      .limit(1),
    admin
      .from("portal_invitations")
      .select("id")
      .eq("portal_id", input.portalId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1),
  ]);

  if (activeMember && activeMember.length > 0) {
    return {
      ok: false,
      error: "This portal already has a client assigned.",
    };
  }

  if (activeInvite && activeInvite.length > 0) {
    return {
      ok: false,
      error: "There is already a pending invitation for this portal.",
    };
  }

  const tokenPlain = crypto.randomBytes(24).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(tokenPlain).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { data: invRow, error } = await admin
    .from("portal_invitations")
    .insert({
      portal_id: input.portalId,
      email: input.email.toLowerCase(),
      token_hash: tokenHash,
      invited_by: input.userId,
      expires_at: expiresAt,
    } as never)
    .select("id")
    .single();
  if (error || !invRow) {
    return { ok: false, error: error?.message ?? "Could not create invitation." };
  }
  const invitationId = (invRow as { id: string }).id;

  const { data: profile } = await admin
    .from("user_profiles")
    .select("business_name, legal_name, full_name, email")
    .eq("id", input.userId)
    .maybeSingle();
  const p = profile as
    | {
        business_name?: string | null;
        legal_name?: string | null;
        full_name?: string | null;
        email?: string | null;
      }
    | null;
  const senderName =
    p?.business_name ?? p?.legal_name ?? p?.full_name ?? "Stackivo";

  const acceptUrl = `${env.appUrl.replace(/\/$/, "")}/portal/accept?token=${encodeURIComponent(
    tokenPlain,
  )}`;

  const rendered = renderPortalInviteEmail({
    portalName: input.portalName,
    clientName: input.clientName ?? null,
    senderName,
    senderEmail: getEmailSender("share").email,
    acceptUrl,
    expiresIso: expiresAt,
  });

  const delivery = await dispatchDelivery({
    userId: input.userId,
    kind: "portal_invite",
    entityType: "system",
    senderType: "share",
    entityId: input.portalId,
    to: { email: input.email, name: input.clientName ?? undefined },
    replyTo: p?.email ? { email: p.email, name: senderName } : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    metadata: { portalId: input.portalId, invitationId },
    tags: ["portal", "invite"],
    idempotencyKey: `portal-invite:${invitationId}`,
  });

  if (!delivery.ok) {
    await admin.from("portal_invitations").delete().eq("id", invitationId);
    await recordPortalActivity({
      portalId: input.portalId,
      actorId: input.userId,
      type: "portal.invite_failed",
      payload: {
        email: input.email,
        deliveryError: delivery.error,
      },
    });
    return {
      ok: false,
      error: `Could not send invitation: ${delivery.error}`,
    };
  }

  await recordPortalActivity({
    portalId: input.portalId,
    actorId: input.userId,
    type: "portal.member_invited",
    payload: {
      email: input.email,
      deliveryStatus: "sent",
    },
  });

  return {
    ok: true,
    data: { invitationId },
    message: `Invitation sent to ${input.email}.`,
  };
}
