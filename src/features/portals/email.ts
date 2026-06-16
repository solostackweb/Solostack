import "server-only";

/**
 * Portal communication dispatch layer.
 *
 * Each exported function handles one portal event:
 *   1. Fetches the relevant user profiles from the admin client.
 *   2. Renders the correct email template.
 *   3. Calls `dispatchDelivery` (rate-limiting, idempotency, suppression).
 *   4. Inserts an in-app notification for the other party.
 *
 * All functions are fire-and-forget (never throw to the caller) — a failed
 * email or notification must never block the primary mutation.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { dispatchDelivery } from "@/features/email/send";
import { buildEmailBrand } from "@/features/email/templates";
import {
  renderPortalUpdatePostedEmail,
  renderPortalMeetingRequestedEmail,
  renderPortalMeetingConfirmedEmail,
  renderPortalUpdateApprovedEmail,
  renderPortalRevisionRequestedEmail,
  renderPortalFileUploadedEmail,
  renderPortalWeeklyDigestEmail,
} from "@/features/email/templates";
import { portalClientHome, portalDashboardDetail } from "./routes";

// =============================================================================
// Internal helpers
// =============================================================================

interface PortalCommsContext {
  portalId: string;
  portalName: string;
  /** Owner's Supabase auth user id */
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerBrandColor: string | null;
  ownerBusinessName: string | null;
  ownerLogoUrl: string | null;
  ownerContactEmail: string | null;
  ownerContactPhone: string | null;
  ownerWebsite: string | null;
  /** First non-owner member (the client) */
  clientUserId: string | null;
  clientName: string | null;
  clientEmail: string | null;
}

/**
 * Load the minimum context needed to send portal emails:
 *   - portal row (name, owner_user_id)
 *   - owner profile (name, email, brand)
 *   - first client member's email
 */
async function getPortalCommsContext(
  portalId: string,
): Promise<PortalCommsContext | null> {
  const admin = getAdminSupabase();

  // Portal row
  const { data: portal } = await admin
    .from("portals")
    .select("id, name, owner_user_id")
    .eq("id", portalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!portal) return null;

  const p = portal as { id: string; name: string; owner_user_id: string };

  // Owner profile
  const { data: ownerProfile } = await admin
    .from("user_profiles")
    .select(
      "full_name, email, business_name, brand_color, logo_url, business_email, business_phone, website",
    )
    .eq("user_id", p.owner_user_id)
    .maybeSingle();

  const op = ownerProfile as {
    full_name: string | null;
    email: string | null;
    business_name: string | null;
    brand_color: string | null;
    logo_url: string | null;
    business_email: string | null;
    business_phone: string | null;
    website: string | null;
  } | null;

  // Owner auth email (fallback if profile email is null)
  const { data: ownerAuthUser } = await admin.auth.admin.getUserById(
    p.owner_user_id,
  );
  const ownerAuthEmail =
    ownerAuthUser?.user?.email ?? null;

  const ownerEmail = op?.business_email ?? op?.email ?? ownerAuthEmail;

  // First active client member
  const { data: members } = await admin
    .from("portal_members")
    .select("user_id, role")
    .eq("portal_id", portalId)
    .is("revoked_at", null)
    .neq("role", "owner")
    .limit(1);

  const clientMember = (members ?? [])[0] as
    | { user_id: string; role: string }
    | undefined;

  let clientUserId: string | null = null;
  let clientName: string | null = null;
  let clientEmail: string | null = null;

  if (clientMember) {
    clientUserId = clientMember.user_id;
    const { data: clientProfile } = await admin
      .from("user_profiles")
      .select("full_name, email")
      .eq("user_id", clientUserId)
      .maybeSingle();
    const cp = clientProfile as { full_name: string | null; email: string | null } | null;
    // Also try auth user email
    const { data: clientAuthUser } = await admin.auth.admin.getUserById(clientUserId);
    clientName = cp?.full_name ?? null;
    clientEmail = cp?.email ?? clientAuthUser?.user?.email ?? null;
  }

  return {
    portalId: p.id,
    portalName: p.name,
    ownerUserId: p.owner_user_id,
    ownerName: op?.full_name ?? op?.business_name ?? "Your freelancer",
    ownerEmail,
    ownerBrandColor: op?.brand_color ?? null,
    ownerBusinessName: op?.business_name ?? null,
    ownerLogoUrl: op?.logo_url ?? null,
    ownerContactEmail: op?.business_email ?? op?.email ?? ownerAuthEmail,
    ownerContactPhone: op?.business_phone ?? null,
    ownerWebsite: op?.website ?? null,
    clientUserId,
    clientName,
    clientEmail,
  };
}

/**
 * Insert an in-app notification for a specific user using the admin client.
 * Never throws — silently drops if the insert fails.
 */
async function notifyUser(
  userId: string,
  notification: { type: string; title: string; message?: string | null },
): Promise<void> {
  try {
    const admin = getAdminSupabase();
    await admin.from("notifications").insert({
      user_id: userId,
      type: notification.type,
      title: notification.title,
      message: notification.message ?? null,
      read: false,
    } as never);
  } catch {
    // Never throw — notification is best-effort
  }
}

// =============================================================================
// Dispatch functions
// =============================================================================

/**
 * Called when the owner posts an update / deliverable.
 * → Email + notification to the client.
 */
export async function dispatchPortalUpdatePostedComms(opts: {
  portalId: string;
  actorUserId: string;
  updateTitle: string;
  updateType: string;
  body: string | null;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    const ctx = await getPortalCommsContext(opts.portalId);
    if (!ctx) return;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${portalClientHome(opts.portalId)}#portal-updates`;

    // In-app notification for the client
    if (ctx.clientUserId) {
      await notifyUser(ctx.clientUserId, {
        type: "portal_update_posted",
        title: `New update: ${opts.updateTitle}`,
        message: `${ctx.ownerName} posted a new update in ${ctx.portalName}.`,
      });
    }

    // Email to client (only if we have their address)
    if (!ctx.clientEmail) return;

    const brand = buildEmailBrand({
      businessName: ctx.ownerBusinessName ?? ctx.ownerName,
      brandColor: ctx.ownerBrandColor,
      logoUrl: ctx.ownerLogoUrl,
      businessEmail: ctx.ownerContactEmail,
      businessPhone: ctx.ownerContactPhone,
      website: ctx.ownerWebsite,
    });

    const rendered = renderPortalUpdatePostedEmail({
      portalName: ctx.portalName,
      clientName: ctx.clientName,
      senderName: ctx.ownerName,
      senderEmail: ctx.ownerEmail ?? undefined,
      updateTitle: opts.updateTitle,
      updateType: opts.updateType,
      body: opts.body,
      portalUrl,
      brand,
    });

    await dispatchDelivery({
      userId: opts.actorUserId,
      kind: "portal_update",
      entityType: "portal",
      entityId: opts.portalId,
      senderType: "connect",
      to: { email: ctx.clientEmail, name: ctx.clientName ?? undefined },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: opts.idempotencyKey ?? null,
      tags: ["portal", "portal_update"],
    });
  } catch {
    // Fire-and-forget — never propagate
  }
}

/**
 * Called when a client (or owner) requests a meeting.
 * → Email + notification to the owner.
 */
export async function dispatchPortalMeetingRequestedComms(opts: {
  portalId: string;
  actorUserId: string;
  requesterName: string | null;
  topic: string;
  proposedTime: string | null;
  notes: string | null;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    const ctx = await getPortalCommsContext(opts.portalId);
    if (!ctx) return;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${portalDashboardDetail(opts.portalId)}#portal-meetings`;

    // In-app notification for the owner
    await notifyUser(ctx.ownerUserId, {
      type: "portal_meeting_requested",
      title: `Meeting requested: ${opts.topic}`,
      message: `${opts.requesterName ?? "Your client"} requested a meeting in ${ctx.portalName}.`,
    });

    if (!ctx.ownerEmail) return;

    const brand = buildEmailBrand({
      businessName: ctx.ownerBusinessName ?? ctx.ownerName,
      brandColor: ctx.ownerBrandColor,
      logoUrl: ctx.ownerLogoUrl,
      businessEmail: ctx.ownerContactEmail,
      businessPhone: ctx.ownerContactPhone,
      website: ctx.ownerWebsite,
    });

    const rendered = renderPortalMeetingRequestedEmail({
      portalName: ctx.portalName,
      ownerName: ctx.ownerName,
      requesterName: opts.requesterName,
      topic: opts.topic,
      proposedTime: opts.proposedTime,
      notes: opts.notes,
      portalUrl,
      brand,
    });

    await dispatchDelivery({
      userId: opts.actorUserId,
      kind: "portal_meeting",
      entityType: "portal",
      entityId: opts.portalId,
      senderType: "connect",
      to: { email: ctx.ownerEmail, name: ctx.ownerName },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: opts.idempotencyKey ?? null,
      tags: ["portal", "portal_meeting"],
    });
  } catch {
    // Fire-and-forget
  }
}

/**
 * Called when the owner confirms a meeting.
 * → Email + notification to the client.
 */
export async function dispatchPortalMeetingConfirmedComms(opts: {
  portalId: string;
  actorUserId: string;
  topic: string;
  proposedTime: string | null;
  meetLink: string | null;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    const ctx = await getPortalCommsContext(opts.portalId);
    if (!ctx) return;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${portalClientHome(opts.portalId)}#portal-meetings`;

    // In-app notification for the client
    if (ctx.clientUserId) {
      await notifyUser(ctx.clientUserId, {
        type: "portal_meeting_confirmed",
        title: `Meeting confirmed: ${opts.topic}`,
        message: `${ctx.ownerName} confirmed your meeting in ${ctx.portalName}.`,
      });
    }

    if (!ctx.clientEmail) return;

    const brand = buildEmailBrand({
      businessName: ctx.ownerBusinessName ?? ctx.ownerName,
      brandColor: ctx.ownerBrandColor,
      logoUrl: ctx.ownerLogoUrl,
      businessEmail: ctx.ownerContactEmail,
      businessPhone: ctx.ownerContactPhone,
      website: ctx.ownerWebsite,
    });

    const rendered = renderPortalMeetingConfirmedEmail({
      portalName: ctx.portalName,
      clientName: ctx.clientName,
      senderName: ctx.ownerName,
      senderEmail: ctx.ownerEmail ?? undefined,
      topic: opts.topic,
      proposedTime: opts.proposedTime,
      meetLink: opts.meetLink,
      portalUrl,
      brand,
    });

    await dispatchDelivery({
      userId: opts.actorUserId,
      kind: "portal_meeting",
      entityType: "portal",
      entityId: opts.portalId,
      senderType: "connect",
      to: { email: ctx.clientEmail, name: ctx.clientName ?? undefined },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: opts.idempotencyKey ?? null,
      tags: ["portal", "portal_meeting", "portal_meeting_confirmed"],
    });
  } catch {
    // Fire-and-forget
  }
}

/**
 * Called when a client approves a deliverable / update.
 * → Email + notification to the owner.
 */
export async function dispatchPortalUpdateApprovedComms(opts: {
  portalId: string;
  actorUserId: string;
  approverName: string | null;
  updateTitle: string;
  comment: string | null;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    const ctx = await getPortalCommsContext(opts.portalId);
    if (!ctx) return;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${portalDashboardDetail(opts.portalId)}#portal-updates`;

    // In-app notification for the owner
    await notifyUser(ctx.ownerUserId, {
      type: "portal_update_approved",
      title: `Approved: ${opts.updateTitle}`,
      message: `${opts.approverName ?? "Your client"} approved "${opts.updateTitle}" in ${ctx.portalName}.`,
    });

    if (!ctx.ownerEmail) return;

    const brand = buildEmailBrand({
      businessName: ctx.ownerBusinessName ?? ctx.ownerName,
      brandColor: ctx.ownerBrandColor,
      logoUrl: ctx.ownerLogoUrl,
      businessEmail: ctx.ownerContactEmail,
      businessPhone: ctx.ownerContactPhone,
      website: ctx.ownerWebsite,
    });

    const rendered = renderPortalUpdateApprovedEmail({
      portalName: ctx.portalName,
      ownerName: ctx.ownerName,
      approverName: opts.approverName,
      updateTitle: opts.updateTitle,
      comment: opts.comment,
      portalUrl,
      brand,
    });

    await dispatchDelivery({
      userId: opts.actorUserId,
      kind: "portal_update",
      entityType: "portal",
      entityId: opts.portalId,
      senderType: "connect",
      to: { email: ctx.ownerEmail, name: ctx.ownerName },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: opts.idempotencyKey ?? null,
      tags: ["portal", "portal_update", "portal_approved"],
    });
  } catch {
    // Fire-and-forget
  }
}

/**
 * Called when a client requests revisions on a deliverable / update.
 * → Email + notification to the owner.
 */
export async function dispatchPortalRevisionRequestedComms(opts: {
  portalId: string;
  actorUserId: string;
  requesterName: string | null;
  updateTitle: string;
  comment: string | null;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    const ctx = await getPortalCommsContext(opts.portalId);
    if (!ctx) return;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${portalDashboardDetail(opts.portalId)}#portal-updates`;

    // In-app notification for the owner
    await notifyUser(ctx.ownerUserId, {
      type: "portal_revision_requested",
      title: `Revision requested: ${opts.updateTitle}`,
      message: `${opts.requesterName ?? "Your client"} requested revisions for "${opts.updateTitle}" in ${ctx.portalName}.`,
    });

    if (!ctx.ownerEmail) return;

    const brand = buildEmailBrand({
      businessName: ctx.ownerBusinessName ?? ctx.ownerName,
      brandColor: ctx.ownerBrandColor,
      logoUrl: ctx.ownerLogoUrl,
      businessEmail: ctx.ownerContactEmail,
      businessPhone: ctx.ownerContactPhone,
      website: ctx.ownerWebsite,
    });

    const rendered = renderPortalRevisionRequestedEmail({
      portalName: ctx.portalName,
      ownerName: ctx.ownerName,
      requesterName: opts.requesterName,
      updateTitle: opts.updateTitle,
      comment: opts.comment,
      portalUrl,
      brand,
    });

    await dispatchDelivery({
      userId: opts.actorUserId,
      kind: "portal_update",
      entityType: "portal",
      entityId: opts.portalId,
      senderType: "connect",
      to: { email: ctx.ownerEmail, name: ctx.ownerName },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: opts.idempotencyKey ?? null,
      tags: ["portal", "portal_update", "portal_revision"],
    });
  } catch {
    // Fire-and-forget
  }
}

/**
 * Called when the owner uploads a file.
 * → Email + notification to the client.
 */
export async function dispatchPortalFileUploadedComms(opts: {
  portalId: string;
  actorUserId: string;
  fileName: string;
  fileCount: number;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    const ctx = await getPortalCommsContext(opts.portalId);
    if (!ctx) return;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${portalClientHome(opts.portalId)}#portal-files`;

    // In-app notification for the client
    if (ctx.clientUserId) {
      await notifyUser(ctx.clientUserId, {
        type: "portal_file_uploaded",
        title: `New file${opts.fileCount > 1 ? "s" : ""} in ${ctx.portalName}`,
        message: `${ctx.ownerName} uploaded "${opts.fileName}" to your portal.`,
      });
    }

    if (!ctx.clientEmail) return;

    const brand = buildEmailBrand({
      businessName: ctx.ownerBusinessName ?? ctx.ownerName,
      brandColor: ctx.ownerBrandColor,
      logoUrl: ctx.ownerLogoUrl,
      businessEmail: ctx.ownerContactEmail,
      businessPhone: ctx.ownerContactPhone,
      website: ctx.ownerWebsite,
    });

    const rendered = renderPortalFileUploadedEmail({
      portalName: ctx.portalName,
      clientName: ctx.clientName,
      senderName: ctx.ownerName,
      senderEmail: ctx.ownerEmail ?? undefined,
      fileName: opts.fileName,
      fileCount: opts.fileCount,
      portalUrl,
      brand,
    });

    await dispatchDelivery({
      userId: opts.actorUserId,
      kind: "portal_file",
      entityType: "portal",
      entityId: opts.portalId,
      senderType: "connect",
      to: { email: ctx.clientEmail, name: ctx.clientName ?? undefined },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: opts.idempotencyKey ?? null,
      tags: ["portal", "portal_file"],
    });
  } catch {
    // Fire-and-forget
  }
}

/**
 * Weekly digest → client. Summarises the last 7 days of activity and emails
 * the client. Skips silently when there's nothing to report (no empty digests)
 * or no client address. Returns whether an email was dispatched.
 */
export async function dispatchPortalWeeklyDigest(opts: {
  portalId: string;
  idempotencyKey: string;
}): Promise<{ sent: boolean }> {
  try {
    const ctx = await getPortalCommsContext(opts.portalId);
    if (!ctx || !ctx.clientEmail) return { sent: false };

    const admin = getAdminSupabase();
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const [updatesRes, filesRes, messagesRes, meetingsRes] = await Promise.all([
      admin
        .from("portal_updates")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", opts.portalId)
        .is("deleted_at", null)
        .gte("created_at", sinceIso),
      admin
        .from("portal_files")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", opts.portalId)
        .is("deleted_at", null)
        .gte("created_at", sinceIso),
      admin
        .from("portal_messages")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", opts.portalId)
        .is("deleted_at", null)
        .neq("author_id", ctx.clientUserId ?? "00000000-0000-0000-0000-000000000000")
        .gte("created_at", sinceIso),
      admin
        .from("portal_meetings")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", opts.portalId)
        .eq("status", "accepted")
        .gte("scheduled_at", nowIso),
    ]);

    const newUpdates = updatesRes.count ?? 0;
    const newFiles = filesRes.count ?? 0;
    const newMessages = messagesRes.count ?? 0;
    const upcomingMeetings = meetingsRes.count ?? 0;

    const facts: { label: string; value: string }[] = [];
    if (newUpdates) facts.push({ label: "New updates", value: String(newUpdates) });
    if (newFiles) facts.push({ label: "Files shared", value: String(newFiles) });
    if (newMessages) facts.push({ label: "New messages", value: String(newMessages) });
    if (upcomingMeetings) facts.push({ label: "Upcoming meetings", value: String(upcomingMeetings) });

    // Nothing happened — don't send an empty digest.
    if (facts.length === 0) return { sent: false };

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${portalClientHome(opts.portalId)}`;
    const brand = buildEmailBrand({
      businessName: ctx.ownerBusinessName ?? ctx.ownerName,
      brandColor: ctx.ownerBrandColor,
      logoUrl: ctx.ownerLogoUrl,
      businessEmail: ctx.ownerContactEmail,
      businessPhone: ctx.ownerContactPhone,
      website: ctx.ownerWebsite,
    });

    const rendered = renderPortalWeeklyDigestEmail({
      portalName: ctx.portalName,
      clientName: ctx.clientName,
      senderName: ctx.ownerName,
      senderEmail: ctx.ownerEmail ?? undefined,
      facts,
      portalUrl,
      brand,
    });

    const res = await dispatchDelivery({
      userId: ctx.ownerUserId,
      kind: "portal_digest",
      entityType: "portal",
      entityId: opts.portalId,
      senderType: "connect",
      to: { email: ctx.clientEmail, name: ctx.clientName ?? undefined },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: opts.idempotencyKey,
      tags: ["portal", "portal_digest"],
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}
