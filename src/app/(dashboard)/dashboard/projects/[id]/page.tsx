import { notFound } from "next/navigation";

import { ProjectDetailView } from "@/features/projects/components/project-detail-view";
import {
  getProject,
  listProjectStatusHistory,
} from "@/features/projects/server";
import { getClient, listClients } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { listInvoices } from "@/features/invoices/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? project.name : "Project" };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [client, invoices, clients, statusHistory] = await Promise.all([
    project.clientId ? getClient(project.clientId) : Promise.resolve(null),
    listInvoices({ projectId: project.id, limit: 50 }),
    listClients({ limit: 200 }),
    listProjectStatusHistory(project.id, 50),
  ]);

  return (
    <ProjectDetailView
      project={project}
      client={client}
      invoices={invoices.map((i) => ({
        id: i.id,
        number: i.invoiceNumber,
        status: i.status,
        totalAmount: Number(i.totalAmount) || 0,
        currency: i.currency,
        inrEquivalent: i.inrEquivalent,
        issueDate: i.issueDate,
      }))}
      clients={clients.map((c) => ({
        id: c.id,
        name: getClientDisplayName(c),
        currency: c.currency,
      }))}
      statusHistory={statusHistory}
    />
  );
}
