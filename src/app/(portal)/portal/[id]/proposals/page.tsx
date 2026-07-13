import { getClientPortalProps } from "@/features/portals/client-portal-data";
import { ClientPortalProposals } from "@/features/portals/components/client-portal-pages";

export const metadata = { title: "Portal proposals" };
export const dynamic = "force-dynamic";

export default async function ClientPortalProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientPortalProps(id);

  return <ClientPortalProposals data={data} />;
}
