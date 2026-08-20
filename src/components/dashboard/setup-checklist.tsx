"use client";

/**
 * Dashboard setup checklist.
 *
 * Surfaces the remaining setup tasks that used to gate onboarding
 * (invoice preferences and signature) as a friendly, dismissable card on
 * the dashboard home. Each item has its own deep-link to the relevant
 * settings area.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  PenLine,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";

const DISMISS_KEY = "stackivo:dashboard:setup_checklist_dismissed";
const INVOICE_VISITED_KEY = "stackivo:dashboard:invoice_prefs_visited";

interface Props {
  /** True when the user already has a saved signature. */
  hasSignature: boolean;
}

export function DashboardSetupChecklist({ hasSignature }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [invoiceVisited, setInvoiceVisited] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
      setInvoiceVisited(localStorage.getItem(INVOICE_VISITED_KEY) === "1");
    } catch {
      // ignore - localStorage unavailable
    }
  }, []);

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const markInvoiceVisited = () => {
    setInvoiceVisited(true);
    try {
      localStorage.setItem(INVOICE_VISITED_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!mounted || dismissed) return null;

  const items: ChecklistItem[] = [
    {
      label: "Set your invoice defaults",
      description:
        "Prefix, default due days, and footer notes used on every invoice you send.",
      href: "/dashboard/settings/invoice",
      icon: <FileText className="h-4 w-4" />,
      done: invoiceVisited,
      onClick: markInvoiceVisited,
    },
    {
      label: "Add your signature",
      description: "Draw, type, or upload. It appears on every PDF and contract.",
      href: "/dashboard/settings/profile#signature",
      icon: <PenLine className="h-4 w-4" />,
      done: hasSignature,
    },
  ];

  const remaining = items.filter((i) => !i.done).length;
  if (remaining === 0) return null;

  const total = items.length;
  const done = total - remaining;
  const percent = Math.round((done / total) * 100);

  return (
    <div>
        {!expanded ? (
          <div className="flex min-h-14 items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2.5">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex flex-1 items-center gap-3 text-left"
              aria-expanded={false}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-micro font-bold tabular-nums text-primary-foreground ring-2 ring-background">
                  {remaining}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  Finish your workspace
                </p>
                <p className="truncate text-micro text-muted-foreground">
                  {remaining} {remaining === 1 ? "task" : "tasks"} left ·{" "}
                  {percent}% done
                </p>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            <button
              type="button"
              aria-label="Dismiss setup checklist"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <ChecklistFullCard
            items={items}
            done={done}
            total={total}
            percent={percent}
            remaining={remaining}
            onDismiss={onDismiss}
            collapsible
            onCollapse={() => setExpanded(false)}
          />
        )}
    </div>
  );
}

interface ChecklistItem {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  done: boolean;
  onClick?: () => void;
}

interface FullCardProps {
  items: ChecklistItem[];
  done: number;
  total: number;
  percent: number;
  remaining: number;
  onDismiss: () => void;
  collapsible?: boolean;
  onCollapse?: () => void;
}

function ChecklistFullCard({
  items,
  done,
  total,
  percent,
  remaining,
  onDismiss,
  collapsible,
  onCollapse,
}: FullCardProps) {
  return (
    <Card className="relative overflow-hidden border-border/70 p-4 sm:p-5">
      <button
        type="button"
        aria-label="Dismiss setup checklist"
        onClick={onDismiss}
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="text-micro font-semibold uppercase tracking-widest text-muted-foreground">
            Finish setting up
          </span>
          <span className="text-micro tabular-nums text-muted-foreground">
            {done} / {total}
          </span>
        </div>
        <h3 className="mt-1 text-base font-semibold tracking-tight">
          {remaining === 1
            ? "One more thing and you're fully set up."
            : `${remaining} quick things to wrap up your setup.`}
        </h3>

        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ul className="mt-5 space-y-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={item.onClick}
                aria-disabled={item.done}
                className={`group flex items-start gap-3 rounded-lg border bg-background/60 p-3 transition hover:border-primary/40 hover:bg-background ${
                  item.done ? "opacity-60" : ""
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${
                    item.done ? "text-success-strong" : "text-muted-foreground"
                  }`}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      item.done ? "line-through" : ""
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                {!item.done ? (
                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition group-hover:text-foreground">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        {collapsible ? (
          <button
            type="button"
            onClick={onCollapse}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden />
            Show less
          </button>
        ) : null}
      </div>
    </Card>
  );
}
