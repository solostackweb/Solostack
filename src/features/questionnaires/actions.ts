"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getClientIp, questionnaireSubmitLimit } from "@/lib/rate-limit";
import {
  followUpAnswerKey,
  OTHER_OPTION_VALUE,
  otherAnswerKey,
  normalizeQuestions,
  type Question,
} from "./types";
import { grantIncludesDriveFile } from "@/features/scheduling/google";
import {
  createQuestionnaireSpreadsheet,
  rebuildQuestionnaireSheet,
  syncQuestionnaireResponse,
} from "./google-sheets";
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
  allowOther: z.boolean().optional(),
  conditionalFollowUp: z.object({
    when: z.enum(["Yes", "No"]),
    label: z.string().trim().min(1).max(300),
    placeholder: z.string().trim().max(300).optional(),
  }).optional(),
  endFormOn: z.enum(["Yes", "No"]).optional(),
});

const upsertSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  publicLayout: z.enum(["guided", "classic"]).optional(),
  collectRespondentIdentity: z.boolean().optional(),
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
      public_layout: parsed.data.publicLayout ?? "guided",
      collect_respondent_identity: parsed.data.collectRespondentIdentity ?? true,
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
      public_layout: parsed.data.publicLayout ?? "guided",
      collect_respondent_identity: parsed.data.collectRespondentIdentity ?? true,
      questions: normalizeQuestions(parsed.data.questions),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  // Collector links are reusable views of the current template. Responses
  // retain their own snapshots, so updating these links cannot rewrite history.
  await supabase
    .from("questionnaire_sends")
    .update({
      title: parsed.data.title,
      public_layout: parsed.data.publicLayout ?? "guided",
      collect_respondent_identity: parsed.data.collectRespondentIdentity ?? true,
      questions: normalizeQuestions(parsed.data.questions),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("questionnaire_id", input.id)
    .eq("user_id", userId);
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

export async function saveQuestionnaireAsTemplateAction(
  questionnaireId: string,
): Promise<QResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const supabase = await getServerSupabase();
  const { data: source } = await supabase
    .from("questionnaires")
    .select("title, description, questions")
    .eq("id", questionnaireId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!source) return { ok: false, error: "Questionnaire not found." };
  const row = source as { title: string; description: string | null; questions: unknown };
  const { error } = await supabase.from("questionnaire_templates").insert({
    user_id: userId,
    title: row.title,
    description: row.description,
    questions: normalizeQuestions(row.questions),
  } as never);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/questionnaires");
  return { ok: true, message: "Saved to your questionnaire templates." };
}

export async function createFromSavedTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  if (!userId) redirect("/dashboard/questionnaires");
  const templateId = String(formData.get("templateId") ?? "");
  const supabase = await getServerSupabase();
  const { data: source } = await supabase
    .from("questionnaire_templates")
    .select("title, description, questions")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!source) redirect("/dashboard/questionnaires");
  const row = source as { title: string; description: string | null; questions: unknown };
  const { data } = await supabase.from("questionnaires").insert({
    user_id: userId,
    title: row.title,
    description: row.description,
    questions: normalizeQuestions(row.questions),
    updated_at: new Date().toISOString(),
  } as never).select("id").single();
  const id = (data as { id: string } | null)?.id;
  revalidatePath("/dashboard/questionnaires");
  redirect(id ? `/dashboard/questionnaires/${id}` : "/dashboard/questionnaires");
}

export async function deleteQuestionnaireTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await getServerSupabase();
  await supabase.from("questionnaire_templates").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard/questionnaires");
}

// ---------------------------------------------------------------------------
// SHARE — create a reusable, audience-neutral collection link
// ---------------------------------------------------------------------------

const sendSchema = z.object({
  questionnaireId: z.string().uuid(),
  linkName: z.string().trim().min(1).max(120).optional(),
  // Accepted temporarily for compatibility with older clients. New links are
  // always audience-neutral and these values are intentionally not persisted.
  clientId: z.string().uuid().optional(),
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
    return { ok: false, error: "Choose a questionnaire." };
  }

  const supabase = await getServerSupabase();
  const { data: qData } = await supabase
    .from("questionnaires")
    .select("id, title, questions, public_layout, collect_respondent_identity")
    .eq("id", parsed.data.questionnaireId)
    .eq("user_id", userId)
    .maybeSingle();
  const questionnaire = qData as
    | { id: string; title: string; questions: unknown; public_layout: "guided" | "classic"; collect_respondent_identity: boolean }
    | null;
  if (!questionnaire) return { ok: false, error: "Questionnaire not found." };

  const linkName = parsed.data.linkName ?? "Public collection link";
  const linked = (sendId: string, publicToken: string) => ({
    ok: true as const,
    data: { id: sendId, publicToken, emailSent: false },
    message: "Public questionnaire link is ready.",
  });

  if (parsed.data.idempotencyKey) {
    const { data: existingRaw } = await supabase
      .from("questionnaire_sends")
      .select("id, public_token")
      .eq("user_id", userId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .is("revoked_at", null)
      .maybeSingle();
    const existing = existingRaw as { id: string; public_token: string } | null;
    if (existing) {
      if (parsed.data.linkName) {
        const { error: renameError } = await supabase
          .from("questionnaire_sends")
          .update({ link_name: linkName } as never)
          .eq("id", existing.id)
          .eq("user_id", userId);
        if (renameError) return { ok: false, error: renameError.message };
      }
      return linked(existing.id, existing.public_token);
    }
  }

  const { data: reusableRaw } = await supabase
    .from("questionnaire_sends")
    .select("id, public_token")
    .eq("user_id", userId)
    .eq("questionnaire_id", questionnaire.id)
    .is("client_id", null)
    .is("project_id", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const reusable = reusableRaw as { id: string; public_token: string } | null;
  if (reusable) {
    if (parsed.data.linkName) {
      const { error: renameError } = await supabase
        .from("questionnaire_sends")
        .update({ link_name: linkName } as never)
        .eq("id", reusable.id)
        .eq("user_id", userId);
      if (renameError) return { ok: false, error: renameError.message };
    }
    return linked(reusable.id, reusable.public_token);
  }

  const token = makeToken();
  const { data, error } = await supabase
    .from("questionnaire_sends")
    .insert({
      user_id: userId,
      questionnaire_id: questionnaire.id,
      client_id: null,
      project_id: null,
      title: questionnaire.title,
      questions: normalizeQuestions(questionnaire.questions),
      public_layout: questionnaire.public_layout,
      collect_respondent_identity: questionnaire.collect_respondent_identity ?? true,
      link_name: linkName,
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
        .is("revoked_at", null)
        .maybeSingle();
      const existing = existingRaw as { id: string; public_token: string } | null;
      if (existing) return linked(existing.id, existing.public_token);
    }
    return { ok: false, error: error?.message ?? "Could not send." };
  }
  const created = data as { id: string; public_token: string };

  revalidatePath("/dashboard/questionnaires");
  return linked(created.id, created.public_token);
}

export async function revokeQuestionnaireLinkAction(sendId: string): Promise<QResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = z.string().uuid().safeParse(sendId);
  if (!parsed.success) return { ok: false, error: "Collection link not found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("questionnaire_sends").update({
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never).eq("id", parsed.data).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/questionnaires");
  return { ok: true, message: "Collection link deleted. Existing responses were preserved." };
}

export async function renameQuestionnaireLinkAction(
  sendId: string,
  linkName: string,
): Promise<QResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = z.object({
    sendId: z.string().uuid(),
    linkName: z.string().trim().min(1, "Enter a link name.").max(120),
  }).safeParse({ sendId, linkName });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid link name." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("questionnaire_sends").update({
    link_name: parsed.data.linkName,
    updated_at: new Date().toISOString(),
  } as never).eq("id", parsed.data.sendId).eq("user_id", userId).is("revoked_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/questionnaires");
  return { ok: true, message: "Link renamed." };
}

// ---------------------------------------------------------------------------
// SUBMIT — client fills the form (public, by token)
// ---------------------------------------------------------------------------

const submitSchema = z.object({
  token: z.string().trim().min(10).max(200),
  submissionKey: z.string().uuid(),
  respondentName: z.string().trim().min(1).max(200).optional(),
  respondentEmail: z.string().trim().email().max(320).optional(),
  responses: z.record(z.string(), z.union([
    z.string().max(10_000),
    z.array(z.string().max(1_000)).max(50),
  ])).refine((value) => JSON.stringify(value).length <= 100_000, "Submission is too large."),
});

function sanitizeResponses(questions: Question[], raw: Record<string, string | string[]>): QResult<{ responses: Record<string, string | string[]>; questions: Question[] }> {
  const clean: Record<string, string | string[]> = {};
  const reachable: Question[] = [];
  for (const question of questions) {
    reachable.push(question);
    const value = raw[question.id];
    const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (question.required && empty) return { ok: false, error: `Please answer: ${question.label}` };
    if (!empty) clean[question.id] = value;
    if (question.allowOther) {
      const otherSelected = value === OTHER_OPTION_VALUE || (Array.isArray(value) && value.includes(OTHER_OPTION_VALUE));
      const other = raw[otherAnswerKey(question.id)];
      if (otherSelected && (typeof other !== "string" || !other.trim())) {
        return { ok: false, error: `Please describe “Other” for: ${question.label}` };
      }
      if (otherSelected && typeof other === "string") clean[otherAnswerKey(question.id)] = other.trim();
    }
    const followUp = question.conditionalFollowUp;
    if (followUp && value === followUp.when) {
      const detail = raw[followUpAnswerKey(question.id)];
      if (typeof detail === "string" && detail.trim()) clean[followUpAnswerKey(question.id)] = detail.trim();
    }
    if (question.type === "yes_no" && question.endFormOn === value) break;
  }
  return { ok: true, data: { responses: clean, questions: reachable } };
}

export async function submitQuestionnaireAction(
  input: z.infer<typeof submitSchema>,
): Promise<QResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid submission." };

  const rate = await questionnaireSubmitLimit(`${await getClientIp()}:${parsed.data.token.slice(0, 24)}`);
  if (!rate.ok) return { ok: false, error: rate.message };

  const admin = getAdminSupabase();
  const { data: found } = await admin
    .from("questionnaire_sends")
    .select("id, user_id, questionnaire_id, client_id, project_id, questions, collect_respondent_identity")
    .eq("public_token", parsed.data.token)
    .is("revoked_at", null)
    .maybeSingle();
  const send = found as {
    id: string;
    user_id: string;
    questionnaire_id: string | null;
    client_id: string | null;
    project_id: string | null;
    questions: unknown;
    collect_respondent_identity: boolean;
  } | null;
  if (!send) return { ok: false, error: "This form link is no longer valid." };
  let questions = normalizeQuestions(send.questions);
  let collectRespondentIdentity = send.collect_respondent_identity ?? true;
  if (send.questionnaire_id) {
    const { data: current } = await admin
      .from("questionnaires")
      .select("questions, active, collect_respondent_identity")
      .eq("id", send.questionnaire_id)
      .maybeSingle();
    const live = current as { questions: unknown; active: boolean; collect_respondent_identity: boolean } | null;
    if (live && !live.active) return { ok: false, error: "This questionnaire is not accepting responses." };
    if (live) {
      questions = normalizeQuestions(live.questions);
      collectRespondentIdentity = live.collect_respondent_identity ?? true;
    }
  }
  if (collectRespondentIdentity && (!parsed.data.respondentName || !parsed.data.respondentEmail)) {
    return { ok: false, error: "Please enter your name and a valid email address." };
  }
  const sanitized = sanitizeResponses(questions, parsed.data.responses);
  if (!sanitized.ok) return { ok: false, error: sanitized.error };
  if (!sanitized.data) return { ok: false, error: "Invalid submission." };
  const respondentQuestions: Question[] = collectRespondentIdentity ? [
    { id: "__respondent_name", type: "short_text", label: "Name", required: true },
    { id: "__respondent_email", type: "email", label: "Email", required: true },
  ] : [];
  const respondentResponses = {
    ...(collectRespondentIdentity ? {
      __respondent_name: parsed.data.respondentName!.trim(),
      __respondent_email: parsed.data.respondentEmail!.trim().toLowerCase(),
    } : {}),
    ...sanitized.data.responses,
  };
  const { data, error } = await admin
    .from("questionnaire_responses")
    .insert({
      user_id: send.user_id,
      send_id: send.id,
      questionnaire_id: send.questionnaire_id,
      client_id: send.client_id,
      project_id: send.project_id,
      submission_key: parsed.data.submissionKey,
      questions: [...respondentQuestions, ...sanitized.data.questions],
      responses: respondentResponses,
    } as never)
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: true, message: "This response was already received." };
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save the response." };
  // Best effort only: the database response is authoritative and must succeed
  // even while Google is unavailable.
  await syncQuestionnaireResponse((data as { id: string }).id);
  return { ok: true, message: "Thanks! Your answers were submitted." };
}

export async function connectQuestionnaireSheetAction(
  questionnaireId: string,
): Promise<QResult<{ spreadsheetUrl?: string; reconnectUrl?: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsedId = z.string().uuid().safeParse(questionnaireId);
  if (!parsedId.success) return { ok: false, error: "Questionnaire not found." };
  const supabase = await getServerSupabase();
  const [{ data: qRaw }, { data: connectionRaw }] = await Promise.all([
    supabase.from("questionnaires").select("title, questions").eq("id", questionnaireId).eq("user_id", userId).maybeSingle(),
    supabase.from("calendar_connections").select("refresh_token, scope").eq("user_id", userId).maybeSingle(),
  ]);
  const questionnaire = qRaw as { title: string; questions: unknown } | null;
  if (!questionnaire) return { ok: false, error: "Questionnaire not found." };
  const connection = connectionRaw as { refresh_token: string | null; scope: string | null } | null;
  const reconnectUrl = `/api/google/connect?feature=questionnaire-sheets&next=${encodeURIComponent(`/dashboard/questionnaires/${questionnaireId}/responses`)}`;
  if (!connection?.refresh_token || !grantIncludesDriveFile(connection.scope)) {
    return { ok: true, data: { reconnectUrl }, message: "Connect Google to grant access to a response sheet." };
  }
  try {
    const integration = await createQuestionnaireSpreadsheet({
      userId,
      questionnaireId,
      title: questionnaire.title,
      questions: normalizeQuestions(questionnaire.questions),
    });
    await rebuildQuestionnaireSheet(questionnaireId, userId);
    revalidatePath(`/dashboard/questionnaires/${questionnaireId}/responses`);
    return { ok: true, data: { spreadsheetUrl: integration.spreadsheet_url }, message: "Google Sheet connected and existing responses synced." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create the response sheet." };
  }
}

export async function repairQuestionnaireSheetAction(questionnaireId: string): Promise<QResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = z.string().uuid().safeParse(questionnaireId);
  if (!parsed.success) return { ok: false, error: "Questionnaire not found." };
  try {
    const integration = await rebuildQuestionnaireSheet(parsed.data, userId);
    if (!integration) return { ok: false, error: "Connect Google Sheets first." };
    revalidatePath(`/dashboard/questionnaires/${parsed.data}/responses`);
    return { ok: true, message: "Google Sheet repaired and rebuilt from current Stackivo responses." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not repair the response sheet." };
  }
}

export async function deleteQuestionnaireResponseAction(responseId: string): Promise<QResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = z.string().uuid().safeParse(responseId);
  if (!parsed.success) return { ok: false, error: "Response not found." };
  const supabase = await getServerSupabase();
  const { data: responseRaw } = await supabase.from("questionnaire_responses")
    .select("id, questionnaire_id")
    .eq("id", parsed.data)
    .eq("user_id", userId)
    .maybeSingle();
  const response = responseRaw as { id: string; questionnaire_id: string | null } | null;
  if (!response) return { ok: false, error: "Response not found." };

  if (response.questionnaire_id) {
    try {
      await rebuildQuestionnaireSheet(response.questionnaire_id, userId, { excludeResponseId: response.id });
    } catch (error) {
      return {
        ok: false,
        error: `The response was kept because its Google Sheet row could not be removed. ${error instanceof Error ? error.message : "Reconnect Google and try again."}`,
      };
    }
  }
  const { error } = await supabase.from("questionnaire_responses").delete()
    .eq("id", response.id)
    .eq("user_id", userId);
  if (error) {
    if (response.questionnaire_id) {
      try { await rebuildQuestionnaireSheet(response.questionnaire_id, userId); } catch { /* best-effort rollback */ }
    }
    return { ok: false, error: error.message };
  }
  if (response.questionnaire_id) revalidatePath(`/dashboard/questionnaires/${response.questionnaire_id}/responses`);
  return { ok: true, message: "Response deleted from Stackivo and Google Sheets." };
}

export async function retryQuestionnaireSheetSyncAction(responseId: string): Promise<QResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("questionnaire_responses").select("id, questionnaire_id").eq("id", responseId).eq("user_id", userId).maybeSingle();
  const response = data as { id: string; questionnaire_id: string | null } | null;
  if (!response) return { ok: false, error: "Response not found." };
  const ok = await syncQuestionnaireResponse(response.id);
  if (response.questionnaire_id) revalidatePath(`/dashboard/questionnaires/${response.questionnaire_id}/responses`);
  return ok ? { ok: true, message: "Response synced." } : { ok: false, error: "Google Sheets sync failed. Reconnect Google and try again." };
}
