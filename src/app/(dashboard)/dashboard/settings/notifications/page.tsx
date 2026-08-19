import { getServerSupabase } from "@/lib/supabase/server";
import { isGoogleConfigured } from "@/features/scheduling/server";
import { getGmailSendAsState } from "@/features/email/gmail-sender";
import { GmailSendAsCard } from "@/features/email/components/gmail-send-as-card";
import { NotificationSettingsPage } from "./notifications-form";

export const metadata = { title: "Notifications - Stackivo" };
export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const gmail = user
    ? await getGmailSendAsState(user.id)
    : { connected: false, scopeGranted: false, enabled: false, email: null };

  return (
    <>
      <NotificationSettingsPage />
      <div className="mt-5">
        <GmailSendAsCard
          state={{ configured: isGoogleConfigured(), ...gmail }}
        />
      </div>
    </>
  );
}
