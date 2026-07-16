import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  QuestionnaireRow,
  QuestionnaireSendRow,
} from "@/lib/supabase/types";
import {
  mapQuestionnaireRow,
  mapQuestionnaireSendRow,
  type Questionnaire,
  type QuestionnaireSend,
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
): Promise<{ send: QuestionnaireSend; hostName: string } | null> {
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

  return { send: mapQuestionnaireSendRow(row), hostName };
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
