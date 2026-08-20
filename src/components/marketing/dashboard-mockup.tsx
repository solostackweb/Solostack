import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Users,
  Zap,
} from "lucide-react";

/**
 * Pure-CSS dashboard "screenshot" — no images, themes cleanly in dark
 * mode, weighs nothing. Two floating cards overlap the main panel on
 * desktops to give the composition a premium layered feel.
 */
export function DashboardMockup() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-[0_32px_80px_-16px_hsl(var(--primary)/0.30),0_8px_32px_-12px_rgba(0,0,0,0.25)] ring-1 ring-primary/10">
        <BrowserChrome />

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
          {/* Sidebar — deep violet-black like the real app */}
          <aside className="hidden border-r border-sidebar-border bg-sidebar p-4 md:block">
            <div className="mb-4 flex items-center gap-2 px-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg btn-gradient">
                <Zap className="h-3 w-3 text-white" />
              </span>
              <span className="text-xs font-semibold tracking-tight text-sidebar-foreground">
                Stackivo
              </span>
            </div>
            <div className="space-y-0.5">
              {NAV.map((item, i) => (
                <div
                  key={item.label}
                  className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs ${
                    i === 0
                      ? "bg-sidebar-accent font-medium text-primary"
                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
                  }`}
                >
                  {i === 0 && (
                    <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-primary" />
                  )}
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
              ))}
            </div>
          </aside>

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Welcome back, Aanya</p>
                <h3 className="text-lg font-semibold tracking-tight sm:text-xl">
                  Your week at a glance
                </h3>
              </div>
              <div className="hidden items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Pulse live
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Contracts" value="₹6,80,000" delta="+12%" tone="primary" />
              <Stat label="Paid this month" value="₹3,80,000" delta="+8%" tone="success" />
              <Stat label="Overdue" value="2" delta="-1" tone="warning" />
              <Stat label="Active projects" value="6" delta="+2" tone="info" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
              <RevenueChart />
              <RecentInvoices />
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards — Stripe-style, visible on xl+ */}
      <div className="pointer-events-none absolute -bottom-8 -left-4 hidden w-64 rotate-[-3deg] rounded-lg border border-success/20 bg-card/98 p-3 shadow-xl shadow-success/10 backdrop-blur-sm ring-1 ring-success/15 xl:block xl:-bottom-10 xl:-left-10 xl:w-72">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success ring-1 ring-success/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1">
            <p className="text-micro text-muted-foreground">Payment received</p>
            <p className="text-xs font-semibold">₹84,000 · Pixel &amp; Co.</p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-4 -top-6 hidden w-60 rotate-[3deg] rounded-lg border border-primary/20 bg-card/98 p-3 shadow-xl shadow-primary/10 backdrop-blur-sm ring-1 ring-primary/15 xl:block xl:-right-10 xl:w-72">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Bell className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1">
            <p className="text-micro text-muted-foreground">Contract signed</p>
            <p className="text-xs font-semibold">Lumen Studio · Q4 retainer</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Users, label: "Clients" },
  { icon: FileText, label: "Invoices" },
  { icon: CircleDollarSign, label: "Payments" },
  { icon: CheckCircle2, label: "Contracts" },
];

function BrowserChrome() {
  return (
    <div className="flex h-9 items-center gap-2 border-b bg-muted/40 px-3">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
      </div>
      <div className="ml-2 flex h-5 max-w-[260px] flex-1 items-center rounded border bg-background px-2 text-xs text-muted-foreground">
        app.stackivo.in/dashboard
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "primary" | "success" | "warning" | "info";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
  }[tone];
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-3 ring-1 ring-border/30 transition-colors">
      <p className="text-micro text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
        {value}
      </p>
      <p className={`mt-0.5 inline-flex items-center gap-0.5 text-micro font-medium ${toneClass}`}>
        <ArrowUpRight className="h-3 w-3" />
        {delta}
      </p>
    </div>
  );
}

function RevenueChart() {
  // Faux sparkline showing paid invoice revenue.
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const data = [
    { paid: 60, collected: 30 },
    { paid: 70, collected: 25 },
    { paid: 55, collected: 40 },
    { paid: 80, collected: 18 },
    { paid: 90, collected: 22 },
    { paid: 78, collected: 35 },
  ];
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Revenue</p>
        <div className="flex items-center gap-3 text-micro text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-primary" /> Paid
          </span>
        </div>
      </div>
      <div className="flex h-28 items-end gap-1.5">
        {data.map((d, i) => (
          <div key={months[i]} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t bg-primary/30"
                style={{ height: `${d.collected}%` }}
              />
              <div
                className="w-full rounded-t"
                style={{
                  height: `${d.paid}%`,
                  background: "linear-gradient(to top, hsl(262 83% 58%), hsl(243 75% 62%))",
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{months[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentInvoices() {
  const rows = [
    { num: "INV-0042", client: "Pixel & Co.", amount: "₹84,000", status: "Paid", tone: "success" },
    { num: "INV-0041", client: "Lumen Studio", amount: "₹1,20,000", status: "Sent", tone: "info" },
    { num: "INV-0040", client: "Vertex Media", amount: "₹46,500", status: "Overdue", tone: "warning" },
    { num: "INV-0039", client: "North & Cole", amount: "₹2,10,000", status: "Paid", tone: "success" },
  ] as const;
  const tone = {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
  } as const;
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-3 text-sm font-medium">Recent invoices</p>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.num} className="flex items-center justify-between py-2">
            <div>
              <p className="text-xs font-medium">{r.num}</p>
              <p className="text-micro text-muted-foreground">{r.client}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium">{r.amount}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-micro font-medium ${
                  tone[r.tone]
                }`}
              >
                {r.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
