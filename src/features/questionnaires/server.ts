import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  QuestionnaireRow,
  QuestionnaireResponseRow,
  QuestionnaireSendRow,
  QuestionnaireSheetIntegrationRow,
} from "@/lib/supabase/types";
import {
  mapQuestionnaireRow,
  mapQuestionnaireResponseRow,
  mapQuestionnaireSendRow,
  mapQuestionnaireSheetIntegrationRow,
  normalizeQuestions,
  type Questionnaire,
  type QuestionnaireResponse,
  type QuestionnaireSend,
  type QuestionnaireSheetIntegration,
} from "./types";

async function currentUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listQuestionnaires(): Promise<Questionnaire[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as QuestionnaireRow[]).map(mapQuestionnaireRow);
}

export async function getQuestionnaire(
  id: string,
): Promise<Questionnaire | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as QuestionnaireRow | null;
  return row ? mapQuestionnaireRow(row) : null;
}

export interface SendFilter {
  clientId?: string;
  projectId?: string;
  questionnaireId?: string;
}

export async function listSendsForOwner(
  filter: SendFilter = {},
): Promise<QuestionnaireSend[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const supabase = await getServerSupabase();
  let query = supabase
    .from("questionnaire_sends")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.projectId) query = query.eq("project_id", filter.projectId);
  if (filter.questionnaireId)
    query = query.eq("questionnaire_id", filter.questionnaireId);
  const { data } = await query;
  return ((data ?? []) as QuestionnaireSendRow[]).map(mapQuestionnaireSendRow);
}

/** Public lookup by token — the client-facing fill page (no auth). */
export async function getQuestionnaireSendByToken(
  token: string,
): Promise<{ send: QuestionnaireSend; hostName: string; description: string | null } | null> {
  if (!token) return null;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("questionnaire_sends")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  const row = data as QuestionnaireSendRow | null;
  if (!row) return null;

  const { data: profile } = await admin
    .from("user_profiles")
    .select("business_name, company_name, legal_name, full_name")
    .eq("id", row.user_id)
    .maybeSingle();
  const p = profile as
    | {
        business_name: string | null;
        company_name: string | null;
        legal_name: string | null;
        full_name: string | null;
      }
    | null;
  const hostName =
    p?.business_name ||
    p?.company_name ||
    p?.legal_name ||
    p?.full_name ||
    "Your freelancer";

  let send = mapQuestionnaireSendRow(row);
  let description: string | null = null;
  if (row.questionnaire_id) {
    const { data: questionnaireRaw } = await admin
      .from("questionnaires")
      .select("title, description, questions, active")
      .eq("id", row.questionnaire_id)
      .maybeSingle();
    const questionnaire = questionnaireRaw as {
      title: string;
      description: string | null;
      questions: unknown;
      active: boolean;
    } | null;
    if (questionnaire && !questionnaire.active) return null;
    if (questionnaire?.active) {
      send = {
        ...send,
        title: questionnaire.title,
        questions: normalizeQuestions(questionnaire.questions),
      };
      description = questionnaire.description;
    }
  }

  return { send, hostName, description };
}

export async function listResponsesForOwner(questionnaireId: string): Promise<QuestionnaireResponse[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("questionnaire_responses")
    .select("*")
    .eq("user_id", userId)
    .eq("questionnaire_id", questionnaireId)
    .order("submitted_at", { ascending: false });
  return ((data ?? []) as QuestionnaireResponseRow[]).map(mapQuestionnaireResponseRow);
}

export async function getQuestionnaireSheetIntegration(
  questionnaireId: string,
): Promise<QuestionnaireSheetIntegration | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("questionnaire_sheet_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("questionnaire_id", questionnaireId)
    .maybeSingle();
  const row = data as QuestionnaireSheetIntegrationRow | null;
  return row ? mapQuestionnaireSheetIntegrationRow(row) : null;
}

/** Sends tied to a client — for the client 360 / portal (service-role). */
export async function listSendsForClient(
  clientId: string,
): Promise<QuestionnaireSend[]> {
  if (!clientId) return [];
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("questionnaire_sends")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as QuestionnaireSendRow[]).map(mapQuestionnaireSendRow);
}
