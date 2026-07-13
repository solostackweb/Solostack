"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getServerSupabase } from "@/lib/supabase/server";
import type { TemplateType } from "./builtin";

export type TemplateActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const templateTypeSchema = z.enum(["proposal", "contract", "invoice_note", "email"]);

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
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const content =
    parsed.data.templateType === "proposal"
      ? {
          scope: parsed.data.scope || "",
          deliverables: parsed.data.deliverables || "",
          timeline: parsed.data.timeline || "",
          terms: parsed.data.terms || "",
          items: [{ description: "Service package", quantity: 1, unitPrice: 0 }],
        }
      : {
          subject: parsed.data.subject || "",
          body: parsed.data.body || "",
        };

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

export function templateTypeLabel(type: TemplateType): string {
  return type === "invoice_note"
    ? "Invoice note"
    : type.charAt(0).toUpperCase() + type.slice(1);
}
