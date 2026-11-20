import { redirect } from "next/navigation";
import { getOrgDetailsAction, getOrgSubscriptionAction } from "@/features/organizations/actions";
import { OrganizationDetail } from "@/features/organizations/components/organization-detail";

export const metadata = { title: "Organization" };

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const [orgResult, subResult] = await Promise.all([
    getOrgDetailsAction(orgId),
    getOrgSubscriptionAction(orgId),
  ]);

  if (!orgResult.ok || !orgResult.data) {
    redirect("/dashboard/organizations");
  }

  return <OrganizationDetail 
    initialData={orgResult.data} 
    orgId={orgId}
    initialSubscription={subResult.ok ? subResult.subscription : null}
  />;
}