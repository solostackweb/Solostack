import { listMeetingsForOwner } from "@/features/meetings/server";
import { getGoogleIntegrationState } from "@/features/integrations/server";
import { MeetingsHubView } from "@/features/meetings/components/meetings-hub-view";

export const metadata = { title: "Meetings | Stackivo" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [meetings, google] = await Promise.all([
    listMeetingsForOwner(),
    getGoogleIntegrationState(),
  ]);
  return <MeetingsHubView meetings={meetings} calendar={google} />;
}
