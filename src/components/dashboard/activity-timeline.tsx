import * as React from "react";
import {
  Check,
  FileText,
  AlertTriangle,
  UserPlus,
  FileSignature,
  Clock,
  Activity as ActivityIcon,
  Bell,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ActivityRecord } from "@/features/activity/server";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface KindMeta {
  icon: LucideIcon;
  tone: string;
}

/**
 * Map the activity `kind` string (stored in the DB) to an icon + colour.
 * Unknown kinds get a neutral "activity" icon so new kinds added later
 * don't crash the UI.
 */
function kindMeta(kind: string): KindMeta {
  if (kind.startsWith("invoice_paid")) return { icon: Check, tone: "bg-success-subtle text-success-strong ring-success-subtle" };
  if (kind.startsWith("invoice_reminder")) return { icon: Bell, tone: "bg-warning-subtle text-warning-strong ring-warning-subtle" };
  if (kind.startsWith("invoice_overdue")) return { icon: AlertTriangle, tone: "bg-destructive/10 text-destructive ring-destructive/20" };
  if (kind.startsWith("invoice")) return { icon: FileText, tone: "bg-primary/10 text-primary ring-primary/20" };
  if (kind.startsWith("client")) return { icon: UserPlus, tone: "bg-primary/10 text-primary ring-primary/20" };
  if (kind.startsWith("contract") || kind.startsWith("proposal"))
    return { icon: FileSignature, tone: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400" };
  if (kind.startsWith("time") || kind.startsWith("timer"))
    return { icon: Clock, tone: "bg-muted text-muted-foreground ring-border" };
  return { icon: ActivityIcon, tone: "bg-muted text-muted-foreground ring-border" };
}

export function ActivityTimeline({ items }: { items: ActivityRecord[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold tracking-tight">Activity</CardTitle>
        <CardDescription className="text-xs">
          What&apos;s happening in your workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ActivityIcon}
              title="No activity yet"
              description="Activity from invoices, clients, contracts, and time entries will show up here."
            />
          </div>
        ) : (
          // Constrain the timeline to a max height with its own scrollbar
          // so adding more activity rows never stretches the surrounding
          // dashboard grid — siblings stay height-balanced regardless of
          // how busy this column gets.
          <ol className="relative max-h-[320px] space-y-5 overflow-y-auto px-6 py-5 sm:max-h-[420px]">
            {/* Vertical guideline */}
            <span
              className="absolute left-[38px] top-7 h-[calc(100%-2.5rem)] w-px bg-border"
              aria-hidden
            />
            {items.map((item) => {
              const meta = kindMeta(item.kind);
              const Icon = meta.icon;
              return (
                <li key={item.id} className="relative flex gap-3">
                  <span
                    className={cn(
                      "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset shadow-sm",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-sm font-semibold leading-tight">
                      {item.title}
                    </p>
                    {item.message && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
