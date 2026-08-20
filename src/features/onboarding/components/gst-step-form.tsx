"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AuthFormError } from "@/features/auth/components/auth-form-shell";
import { FieldError } from "@/features/auth/components/field-error";
import { saveGstStep, type ActionResult } from "../actions";
import type { BusinessProfile } from "../types";

export function GstStepForm({ profile }: { profile: BusinessProfile }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    saveGstStep,
    undefined,
  );
  const errs = state && !state.ok ? state.fieldErrors : undefined;
  const [gstRegistered, setGstRegistered] = React.useState<boolean>(
    profile.gstRegistered,
  );

  return (
    <form action={formAction} className="space-y-6">
      <AuthFormError message={state && !state.ok ? state.error : null} />

      <div className="flex items-start justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="gstRegistered" className="text-sm font-medium">
            Are you GST registered?
          </Label>
          <p className="text-xs text-muted-foreground">
            We&apos;ll only ask for GST details if you say yes. You can change
            this later in settings.
          </p>
        </div>
        <Switch
          id="gstRegistered"
          checked={gstRegistered}
          onCheckedChange={setGstRegistered}
        />
      </div>
      <input
        type="hidden"
        name="gstRegistered"
        value={gstRegistered ? "true" : "false"}
      />

      {gstRegistered ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="gstin" className="text-sm font-medium">
              GSTIN <span className="text-destructive">*</span>
            </Label>
            <Input
              id="gstin"
              name="gstin"
              defaultValue={profile.gstin ?? ""}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              required
              className="font-mono uppercase tracking-wide"
            />
            <FieldError errors={errs} name="gstin" />
            <p className="text-xs text-muted-foreground">
              15 characters. The first two digits must match your registered
              state.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pan" className="text-sm font-medium">
              PAN (optional)
            </Label>
            <Input
              id="pan"
              name="pan"
              defaultValue={profile.pan ?? ""}
              placeholder="AAAAA0000A"
              maxLength={10}
              className="font-mono uppercase"
            />
            <FieldError errors={errs} name="pan" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          We&apos;ll generate <strong className="text-foreground">standard
          (non-GST) invoices</strong> with the recommended footer:
          <em className="mt-1 block text-foreground">
            &ldquo;GST not applicable. Supplier not registered under GST.&rdquo;
          </em>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Finishing setup…" : "Finish setup & open dashboard"}
    </Button>
  );
}
