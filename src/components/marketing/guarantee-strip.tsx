import {
  ShieldCheck,
  RotateCcw,
  Database,
  XCircle,
} from "lucide-react";

/**
 * Risk-reversal strip rendered on the pricing page.
 *
 * Industry standard: explicit money-back, cancel-anytime, and data-export
 * commitments lift pricing-page conversion measurably. We're already
 * doing the work; this just surfaces it.
 */
export function GuaranteeStrip() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
          title="30-day money-back"
          body="Email support@stackivo.me within 30 days for a no-questions refund."
        />
        <Tile
          icon={<XCircle className="h-4 w-4 text-blue-600" />}
          title="Cancel anytime"
          body="Cancel from settings · keep paid features till the period ends."
        />
        <Tile
          icon={<Database className="h-4 w-4 text-primary" />}
          title="Your data, exportable"
          body="One-click JSON export of every record you own. Always."
        />
        <Tile
          icon={<RotateCcw className="h-4 w-4 text-orange-600" />}
          title="No card to start"
          body="Free plan never asks for a credit card. Upgrade only when you want to."
        />
      </div>
    </div>
  );
}

function Tile({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
