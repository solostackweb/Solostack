import { notFound } from "next/navigation";

import { getPublicAppUrl } from "@/features/documents/urls";
import { LeadFormBuilder } from "@/features/lead-forms/components/lead-form-builder";
import { getLeadForm } from "@/features/lead-forms/server";

export const metadata = { title: "Customize lead form | Stackivo" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadFormBuilderPage({ params }: Props) {
  const { id } = await params;
  const form = await getLeadForm(id);
  if (!form) notFound();

  return <LeadFormBuilder form={form} publicBaseUrl={getPublicAppUrl()} />;
}
