import { PageHeader } from "@/components/shared/page-header";
import { UpgradeCard } from "@/components/shared/upgrade-card";
import { Workflow } from "lucide-react";
import {
  canUseFeature,
  getCurrentSubscription,
} from "@/features/subscription/server";
import { listClients } from "@/features/clients/server";
import { listPortalsForCurrentUser } from "@/features/portals/server";
import { PortalIndexView } from "@/features/portals/components/portal-index-view";

export const metadata = { title: "Client Portals" };

export default async function PortalIndexPage() {
  const allowed = await canUseFeature("clients.portal");
  if (!allowed) {
    const sub = await getCurrentSubscription();
    return (
      <div className="space-y-6">
        <PageHeader
          title="Client portals"
          description="Branded shared workspaces for your clients."
        />
        <UpgradeCard
          icon={Workflow}
          title="Client Portal is a Pro feature"
          description={`Your ${sub?.plan ?? "free"} plan doesn't include portals. Upgrade to share files, contracts, and invoices in a branded space your clients will love.`}
          features={[
            "Branded portal per client",
            "Shared files (5 GB on Pro)",
            "In-portal contract signing & invoice payment",
            "Conversation space + notifications",
          ]}
        />
      </div>
    );
  }

  const [portalResult, clients] = await Promise.all([
    listPortalsForCurrentUser(),
    listClients({ limit: 200 }),
  ]);
  const { ownedPortals } = portalResult;
  const activeClientIds = ownedPortals
    .filter((p) => p.status === "active" && p.client_id)
    .map((p) => p.client_id!)
    .filter(Boolean);

  return (
    <PortalIndexView
      ownedPortals={ownedPortals}
      clients={clients.map((client) => ({
        id: client.id,
        fullName: client.fullName,
        businessName: client.businessName,
        email: client.email,
      }))}
      activeClientIds={activeClientIds}
    />
  );
}
