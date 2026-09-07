import { Metadata } from "next";
import { Suspense } from "react";
import { RecurringInvoicesView } from "@/features/invoices/components/recurring/recurring-invoices-view";
import { listRecurringInvoices } from "@/features/invoices/recurring-actions";
import { RecurringInvoicesSkeleton } from "@/features/invoices/components/recurring/recurring-invoices-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Recurring Invoices" };
export const dynamic = "force-dynamic";

export default async function RecurringInvoicesPage() {
  const recurringInvoices = await listRecurringInvoices();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring invoices"
        description="Automate retainer and subscription billing. Invoices generate on schedule."
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/invoices/recurring/new">
              <Plus className="h-4 w-4 mr-2" /> Create recurring template
            </Link>
          </Button>
        }
      />

      <Suspense fallback={<RecurringInvoicesSkeleton />}>
        <RecurringInvoicesView items={recurringInvoices} />
      </Suspense>
    </div>
  );
}