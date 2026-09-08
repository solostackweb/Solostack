import { listQuestionnaires, listQuestionnaireTemplates } from "@/features/questionnaires/server";
import { listClients } from "@/features/clients/server";
import { QuestionnairesView } from "@/features/questionnaires/components/questionnaires-view";

export const metadata = { title: "Questionnaires | Stackivo" };
export const dynamic = "force-dynamic";

export default async function QuestionnairesPage() {
  const [questionnaires, templates, clients] = await Promise.all([
    listQuestionnaires(),
    listQuestionnaireTemplates(),
    listClients({ limit: 300 }),
  ]);

  return (
    <QuestionnairesView
      questionnaires={questionnaires}
      templates={templates}
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
        phone: client.phone,
      }))}
    />
  );
}
