"use client";

import { ToolInlineCta } from "./tool-page";

/**
 * GST calculator (India).
 *
 * Handles:
 *   - Forward calculation (base → tax → total)
 *   - Reverse calculation (total → base + tax) when toggled to
 *     "amount is GST-inclusive"
 *   - Intra-state split: CGST + SGST (each = rate/2)
 *   - Inter-state: IGST = full rate
 *
 * Rates are the four standard GST slabs: 5 / 12 / 18 / 28 percent.
 * Visitor toggles "Same state" vs "Different state" to control the
 * split mode — this matches the actual question a freelancer asks
 * when issuing an invoice ("is the client in my state?").
 */

import * as React from "react";

type Slab = 5 | 12 | 18 | 28;
type Mode = "exclusive" | "inclusive";
type Supply = "intra" | "inter";

const SLABS: readonly Slab[] = [5, 12, 18, 28];

interface Result {
  base: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

function compute(
  amount: number,
  rate: Slab,
  mode: Mode,
  supply: Supply,
): Result {
  const r = rate / 100;
  const base = mode === "exclusive" ? amount : amount / (1 + r);
  const tax = mode === "exclusive" ? amount * r : amount - base;
  const total = mode === "exclusive" ? amount + tax : amount;
  return {
    base: round2(base),
    tax: round2(tax),
    cgst: supply === "intra" ? round2(tax / 2) : 0,
    sgst: supply === "intra" ? round2(tax / 2) : 0,
    igst: supply === "inter" ? round2(tax) : 0,
    total: round2(total),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function GstCalculator() {
  const [amount, setAmount] = React.useState(10_000);
  const [rate, setRate] = React.useState<Slab>(18);
  const [mode, setMode] = React.useState<Mode>("exclusive");
  const [supply, setSupply] = React.useState<Supply>("intra");

  const r = React.useMemo(
    () => compute(amount, rate, mode, supply),
    [amount, rate, mode, supply],
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* --- Inputs ------------------------------------------------------ */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-7">
        <h3 className="text-base font-semibold">Invoice details</h3>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="text-sm font-medium">
              Amount {mode === "exclusive" ? "(before GST)" : "(total including GST)"}
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">₹</span>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                step={500}
                min={0}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </label>

          <div>
            <span className="text-sm font-medium">GST rate</span>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {SLABS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRate(s)}
                  className={`h-9 rounded-lg border text-sm font-medium transition ${
                    rate === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Most freelance services fall under 18%. Verify your HSN/SAC code.
            </p>
          </div>

          <ToggleGroup
            label="Amount is..."
            options={[
              { id: "exclusive", label: "Before GST" },
              { id: "inclusive", label: "Including GST" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />

          <ToggleGroup
            label="Place of supply"
            options={[
              { id: "intra", label: "Same state (CGST + SGST)" },
              { id: "inter", label: "Different state (IGST)" },
            ]}
            value={supply}
            onChange={(v) => setSupply(v as Supply)}
          />
        </div>
      </div>

      {/* --- Result ------------------------------------------------------ */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.04] via-background to-indigo-500/[0.03] p-6 shadow-sm sm:p-7">
        <h3 className="text-base font-semibold">Breakdown</h3>

        <dl className="mt-6 space-y-3 text-sm">
          <Row label="Taxable amount (base)" value={r.base} bold={false} />

          {supply === "intra" ? (
            <>
              <Row label={`CGST (${rate / 2}%)`} value={r.cgst} bold={false} />
              <Row label={`SGST (${rate / 2}%)`} value={r.sgst} bold={false} />
            </>
          ) : (
            <Row label={`IGST (${rate}%)`} value={r.igst} bold={false} />
          )}

          <div className="my-3 border-t" />
          <Row label="Total invoice amount" value={r.total} bold />
        </dl>

        <ToolInlineCta
          resultLine={`Total invoice ₹${r.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          ctaText="send it to your client in 30 seconds"
        />

        <div className="mt-4 rounded-lg border bg-background/60 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Heads up</p>
          <p className="mt-1.5">
            GST applies once you cross{" "}
            <strong>₹20L turnover</strong> (₹10L in special-category states).
            If you&rsquo;re below threshold and unregistered, charge a
            non-GST invoice instead.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={bold ? "font-semibold" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${bold ? "text-lg font-bold" : "font-medium"}`}
      >
        ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </dd>
    </div>
  );
}

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
              value === o.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
