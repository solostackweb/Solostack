import type {
  QuestionnaireResponseRow,
  QuestionnaireRow,
  QuestionnaireSendRow,
  QuestionnaireSheetIntegrationRow,
  QuestionnaireTemplateRow,
} from "@/lib/supabase/types";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "single_choice"
  | "multi_choice"
  | "dropdown"
  | "yes_no"
  | "rating"
  | "date"
  | "file";

export type QuestionnairePublicLayout = "guided" | "classic";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  /** Optional hint shown under the question on the client form. */
  help?: string;
  /** Choices for single_choice / multi_choice / dropdown. */
  options?: string[];
  /** Rating scale max (default 5). */
  max?: number;
  /** Let respondents provide a free-text choice. */
  allowOther?: boolean;
  /** Optional text prompt revealed by a Yes / No answer. */
  conditionalFollowUp?: {
    when: "Yes" | "No";
    label: string;
    placeholder?: string;
  };
  /** Finish and submit the questionnaire when this Yes / No answer is chosen. */
  endFormOn?: "Yes" | "No";
}

export const OTHER_OPTION_VALUE = "__stackivo_other__";
export const otherAnswerKey = (questionId: string) => `${questionId}__other`;
export const followUpAnswerKey = (questionId: string) => `${questionId}__followup`;

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  single_choice: "Multiple choice",
  multi_choice: "Checkboxes",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  rating: "Rating",
  date: "Date",
  file: "File link",
};

export const QUESTION_TYPES: QuestionType[] = [
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
];

export function questionNeedsOptions(type: QuestionType): boolean {
  return (
    type === "single_choice" || type === "multi_choice" || type === "dropdown"
  );
}

export function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeQuestions(raw: unknown): Question[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: Question[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = QUESTION_TYPES.includes(r.type as QuestionType)
      ? (r.type as QuestionType)
      : "short_text";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!label) continue;
    const q: Question = {
      id: typeof r.id === "string" && r.id ? r.id : newQuestionId(),
      type,
      label,
      required: Boolean(r.required),
    };
    if (typeof r.help === "string" && r.help.trim()) {
      q.help = r.help.trim();
    }
    if (questionNeedsOptions(type)) {
      q.options = Array.isArray(r.options)
        ? r.options.filter(
            (o): o is string => typeof o === "string" && o.trim().length > 0,
          )
        : [];
      q.allowOther = Boolean(r.allowOther);
    }
    if (type === "rating") {
      const max = Number(r.max);
      q.max = Number.isFinite(max) && max >= 2 && max <= 10 ? Math.floor(max) : 5;
    }
    if (type === "yes_no" && r.conditionalFollowUp && typeof r.conditionalFollowUp === "object") {
      const followUp = r.conditionalFollowUp as Record<string, unknown>;
      const followUpLabel = typeof followUp.label === "string" ? followUp.label.trim() : "";
      if (followUpLabel) {
        q.conditionalFollowUp = {
          when: followUp.when === "No" ? "No" : "Yes",
          label: followUpLabel,
          ...(typeof followUp.placeholder === "string" && followUp.placeholder.trim()
            ? { placeholder: followUp.placeholder.trim() }
            : {}),
        };
      }
    }
    if (type === "yes_no" && (r.endFormOn === "Yes" || r.endFormOn === "No")) {
      q.endFormOn = r.endFormOn;
    }
    out.push(q);
  }
  return out;
}

export interface QuestionnaireResponse {
  id: string;
  sendId: string;
  questionnaireId: string | null;
  clientId: string | null;
  projectId: string | null;
  questions: Question[];
  responses: Record<string, unknown>;
  sheetsSyncStatus: string;
  sheetsSyncError: string | null;
  sheetsSyncedAt: string | null;
  submittedAt: string;
}

export function mapQuestionnaireResponseRow(row: QuestionnaireResponseRow): QuestionnaireResponse {
  const responses = row.responses && typeof row.responses === "object" && !Array.isArray(row.responses)
    ? (row.responses as Record<string, unknown>)
    : {};
  return {
    id: row.id,
    sendId: row.send_id,
    questionnaireId: row.questionnaire_id,
    clientId: row.client_id,
    projectId: row.project_id,
    questions: normalizeQuestions(row.questions),
    responses,
    sheetsSyncStatus: row.sheets_sync_status,
    sheetsSyncError: row.sheets_sync_error,
    sheetsSyncedAt: row.sheets_synced_at,
    submittedAt: row.submitted_at,
  };
}

export interface QuestionnaireSheetIntegration {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetTitle: string;
  sheetId: number;
  active: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export function mapQuestionnaireSheetIntegrationRow(
  row: QuestionnaireSheetIntegrationRow,
): QuestionnaireSheetIntegration {
  return {
    spreadsheetId: row.spreadsheet_id,
    spreadsheetUrl: row.spreadsheet_url,
    sheetTitle: row.sheet_title,
    sheetId: row.sheet_id,
    active: row.active,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  };
}

// ---------------------------------------------------------------------------
// UI-facing models
// ---------------------------------------------------------------------------

export interface Questionnaire {
  id: string;
  title: string;
  description: string | null;
  questions: Question[];
  active: boolean;
  publicLayout: QuestionnairePublicLayout;
  updatedAt: string;
}

export function mapQuestionnaireRow(row: QuestionnaireRow): Questionnaire {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questions: normalizeQuestions(row.questions),
    active: row.active,
    publicLayout: row.public_layout ?? "guided",
    updatedAt: row.updated_at,
  };
}

export interface QuestionnaireSend {
  id: string;
  title: string;
  questions: Question[];
  responses: Record<string, unknown>;
  status: string;
  publicLayout: QuestionnairePublicLayout;
  publicToken: string;
  clientId: string | null;
  projectId: string | null;
  submittedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export function mapQuestionnaireSendRow(
  row: QuestionnaireSendRow,
): QuestionnaireSend {
  const responses =
    row.responses &&
    typeof row.responses === "object" &&
    !Array.isArray(row.responses)
      ? (row.responses as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    title: row.title,
    questions: normalizeQuestions(row.questions),
    responses,
    status: row.status,
    publicLayout: row.public_layout ?? "guided",
    publicToken: row.public_token,
    clientId: row.client_id,
    projectId: row.project_id,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

export interface QuestionnaireTemplate {
  id: string;
  title: string;
  description: string | null;
  questions: Question[];
  updatedAt: string;
}

export function mapQuestionnaireTemplateRow(row: QuestionnaireTemplateRow): QuestionnaireTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questions: normalizeQuestions(row.questions),
    updatedAt: row.updated_at,
  };
}
