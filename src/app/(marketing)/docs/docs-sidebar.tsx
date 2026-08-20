"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
}

export function DocsSidebar({ items }: { items: NavItem[] }) {
  const [activeId, setActiveId] = React.useState<string>("");

  React.useEffect(() => {
    const observers: IntersectionObserver[] = [];

    // Track the topmost visible section
    const visibleSections = new Map<string, number>();

    const updateActive = () => {
      if (visibleSections.size === 0) return;
      // Pick the section with the highest intersection ratio,
      // or if tied, the one earliest in the page (lowest index)
      let bestId = "";
      let bestRatio = -1;
      let bestOrder = Infinity;

      visibleSections.forEach((ratio, id) => {
        const order = items.findIndex((item) => item.id === id);
        if (ratio > bestRatio || (ratio === bestRatio && order < bestOrder)) {
          bestRatio = ratio;
          bestOrder = order;
          bestId = id;
        }
      });

      if (bestId) setActiveId(bestId);
    };

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visibleSections.set(id, entry.intersectionRatio);
            } else {
              visibleSections.delete(id);
            }
            updateActive();
          });
        },
        {
          rootMargin: "-80px 0px -40% 0px",
          threshold: [0, 0.1, 0.5, 1],
        },
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [items]);

  return (
    <aside className="hidden w-52 shrink-0 lg:block">
      <div className="sticky top-24">
        <p className="mb-3 text-micro font-semibold uppercase tracking-widest text-muted-foreground/60">
          On this page
        </p>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveId(item.id);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/8 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {isActive && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
