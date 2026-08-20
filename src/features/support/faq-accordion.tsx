"use client";

/**
 * FaqAccordion
 *
 * Simple client-side accordion for the in-app help page FAQ sections.
 * No external radix accordion dep — pure React state to keep bundle
 * lightweight. Each section gets its own instance so sections don't
 * interfere with each other.
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  /** Used to generate unique IDs for a11y attributes. */
  sectionId: string;
}

export function FaqAccordion({ items, sectionId }: FaqAccordionProps) {
  const [open, setOpen] = React.useState<number | null>(null);

  const toggle = (i: number) => setOpen((prev) => (prev === i ? null : i));

  return (
    <div className="divide-y rounded-lg border bg-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `faq-${sectionId}-${i}`;
        return (
          <div key={i}>
            <button
              id={`${id}-trigger`}
              aria-expanded={isOpen}
              aria-controls={`${id}-content`}
              onClick={() => toggle(i)}
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
            >
              <ChevronDown
                className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
              <span className="flex-1 text-sm font-medium leading-snug">
                {item.q}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`${id}-content`}
                  role="region"
                  aria-labelledby={`${id}-trigger`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-4 pb-4 pl-11 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
