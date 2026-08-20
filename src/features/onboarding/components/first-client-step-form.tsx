"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AuthFormError } from "@/features/auth/components/auth-form-shell";
import { FieldError } from "@/features/auth/components/field-error";
import {
  saveFirstClientStep,
  skipFirstClientStep,
  type ActionResult,
} from "../actions";
import { StateSelect } from "./state-select";

export function FirstClientStepForm() {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    saveFirstClientStep,
    undefined,
  );
  const errs = state && !state.ok ? state.fieldErrors : undefined;
  const [gstRegistered, setGstRegistered] = React.useState<boolean>(false);

  return (
    <form action={formAction} className="space-y-5">
      <AuthFormError message={state && !state.ok ? state.error : null} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">
            Client name <span className="text-destructive">*</span>
          </Label>
          <Input id="fullName" name="fullName" required placeholder="Acme Corp." />
          <FieldError errors={errs} name="fullName" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business name (optional)</Label>
          <Input
            id="businessName"
            name="businessName"
            placeholder="Legal entity, if different"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="contact@acme.com" />
          <FieldError errors={errs} name="email" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+91 …" />
        </div>
      </div>

      <div className="flex items-start justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="gstRegistered" className="text-sm font-medium">
            Is this client GST registered?
          </Label>
          <p className="text-xs text-muted-foreground">
            Toggle on to capture their GSTIN and bill them as a B2B customer.
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
        <div className="space-y-1.5">
          <Label htmlFor="gstin">
            GSTIN <span className="text-destructive">*</span>
          </Label>
          <Input
            id="gstin"
            name="gstin"
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            className="font-mono uppercase"
            required
          />
          <FieldError errors={errs} name="gstin" />
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="stateCode">
            State <span className="text-destructive">*</span>
          </Label>
          <StateSelect name="stateCode" required />
          <FieldError errors={errs} name="stateCode" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="billingAddress">
            Billing address
            {gstRegistered ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Textarea
            id="billingAddress"
            name="billingAddress"
            rows={2}
            required={gstRegistered}
            placeholder="Street, city, postal code"
          />
          <FieldError errors={errs} name="billingAddress" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Anything you want to remember about this client."
        />
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
        <SkipButton />
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Add client & finish"}
    </Button>
  );
}

function SkipButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      disabled={pending}
      formNoValidate
      formAction={skipFirstClientStep}
    >
      Skip for now
    </Button>
  );
}
