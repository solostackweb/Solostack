"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SettingsSection,
  SettingsField,
  SettingsPageHeader,
  SettingsToggleRow,
} from "@/features/settings/components/settings-section";
import { GST_RATES } from "@/features/invoices/schema";
import { useProfile } from "@/features/profile/context";
import { updateInvoiceDefaults } from "@/features/profile/actions";
import type { InvoiceDefaultsInput } from "@/features/profile/schemas";

export default function InvoiceSettingsPage() {
  const { profile, setProfile } = useProfile();
  const gstEnabled = Boolean(profile?.gstRegistered);

  const form = useForm<InvoiceDefaultsInput>({
    defaultValues: {
      invoicePrefix: profile?.invoicePrefix ?? "INV-",
      invoiceNextNumber: profile?.invoiceNextNumber ?? 1,
      invoiceNumberPadding: profile?.invoiceNumberPadding ?? 4,
      invoiceResetYearly: profile?.invoiceResetYearly ?? false,
      invoiceDefaultTaxMode: profile?.invoiceDefaultTaxMode ?? "intra",
      invoiceDefaultGstRate: profile?.invoiceDefaultGstRate ?? 18,
      invoiceDefaultHsnSac: profile?.invoiceDefaultHsnSac ?? "",
      invoiceDefaultDueDays: profile?.invoiceDefaultDueDays ?? 14,
      invoiceDefaultNotes: profile?.invoiceDefaultNotes ?? "",
      invoiceDefaultTerms: profile?.invoiceDefaultTerms ?? "",
      defaultCurrency: profile?.defaultCurrency ?? "INR",
      invoiceSendReminders: profile?.invoiceSendReminders ?? true,
    },
  });

  const saveAll = form.handleSubmit(async (values) => {
    const payload = gstEnabled
      ? values
      : {
          ...values,
          invoiceDefaultTaxMode: "intra" as const,
          invoiceDefaultGstRate: 0,
        };
    const res = await updateInvoiceDefaults(payload);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    form.reset(values);
    toast.success(res.message ?? "Invoice defaults saved");
  });

  const { errors, isDirty, isSubmitting } = form.formState;

  return (
    <>
      <SettingsPageHeader
        title="Invoice defaults"
        description="Preset values used whenever you create a new invoice."
      />

      <SettingsSection
        title="Numbering"
        description="How new invoices are numbered automatically."
        onSave={saveAll}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <SettingsField
            label="Prefix"
            hint="e.g. INV-, 2026-"
            error={errors.invoicePrefix?.message}
          >
            <Input {...form.register("invoicePrefix")} />
          </SettingsField>
          <SettingsField label="Starting number" error={errors.invoiceNextNumber?.message}>
            <Input type="number" className="tabular-nums" {...form.register("invoiceNextNumber")} />
          </SettingsField>
          <SettingsField label="Number padding" error={errors.invoiceNumberPadding?.message}>
            <Select
              value={String(form.watch("invoiceNumberPadding"))}
              onValueChange={(value) =>
                form.setValue("invoiceNumberPadding", Number(value), {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 digits (001)</SelectItem>
                <SelectItem value="4">4 digits (0001)</SelectItem>
                <SelectItem value="5">5 digits (00001)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
        <SettingsToggleRow
          label="Reset numbering each financial year"
          description="Restart the sequence on April 1st every year."
        >
          <Switch
            checked={form.watch("invoiceResetYearly")}
            onCheckedChange={(value) =>
              form.setValue("invoiceResetYearly", value, { shouldDirty: true })
            }
          />
        </SettingsToggleRow>
      </SettingsSection>

      <SettingsSection
        title="Defaults"
        description="Pre-filled on every new invoice — you can still override them per invoice."
        onSave={saveAll}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label="Default due period" error={errors.invoiceDefaultDueDays?.message}>
            <Select
              value={String(form.watch("invoiceDefaultDueDays"))}
              onValueChange={(value) =>
                form.setValue("invoiceDefaultDueDays", Number(value), {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Net 7</SelectItem>
                <SelectItem value="15">Net 15</SelectItem>
                <SelectItem value="30">Net 30</SelectItem>
                <SelectItem value="45">Net 45</SelectItem>
                <SelectItem value="60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          {gstEnabled ? (
          <SettingsField label="Default tax mode" error={errors.invoiceDefaultTaxMode?.message}>
            <Select
              value={form.watch("invoiceDefaultTaxMode")}
              onValueChange={(value) =>
                form.setValue("invoiceDefaultTaxMode", value as InvoiceDefaultsInput["invoiceDefaultTaxMode"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intra">Intra-state (CGST + SGST)</SelectItem>
                <SelectItem value="inter">Inter-state (IGST)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm sm:col-span-2">
              <p className="font-medium">Standard invoice defaults</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                GST defaults are hidden because your company profile is not GST
                registered. New invoices will be generated without GST.
              </p>
            </div>
          )}
          {gstEnabled ? (
          <SettingsField label="Default GST rate" error={errors.invoiceDefaultGstRate?.message}>
            <Select
              value={String(form.watch("invoiceDefaultGstRate"))}
              onValueChange={(value) =>
                form.setValue("invoiceDefaultGstRate", Number(value), {
                  shouldDirty: true,
                })
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
          </SettingsField>
          ) : null}
          {gstEnabled ? (
          <SettingsField
            label="Default HSN / SAC code"
            hint="Pre-fills new GST invoices (e.g. 998314 for IT services)"
            error={errors.invoiceDefaultHsnSac?.message}
          >
            <Input {...form.register("invoiceDefaultHsnSac")} placeholder="e.g. 998314" />
          </SettingsField>
          ) : null}
          <SettingsField label="Default currency" error={errors.defaultCurrency?.message}>
            <Select
              value={form.watch("defaultCurrency")}
              onValueChange={(value) =>
                form.setValue("defaultCurrency", value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Default copy"
        description="Boilerplate used for the Notes and Terms sections of new invoices."
        onSave={saveAll}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
      >
        <SettingsField
          label="Default notes"
          hint="Visible at the bottom of the invoice"
          error={errors.invoiceDefaultNotes?.message}
        >
          <Textarea
            rows={3}
            className="resize-none"
            {...form.register("invoiceDefaultNotes")}
          />
        </SettingsField>
        <SettingsField label="Default terms" error={errors.invoiceDefaultTerms?.message}>
          <Textarea
            rows={3}
            className="resize-none"
            {...form.register("invoiceDefaultTerms")}
          />
        </SettingsField>
        <SettingsToggleRow
          label="Automatically send payment reminders"
          description="Email the client 3 days before due, on the due date, and 7 days after."
        >
          <Switch
            checked={form.watch("invoiceSendReminders")}
            onCheckedChange={(value) =>
              form.setValue("invoiceSendReminders", value, { shouldDirty: true })
            }
          />
        </SettingsToggleRow>
      </SettingsSection>
    </>
  );
}
