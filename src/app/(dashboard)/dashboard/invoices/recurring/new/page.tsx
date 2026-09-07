import { RecurringInvoiceForm } from "@/features/invoices/components/recurring/recurring-invoice-form";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { getProfile } from "@/features/profile/server";
import { hasFreelancerSignature } from "@/features/profile/signature";
import { SignatureRequiredGate } from "@/features/profile/components/signature-required-gate";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = { title: "New recurring invoice" };
export const dynamic = "force-dynamic";

async function getData() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const [clients, projects, profile] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
    getProfile(),
  ]);

  return { clients, projects, profile, user };
}

export default async function NewRecurringInvoicePage() {
  const { clients, projects, profile, user } = await getData();

  if (!hasFreelancerSignature(profile)) {
    return (
      <SignatureRequiredGate
        title="Add your signature first"
        description="Stackivo needs your freelancer signature before you can create recurring invoice templates."
        ctaLabel="Set up signature"
      />
    );
  }

  return (
    <Suspense fallback={<div>Loading…</div>}>
      <RecurringInvoiceForm
        clients={clients}
        projects={projects}
        profile={profile}
      />
    </Suspense>
  );
}