import Link from "next/link";
import { CheckCircle2, ExternalLink, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationLogoTile } from "@/components/integrations/integration-logo";
import {
  SettingsPageHeader,
  SettingsSection,
} from "@/features/settings/components/settings-section";

export const metadata = {
  title: "Integrations - Stackivo",
  description: "Connect calendar, files, email, and payment tools to Stackivo.",
};

const integrations = [
  {
    title: "Google Calendar",
    logoId: "google_calendar",
    status: "Workflow-ready",
    description:
      "Portal meetings already support Google Calendar add-links, Outlook add-links, .ics downloads, and subscribable calendar feeds.",
    workflow: "Portal meetings, client calls, calendar feeds",
    actions: [
      { label: "Open portals", href: "/dashboard/portal" },
      { label: "Google Calendar", href: "https://calendar.google.com/calendar/u/0/r", external: true },
    ],
    checks: ["Add individual meetings", "Subscribe to portal meeting feeds", "Share Google Meet links"],
  },
  {
    title: "Google Drive",
    logoId: "google_drive",
    status: "Planned OAuth",
    description:
      "Use portal files today. A deeper Drive picker/sync can be added when OAuth client verification is complete.",
    workflow: "Portal files, proof links, proposal attachments",
    actions: [
      { label: "Open portal files", href: "/dashboard/portal" },
      { label: "OAuth setup", href: "https://console.cloud.google.com/apis/credentials", external: true },
    ],
    checks: ["Portal file sharing available", "OAuth verification required for Drive picker"],
  },
  {
    title: "Gmail / Email sending",
    logoId: "gmail",
    status: "Platform email active",
    description:
      "Stackivo sends transactional document and portal emails from the platform email system. Gmail account-level sending is a future OAuth integration.",
    workflow: "Invoice sends, reminders, proposal follow-ups",
    actions: [
      { label: "Notification settings", href: "/dashboard/settings/notifications" },
    ],
    checks: ["Document emails", "Portal invites and digests", "User Gmail OAuth planned"],
  },
  {
    title: "Wise, PayPal, Payoneer, bank",
    logoId: "wise",
    status: "Manual connections ready",
    description:
      "Add international payment instructions and links in Payments. They appear on export invoices and public payment pages.",
    workflow: "Export invoices, public payment pages, payment ledger",
    actions: [
      { label: "Payment settings", href: "/dashboard/settings/payments" },
    ],
    checks: ["Wise links", "PayPal links/email", "Bank instructions", "Default connection"],
  },
];

export default function IntegrationsSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Integrations"
        description="Connect the tools around your Stackivo workspace. Current integrations stay approval-first and client-safe."
      />

      <div className="space-y-5">
        <SettingsSection
          title="Integration hub"
          description="A practical view of what is connected today and what needs external account setup next."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {integrations.map((integration) => (
              <article
                key={integration.title}
                className="flex min-w-0 flex-col rounded-xl border bg-background p-4"
              >
                <div className="flex items-start gap-3">
                  <IntegrationLogoTile id={integration.logoId} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{integration.title}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {integration.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {integration.description}
                    </p>
                    <p className="mt-2 text-xs font-medium text-foreground">
                      Used in:{" "}
                      <span className="text-muted-foreground">{integration.workflow}</span>
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {integration.checks.map((check) => (
                    <li key={check} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {check}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {integration.actions.map((action) => (
                    <Button key={action.label} asChild size="sm" variant="outline">
                      <Link
                        href={action.href}
                        target={action.external ? "_blank" : undefined}
                        rel={action.external ? "noreferrer" : undefined}
                      >
                        {action.label}
                        {action.external ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                      </Link>
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Recommended setup order"
          description="For Indian freelancers with global clients, this order gives the best product value quickly."
        >
          <ol className="grid gap-3 md:grid-cols-2">
            {[
              "Add UPI and bank details for domestic invoices.",
              "Add Wise or PayPal instructions for export invoices.",
              "Use portal meetings with Google Calendar links for client calls.",
              "Complete Google OAuth branding verification before deeper Drive/Gmail sync.",
            ].map((item, index) => (
              <li key={item} className="flex gap-3 rounded-xl border bg-background p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="text-sm text-muted-foreground">{item}</span>
              </li>
            ))}
          </ol>
        </SettingsSection>

        <SettingsSection
          title="Ivo-ready integration prompts"
          description="Use these prompts from Ask Ivo when configuring a workspace."
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[
              "Help me set up payment instructions for foreign clients.",
              "Draft a meeting confirmation message with Google Meet and calendar link.",
              "Tell me what I need before enabling Google Drive or Gmail OAuth.",
            ].map((prompt) => (
              <div key={prompt} className="rounded-xl border bg-background p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                  <Plug className="h-3.5 w-3.5" />
                  Ivo prompt
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{prompt}</p>
              </div>
            ))}
          </div>
        </SettingsSection>
      </div>
    </>
  );
}
