import { QuestionnaireBuilder } from "@/features/questionnaires/components/questionnaire-builder";

export const metadata = { title: "New questionnaire | Stackivo" };
export const dynamic = "force-dynamic";

export default function NewQuestionnairePage() {
  return <QuestionnaireBuilder mode="create" />;
}
