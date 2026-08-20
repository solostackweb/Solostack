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
} from "@/features/settings/components/settings-section";
import { useProfile } from "@/features/profile/context";
import {
  updateBusinessAddress,
  updateBusinessDetails,
  updateTaxInfo,
} from "@/features/profile/actions";
import type {
  AddressInput,
  BusinessDetailsInput,
  TaxInfoInput,
} from "@/features/profile/schemas";
import { BUSINESS_TYPE_OPTIONS } from "@/features/onboarding/types";
import { StateSelect } from "@/features/onboarding/components/state-select";

export default function CompanySettingsPage() {
  const { profile, setProfile } = useProfile();

  const businessForm = useForm<BusinessDetailsInput>({
    defaultValues: {
      businessName: profile?.businessName ?? "",
      legalName: profile?.legalName ?? "",
      businessType: profile?.businessType ?? "individual",
      businessEmail: profile?.businessEmail ?? "",
      businessPhone: profile?.businessPhone ?? "",
      website: profile?.website ?? "",
    },
  });

  const taxForm = useForm<TaxInfoInput>({
    defaultValues: {
      gstRegistered: profile?.gstRegistered ?? false,
      gstin: profile?.gstin ?? "",
      pan: profile?.pan ?? "",
      stateCode: profile?.stateCode ?? undefined,
      country: profile?.country ?? "IN",
    } as TaxInfoInput,
  });

  const addressForm = useForm<AddressInput>({
    defaultValues: {
      addressLine1: profile?.addressLine1 ?? "",
      addressLine2: profile?.addressLine2 ?? "",
      city: profile?.city ?? "",
      stateCode: profile?.stateCode ?? undefined,
      postalCode: profile?.postalCode ?? "",
      country: profile?.country ?? "IN",
    },
  });

  const saveBusiness = businessForm.handleSubmit(async (values) => {
    const res = await updateBusinessDetails(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    businessForm.reset(values);
    toast.success(res.message ?? "Business details saved");
  });

  const saveTax = taxForm.handleSubmit(async (values) => {
    const res = await updateTaxInfo(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    taxForm.reset(values);
    toast.success(res.message ?? "Tax info saved");
  });

  const saveAddress = addressForm.handleSubmit(async (values) => {
    const res = await updateBusinessAddress(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    addressForm.reset(values);
    toast.success(res.message ?? "Address saved");
  });

  const gstRegistered = taxForm.watch("gstRegistered");
  const businessErrors = businessForm.formState.errors;
  const taxErrors = taxForm.formState.errors;
  const addressErrors = addressForm.formState.errors;

  return (
    <>
      <SettingsPageHeader
        title="Company"
        description="Business details shown on your invoices, receipts, and contracts."
      />

      <SettingsSection
        title="Business details"
        description="The name and contact info your clients see."
        onSave={saveBusiness}
        isDirty={businessForm.formState.isDirty}
        isSubmitting={businessForm.formState.isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label="Trading name" error={businessErrors.businessName?.message}>
            <Input {...businessForm.register("businessName")} />
          </SettingsField>
          <SettingsField label="Legal entity" error={businessErrors.legalName?.message}>
            <Input {...businessForm.register("legalName")} />
          </SettingsField>
          <SettingsField label="Company email" error={businessErrors.businessEmail?.message}>
            <Input type="email" {...businessForm.register("businessEmail")} />
          </SettingsField>
          <SettingsField label="Company phone" error={businessErrors.businessPhone?.message}>
            <Input type="tel" {...businessForm.register("businessPhone")} />
          </SettingsField>
          <SettingsField label="Website" error={businessErrors.website?.message}>
            <Input placeholder="https://" {...businessForm.register("website")} />
          </SettingsField>
          <SettingsField label="Business type" error={businessErrors.businessType?.message}>
            <Select
              value={businessForm.watch("businessType")}
              onValueChange={(value) =>
                businessForm.setValue("businessType", value as BusinessDetailsInput["businessType"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Tax information"
        description="GSTIN, PAN, and other tax identifiers printed on invoices."
        onSave={saveTax}
        isDirty={taxForm.formState.isDirty}
        isSubmitting={taxForm.formState.isSubmitting}
      >
        <div className="flex items-start justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">GST registered?</p>
            <p className="text-xs text-muted-foreground">
              Toggle on to include GSTIN on invoices and contracts.
            </p>
          </div>
          <Switch
            checked={gstRegistered}
            onCheckedChange={(value) =>
              taxForm.setValue("gstRegistered", value, { shouldDirty: true })
            }
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField
            label="GSTIN"
            hint="15-character Goods & Services Tax identification number"
            error={taxErrors.gstin?.message}
          >
            <Input
              placeholder="29ABCDE1234F1Z5"
              disabled={!gstRegistered}
              className="font-mono uppercase"
              {...taxForm.register("gstin")}
            />
          </SettingsField>
          <SettingsField label="PAN" error={taxErrors.pan?.message}>
            <Input placeholder="ABCDE1234F" {...taxForm.register("pan")} />
          </SettingsField>
          <SettingsField label="Tax residence" error={taxErrors.country?.message}>
            <Select
              value={taxForm.watch("country")}
              onValueChange={(value) =>
                taxForm.setValue("country", value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="SG">Singapore</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="State (for GST)" error={taxErrors.stateCode?.message}>
            <StateSelect
              name="stateCode"
              value={taxForm.watch("stateCode") ?? ""}
              onValueChange={(value) =>
                taxForm.setValue("stateCode", value, { shouldDirty: true })
              }
              placeholder="Select state"
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Registered address"
        description="Used on tax invoices and government-facing documents."
        onSave={saveAddress}
        isDirty={addressForm.formState.isDirty}
        isSubmitting={addressForm.formState.isSubmitting}
      >
        <SettingsField label="Street" error={addressErrors.addressLine1?.message}>
          <Textarea
            rows={2}
            className="resize-none"
            {...addressForm.register("addressLine1")}
          />
        </SettingsField>
        <SettingsField label="Address line 2" error={addressErrors.addressLine2?.message}>
          <Input {...addressForm.register("addressLine2")} />
        </SettingsField>
        <div className="grid gap-5 sm:grid-cols-3">
          <SettingsField label="City" error={addressErrors.city?.message}>
            <Input {...addressForm.register("city")} />
          </SettingsField>
          <SettingsField label="State" error={addressErrors.stateCode?.message}>
            <StateSelect
              name="addressStateCode"
              value={addressForm.watch("stateCode") ?? ""}
              onValueChange={(value) =>
                addressForm.setValue("stateCode", value, { shouldDirty: true })
              }
              placeholder="State"
            />
          </SettingsField>
          <SettingsField label="Postal code" error={addressErrors.postalCode?.message}>
            <Input {...addressForm.register("postalCode")} />
          </SettingsField>
        </div>
      </SettingsSection>
    </>
  );
}
