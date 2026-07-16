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

export const metadata = { title: "Documents | Stackivo" };
export const dynamic = "force-dynamic";

interface DocCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const CLIENT_DOCUMENTS: DocCard[] = [
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

const FORMS: DocCard[] = [
  {
    title: "Questionnaire",
    description:
      "Structured intake forms to collect scope, brand, and project details from a client before you start.",
    href: "/dashboard/questionnaires",
    icon: ListChecks,
  },
  {
    title: "Lead forms",
    description:
      "Public capture forms that turn website visitors into clients and projects in your pipeline automatically.",
    href: "/dashboard/lead-forms",
    icon: ClipboardList,
  },
];

function Card({ card }: { card: DocCard }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group flex flex-col rounded-2xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {card.description}
      </p>
    </Link>
  );
}

function Section({ title, cards }: { title: string; cards: DocCard[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.href} card={card} />
        ))}
      </div>
    </section>
  );
}

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="One place for everything you send to clients — documents and forms."
      />
      <Section title="Client documents" cards={CLIENT_DOCUMENTS} />
      <Section title="Forms" cards={FORMS} />
    </div>
  );
}
