"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Reveal } from "./motion";
import { cn } from "@/lib/utils";
import { useTrack } from "@/lib/analytics/track";

export interface FaqItem {
  q: string;
  a: string;
}

export const DEFAULT_FAQS: FaqItem[] = [
  {
    q: "Is Stackivo really free?",
    a: "Yes. The Free plan is free forever for your first 5 lifetime clients and includes clients, projects, GST-ready invoices, contracts, time tracking, basic Pulse, and notifications. No card required.",
  },
  {
    q: "Do I need to be GST-registered to use Stackivo?",
    a: "No. Stackivo works for non-GST freelancers too - your invoices are issued as standard non-GST invoices with the right footer note. When you do register, just toggle on GST mode and we handle CGST / SGST / IGST automatically.",
  },
  {
    q: "Can I track time and bill from it?",
    a: "Yes. Start the timer or log entries manually. Billable hours flow directly into invoices using your project rate.",
  },
  {
    q: "What about contracts?",
    a: "Yes. Draft proposals and contracts inside Stackivo, share a public signing link, and watch the status timeline from sent to signed.",
  },
  {
    q: "Will my data be safe?",
    a: "Every workspace is isolated by Supabase row-level security - no other user can ever read your data. Daily backups are part of the platform.",
  },
  {
    q: "Can I upgrade or downgrade later?",
    a: "Yes. Pricing is monthly or yearly, and you can switch plans at any time. Your data is always portable.",
  },
];

export function FaqSection({
  items,
  id = "faq",
  eyebrow = "FAQ",
  title = "Quick answers.",
  subtitle = "The questions freelancers ask before they hit Start free.",
}: {
  items?: FaqItem[];
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
} = {}) {
  const faqs = items ?? DEFAULT_FAQS;
  const [open, setOpen] = React.useState<number | null>(0);
  const track = useTrack();

  const handleToggle = (i: number) => {
    const willOpen = open !== i;
    setOpen(willOpen ? i : null);
    if (willOpen) {
      track("marketing.faq.opened", {
        question: faqs[i]!.q.slice(0, 100),
        index: i,
      });
    }
  };

  return (
    <Section id={id}>
      <Reveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </Reveal>

      <Reveal className="mx-auto mt-12 max-w-2xl divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => handleToggle(i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-[15px] font-medium transition-colors hover:bg-accent/40"
              >
                {f.q}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              <div
                className={cn(
                  "grid overflow-hidden transition-all duration-300 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
