import { ProjectsListView } from "@/features/projects/components/projects-list-view";
import { listProjects } from "@/features/projects/server";
import { listClients } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ create?: string }>;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const [projects, clients, sp] = await Promise.all([
    listProjects({ limit: 200 }),
    listClients({ limit: 200 }),
    searchParams,
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: getClientDisplayName(c),
    currency: c.currency,
  }));

  return (
    <ProjectsListView
      projects={projects}
      clients={clientOptions}
      autoCreate={sp.create === "1"}
    />
  );
}
