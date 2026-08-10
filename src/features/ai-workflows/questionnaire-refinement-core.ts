import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { normalizeQuestions } from "@/features/questionnaires/types";

export const questionnaireRevisionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable(),
  questions: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    type: z.enum([
      "short_text", "long_text", "email", "phone", "number", "single_choice",
      "multi_choice", "dropdown", "yes_no", "rating", "date", "file",
    ]),
    label: z.string().trim().min(1).max(300),
    required: z.boolean(),
    help: z.string().trim().max(300).optional(),
    options: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    max: z.number().int().min(2).max(10).optional(),
  })).min(1).max(60),
});

export type QuestionnaireRevision = z.infer<typeof questionnaireRevisionSchema>;

export function normalizeQuestionnaireRevision(value: QuestionnaireRevision): QuestionnaireRevision {
  return {
    title: value.title.trim(),
    description: value.description?.trim() || null,
    questions: normalizeQuestions(value.questions).map((question) => ({
      ...question,
      required: Boolean(question.required),
    })),
  };
}

export function questionnaireRevisionHash(value: QuestionnaireRevision): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizeQuestionnaireRevision(value)))
    .digest("hex");
}
