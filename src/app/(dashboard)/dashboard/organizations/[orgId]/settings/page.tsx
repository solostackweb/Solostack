import { redirect } from "next/navigation";
import { getOrgDetailsAction, getOrgSubscriptionAction } from "@/features/organizations/actions";
import { OrgSettingsPage } from "@/features/organizations/components/org-settings-page";

export const metadata = { title: "Organization Settings" };

export default async function OrganizationSettingsPage({
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

  return (
    <OrgSettingsPage
      initialData={orgResult.data}
      orgId={orgId}
      initialSubscription={subResult.ok ? subResult.subscription : null}
    />
  );
}