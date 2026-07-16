import { notFound } from "next/navigation";

import {
  getQuestionnaire,
  listSendsForOwner,
} from "@/features/questionnaires/server";
import { listClients } from "@/features/clients/server";
import { QuestionnaireSendView } from "@/features/questionnaires/components/questionnaire-send-view";

export const metadata = { title: "Send questionnaire | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SendQuestionnairePage({ params }: PageProps) {
  const { id } = await params;
  const [questionnaire, clients, sends] = await Promise.all([
    getQuestionnaire(id),
    listClients({ limit: 300 }),
    listSendsForOwner({ questionnaireId: id }),
  ]);
  if (!questionnaire) notFound();

  return (
    <QuestionnaireSendView
      questionnaireId={questionnaire.id}
      questionnaireTitle={questionnaire.title}
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
      }))}
      sends={sends}
    />
  );
}
