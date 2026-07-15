import { getClientPortalProps } from "@/features/portals/client-portal-data";
import { listMeetingsForClient } from "@/features/meetings/server";
import { PortalScheduledCalls } from "@/features/meetings/components/portal-scheduled-calls";

export const metadata = { title: "Portal meetings" };
export const dynamic = "force-dynamic";

export default async function ClientPortalMeetingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientPortalProps(id);
  const calls = data.clientId
    ? await listMeetingsForClient(data.clientId)
    : [];

  return (
    <PortalScheduledCalls
      meetings={calls.map((meeting) => ({
        id: meeting.id,
        topic: meeting.topic,
        durationMinutes: meeting.durationMinutes,
        proposedSlots: meeting.proposedSlots,
        scheduledAt: meeting.scheduledAt,
        status: meeting.status,
        meetLink: meeting.meetLink,
        publicToken: meeting.publicToken,
      }))}
    />
  );
}
