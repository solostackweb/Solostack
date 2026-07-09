"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StateSelect } from "@/features/onboarding/components/state-select";
import { useProfile } from "@/features/profile/context";
import { isValidStateCode } from "@/features/gst/state-codes";

import type { ClientRecord } from "../server";
import {
  createClientAction,
  updateClientAction,
  type ActionResult,
} from "../actions";

const COUNTRIES: { code: string; name: string; currency: string; locale: string; phoneCode: string }[] = [
  { code: "IN", name: "India", currency: "INR", locale: "en-IN", phoneCode: "+91" },
  { code: "US", name: "United States", currency: "USD", locale: "en-US", phoneCode: "+1" },
  { code: "GB", name: "United Kingdom", currency: "GBP", locale: "en-GB", phoneCode: "+44" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", locale: "en-AE", phoneCode: "+971" },
  { code: "AU", name: "Australia", currency: "AUD", locale: "en-AU", phoneCode: "+61" },
  { code: "CA", name: "Canada", currency: "CAD", locale: "en-CA", phoneCode: "+1" },
  { code: "SG", name: "Singapore", currency: "SGD", locale: "en-SG", phoneCode: "+65" },
  { code: "DE", name: "Germany", currency: "EUR", locale: "de-DE", phoneCode: "+49" },
  { code: "FR", name: "France", currency: "EUR", locale: "fr-FR", phoneCode: "+33" },
  { code: "NL", name: "Netherlands", currency: "EUR", locale: "nl-NL", phoneCode: "+31" },
  { code: "ES", name: "Spain", currency: "EUR", locale: "es-ES", phoneCode: "+34" },
  { code: "IE", name: "Ireland", currency: "EUR", locale: "en-IE", phoneCode: "+353" },
  { code: "CH", name: "Switzerland", currency: "CHF", locale: "de-CH", phoneCode: "+41" },
  { code: "JP", name: "Japan", currency: "JPY", locale: "ja-JP", phoneCode: "+81" },
  { code: "NZ", name: "New Zealand", currency: "NZD", locale: "en-NZ", phoneCode: "+64" },
  { code: "ZA", name: "South Africa", currency: "ZAR", locale: "en-ZA", phoneCode: "+27" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", locale: "ar-SA", phoneCode: "+966" },
  { code: "ZZ", name: "Other (international)", currency: "USD", locale: "en-US", phoneCode: "" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "CHF", "JPY", "NZD", "ZAR", "SAR", "INR"];

function localeForCountry(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.locale ?? "en-US";
}
function currencyForCountry(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? "USD";
}
function phoneCodeForCountry(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.phoneCode ?? "";
}
function normalizePhoneForCountry(rawPhone: FormDataEntryValue | null, countryCode: string): string | null {
  const phone = String(rawPhone ?? "").trim();
  if (!phone) return null;
  if (phone.startsWith("+")) return phone;
  const dialCode = phoneCodeForCountry(countryCode);
  return dialCode ? `${dialCode} ${phone}` : phone;
}
function phoneInputValueForCountry(rawPhone: string | null | undefined, countryCode: string): string {
  const phone = rawPhone?.trim() ?? "";
  const dialCode = phoneCodeForCountry(countryCode);
  if (!phone || !dialCode) return phone;
  return phone.startsWith(dialCode) ? phone.slice(dialCode.length).trim() : phone;
}
function stateCodeFromGstin(gstin: string): string | null {
  const code = gstin.trim().slice(0, 2);
  return isValidStateCode(code) ? code : null;
}

// Both `createClientAction` + `updateClientAction` resolve to this shape;
// the client-side form only reads `ok` / `error` / `fieldErrors`.
type ClientFormResult = ActionResult<{ id: string }>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog is in "edit" mode and pre-fills the form. */
  client?: ClientRecord;
  onSaved?: (client: {
    id: string;
    fullName: string;
    businessName: string | null;
    email: string | null;
  }) => void;
}

/**
 * Add / edit client dialog. Submits via the GST-aware
 * `createClientAction` / `updateClientAction` server actions and refreshes
 * the surrounding route on success so the new row shows up immediately.
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: ClientFormDialogProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const isEdit = !!client;
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<ClientFormResult | undefined>();
  const [gstRegistered, setGstRegistered] = React.useState<boolean>(
    client?.gstRegistered ?? false,
  );
  const [country, setCountry] = React.useState<string>(client?.country ?? "IN");
  const [currency, setCurrency] = React.useState<string>(
    client?.currency ?? "INR",
  );
  const [gstin, setGstin] = React.useState<string>(client?.gstin ?? "");
  const [selectedStateCode, setSelectedStateCode] = React.useState<string>(
    client?.stateCode ?? "",
  );

  // Reset transient state when the dialog re-opens or switches client.
  React.useEffect(() => {
    if (open) {
      setState(undefined);
      setGstRegistered(client?.gstRegistered ?? false);
      setCountry(client?.country ?? "IN");
      setCurrency(client?.currency ?? "INR");
      setGstin(client?.gstin ?? "");
      setSelectedStateCode(client?.stateCode ?? "");
    }
  }, [open, client]);

  const errs = state && !state.ok ? state.fieldErrors : undefined;
  const userHasGstRegistration = profile?.gstRegistered ?? false;
  const isDomestic = country === "IN";
  const selectedPhoneCode = phoneCodeForCountry(country);
  const phoneDefaultValue = phoneInputValueForCountry(client?.phone, country);

  const handleSubmit = (formData: FormData) => {
    const draftClient = {
      fullName: String(formData.get("fullName") ?? "").trim(),
      businessName: String(formData.get("businessName") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
    };
    // Foreign clients are never GST-registered; GST only applies to India.
    const isDomestic = country === "IN";
    const finalGstRegistered = isDomestic && userHasGstRegistration && gstRegistered;
    formData.set("country", country);
    formData.set("currency", isDomestic ? "INR" : currency);
    formData.set("locale", localeForCountry(country));
    const normalizedPhone = normalizePhoneForCountry(formData.get("phone"), country);
    if (normalizedPhone) formData.set("phone", normalizedPhone);
    formData.set("gstRegistered", finalGstRegistered ? "true" : "false");
    if (isEdit) formData.set("id", client.id);
    startTransition(async () => {
      const res = isEdit
        ? await updateClientAction(undefined, formData)
        : await createClientAction(undefined, formData);
      setState(res);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!isEdit && res.data?.id) {
        onSaved?.({
          id: res.data.id,
          fullName: draftClient.fullName,
          businessName: draftClient.businessName,
          email: draftClient.email,
        });
      }
      toast.success(res.message ?? (isEdit ? "Client updated" : "Client added"));
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl sm:max-h-[88vh] sm:overflow-y-auto"
      title={isEdit ? "Edit client" : "Add client"}
      description={
        isEdit
          ? "Update this client's contact and billing details."
          : "Add a new client to your workspace. You can invoice them right away."
      }
    >
        <form
          id="client-form"
          action={handleSubmit}
          className="space-y-5"
        >
          {state && !state.ok && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country / region" error={errs?.country?.[0]}>
              <select
                name="country"
                value={country}
                onChange={(e) => {
                  const c = e.target.value;
                  setCountry(c);
                  setCurrency(c === "IN" ? "INR" : currencyForCountry(c));
                  if (c !== "IN") setSelectedStateCode("");
                }}
                className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {!isDomestic ? (
              <Field label="Invoice currency" error={errs?.currency?.[0]}>
                <select
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" required error={errs?.fullName?.[0]}>
              <Input
                name="fullName"
                defaultValue={client?.fullName ?? ""}
                required
                placeholder="Acme Corp."
              />
            </Field>
            <Field label="Business name" error={errs?.businessName?.[0]}>
              <Input
                name="businessName"
                defaultValue={client?.businessName ?? ""}
                placeholder="Legal entity, if different"
              />
            </Field>
            <Field label="Email" error={errs?.email?.[0]}>
              <Input
                name="email"
                type="email"
                defaultValue={client?.email ?? ""}
                placeholder="contact@acme.com"
              />
            </Field>
            <Field label="Phone" error={errs?.phone?.[0]}>
              <div className="flex h-9 rounded-md border border-input bg-background shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/15">
                {selectedPhoneCode ? (
                  <span className="inline-flex min-w-14 items-center justify-center border-r px-3 text-sm font-medium text-muted-foreground">
                    {selectedPhoneCode}
                  </span>
                ) : null}
                <Input
                  name="phone"
                  type="tel"
                  defaultValue={phoneDefaultValue}
                  placeholder={selectedPhoneCode ? "Phone number" : "+ country code and number"}
                  className="h-full flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
            </Field>
          </div>

          {isDomestic && (
          <div className="flex items-start justify-between rounded-md border p-4">
            <div className="space-y-1">
              <Label htmlFor="gstRegistered" className="text-sm font-medium">
                GST registered?
              </Label>
              <p className="text-xs text-muted-foreground">
                {userHasGstRegistration
                  ? "Toggle on to capture their GSTIN and bill them as B2B."
                  : "Enable GST registration in your profile to bill GST-registered clients."}
              </p>
            </div>
            <Switch
              id="gstRegistered"
              checked={userHasGstRegistration ? gstRegistered : false}
              onCheckedChange={userHasGstRegistration ? setGstRegistered : undefined}
              disabled={!userHasGstRegistration}
            />
          </div>
          )}

          {isDomestic && userHasGstRegistration && gstRegistered && (
            <Field label="GSTIN" required error={errs?.gstin?.[0]}>
              <Input
                name="gstin"
                value={gstin}
                onChange={(event) => {
                  const next = event.target.value.toUpperCase();
                  setGstin(next);
                  const nextStateCode = stateCodeFromGstin(next);
                  if (nextStateCode) setSelectedStateCode(nextStateCode);
                }}
                maxLength={15}
                placeholder="22AAAAA0000A1Z5"
                className="font-mono uppercase"
                required
              />
            </Field>
          )}

          {isDomestic && (
            <Field
              label="State"
              required={userHasGstRegistration && gstRegistered}
              error={errs?.stateCode?.[0]}
            >
              <StateSelect
                name="stateCode"
                value={selectedStateCode}
                onValueChange={setSelectedStateCode}
                required={userHasGstRegistration && gstRegistered}
              />
            </Field>
          )}

          <Field
            label="Billing address"
            required
            error={errs?.billingAddress?.[0]}
          >
            <Textarea
              name="billingAddress"
              rows={2}
              defaultValue={client?.billingAddress ?? ""}
              required
              placeholder={
                isDomestic
                  ? "Street, city, postal code"
                  : "Street, city, state/region, postal code, country"
              }
            />
          </Field>

          <Field label="Notes" error={errs?.notes?.[0]}>
            <Textarea
              name="notes"
              rows={3}
              defaultValue={client?.notes ?? ""}
              placeholder="Payment terms, key contacts, anything worth remembering…"
            />
          </Field>
        </form>

        <div className="mt-2 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="client-form"
            disabled={pending}
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Add client"}
          </Button>
        </div>
    </ResponsiveModal>
  );
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
