import { notFound } from "next/navigation";

import {
  getQuestionnaire,
  getQuestionnaireSheetIntegration,
  getQuestionnaireSheetsConnection,
  listResponsesForOwner,
  listSendsForOwner,
} from "@/features/questionnaires/server";
import { listClients } from "@/features/clients/server";
import { QuestionnaireResponsesView } from "@/features/questionnaires/components/questionnaire-responses-view";

export const metadata = { title: "Responses | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function ResponsesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const page = Number.parseInt(query.page ?? "1", 10);
  const search = (query.q ?? "").trim();
  const [questionnaire, clients, sends, responsePage, sheetIntegration, sheetsConnection] = await Promise.all([
    getQuestionnaire(id),
    listClients({ limit: 300 }),
    listSendsForOwner({ questionnaireId: id }),
    listResponsesForOwner(id, { page: Number.isFinite(page) ? page : 1, pageSize: 25, search }),
    getQuestionnaireSheetIntegration(id),
    getQuestionnaireSheetsConnection(),
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
      responses={responsePage.items}
      responseTotal={responsePage.total}
      responsePage={responsePage.page}
      responsePageSize={responsePage.pageSize}
      responseSearch={search}
      sheetIntegration={sheetIntegration}
      sheetsConnection={sheetsConnection}
    />
  );
}
