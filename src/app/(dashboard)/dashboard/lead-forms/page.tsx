import { getPublicAppUrl } from "@/features/documents/urls";
import { LeadFormsView } from "@/features/lead-forms/components/lead-forms-view";
import { listLeadForms, listLeadSubmissions } from "@/features/lead-forms/server";

export const metadata = { title: "Lead forms | Stackivo" };
export const dynamic = "force-dynamic";

export default async function LeadFormsPage() {
  const [forms, submissions] = await Promise.all([
    listLeadForms(),
    listLeadSubmissions(),
  ]);

  return (
    <LeadFormsView
      forms={forms}
      submissions={submissions}
      publicBaseUrl={getPublicAppUrl()}
    />
  );
}
