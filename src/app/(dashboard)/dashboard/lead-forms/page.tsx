import { getPublicAppUrl } from "@/features/documents/urls";
import { LeadFormsView } from "@/features/lead-forms/components/lead-forms-view";
import { countLeadSubmissions, listLeadForms, listLeadSubmissions } from "@/features/lead-forms/server";

export const metadata = { title: "Lead forms | Stackivo" };
export const dynamic = "force-dynamic";

export default async function LeadFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const query = await searchParams;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const search = (query.q ?? "").trim();
  const [forms, submissions, totalCaptured] = await Promise.all([
    listLeadForms(),
    listLeadSubmissions({
      page: Number.isFinite(requestedPage) ? requestedPage : 1,
      pageSize: 25,
      search,
    }),
    countLeadSubmissions(),
  ]);

  return (
    <LeadFormsView
      forms={forms}
      submissions={submissions}
      submissionSearch={search}
      totalCaptured={totalCaptured}
      publicBaseUrl={getPublicAppUrl()}
    />
  );
}
