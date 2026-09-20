"use server";

/**
 * Server actions for project CRUD.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { coerceFormValues } from "@/lib/form";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  projectCrudSchema,
  projectIdSchema,
  projectStatusSchema,
} from "./server-schemas";
import { recordActivity } from "@/features/activity/server";
import { createNotification } from "@/features/notifications/server";
import {
  PROJECT_STATUS_LABEL,
  shouldNotifyOnEnter,
} from "./status";
import type { ProjectStatusRow } from "@/lib/supabase/types";
import { getAdminSupabase } from "@/lib/supabase/admin";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

function parse(formData: FormData) {
  return projectCrudSchema.safeParse(
    coerceFormValues({
      name: formData.get("name"),
      description: formData.get("description"),
      clientId: formData.get("clientId"),
      status: formData.get("status") ?? "planning",
      startDate: formData.get("startDate"),
      dueDate: formData.get("dueDate"),
      billingEnabled: formData.get("billingEnabled") ?? "false",
      hourlyRate: formData.get("hourlyRate") ?? 0,
    }),
  );
}

/**
 * Trigger a review request when a project is completed.
 * Finds the client's portal, links the project, and sends email notification.
 */
async function triggerReviewRequest(
  projectId: string,
  clientId: string,
  userId: string,
  projectName: string,
): Promise<void> {
  const admin = getAdminSupabase();

  // Find the portal for this client
  const { data: portal } = await admin
    .from("portals")
    .select("id, name")
    .eq("owner_user_id", userId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!portal) return;
  const portalId: string = (portal as { id: string; name: string }).id;
  const portalName: string = (portal as { id: string; name: string }).name;

  // Link project to portal (upsert) and set review_invited_at
  await admin
    .from("portal_projects")
    .upsert({
      portal_id: portalId,
      project_id: projectId,
      added_by: userId,
      review_invited_at: new Date().toISOString(),
    } as never, { onConflict: "portal_id,project_id" });

  // Record review request activity
  await admin.from("portal_activity").insert({
    portal_id: portalId,
    actor_id: userId,
    type: "review.requested",
    payload: {
      projectId,
      projectName,
      requestedAt: new Date().toISOString(),
    } as never,
  } as never);

  // Get client user_id from portal_members to send notification
  const { data: member } = await admin
    .from("portal_members")
    .select("user_id")
    .eq("portal_id", portalId)
    .neq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!member) return;
  const clientUserId = (member as { user_id: string }).user_id;

  // Get client profile for email
  const { data: clientProfile } = await admin
    .from("user_profiles")
    .select("email, full_name")
    .eq("id", clientUserId)
    .maybeSingle();

  type ClientProfile = { email: string | null; full_name: string | null } | null;
  const profile = clientProfile as ClientProfile;

  if (!profile?.email) return;
  const clientEmail = profile.email;
  const clientName = profile.full_name;

  // Get freelancer profile for sender info
  const { data: freelancerProfile } = await admin
    .from("user_profiles")
    .select("business_name, legal_name, full_name, email, brand_color, logo_url")
    .eq("id", userId)
    .maybeSingle();

  const freelancer = freelancerProfile as {
    business_name?: string | null;
    legal_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    brand_color?: string | null;
    logo_url?: string | null;
  } | null;

  const senderName = freelancer?.business_name ?? freelancer?.legal_name ?? freelancer?.full_name ?? "Your freelancer";
  const senderEmail = freelancer?.email ?? undefined;

  // Import the email template and send function dynamically to avoid circular deps
  const { renderReviewRequestEmail } = await import("@/features/email/templates");
  const { dispatchDelivery } = await import("@/features/email/send");
  const { getEmailSender } = await import("@/features/email/senders");
  const { env } = await import("@/config/env");

  // Build review URL
  const reviewUrl = `${env.appUrl.replace(/\/$/, "")}/portal/${portalId}?section=reviews`;

  const emailBrand = {
    businessName: senderName,
    logoUrl: freelancer?.logo_url ?? null,
    accent: freelancer?.brand_color ?? null,
    contact: {
      email: freelancer?.email ?? null,
    },
  };

  const rendered = renderReviewRequestEmail({
    portalName,
    clientName,
    senderName,
    senderEmail,
    projectName,
    reviewUrl,
    brand: emailBrand,
  });

  const delivery = await dispatchDelivery({
    userId,
    kind: "review_request",
    entityType: "portal",
    senderType: "share",
    entityId: portalId,
    to: { email: clientEmail, name: clientName ?? undefined },
    replyTo: senderEmail ? { email: senderEmail, name: senderName } : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    metadata: { portalId, projectId, projectName },
    tags: ["portal", "review_request"],
    idempotencyKey: `review-request:${portalId}:${projectId}`,
  });

  if (!delivery.ok) {
    await admin.from("portal_activity").insert({
      portal_id: portalId,
      actor_id: userId,
      type: "review.request_failed",
      payload: {
        projectId,
        projectName,
        deliveryError: delivery.error,
      } as never,
    } as never);
    return;
  }

  await admin.from("portal_activity").insert({
    portal_id: portalId,
    actor_id: userId,
    type: "review.request_sent",
    payload: {
      projectId,
      projectName,
      deliveryStatus: "sent",
    } as never,
  } as never);

  // Also queue in portal_notification_outbox for any future worker
  await admin.from("portal_notification_outbox").insert({
    recipient_id: clientUserId,
    portal_id: portalId,
    event_type: "review.requested",
    payload: {
      projectId,
      projectName,
      portalName,
      portalUrl: `/portal/${portalId}`,
    } as never,
    scheduled_for: new Date().toISOString(),
  } as never);
}

/**
 * Project-completion follow-ups (§30 of the PRD direction).
 *
 * Runs after the review request on `project.completed`:
 *   1. Outstanding invoices → nudge to send final invoice / collect payment.
 *   2. No portfolio item for this project → suggest showcasing it.
 *   3. Referral prompt → invite the freelancer to share their referral link.
 *
 * Best-effort: every step is guarded so a failure never blocks completion.
 */
async function runCompletionFollowUps(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  projectId: string,
  projectName: string,
): Promise<void> {
  try {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, total_amount")
      .eq("project_id", projectId)
      .in("status", ["sent", "viewed", "overdue", "partially_paid"])
      .limit(50);
    const outstanding = (invoices ?? []) as Array<{ id: string; total_amount: number | string | null }>;
    if (outstanding.length > 0) {
      const amount = outstanding.reduce(
        (sum, inv) => sum + Number(inv.total_amount ?? 0),
        0,
      );
      await createNotification({
        type: "project_completion_invoice",
        title: `${projectName}: ${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"} still due`,
        message: `₹${amount.toLocaleString("en-IN")} remains unpaid on this project. Send a final reminder or mark paid from /dashboard/invoices.`,
      });
    }
  } catch {
    /* never block completion */
  }

  try {
    const { data: projectRows } = await supabase
      .from("projects")
      .select("name, description, start_date, due_date, client_id")
      .eq("id", projectId)
      .maybeSingle();
    const project = projectRows as { name: string; description: string | null; client_id: string | null; start_date: string | null; due_date: string | null } | null;
    const { data: clientRows } = await supabase
      .from("clients")
      .select("company_name")
      .eq("id", project?.client_id ?? projectId)
      .maybeSingle();
    const client = clientRows as { company_name: string } | null;

    // Auto-draft a portfolio item from the completed project data.
    const { data: existing } = await supabase
      .from("public_portfolio_items")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .maybeSingle();
    if (!existing && project) {
      const techTags: string[] = [];
      await supabase
        .from("public_portfolio_items")
        .insert({
          project_id: projectId,
          title: project.name,
          description: project.description ?? null,
          coverImageUrl: null,
          images: [],
          category: null,
          industry: null,
          budgetRange: null,
          duration: null,
          technologies: techTags,
          clientName: client?.company_name ?? null,
          clientIndustry: null,
          testimonial: null,
          featured: false,
          sortOrder: 0,
          published: false,
        } as never);
      await createNotification({
        type: "project_completion_portfolio",
        title: `Portfolio auto-drafted: ${projectName}`,
        message: "A portfolio item has been created from this project. Edit it from /dashboard/settings/profile/public.",
      });
    } else if (existing) {
      await createNotification({
        type: "project_completion_portfolio",
        title: `Portfolio already exists for ${projectName}`,
        message: "A portfolio item for this project is already in your settings. Edit it from /dashboard/settings/profile/public.",
      });
    }
  } catch {
    /* never block completion */
  }

  try {
    await createNotification({
      type: "project_completion_referral",
      title: "Happy client? Ask for an intro",
      message: `If ${projectName} went well, share your referral link from /dashboard/settings/referral — you earn +1 month Pro for every referral who joins.`,
    });
  } catch {
    /* never block completion */
  }
}

export async function createProjectAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const insertRow = {
    user_id: userId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    client_id: parsed.data.clientId ?? null,
    status: parsed.data.status,
    start_date: parsed.data.startDate ?? null,
    due_date: parsed.data.dueDate ?? null,
    billing_enabled: parsed.data.billingEnabled,
    hourly_rate: parsed.data.hourlyRate,
  };

  const { data, error } = await supabase
    .from("projects")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save project." };
  }

  const newId = (data as { id: string }).id;

  // Seed the status history so the detail-page timeline always has an origin.
  await supabase.from("project_status_history").insert({
    project_id: newId,
    user_id: userId,
    from_status: null,
    to_status: parsed.data.status,
    note: "Initial status",
    changed_by: userId,
  } as never);

  await recordActivity({
    kind: "project_created",
    entityType: "project",
    entityId: newId,
    title: `Created project ${parsed.data.name}`,
  });

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: newId }, message: "Project created." };
}

export async function updateProjectAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = projectIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) return { ok: false, error: "Invalid project id." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await requireUserId();
  const supabase = await getServerSupabase();
  const update = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    client_id: parsed.data.clientId ?? null,
    status: parsed.data.status,
    start_date: parsed.data.startDate ?? null,
    due_date: parsed.data.dueDate ?? null,
    billing_enabled: parsed.data.billingEnabled,
    hourly_rate: parsed.data.hourlyRate,
  };
  const { error } = await supabase
    .from("projects")
    .update(update as never)
    .eq("id", idParse.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${idParse.data}`);
  return { ok: true, message: "Project updated." };
}

export async function deleteProjectAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = projectIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) return { ok: false, error: "Invalid project id." };

  await requireUserId();
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("projects").delete().eq("id", idParse.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/projects");
  return { ok: true, message: "Project deleted." };
}

/**
 * Atomic status change. The canonical mutation path — used by:
 *   • the chip dropdown   (typed call)
 *   • the bulk toolbar    (loops one id at a time via bulkChangeProjectStatusAction)
 *   • the legacy FormData wrapper `setProjectStatusAction` below
 *
 * Responsibilities (all best-effort except the DB update itself):
 *   1. Authorise the caller and load `from_status` for accurate logging.
 *   2. Update `projects.status` scoped to the caller's user_id.
 *   3. Skip the rest of the work if the status didn't actually change.
 *   4. Append a row to `project_status_history`.
 *   5. Write one `activity_events` row.
 *   6. Fire a notification ONLY for transitions the registry has flagged
 *      as `notifyOnEnter` — keeps noise down for normal active⇄revision flips.
 *   7. Revalidate list + detail pages so server snapshots refresh.
 */
async function performStatusChange(
  projectId: string,
  to: ProjectStatusRow,
  note: string | null,
): Promise<
  ActionResult<{ id: string; from: ProjectStatusRow | null; to: ProjectStatusRow }>
> {
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Load the current status + name so we can log the transition + send a
  // human-friendly notification. Also acts as a tenant-scoped existence check.
  const { data: existing } = await supabase
    .from("projects")
    .select("id, name, status, client_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) {
    return { ok: false, error: "Project not found." };
  }
  const row = existing as { id: string; name: string; status: ProjectStatusRow; client_id: string | null };
  const from = row.status;

  // Idempotent: no-op if the chip was tapped on the current state.
  if (from === to) {
    return {
      ok: true,
      data: { id: row.id, from, to },
      message: "Status unchanged.",
    };
  }

  const { error } = await supabase
    .from("projects")
    .update({ status: to } as never)
    .eq("id", projectId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("project_status_history").insert({
    project_id: projectId,
    user_id: userId,
    from_status: from,
    to_status: to,
    note: note?.trim() ? note.trim() : null,
    changed_by: userId,
  } as never);

  await recordActivity({
    kind: "project_status_changed",
    entityType: "project",
    entityId: projectId,
    title: `${row.name}: ${PROJECT_STATUS_LABEL[from]} → ${PROJECT_STATUS_LABEL[to]}`,
    metadata: { from, to, note: note?.trim() || null },
  });

  if (shouldNotifyOnEnter(to)) {
    await createNotification({
      type: "project_status_changed",
      title: `${row.name} is now ${PROJECT_STATUS_LABEL[to]}`,
      message: note?.trim() ? note.trim() : null,
    });
  }

  // Trigger review request when project is marked as completed
  if (to === "completed" && row.client_id) {
    await triggerReviewRequest(projectId, row.client_id, userId, row.name);
  }

  // Completion follow-ups: final-invoice nudge, portfolio suggestion,
  // referral prompt. Best-effort — never blocks the status change.
  if (to === "completed") {
    await runCompletionFollowUps(supabase, userId, projectId, row.name);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
  return {
    ok: true,
    data: { id: projectId, from, to },
    message: "Status updated.",
  };
}

/**
 * Typed entry point — used by the ProjectStatusChip's dropdown and any
 * future automation (workflow triggers etc.). Prefer this over the legacy
 * FormData wrapper for new call sites.
 */
export async function changeProjectStatusAction(input: {
  id: string;
  status: ProjectStatusRow;
  note?: string | null;
}): Promise<
  ActionResult<{ id: string; from: ProjectStatusRow | null; to: ProjectStatusRow }>
> {
  const idParse = projectIdSchema.safeParse(input.id);
  const statusParse = projectStatusSchema.safeParse(input.status);
  if (!idParse.success || !statusParse.success) {
    return { ok: false, error: "Invalid input." };
  }
  return performStatusChange(
    idParse.data,
    statusParse.data,
    input.note ?? null,
  );
}

export interface BulkStatusChangeOutcome {
  ok: boolean;
  successCount: number;
  failureCount: number;
  failures: Array<{ id: string; error: string }>;
}

/**
 * Apply the same status to many projects in a single user gesture. Each
 * row goes through `performStatusChange` so the history + activity +
 * notification semantics are identical to single-row updates.
 *
 * Partial success is the expected case (e.g. one row was already at `to`
 * or got deleted concurrently) — we return a structured outcome rather
 * than throw, so the toolbar can render a "5 updated · 1 failed" toast.
 */
export async function bulkChangeProjectStatusAction(input: {
  ids: string[];
  status: ProjectStatusRow;
  note?: string | null;
}): Promise<ActionResult<BulkStatusChangeOutcome>> {
  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    return { ok: false, error: "Pick at least one project first." };
  }
  if (input.ids.length > 100) {
    return { ok: false, error: "Too many projects in a single batch (max 100)." };
  }
  const statusParse = projectStatusSchema.safeParse(input.status);
  if (!statusParse.success) return { ok: false, error: "Invalid status." };

  const failures: Array<{ id: string; error: string }> = [];
  let successCount = 0;

  // Sequential — keeps the activity feed in a sensible order and avoids
  // a thundering-herd against the (tiny) status history table.
  for (const raw of input.ids) {
    const idParse = projectIdSchema.safeParse(raw);
    if (!idParse.success) {
      failures.push({ id: raw, error: "Invalid id" });
      continue;
    }
    const res = await performStatusChange(
      idParse.data,
      statusParse.data,
      input.note ?? null,
    );
    if (res.ok) successCount++;
    else failures.push({ id: idParse.data, error: res.error });
  }

  // Always return a successful ActionResult so the caller can render a
  // partial-success toast — failure details live on the `data` payload.
  const outcome: BulkStatusChangeOutcome = {
    ok: failures.length === 0,
    successCount,
    failureCount: failures.length,
    failures,
  };
  return {
    ok: true,
    data: outcome,
    message:
      failures.length === 0
        ? `${successCount} updated.`
        : `${successCount} updated, ${failures.length} failed.`,
  };
}

/**
 * Legacy FormData entry point. Kept so the existing detail-page archive
 * confirmation (which posts a classic `<form>`) continues to work. New
 * callers should use `changeProjectStatusAction` directly.
 */
export async function setProjectStatusAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = projectIdSchema.safeParse(formData.get("id"));
  const statusParse = projectStatusSchema.safeParse(formData.get("status"));
  if (!idParse.success || !statusParse.success) {
    return { ok: false, error: "Invalid input." };
  }
  const note = (formData.get("note") as string | null) ?? null;
  const res = await performStatusChange(idParse.data, statusParse.data, note);
  if (!res.ok) return res;
  return { ok: true, message: res.message };
}
