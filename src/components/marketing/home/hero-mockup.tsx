import {
  FileSignature,
  FolderKanban,
  LayoutDashboard,
  Receipt,
  Sparkles,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";

/**
 * Realistic Pulse-dashboard mockup rendered in pure Tailwind — no images.
 * Static by design (server component) so the hero LCP stays instant.
 */
export function HeroMockup() {
  return (
    <div className="flex bg-background text-left" aria-hidden>
      {/* Sidebar */}
      <div className="hidden w-52 shrink-0 flex-col border-r border-border/70 bg-muted/30 p-3 md:flex">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <StackivoMark className="h-6 w-6 rounded-lg" />
          <span className="text-xs font-semibold tracking-tight">Stackivo</span>
        </div>
        <div className="mt-4 space-y-0.5">
          <SidebarItem icon={LayoutDashboard} label="Pulse" active />
          <SidebarItem icon={Users} label="Clients" />
          <SidebarItem icon={FolderKanban} label="Projects" />
          <SidebarItem icon={Receipt} label="Invoices" badge="3" />
          <SidebarItem icon={FileSignature} label="Contracts" />
          <SidebarItem icon={Timer} label="Time" />
          <SidebarItem icon={Wallet} label="Payments" />
        </div>
        <div className="mt-auto rounded-lg border border-primary/15 bg-primary/[0.05] p-3">
          <p className="flex items-center gap-1.5 text-micro font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> Stackivo AI
          </p>
          <p className="mt-1 text-micro leading-relaxed text-muted-foreground">
            2 invoices are overdue. Want me to draft reminders?
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Good morning, Aarav
            </p>
            <p className="text-micro text-muted-foreground">
              August 2026 · 4 active projects
            </p>
          </div>
          <span className="hidden rounded-full bg-primary px-3.5 py-1.5 text-micro font-semibold text-primary-foreground sm:block">
            + New invoice
          </span>
        </div>

        {/* Stat cards */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <Stat label="Outstanding" value="₹1,24,500" delta="3 invoices" />
          <Stat label="Paid this month" value="₹2,86,000" delta="+18% vs Jul" positive />
          <Stat label="Hours tracked" value="96.5h" delta="this month" />
          <Stat label="Active clients" value="12" delta="2 new" positive />
        </div>

        {/* Chart + invoices */}
        <div className="mt-3 grid gap-2.5 sm:gap-3 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Revenue</p>
              <p className="text-micro text-muted-foreground">Last 8 months</p>
            </div>
            <div className="mt-3 flex h-24 items-end gap-1.5 sm:h-28 sm:gap-2">
              {[34, 48, 40, 62, 55, 74, 68, 92].map((h, i) => (
                <div key={i} className="flex h-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-lg",
                      i === 7
                        ? "bg-primary"
                        : "bg-primary/15",
                    )}
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground/70">
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-4">
            <p className="text-xs font-semibold text-foreground">Recent invoices</p>
            <div className="mt-3 space-y-2.5">
              <InvoiceRow name="Nexa Labs" amount="₹48,000" status="Paid" />
              <InvoiceRow name="Karta Studio" amount="₹62,500" status="Sent" />
              <InvoiceRow name="Meera Iyer" amount="₹35,400" status="Overdue" />
              <InvoiceRow name="Bloom D2C" amount="₹78,000" status="Draft" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge ? (
        <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-micro font-semibold text-primary">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  positive,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3 sm:p-3.5">
      <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {value}
      </p>
      <p
        className={cn(
          "mt-0.5 text-micro",
          positive ? "font-medium text-success" : "text-muted-foreground",
        )}
      >
        {delta}
      </p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Paid: "bg-success/10 text-success",
  Sent: "bg-primary/10 text-primary",
  Overdue: "bg-destructive/10 text-destructive",
  Draft: "bg-muted text-muted-foreground",
};

function InvoiceRow({
  name,
  amount,
  status,
}: {
  name: string;
  amount: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-micro font-semibold text-secondary-foreground">
          {name[0]}
        </span>
        <span className="truncate text-micro font-medium text-foreground">{name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-micro text-muted-foreground">{amount}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-micro font-semibold",
            STATUS_STYLES[status],
          )}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
