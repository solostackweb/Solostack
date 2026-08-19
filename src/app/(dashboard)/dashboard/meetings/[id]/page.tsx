import { notFound } from "next/navigation";

import { getMeetingForOwner } from "@/features/meetings/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
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

  // Ownership is already established by getMeetingForOwner, so this lookup is
  // just a display name for the linked client.
  let clientName: string | null = null;
  if (meeting.clientId) {
    const { data } = await getAdminSupabase()
      .from("clients")
      .select("full_name, business_name")
      .eq("id", meeting.clientId)
      .maybeSingle();
    const row = data as
      | { full_name: string | null; business_name: string | null }
      | null;
    clientName = row?.business_name || row?.full_name || null;
  }

  return <MeetingDetailView meeting={meeting} clientName={clientName} />;
}
