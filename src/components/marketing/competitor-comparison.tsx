import { Check, X } from "lucide-react";

/**
 * Stackivo vs Refrens / Vyapar / Zoho Books at-a-glance comparison.
 *
 * India-specific competitors (intentionally not Bonsai / FreshBooks —
 * those are US-built and irrelevant on the Indian shopping comparison
 * journey). Rows chosen for what an Indian solo freelancer cares
 * about: GST + contracts + projects + time + portal + India support.
 *
 * Claims kept conservative + factual. Update if a competitor catches
 * up.
 */
const ROWS: Array<{
  feature: string;
  stackivo: boolean | string;
  refrens: boolean | string;
  vyapar: boolean | string;
  zoho: boolean | string;
}> = [
  {
    feature: "GST-ready invoicing (CGST/SGST/IGST split)",
    stackivo: true,
    refrens: true,
    vyapar: true,
    zoho: true,
  },
  {
    feature: "Built for freelancers (vs SMBs/retail)",
    stackivo: true,
    refrens: true,
    vyapar: false,
    zoho: false,
  },
  {
    feature: "Contracts + e-signature",
    stackivo: true,
    refrens: false,
    vyapar: false,
    zoho: false,
  },
  {
    feature: "Project workspaces",
    stackivo: true,
    refrens: false,
    vyapar: false,
    zoho: "Add-on",
  },
  {
    feature: "Time tracking → invoice",
    stackivo: true,
    refrens: false,
    vyapar: false,
    zoho: "Separate app",
  },
  {
    feature: "Client portal",
    stackivo: "Pro",
    refrens: false,
    vyapar: false,
    zoho: "Higher tier",
  },
  {
    feature: "Free forever (no time limit)",
    stackivo: "5 clients",
    refrens: "Limited",
    vyapar: "Mobile only",
    zoho: "14-day trial",
  },
  {
    feature: "Founder-level support",
    stackivo: true,
    refrens: false,
    vyapar: false,
    zoho: false,
  },
];

export function CompetitorComparison() {
  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Feature
              </th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-foreground">
                Stackivo
              </th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Refrens
              </th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Vyapar
              </th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Zoho Books
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.feature}
                className={i < ROWS.length - 1 ? "border-b border-border/40" : ""}
              >
                <td className="px-4 py-3 font-medium">{row.feature}</td>
                <Cell value={row.stackivo} highlight />
                <Cell value={row.refrens} />
                <Cell value={row.vyapar} />
                <Cell value={row.zoho} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        Comparison reflects publicly-listed features at time of writing. Each
        product evolves — verify on their respective sites.
      </p>
    </div>
  );
}

function Cell({
  value,
  highlight,
}: {
  value: boolean | string;
  highlight?: boolean;
}) {
  if (value === true) {
    return (
      <td
        className={`px-4 py-3 ${highlight ? "bg-success-subtle font-medium text-success-strong" : "text-foreground"}`}
      >
        <Check className="h-4 w-4" />
      </td>
    );
  }
  if (value === false) {
    return (
      <td className="px-4 py-3 text-muted-foreground">
        <X className="h-4 w-4 opacity-50" />
      </td>
    );
  }
  return (
    <td
      className={`px-4 py-3 text-xs ${highlight ? "bg-success-subtle font-medium text-success-strong" : "text-muted-foreground"}`}
    >
      {value}
    </td>
  );
}
