"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  FileSignature,
  FolderKanban,
  Globe,
  Receipt,
  Wallet,
} from "lucide-react";
import { Section, SectionHeading } from "../section";
import { Reveal } from "../motion";
import { cn } from "@/lib/utils";

/**
 * Interactive product showcase — the product is the hero. A tab rail on the
 * left (top on mobile) switches between realistic CSS mockups of the five
 * core surfaces. id="features" keeps existing /#features deep links working.
 */

interface Tab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  headline: string;
  description: string;
  points: string[];
  mockup: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: "invoices",
    icon: Receipt,
    label: "Invoices",
    headline: "Invoices that look professional and get paid faster.",
    description:
      "Create a polished invoice in under a minute. Simple or full GST — Stackivo picks the right CGST / SGST / IGST split from the client's state, so you never second-guess tax again.",
    points: [
      "Simple or GST mode per invoice — your call",
      "Share by link, email, or WhatsApp",
      "Automatic payment reminders for overdue invoices",
    ],
    mockup: <InvoiceMockup />,
  },
  {
    id: "contracts",
    icon: FileSignature,
    label: "Contracts",
    headline: "From proposal to signature without leaving the browser.",
    description:
      "Draft contracts and welcome documents, send a signing link, and watch status move from sent to viewed to signed — no printing, no scanning, no chasing.",
    points: [
      "Legally-clear templates you can edit freely",
      "E-signature with a public signing link",
      "Status timeline: sent → viewed → signed",
    ],
    mockup: <ContractMockup />,
  },
  {
    id: "portal",
    icon: Globe,
    label: "Client portal",
    headline: "Give every client a home, not an email thread.",
    description:
      "Clients get a clean branded portal with their projects, invoices, contracts, and files in one place. Fewer status-update calls, more 'wow, you're organised'.",
    points: [
      "One link per client — no logins to explain",
      "Invoices, files, and progress, always current",
      "Your branding, not ours",
    ],
    mockup: <PortalMockup />,
  },
  {
    id: "projects",
    icon: FolderKanban,
    label: "Projects & time",
    headline: "Track the work, then bill every minute of it.",
    description:
      "Run projects with clear status, start a timer or log hours manually, and pull billable time straight into invoices at your project rate. Unbilled hours stop leaking.",
    points: [
      "Timer or manual entries per project",
      "Billable hours flow into invoices automatically",
      "See scope and progress at a glance",
    ],
    mockup: <ProjectsMockup />,
  },
  {
    id: "payments",
    icon: Wallet,
    label: "Payments",
    headline: "Get paid by UPI, card, or netbanking — instantly logged.",
    description:
      "Every invoice carries a Razorpay payment link. When the client pays, Stackivo marks it paid, records the transaction, and updates your Pulse dashboard. No reconciliation spreadsheet.",
    points: [
      "UPI, cards, netbanking via Razorpay",
      "Auto-reconciled — invoices mark themselves paid",
      "Pulse shows outstanding vs collected in real time",
    ],
    mockup: <PaymentsMockup />,
  },
];

export function ShowcaseSection() {
  const [active, setActive] = React.useState(0);
  const tab = TABS[active];

  return (
    <Section id="features" size="ultra">
      <Reveal>
        <SectionHeading
          eyebrow="The product"
          title="One workspace. Every surface of your business."
          subtitle="Everything is connected: a signed contract kicks off a project, tracked hours become an invoice, and payment lands back on your dashboard."
        />
      </Reveal>

      <div className="mt-10 grid gap-8 lg:mt-12 lg:grid-cols-[320px_1fr] lg:gap-14">
        {/* Tab rail */}
        <div
          role="tablist"
          aria-label="Product areas"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 lg:mx-0 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "group flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all lg:w-full lg:px-5 lg:py-4",
                i === active
                  ? "border-primary/20 bg-primary/[0.05] shadow-sm"
                  : "border-transparent hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  i === active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
              </span>
              <span className="whitespace-nowrap lg:whitespace-normal">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    i === active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t.label}
                </span>
                <span className="hidden text-xs text-muted-foreground lg:block">
                  {TAB_TAGLINES[t.id]}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.id}
              role="tabpanel"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="max-w-xl font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {tab.headline}
              </h3>
              <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                {tab.description}
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {tab.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm font-medium text-foreground/90">
                    <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                    {p}
                  </li>
                ))}
              </ul>

              <div className="relative mt-7">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/[0.09] to-transparent blur-2xl"
                />
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-primary/[0.07]">
                  {tab.mockup}
                </div>
              </div>

              <Link
                href="/signup"
                data-cta={`showcase_${tab.id}`}
                className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
              >
                Try {tab.label.toLowerCase()} free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}

const TAB_TAGLINES: Record<string, string> = {
  invoices: "Simple or GST, paid faster",
  contracts: "E-sign in the browser",
  portal: "A branded home per client",
  projects: "Hours that bill themselves",
  payments: "UPI, cards, auto-reconciled",
};

/* ----------------------------- Mockups ---------------------------------- */

function Frame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div aria-hidden className="bg-background">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-2">
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground/10" />
          <span className="h-2 w-2 rounded-full bg-foreground/10" />
          <span className="h-2 w-2 rounded-full bg-foreground/10" />
        </span>
        <span className="ml-2 text-[11px] font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function InvoiceMockup() {
  return (
    <Frame title="Invoices · INV-0043">
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-base font-semibold tracking-tight">Tax Invoice</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">INV-0043 · 10 Jun 2026</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
              GST · Karnataka
            </span>
          </div>
          <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
            <MockRow left="Brand identity — Phase 2" right="₹60,000" />
            <MockRow left="Landing page build" right="₹45,000" />
            <MockRow left="CGST 9% + SGST 9%" right="₹18,900" muted />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs font-semibold text-foreground">Total due</span>
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              ₹1,23,900
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Share
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {["Payment link", "Email", "WhatsApp", "PDF"].map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-success/20 bg-success/[0.06] p-4">
            <p className="text-[11px] font-semibold text-success">Reminder scheduled</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              A polite nudge goes out automatically if this is unpaid on 24 Jun.
            </p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function ContractMockup() {
  const steps = [
    { label: "Drafted", done: true, time: "2 Jun" },
    { label: "Sent for signature", done: true, time: "3 Jun" },
    { label: "Viewed by client", done: true, time: "3 Jun" },
    { label: "Signed", done: true, time: "4 Jun", highlight: true },
  ];
  return (
    <Frame title="Contracts · Service agreement">
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
          <p className="font-display text-sm font-semibold tracking-tight">
            Service Agreement — Karta Studio
          </p>
          <div className="mt-3 space-y-1.5">
            {[100, 92, 96, 70, 88, 40].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="mt-5 flex items-end justify-between rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-3">
            <div>
              <p className="font-serif text-base italic text-foreground">Meera Iyer</p>
              <p className="text-[10px] text-muted-foreground">Signed 4 Jun 2026, 11:42</p>
            </div>
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">
              ✓ E-signed
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </p>
          <div className="mt-3 space-y-3">
            {steps.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full",
                    s.highlight ? "bg-success text-white" : "bg-primary/10 text-primary",
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="flex-1 text-xs font-medium text-foreground">{s.label}</span>
                <span className="text-[10px] text-muted-foreground">{s.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function PortalMockup() {
  return (
    <Frame title="portal.stackivo.com/karta-studio">
      <div className="rounded-xl border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              K
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">Karta Studio</p>
              <p className="text-[10px] text-muted-foreground">Client workspace</p>
            </div>
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">
            2 projects active
          </span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Projects
            </p>
            <p className="mt-1.5 text-xs font-medium text-foreground">Website revamp</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full w-[72%] rounded-full bg-primary" />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">72% complete</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Invoices
            </p>
            <p className="mt-1.5 text-xs font-medium text-foreground">INV-0042 · ₹48,000</p>
            <span className="mt-2 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-semibold text-success">
              Paid
            </span>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Files
            </p>
            <p className="mt-1.5 text-xs font-medium text-foreground">brand-guide-v3.pdf</p>
            <p className="text-[10px] text-muted-foreground">+ 11 shared files</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function ProjectsMockup() {
  return (
    <Frame title="Projects · Website revamp">
      <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            This week
          </p>
          <div className="mt-3 space-y-2.5">
            {[
              { day: "Mon", task: "Design system tokens", time: "3.5h" },
              { day: "Tue", task: "Homepage build", time: "6.0h" },
              { day: "Wed", task: "Client review call", time: "1.5h" },
              { day: "Thu", task: "Responsive pass", time: "4.0h" },
            ].map((r) => (
              <div key={r.day} className="flex items-center gap-3">
                <span className="w-8 text-[10px] font-semibold text-muted-foreground">{r.day}</span>
                <span className="flex-1 truncate text-xs text-foreground">{r.task}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{r.time}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-[11px] font-medium text-muted-foreground">Billable total</span>
            <span className="font-mono text-xs font-semibold text-foreground">15.0h × ₹2,000</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
            <p className="text-[11px] font-semibold text-primary">→ Pull into invoice</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              15 billable hours become a ₹30,000 line item on INV-0044. One click.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-mono text-sm font-medium text-foreground">02:41:08</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Timer running · Responsive pass</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function PaymentsMockup() {
  return (
    <Frame title="Payments">
      <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr]">
        <div className="rounded-xl border border-border/70 bg-card p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pay INV-0043
          </p>
          <p className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
            ₹1,23,900
          </p>
          <div className="mx-auto mt-3 grid h-20 w-20 grid-cols-5 gap-0.5 rounded-lg border border-border/70 p-1.5">
            {QR.map((on, i) => (
              <span key={i} className={cn("rounded-[1px]", on ? "bg-foreground" : "bg-transparent")} />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">UPI · Cards · Netbanking</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recent payouts
          </p>
          <div className="mt-3 space-y-2.5">
            <MockRow left="Nexa Labs · UPI" right="+₹48,000" success />
            <MockRow left="Bloom D2C · Card" right="+₹78,000" success />
            <MockRow left="Meera Iyer · UPI" right="+₹35,400" success />
          </div>
          <div className="mt-3 rounded-lg bg-success/[0.06] p-2.5 text-[11px] text-success">
            ✓ All payments auto-matched to invoices
          </div>
        </div>
      </div>
    </Frame>
  );
}

const QR = Array.from({ length: 25 }, (_, i) => [0, 1, 2, 4, 5, 8, 10, 12, 14, 16, 19, 20, 22, 24].includes(i));

function MockRow({
  left,
  right,
  muted,
  success,
}: {
  left: string;
  right: string;
  muted?: boolean;
  success?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("truncate text-xs", muted ? "text-muted-foreground" : "text-foreground")}>
        {left}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-xs",
          success ? "font-medium text-success" : muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {right}
      </span>
    </div>
  );
}
