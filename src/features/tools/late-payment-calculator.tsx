"use client";

/**
 * Late-payment interest calculator.
 *
 * Computes interest accrued on an overdue invoice. Supports:
 *   - Custom interest rate (default 18% p.a. per MSMED Act for
 *     registered MSMEs / Udyam-holders)
 *   - Simple OR compound (monthly) interest
 *   - Variable due date (date picker) — accrual starts the day
 *     after the due date
 *
 * Math:
 *   simple   = principal * rate * days / 365
 *   compound = principal * ((1 + rate/12) ^ months) - principal
 *              (using fractional months for partial periods)
 *
 * MSMED Act §16: if the buyer fails to pay within 45 days,
 * interest is payable at 3x the RBI bank rate, compounded
 * monthly. We default to 18% p.a. (a common contractual rate)
 * but expose the slider so the user can match their own
 * contract.
 */

import * as React from "react";
import { ToolInlineCta } from "./tool-page";

type Mode = "simple" | "compound";

interface Result {
  daysOverdue: number;
  monthsOverdue: number;
  interest: number;
  totalOwed: number;
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function compute(
  principal: number,
  ratePct: number,
  dueDate: Date,
  asOf: Date,
  mode: Mode,
): Result {
  const days = diffDays(dueDate, asOf);
  const months = days / 30.4375; // average month length
  const r = ratePct / 100;

  let interest = 0;
  if (mode === "simple") {
    interest = principal * r * (days / 365);
  } else {
    const monthlyRate = r / 12;
    interest = principal * (Math.pow(1 + monthlyRate, months) - 1);
  }

  return {
    daysOverdue: days,
    monthsOverdue: round2(months),
    interest: round2(interest),
    totalOwed: round2(principal + interest),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function LatePaymentCalculator() {
  const [principal, setPrincipal] = React.useState(50_000);
  const [rate, setRate] = React.useState(18);
  const [dueDate, setDueDate] = React.useState(isoMinusDays(60));
  const [asOfDate, setAsOfDate] = React.useState(todayIso());
  const [mode, setMode] = React.useState<Mode>("compound");

  const result = React.useMemo(() => {
    const d = new Date(dueDate);
    const a = new Date(asOfDate);
    if (Number.isNaN(d.getTime()) || Number.isNaN(a.getTime())) {
      return {
        daysOverdue: 0,
        monthsOverdue: 0,
        interest: 0,
        totalOwed: principal,
      } satisfies Result;
    }
    return compute(principal, rate, d, a, mode);
  }, [principal, rate, dueDate, asOfDate, mode]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* --- Inputs ------------------------------------------------------ */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-7">
        <h3 className="text-base font-semibold">Invoice details</h3>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="text-sm font-medium">Outstanding invoice amount</span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">₹</span>
              <input
                type="number"
                inputMode="numeric"
                value={principal}
                step={1_000}
                min={0}
                onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Invoice due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Calculate interest as of</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Annual interest rate</span>
              <span className="text-sm font-semibold tabular-nums">{rate}%</span>
            </div>
            <input
              type="range"
              min={6}
              max={36}
              step={1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              18% p.a. is the MSMED Act default. Use your contract&rsquo;s rate if specified.
            </p>
          </div>

          <div>
            <span className="text-sm font-medium">Interest type</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["compound", "simple"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`h-9 rounded-lg border text-sm font-medium capitalize transition ${
                    mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              MSMED Act mandates compound (monthly). Most B2B contracts default to simple.
            </p>
          </div>
        </div>
      </div>

      {/* --- Result ------------------------------------------------------ */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.04] via-background to-indigo-500/[0.03] p-6 shadow-sm sm:p-7">
        <h3 className="text-base font-semibold">What you can claim</h3>

        <div className="mt-5">
          <p className="text-xs text-muted-foreground">Interest accrued</p>
          <div className="mt-1 text-5xl font-bold leading-none tracking-tight text-foreground sm:text-5xl">
            ₹{result.interest.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <Row label="Days overdue" value={`${result.daysOverdue} days`} />
          <Row label="Months overdue" value={`${result.monthsOverdue}`} />
          <Row label="Interest" value={`₹${formatINR(result.interest)}`} />
          <div className="my-2 border-t" />
          <Row
            label="Total owed (principal + interest)"
            value={`₹${formatINR(result.totalOwed)}`}
            bold
          />
        </dl>

        <ToolInlineCta
          resultLine={`Total owed ₹${formatINR(result.totalOwed)}`}
          ctaText="send an overdue reminder invoice with this figure"
        />

        <div className="mt-4 rounded-lg border bg-warning-subtle p-4 text-xs leading-relaxed">
          <p className="font-medium text-foreground">How to actually claim this</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>
              Send a formal reminder with this exact figure. Mention MSMED Act §16 if you&rsquo;re Udyam-registered.
            </li>
            <li>
              If unpaid after 15 days, file a complaint with the MSME Samadhan portal (free).
            </li>
            <li>
              Or invoice the interest as a separate line on your next bill — many clients pay rather than argue.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={bold ? "font-semibold" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${bold ? "text-base font-bold" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatINR(n: number): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
