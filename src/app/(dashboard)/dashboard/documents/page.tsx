import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FilePlus2,
  FileSignature,
  ListChecks,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Documents | Stackivo" };
export const dynamic = "force-dynamic";

const CARDS = [
  {
    title: "Proposals",
    description:
      "Lightweight offers with scope, pricing, and next steps — convert to a contract, invoice, or project in a click.",
    href: "/dashboard/proposals",
    icon: FilePlus2,
  },
  {
    title: "Contracts",
    description:
      "E-signature agreements for domestic or foreign clients — start from a polished template or a blank document.",
    href: "/dashboard/contracts",
    icon: FileSignature,
  },
  {
    title: "Welcome docs",
    description:
      "Warm, branded onboarding guides to greet a client and set expectations right after they say yes.",
    href: "/dashboard/welcome",
    icon: BookOpen,
  },
];

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="One place for everything you send to clients. Pick what you'd like to create or manage."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col rounded-2xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background text-primary">
                <card.icon className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {card.description}
            </p>
          </Link>
        ))}

        {/* Coming soon — questionnaire */}
        <div className="flex flex-col rounded-2xl border border-dashed bg-muted/20 p-6">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background text-muted-foreground">
              <ListChecks className="h-6 w-6" />
            </div>
            <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Coming soon
            </span>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-muted-foreground">
            Questionnaire
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Send clients a structured intake form to collect scope, brand, and
            project details before you start.
          </p>
        </div>
      </div>
    </div>
  );
}
