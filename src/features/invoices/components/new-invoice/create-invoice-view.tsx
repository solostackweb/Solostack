"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { useForm, useFieldArray, useWatch, FormProvider } from "react-hook-form";
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
import type { InvoiceFormValues } from "../../schema";
import { createInvoiceAction } from "../../actions";
import { sendInvoiceAction } from "../../delivery";
import { InvoiceItemRow, InvoiceItemsHeader } from "./invoice-item-row";
import { InvoiceSummaryCard } from "./invoice-summary-card";
import { InvoicePreview } from "./invoice-preview";
import { useProfile } from "@/features/profile/context";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function newItemId() {
  return `item_${Math.random().toString(36).slice(2, 9)}`;
}

function buildDefaults(
  invoiceNumber: string,
  profile: {
    invoiceDefaultDueDays: number;
    invoiceDefaultNotes: string | null;
    invoiceDefaultTerms: string | null;
    invoiceDefaultTaxMode: "intra" | "inter";
    invoiceDefaultGstRate: number;
    gstRegistered: boolean;
  } | null,
): InvoiceFormValues {
  const gstRate = profile?.gstRegistered
    ? profile?.invoiceDefaultGstRate ?? 18
    : 0;
  const taxMode = profile?.invoiceDefaultTaxMode ?? "intra";
  return {
    invoiceNumber,
    clientId: "",
    projectId: "",
    issueDate: todayIso(),
    dueDate: todayIso(),
    items: [{ id: newItemId(), description: "", quantity: 1, rate: 0 }],
    taxMode,
    gstRate,
    discount: 0,
    paymentMethod: "bank",
    notes: profile?.invoiceDefaultNotes ?? "",
    terms: profile?.invoiceDefaultTerms ?? "",
  };
}

/**
 * Orchestrates the entire "create invoice" workflow:
 *  - Renders the split layout (editor on the left, sticky summary + preview on the right)
 *  - Owns the RHF form and wires line-item array ops
 *  - Derives live totals via `useWatch` so the right column stays in sync
 */
import {
  UnbilledTimePanel,
  type UnbilledEntryLite,
  type UnbilledGroupSelection,
} from "./unbilled-time-panel";

interface CreateInvoiceViewProps {
  clients: ClientRecord[];
  projects: ProjectRecord[];
  nextInvoiceNumber: string;
  /** Billable, uninvoiced time entries (all clients; filtered client-side). */
  unbilledTime?: UnbilledEntryLite[];
}

export function CreateInvoiceView({
  clients,
  projects,
  nextInvoiceNumber,
  unbilledTime = [],
}: CreateInvoiceViewProps) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = React.useState(true);
  const { profile } = useProfile();
  const gstEnabled = Boolean(profile?.gstRegistered);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: buildDefaults(nextInvoiceNumber, profile),
    mode: "onBlur",
  });

  const { control, register, handleSubmit, setValue, formState } = form;
  const { errors, isSubmitting } = formState;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // Unbilled-time groups pulled onto this invoice. Key = project group key;
  // value carries the covered entry ids + the generated line description so
  // submit can skip groups whose line item was manually deleted.
  const [addedTime, setAddedTime] = React.useState<
    Record<string, { ids: string[]; description: string }>
  >({});

  const handleAddTimeGroup = React.useCallback(
    (g: UnbilledGroupSelection) => {
      append({ id: newItemId(), description: g.description, quantity: g.hours, rate: g.rate });
      setAddedTime((prev) => ({
        ...prev,
        [g.key]: { ids: g.ids, description: g.description },
      }));
    },
    [append],
  );

  const handleUndoTimeGroup = React.useCallback(
    (key: string) => {
      setAddedTime((prev) => {
        const meta = prev[key];
        if (meta) {
          const items = form.getValues("items") ?? [];
          const idx = items.findIndex((it) => it.description === meta.description);
          if (idx >= 0) remove(idx);
        }
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [form, remove],
  );

  // Live values for the preview + summary
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

  // Resolve selected client + project-for-client list
  const selectedClient = React.useMemo(
    () => clients.find((c) => c.id === watched.clientId) ?? null,
    [clients, watched.clientId],
  );
  const selectedClientName = selectedClient
    ? getClientDisplayName(selectedClient)
    : undefined;
  const previewValues = React.useMemo(
    () => ({
      ...watched,
      taxMode: effectiveTaxMode,
      gstRate: effectiveGstRate,
    }),
    [watched, effectiveTaxMode, effectiveGstRate],
  );
  const projectOptions = React.useMemo(
    () =>
      watched.clientId
        ? projects.filter((p) => p.clientId === watched.clientId)
        : [],
    [projects, watched.clientId],
  );

  // Tracks whether the submit was triggered by "save draft" or "create & send"
  const submitModeRef = React.useRef<"draft" | "send">("send");

  const submit = React.useCallback(
    async (values: InvoiceFormValues) => {
      const isSendMode = submitModeRef.current === "send";
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
        currency: profile?.defaultCurrency ?? "INR",
        // Always create as draft first; the send step below promotes to "sent".
        status: "draft",
        discount: Number(values.discount) || 0,
        notes: values.notes || undefined,
        terms: values.terms || undefined,
        lines: totalsForLines,
        timeEntryIds: Object.values(addedTime)
          .filter((meta) =>
            (values.items ?? []).some((it) => it.description === meta.description),
          )
          .flatMap((meta) => meta.ids),
      };
      const fd = new FormData();
      fd.set("payload", JSON.stringify(payload));
      const res = await createInvoiceAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const invoiceId = res.data?.id;
      if (!invoiceId) {
        toast.success(`Invoice ${values.invoiceNumber} saved as draft`);
        router.push("/dashboard/invoices");
        router.refresh();
        return;
      }
      if (!isSendMode) {
        toast.success(`Invoice ${values.invoiceNumber} saved as draft`);
        router.push(`/dashboard/invoices/${invoiceId}`);
        router.refresh();
        return;
      }
      const send = await sendInvoiceAction({ invoiceId });
      if (!send.ok) {
        toast.warning(send.error);
      } else {
        toast.success(`Invoice ${values.invoiceNumber} sent`);
      }
      router.push("/dashboard/invoices");
      router.refresh();
    },
    [gstEnabled, profile?.defaultCurrency, router],
  );

  const onSend = handleSubmit(
    (values) => { submitModeRef.current = "send"; return submit(values); },
    () => toast.error("Please fix the errors before creating the invoice"),
  );

  const onDraft = handleSubmit(
    (values) => { submitModeRef.current = "draft"; return submit(values); },
    () => toast.error("Please fix the errors before saving the invoice"),
  );

  return (
    <FormProvider {...form}>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 flex min-h-[calc(100vh-4rem)] flex-col">
        {/* Top action bar — sticks under TopNav. Pushes the long CTA into a
            fixed bottom action bar on mobile so the primary action is always
            reachable above the bottom-nav + iOS home indicator. */}
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
              <Link href="/dashboard/invoices" aria-label="Back to invoices">
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
              <span className="truncate font-medium">New invoice</span>
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
            {/* Desktop actions — hidden on mobile (duplicated in fixed bottom bar) */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDraft}
              disabled={isSubmitting}
              className="hidden sm:inline-flex"
            >
              Save as draft
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSend}
              disabled={isSubmitting}
              className="hidden sm:inline-flex"
            >
              <Send /> Create &amp; send
            </Button>
          </div>
        </div>

        {/* Split body */}
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div
            className={cn(
              "grid gap-6",
              previewOpen ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]" : "lg:grid-cols-1",
            )}
          >
            {/* LEFT: editor */}
            <form className="space-y-6" noValidate>
              {/* Details */}
              <SectionCard label="Details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Invoice number" error={errors.invoiceNumber?.message}>
                    <Input {...register("invoiceNumber")} placeholder="INV-0043" />
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
                            No clients yet — add one first.
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
                                <span>{name}</span>
                                {c.businessName && c.businessName !== name && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground">
                                      {c.businessName}
                                    </span>
                                  </>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    label="Project"
                    hint={!watched.clientId ? "Choose a client first" : undefined}
                    error={errors.projectId?.message}
                  >
                    <Select
                      value={watched.projectId || ""}
                      onValueChange={(v) => setValue("projectId", v)}
                      disabled={!watched.clientId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            watched.clientId
                              ? projectOptions.length
                                ? "Attach to a project…"
                                : "No projects for this client"
                              : "Attach to a project…"
                          }
                        />
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
                </div>
              </SectionCard>

              {/* Line items */}
              <SectionCard label="Line items" error={errors.items?.message}>
                <UnbilledTimePanel
                  entries={unbilledTime}
                  clientId={watched.clientId || null}
                  projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                  addedKeys={Object.keys(addedTime)}
                  onAdd={handleAddTimeGroup}
                  onUndo={handleUndoTimeGroup}
                />
                {/* Negative margins must match SectionCard horizontal padding
                    at each breakpoint (p-4 mobile, p-6 sm+) so the row
                    dividers reach all the way to the card edges. */}
                <div className="-mx-4 overflow-hidden border-y sm:-mx-6">
                  <InvoiceItemsHeader />
                  {fields.map((field, index) => (
                    <InvoiceItemRow
                      key={field.id}
                      index={index}
                      canRemove={fields.length > 1}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </div>
                <div className="flex justify-start pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        id: newItemId(),
                        description: "",
                        quantity: 1,
                        rate: 0,
                      })
                    }
                  >
                    <Plus /> Add line item
                  </Button>
                </div>
              </SectionCard>

              {/* Tax & discount */}
              <SectionCard label={gstEnabled ? "GST & discount" : "Discount"}>
                <div className="grid gap-5 sm:grid-cols-2">
                  {gstEnabled ? (
                  <Field label="Tax mode">
                    <div className="inline-flex rounded-md bg-muted p-0.5">
                      {(["intra", "inter"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setValue("taxMode", mode)}
                          className={cn(
                            "rounded-[5px] px-3 py-1 text-xs font-medium transition-colors",
                            watched.taxMode === mode
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {mode === "intra" ? "Intra-state" : "Inter-state"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  ) : (
                    <div className="rounded-md border bg-muted/40 p-4 text-sm sm:col-span-2">
                      <p className="font-medium">Standard invoice</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        GST controls are hidden because your business profile is
                        marked as not GST registered. Enable GST in Company
                        settings to create GST invoices.
                      </p>
                    </div>
                  )}

                  {gstEnabled ? (
                  <Field label="GST rate" error={errors.gstRate?.message}>
                    <Select
                      value={String(watched.gstRate ?? 18)}
                      onValueChange={(v) =>
                        setValue("gstRate", Number(v), { shouldValidate: true })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            {r === 0 ? "0% · Exempt" : `${r}% GST`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  ) : null}

                  <Field
                    label="Discount amount (₹)"
                    hint="Applied to the subtotal before tax"
                    error={errors.discount?.message}
                  >
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      {...register("discount")}
                      className="tabular-nums"
                    />
                  </Field>
                </div>
              </SectionCard>

              {/* Payment — configured globally in settings */}
              <SectionCard label="Payment">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Clients pay using the method set in your{" "}
                  <Link
                    href="/dashboard/settings/invoice"
                    className="font-medium text-primary hover:underline"
                  >
                    payment settings
                  </Link>
                  . It appears automatically on the invoice and the public payment page.
                </p>
              </SectionCard>

              {/* Notes + Terms */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <SectionCard label="Notes" error={errors.notes?.message}>
                  <Textarea
                    {...register("notes")}
                    rows={4}
                    placeholder="Add notes visible to the client…"
                    className="resize-none"
                  />
                </SectionCard>
                <SectionCard label="Terms" error={errors.terms?.message}>
                  <Textarea
                    {...register("terms")}
                    rows={4}
                    placeholder="Payment terms, late fees…"
                    className="resize-none"
                  />
                </SectionCard>
              </div>

              {/* Bottom spacer so mobile fixed action bar never overlaps the
                  last field while scrolled to bottom. */}
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
                  />
                  <div className="hidden xl:block">
                    <InvoicePreview
                      values={previewValues}
                      totals={totals}
                      clientName={selectedClientName}
                      clientCompany={selectedClient?.businessName ?? undefined}
                      clientEmail={selectedClient?.email ?? undefined}
                    />
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* Mobile-only fixed action bar. Pinned above MobileBottomNav so the
            primary CTA stays in thumb reach without ever colliding with the
            iOS home indicator. */}
        <div
          className="fixed inset-x-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur sm:hidden"
          style={{
            bottom: "calc(var(--mobile-bottom-nav-h, 0px) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onDraft}
              disabled={isSubmitting}
              className="h-11 flex-1 text-[15px]"
            >
              Save draft
            </Button>
            <Button
              type="button"
              onClick={onSend}
              disabled={isSubmitting}
              className="h-11 flex-[2] text-[15px]"
            >
              <Send /> Create &amp; send
            </Button>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}

// ---------------------------------------------------------------------------
// Internal: SectionCard + Field — small local wrappers to keep the form body
// lean and consistent. Not exported because they're not reused elsewhere.
// ---------------------------------------------------------------------------

function SectionCard({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {error && (
            <p className="text-right text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
