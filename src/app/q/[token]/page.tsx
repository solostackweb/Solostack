import { notFound } from "next/navigation";

import { getQuestionnaireSendByToken } from "@/features/questionnaires/server";
import { QuestionnaireFillView } from "@/features/questionnaires/components/questionnaire-fill-view";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return {
    title: "Questionnaire",
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuestionnairePage({ params }: PageProps) {
  const { token } = await params;
  const result = await getQuestionnaireSendByToken(token);
  if (!result) notFound();

  return (
    <QuestionnaireFillView
      token={token}
      hostName={result.hostName}
      send={{
        title: result.send.title,
        status: result.send.status,
        questions: result.send.questions,
      }}
    />
  );
}
