"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Reveal } from "./motion";
import { cn } from "@/lib/utils";
import { useTrack } from "@/lib/analytics/track";
import { DEFAULT_FAQS, type FaqItem } from "./faq-data";

export type { FaqItem } from "./faq-data";

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
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-sm font-medium transition-colors hover:bg-accent/40"
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
