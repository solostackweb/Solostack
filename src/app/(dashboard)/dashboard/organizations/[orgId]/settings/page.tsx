import { redirect } from "next/navigation";
import { getOrgDetailsAction } from "@/features/organizations/actions";
import { OrgSettingsClient } from "./OrgSettingsClient";

export const metadata = { title: "Organization Settings" };

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const result = await getOrgDetailsAction(orgId);

  if (!result.ok || !result.data) {
    redirect("/dashboard/organizations");
  }

  return <OrgSettingsClient initialData={result.data} orgId={orgId} />;
}