import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { QuestionnaireSheetIntegrationRow } from "@/lib/supabase/types";
import { accessTokenForBooking } from "@/features/scheduling/server";
import {
  followUpAnswerKey,
  OTHER_OPTION_VALUE,
  otherAnswerKey,
  type Question,
} from "./types";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const BASE_COLUMNS = [
  { key: "submitted_at", label: "Submitted at" },
] as const;
const RESPONDENT_COLUMNS = [
  { key: "__respondent_name", label: "Name" },
  { key: "__respondent_email", label: "Email" },
] as const;

export interface SheetColumn {
  key: string;
  label: string;
}

function questionColumns(questions: Question[]): SheetColumn[] {
  return questions.flatMap((question) => {
    const columns: SheetColumn[] = [{ key: question.id, label: question.label }];
    if (question.allowOther) {
      columns.push({ key: otherAnswerKey(question.id), label: `${question.label} — Other` });
    }
    if (question.conditionalFollowUp) {
      columns.push({
        key: followUpAnswerKey(question.id),
        label: question.conditionalFollowUp.label,
      });
    }
    return columns;
  });
}

function normalizeColumns(raw: unknown): SheetColumn[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    return typeof row.key === "string" && typeof row.label === "string"
      ? [{ key: row.key, label: row.label }]
      : [];
  });
}

function columnName(position: number): string {
  let value = Math.max(1, position);
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function printable(value: unknown): string | number | boolean {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === OTHER_OPTION_VALUE ? "Other" : String(item)))
      .join(", ");
  }
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value === OTHER_OPTION_VALUE ? "Other" : value;
  }
  return JSON.stringify(value);
}

async function sheetsRequest<T>(
  accessToken: string,
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Google Sheets returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as T;
}

export async function createQuestionnaireSpreadsheet(args: {
  userId: string;
  questionnaireId: string;
  title: string;
  questions: Question[];
}): Promise<QuestionnaireSheetIntegrationRow> {
  const accessToken = await accessTokenForBooking(args.userId);
  if (!accessToken) throw new Error("Reconnect Google before creating a response sheet.");
  const sheetTitle = "Responses";
  const created = await sheetsRequest<{
    spreadsheetId: string;
    spreadsheetUrl: string;
  }>(accessToken, SHEETS_API, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: `Stackivo — ${args.title} responses` },
      sheets: [{ properties: { title: sheetTitle, gridProperties: { frozenRowCount: 1 } } }],
    }),
  });
  const columns: SheetColumn[] = [
    ...BASE_COLUMNS,
    ...RESPONDENT_COLUMNS,
    ...questionColumns(args.questions),
  ];
  const last = columnName(columns.length);
  await sheetsRequest(accessToken, `${SHEETS_API}/${created.spreadsheetId}/values/${encodeURIComponent(`${sheetTitle}!A1:${last}1`)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [columns.map((column) => column.label)] }),
  });
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("questionnaire_sheet_integrations")
    .upsert({
      user_id: args.userId,
      questionnaire_id: args.questionnaireId,
      spreadsheet_id: created.spreadsheetId,
      spreadsheet_url: created.spreadsheetUrl,
      sheet_title: sheetTitle,
      columns,
      active: true,
      last_error: null,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: "questionnaire_id" })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the Sheets connection.");
  return data as QuestionnaireSheetIntegrationRow;
}

export async function syncQuestionnaireResponse(responseId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data: responseRaw } = await admin
    .from("questionnaire_responses")
    .select("*")
    .eq("id", responseId)
    .maybeSingle();
  const response = responseRaw as {
    id: string;
    user_id: string;
    questionnaire_id: string | null;
    client_id: string | null;
    project_id: string | null;
    questions: unknown;
    responses: unknown;
    submitted_at: string;
  } | null;
  if (!response?.questionnaire_id) return false;
  const { data: integrationRaw } = await admin
    .from("questionnaire_sheet_integrations")
    .select("*")
    .eq("questionnaire_id", response.questionnaire_id)
    .eq("active", true)
    .maybeSingle();
  const integration = integrationRaw as QuestionnaireSheetIntegrationRow | null;
  if (!integration) return false;

  await admin.from("questionnaire_responses").update({ sheets_sync_status: "pending", sheets_sync_error: null } as never).eq("id", response.id);
  try {
    const accessToken = await accessTokenForBooking(response.user_id);
    if (!accessToken) throw new Error("Google needs to be reconnected.");
    const questions = Array.isArray(response.questions) ? (response.questions as Question[]) : [];
    const desiredColumns: SheetColumn[] = [...BASE_COLUMNS, ...questionColumns(questions)];
    const existingColumns = normalizeColumns(integration.columns);
    const columns = [
      ...existingColumns.map((column) => desiredColumns.find((desired) => desired.key === column.key) ?? column),
      ...desiredColumns.filter((candidate) => !existingColumns.some((column) => column.key === candidate.key)),
    ];
    const headersChanged = JSON.stringify(columns) !== JSON.stringify(existingColumns);
    if (headersChanged) {
      const last = columnName(columns.length);
      await sheetsRequest(accessToken, `${SHEETS_API}/${integration.spreadsheet_id}/values/${encodeURIComponent(`${integration.sheet_title}!A1:${last}1`)}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [columns.map((column) => column.label)] }),
      });
      await admin.from("questionnaire_sheet_integrations").update({ columns, updated_at: new Date().toISOString() } as never).eq("id", integration.id);
    }
    const answerMap = response.responses && typeof response.responses === "object"
      ? (response.responses as Record<string, unknown>)
      : {};
    const meta: Record<string, unknown> = {
      submitted_at: response.submitted_at,
    };
    const row = columns.map((column) => printable(column.key in meta ? meta[column.key] : answerMap[column.key]));
    await sheetsRequest(accessToken, `${SHEETS_API}/${integration.spreadsheet_id}/values/${encodeURIComponent(`${integration.sheet_title}!A:${columnName(columns.length)}`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: [row] }),
    });
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("questionnaire_responses").update({ sheets_sync_status: "synced", sheets_synced_at: now, sheets_sync_error: null } as never).eq("id", response.id),
      admin.from("questionnaire_sheet_integrations").update({ last_synced_at: now, last_error: null, updated_at: now } as never).eq("id", integration.id),
    ]);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Google Sheets sync failed.";
    await Promise.all([
      admin.from("questionnaire_responses").update({ sheets_sync_status: "failed", sheets_sync_error: message } as never).eq("id", response.id),
      admin.from("questionnaire_sheet_integrations").update({ last_error: message, updated_at: new Date().toISOString() } as never).eq("id", integration.id),
    ]);
    return false;
  }
}
