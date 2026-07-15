import { notFound } from "next/navigation";

import { getMeetingForOwner } from "@/features/meetings/server";
import { isDailyConfigured } from "@/features/meetings/video";
import { MeetingDetailView } from "@/features/meetings/components/meeting-detail-view";

export const metadata = { title: "Meeting | Stackivo" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const meeting = await getMeetingForOwner(id);
  if (!meeting) notFound();

  return (
    <MeetingDetailView meeting={meeting} dailyConfigured={isDailyConfigured()} />
  );
}
