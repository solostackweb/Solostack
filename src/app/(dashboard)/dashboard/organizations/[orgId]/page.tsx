import { redirect } from "next/navigation";
import { getOrgDetailsAction } from "@/features/organizations/actions";
import { OrganizationDetailClient } from "./OrganizationDetailClient";

export const metadata = { title: "Organization" };

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const result = await getOrgDetailsAction(orgId);

  if (!result.ok || !result.data) {
    redirect("/dashboard/organizations");
  }

  return <OrganizationDetailClient initialData={result.data} orgId={orgId} />;
}