import { IntegrationLogoTile } from "@/components/integrations/integration-logo";
import { Button } from "@/components/ui/button";
import { getQuestionnaireSheetsConnection } from "@/features/questionnaires/server";
import { isGoogleConfigured } from "@/features/scheduling/server";
import { SettingsSection } from "@/features/settings/components/settings-section";

export const metadata = { title: "Integrations - Stackivo" };
export const dynamic = "force-dynamic";

const RETURN_TO = "/dashboard/settings/integrations";

export default async function IntegrationsSettingsPage() {
  const connection = await getQuestionnaireSheetsConnection();

  return (
    <SettingsSection
      title="Google Sheets"
      description="Keep questionnaire responses available in a structured spreadsheet without reconnecting each form."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <IntegrationLogoTile id="google_sheets" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {connection.ready ? "Automatic response sync is on" : "Not connected"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {connection.ready
                ? `${connection.email ?? "Your Google account"} · one sheet is created automatically per questionnaire.`
                : "Connect once to create and update private response sheets in your Google Drive."}
            </p>
          </div>
        </div>
        {isGoogleConfigured() ? (
          <Button asChild size="sm" variant={connection.ready ? "outline" : "default"}>
            <a href={`/api/google/connect?feature=questionnaire-sheets&next=${encodeURIComponent(RETURN_TO)}`}>
              {connection.ready ? "Re-authorise" : "Connect Google"}
            </a>
          </Button>
        ) : null}
      </div>
    </SettingsSection>
  );
}
