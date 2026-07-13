"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getProposalShareUrl } from "@/features/documents/urls";
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
  const content = (template?.content ?? {}) as ProposalTemplateContent;
  const title =
    typeof formData.get("title") === "string" && String(formData.get("title")).trim()
      ? String(formData.get("title")).trim().slice(0, 180)
      : (template?.title ?? "Untitled proposal");
  const clientId = cleanOptionalId(formData.get("clientId"));
  const projectId = cleanOptionalId(formData.get("projectId"));
  const currency = cleanCurrency(formData.get("currency"));
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
  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    } as never)
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("public_token")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create share link." };
  const token = String((data as Pick<ProposalRow, "public_token">).public_token);

  revalidatePath("/dashboard/proposals");
  revalidatePath(`/dashboard/proposals/${id.data}`);
  return {
    ok: true,
    data: {
      token,
      url: getProposalShareUrl(token),
    },
  };
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
