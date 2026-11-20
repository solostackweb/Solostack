import { redirect } from "next/navigation";
import { getOrgDetailsAction } from "@/features/organizations/actions";
import { TransferOrgPage } from "@/features/organizations/components/transfer-org-page";

export const metadata = { title: "Transfer Ownership" };

export default async function TransferOrgPageWrapper({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const result = await getOrgDetailsAction(orgId);

  if (!result.ok || !result.data) {
    redirect("/dashboard/organizations");
  }

  return <TransferOrgPage initialData={result.data} orgId={orgId} />;
}