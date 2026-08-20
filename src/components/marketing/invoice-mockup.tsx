/**
 * Premium-looking GST invoice "screenshot". Used in the GST showcase
 * section. Demonstrates the auto-split CGST / SGST line that's the whole
 * point of the platform.
 */
export function InvoiceMockup() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-xl shadow-primary/5 ring-1 ring-border/40">
      <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3">
        <div>
          <p className="text-micro uppercase tracking-wider text-muted-foreground">Invoice</p>
          <p className="font-mono text-sm font-medium">INV-0042</p>
        </div>
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-micro font-medium text-success">
          Paid
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b px-5 py-4 text-xs">
        <div>
          <p className="text-micro uppercase tracking-wider text-muted-foreground">From</p>
          <p className="mt-1 font-medium">Aanya Mehta</p>
          <p className="text-muted-foreground">Aanya Studio · Bengaluru, KA</p>
          <p className="font-mono text-micro text-muted-foreground">
            29ABCDE1234F1Z5
          </p>
        </div>
        <div>
          <p className="text-micro uppercase tracking-wider text-muted-foreground">Bill to</p>
          <p className="mt-1 font-medium">Pixel & Co.</p>
          <p className="text-muted-foreground">Bengaluru, KA</p>
          <p className="font-mono text-micro text-muted-foreground">
            29PIXEL5678G1Z3
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-2 text-xs">
          <p className="text-micro uppercase tracking-wider text-muted-foreground">Item</p>
          <p className="text-right text-micro uppercase tracking-wider text-muted-foreground">Qty</p>
          <p className="text-right text-micro uppercase tracking-wider text-muted-foreground">Rate</p>
          <p className="text-right text-micro uppercase tracking-wider text-muted-foreground">Amount</p>

          <p>Brand identity design</p>
          <p className="text-right">1</p>
          <p className="text-right font-mono">₹60,000</p>
          <p className="text-right font-mono">₹60,000</p>

          <p>Landing page UI</p>
          <p className="text-right">1</p>
          <p className="text-right font-mono">₹35,000</p>
          <p className="text-right font-mono">₹35,000</p>

          <p>Logo refinements</p>
          <p className="text-right">2</p>
          <p className="text-right font-mono">₹7,500</p>
          <p className="text-right font-mono">₹15,000</p>
        </div>

        <div className="mt-4 ml-auto w-full max-w-[260px] space-y-1.5 border-t pt-3 text-xs">
          <Row label="Subtotal" value="₹1,10,000" />
          <Row label="CGST · 9%" value="₹9,900" tag />
          <Row label="SGST · 9%" value="₹9,900" tag />
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">₹1,29,800</span>
          </div>
        </div>

        <p className="mt-4 rounded-lg border bg-muted/40 p-3 text-micro italic text-muted-foreground">
          GST applicable. CGST + SGST applied because place of supply matches the
          supplier&apos;s state (intra-state).
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tag = false,
}: {
  label: string;
  value: string;
  tag?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={tag ? "text-muted-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
