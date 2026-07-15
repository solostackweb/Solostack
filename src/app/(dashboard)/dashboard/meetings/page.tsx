import { listMeetingsForOwner } from "@/features/meetings/server";
import {
  getCalendarConnection,
  getSchedulingSettings,
  isGoogleConfigured,
} from "@/features/scheduling/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { MeetingsHubView } from "@/features/meetings/components/meetings-hub-view";

export const metadata = { title: "Meetings | Stackivo" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const [meetings, connection, settings] = await Promise.all([
    listMeetingsForOwner(),
    userId
      ? getCalendarConnection(userId)
      : Promise.resolve({ connected: false, email: null }),
    userId
      ? getSchedulingSettings(userId)
      : Promise.resolve({
          timezone: "Asia/Kolkata",
          workingHours: {},
          bufferMinutes: 15,
          minNoticeHours: 12,
          slotIntervalMinutes: 30,
        }),
  ]);

  return (
    <MeetingsHubView
      meetings={meetings}
      connection={connection}
      settings={settings}
      googleConfigured={isGoogleConfigured()}
    />
  );
}
