import { redirect } from "next/navigation";
import { CreateInvoiceView } from "@/features/invoices/components/new-invoice/create-invoice-view";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { nextInvoiceNumber } from "@/features/invoices/server";
import { getUnbilledTime } from "@/features/time/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getProfile } from "@/features/profile/server";
import { hasFreelancerSignature } from "@/features/profile/signature";
import { SignatureRequiredGate } from "@/features/profile/components/signature-required-gate";

export const metadata = { title: "New invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const [clients, projects, nextNumber, profile, unbilled] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
    nextInvoiceNumber(user.id),
    getProfile(),
    getUnbilledTime(),
  ]);

  if (!hasFreelancerSignature(profile)) {
    return (
      <SignatureRequiredGate
        title="Add your signature first"
        description="Stackivo needs your freelancer signature before you can create or send invoices. This keeps your billing documents consistent and ready for delivery."
        ctaLabel="Set up signature"
      />
    );
  }

  return (
    <CreateInvoiceView
      clients={clients}
      projects={projects}
      nextInvoiceNumber={nextNumber.formatted}
      unbilledTime={unbilled.entries.map((e) => ({
        id: e.id,
        clientId: e.clientId,
        projectId: e.projectId,
        seconds: e.durationSeconds,
        amount: e.amount,
        startedAt: e.startedAt,
      }))}
    />
  );
}
