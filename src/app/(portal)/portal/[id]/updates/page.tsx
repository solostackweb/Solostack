import { getClientPortalProps } from "@/features/portals/client-portal-data";
import { ClientPortalUpdates } from "@/features/portals/components/client-portal-pages";

export const metadata = { title: "Portal updates" };
export const dynamic = "force-dynamic";

export default async function ClientPortalUpdatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientPortalProps(id);

  return <ClientPortalUpdates data={data} />;
}
