"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Mail, Send, Sparkles } from "lucide-react";
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
    <main
      className="min-h-screen overflow-hidden bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8"
      style={{
        backgroundImage: `linear-gradient(135deg, ${form.brand_color}12, transparent 38%), radial-gradient(circle at 12px 12px, ${form.brand_color}18 1px, transparent 0)`,
        backgroundSize: "auto, 28px 28px",
      }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <section className="py-6 lg:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" style={{ color: form.brand_color }} />
            Project inquiry
          </div>
          <div
            className="mt-8 flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-xl"
            style={{ background: form.brand_color }}
          >
            {initials(form.name)}
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            {form.title}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {form.description ||
              "Share the essentials and the freelancer will respond with the right next step."}
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              ["1", "Tell us what you need"],
              ["2", "Get a direct response"],
              ["3", "Move into proposal or discovery"],
            ].map(([step, text]) => (
              <div key={step} className="rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: form.brand_color }}
                >
                  {step}
                </span>
                <p className="mt-2 text-sm font-medium leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card/95 p-5 shadow-2xl shadow-slate-950/10 backdrop-blur sm:p-7">
          {state?.ok ? (
            <div className="flex min-h-[34rem] flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h2 className="mt-4 text-2xl font-bold tracking-tight">Inquiry sent</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Thanks. Your details are with the freelancer, and they can now respond
                from their Stackivo workspace.
              </p>
            </div>
          ) : (
            <form action={action} className="space-y-5">
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

              <div>
                <p className="text-sm font-semibold">Your details</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Required fields are marked. Keep it short; details can be refined later.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <Mail className="h-3 w-3" />
                Powered by Stackivo
              </p>
            </form>
          )}
        </section>
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
  const spanFull = field.type === "textarea";

  // Country — special select that also drives currency + phone prefix.
  if (field.name === "country") {
    return (
      <Field label={field.label} required={field.required}>
        <select
          name="country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required={field.required}
        >
          {LEAD_FORM_COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground">
          Currency: <span className="font-medium">{currency}</span>
        </span>
      </Field>
    );
  }

  // Phone — special input with the selected country's dial code.
  if (field.name === "phone") {
    return (
      <Field label={field.label} required={field.required}>
        <div className="flex h-10 rounded-md border border-input bg-background shadow-sm transition-all focus-within:ring-2 focus-within:ring-ring">
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
      <Field label={field.label} required={field.required} error={error} className={spanFull ? "sm:col-span-2" : undefined}>
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
      className="h-11 w-full rounded-xl text-base text-white hover:opacity-95"
      disabled={pending}
      style={{ background: brandColor }}
    >
      <Send className="h-4 w-4" />
      {pending ? "Sending..." : "Send inquiry"}
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "S"}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}
