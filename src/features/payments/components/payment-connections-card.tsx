"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Globe2,
  Loader2,
  Mail,
  Star,
  Trash2,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "@/features/settings/components/settings-section";
import {
  PAYMENT_PROVIDERS,
  getProvider,
  isPayUrl,
  type PaymentConnection,
  type PaymentProvider,
} from "@/features/payments/providers";
import {
  addPaymentConnectionAction,
  deletePaymentConnectionAction,
  setDefaultPaymentConnectionAction,
} from "@/features/payments/actions";

const FEATURED_PROVIDERS = ["wise", "paypal", "payoneer", "stripe_link", "bank_wire"];

export function PaymentConnectionsCard({
  connections,
}: {
  connections: PaymentConnection[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [providerId, setProviderId] = React.useState(FEATURED_PROVIDERS[0]!);
  const [value, setValue] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(connections.length === 0);

  const provider = getProvider(providerId) ?? PAYMENT_PROVIDERS[0]!;

  const onAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Enter the payment link or receiving details.");
      return;
    }

    const kind = isPayUrl(trimmed) ? "link" : provider.kind === "handle" ? "handle" : "handle";

    startTransition(async () => {
      const res = await addPaymentConnectionAction({
        provider: providerId,
        kind,
        value: trimmed,
        label: label.trim() || undefined,
        instructions: instructions.trim() || undefined,
        isDefault: makeDefault,
      });
      if (res.ok) {
        toast.success(`${provider.name} added.`);
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
      description="Add the payment details you already use with overseas clients. Export invoices show these methods; Stackivo does not collect or hold the money."
    >
      <div className="space-y-5">
        <ConnectedMethods
          connections={connections}
          pending={pending}
          onDelete={onDelete}
          onSetDefault={onSetDefault}
        />

        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <p className="text-sm font-semibold">Add an international method</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Choose the method your client will recognize, then paste the link or receiving details.
            </p>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProviders().map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  selected={providerId === p.id}
                  onClick={() => {
                    setProviderId(p.id);
                    setLabel("");
                    setInstructions("");
                  }}
                />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-1.5">
                <label htmlFor="pc-value" className="text-sm font-medium">
                  {provider.valueLabel}
                </label>
                <Input
                  id="pc-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={provider.valuePlaceholder}
                />
                {provider.help ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {provider.help}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pc-label" className="text-sm font-medium">
                  Display name
                </label>
                <Input
                  id="pc-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={provider.name}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This is the label your client sees on the invoice.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pc-instructions" className="text-sm font-medium">
                Client note
              </label>
              <Input
                id="pc-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Example: Please add the invoice number in the payment note."
              />
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Make this the default international method
              </label>
              <Button type="button" onClick={onAdd} disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {pending ? "Saving..." : "Add method"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

function ConnectedMethods({
  connections,
  pending,
  onDelete,
  onSetDefault,
}: {
  connections: PaymentConnection[];
  pending: boolean;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  if (connections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-6 text-center">
        <Globe2 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No international method added yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add at least one method before sending export invoices.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {connections.map((connection) => {
        const provider = getProvider(connection.provider);
        return (
          <div key={connection.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ProviderIcon providerId={connection.provider} />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {connection.label || provider?.name || connection.provider}
                    {connection.isDefault ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Default
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {connection.value}
                  </p>
                  {connection.instructions ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {connection.instructions}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isPayUrl(connection.value) ? (
                  <Button type="button" variant="ghost" size="icon" asChild title="Open">
                    <a href={connection.value} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Copy"
                    onClick={() => void navigator.clipboard.writeText(connection.value)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!connection.isDefault ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => onSetDefault(connection.id)}
                    title="Set default"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => onDelete(connection.id)}
                  title="Remove"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProviderCard({
  provider,
  selected,
  onClick,
}: {
  provider: PaymentProvider;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20"
          : "bg-background hover:border-primary/30 hover:bg-primary/[0.02]",
      ].join(" ")}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ProviderIcon providerId={provider.id} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{provider.name}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {providerCardCopy(provider.id)}
        </span>
      </span>
    </button>
  );
}

function featuredProviders() {
  const featured = FEATURED_PROVIDERS.map((id) => getProvider(id)).filter(
    (p): p is PaymentProvider => Boolean(p),
  );
  const rest = PAYMENT_PROVIDERS.filter(
    (p) => !FEATURED_PROVIDERS.includes(p.id),
  );
  return [...featured, ...rest];
}

function ProviderIcon({ providerId }: { providerId: string }) {
  if (providerId === "bank_wire") return <Banknote className="h-4 w-4" />;
  if (providerId === "paypal") return <Mail className="h-4 w-4" />;
  if (providerId === "stripe_link") return <CreditCard className="h-4 w-4" />;
  if (providerId === "wise" || providerId === "payoneer") {
    return <WalletCards className="h-4 w-4" />;
  }
  return <Globe2 className="h-4 w-4" />;
}

function providerCardCopy(providerId: string): string {
  switch (providerId) {
    case "wise":
      return "Good for USD, EUR, GBP and local bank rails.";
    case "paypal":
      return "Useful when clients already prefer PayPal.";
    case "payoneer":
      return "Common for marketplaces and overseas businesses.";
    case "stripe_link":
      return "Card payment link from your own Stripe account.";
    case "bank_wire":
      return "SWIFT, IBAN, or bank details for direct transfer.";
    default:
      return "Add a link or receiving details.";
  }
}
