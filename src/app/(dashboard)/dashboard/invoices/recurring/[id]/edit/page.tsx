import { RecurringInvoiceForm } from "@/features/invoices/components/recurring/recurring-invoice-form";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { getProfile } from "@/features/profile/server";
import { getRecurringInvoice } from "@/features/invoices/recurring-actions";
import { hasFreelancerSignature } from "@/features/profile/signature";
import { SignatureRequiredGate } from "@/features/profile/components/signature-required-gate";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { notFound } from "next/navigation";

interface EditRecurringInvoicePageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Edit recurring invoice" };
export const dynamic = "force-dynamic";

async function getData(id: string) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const [clients, projects, profile, recurring] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
    getProfile(),
    getRecurringInvoice(id),
  ]);

  if (!recurring || recurring.user_id !== user.id) {
    notFound();
  }

  return { clients, projects, profile, recurring, user };
}

export default async function EditRecurringInvoicePage({ params }: EditRecurringInvoicePageProps) {
  const { id } = await params;
  const { clients, projects, profile, recurring, user } = await getData(id);

  if (!hasFreelancerSignature(profile)) {
    return (
      <SignatureRequiredGate
        title="Add your signature first"
        description="Stackivo needs your freelancer signature before you can edit recurring invoice templates."
        ctaLabel="Set up signature"
      />
    );
  }

  // Transform recurring data to form defaults
  const formDefaults = {
    clientId: recurring.client_id || "",
    projectId: recurring.project_id || "",
    frequency: recurring.frequency,
    interval: recurring.interval,
    dayOfMonth: recurring.day_of_month,
    dayOfWeek: recurring.day_of_week,
    startDate: recurring.start_date.split("T")[0],
    endDate: recurring.end_date ? recurring.end_date.split("T")[0] : "",
    maxOccurrences: recurring.max_occurrences,
    currency: recurring.currency,
    issueDateOffset: recurring.issue_date_offset,
    dueDateOffset: recurring.due_date_offset,
    statusOnCreate: recurring.status_on_create,
    discount: recurring.discount,
    notes: recurring.notes || "",
    terms: recurring.terms || "",
    hsnSac: recurring.hsn_sac || "",
    gstRate: recurring.gst_rate,
    items: recurring.items?.map((item: { id: string; description: string; quantity: number; rate: number; gst_rate: number }) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      gstRate: item.gst_rate,
    })) || [{ id: `item_${Math.random().toString(36).slice(2, 9)}`, description: "", quantity: 1, rate: 0, gstRate: 0 }],
    invoicePrefix: recurring.invoice_prefix || "",
    invoiceNumberPadding: recurring.invoice_number_padding,
  };

  return (
    <Suspense fallback={<div>Loading…</div>}>
      <RecurringInvoiceForm
        clients={clients}
        projects={projects}
        profile={profile}
        initialValues={formDefaults}
        recurringId={recurring.id}
      />
    </Suspense>
  );
}