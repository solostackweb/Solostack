import * as React from "react";
import Link from "next/link";
import { Calendar, AlertTriangle, FileText, FileSignature } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  info: "bg-primary/10 text-primary ring-primary/20",
  warning: "bg-warning-subtle text-warning-strong ring-warning-subtle",
  destructive: "bg-destructive/10 text-destructive ring-destructive/20",
  muted: "bg-muted text-muted-foreground ring-border",
} as const;

export type ReminderTone = keyof typeof TONE_STYLES;

export interface ReminderItem {
  id: string;
  /** Which icon to show on the left tile. */
  kind: "invoice" | "contract" | "calendar";
  title: string;
  description: string;
  dueLabel: string;
  tone: ReminderTone;
  href: string;
}

const KIND_ICON = {
  invoice: FileText,
  contract: FileSignature,
  calendar: Calendar,
} as const;

export function UpcomingReminders({ items }: { items: ReminderItem[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-bold tracking-tight">Upcoming reminders</CardTitle>
          <CardDescription className="text-sm">
            Scheduled tasks & nudges
          </CardDescription>
        </div>
        <Link
          href="/dashboard/invoices"
          className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Manage →
        </Link>
      </CardHeader>
      <CardContent className="flex-1 px-2 pb-2">
        {items.length === 0 ? (
          <div className="px-2">
            <EmptyState
              icon={Calendar}
              title="Nothing on the radar"
              description="Reminders for overdue invoices and expiring contracts will appear here."
              className="min-h-[220px]"
            />
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((r) => {
              const Icon = KIND_ICON[r.kind] ?? Calendar;
              return (
                <li key={r.id}>
                  <Link
                    href={r.href}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset shadow-sm",
                        TONE_STYLES[r.tone],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {r.description}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs font-medium",
                          r.tone === "warning" && "text-warning-strong",
                          r.tone === "destructive" && "text-destructive",
                          r.tone === "info" && "text-primary",
                          r.tone === "muted" && "text-muted-foreground",
                        )}
                      >
                        {r.dueLabel}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Keep AlertTriangle re-exported just so callers can build their own
// reminder lists without re-importing from lucide directly.
export { AlertTriangle as AlertTriangleIcon };
