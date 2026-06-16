"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { duplicateInvoiceAction } from "../actions";

/**
 * Duplicate a (typically non-draft) invoice into a fresh editable draft.
 *
 * This is the safe correction path for invoices that have already been sent:
 * the original stays immutable for credibility + legal integrity, and the
 * freelancer edits the new draft copy instead. Routes straight to the new
 * draft's edit page on success.
 */
export function DuplicateInvoiceButton({
  invoiceId,
  invoiceNumber,
  label = "Duplicate",
}: {
  invoiceId: string;
  invoiceNumber: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onClick = () => {
    const fd = new FormData();
    fd.set("id", invoiceId);
    startTransition(async () => {
      const res = await duplicateInvoiceAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${invoiceNumber} duplicated as a draft`);
      router.refresh();
      if (res.data?.id) {
        router.push(`/dashboard/invoices/${res.data.id}/edit`);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex-1 sm:flex-none"
      onClick={onClick}
      disabled={pending}
    >
      <Copy className="h-4 w-4" />
      <span className="hidden sm:inline">{pending ? "Duplicating…" : label}</span>
    </Button>
  );
}
