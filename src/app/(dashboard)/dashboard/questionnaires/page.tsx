import { listQuestionnaires } from "@/features/questionnaires/server";
import { QuestionnairesView } from "@/features/questionnaires/components/questionnaires-view";

export const metadata = { title: "Questionnaires | Stackivo" };
export const dynamic = "force-dynamic";

export default async function QuestionnairesPage() {
  const questionnaires = await listQuestionnaires();
  return <QuestionnairesView questionnaires={questionnaires} />;
}
