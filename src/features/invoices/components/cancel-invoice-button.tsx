"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { cancelInvoiceAction } from "../actions";

/**
 * Void an issued invoice. The original is kept (number retained for the audit
 * trail) and marked Cancelled — the legally-correct alternative to deleting a
 * document the client may already hold.
 */
export function CancelInvoiceButton({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const onConfirm = () => {
    const fd = new FormData();
    fd.set("id", invoiceId);
    startTransition(async () => {
      const res = await cancelInvoiceAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${invoiceNumber} cancelled`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive sm:flex-none"
        >
          <Ban className="h-4 w-4" />
          <span className="hidden sm:inline">Cancel</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel invoice {invoiceNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            The invoice is kept and its number retained for your records, but
            marked Cancelled — it stops counting toward revenue and any billed
            time is released so it can be re-invoiced. This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep invoice</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {pending ? "Cancelling…" : "Cancel invoice"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
