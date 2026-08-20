import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  FilePlus2,
  FileSignature,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";

export const metadata = { title: "Documents | Stackivo" };
export const dynamic = "force-dynamic";

interface JourneyDocument {
  phase: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const CLIENT_JOURNEY: JourneyDocument[] = [
  {
    phase: "Win the work",
    title: "Proposals",
    description: "Set the scope, price, and next step.",
    href: "/dashboard/proposals",
    icon: FilePlus2,
  },
  {
    phase: "Agree the terms",
    title: "Contracts",
    description: "Put the agreement in writing and collect signatures.",
    href: "/dashboard/contracts",
    icon: FileSignature,
  },
  {
    phase: "Collect the brief",
    title: "Questionnaires",
    description: "Gather the details you need before work starts.",
    href: "/dashboard/questionnaires",
    icon: ListChecks,
  },
  {
    phase: "Start the work",
    title: "Welcome docs",
    description: "Share the plan, boundaries, and working rhythm.",
    href: "/dashboard/welcome",
    icon: BookOpen,
  },
];

function JourneyRow({
  document,
  index,
}: {
  document: JourneyDocument;
  index: number;
}) {
  const Icon = document.icon;
  return (
    <Link
      href={document.href}
      className="group relative z-10 grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
    >
      <span
        className={
          index === 0
            ? "flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            : "flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-card text-primary"
        }
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-micro font-semibold uppercase tracking-[0.14em] text-primary">
          {String(index + 1).padStart(2, "0")} · {document.phase}
        </span>
        <span className="mt-1 block text-base font-semibold">
          {document.title}
        </span>
        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
          {document.description}
        </span>
      </span>
      <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}

function ClientJourney() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/60 bg-primary/[0.025] px-5 py-5 sm:px-6">
        <p className="text-micro font-semibold uppercase tracking-[0.16em] text-primary">
          Client delivery
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          From first yes to a useful handoff.
        </h2>
      </div>
      <div className="relative divide-y divide-border/60">
        <div
          aria-hidden
          className="absolute bottom-12 left-10 top-12 w-px bg-primary/25 sm:left-11"
        />
        {CLIENT_JOURNEY.map((document, index) => (
          <JourneyRow
            key={document.href}
            document={document}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

function LeadCapture() {
  return (
    <aside className="self-start overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </span>
        <p className="mt-6 text-micro font-semibold uppercase tracking-[0.16em] text-primary">
          Before the client
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Turn interest into a brief.
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Share a public lead form and let Stackivo create the client and project
          starting point from their answers.
        </p>
        <Link
          href="/dashboard/lead-forms"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open lead forms <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}

export default function DocumentsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Documents"
        description="Move client work from the first yes to a clear handoff."
        actions={
          <IvoEntryPoint
            prompt="What documents should I send a new client, and in what order?"
            variant="secondary"
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <ClientJourney />
        <LeadCapture />
      </div>
    </div>
  );
}
