"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getPublicAppUrl } from "@/features/documents/urls";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";

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

const publicLeadSchema = z.object({
  formId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(180),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(2).optional().or(z.literal("")),
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
  const parsed = createLeadFormSchema.safeParse({
    name: formData.get("name"),
    title: formData.get("title"),
    description: formData.get("description"),
    brandColor: formData.get("brandColor") || "#2563EB",
  });

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
  const parsed = publicLeadSchema.safeParse({
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
  });

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
    .select("id, user_id, active, title, slug")
    .eq("id", parsed.data.formId)
    .maybeSingle();

  if (formError || !form || !(form as { active: boolean }).active) {
    return { ok: false, error: "This lead form is not accepting responses right now." };
  }

  const ownerId = (form as { user_id: string }).user_id;
  const country = (parsed.data.country || "IN").toUpperCase();
  const currency = (parsed.data.currency || (country === "IN" ? "INR" : "USD")).toUpperCase();
  const isForeign = country !== "IN";

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      user_id: ownerId,
      full_name: parsed.data.name,
      business_name: parsed.data.company || null,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      country,
      currency,
      is_foreign: isForeign,
      gst_registered: false,
      state_code: null,
      billing_address: null,
      notes: `Created from lead form: ${(form as { title: string }).title}`,
    } as never)
    .select("id")
    .single();

  if (clientError || !client) {
    return { ok: false, error: clientError?.message ?? "Could not create the lead." };
  }

  const clientId = (client as { id: string }).id;
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
    phone: parsed.data.phone || null,
    project_summary: parsed.data.project,
    budget: parsed.data.budget || null,
    timeline: parsed.data.timeline || null,
    answers: {
      country,
      currency,
      formSlug: (form as { slug: string }).slug,
    },
    ivo_prompt: ivoPrompt,
    source_url: `${getPublicAppUrl()}/lead/${(form as { slug: string }).slug}`,
  } as never);

  await admin.from("notifications").insert({
    user_id: ownerId,
    title: "New lead received",
    body: `${parsed.data.name} submitted ${(form as { title: string }).title}.`,
    type: "lead",
    entity_type: "project",
    entity_id: projectId,
    href: `/dashboard/pipeline`,
  } as never);

  revalidatePath("/dashboard/lead-forms");
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/clients");
  return {
    ok: true,
    message: "Thanks. Your inquiry has been sent.",
    data: { projectId },
  };
}
