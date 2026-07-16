import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Sending now happens in a dialog; this route redirects to the responses page,
// where a client can be sent the questionnaire and answers are viewed anytime.
export default async function SendRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/questionnaires/${id}/responses`);
}
