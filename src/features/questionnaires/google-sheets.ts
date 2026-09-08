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
  { key: "__response_id", label: "Response ID" },
] as const;
const RESPONDENT_COLUMNS = [
  { key: "__respondent_name", label: "Name" },
  { key: "__respondent_email", label: "Email" },
] as const;

export interface SheetColumn {
  key: string;
  label: string;
}

async function formatResponseSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number,
  responseIdColumnIndex: number,
): Promise<void> {
  await sheetsRequest(accessToken, `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.145, green: 0.388, blue: 0.922 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                horizontalAlignment: "LEFT",
                verticalAlignment: "MIDDLE",
                wrapStrategy: "WRAP",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
            cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "WRAP" } },
            fields: "userEnteredFormat(verticalAlignment,wrapStrategy)",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 42 },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 180 },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: Math.min(4, columnCount) },
            properties: { pixelSize: 220 },
            fields: "pixelSize",
          },
        },
        ...(columnCount > 4 ? [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: columnCount },
            properties: { pixelSize: 280 },
            fields: "pixelSize",
          },
        }] : []),
        ...(responseIdColumnIndex >= 0 ? [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: responseIdColumnIndex, endIndex: responseIdColumnIndex + 1 },
            properties: { hiddenByUser: true },
            fields: "hiddenByUser",
          },
        }] : []),
        {
          setBasicFilter: {
            filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: columnCount } },
          },
        },
      ],
    }),
  });
}

async function resolveSheetId(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
): Promise<number> {
  const spreadsheet = await sheetsRequest<{
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(accessToken, `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
    method: "GET",
  });
  const exact = spreadsheet.sheets?.find((sheet) => sheet.properties?.title === sheetTitle);
  const sheetId = exact?.properties?.sheetId;
  if (typeof sheetId !== "number") {
    throw new Error(`The “${sheetTitle}” tab could not be found in the connected Google Sheet.`);
  }
  return sheetId;
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
    sheets?: Array<{ properties?: { sheetId?: number } }>;
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
  const sheetId = created.sheets?.[0]?.properties?.sheetId
    ?? await resolveSheetId(accessToken, created.spreadsheetId, sheetTitle);
  await formatResponseSheet(accessToken, created.spreadsheetId, sheetId, columns.length, columns.findIndex((column) => column.key === "__response_id"));
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("questionnaire_sheet_integrations")
    .upsert({
      user_id: args.userId,
      questionnaire_id: args.questionnaireId,
      spreadsheet_id: created.spreadsheetId,
      spreadsheet_url: created.spreadsheetUrl,
      sheet_title: sheetTitle,
      sheet_id: sheetId,
      format_version: 2,
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
  let integration = integrationRaw as QuestionnaireSheetIntegrationRow | null;
  if (!integration) {
    const [{ data: connectionRaw }, { data: questionnaireRaw }] = await Promise.all([
      admin
        .from("calendar_connections")
        .select("refresh_token, scope")
        .eq("user_id", response.user_id)
        .maybeSingle(),
      admin
        .from("questionnaires")
        .select("title, questions")
        .eq("id", response.questionnaire_id)
        .eq("user_id", response.user_id)
        .maybeSingle(),
    ]);
    const connection = connectionRaw as { refresh_token: string | null; scope: string | null } | null;
    const questionnaire = questionnaireRaw as { title: string; questions: unknown } | null;
    const driveScope = "https://www.googleapis.com/auth/drive.file";
    const canCreateSheet = Boolean(
      connection?.refresh_token &&
      connection.scope?.split(/\s+/).includes(driveScope) &&
      questionnaire,
    );
    if (!canCreateSheet || !questionnaire) return false;
    try {
      integration = await createQuestionnaireSpreadsheet({
        userId: response.user_id,
        questionnaireId: response.questionnaire_id,
        title: questionnaire.title,
        questions: Array.isArray(questionnaire.questions)
          ? (questionnaire.questions as Question[])
          : [],
      });
    } catch {
      return false;
    }
  }

  await admin.from("questionnaire_responses").update({ sheets_sync_status: "pending", sheets_sync_error: null } as never).eq("id", response.id);
  try {
    const accessToken = await accessTokenForBooking(response.user_id);
    if (!accessToken) throw new Error("Google needs to be reconnected.");
    const sheetId = await resolveSheetId(accessToken, integration.spreadsheet_id, integration.sheet_title);
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
    }
    if (headersChanged || (integration.format_version ?? 0) < 2 || integration.sheet_id !== sheetId) {
      await formatResponseSheet(accessToken, integration.spreadsheet_id, sheetId, columns.length, columns.findIndex((column) => column.key === "__response_id"));
      await admin.from("questionnaire_sheet_integrations").update({
        columns,
        sheet_id: sheetId,
        format_version: 2,
        updated_at: new Date().toISOString(),
      } as never).eq("id", integration.id);
    }
    const answerMap = response.responses && typeof response.responses === "object"
      ? (response.responses as Record<string, unknown>)
      : {};
    const meta: Record<string, unknown> = {
      submitted_at: response.submitted_at,
      __response_id: response.id,
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

export async function rebuildQuestionnaireSheet(
  questionnaireId: string,
  userId: string,
  options: { excludeResponseId?: string } = {},
): Promise<QuestionnaireSheetIntegrationRow | null> {
  const admin = getAdminSupabase();
  const [{ data: integrationRaw }, { data: questionnaireRaw }, { data: responsesRaw }] = await Promise.all([
    admin.from("questionnaire_sheet_integrations").select("*").eq("questionnaire_id", questionnaireId).eq("user_id", userId).eq("active", true).maybeSingle(),
    admin.from("questionnaires").select("questions").eq("id", questionnaireId).eq("user_id", userId).maybeSingle(),
    admin.from("questionnaire_responses").select("*").eq("questionnaire_id", questionnaireId).eq("user_id", userId).order("submitted_at", { ascending: true }),
  ]);
  const integration = integrationRaw as QuestionnaireSheetIntegrationRow | null;
  if (!integration) return null;
  const accessToken = await accessTokenForBooking(userId);
  if (!accessToken) throw new Error("Reconnect Google before repairing this response sheet.");
  const sheetId = await resolveSheetId(accessToken, integration.spreadsheet_id, integration.sheet_title);
  const questionnaire = questionnaireRaw as { questions: unknown } | null;
  const responses = ((responsesRaw ?? []) as Array<{
    id: string;
    questions: unknown;
    responses: unknown;
    submitted_at: string;
  }>).filter((response) => response.id !== options.excludeResponseId);

  const responseQuestions = responses.flatMap((response) => Array.isArray(response.questions) ? response.questions as Question[] : []);
  const allQuestions = [
    ...(questionnaire && Array.isArray(questionnaire.questions) ? questionnaire.questions as Question[] : []),
    ...responseQuestions,
  ].filter((question) => !question.id.startsWith("__respondent_"));
  const questionColumnList = questionColumns(allQuestions);
  const uniqueQuestionColumns = questionColumnList.filter((column, index) => questionColumnList.findIndex((candidate) => candidate.key === column.key) === index);
  const columns: SheetColumn[] = [...BASE_COLUMNS, ...RESPONDENT_COLUMNS, ...uniqueQuestionColumns];
  const rows = responses.map((response) => {
    const answers = response.responses && typeof response.responses === "object"
      ? response.responses as Record<string, unknown>
      : {};
    const meta: Record<string, unknown> = { submitted_at: response.submitted_at, __response_id: response.id };
    return columns.map((column) => printable(column.key in meta ? meta[column.key] : answers[column.key]));
  });
  const range = `${integration.sheet_title}!A1:${columnName(columns.length)}${Math.max(1, rows.length + 1)}`;
  await sheetsRequest(accessToken, `${SHEETS_API}/${integration.spreadsheet_id}/values/${encodeURIComponent(integration.sheet_title)}:clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  await sheetsRequest(accessToken, `${SHEETS_API}/${integration.spreadsheet_id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [columns.map((column) => column.label), ...rows] }),
  });
  await formatResponseSheet(accessToken, integration.spreadsheet_id, sheetId, columns.length, columns.findIndex((column) => column.key === "__response_id"));
  const now = new Date().toISOString();
  await Promise.all([
    admin.from("questionnaire_sheet_integrations").update({
      columns,
      sheet_id: sheetId,
      format_version: 2,
      last_synced_at: now,
      last_error: null,
      updated_at: now,
    } as never).eq("id", integration.id),
    admin.from("questionnaire_responses").update({
      sheets_sync_status: "synced",
      sheets_synced_at: now,
      sheets_sync_error: null,
    } as never).eq("questionnaire_id", questionnaireId).eq("user_id", userId),
  ]);
  return {
    ...integration,
    columns: columns as unknown as QuestionnaireSheetIntegrationRow["columns"],
    sheet_id: sheetId,
    format_version: 2,
    last_synced_at: now,
    last_error: null,
  };
}
