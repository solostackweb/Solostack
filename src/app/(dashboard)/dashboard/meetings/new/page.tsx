import { listClients } from "@/features/clients/server";
import { MeetingNewView } from "@/features/meetings/components/meeting-new-view";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  getCalendarConnection,
  isGoogleConfigured,
} from "@/features/scheduling/server";

export const metadata = { title: "Schedule a call | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NewMeetingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [clients, connection] = await Promise.all([
    listClients({ limit: 300 }),
    user
      ? getCalendarConnection(user.id)
      : Promise.resolve({ connected: false, email: null }),
  ]);

  return (
    <MeetingNewView
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
      }))}
      availabilityEnabled={isGoogleConfigured() && connection.connected}
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
