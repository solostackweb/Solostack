import { notFound } from "next/navigation";

import { getMeetingByToken } from "@/features/meetings/server";
import { computeOpenSlots } from "@/features/scheduling/server";
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

  // For live-availability bookings, compute the freelancer's open times now.
  let slots = result.meeting.proposedSlots;
  if (
    result.meeting.mode === "availability" &&
    result.meeting.status !== "confirmed" &&
    result.meeting.status !== "cancelled"
  ) {
    slots = await computeOpenSlots(result.ownerId, {
      durationMinutes: result.meeting.durationMinutes,
    });
  }

  return (
    <MeetingConfirmView
      token={token}
      hostName={result.hostName}
      meeting={{
        topic: result.meeting.topic,
        notes: result.meeting.notes,
        durationMinutes: result.meeting.durationMinutes,
        proposedSlots: slots,
        scheduledAt: result.meeting.scheduledAt,
        status: result.meeting.status,
        meetLink: result.meeting.meetLink,
      }}
    />
  );
}
