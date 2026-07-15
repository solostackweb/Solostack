import { listClients } from "@/features/clients/server";
import { MeetingNewView } from "@/features/meetings/components/meeting-new-view";

export const metadata = { title: "Schedule a call | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NewMeetingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const clients = await listClients({ limit: 300 });

  return (
    <MeetingNewView
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
      }))}
      prefill={{
        topic: sp.topic,
        clientId: sp.clientId ?? null,
        projectId: sp.projectId ?? null,
        proposalId: sp.proposalId ?? null,
        contractId: sp.contractId ?? null,
      }}
    />
  );
}
