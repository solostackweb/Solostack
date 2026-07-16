import { notFound } from "next/navigation";

import { getQuestionnaire } from "@/features/questionnaires/server";
import { QuestionnaireBuilder } from "@/features/questionnaires/components/questionnaire-builder";

export const metadata = { title: "Edit questionnaire | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuestionnairePage({ params }: PageProps) {
  const { id } = await params;
  const questionnaire = await getQuestionnaire(id);
  if (!questionnaire) notFound();
  return <QuestionnaireBuilder mode="edit" initial={questionnaire} />;
}
