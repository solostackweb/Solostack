"use client";

import { Section, SectionHeading } from "./section";
import { Reveal, StaggerReveal, StaggerItem } from "./motion";

export function PulseSection() {
  return (
    <Section size="wide">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 xl:gap-24">
        <Reveal className="relative order-2 lg:order-1">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-primary/10 blur-2xl"
          />
          <div className="transition-transform duration-300 ease-out hover:-translate-y-1">
            <PulseMockup />
          </div>
        </Reveal>
        <Reveal className="order-1 max-w-xl lg:order-2">
          <SectionHeading
            align="left"
            eyebrow="Pulse analytics"
            title="See your business clearly."
            subtitle="Pulse turns your raw operational data into the three numbers that actually matter: what you've earned, what's owed, and which clients are worth keeping."
          />
          <StaggerReveal className="mt-10 space-y-4 text-base" amount={0.25}>
            <StaggerItem><Bullet>Monthly paid revenue trends</Bullet></StaggerItem>
            <StaggerItem><Bullet>Top clients by lifetime revenue</Bullet></StaggerItem>
            <StaggerItem><Bullet>Overdue alerts before they become awkward</Bullet></StaggerItem>
            <StaggerItem><Bullet>Time-to-cash and project profitability</Bullet></StaggerItem>
          </StaggerReveal>
        </Reveal>
      </div>
    </Section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

function PulseMockup() {
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const data = [40, 55, 48, 70, 82, 76];
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-2xl shadow-primary/10 ring-1 ring-border/40 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground sm:text-sm">Total this year</p>
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
            ₹18,42,500
          </p>
        </div>
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          +24% YoY
        </span>
      </div>

      <svg viewBox="0 0 300 100" className="mt-6 h-40 w-full sm:h-48">
        <defs>
          <linearGradient id="pulse" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={buildAreaPath(data)}
          fill="url(#pulse)"
          stroke="none"
        />
        <path
          d={buildLinePath(data)}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Mini label="Contracts" value="INR 6.8L" />
        <Mini label="Overdue" value="₹38,000" tone="warning" />
        <Mini label="Top client" value="Pixel & Co." />
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-micro uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold tracking-tight ${
          tone === "warning" ? "text-warning" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function buildLinePath(values: number[]): string {
  const w = 300;
  const h = 100;
  const max = Math.max(...values);
  const step = w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 10) - 5;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[]): string {
  const line = buildLinePath(values);
  const w = 300;
  const h = 100;
  return `${line} L ${w} ${h} L 0 ${h} Z`;
}
