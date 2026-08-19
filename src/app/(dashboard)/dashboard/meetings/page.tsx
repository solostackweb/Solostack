import { listMeetingsForOwner } from "@/features/meetings/server";
import { getMeetingsCalendarState } from "@/features/meetings/calendar-state";
import { MeetingsHubView } from "@/features/meetings/components/meetings-hub-view";

export const metadata = { title: "Meetings | Stackivo" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [meetings, calendar] = await Promise.all([
    listMeetingsForOwner(),
    getMeetingsCalendarState(),
  ]);
  return <MeetingsHubView meetings={meetings} calendar={calendar} />;
}
