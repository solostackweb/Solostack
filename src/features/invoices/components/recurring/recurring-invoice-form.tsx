"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useForm, useWatch, FormProvider } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { getClientInitials, getClientDisplayName } from "@/features/clients/utils";
import {
  recurringInvoiceFormSchema,
  type RecurringInvoiceFormValues,
  RECURRING_FREQUENCIES,
  RECURRING_STATUS,
  type RecurringFrequency,
  type RecurringStatus,
} from "../../schema";
import { createRecurringInvoiceAction, updateRecurringInvoiceAction } from "../../recurring-actions";
import type { ClientRecord } from "@/features/clients/server";
import type { ProjectRecord } from "@/features/projects/server";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function newItemId() {
  return `item_${Math.random().toString(36).slice(2, 9)}`;
}

function buildDefaults(
  profile: {
    invoiceDefaultDueDays: number;
    invoiceDefaultNotes: string | null;
    invoiceDefaultTerms: string | null;
    invoiceDefaultHsnSac: string | null;
    invoiceDefaultGstRate: number;
    gstRegistered: boolean;
  } | null,
): RecurringInvoiceFormValues {
  const gstRate = profile?.gstRegistered ? profile?.invoiceDefaultGstRate ?? 18 : 0;
  return {
    clientId: "",
    projectId: "",
    frequency: "monthly",
    interval: 1,
    dayOfMonth: 1,
    dayOfWeek: null,
    startDate: todayIso(),
    endDate: null,
    maxOccurrences: null,
    currency: "INR",
    issueDateOffset: 0,
    dueDateOffset: 14,
    statusOnCreate: "draft",
    discount: 0,
    notes: profile?.invoiceDefaultNotes ?? "",
    terms: profile?.invoiceDefaultTerms ?? "",
    hsnSac: profile?.invoiceDefaultHsnSac ?? "",
    gstRate,
    items: [{ id: `item_${Math.random().toString(36).slice(2, 9)}`, description: "", quantity: 1, rate: 0, gstRate }],
    invoicePrefix: "",
    invoiceNumberPadding: null,
  };
}

interface RecurringInvoiceFormProps {
  clients: ClientRecord[];
  projects: ProjectRecord[];
  profile: {
    invoiceDefaultDueDays: number;
    invoiceDefaultNotes: string | null;
    invoiceDefaultTerms: string | null;
    invoiceDefaultHsnSac: string | null;
    invoiceDefaultGstRate: number;
    gstRegistered: boolean;
    stateCode: string | null;
    defaultCurrency: string;
  } | null;
  initialValues?: Partial<RecurringInvoiceFormValues>;
  recurringId?: string;
}

export function RecurringInvoiceForm({
  clients,
  projects,
  profile,
  initialValues,
  recurringId,
}: RecurringInvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const sellerGstEnabled = Boolean(profile?.gstRegistered);
  const isEditing = Boolean(recurringId);

  const form = useForm<RecurringInvoiceFormValues>({
    resolver: zodResolver(recurringInvoiceFormSchema),
    defaultValues: initialValues ? { ...buildDefaults(profile), ...initialValues } : buildDefaults(profile),
    mode: "onBlur",
  });

  const { control, register, handleSubmit, setValue, formState } = form;
  const { errors } = formState;

  const { fields, append, remove } = useFormFieldArray({ control, name: "items" });

  const watched = useWatch({ control }) as RecurringInvoiceFormValues;
  const selectedClient = React.useMemo(
    () => clients.find((c) => c.id === watched.clientId) ?? null,
    [clients, watched.clientId],
  );
  const selectedCurrency = selectedClient?.currency ?? profile?.defaultCurrency ?? "INR";
  const gstEnabled = sellerGstEnabled && !selectedClient?.isForeign;

  const projectOptions = React.useMemo(
    () =>
      watched.clientId
        ? projects.filter((p) => p.clientId === watched.clientId)
        : [],
    [projects, watched.clientId],
  );

  const frequencyValue: RecurringFrequency = (watched.frequency as RecurringFrequency | undefined) ?? "monthly";
  const statusOnCreateValue: RecurringStatus = (watched.statusOnCreate as RecurringStatus | undefined) ?? "draft";

  const submit = React.useCallback(
    async (values: RecurringInvoiceFormValues) => {
      setIsSubmitting(true);
      try {
        const itemsPayload = (values.items ?? []).map((item) => ({
          id: item.id,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          gst_rate: gstEnabled ? Number(item.gstRate) || 0 : 0,
        }));

        const payload = {
          clientId: values.clientId || undefined,
          projectId: values.projectId || undefined,
          frequency: values.frequency,
          interval: values.interval,
          dayOfMonth: values.dayOfMonth,
          dayOfWeek: values.dayOfWeek,
          startDate: values.startDate,
          endDate: values.endDate,
          maxOccurrences: values.maxOccurrences,
          currency: selectedCurrency,
          issueDateOffset: values.issueDateOffset,
          dueDateOffset: values.dueDateOffset,
          statusOnCreate: values.statusOnCreate,
          discount: Number(values.discount) || 0,
          notes: values.notes || undefined,
          terms: values.terms || undefined,
          hsnSac: gstEnabled ? (values.hsnSac || "").trim() || undefined : undefined,
          gstRate: gstEnabled ? Number(values.gstRate) || 0 : 0,
          items: itemsPayload,
          invoicePrefix: values.invoicePrefix?.trim() || undefined,
          invoiceNumberPadding: values.invoiceNumberPadding || undefined,
        };

        const fd = new FormData();
        fd.set("payload", JSON.stringify(payload));

        let res: { ok: boolean; error?: string };
        if (isEditing && recurringId) {
          fd.set("id", recurringId);
          res = await updateRecurringInvoiceAction(undefined, fd);
        } else {
          res = await createRecurringInvoiceAction(undefined, fd);
        }

        if (!res.ok) {
          toast.error(res.error);
          return;
        }

        toast.success(isEditing ? "Recurring invoice template updated" : "Recurring invoice template created");
        router.push("/dashboard/invoices/recurring");
        router.refresh();
      } catch {
        toast.error(isEditing ? "Failed to update recurring invoice" : "Failed to create recurring invoice");
      } finally {
        setIsSubmitting(false);
      }
    },
    [gstEnabled, router, selectedCurrency, isEditing, recurringId],
  );

  const onSubmit = handleSubmit(
    (values) => submit(values),
    () => toast.error(`Please fix the errors before ${isEditing ? "updating" : "creating"} the template`),
  );

  return (
    <FormProvider {...form}>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 flex min-h-[calc(100vh-4rem)] flex-col">
        <div className="sticky z-20 flex items-center justify-between gap-2 border-b bg-background/80 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Link href="/dashboard/invoices/recurring" aria-label="Back to recurring invoices">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link href="/dashboard/invoices/recurring" className="hidden text-muted-foreground hover:text-foreground sm:inline">
                Recurring invoices
              </Link>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
              <span className="truncate font-medium">{isEditing ? "Edit template" : "New template"}</span>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onSubmit} disabled={isSubmitting}>
            {isEditing ? "Update template" : "Create template"}
          </Button>
        </div>

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <form className="space-y-6 max-w-3xl" noValidate>
            {/* Client & Project */}
            <SectionCard label="Client & Project">
              <div className="grid gap-4 sm:grid-cols-2">
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
                        <div className="px-3 py-2 text-xs text-muted-foreground">No clients yet — add one first.</div>
                      )}
                      {clients.map((c) => {
                        const name = getClientDisplayName(c);
                        return (
                          <SelectItem key={c.id} value={c.id} textValue={name}>
                            <span className="inline-flex items-center gap-2">
                              <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-medium">
                                {getClientInitials(name)}
                              </span>
                              <span>{name}</span>
                              {c.businessName && c.businessName !== name && (
                                <>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground">{c.businessName}</span>
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
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </SectionCard>

            {/* Recurrence Rule */}
            <SectionCard label="Recurrence">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Frequency" error={errors.frequency?.message}>
                    <Select
                      value={frequencyValue}
                      onValueChange={((v: RecurringFrequency | undefined) => { if (v) setValue("frequency", v, { shouldValidate: true }); }) as (value: string) => void}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRING_FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Every" error={errors.interval?.message}>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      {...register("interval", { valueAsNumber: true })}
                      className="w-full tabular-nums"
                    />
                  </Field>

                  {watched.frequency === "weekly" ? (
                    <Field label="Day of week" error={errors.dayOfWeek?.message}>
                      <Select
                        value={watched.dayOfWeek !== null && watched.dayOfWeek !== undefined ? String(watched.dayOfWeek) : ""}
                        onValueChange={(v) => setValue("dayOfWeek", v ? Number(v) : null, { shouldValidate: true })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : (
                    <Field label="Day of month" error={errors.dayOfMonth?.message}>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        {...register("dayOfMonth", { valueAsNumber: true })}
                        className="w-full tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground">Use 31 for &ldquo;last day of month&rdquo;</p>
                    </Field>
                  )}

                  <Field label="Start date" error={errors.startDate?.message}>
                    <Input type="date" {...register("startDate")} />
                  </Field>

                  <Field label="End date (optional)" error={errors.endDate?.message}>
                    <Input type="date" {...register("endDate")} />
                    <p className="text-xs text-muted-foreground">Leave empty for no end date</p>
                  </Field>

                  <Field label="Max occurrences (optional)" error={errors.maxOccurrences?.message}>
                    <Input
                      type="number"
                      min="1"
                      {...register("maxOccurrences", { valueAsNumber: true })}
                      className="w-full tabular-nums"
                      placeholder="Unlimited"
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            {/* Invoice Details */}
            <SectionCard label="Invoice details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Currency" error={errors.currency?.message}>
                  <Input {...register("currency")} disabled />
                  <p className="text-xs text-muted-foreground">Inherited from client</p>
                </Field>

                <Field label="Status on create" error={errors.statusOnCreate?.message}>
                  <Select value={statusOnCreateValue} onValueChange={((v: RecurringStatus | undefined) => { if (v) setValue("statusOnCreate", v); }) as (value: string) => void}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Issue date offset" error={errors.issueDateOffset?.message}>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    {...register("issueDateOffset", { valueAsNumber: true })}
                    className="w-full tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">Days after period start</p>
                </Field>

                <Field label="Due date offset" error={errors.dueDateOffset?.message}>
                  <Input
                    type="number"
                    min="0"
                    max="90"
                    {...register("dueDateOffset", { valueAsNumber: true })}
                    className="w-full tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">Days after issue date</p>
                </Field>
              </div>
            </SectionCard>

            {/* Line items */}
            <SectionCard label="Line items">
              <div className="-mx-4 overflow-hidden border-y sm:-mx-6">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-4 py-2 text-micro font-semibold uppercase tracking-wider text-muted-foreground border-b">
                  <span>Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">GST%</span>
                  <span></span>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-4 py-2 border-b items-center">
                    <Input
                      {...register(`items.${index}.description`)}
                      placeholder="Description"
                      className="min-w-0"
                    />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      className="w-20 text-right tabular-nums"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      {...register(`items.${index}.rate`, { valueAsNumber: true })}
                      className="w-28 text-right tabular-nums"
                    />
                    {gstEnabled ? (
                      <Select
                        value={String(watched.items[index]?.gstRate ?? 18)}
                        onValueChange={(v) => setValue(`items.${index}.gstRate`, Number(v), { shouldValidate: true })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0% Exempt</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type="hidden" {...register(`items.${index}.gstRate`)} />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-start pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: newItemId(), description: "", quantity: 1, rate: 0, gstRate: gstEnabled ? 18 : 0 })}>
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add line item
                </Button>
              </div>
            </SectionCard>

            {/* Tax & Discount */}
            <SectionCard label={gstEnabled ? "GST & Discount" : "Discount"}>
              <div className="grid gap-4 sm:grid-cols-2">
                {gstEnabled && (
                  <Field label="Default GST rate" error={errors.gstRate?.message}>
                    <Select value={String(watched.gstRate ?? 18)} onValueChange={(v) => setValue("gstRate", Number(v), { shouldValidate: true })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% · Exempt</SelectItem>
                        <SelectItem value="5">5% GST</SelectItem>
                        <SelectItem value="12">12% GST</SelectItem>
                        <SelectItem value="18">18% GST</SelectItem>
                        <SelectItem value="28">28% GST</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {gstEnabled && (
                  <Field label="HSN / SAC code" error={errors.hsnSac?.message}>
                    <Input {...register("hsnSac")} placeholder="e.g. 998314 (services)" />
                  </Field>
                )}

                <Field label={`Discount amount (${selectedCurrency})`} hint="Applied to subtotal before tax" error={errors.discount?.message}>
                  <Input type="number" min="0" step="1" {...register("discount")} className="tabular-nums" />
                </Field>
              </div>
            </SectionCard>

            {/* Notes + Terms */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <SectionCard label="Notes" error={errors.notes?.message}>
                <Textarea {...register("notes")} rows={4} placeholder="Notes visible to the client…" className="resize-none" />
              </SectionCard>
              <SectionCard label="Terms" error={errors.terms?.message}>
                <Textarea {...register("terms")} rows={4} placeholder="Payment terms, late fees…" className="resize-none" />
              </SectionCard>
            </div>

            {/* Advanced options */}
            <SectionCard label="Advanced (optional)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Invoice prefix" error={errors.invoicePrefix?.message}>
                  <Input {...register("invoicePrefix")} placeholder="INV-" />
                  <p className="text-xs text-muted-foreground">Overrides your default prefix</p>
                </Field>
                <Field label="Number padding" error={errors.invoiceNumberPadding?.message}>
                  <Input type="number" min="1" max="10" {...register("invoiceNumberPadding", { valueAsNumber: true })} className="w-full tabular-nums" placeholder="4" />
                  <p className="text-xs text-muted-foreground">Digits in invoice number (e.g. 4 → INV-0043)</p>
                </Field>
              </div>
            </SectionCard>

            <div aria-hidden className="h-16 sm:hidden" />
          </form>
        </div>
      </div>
    </FormProvider>
  );
}

// --- Internal helpers ---

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
          <Label className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
          {error && <p className="text-right text-xs font-medium text-destructive">{error}</p>}
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
      <Label className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-micro text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// Re-export useFormFieldArray from react-hook-form
import { useFieldArray as useFormFieldArray } from "react-hook-form";