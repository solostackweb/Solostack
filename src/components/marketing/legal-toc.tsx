"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Auto-generated sticky table of contents for long-form legal / policy
 * pages. Scans the sibling prose container for <h2> elements, assigns
 * stable ids if missing, and highlights the section currently in view.
 *
 * Client-only (needs IntersectionObserver + scroll position), but the
 * page it lives on can still be statically generated — hydration just
 * wires up the interactivity after the static HTML paints.
 *
 * IMPORTANT for the sticky behaviour to actually work: the parent grid
 * cell (the <aside> below) must be allowed to stretch to the full height
 * of the row (i.e. the sibling prose column) — see prose-page.tsx, which
 * intentionally does NOT set `items-start` on the grid. If that grid ever
 * gets `items-start` again, this <aside> shrinks to its own short content
 * height and `sticky` has no room to travel, so it silently stops
 * following the scroll instead of pinning in place.
 */
export function LegalToc({ contentId }: { contentId: string }) {
  const [items, setItems] = React.useState<{ id: string; label: string }[]>(
    [],
  );
  const [activeId, setActiveId] = React.useState<string>("");

  React.useEffect(() => {
    const container = document.getElementById(contentId);
    if (!container) return;

    const headings = Array.from(container.querySelectorAll("h2"));
    const found = headings.map((h) => {
      if (!h.id) h.id = slugify(h.textContent ?? "");
      return { id: h.id, label: h.textContent ?? "" };
    });
    setItems(found);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [contentId]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden lg:block print:hidden">
      <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <p className="mb-3 flex items-center gap-2 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            On this page
          </p>
          <nav className="flex flex-col gap-0.5 text-xs leading-tight">
            {items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  "rounded-lg border-l-2 py-1.5 pl-3 transition-colors",
                  activeId === item.id
                    ? "border-primary bg-background font-medium text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground print:hidden"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save as PDF
        </button>
      </div>
    </aside>
  );
}
