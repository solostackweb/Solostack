import { getIntegrationsState } from "@/features/integrations/server";
import { IntegrationsView } from "@/features/integrations/components/integrations-view";

export const metadata = {
  title: "Integrations - Stackivo",
  description: "Connect your calendar, video, email, and payment tools.",
};

// Connection state is per-user and changes the moment OAuth returns, so this
// page must never be statically cached.
export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  const state = await getIntegrationsState();
  return <IntegrationsView state={state} />;
}
