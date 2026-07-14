import { notFound } from "next/navigation";

import { ProjectDetailView } from "@/features/projects/components/project-detail-view";
import {
  getProject,
  listProjectStatusHistory,
} from "@/features/projects/server";
import { getClient, listClients } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { listInvoices } from "@/features/invoices/server";
import { listProposals } from "@/features/proposals/server";
import { listContracts } from "@/features/contracts/server";
import { listWelcomeDocuments } from "@/features/welcome-documents/server";

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

  const [
    client,
    invoices,
    proposals,
    contracts,
    welcomeDocs,
    clients,
    statusHistory,
  ] = await Promise.all([
    project.clientId ? getClient(project.clientId) : Promise.resolve(null),
    listInvoices({ projectId: project.id, limit: 50 }),
    listProposals({ projectId: project.id, limit: 50 }),
    listContracts({ projectId: project.id, limit: 50 }),
    listWelcomeDocuments({ projectId: project.id }),
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
      proposals={proposals.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        totalAmount: p.totalAmount,
        currency: p.currency,
      }))}
      contracts={contracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        valueAmount: c.valueAmount,
        currency: c.currency,
      }))}
      welcomeDocs={welcomeDocs.map((w) => ({
        id: w.id,
        title: w.title,
        status: w.status,
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
