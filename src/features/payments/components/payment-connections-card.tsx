"use client";

/**
 * Settings → Payments → International: connect the freelancer's own payout
 * platforms (Wise / Payoneer / PayPal / …). Stackivo never collects; these are
 * shown on the invoice for international clients to pay directly.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Star, Trash2, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "@/features/settings/components/settings-section";
import {
  PAYMENT_PROVIDERS,
  getProvider,
  type PaymentConnection,
} from "@/features/payments/providers";
import {
  addPaymentConnectionAction,
  deletePaymentConnectionAction,
  setDefaultPaymentConnectionAction,
} from "@/features/payments/actions";

export function PaymentConnectionsCard({
  connections,
}: {
  connections: PaymentConnection[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [providerId, setProviderId] = React.useState(PAYMENT_PROVIDERS[0]!.id);
  const [value, setValue] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(false);

  const provider = getProvider(providerId)!;

  const onAdd = () => {
    if (!value.trim()) {
      toast.error("Enter the payment link or details.");
      return;
    }
    startTransition(async () => {
      const res = await addPaymentConnectionAction({
        provider: providerId,
        kind: provider.kind,
        value: value.trim(),
        label: label.trim() || undefined,
        instructions: instructions.trim() || undefined,
        isDefault: makeDefault,
      });
      if (res.ok) {
        toast.success(`${provider.name} connected.`);
        setValue("");
        setLabel("");
        setInstructions("");
        setMakeDefault(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      const res = await deletePaymentConnectionAction(id);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Could not remove.");
    });
  };

  const onSetDefault = (id: string) => {
    startTransition(async () => {
      const res = await setDefaultPaymentConnectionAction(id);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Could not update.");
    });
  };

  return (
    <SettingsSection
      title="International payments"
      description="Connect the platforms you already use to get paid by overseas clients. We show these on your invoices — payments go straight to you; Stackivo never holds your money."
    >
      <div className="space-y-5">
        {connections.length > 0 ? (
          <ul className="space-y-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.label || getProvider(c.provider)?.name || c.provider}
                      {c.isDefault ? (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{c.value}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!c.isDefault ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => onSetDefault(c.id)}
                      title="Set as default"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => onDelete(c.id)}
                    title="Remove"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            No international payment platforms connected yet. Add one below.
          </p>
        )}

        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add a platform
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="pc-provider" className="text-xs font-medium">
                Platform
              </label>
              <select
                id="pc-provider"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {PAYMENT_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pc-label" className="text-xs font-medium">
                Label (optional)
              </label>
              <Input
                id="pc-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={provider.name}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pc-value" className="text-xs font-medium">
              {provider.valueLabel}
            </label>
            <Input
              id="pc-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={provider.valuePlaceholder}
            />
            {provider.help ? (
              <p className="text-[11px] text-muted-foreground">{provider.help}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pc-instructions" className="text-xs font-medium">
              Instructions for the client (optional)
            </label>
            <Input
              id="pc-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Use Friends &amp; Family / add invoice number in note"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Set as default payment option
          </label>
          <Button type="button" size="sm" onClick={onAdd} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {pending ? "Saving…" : "Connect platform"}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
