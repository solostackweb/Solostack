import { listMeetingsForOwner } from "@/features/meetings/server";
import { MeetingsListView } from "@/features/meetings/components/meetings-list-view";

export const metadata = { title: "Meetings | Stackivo" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const meetings = await listMeetingsForOwner();
  return <MeetingsListView meetings={meetings} />;
}
