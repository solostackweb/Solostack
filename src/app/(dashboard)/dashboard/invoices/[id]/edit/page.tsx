import { notFound, redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getInvoice } from "@/features/invoices/server";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { EditInvoiceView } from "@/features/invoices/components/edit-invoice/edit-invoice-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getInvoice(id);
  return {
    title: result
      ? `Edit ${result.invoice.invoiceNumber}`
      : "Edit invoice",
  };
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const { id } = await params;
  const result = await getInvoice(id);
  if (!result) notFound();

  // Safety: only draft invoices are editable. Sent/viewed/overdue/partially
  // paid/paid invoices may already be in the client's hands, so editing them
  // would undermine credibility and legal standing. Send users to the detail
  // page, where they can "Duplicate as draft" to make a corrected copy.
  if (result.invoice.status !== "draft") {
    redirect(`/dashboard/invoices/${id}`);
  }

  const [clients, projects] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
  ]);

  return (
    <EditInvoiceView
      invoice={result.invoice}
      items={result.items}
      clients={clients}
      projects={projects}
    />
  );
}
