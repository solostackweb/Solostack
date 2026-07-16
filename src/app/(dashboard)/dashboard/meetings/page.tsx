import { listMeetingsForOwner } from "@/features/meetings/server";
import { MeetingsHubView } from "@/features/meetings/components/meetings-hub-view";

export const metadata = { title: "Meetings | Stackivo" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const meetings = await listMeetingsForOwner();
  return <MeetingsHubView meetings={meetings} />;
}
