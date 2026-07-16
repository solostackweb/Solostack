import { notFound } from "next/navigation";

import {
  getQuestionnaire,
  listSendsForOwner,
} from "@/features/questionnaires/server";
import { listClients } from "@/features/clients/server";
import { QuestionnaireResponsesView } from "@/features/questionnaires/components/questionnaire-responses-view";

export const metadata = { title: "Responses | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResponsesPage({ params }: PageProps) {
  const { id } = await params;
  const [questionnaire, clients, sends] = await Promise.all([
    getQuestionnaire(id),
    listClients({ limit: 300 }),
    listSendsForOwner({ questionnaireId: id }),
  ]);
  if (!questionnaire) notFound();

  return (
    <QuestionnaireResponsesView
      questionnaireId={questionnaire.id}
      questionnaireTitle={questionnaire.title}
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
        phone: client.phone,
      }))}
      sends={sends}
    />
  );
}
