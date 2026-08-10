"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { dispatchDelivery } from "@/features/email/send";
import {
  buildEmailBrand,
  renderQuestionnaireInviteEmail,
} from "@/features/email/templates";
import { getPublicAppUrl } from "@/features/documents/urls";
import { normalizeQuestions } from "./types";
import { getStarter } from "./builtin";

export type QResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function makeToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "short_text",
    "long_text",
    "email",
    "phone",
    "number",
    "single_choice",
    "multi_choice",
    "dropdown",
    "yes_no",
    "rating",
    "date",
    "file",
  ]),
  label: z.string().trim().min(1).max(300),
  required: z.boolean().optional(),
  help: z.string().max(300).optional(),
  options: z.array(z.string()).optional(),
  max: z.number().optional(),
});

const upsertSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  questions: z.array(questionSchema).max(60),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export async function createQuestionnaireAction(
  input: z.infer<typeof upsertSchema>,
): Promise<QResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const supabase = await getServerSupabase();
  if (parsed.data.idempotencyKey) {
    const { data: existing } = await supabase
      .from("questionnaires")
      .select("id")
      .eq("user_id", userId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        data: { id: String((existing as { id: string }).id) },
        message: "Questionnaire draft already exists.",
      };
    }
  }
  const { data, error } = await supabase
    .from("questionnaires")
    .insert({
      user_id: userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      questions: normalizeQuestions(parsed.data.questions),
      idempotency_key: parsed.data.idempotencyKey ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (error?.code === "23505" && parsed.data.idempotencyKey) {
    const { data: existing } = await supabase
      .from("questionnaires")
      .select("id")
      .eq("user_id", userId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        data: { id: String((existing as { id: string }).id) },
        message: "Questionnaire draft already exists.",
      };
    }
  }
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save the questionnaire." };
  }
  revalidatePath("/dashboard/questionnaires");
  return {
    ok: true,
    data: { id: (data as { id: string }).id },
    message: "Questionnaire saved.",
  };
}

export async function updateQuestionnaireAction(
  input: Omit<z.infer<typeof upsertSchema>, "idempotencyKey"> & { id: string },
): Promise<QResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("questionnaires")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      questions: normalizeQuestions(parsed.data.questions),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/questionnaires");
  revalidatePath(`/dashboard/questionnaires/${input.id}`);
  return { ok: true, message: "Saved." };
}

export async function deleteQuestionnaireAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await getServerSupabase();
  await supabase
    .from("questionnaires")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/dashboard/questionnaires");
}

export async function createFromStarterAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  if (!userId) redirect("/dashboard/questionnaires");

  const starter = getStarter(String(formData.get("starterId") ?? ""));
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("questionnaires")
    .insert({
      user_id: userId,
      title: starter?.title ?? "Untitled questionnaire",
      description: starter?.description ?? null,
      questions: starter ? normalizeQuestions(starter.questions) : [],
      updated_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  const id = (data as { id: string } | null)?.id;
  revalidatePath("/dashboard/questionnaires");
  redirect(
    id ? `/dashboard/questionnaires/${id}` : "/dashboard/questionnaires",
  );
}

// ---------------------------------------------------------------------------
// SEND — snapshot the questions to a per-client link + email
// ---------------------------------------------------------------------------

const sendSchema = z.object({
  questionnaireId: z.string().uuid(),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export async function sendQuestionnaireAction(
  input: z.infer<typeof sendSchema>,
): Promise<QResult<{ id: string; publicToken: string; emailSent: boolean }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Pick a questionnaire and a client." };
  }

  const supabase = await getServerSupabase();
  const { data: qData } = await supabase
    .from("questionnaires")
    .select("id, title, questions")
    .eq("id", parsed.data.questionnaireId)
    .eq("user_id", userId)
    .maybeSingle();
  const questionnaire = qData as
    | { id: string; title: string; questions: unknown }
    | null;
  if (!questionnaire) return { ok: false, error: "Questionnaire not found." };

  const { data: clientData } = await supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.data.clientId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!clientData) return { ok: false, error: "Client not found." };

  if (parsed.data.projectId) {
    const { data: projectData } = await supabase
      .from("projects")
      .select("id, client_id")
      .eq("id", parsed.data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    const project = projectData as { client_id?: string | null } | null;
    if (!project || project.client_id !== parsed.data.clientId) {
      return { ok: false, error: "That project does not belong to the selected client." };
    }
  }

  const notify = async (sendId: string, publicToken: string) => {
    const emailSent = await notifyClientOfQuestionnaire({
      userId,
      clientId: parsed.data.clientId,
      questionnaireId: questionnaire.id,
      sendId,
      title: questionnaire.title,
      questionCount: normalizeQuestions(questionnaire.questions).length,
      token: publicToken,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return {
      ok: true as const,
      data: { id: sendId, publicToken, emailSent },
      message: emailSent
        ? "Questionnaire emailed to the client."
        : "Questionnaire link created, but email delivery was not completed.",
    };
  };

  if (parsed.data.idempotencyKey) {
    const { data: existingRaw } = await supabase
      .from("questionnaire_sends")
      .select("id, public_token")
      .eq("user_id", userId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .maybeSingle();
    const existing = existingRaw as { id: string; public_token: string } | null;
    if (existing) return notify(existing.id, existing.public_token);
  }

  const token = makeToken();
  const { data, error } = await supabase
    .from("questionnaire_sends")
    .insert({
      user_id: userId,
      questionnaire_id: questionnaire.id,
      client_id: parsed.data.clientId,
      project_id: parsed.data.projectId ?? null,
      title: questionnaire.title,
      questions: normalizeQuestions(questionnaire.questions),
      responses: {},
      status: "sent",
      public_token: token,
      idempotency_key: parsed.data.idempotencyKey ?? null,
    } as never)
    .select("id, public_token")
    .single();
  if (error || !data) {
    if (error?.code === "23505" && parsed.data.idempotencyKey) {
      const { data: existingRaw } = await supabase
        .from("questionnaire_sends")
        .select("id, public_token")
        .eq("user_id", userId)
        .eq("idempotency_key", parsed.data.idempotencyKey)
        .maybeSingle();
      const existing = existingRaw as { id: string; public_token: string } | null;
      if (existing) return notify(existing.id, existing.public_token);
    }
    return { ok: false, error: error?.message ?? "Could not send." };
  }
  const created = data as { id: string; public_token: string };

  revalidatePath("/dashboard/questionnaires");
  return notify(created.id, created.public_token);
}

// ---------------------------------------------------------------------------
// SUBMIT — client fills the form (public, by token)
// ---------------------------------------------------------------------------

const submitSchema = z.object({
  token: z.string().trim().min(10).max(200),
  responses: z.record(z.string(), z.any()),
});

export async function submitQuestionnaireAction(
  input: z.infer<typeof submitSchema>,
): Promise<QResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid submission." };

  const admin = getAdminSupabase();
  const { data: found } = await admin
    .from("questionnaire_sends")
    .select("id, status")
    .eq("public_token", parsed.data.token)
    .maybeSingle();
  const send = found as { id: string; status: string } | null;
  if (!send) return { ok: false, error: "This form link is no longer valid." };
  if (send.status === "completed") {
    return { ok: false, error: "This form was already submitted." };
  }

  const { error } = await admin
    .from("questionnaire_sends")
    .update({
      responses: parsed.data.responses,
      status: "completed",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("public_token", parsed.data.token);
  if (error) return { ok: false, error: error.message };

  return { ok: true, message: "Thanks! Your answers were submitted." };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function notifyClientOfQuestionnaire(args: {
  userId: string;
  clientId: string;
  questionnaireId: string;
  sendId: string;
  title: string;
  questionCount?: number;
  token: string;
  idempotencyKey?: string;
}): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data: clientData } = await admin
    .from("clients")
    .select("email, full_name, business_name")
    .eq("id", args.clientId)
    .maybeSingle();
  const client = clientData as
    | { email: string | null; full_name: string; business_name: string | null }
    | null;
  if (!client?.email) return false;

  const { data: profile } = await admin
    .from("user_profiles")
    .select("business_name, full_name, email, brand_color, business_email, business_phone, website")
    .eq("id", args.userId)
    .maybeSingle();
  const p = profile as
    | {
        business_name: string | null;
        full_name: string | null;
        email: string | null;
        brand_color: string | null;
        business_email: string | null;
        business_phone: string | null;
        website: string | null;
      }
    | null;
  const hostName = p?.business_name || p?.full_name || "Your freelancer";
  const hostEmail = p?.business_email || p?.email || null;
  const clientName = client.business_name || client.full_name || "there";
  const url = `${getPublicAppUrl()}/q/${args.token}`;

  const rendered = renderQuestionnaireInviteEmail({
    title: args.title,
    clientName,
    hostName,
    questionCount: args.questionCount,
    publicUrl: url,
    brand: buildEmailBrand({
      businessName: p?.business_name ?? null,
      fullName: p?.full_name ?? null,
      brandColor: p?.brand_color ?? null,
      businessEmail: p?.business_email ?? null,
      email: p?.email ?? null,
      businessPhone: p?.business_phone ?? null,
      website: p?.website ?? null,
    }),
  });

  const delivery = await dispatchDelivery({
    userId: args.userId,
    kind: "questionnaire_sent",
    entityType: "questionnaire",
    entityId: args.questionnaireId,
    senderType: "share",
    to: { email: client.email, name: clientName },
    ...(hostEmail ? { replyTo: { email: hostEmail, name: hostName } } : {}),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: ["questionnaire"],
    metadata: { questionnaireSendId: args.sendId },
    idempotencyKey: args.idempotencyKey
      ? `questionnaire-email:${args.userId}:${args.idempotencyKey}`
      : null,
  });
  return delivery.ok;
}
