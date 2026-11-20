import { redirect } from "next/navigation";
import { getOrgDetailsAction } from "@/features/organizations/actions";
import { DeleteOrgPage } from "@/features/organizations/components/delete-org-page";

export const metadata = { title: "Delete Organization" };

export default async function DeleteOrgPageWrapper({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const result = await getOrgDetailsAction(orgId);

  if (!result.ok || !result.data) {
    redirect("/dashboard/organizations");
  }

  return <DeleteOrgPage initialData={result.data} orgId={orgId} />;
}