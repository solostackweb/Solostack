import type {
  QuestionnaireRow,
  QuestionnaireSendRow,
} from "@/lib/supabase/types";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "dropdown"
  | "yes_no"
  | "rating"
  | "date"
  | "file";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  /** Choices for single_choice / multi_choice / dropdown. */
  options?: string[];
  /** Rating scale max (default 5). */
  max?: number;
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
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
    if (questionNeedsOptions(type)) {
      q.options = Array.isArray(r.options)
        ? r.options.filter(
            (o): o is string => typeof o === "string" && o.trim().length > 0,
          )
        : [];
    }
    if (type === "rating") {
      const max = Number(r.max);
      q.max = Number.isFinite(max) && max >= 2 && max <= 10 ? Math.floor(max) : 5;
    }
    out.push(q);
  }
  return out;
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
  updatedAt: string;
}

export function mapQuestionnaireRow(row: QuestionnaireRow): Questionnaire {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questions: normalizeQuestions(row.questions),
    active: row.active,
    updatedAt: row.updated_at,
  };
}

export interface QuestionnaireSend {
  id: string;
  title: string;
  questions: Question[];
  responses: Record<string, unknown>;
  status: string;
  publicToken: string;
  clientId: string | null;
  projectId: string | null;
  submittedAt: string | null;
  createdAt: string;
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
    publicToken: row.public_token,
    clientId: row.client_id,
    projectId: row.project_id,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  };
}
