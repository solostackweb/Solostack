import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { ProposalTemplateStartView } from "@/features/proposals/components/proposal-template-start-view";
import { listTemplates } from "@/features/templates/server";

export const metadata = {
  title: "New Proposal | Stackivo",
};

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  const [templates, clients, projects] = await Promise.all([
    listTemplates("proposal"),
    listClients({ limit: 300 }),
    listProjects({ limit: 300 }),
  ]);

  return (
    <ProposalTemplateStartView
      templates={templates}
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
