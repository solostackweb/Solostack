import {
  getCalendarConnection,
  getSchedulingSettings,
  isGoogleConfigured,
} from "@/features/scheduling/server";
import { SchedulingSettingsView } from "@/features/scheduling/components/scheduling-settings-view";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Availability | Stackivo" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const [connection, settings] = await Promise.all([
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
    <SchedulingSettingsView
      googleConfigured={isGoogleConfigured()}
      connection={connection}
      settings={settings}
    />
  );
}
