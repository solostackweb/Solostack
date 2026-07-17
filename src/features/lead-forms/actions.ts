"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getPublicAppUrl } from "@/features/documents/urls";
import { sendEmail } from "@/features/email/service";
import { renderLeadCapturedEmail } from "@/features/email/templates";
import { getServerSupabase } from "@/lib/supabase/server";
import { coerceFormValues } from "@/lib/form";
import { getClientIp, leadSubmitLimit } from "@/lib/rate-limit";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { countryForLeadForm, normalizeLeadPhone } from "./countries";
import { CUSTOM_FIELD_PREFIX, normalizeLeadFields } from "./fields";

export type LeadFormActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const createLeadFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a valid hex color")
    .default("#2563EB"),
});

const leadFieldSchema = z.object({
  name: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "email", "tel", "textarea"]),
  required: z.boolean(),
  custom: z.boolean().optional(),
});

const updateLeadFormSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(80),
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a valid hex color")
    .default("#2563EB"),
  fields: z.array(leadFieldSchema).min(1).max(30),
});

const publicLeadSchema = z.object({
  formId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(180),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().min(2, "Choose a country").max(2),
  currency: z.string().trim().max(3).optional().or(z.literal("")),
  project: z.string().trim().min(10, "Tell us a little more about the project").max(3000),
  budget: z.string().trim().max(120).optional().or(z.literal("")),
  timeline: z.string().trim().max(160).optional().or(z.literal("")),
});

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return `${base || "lead-form"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createLeadFormAction(
  _prev: LeadFormActionResult<{ id: string; url: string }> | undefined,
  formData: FormData,
): Promise<LeadFormActionResult<{ id: string; url: string }>> {
  const parsed = createLeadFormSchema.safeParse(
    coerceFormValues({
      name: formData.get("name"),
      title: formData.get("title"),
      description: formData.get("description"),
      brandColor: formData.get("brandColor") || "#2563EB",
    }),
  );

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const slug = slugify(parsed.data.name);

  const { data, error } = await supabase
    .from("lead_forms")
    .insert({
      user_id: userId,
      name: parsed.data.name,
      slug,
      title: parsed.data.title,
      description: parsed.data.description || null,
      brand_color: parsed.data.brandColor,
    } as never)
    .select("id, slug")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create lead form." };
  }

  const row = data as { id: string; slug: string };
  revalidatePath("/dashboard/lead-forms");
  return {
    ok: true,
    message: "Lead form created.",
    data: { id: row.id, url: `${getPublicAppUrl()}/lead/${row.slug}` },
  };
}

export async function updateLeadFormAction(
  _prev: LeadFormActionResult | undefined,
  formData: FormData,
): Promise<LeadFormActionResult> {
  let rawFields: unknown = [];
  try {
    rawFields = JSON.parse(String(formData.get("fields") ?? "[]"));
  } catch {
    return { ok: false, error: "The form fields could not be read." };
  }

  const parsed = updateLeadFormSchema.safeParse(
    coerceFormValues({
      id: formData.get("id"),
      name: formData.get("name"),
      title: formData.get("title"),
      description: formData.get("description"),
      brandColor: formData.get("brandColor") || "#2563EB",
      fields: rawFields,
    }),
  );

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  // Re-normalize so core fields + shape are always valid regardless of input.
  const fields = normalizeLeadFields(parsed.data.fields);

  const { error } = await supabase
    .from("lead_forms")
    .update({
      name: parsed.data.name,
      title: parsed.data.title,
      description: parsed.data.description || null,
      brand_color: parsed.data.brandColor,
      fields: fields as never,
    } as never)
    .eq("id", parsed.data.id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/lead-forms");
  revalidatePath(`/dashboard/lead-forms/${parsed.data.id}`);
  return { ok: true, message: "Form saved." };
}

export async function toggleLeadFormAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = z.string().uuid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  const supabase = await getServerSupabase();
  await supabase
    .from("lead_forms")
    .update({ active } as never)
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/dashboard/lead-forms");
}

export async function submitPublicLeadAction(
  _prev: LeadFormActionResult<{ projectId: string }> | undefined,
  formData: FormData,
): Promise<LeadFormActionResult<{ projectId: string }>> {
  // Honeypot: a hidden field real users never see. Bots fill every input, so
  // any value here means it's automated. Pretend success so they don't retry.
  if (String(formData.get("website") ?? "").trim()) {
    return { ok: true, message: "Thanks. Your inquiry has been sent." };
  }

  // Per-IP rate limit — one public endpoint that writes client + project rows,
  // so cap how fast a single source can create them. Fails open without Upstash.
  const rl = await leadSubmitLimit(await getClientIp());
  if (!rl.ok) {
    return { ok: false, error: rl.message };
  }

  const parsed = publicLeadSchema.safeParse(
    coerceFormValues({
      formId: formData.get("formId"),
      name: formData.get("name"),
      email: formData.get("email"),
      company: formData.get("company"),
      phone: formData.get("phone"),
      country: formData.get("country"),
      currency: formData.get("currency"),
      project: formData.get("project"),
      budget: formData.get("budget"),
      timeline: formData.get("timeline"),
    }),
  );

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const admin = getAdminSupabase();
  const { data: form, error: formError } = await admin
    .from("lead_forms")
    .select("id, user_id, active, title, slug, fields")
    .eq("id", parsed.data.formId)
    .maybeSingle();

  if (formError || !form || !(form as { active: boolean }).active) {
    return { ok: false, error: "This lead form is not accepting responses right now." };
  }

  const ownerId = (form as { user_id: string }).user_id;
  const countryMeta = countryForLeadForm(parsed.data.country);
  const country = countryMeta.code;
  const currency = (parsed.data.currency || countryMeta.currency).toUpperCase();
  const isForeign = country !== "IN";
  const phone = normalizeLeadPhone(parsed.data.phone || "", country) || null;

  // Collect answers to any custom questions this form defines, keyed by label.
  const customAnswers: Record<string, string> = {};
  for (const field of normalizeLeadFields((form as { fields?: unknown }).fields)) {
    if (!field.custom) continue;
    const value = String(
      formData.get(`${CUSTOM_FIELD_PREFIX}${field.name}`) ?? "",
    ).trim();
    if (value) customAnswers[field.label] = value.slice(0, 2000);
  }

  // Dedup by email: if this person is already a client, reuse that record and
  // only add a new lead project under them — don't create a duplicate client.
  // Otherwise create a new client, flagged for manual verification (GST,
  // state, billing) since a prospect can't be trusted to fill those in.
  const { data: existingClient } = await admin
    .from("clients")
    .select("id")
    .eq("user_id", ownerId)
    .ilike("email", parsed.data.email)
    .limit(1)
    .maybeSingle();

  let clientId: string;
  let clientIsNew = false;

  if (existingClient) {
    clientId = (existingClient as { id: string }).id;
  } else {
    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({
        user_id: ownerId,
        full_name: parsed.data.name,
        business_name: parsed.data.company || null,
        email: parsed.data.email,
        phone,
        country,
        currency,
        is_foreign: isForeign,
        gst_registered: false,
        state_code: null,
        billing_address: null,
        needs_review: true,
        notes: [
          `Created from lead form: ${(form as { title: string }).title}`,
          "Verify billing address, GST status, state, and document details before sending proposals, contracts, or invoices.",
        ].join("\n"),
      } as never)
      .select("id")
      .single();

    if (clientError || !client) {
      return { ok: false, error: clientError?.message ?? "Could not create the lead." };
    }
    clientId = (client as { id: string }).id;
    clientIsNew = true;
  }
  const projectName = parsed.data.company
    ? `${parsed.data.company} inquiry`
    : `${parsed.data.name} inquiry`;
  const description = [
    parsed.data.project,
    parsed.data.budget ? `Budget: ${parsed.data.budget}` : null,
    parsed.data.timeline ? `Timeline: ${parsed.data.timeline}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      user_id: ownerId,
      client_id: clientId,
      name: projectName,
      description,
      status: "lead",
      billing_enabled: false,
      hourly_rate: 0,
    } as never)
    .select("id")
    .single();

  if (projectError || !project) {
    return { ok: false, error: projectError?.message ?? "Could not create the pipeline lead." };
  }

  const projectId = (project as { id: string }).id;
  await admin.from("project_status_history").insert({
    project_id: projectId,
    user_id: ownerId,
    from_status: null,
    to_status: "lead",
    note: "Created from lead form",
    changed_by: ownerId,
  } as never);

  const ivoPrompt = [
    `Draft a warm reply to this new Stackivo lead.`,
    `Lead: ${parsed.data.name} <${parsed.data.email}>`,
    parsed.data.company ? `Company: ${parsed.data.company}` : null,
    `Country/currency: ${country}/${currency}`,
    `Project: ${parsed.data.project}`,
    parsed.data.budget ? `Budget: ${parsed.data.budget}` : null,
    parsed.data.timeline ? `Timeline: ${parsed.data.timeline}` : null,
    `Suggest the next step, whether to book discovery, draft a proposal, or ask clarification questions.`,
  ]
    .filter(Boolean)
    .join("\n");

  await admin.from("lead_submissions").insert({
    form_id: parsed.data.formId,
    user_id: ownerId,
    client_id: clientId,
    project_id: projectId,
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company || null,
    phone,
    project_summary: parsed.data.project,
    budget: parsed.data.budget || null,
    timeline: parsed.data.timeline || null,
    answers: {
      country,
      currency,
      formSlug: (form as { slug: string }).slug,
      custom: customAnswers,
    },
    ivo_prompt: ivoPrompt,
    source_url: `${getPublicAppUrl()}/lead/${(form as { slug: string }).slug}`,
  } as never);

  const formTitle = (form as { title: string }).title;

  // Email the freelancer immediately — leads cool off fast. Best-effort:
  // an email failure never blocks the submission. Reply-To is the LEAD's
  // address so hitting reply answers them directly.
  try {
    const { data: ownerProfile } = await admin
      .from("user_profiles")
      .select("email, business_email, business_name, full_name")
      .eq("id", ownerId)
      .maybeSingle();
    const owner = ownerProfile as
      | {
          email: string | null;
          business_email: string | null;
          business_name: string | null;
          full_name: string | null;
        }
      | null;
    const ownerEmail = owner?.business_email || owner?.email;
    if (ownerEmail) {
      const rendered = renderLeadCapturedEmail({
        formTitle,
        leadName: parsed.data.name,
        leadEmail: parsed.data.email,
        company: parsed.data.company || null,
        projectSummary: parsed.data.project,
        budget: parsed.data.budget || null,
        timeline: parsed.data.timeline || null,
        dashboardUrl: `${getPublicAppUrl()}/dashboard/lead-forms`,
      });
      await sendEmail({
        type: "share",
        to: {
          email: ownerEmail,
          name: owner?.business_name || owner?.full_name || undefined,
        },
        replyTo: { email: parsed.data.email, name: parsed.data.name },
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: ["lead-captured"],
      });
    }
  } catch {
    /* in-app notification below still lands */
  }

  await admin.from("notifications").insert({
    user_id: ownerId,
    title: clientIsNew
      ? "New lead - verify client details"
      : "New inquiry from an existing client",
    body: clientIsNew
      ? `${parsed.data.name} submitted ${formTitle}. Stackivo created a client and a lead project. Please verify GST status, state, and billing address before sending any documents.`
      : `${parsed.data.name} (${parsed.data.email}) submitted ${formTitle}. A new lead project was added under their existing client record.`,
    type: "lead",
    entity_type: "client",
    entity_id: clientId,
    href: `/dashboard/clients/${clientId}`,
  } as never);

  revalidatePath("/dashboard/lead-forms");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/clients");
  return {
    ok: true,
    message: "Thanks. Your inquiry has been sent.",
    data: { projectId },
  };
}
