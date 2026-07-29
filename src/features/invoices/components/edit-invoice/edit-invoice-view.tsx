"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { useForm, useFieldArray, useWatch, FormProvider } from "react-hook-form";
import { draftInvoiceFieldAction } from "@/features/invoices/ai-assist";
import { FieldProposalReview } from "@/features/ai-workflows/components/field-proposal-review";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getClientInitials, getClientDisplayName } from "@/features/clients/utils";
import type { ClientRecord } from "@/features/clients/server";
import type { ProjectRecord } from "@/features/projects/server";
import {
  invoiceFormSchema,
  computeInvoiceTotals,
  GST_RATES,
} from "../../schema";
import type { InvoiceFormValues, PaymentMethod } from "../../schema";
import type { InvoiceRecord, InvoiceItemRecord } from "../../server";
import { updateInvoiceAction } from "../../actions";
import { InvoiceItemRow, InvoiceItemsHeader } from "../new-invoice/invoice-item-row";
import { InvoiceSummaryCard } from "../new-invoice/invoice-summary-card";
import { InvoicePreview } from "../new-invoice/invoice-preview";
import { useProfile } from "@/features/profile/context";

function newItemId() {
  return `item_${Math.random().toString(36).slice(2, 9)}`;
}

function buildEditDefaults(
  invoice: InvoiceRecord,
  items: InvoiceItemRecord[],
): InvoiceFormValues {
  // Map DB tax_mode values → form taxMode values
  const taxMode =
    invoice.taxMode === "cgst_sgst"
      ? "intra"
      : invoice.taxMode === "igst"
        ? "inter"
        : "intra";
  const gstRate = items[0]?.gstRate ?? 0;
  const paymentMethod: PaymentMethod =
    (invoice.paymentMethod as PaymentMethod) ?? "bank";

  return {
    invoiceNumber: invoice.invoiceNumber,
    clientId: invoice.clientId ?? "",
    projectId: invoice.projectId ?? "",
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    items:
      items.length > 0
        ? items.map((item) => ({
            id: newItemId(),
            description: item.description,
            quantity: item.quantity,
            rate: item.unitPrice,
          }))
        : [{ id: newItemId(), description: "", quantity: 1, rate: 0 }],
    taxMode,
    gstRate,
    discount: invoice.discount,
    paymentMethod,
    hsnSac: invoice.hsnSac ?? "",
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
  };
}

interface EditInvoiceViewProps {
  invoice: InvoiceRecord;
  items: InvoiceItemRecord[];
  clients: ClientRecord[];
  projects: ProjectRecord[];
}

export function EditInvoiceView({
  invoice,
  items,
  clients,
  projects,
}: EditInvoiceViewProps) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = React.useState(true);
  const { profile } = useProfile();
  const gstEnabled = Boolean(profile?.gstRegistered);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: buildEditDefaults(invoice, items),
    mode: "onBlur",
  });

  const { control, register, handleSubmit, setValue, formState } = form;
  const { errors, isSubmitting } = formState;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watched = useWatch({ control }) as InvoiceFormValues;

  React.useEffect(() => {
    if (!gstEnabled) {
      setValue("gstRate", 0, { shouldValidate: true });
      setValue("taxMode", "intra", { shouldValidate: true });
    }
  }, [gstEnabled, setValue]);

  const effectiveTaxMode = gstEnabled ? watched.taxMode ?? "intra" : "intra";
  const effectiveGstRate = gstEnabled ? watched.gstRate ?? 0 : 0;

  const totals = React.useMemo(
    () =>
      computeInvoiceTotals({
        items: watched.items ?? [],
        taxMode: effectiveTaxMode,
        gstRate: effectiveGstRate,
        discount: watched.discount ?? 0,
      }),
    [watched.items, effectiveTaxMode, effectiveGstRate, watched.discount],
  );

  const selectedClient = React.useMemo(
    () => clients.find((c) => c.id === watched.clientId) ?? null,
    [clients, watched.clientId],
  );
  // ── Inline Ivo drafting for Notes + Terms ─────────────────────────────────
  const [ivoDrafting, setIvoDrafting] = React.useState<null | "notes" | "terms">(null);
  /** A suggestion awaiting review. Applying it is a separate, explicit action. */
  const [ivoProposal, setIvoProposal] = React.useState<
    null | { field: "notes" | "terms"; proposed: string }
  >(null);
  const handleIvoDraft = React.useCallback(
    async (field: "notes" | "terms") => {
      setIvoDrafting(field);
      const values = form.getValues();
      const res = await draftInvoiceFieldAction({
        field,
        clientName: selectedClient ? getClientDisplayName(selectedClient) : undefined,
        currency: (selectedClient?.currency || invoice.currency || "INR").toUpperCase(),
        items: (values.items ?? [])
          .map((item) => String(item.description ?? "").trim())
          .filter(Boolean)
          .slice(0, 25),
        total: totals.total,
        dueDate: values.dueDate || undefined,
        isExport: Boolean(selectedClient?.isForeign),
      });
      setIvoDrafting(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Hold the suggestion for review rather than writing it into the field.
      // Notes and Terms usually already contain the user's own wording, and a
      // silent replacement would lose it with no way back.
      setIvoProposal({ field, proposed: res.text });
    },
    [form, selectedClient, invoice.currency, totals.total],
  );

  const ivoReviewFor = (field: "notes" | "terms") => {
    const pending = ivoProposal;
    if (!pending || pending.field !== field) return null;
    return (
      <FieldProposalReview
        className="mt-2"
        original={form.getValues(field) ?? ""}
        proposed={pending.proposed}
        onApply={(next) => {
          setValue(field, next, { shouldValidate: true, shouldDirty: true });
          setIvoProposal(null);
          toast.success("Applied — you can still edit it before sending.");
        }}
        onDiscard={() => setIvoProposal(null)}
      />
    );
  };
  const ivoDraftButton = (field: "notes" | "terms") => (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        void handleIvoDraft(field);
      }}
      disabled={ivoDrafting !== null}
      className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
    >
      <Sparkles className="h-3 w-3" />
      {ivoDrafting === field ? "Drafting…" : "Draft with Ivo"}
    </button>
  );

  const selectedClientName = selectedClient
    ? getClientDisplayName(selectedClient)
    : undefined;
  const selectedCurrency = (selectedClient?.currency || invoice.currency || "INR").toUpperCase();

  const previewValues = React.useMemo(
    () => ({ ...watched, taxMode: effectiveTaxMode, gstRate: effectiveGstRate }),
    [watched, effectiveTaxMode, effectiveGstRate],
  );

  const projectOptions = React.useMemo(
    () =>
      watched.clientId
        ? projects.filter((p) => p.clientId === watched.clientId)
        : [],
    [projects, watched.clientId],
  );

  const submit = React.useCallback(
    async (values: InvoiceFormValues) => {
      const totalsForLines = (values.items ?? []).map((item, index) => ({
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.rate) || 0,
        gstRate: gstEnabled ? Number(values.gstRate) || 0 : 0,
        position: index,
      }));
      const payload = {
        clientId: values.clientId || undefined,
        projectId: values.projectId || undefined,
        invoiceNumber: values.invoiceNumber,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        discount: Number(values.discount) || 0,
        notes: values.notes || undefined,
        terms: values.terms || undefined,
        hsnSac: gstEnabled ? (values.hsnSac || "").trim() || undefined : undefined,
        lines: totalsForLines,
      };
      const fd = new FormData();
      fd.set("id", invoice.id);
      fd.set("payload", JSON.stringify(payload));
      const res = await updateInvoiceAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice updated");
      router.push(`/dashboard/invoices/${invoice.id}`);
      router.refresh();
    },
    [gstEnabled, invoice.id, router],
  );

  const onSave = handleSubmit(
    (values) => submit(values),
    () => toast.error("Please fix the errors before saving"),
  );

  return (
    <FormProvider {...form}>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 flex min-h-[calc(100vh-4rem)] flex-col">
        {/* Top action bar */}
        <div
          className="sticky z-20 flex items-center justify-between gap-2 border-b bg-background/80 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3 lg:px-8"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
            >
              <Link
                href={`/dashboard/invoices/${invoice.id}`}
                aria-label="Back to invoice"
              >
                <ArrowLeft />
              </Link>
            </Button>
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link
                href="/dashboard/invoices"
                className="hidden text-muted-foreground hover:text-foreground sm:inline"
              >
                Invoices
              </Link>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
              <Link
                href={`/dashboard/invoices/${invoice.id}`}
                className="hidden text-muted-foreground hover:text-foreground sm:inline"
              >
                {invoice.invoiceNumber}
              </Link>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
              <span className="truncate font-medium">Edit</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() => setPreviewOpen((v) => !v)}
            >
              {previewOpen ? <EyeOff /> : <Eye />}
              {previewOpen ? "Hide preview" : "Show preview"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={isSubmitting}
              className="hidden sm:inline-flex"
            >
              <Save /> Save changes
            </Button>
          </div>
        </div>

        {/* Split body */}
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div
            className={cn(
              "grid gap-6",
              previewOpen
                ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]"
                : "lg:grid-cols-1",
            )}
          >
            {/* LEFT: editor */}
            <form className="space-y-6" noValidate>
              {/* Details */}
              <SectionCard label="Details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Invoice number"
                    error={errors.invoiceNumber?.message}
                  >
                    <Input
                      {...register("invoiceNumber")}
                      placeholder="INV-0043"
                    />
                  </Field>
                  <div className="hidden sm:block" />

                  <Field label="Issue date" error={errors.issueDate?.message}>
                    <Input type="date" {...register("issueDate")} />
                  </Field>
                  <Field label="Due date" error={errors.dueDate?.message}>
                    <Input type="date" {...register("dueDate")} />
                  </Field>

                  <Field label="Client" error={errors.clientId?.message}>
                    <Select
                      value={watched.clientId || ""}
                      onValueChange={(v) => {
                        setValue("clientId", v, { shouldValidate: true });
                        setValue("projectId", "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            No clients yet.
                          </div>
                        )}
                        {clients.map((c) => {
                          const name = getClientDisplayName(c);
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="inline-flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[9px]">
                                    {getClientInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                {name}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>

                  {projectOptions.length > 0 && (
                    <Field label="Project" error={errors.projectId?.message}>
                      <Select
                        value={watched.projectId || ""}
                        onValueChange={(v) =>
                          setValue("projectId", v, { shouldValidate: true })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project…" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </div>
              </SectionCard>

              {/* Line items */}
              <SectionCard label="Line items">
                <InvoiceItemsHeader />
                <div className="mt-2 space-y-1">
                  {fields.map((field, index) => (
                    <InvoiceItemRow
                      key={field.id}
                      index={index}
                      onRemove={() => remove(index)}
                      canRemove={fields.length > 1}
                      currency={selectedCurrency}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full text-xs"
                  onClick={() =>
                    append({
                      id: newItemId(),
                      description: "",
                      quantity: 1,
                      rate: 0,
                    })
                  }
                >
                  + Add line item
                </Button>
              </SectionCard>

              {/* Tax & discount */}
              <SectionCard label={gstEnabled ? "GST & discount" : "Discount"}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {gstEnabled && (
                    <>
                      <Field label="Tax mode" error={errors.taxMode?.message}>
                        <Select
                          value={watched.taxMode ?? "intra"}
                          onValueChange={(v) =>
                            setValue(
                              "taxMode",
                              v as "intra" | "inter",
                              { shouldValidate: true },
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="intra">
                              Intra-state (CGST + SGST)
                            </SelectItem>
                            <SelectItem value="inter">
                              Inter-state (IGST)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="GST rate" error={errors.gstRate?.message}>
                        <Select
                          value={String(watched.gstRate ?? 18)}
                          onValueChange={(v) =>
                            setValue("gstRate", Number(v), {
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map((r) => (
                              <SelectItem key={r} value={String(r)}>
                                {r}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="HSN / SAC code" error={errors.hsnSac?.message}>
                        <Input
                          {...register("hsnSac")}
                          placeholder="e.g. 998314 (services)"
                        />
                      </Field>
                    </>
                  )}
                  <Field label={`Discount (${selectedCurrency})`} error={errors.discount?.message}>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register("discount")}
                      placeholder="0"
                    />
                  </Field>
                </div>
              </SectionCard>

              {/* Payment — configured globally in settings */}
              <SectionCard label="Payment">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Clients pay using the method set in your{" "}
                  <Link
                    href="/dashboard/settings/payments"
                    className="font-medium text-primary hover:underline"
                  >
                    payment settings
                  </Link>
                  .
                </p>
              </SectionCard>

              {/* Notes + Terms */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <SectionCard
                  label="Notes"
                  error={errors.notes?.message}
                  action={ivoDraftButton("notes")}
                >
                  <Textarea
                    {...register("notes")}
                    rows={4}
                    placeholder="Add notes visible to the client…"
                    className="resize-none"
                  />
                  {ivoReviewFor("notes")}
                </SectionCard>
                <SectionCard
                  label="Terms"
                  error={errors.terms?.message}
                  action={ivoDraftButton("terms")}
                >
                  <Textarea
                    {...register("terms")}
                    rows={4}
                    placeholder="Payment terms, late fees…"
                    className="resize-none"
                  />
                  {ivoReviewFor("terms")}
                </SectionCard>
              </div>

              <div aria-hidden className="h-16 sm:hidden" />
            </form>

            {/* RIGHT: sticky summary + preview */}
            {previewOpen && (
              <aside className="space-y-4">
                <div className="sticky top-20 space-y-4">
                  <InvoiceSummaryCard
                    totals={totals}
                    gstRate={effectiveGstRate}
                    taxMode={effectiveTaxMode}
                    dueDate={watched.dueDate}
                    currency={selectedCurrency}
                  />
                  <div className="hidden xl:block">
                    <InvoicePreview
                      values={previewValues}
                      totals={totals}
                      clientName={selectedClientName}
                      clientCompany={
                        selectedClient?.businessName ?? undefined
                      }
                      clientEmail={selectedClient?.email ?? undefined}
                      currency={selectedCurrency}
                    />
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* Mobile fixed action bar */}
        <div
          className="fixed inset-x-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur sm:hidden"
          style={{
            bottom:
              "calc(var(--mobile-bottom-nav-h, 0px) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <Button
            type="button"
            onClick={onSave}
            disabled={isSubmitting}
            className="h-11 w-full text-[15px]"
          >
            <Save /> Save changes
          </Button>
        </div>
      </div>
    </FormProvider>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function SectionCard({
  label,
  children,
  error,
  action,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  /** Optional right-aligned control in the label row (e.g. "Draft with Ivo"). */
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <span className="flex items-center gap-2">
            {error && (
              <p className="text-right text-xs font-medium text-destructive">
                {error}
              </p>
            )}
            {action}
          </span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
