"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { buildProposalPdfData } from "@/features/documents/builders";
import { ContractPdf } from "@/features/documents/pdf/contract-pdf";
import { renderPdfToBuffer } from "@/features/documents/pdf/render";
import { getProposalShareUrl } from "@/features/documents/urls";
import { pdfAttachment } from "@/features/email/send";
import { sendEmail } from "@/features/email/service";
import { createInvoiceAction } from "@/features/invoices/actions";
import { nextInvoiceNumber } from "@/features/invoices/server";
import { recordActivity } from "@/features/activity/server";
import { getFxRateToInr } from "@/features/payments/fx";
import { isValidPublicShareToken } from "@/features/share/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import type {
  DocumentTemplateRow,
  ProposalItemRow,
  ProposalRow,
  UserProfileRow,
} from "@/lib/supabase/types";
import { BUILTIN_TEMPLATES, type ProposalTemplateContent } from "@/features/templates/builtin";
import {
  applyMergeFields,
  applyMergeFieldsDeep,
} from "@/features/templates/merge-fields";
import { resolveMergeContextForUser } from "@/features/templates/merge-context";
import {
  proposalCrudSchema,
  proposalIdSchema,
  proposalItemsSchema,
} from "./server-schemas";

export type ProposalActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

function cleanOptionalId(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanCurrency(value: FormDataEntryValue | null) {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(currency) ? currency : "INR";
}

function dateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function loadProposalTemplate(userId: string, templateId: string | null) {
  if (!templateId || templateId === "blank") return null;

  const builtin = BUILTIN_TEMPLATES.find(
    (template) => template.id === templateId && template.templateType === "proposal",
  );
  if (builtin) return builtin;

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("document_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", userId)
    .eq("template_type", "proposal")
    .eq("active", true)
    .maybeSingle();

  const row = data as DocumentTemplateRow | null;
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    templateType: row.template_type,
    title: row.title,
    description: row.description,
    category: row.category,
    content: row.content,
    active: row.active,
    isSystem: false,
    updatedAt: row.updated_at,
  };
}

function parseProposalForm(formData: FormData) {
  return proposalCrudSchema.safeParse({
    title: formData.get("title"),
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    status: formData.get("status") ?? "draft",
    currency: formData.get("currency") ?? "INR",
    subtotal: formData.get("subtotal") ?? 0,
    taxAmount: formData.get("taxAmount") ?? 0,
    totalAmount: formData.get("totalAmount") ?? 0,
    validUntil: formData.get("validUntil"),
    scope: formData.get("scope"),
    deliverables: formData.get("deliverables"),
    timeline: formData.get("timeline"),
    terms: formData.get("terms"),
  });
}

function proposalPayload(
  userId: string,
  data: ReturnType<typeof proposalCrudSchema.parse>,
) {
  const totalAmount =
    data.totalAmount > 0
      ? data.totalAmount
      : Math.round((data.subtotal + data.taxAmount) * 100) / 100;

  const timestamps: Record<string, string> = {};
  const now = new Date().toISOString();
  if (data.status === "sent") timestamps.sent_at = now;
  if (data.status === "viewed") timestamps.viewed_at = now;
  if (data.status === "accepted") timestamps.accepted_at = now;
  if (data.status === "declined") timestamps.declined_at = now;
  if (data.status === "converted") timestamps.converted_at = now;

  return {
    user_id: userId,
    title: data.title,
    client_id: data.clientId ?? null,
    project_id: data.projectId ?? null,
    status: data.status,
    currency: data.currency,
    subtotal: data.subtotal,
    tax_amount: data.taxAmount,
    total_amount: totalAmount,
    valid_until: data.validUntil ?? null,
    scope: data.scope ?? null,
    deliverables: data.deliverables ?? null,
    timeline: data.timeline ?? null,
    terms: data.terms ?? null,
    ...timestamps,
  };
}

export async function createProposalAction(
  _prev: ProposalActionResult | undefined,
  formData: FormData,
): Promise<ProposalActionResult<{ id: string }>> {
  const parsed = parseProposalForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const insertRow = proposalPayload(userId, parsed.data);
  const { data, error } = await supabase
    .from("proposals")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create proposal." };

  revalidatePath("/dashboard/proposals");
  revalidatePath("/dashboard/projects");
  return {
    ok: true,
    data: { id: String((data as Pick<ProposalRow, "id">).id) },
    message: "Proposal created.",
  };
}

export async function createProposalFromTemplateRedirectAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const template = await loadProposalTemplate(userId, cleanOptionalId(formData.get("templateId")));
  const rawContent = (template?.content ?? {}) as ProposalTemplateContent;
  const rawTitle =
    typeof formData.get("title") === "string" && String(formData.get("title")).trim()
      ? String(formData.get("title")).trim().slice(0, 180)
      : (template?.title ?? "Untitled proposal");
  const clientId = cleanOptionalId(formData.get("clientId"));
  const projectId = cleanOptionalId(formData.get("projectId"));
  const currency = cleanCurrency(formData.get("currency"));

  // Resolve merge context from the chosen client / project / profile, then
  // substitute {{variables}} so the new draft starts personalised.
  const mergeCtx = await resolveMergeContextForUser({
    userId,
    clientId,
    projectId,
    currency,
  });
  const content = applyMergeFieldsDeep(rawContent, mergeCtx);
  const title = applyMergeFields(rawTitle, mergeCtx);
  const items =
    Array.isArray(content.items) && content.items.length > 0
      ? content.items
      : [{ description: "Service package", quantity: 1, unitPrice: 0 }];
  const subtotal =
    Math.round(
      items.reduce(
        (sum, item) => sum + Number(item.quantity || 1) * Number(item.unitPrice || 0),
        0,
      ) * 100,
    ) / 100;

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      user_id: userId,
      title,
      client_id: clientId,
      project_id: projectId,
      status: "draft",
      currency,
      subtotal,
      tax_amount: 0,
      total_amount: subtotal,
      valid_until: dateAfterDays(14),
      scope: content.scope ?? null,
      deliverables: content.deliverables ?? null,
      timeline: content.timeline ?? null,
      terms: content.terms ?? null,
    } as never)
    .select("id")
    .single();

  if (error || !data) redirect("/dashboard/proposals?createError=1");
  const proposalId = String((data as Pick<ProposalRow, "id">).id);

  const rows = items
    .filter((item) => String(item.description ?? "").trim())
    .map((item, index) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice || 0);
      return {
        proposal_id: proposalId,
        description: String(item.description).trim(),
        quantity,
        unit_price: unitPrice,
        amount: Math.round(quantity * unitPrice * 100) / 100,
        sort_order: index,
      };
    });

  if (rows.length > 0) {
    await supabase.from("proposal_items").insert(rows as never);
  }

  revalidatePath("/dashboard/proposals");
  redirect(`/dashboard/proposals/${proposalId}`);
}

export async function updateProposalAction(
  _prev: ProposalActionResult | undefined,
  formData: FormData,
): Promise<ProposalActionResult<{ id: string }>> {
  const id = proposalIdSchema.safeParse(formData.get("id"));
  const parsed = parseProposalForm(formData);
  if (!id.success || !parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("proposals")
    .update(proposalPayload(userId, parsed.data) as never)
    .eq("id", id.data)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/proposals");
  revalidatePath("/dashboard/projects");
  return { ok: true, data: { id: id.data }, message: "Proposal updated." };
}

export async function deleteProposalAction(
  _prev: ProposalActionResult | undefined,
  formData: FormData,
): Promise<ProposalActionResult> {
  const id = proposalIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Invalid proposal." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("proposals")
    .delete()
    .eq("id", id.data)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/proposals");
  revalidatePath("/dashboard/projects");
  return { ok: true, message: "Proposal deleted." };
}

export async function saveProposalBuilderAction(
  _prev: ProposalActionResult | undefined,
  formData: FormData,
): Promise<ProposalActionResult<{ id: string }>> {
  const id = proposalIdSchema.safeParse(formData.get("id"));
  const parsed = parseProposalForm(formData);
  let rawItems: unknown = [];
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Proposal items could not be read." };
  }
  const parsedItems = proposalItemsSchema.safeParse(rawItems);

  if (!id.success || !parsed.success || !parsedItems.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const subtotal = Math.round(
    parsedItems.data.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    ) * 100,
  ) / 100;
  const taxAmount = parsed.data.taxAmount;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  const payload = {
    ...proposalPayload(userId, {
      ...parsed.data,
      subtotal,
      totalAmount,
    }),
    user_id: userId,
  };

  const { error: proposalError } = await supabase
    .from("proposals")
    .update(payload as never)
    .eq("id", id.data)
    .eq("user_id", userId);
  if (proposalError) return { ok: false, error: proposalError.message };

  const { error: deleteError } = await supabase
    .from("proposal_items")
    .delete()
    .eq("proposal_id", id.data);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (parsedItems.data.length > 0) {
    const rows = parsedItems.data.map((item, index) => {
      const amount = Math.round(item.quantity * item.unitPrice * 100) / 100;
      return {
        proposal_id: id.data,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount,
        sort_order: index,
      };
    });
    const { error: insertError } = await supabase
      .from("proposal_items")
      .insert(rows as never);
    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidatePath("/dashboard/proposals");
  revalidatePath(`/dashboard/proposals/${id.data}`);
  revalidatePath("/dashboard/projects");
  return { ok: true, data: { id: id.data }, message: "Proposal saved." };
}

export async function shareProposalAction(input: {
  id: string;
}): Promise<ProposalActionResult<{ url: string; token: string }>> {
  const id = proposalIdSchema.safeParse(input.id);
  if (!id.success) return { ok: false, error: "Invalid proposal." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  // Read-only: fetching the share link must NOT flip the proposal to "sent".
  // Explicitly sending (email / WhatsApp) is what records it as sent.
  const { data, error } = await supabase
    .from("proposals")
    .select("public_token")
    .eq("id", id.data)
    .eq("user_id", userId)
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create share link." };
  const token = String((data as Pick<ProposalRow, "public_token">).public_token);

  return {
    ok: true,
    data: {
      token,
      url: getProposalShareUrl(token),
    },
  };
}

export async function sendProposalEmailAction(input: {
  id: string;
}): Promise<ProposalActionResult<{ url: string }>> {
  const id = proposalIdSchema.safeParse(input.id);
  if (!id.success) return { ok: false, error: "Invalid proposal." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const [{ data: proposalData }, { data: profileData }] = await Promise.all([
    supabase
      .from("proposals")
      .select("id,title,user_id,client_id,project_id,total_amount,currency,public_token,valid_until,scope,deliverables,timeline,terms")
      .eq("id", id.data)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("full_name,business_name,company_name,email,business_email")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const proposal = proposalData as Pick<
    ProposalRow,
    | "id"
    | "title"
    | "user_id"
    | "client_id"
    | "project_id"
    | "total_amount"
    | "currency"
    | "public_token"
    | "valid_until"
    | "scope"
    | "deliverables"
    | "timeline"
    | "terms"
  > | null;
  if (!proposal) return { ok: false, error: "Proposal not found." };

  const { data: itemData } = await supabase
    .from("proposal_items")
    .select("description,quantity,unit_price")
    .eq("proposal_id", proposal.id)
    .order("sort_order", { ascending: true });
  const items = (itemData as Pick<ProposalItemRow, "description" | "quantity" | "unit_price">[] | null) ?? [];
  const missing: string[] = [];
  if (!proposal.title.trim() || proposal.title === "Untitled proposal") missing.push("title");
  if (!proposal.client_id) missing.push("client");
  if (!proposal.valid_until) missing.push("valid until");
  if (!proposal.scope?.trim()) missing.push("scope");
  if (!proposal.deliverables?.trim()) missing.push("deliverables");
  if (!proposal.timeline?.trim()) missing.push("timeline");
  if (!proposal.terms?.trim()) missing.push("terms");
  if (
    items.filter(
      (item) =>
        item.description.trim() &&
        Number(item.quantity) > 0 &&
        Number(item.unit_price) >= 0,
    ).length === 0
  ) {
    missing.push("at least one package");
  }
  if (Number(proposal.total_amount ?? 0) <= 0) missing.push("proposal total");

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Complete ${missing.join(", ")} before sending.`,
      fieldErrors: Object.fromEntries(missing.map((field) => [field, ["Required before sending."]])),
    };
  }

  const clientId = proposal.client_id;
  if (!clientId) return { ok: false, error: "Choose a client before sending." };

  const { data: clientData } = await supabase
    .from("clients")
    .select("full_name,business_name,email")
    .eq("id", clientId)
    .eq("user_id", userId)
    .maybeSingle();

  const client = clientData as {
    full_name: string;
    business_name: string | null;
    email: string | null;
  } | null;
  if (!client?.email) {
    return { ok: false, error: "This client does not have an email address." };
  }

  const profile = profileData as {
    full_name: string | null;
    business_name: string | null;
    company_name: string | null;
    email: string | null;
    business_email: string | null;
  } | null;
  const senderName =
    profile?.business_name || profile?.company_name || profile?.full_name || "Your freelancer";
  const senderEmail = profile?.business_email || profile?.email || undefined;
  const clientName = client.business_name || client.full_name || "there";
  const url = getProposalShareUrl(proposal.public_token);
  const pdfData = await buildProposalPdfData(proposal.id);
  if (!pdfData) {
    return { ok: false, error: "Could not prepare the proposal PDF." };
  }
  const pdfBuffer = await renderPdfToBuffer(ContractPdf({ data: pdfData }));
  const pdfFileName = `proposal-${slugifyFileName(proposal.title) || proposal.id}.pdf`;

  try {
    await sendEmail({
      type: "share",
      to: { email: client.email, name: clientName },
      replyTo: senderEmail ? { email: senderEmail, name: senderName } : undefined,
      subject: `${senderName} shared a proposal: ${proposal.title}`,
      html: renderProposalEmailHtml({
        clientName,
        senderName,
        title: proposal.title,
        amount: `${proposal.currency} ${Number(proposal.total_amount ?? 0).toLocaleString("en-IN")}`,
        url,
      }),
      text: `Hi ${clientName},\n\n${senderName} shared a proposal for your review: ${proposal.title}\n\nView it here: ${url}\n\nA PDF copy is attached for your records. This is a proposal acknowledgement flow, not an e-signature contract.`,
      attachments: [pdfAttachment(pdfFileName, pdfBuffer)],
      metadata: { proposalId: proposal.id, publicUrl: url },
      tags: ["proposal_sent", "share"],
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not send proposal email.",
    };
  }

  await supabase
    .from("proposals")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    } as never)
    .eq("id", proposal.id)
    .eq("user_id", userId);

  await recordActivity({
    kind: "proposal_sent",
    entityType: "proposal",
    entityId: proposal.id,
    title: `Proposal sent to ${client.email}: ${proposal.title}`,
    metadata: { via: "email", publicUrl: url },
  });

  revalidatePath("/dashboard/proposals");
  revalidatePath(`/dashboard/proposals/${proposal.id}`);
  return { ok: true, data: { url }, message: "Proposal emailed." };
}

export async function acceptPublicProposalAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  if (!isValidPublicShareToken(token)) return;

  const admin = getAdminSupabase();
  const acceptedAt = new Date().toISOString();
  const { data } = await admin
    .from("proposals")
    .update({
      status: "accepted",
      accepted_at: acceptedAt,
    } as never)
    .eq("public_token", token)
    .select("id,user_id,title")
    .maybeSingle();

  const proposal = data as Pick<ProposalRow, "id" | "user_id" | "title"> | null;
  if (proposal) {
    await admin.from("activity_events").insert({
      user_id: proposal.user_id,
      kind: "proposal_accepted",
      entity_type: "proposal",
      entity_id: proposal.id,
      title: `"${proposal.title}" accepted`,
      metadata: { via: "public_link" },
    } as never);

    await admin.from("notifications").insert({
      user_id: proposal.user_id,
      type: "proposal_accepted",
      title: "Proposal accepted",
      message: `${proposal.title} was acknowledged by the client. You can now convert it to a contract, project, or invoice.`,
    } as never);
  }

  revalidatePath(`/p/${token}`);
}

function renderProposalEmailHtml(input: {
  clientName: string;
  senderName: string;
  title: string;
  amount: string;
  url: string;
}) {
  return `
  <div style="margin:0;padding:24px;background:#f6f8fb;font-family:Inter,Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="height:5px;background:#2563eb;"></div>
      <div style="padding:28px;">
        <p style="margin:0 0 12px;color:#6b7280;font-size:13px;">Proposal shared via Stackivo</p>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111827;">${escapeHtml(input.title)}</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">
          Hi ${escapeHtml(input.clientName)}, ${escapeHtml(input.senderName)} has shared a proposal for your review.
        </p>
        <div style="margin:0 0 22px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
          <p style="margin:0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Proposal value</p>
          <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(input.amount)}</p>
        </div>
        <a href="${escapeHtml(input.url)}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">
          View proposal
        </a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
          A PDF copy is attached for your records. This is a proposal acknowledgement flow,
          not an e-signature contract.
        </p>
      </div>
    </div>
  </div>`;
}

function slugifyFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadOwnedProposal(input: { id: string; userId: string }) {
  const supabase = await getServerSupabase();
  const [{ data: proposal }, { data: items }] = await Promise.all([
    supabase
      .from("proposals")
      .select("*")
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .maybeSingle(),
    supabase
      .from("proposal_items")
      .select("*")
      .eq("proposal_id", input.id)
      .order("sort_order", { ascending: true }),
  ]);
  if (!proposal) return null;
  return {
    proposal: proposal as unknown as ProposalRow,
    items: ((items as unknown as ProposalItemRow[]) ?? []),
  };
}

async function markProposalConverted(input: {
  id: string;
  userId: string;
  patch?: Record<string, unknown>;
}) {
  const supabase = await getServerSupabase();
  await supabase
    .from("proposals")
    .update({
      status: "converted",
      converted_at: new Date().toISOString(),
      ...(input.patch ?? {}),
    } as never)
    .eq("id", input.id)
    .eq("user_id", input.userId);
}

export async function convertProposalToProjectAction(input: {
  id: string;
}): Promise<ProposalActionResult<{ id: string }>> {
  const id = proposalIdSchema.safeParse(input.id);
  if (!id.success) return { ok: false, error: "Invalid proposal." };

  const userId = await requireUserId();
  const loaded = await loadOwnedProposal({ id: id.data, userId });
  if (!loaded) return { ok: false, error: "Proposal not found." };

  const supabase = await getServerSupabase();
  if (loaded.proposal.project_id) {
    const { error } = await supabase
      .from("projects")
      .update({
        proposal_id: loaded.proposal.id,
        status: "active",
      } as never)
      .eq("id", loaded.proposal.project_id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    await markProposalConverted({ id: loaded.proposal.id, userId });
    revalidatePath(`/dashboard/projects/${loaded.proposal.project_id}`);
    revalidatePath(`/dashboard/proposals/${loaded.proposal.id}`);
    return { ok: true, data: { id: loaded.proposal.project_id }, message: "Project linked." };
  }

  const description = [
    loaded.proposal.scope,
    loaded.proposal.deliverables ? `Deliverables:\n${loaded.proposal.deliverables}` : null,
    loaded.proposal.timeline ? `Timeline:\n${loaded.proposal.timeline}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      client_id: loaded.proposal.client_id,
      proposal_id: loaded.proposal.id,
      name: loaded.proposal.title,
      description: description || null,
      status: "active",
      billing_enabled: false,
      hourly_rate: 0,
    } as never)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create project." };
  const projectId = String((data as { id: string }).id);

  await supabase.from("project_status_history").insert({
    project_id: projectId,
    user_id: userId,
    from_status: null,
    to_status: "active",
    note: "Converted from proposal",
    changed_by: userId,
  } as never);

  await markProposalConverted({
    id: loaded.proposal.id,
    userId,
    patch: { project_id: projectId },
  });
  await recordActivity({
    kind: "proposal_converted_to_project",
    entityType: "proposal",
    entityId: loaded.proposal.id,
    title: `Converted proposal to project: ${loaded.proposal.title}`,
    metadata: { projectId },
  });

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/proposals/${loaded.proposal.id}`);
  return { ok: true, data: { id: projectId }, message: "Project created." };
}

export async function convertProposalToContractAction(input: {
  id: string;
}): Promise<ProposalActionResult<{ id: string }>> {
  const id = proposalIdSchema.safeParse(input.id);
  if (!id.success) return { ok: false, error: "Invalid proposal." };

  const userId = await requireUserId();
  const loaded = await loadOwnedProposal({ id: id.data, userId });
  if (!loaded) return { ok: false, error: "Proposal not found." };

  const content = buildContractContentFromProposal(loaded.proposal, loaded.items);
  const supabase = await getServerSupabase();
  const fxRate =
    loaded.proposal.currency === "INR"
      ? 1
      : ((await getFxRateToInr(loaded.proposal.currency)) ?? 1);
  const inrEquivalent =
    loaded.proposal.total_amount === null
      ? null
      : Math.round(Number(loaded.proposal.total_amount) * fxRate * 100) / 100;
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      user_id: userId,
      client_id: loaded.proposal.client_id,
      project_id: loaded.proposal.project_id,
      proposal_id: loaded.proposal.id,
      kind: "contract",
      title: `${loaded.proposal.title} Agreement`,
      content,
      status: "draft",
      currency: loaded.proposal.currency,
      value_amount: loaded.proposal.total_amount,
      fx_rate_to_inr: fxRate,
      inr_equivalent: inrEquivalent,
      expires_at: loaded.proposal.valid_until,
    } as never)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create contract." };
  const contractId = String((data as { id: string }).id);

  await markProposalConverted({ id: loaded.proposal.id, userId });
  await recordActivity({
    kind: "proposal_converted_to_contract",
    entityType: "proposal",
    entityId: loaded.proposal.id,
    title: `Converted proposal to contract: ${loaded.proposal.title}`,
    metadata: { contractId },
  });

  revalidatePath("/dashboard/contracts");
  revalidatePath(`/dashboard/contracts/${contractId}`);
  revalidatePath(`/dashboard/proposals/${loaded.proposal.id}`);
  return { ok: true, data: { id: contractId }, message: "Contract created." };
}

export async function convertProposalToInvoiceAction(input: {
  id: string;
}): Promise<ProposalActionResult<{ id: string }>> {
  const id = proposalIdSchema.safeParse(input.id);
  if (!id.success) return { ok: false, error: "Invalid proposal." };

  const userId = await requireUserId();
  const loaded = await loadOwnedProposal({ id: id.data, userId });
  if (!loaded) return { ok: false, error: "Proposal not found." };
  if (!loaded.proposal.client_id) {
    return { ok: false, error: "Add a client before converting this proposal to an invoice." };
  }

  const supabase = await getServerSupabase();
  const [{ data: profile }, nextNumber] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("invoice_default_due_days, invoice_default_hsn_sac, invoice_default_terms, invoice_default_gst_rate")
      .eq("id", userId)
      .maybeSingle(),
    nextInvoiceNumber(userId),
  ]);
  const profileRow = profile as Pick<
    UserProfileRow,
    | "invoice_default_due_days"
    | "invoice_default_hsn_sac"
    | "invoice_default_terms"
    | "invoice_default_gst_rate"
  > | null;
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(issueDate.getDate() + (profileRow?.invoice_default_due_days ?? 7));

  const lines =
    loaded.items.length > 0
      ? loaded.items.map((item, index) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          gstRate: profileRow?.invoice_default_gst_rate ?? 18,
          position: index,
        }))
      : [
          {
            description: loaded.proposal.title,
            quantity: 1,
            unitPrice: Number(loaded.proposal.subtotal || loaded.proposal.total_amount),
            gstRate: profileRow?.invoice_default_gst_rate ?? 18,
            position: 0,
          },
        ];

  const fd = new FormData();
  fd.set(
    "payload",
    JSON.stringify({
      clientId: loaded.proposal.client_id,
      projectId: loaded.proposal.project_id ?? undefined,
      invoiceNumber: nextNumber.formatted,
      issueDate: formatIsoDate(issueDate),
      dueDate: formatIsoDate(dueDate),
      currency: loaded.proposal.currency,
      status: "draft",
      discount: 0,
      notes: loaded.proposal.scope ?? undefined,
      terms: loaded.proposal.terms ?? profileRow?.invoice_default_terms ?? undefined,
      hsnSac: profileRow?.invoice_default_hsn_sac ?? undefined,
      lines,
    }),
  );

  const created = await createInvoiceAction(undefined, fd);
  if (!created.ok || !created.data) {
    return created.ok
      ? { ok: false, error: "Invoice was created but no id was returned." }
      : created;
  }

  await supabase
    .from("invoices")
    .update({ proposal_id: loaded.proposal.id } as never)
    .eq("id", created.data.id)
    .eq("user_id", userId);

  await markProposalConverted({ id: loaded.proposal.id, userId });
  await recordActivity({
    kind: "proposal_converted_to_invoice",
    entityType: "proposal",
    entityId: loaded.proposal.id,
    title: `Converted proposal to invoice: ${loaded.proposal.title}`,
    metadata: { invoiceId: created.data.id },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${created.data.id}`);
  revalidatePath(`/dashboard/proposals/${loaded.proposal.id}`);
  return { ok: true, data: { id: created.data.id }, message: "Invoice created." };
}

function buildContractContentFromProposal(
  proposal: ProposalRow,
  items: ProposalItemRow[],
) {
  const pricing = items.length
    ? items
        .map(
          (item) =>
            `- ${item.description}: ${item.quantity} x ${proposal.currency} ${item.unit_price} = ${proposal.currency} ${item.amount}`,
        )
        .join("\n")
    : `Total value: ${proposal.currency} ${proposal.total_amount}`;

  return [
    {
      heading: "Scope",
      body: proposal.scope || "The scope will follow the approved proposal.",
    },
    {
      heading: "Deliverables",
      body: proposal.deliverables || "Deliverables will follow the approved proposal.",
    },
    {
      heading: "Timeline",
      body: proposal.timeline || "Timeline will be mutually confirmed before kickoff.",
    },
    {
      heading: "Fees",
      body: `${pricing}\n\nTotal: ${proposal.currency} ${proposal.total_amount}`,
    },
    {
      heading: "Terms",
      body: proposal.terms || "Payment, revision, and approval terms will be confirmed in writing.",
    },
  ]
    .map((section) => `${section.heading}\n${section.body}`)
    .join("\n\n");
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
