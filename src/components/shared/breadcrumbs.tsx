"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { allNavItems } from "@/constants/navigation";

interface Crumb {
  label: string;
  href: string;
}

function titleCase(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Matches standard UUID v1–v5 format. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Routes that live at the top level but belong under the Documents hub. A
 * "Documents" crumb is injected before them so users can navigate back.
 */
const DOCUMENTS_CRUMB: Crumb = { label: "Documents", href: "/dashboard/documents" };
const PARENT_CRUMBS: Record<string, Crumb> = {
  "/dashboard/proposals": DOCUMENTS_CRUMB,
  "/dashboard/contracts": DOCUMENTS_CRUMB,
  "/dashboard/welcome": DOCUMENTS_CRUMB,
  "/dashboard/questionnaires": DOCUMENTS_CRUMB,
  "/dashboard/lead-forms": DOCUMENTS_CRUMB,
};

/**
 * Derives breadcrumbs from the current pathname. Uses the nav constants to
 * resolve known labels (e.g., "pulse" → "Pulse") and title-cases the rest.
 * UUID segments are skipped — the parent route name gives sufficient context.
 */
function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: Crumb[] = [];
  let acc = "";

  for (const seg of segments) {
    acc += `/${seg}`;

    // Skip route-group prefixes if they ever leak through
    if (seg.startsWith("(") && seg.endsWith(")")) continue;

    // Skip UUID segments — showing the parent route name is sufficient context
    if (UUID_RE.test(seg)) continue;

    // Inject a hub crumb (e.g., Documents) for sections that live at the top
    // level, so the trail can lead back to the hub.
    const parent = PARENT_CRUMBS[acc];
    if (parent && !crumbs.some((c) => c.href === parent.href)) {
      crumbs.push(parent);
    }

    const known = allNavItems.find((item) => item.href === acc);
    const label = known ? known.title : titleCase(decodeURIComponent(seg));

    crumbs.push({ label, href: acc });
  }

  return crumbs;
}

interface BreadcrumbsProps {
  className?: string;
  /** Optionally override the auto-derived crumbs (e.g., for dynamic detail pages) */
  items?: Crumb[];
}

export function Breadcrumbs({ className, items }: BreadcrumbsProps) {
  const pathname = usePathname();
  const crumbs = items ?? buildCrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center text-sm", className)}
    >
      <ol className="flex items-center gap-1.5">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground/60"
                  aria-hidden
                />
              )}
              {isLast ? (
                <span className="font-semibold text-foreground">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
