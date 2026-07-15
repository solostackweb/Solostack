import { notFound } from "next/navigation";

import { getMeetingByToken } from "@/features/meetings/server";
import { MeetingConfirmView } from "@/features/meetings/components/meeting-confirm-view";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return {
    title: "Book a time",
    robots: { index: false, follow: false },
  };
}

export default async function PublicMeetingPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getMeetingByToken(token);
  if (!result) notFound();

  return (
    <MeetingConfirmView
      token={token}
      hostName={result.hostName}
      meeting={{
        topic: result.meeting.topic,
        notes: result.meeting.notes,
        durationMinutes: result.meeting.durationMinutes,
        proposedSlots: result.meeting.proposedSlots,
        scheduledAt: result.meeting.scheduledAt,
        status: result.meeting.status,
        meetLink: result.meeting.meetLink,
      }}
    />
  );
}
