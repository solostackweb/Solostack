"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, FileInput, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicLeadAction, type LeadFormActionResult } from "../actions";
import {
  LEAD_FORM_COUNTRIES,
  countryForLeadForm,
  normalizeLeadPhone,
} from "../countries";
import {
  CUSTOM_FIELD_PREFIX,
  normalizeLeadFields,
  type LeadFormField,
} from "../fields";
import type { LeadFormRecord } from "../server";

export function PublicLeadFormView({ form }: { form: LeadFormRecord }) {
  const [state, action] = useActionState<
    LeadFormActionResult<{ projectId: string }> | undefined,
    FormData
  >(submitPublicLeadAction, undefined);
  const [country, setCountry] = React.useState("IN");
  const [phone, setPhone] = React.useState("");

  const fields = React.useMemo(
    () => normalizeLeadFields((form as { fields?: unknown }).fields),
    [form],
  );
  const selectedCountry = countryForLeadForm(country);
  const fullPhone = normalizeLeadPhone(phone, country);

  return (
    <main className="relative min-h-screen cursor-default select-none overflow-hidden bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background: `radial-gradient(circle at top, ${form.brand_color}1f 0, transparent 68%)`,
        }}
      />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm" style={{ background: form.brand_color }}><FileInput className="h-4 w-4" /></span>
            {form.name}
          </div>
          <span className="text-xs text-slate-500">Project inquiry</span>
        </header>
        <section className="my-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
          <div className="h-1.5 w-full" style={{ background: form.brand_color }} />
          <div className="p-6 sm:p-10">
          {state?.ok ? (
            <div className="flex min-h-[28rem] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
                <CheckCircle2 className="h-8 w-8 text-success-strong" />
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight">Inquiry sent</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Thanks. Your details are with the freelancer, and they can now respond
                from their Stackivo workspace.
              </p>
            </div>
          ) : (
            <form action={action} className="mx-auto max-w-xl space-y-7">
              <input type="hidden" name="formId" value={form.id} />
              <input type="hidden" name="phone" value={fullPhone} />
              <input type="hidden" name="currency" value={selectedCountry.currency} />
              {/* Honeypot — hidden from humans, catches bots that fill every field. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />

              {!fields.some((field) => field.name === "country") ? <input type="hidden" name="country" value={country} /> : null}

              <div className="border-b border-slate-100 pb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: form.brand_color }}>Project inquiry</p>
                <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{form.title}</h1>
                {form.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{form.description}</p> : null}
                <p className="mt-3 text-xs text-slate-500"><span className="text-red-500">*</span> Required</p>
              </div>

              <div className="grid gap-5">
                {fields.map((field) => (
                  <FieldControl
                    key={field.name}
                    field={field}
                    state={state}
                    country={country}
                    setCountry={setCountry}
                    phone={phone}
                    setPhone={setPhone}
                    currency={selectedCountry.currency}
                    phoneCode={selectedCountry.phoneCode}
                  />
                ))}
              </div>

              {state && !state.ok ? (
                <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}

              <SubmitButton brandColor={form.brand_color} />
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                <Lock className="h-3 w-3" />
                Your details stay private · Powered by Stackivo
              </p>
            </form>
          )}
          </div>
        </section>
        <p className="mt-4 text-center text-xs text-slate-400">Powered by Stackivo · Your details are shared privately.</p>
      </div>
    </main>
  );
}

function FieldControl({
  field,
  state,
  country,
  setCountry,
  phone,
  setPhone,
  currency,
  phoneCode,
}: {
  field: LeadFormField;
  state: LeadFormActionResult<{ projectId: string }> | undefined;
  country: string;
  setCountry: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  currency: string;
  phoneCode: string;
}) {
  const error = fieldError(state, field.name);
  const inputName = field.custom ? `${CUSTOM_FIELD_PREFIX}${field.name}` : field.name;

  // Country — special select that also drives currency + phone prefix.
  if (field.name === "country") {
    return (
      <Field label={field.label} required={field.required}>
        <select
          name="country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required={field.required}
        >
          {LEAD_FORM_COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="text-micro text-muted-foreground">
          Currency: <span className="font-medium">{currency}</span>
        </span>
      </Field>
    );
  }

  // Phone — special input with the selected country's dial code.
  if (field.name === "phone") {
    return (
      <Field label={field.label} required={field.required}>
        <div className="flex h-10 rounded-lg border border-input bg-background shadow-sm transition-all focus-within:ring-2 focus-within:ring-ring">
          {phoneCode ? (
            <span className="inline-flex min-w-14 items-center justify-center border-r px-3 text-sm font-medium text-muted-foreground">
              {phoneCode}
            </span>
          ) : null}
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            placeholder={phoneCode ? "Phone number" : "+ country code and number"}
            autoComplete="tel"
            required={field.required}
            className="h-full flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
      </Field>
    );
  }

  // Textarea (project + custom textarea questions) — full width.
  if (field.type === "textarea") {
    return (
      <Field label={field.label} required={field.required} error={error}>
        <Textarea
          name={inputName}
          rows={field.name === "project" ? 7 : 4}
          placeholder={
            field.name === "project"
              ? "Example: a website redesign, landing page, dashboard UI, or monthly support..."
              : undefined
          }
          required={field.required}
        />
      </Field>
    );
  }

  // Everything else — a plain input of the right type.
  return (
    <Field label={field.label} required={field.required} error={error}>
      <Input
        name={inputName}
        type={field.type === "email" ? "email" : "text"}
        autoComplete={autoCompleteFor(field.name)}
        required={field.required}
        className="cursor-text select-text"
      />
    </Field>
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
    <label className={["space-y-1.5", className].filter(Boolean).join(" ")}>
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function SubmitButton({ brandColor }: { brandColor: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      className="h-11 w-full rounded-lg text-base text-white hover:opacity-95"
      disabled={pending}
      style={{ background: brandColor }}
    >
      <Send className="h-4 w-4" />
      {pending ? "Sending…" : "Send inquiry"}
    </Button>
  );
}

function fieldError(
  state: LeadFormActionResult<{ projectId: string }> | undefined,
  key: string,
): string | undefined {
  return state?.ok === false ? state.fieldErrors?.[key]?.[0] : undefined;
}

function autoCompleteFor(name: string): string | undefined {
  if (name === "name") return "name";
  if (name === "email") return "email";
  if (name === "company") return "organization";
  return undefined;
}
