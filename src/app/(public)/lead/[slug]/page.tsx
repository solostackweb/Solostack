import { PublicLeadFormView } from "@/features/lead-forms/components/public-lead-form-view";
import { getPublicLeadForm } from "@/features/lead-forms/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getPublicLeadForm(slug);
  return {
    title: form.title,
    description: form.description ?? "Project inquiry powered by Stackivo",
  };
}

export default async function PublicLeadFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getPublicLeadForm(slug);

  return <PublicLeadFormView form={form} />;
}
