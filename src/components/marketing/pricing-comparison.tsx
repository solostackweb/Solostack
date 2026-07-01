import * as React from "react";
import { Check, Minus } from "lucide-react";

type Cell = boolean | string;

interface Row {
  feature: string;
  free: Cell;
  pro: Cell;
  business: Cell;
}

const ROWS: Array<{ heading: string; rows: Row[] }> = [
  {
    heading: "Operations",
    rows: [
      { feature: "Clients", free: "5 lifetime", pro: "Unlimited", business: "Unlimited" },
      { feature: "Invoices", free: "Unlimited", pro: "Unlimited", business: "Unlimited" },
      { feature: "Projects", free: "Unlimited", pro: "Unlimited", business: "Unlimited" },
      { feature: "Contracts & proposals", free: "Unlimited", pro: "Unlimited", business: "Unlimited" },
      { feature: "Time tracking", free: false, pro: true, business: true },
      { feature: "Pulse analytics", free: true, pro: true, business: true },
    ],
  },
  {
    heading: "GST & invoicing",
    rows: [
      { feature: "GST-ready invoicing", free: true, pro: true, business: true },
      { feature: "Custom branding", free: false, pro: true, business: true },
      { feature: "Recurring invoices", free: false, pro: true, business: true },
      { feature: "Advanced templates", free: false, pro: true, business: true },
      { feature: "GST reports", free: false, pro: true, business: true },
    ],
  },
  {
    heading: "Contracts & client portal",
    rows: [
      { feature: "Public signing links", free: true, pro: true, business: true },
      { feature: "E-signatures", free: false, pro: true, business: true },
      { feature: "Templates library", free: false, pro: true, business: true },
      { feature: "Client portal", free: false, pro: true, business: true },
      { feature: "Custom portal branding", free: false, pro: false, business: true },
    ],
  },
  {
    heading: "Storage & support",
    rows: [
      { feature: "File storage", free: "100 MB", pro: "5 GB", business: "50 GB" },
      { feature: "Email support", free: true, pro: true, business: true },
      { feature: "Priority support", free: false, pro: false, business: true },
      { feature: "API access", free: false, pro: false, business: true },
    ],
  },
];

export function PricingComparison() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 backdrop-blur">
            <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Compare plans
            </th>
            <th className="px-5 py-4 text-center text-sm font-semibold">Free</th>
            <th className="relative px-5 py-4 text-center text-sm font-semibold text-primary">
              <span className="relative">
                Pro
                <span className="absolute -right-2 -top-1 inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
              </span>
            </th>
            <th className="px-5 py-4 text-center text-sm font-semibold">Business</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((group) => (
            <React.Fragment key={group.heading}>
              <tr className="border-b bg-muted/30">
                <td
                  colSpan={4}
                  className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  {group.heading}
                </td>
              </tr>
              {group.rows.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-5 py-3.5 text-sm font-medium">{row.feature}</td>
                  <td className="px-5 py-3.5 text-center">{renderCell(row.free)}</td>
                  <td className="bg-primary/[0.03] px-5 py-3.5 text-center">{renderCell(row.pro)}</td>
                  <td className="px-5 py-3.5 text-center">{renderCell(row.business)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(cell: Cell) {
  if (cell === true) return <Check className="mx-auto h-4 w-4 text-emerald-500" />;
  if (cell === false)
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  return <span className="text-xs font-medium text-muted-foreground">{cell}</span>;
}
