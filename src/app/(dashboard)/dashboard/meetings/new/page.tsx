import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listClients } from "@/features/clients/server";
import { MeetingNewView } from "@/features/meetings/components/meeting-new-view";
import { MeetingsGate } from "@/features/meetings/components/meetings-gate";
import { getMeetingsCalendarState } from "@/features/meetings/calendar-state";

export const metadata = { title: "Schedule a call | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NewMeetingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [clients, calendar] = await Promise.all([
    listClients({ limit: 300 }),
    getMeetingsCalendarState(),
  ]);

  // This page is reachable directly and from deep links on proposals and
  // contracts, so it has to carry the same gate as the board. Without it a
  // freelancer could create a meeting that can never produce a Meet link.
  const ready =
    calendar.configured && calendar.tokenStorageReady && calendar.connected;
  if (!ready) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Schedule a call"
          description="Connect your calendar first — every call is booked against it."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/meetings">
                <ArrowLeft className="h-4 w-4" /> Meetings
              </Link>
            </Button>
          }
        />
        <MeetingsGate calendar={calendar} returnTo="/dashboard/meetings/new" />
      </div>
    );
  }

  return (
    <MeetingNewView
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
      }))}
      availabilityEnabled
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
