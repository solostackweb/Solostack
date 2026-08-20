import * as React from "react";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BillingPayment, BillingSubscription } from "../types";

interface Props {
  subscription: BillingSubscription | null;
  payments: BillingPayment[];
}

export function PaymentMethodCard({ subscription, payments }: Props) {
  const latestCard = payments.find((payment) => payment.cardLast4);
  const isPaidPlan = subscription ? subscription.plan !== "free" : false;

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-none tracking-tight">
                Payment method
              </h3>
              <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-micro">
                Managed in Stackivo
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {latestCard
                ? `${formatMethod(latestCard.method)} ending in ${latestCard.cardLast4}`
                : isPaidPlan
                  ? "No saved card details have been received from your latest payment yet."
                  : "Add or update payment details when you upgrade to a paid plan."}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                Webhook-synced status
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm leading-6 text-muted-foreground">
          Use the plan controls below to upgrade, renew, downgrade, or cancel.
          Payment updates happen through Stackivo checkout.
        </div>
      </CardContent>
    </Card>
  );
}

function formatMethod(method: string | null): string {
  if (!method) return "Card";
  return method.charAt(0).toUpperCase() + method.slice(1);
}
