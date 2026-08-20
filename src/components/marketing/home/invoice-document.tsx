import { Paper } from "../section";

/**
 * The hero visual: a Stackivo invoice, typeset properly.
 *
 * This replaces v1's floating glass fragments. MASTER.md §8 — product visuals
 * show real product output, not decoration. An invoice is the single artifact
 * every Stackivo user produces, and setting one well is a more credible claim
 * about the product than any arrangement of check-mark cards.
 *
 * Figures are deliberately unrounded. `₹1,24,847` reads as a real job;
 * `₹1,25,000` reads as a placeholder. Indian digit grouping throughout.
 *
 * Server component — static, so it costs the hero LCP nothing.
 */

const LINES = [
  { desc: "Brand identity — discovery & positioning", hrs: "14.0", amount: "42,000.00" },
  { desc: "Design system build", hrs: "28.5", amount: "85,500.00" },
  { desc: "Handoff & documentation", hrs: "6.0", amount: "18,000.00" },
];

export function InvoiceDocument() {
  return (
    <Paper className="p-6 sm:p-8" aria-label="Example Stackivo invoice">
      <header className="flex items-start justify-between gap-6 border-b border-border pb-5">
        <div>
          <h3 className="font-display text-2xl font-normal leading-none tracking-[-0.015em] text-foreground">
            Invoice
          </h3>
          <p className="mt-2.5 inline-flex items-center gap-1.5 border border-primary px-2 py-0.5 font-mono text-micro font-medium uppercase tracking-[0.13em] text-primary">
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden>
              <path d="M2.5 6.5 5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Paid · 12 Aug
          </p>
        </div>
        <dl className="text-right font-mono text-micro leading-[1.9] text-muted-foreground">
          <div><dt className="sr-only">Invoice number</dt><dd className="text-foreground">STK-2026-0184</dd></div>
          <div><dt className="sr-only">Raised</dt><dd>Raised 02 Aug 2026</dd></div>
          <div><dt className="sr-only">Terms</dt><dd>Terms — Net 10</dd></div>
        </dl>
      </header>

      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="pb-2.5 font-mono text-micro font-medium uppercase tracking-[0.13em] text-muted-foreground">
              Description
            </th>
            <th scope="col" className="pb-2.5 text-right font-mono text-micro font-medium uppercase tracking-[0.13em] text-muted-foreground">
              Hrs
            </th>
            <th scope="col" className="pb-2.5 text-right font-mono text-micro font-medium uppercase tracking-[0.13em] text-muted-foreground">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {LINES.map((l) => (
            <tr key={l.desc} className="border-b border-secondary">
              <td className="py-3 pr-4 text-sm text-foreground">{l.desc}</td>
              <td className="py-3 text-right font-mono text-xs tabular-nums text-foreground">{l.hrs}</td>
              <td className="py-3 pl-4 text-right font-mono text-xs tabular-nums text-foreground">{l.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-5 text-sm">
        <div className="flex justify-between py-1.5 text-muted-foreground">
          <dt>Subtotal</dt>
          <dd className="font-mono text-xs tabular-nums text-foreground">1,45,500.00</dd>
        </div>
        <div className="flex justify-between py-1.5 text-muted-foreground">
          <dt>CGST @ 9%</dt>
          <dd className="font-mono text-xs tabular-nums text-foreground">13,095.00</dd>
        </div>
        <div className="flex justify-between py-1.5 text-muted-foreground">
          <dt>SGST @ 9%</dt>
          <dd className="font-mono text-xs tabular-nums text-foreground">13,095.00</dd>
        </div>
        <div className="mt-2.5 flex items-baseline justify-between border-t-2 border-foreground pt-3">
          <dt className="font-medium text-foreground">Total due</dt>
          <dd className="font-mono text-lg font-medium tabular-nums text-foreground">₹1,71,690.00</dd>
        </div>
      </dl>

      <footer className="mt-5 border-t border-border pt-4 font-mono text-micro leading-relaxed text-muted-foreground">
        Place of supply — Karnataka · Same-state supply, tax split CGST/SGST
      </footer>
    </Paper>
  );
}
