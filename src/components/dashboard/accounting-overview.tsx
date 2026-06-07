import {
  CircleDashed,
  CircleAlert,
  FolderKanban,
  Wallet,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AccountingOverviewProps {
  collectedAllTime: number;
  outstanding: number;
  overdueAmount: number;
  activeProjects: number;
  weeklyBillableSeconds?: number;
  weeklyBillableAmount?: number;
}

function formatHours(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function AccountingOverview({
  collectedAllTime,
  outstanding,
  overdueAmount,
  activeProjects,
  weeklyBillableSeconds = 0,
  weeklyBillableAmount = 0,
}: AccountingOverviewProps) {
  const overdueShare =
    outstanding > 0 ? Math.min(100, (overdueAmount / outstanding) * 100) : 0;

  return (
    <Card className="border-border/60 shadow-sm shadow-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Business overview
        </CardTitle>
        <CardDescription className="text-[13px]">
          Issued invoices are{" "}
          <span className="font-medium text-foreground/70">receivables</span>,
          not revenue — cash collected is what actually moved into your bank.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="stagger-children grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(165px,1fr))]">
          <Tile
            icon={Wallet}
            label="Collected"
            value={formatINR(collectedAllTime, { compact: true })}
            sub="Paid invoices · all time"
            tone="success"
            featured
          />
          <Tile
            icon={CircleDashed}
            label="Outstanding"
            value={formatINR(outstanding, { compact: true })}
            sub="Issued but unpaid"
            tone="warning"
          />
          <Tile
            icon={CircleAlert}
            label="Overdue"
            value={formatINR(overdueAmount, { compact: true })}
            sub={
              outstanding > 0
                ? `${overdueShare.toFixed(0)}% of outstanding`
                : "Nothing past due"
            }
            tone="danger"
          />
          <Tile
            icon={FolderKanban}
            label="Active projects"
            value={String(activeProjects)}
            sub={activeProjects === 1 ? "1 in flight" : "Currently in flight"}
            tone="default"
          />
          <Tile
            icon={Clock}
            label="This week"
            value={weeklyBillableSeconds > 0 ? formatHours(weeklyBillableSeconds) : "0h"}
            sub={
              weeklyBillableAmount > 0
                ? `${formatINR(weeklyBillableAmount, { compact: true })} billable`
                : "No time logged yet"
            }
            tone="time"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface TileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone: "default" | "success" | "warning" | "danger" | "time";
  featured?: boolean;
}

function Tile({ icon: Icon, label, value, sub, tone, featured }: TileProps) {
  return (
    <div
      className={cn(
        "card-lift flex items-start justify-between gap-3 rounded-xl border p-4 transition-all",
        featured && "col-span-2 lg:col-span-1",
        tone === "default" && "border-border/60 bg-card",
        tone === "success" && "border-emerald-500/15 bg-emerald-500/[0.03]",
        tone === "warning" && "border-amber-500/15 bg-amber-500/[0.03]",
        tone === "danger"  && "border-destructive/15 bg-destructive/[0.03]",
        tone === "time"    && "border-blue-500/15 bg-blue-500/[0.03]",
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="break-words text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {label}
        </p>
        <p className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground/70">{sub}</p>
      </div>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
          tone === "default" && "bg-gradient-to-br from-primary/12 to-blue-500/8 text-primary ring-primary/15",
          tone === "success" && "bg-emerald-500/12 text-emerald-600 ring-emerald-500/18 dark:text-emerald-400",
          tone === "warning" && "bg-amber-500/12 text-amber-600 ring-amber-500/18 dark:text-amber-400",
          tone === "danger"  && "bg-destructive/12 text-destructive ring-destructive/18",
          tone === "time"    && "bg-blue-500/12 text-blue-600 ring-blue-500/18 dark:text-blue-400",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}
