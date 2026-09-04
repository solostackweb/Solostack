import {
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  FolderKanban,
  MessageSquareText,
} from "lucide-react";

const MILESTONES = [
  { title: "Discovery and content map", meta: "Completed · 12 Aug", done: true },
  { title: "Core workspace build", meta: "In review · due 28 Aug", done: false },
  { title: "Launch and handover", meta: "Starts after approval", done: false },
];

export function ProjectWorkspaceMockup() {
  return (
    <div className="grid min-h-[430px] bg-background text-xs text-foreground sm:grid-cols-[175px_1fr]">
      <aside className="hidden border-r border-border bg-muted/30 p-4 sm:block">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FolderKanban className="h-3.5 w-3.5" />
          </span>
          Stackivo
        </div>
        <p className="mt-8 font-mono text-micro uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
        <nav className="mt-3 space-y-1.5">
          {[
            [FolderKanban, "Projects"],
            [Clock3, "Time"],
            [FileText, "Documents"],
            [CircleDollarSign, "Invoices"],
          ].map(([Icon, label], index) => (
            <div key={label as string} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${index === 0 ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />
              {label as string}
            </div>
          ))}
        </nav>
      </aside>

      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-base font-semibold tracking-tight sm:text-lg">Nexa website launch</p>
              <span className="rounded-full bg-success/10 px-2 py-1 text-micro font-medium text-success">Active</span>
            </div>
            <p className="mt-1 text-muted-foreground">Nexa Labs · Fixed-fee project</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-right">
            <p className="text-micro text-muted-foreground">Delivery</p>
            <p className="mt-0.5 font-mono font-medium">28 Aug 2026</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_.85fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">Delivery progress</p>
                <span className="font-mono text-micro text-primary">2 of 3 stages</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 rounded-full bg-primary" />
              </div>
              <div className="mt-4 space-y-3">
                {MILESTONES.map((milestone) => (
                  <div key={milestone.title} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${milestone.done ? "border-success/30 bg-success/10 text-success" : "border-border bg-background text-muted-foreground"}`}>
                      {milestone.done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    <div>
                      <p className="font-medium">{milestone.title}</p>
                      <p className="mt-0.5 text-micro text-muted-foreground">{milestone.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <LinkedItem icon={FileCheck2} label="Signed contract" value="₹1,80,000" note="Signed 08 Aug" />
              <LinkedItem icon={Clock3} label="Billable time" value="31.5 hours" note="₹63,000 ready" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-primary">Ready for next step</p>
              <p className="mt-2 font-semibold">Create milestone invoice</p>
              <p className="mt-1 leading-5 text-muted-foreground">The signed scope and approved hours are already attached.</p>
              <div className="mt-4 flex items-center justify-between border-t border-primary/15 pt-3">
                <span className="text-muted-foreground">Amount due</span>
                <span className="font-mono font-semibold">₹90,000</span>
              </div>
              <div className="mt-3 rounded-lg bg-primary px-3 py-2 text-center font-medium text-primary-foreground">Review invoice</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                <p className="font-semibold">Latest client update</p>
              </div>
              <p className="mt-2 leading-5 text-muted-foreground">Homepage approved. Move the workspace build into final review.</p>
              <p className="mt-2 font-mono text-micro text-muted-foreground">Today · 11:42 AM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedItem({ icon: Icon, label, value, note }: { icon: typeof FileText; label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-micro font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-mono text-sm font-semibold">{value}</p>
      <p className="mt-1 text-micro text-muted-foreground">{note}</p>
    </div>
  );
}
