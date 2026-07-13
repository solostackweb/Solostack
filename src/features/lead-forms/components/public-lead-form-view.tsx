"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicLeadAction, type LeadFormActionResult } from "../actions";
import type { LeadFormRecord } from "../server";

export function PublicLeadFormView({ form }: { form: LeadFormRecord }) {
  const [state, action] = useActionState<
    LeadFormActionResult<{ projectId: string }> | undefined,
    FormData
  >(
    submitPublicLeadAction,
    undefined,
  );

  return (
    <main
      className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8"
      style={{
        backgroundImage: `radial-gradient(circle at 12px 12px, ${form.brand_color}14 1px, transparent 0)`,
        backgroundSize: "26px 26px",
      }}
    >
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <section className="pt-8">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg"
            style={{ background: form.brand_color }}
          >
            {initials(form.name)}
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Project inquiry
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {form.title}
          </h1>
          {form.description ? (
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {form.description}
            </p>
          ) : (
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Share the essentials and I will get back with the right next step.
            </p>
          )}
          <div className="mt-8 rounded-2xl border bg-card/80 p-4 text-sm text-muted-foreground shadow-sm">
            <p className="font-medium text-foreground">What happens next?</p>
            <p className="mt-1">
              Your inquiry lands directly in Stackivo as a lead so the freelancer can
              reply, scope, propose, and manage the work in one place.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-xl shadow-slate-900/5 sm:p-7">
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
            <form action={action} className="space-y-4">
              <input type="hidden" name="formId" value={form.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={state?.ok === false ? state.fieldErrors?.name?.[0] : undefined}>
                  <Input name="name" placeholder="Your name" required />
                </Field>
                <Field label="Email" error={state?.ok === false ? state.fieldErrors?.email?.[0] : undefined}>
                  <Input name="email" type="email" placeholder="you@example.com" required />
                </Field>
                <Field label="Company">
                  <Input name="company" placeholder="Company or brand" />
                </Field>
                <Field label="Phone">
                  <Input name="phone" placeholder="+91 ..." />
                </Field>
                <Field label="Country">
                  <Input name="country" placeholder="IN, US, GB..." maxLength={2} />
                </Field>
                <Field label="Currency">
                  <Input name="currency" placeholder="INR, USD, EUR..." maxLength={3} />
                </Field>
              </div>
              <Field
                label="Project brief"
                error={state?.ok === false ? state.fieldErrors?.project?.[0] : undefined}
              >
                <Textarea
                  name="project"
                  rows={7}
                  placeholder="Tell us what you want built, designed, written, improved, or managed..."
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget">
                  <Input name="budget" placeholder="Example: USD 2,000 or INR 1L" />
                </Field>
                <Field label="Timeline">
                  <Input name="timeline" placeholder="Example: 4 weeks, urgent, flexible" />
                </Field>
              </div>

              {state && !state.ok ? (
                <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}

              <SubmitButton brandColor={form.brand_color} />
              <p className="text-center text-[11px] text-muted-foreground">
                Powered by Stackivo
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
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
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function SubmitButton({ brandColor }: { brandColor: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      className="h-11 w-full rounded-xl text-base"
      disabled={pending}
      style={{ background: brandColor }}
    >
      <Send className="h-4 w-4" />
      {pending ? "Sending..." : "Send inquiry"}
    </Button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "S"}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}
