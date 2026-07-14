"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getServerSupabase } from "@/lib/supabase/server";

export type TemplateActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const templateTypeSchema = z.enum(["proposal", "contract", "welcome_doc", "invoice_note", "email"]);

const templateSchema = z.object({
  templateType: templateTypeSchema,
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(80).default("general"),
  scope: z.string().trim().max(4000).optional().or(z.literal("")),
  deliverables: z.string().trim().max(4000).optional().or(z.literal("")),
  timeline: z.string().trim().max(1200).optional().or(z.literal("")),
  terms: z.string().trim().max(2500).optional().or(z.literal("")),
  subject: z.string().trim().max(180).optional().or(z.literal("")),
  body: z.string().trim().max(6000).optional().or(z.literal("")),
  acknowledgementRequired: z.boolean().optional().default(false),
});

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

export async function createTemplateAction(
  _prev: TemplateActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<TemplateActionResult<{ id: string }>> {
  const parsed = templateSchema.safeParse({
    templateType: formData.get("templateType"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category") || "general",
    scope: formData.get("scope"),
    deliverables: formData.get("deliverables"),
    timeline: formData.get("timeline"),
    terms: formData.get("terms"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    acknowledgementRequired: formData.get("acknowledgementRequired") === "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const sections = parseSections(formData);
  const content = buildTemplateContent({
    templateType: parsed.data.templateType,
    scope: parsed.data.scope || "",
    deliverables: parsed.data.deliverables || "",
    timeline: parsed.data.timeline || "",
    terms: parsed.data.terms || "",
    subject: parsed.data.subject || "",
    body: parsed.data.body || "",
    acknowledgementRequired: parsed.data.acknowledgementRequired,
    sections,
  });

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("document_templates")
    .insert({
      user_id: userId,
      template_type: parsed.data.templateType,
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category,
      content,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save template." };
  }

  revalidatePath("/dashboard/templates");
  revalidatePath("/dashboard/proposals");
  return {
    ok: true,
    data: { id: (data as { id: string }).id },
    message: "Template saved.",
  };
}

function parseSections(formData: FormData) {
  const headings = formData.getAll("sectionHeading");
  const bodies = formData.getAll("sectionBody");
  return headings
    .map((heading, index) => ({
      heading: typeof heading === "string" ? heading.trim() : "",
      body: typeof bodies[index] === "string" ? String(bodies[index]).trim() : "",
    }))
    .filter((section) => section.heading || section.body)
    .slice(0, 20);
}

function buildTemplateContent(input: {
  templateType: z.infer<typeof templateTypeSchema>;
  scope: string;
  deliverables: string;
  timeline: string;
  terms: string;
  subject: string;
  body: string;
  acknowledgementRequired: boolean;
  sections: Array<{ heading: string; body: string }>;
}) {
  if (input.templateType === "proposal") {
    return {
      scope: input.scope,
      deliverables: input.deliverables,
      timeline: input.timeline,
      terms: input.terms,
      items: [{ description: "Service package", quantity: 1, unitPrice: 0 }],
    };
  }

  if (input.templateType === "contract") {
    return {
      kind: "contract",
      highlights: input.sections.slice(0, 4).map((section) => section.heading),
      sections:
        input.sections.length > 0
          ? input.sections
          : [{ heading: "Scope of work", body: input.body }],
    };
  }

  if (input.templateType === "welcome_doc") {
    return {
      intro: input.body,
      acknowledgementRequired: input.acknowledgementRequired,
      sections:
        input.sections.length > 0
          ? input.sections
          : [{ heading: "Welcome", body: "Add your onboarding details here." }],
    };
  }

  return {
    subject: input.subject,
    body: input.body,
  };
}

export async function setTemplateActiveAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = z.string().uuid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  const supabase = await getServerSupabase();
  await supabase
    .from("document_templates")
    .update({ active } as never)
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/dashboard/templates");
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = z.string().uuid().parse(formData.get("id"));
  const supabase = await getServerSupabase();
  await supabase
    .from("document_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/dashboard/templates");
}
