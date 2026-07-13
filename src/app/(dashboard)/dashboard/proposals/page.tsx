import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { ProposalsListView } from "@/features/proposals/components/proposals-list-view";
import { listProposals } from "@/features/proposals/server";

export const metadata = {
  title: "Proposals | Stackivo",
};

export default async function ProposalsPage() {
  const [proposals, clients, projects] = await Promise.all([
    listProposals(),
    listClients({ limit: 300 }),
    listProjects({ limit: 300 }),
  ]);

  return (
    <ProposalsListView
      proposals={proposals}
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
        email: client.email,
        currency: client.currency,
      }))}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        clientId: project.clientId,
      }))}
    />
  );
}
