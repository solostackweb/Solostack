import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClientProfileView } from "@/features/clients/components/client-profile-view";
import {
  getClient,
  getClientInvoiceMetrics,
} from "@/features/clients/server";
import { getClientBehaviorInsights } from "@/features/clients/insights";
import { listInvoices } from "@/features/invoices/server";
import { listProposals } from "@/features/proposals/server";
import { listContracts } from "@/features/contracts/server";
import { listWelcomeDocuments } from "@/features/welcome-documents/server";
import { getClientDisplayName } from "@/features/clients/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  return { title: client ? getClientDisplayName(client) : "Client" };
}

export default async function ClientProfilePage({ params }: PageProps) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [metrics, recentInvoices, proposals, contracts, welcomeDocs, insights] =
    await Promise.all([
      getClientInvoiceMetrics(client.id),
      listInvoices({ clientId: client.id, limit: 6 }),
      listProposals({ clientId: client.id, limit: 50 }),
      listContracts({ clientId: client.id, limit: 50 }),
      listWelcomeDocuments({ clientId: client.id }),
      getClientBehaviorInsights(client.id).catch(() => []),
    ]);

  const documents = [
    ...proposals.map((p) => ({
      id: p.id,
      kind: "proposal" as const,
      title: p.title,
      status: p.status,
      href: `/dashboard/proposals/${p.id}`,
    })),
    ...contracts.map((c) => ({
      id: c.id,
      kind: "contract" as const,
      title: c.title,
      status: c.status,
      href: `/dashboard/contracts/${c.id}`,
    })),
    ...welcomeDocs.map((w) => ({
      id: w.id,
      kind: "welcome" as const,
      title: w.title,
      status: w.status,
      href: `/dashboard/welcome/${w.id}`,
    })),
  ];

  return (
    <ClientProfileView
      client={client}
      metrics={metrics}
      recentInvoices={recentInvoices}
      documents={documents}
      insights={insights}
    />
  );
}
