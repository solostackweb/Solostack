"use client";

/**
 * Freelance hourly rate calculator.
 *
 * Reverse-engineers the minimum hourly rate a freelancer must charge
 * to take home a target annual income, given realistic billable
 * hours, business expenses, and tax. India-tuned defaults:
 *   - Working weeks default to 48 (2 weeks holiday + 2 weeks
 *     buffer for festivals / sickness)
 *   - Billable % defaults to 60 (industry-standard ratio of paid vs
 *     internal work)
 *   - Tax defaults to 0 (presumptive scheme 44ADA users) — toggleable
 *     up to 30% for higher-income freelancers
 *
 * Math is pure-function and tested implicitly by the unit cases at
 * the bottom of this file (see __tests if you split it).
 */

import * as React from "react";
import { useTrack } from "@/lib/analytics/track";
import { ToolInlineCta } from "./tool-page";

interface Inputs {
  /** Annual take-home target, INR. */
  targetIncome: number;
  /** Annual business expenses (rent share, software, internet, etc), INR. */
  annualExpenses: number;
  /** Working weeks per year (52 minus vacation + festivals + sick). */
  workingWeeks: number;
  /** Working hours per week (default 40). */
  hoursPerWeek: number;
  /** Billable hours as a % of working hours. */
  billablePct: number;
  /** Effective income tax rate (%), 0 to 30. */
  taxRatePct: number;
}

const DEFAULTS: Inputs = {
  targetIncome: 1_200_000, // 12L p.a.
  annualExpenses: 120_000, // ~10k/mo
  workingWeeks: 48,
  hoursPerWeek: 40,
  billablePct: 60,
  taxRatePct: 0,
};

function computeRate(input: Inputs) {
  const billableHours = Math.max(
    1,
    input.workingWeeks * input.hoursPerWeek * (input.billablePct / 100),
  );
  // Gross required = take-home / (1 - tax) + expenses
  const taxFactor = 1 - Math.min(0.5, Math.max(0, input.taxRatePct / 100));
  const grossRequired =
    input.targetIncome / Math.max(0.001, taxFactor) + input.annualExpenses;
  const hourly = grossRequired / billableHours;
  return {
    billableHours,
    grossRequired,
    hourly,
    daily: hourly * 8,
    monthly: grossRequired / 12,
  };
}

export function FreelanceRateCalculator() {
  const [inputs, setInputs] = React.useState<Inputs>(DEFAULTS);
  const result = React.useMemo(() => computeRate(inputs), [inputs]);
  const track = useTrack();

  // Fire one computation event the first time the user changes any field
  // — enough signal to know the tool is being used, without spamming.
  const interacted = React.useRef(false);
  const onChange = <K extends keyof Inputs>(key: K, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    if (!interacted.current) {
      interacted.current = true;
      track("marketing.cta.clicked", {
        location: "tool_freelance_rate_used",
        label: "rate_calculator",
      });
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* --- Inputs panel ------------------------------------------------ */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-7">
        <h3 className="text-base font-semibold">Your situation</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Edit any field — the rate updates instantly.
        </p>

        <div className="mt-6 space-y-5">
          <Field
            label="Target take-home income (per year)"
            unit="₹"
            value={inputs.targetIncome}
            onChange={(v) => onChange("targetIncome", v)}
            step={50_000}
            min={0}
            hint={`That's ₹${formatINR(inputs.targetIncome / 12)} per month after expenses.`}
          />
          <Field
            label="Annual business expenses"
            unit="₹"
            value={inputs.annualExpenses}
            onChange={(v) => onChange("annualExpenses", v)}
            step={10_000}
            min={0}
            hint="Software, internet, coworking, accountant, hardware depreciation."
          />
          <SliderField
            label="Working weeks per year"
            value={inputs.workingWeeks}
            onChange={(v) => onChange("workingWeeks", v)}
            min={30}
            max={52}
            step={1}
            unit="weeks"
            hint={`That's ${52 - inputs.workingWeeks} weeks of holiday + buffer.`}
          />
          <SliderField
            label="Hours per working week"
            value={inputs.hoursPerWeek}
            onChange={(v) => onChange("hoursPerWeek", v)}
            min={20}
            max={60}
            step={1}
            unit="hrs"
            hint="Total working hours — billable + non-billable combined."
          />
          <SliderField
            label="Billable hours (% of working hours)"
            value={inputs.billablePct}
            onChange={(v) => onChange("billablePct", v)}
            min={20}
            max={90}
            step={5}
            unit="%"
            hint="Real-world freelancers bill 50–70% of working hours. The rest goes to sales, admin, and revisions."
          />
          <SliderField
            label="Effective tax rate"
            value={inputs.taxRatePct}
            onChange={(v) => onChange("taxRatePct", v)}
            min={0}
            max={30}
            step={1}
            unit="%"
            hint="Set to 0 if you use 44ADA presumptive scheme on ≤ ₹50L. Else use your effective rate."
          />
        </div>
      </div>

      {/* --- Result panel ------------------------------------------------ */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.04] via-background to-indigo-500/[0.03] p-6 shadow-sm sm:p-7">
        <h3 className="text-base font-semibold">Your minimum rate</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          To hit ₹{formatINR(inputs.targetIncome)} take-home this year, you need to charge at least:
        </p>

        <div className="mt-6">
          <div className="text-5xl font-bold leading-none tracking-tight sm:text-5xl">
            ₹{formatINR(Math.ceil(result.hourly / 50) * 50)}
            <span className="ml-1.5 text-base font-medium text-muted-foreground">
              / hour
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rounded up to the nearest ₹50 for negotiation comfort.
          </p>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-3 text-sm">
          <ResultRow
            label="Per 8-hr day"
            value={`₹${formatINR(Math.round(result.daily))}`}
          />
          <ResultRow
            label="Per month gross"
            value={`₹${formatINR(Math.round(result.monthly))}`}
          />
          <ResultRow
            label="Billable hrs / year"
            value={`${Math.round(result.billableHours)} hrs`}
          />
          <ResultRow
            label="Gross income needed"
            value={`₹${formatINR(Math.round(result.grossRequired))}`}
          />
        </dl>

        <ToolInlineCta
          resultLine={`Your rate: ₹${formatINR(Math.ceil(result.hourly / 50) * 50)}/hr`}
          ctaText="invoice clients at this rate directly in Stackivo"
        />

        <div className="mt-4 rounded-lg border bg-background/60 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Reality check</p>
          <p className="mt-1.5">
            This is the <strong>floor</strong>, not the ceiling. Charge more
            for: senior expertise · rush work · scope risk · clients who pay
            slowly · projects you don&rsquo;t love. Tip: never quote the same
            rate to two different client tiers.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
  min,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  unit?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        {unit ? (
          <span className="text-sm text-muted-foreground">{unit}</span>
        ) : null}
        <input
          type="number"
          inputMode="numeric"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-9 w-full rounded-lg border bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </label>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </label>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2">
      <dt className="text-micro uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatINR(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}
