import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireOnboarded } from "@/features/onboarding/server";
import { getCurrentSubscription } from "@/features/subscription/server";
import { DashboardSupportLayer } from "@/features/support/dashboard-support";
import { listClients } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { listProjects } from "@/features/projects/server";

/**
 * Dashboard group layout.
 *
 * Runs `requireOnboarded()` on every dashboard request:
 *   - Unauthenticated → redirected to /login by middleware before we hit RSC.
 *   - Authenticated but mid-onboarding → redirected to the persisted step.
 *   - Authenticated + onboarded → rendered through the dashboard shell.
 *
 * Mounts the first-party live chat widget once for the whole authenticated
 * surface (see DashboardSupportLayer).
 */
export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, subscription, clients, projects] = await Promise.all([
    requireOnboarded(),
    getCurrentSubscription(),
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
  ]);

  return (
    <DashboardShell
      profile={profile}
      subscription={subscription}
      aiClients={clients.map((client) => ({
        id: client.id,
        name: getClientDisplayName(client),
      }))}
      aiProjects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        clientId: project.clientId,
      }))}
    >
      {children}
      <DashboardSupportLayer identity={{ plan: subscription?.plan ?? "free" }} />
    </DashboardShell>
  );
}
