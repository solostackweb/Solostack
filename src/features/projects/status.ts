/**
 * Single source of truth for the project/clientflow lifecycle.
 *
 * Adding a status requires three coordinated edits:
 *   1. The DB CHECK constraint (`supabase/migrations/00XX_*`)
 *   2. The `ProjectStatusRow` union in `@/lib/supabase/types`
 *   3. The entry below
 *
 * Every piece of UI (chips, dropdowns, kanban columns, the timeline)
 * reads from `PROJECT_STATUS_CONFIG` so they all stay in lock-step.
 */

import type { ProjectStatusRow } from "@/lib/supabase/types";

export interface ProjectStatusConfig {
  /** Display label. Title case. */
  label: string;
  /** One-line description used inside the picker dropdown. */
  description: string;
  /** Tailwind classes for the chip background + foreground + ring. */
  chipClass: string;
  /** Tailwind class for the small status dot. */
  dotClass: string;
  /** Order in pickers and the kanban board. Lower = earlier. */
  order: number;
  /** True for statuses that should be hidden from the default kanban view. */
  hideFromKanban?: boolean;
  /** Terminal state - won't be the source of further automated transitions. */
  terminal?: boolean;
  /** Whether transitioning into this state should fire a notification. */
  notifyOnEnter?: boolean;
  /** Active animation cue ("live" dot ping) for this status. */
  pulse?: boolean;
}

/**
 * Ordered registry. The order here drives PROJECT_STATUSES,
 * PROJECT_STATUS_LABEL, and the kanban column order.
 */
export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatusRow,
  ProjectStatusConfig
> = {
  lead: {
    label: "Lead",
    description: "Prospect - not yet a committed engagement.",
    chipClass: "bg-muted text-muted-foreground ring-muted-foreground/20",
    dotClass: "bg-muted-foreground/60",
    order: 10,
  },
  planning: {
    label: "Planning",
    description: "Discovery, scoping, and pre-work.",
    chipClass:
      "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-400",
    dotClass: "bg-violet-500",
    order: 20,
  },
  proposal_sent: {
    label: "Proposal sent",
    description: "Commercial proposal is with the client.",
    chipClass:
      "bg-indigo-500/10 text-indigo-700 ring-indigo-500/20 dark:text-indigo-400",
    dotClass: "bg-indigo-500",
    order: 30,
    notifyOnEnter: true,
  },
  contract_sent: {
    label: "Contract sent",
    description: "Agreement is ready for client signature.",
    chipClass:
      "bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
    order: 40,
    notifyOnEnter: true,
  },
  active: {
    label: "Active",
    description: "Work is in flight.",
    chipClass: "bg-primary/10 text-primary ring-primary/20",
    dotClass: "bg-primary",
    order: 50,
    pulse: true,
  },
  waiting_on_client: {
    label: "Waiting on client",
    description: "Blocked - pending client input or approval.",
    chipClass:
      "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
    dotClass: "bg-amber-500",
    order: 60,
    notifyOnEnter: true,
  },
  revision: {
    label: "Revision",
    description: "Reviewed - changes are being applied.",
    chipClass:
      "bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:text-orange-400",
    dotClass: "bg-orange-500",
    order: 70,
  },
  review: {
    label: "Review",
    description: "Delivered - under client review.",
    chipClass:
      "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400",
    dotClass: "bg-sky-500",
    order: 80,
  },
  completed: {
    label: "Completed",
    description: "Done - billing and wrap-up may still be pending.",
    chipClass:
      "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    order: 90,
    notifyOnEnter: true,
  },
  invoiced: {
    label: "Invoiced",
    description: "Invoice has been sent for this engagement.",
    chipClass:
      "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-400",
    dotClass: "bg-blue-500",
    order: 100,
    notifyOnEnter: true,
  },
  paid: {
    label: "Paid",
    description: "Payment is complete and the project can be wrapped up.",
    chipClass:
      "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    order: 110,
    terminal: true,
    notifyOnEnter: true,
  },
  on_hold: {
    label: "On hold",
    description: "Paused - to be resumed later.",
    chipClass:
      "bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300",
    dotClass: "bg-amber-500",
    order: 120,
  },
  cancelled: {
    label: "Cancelled",
    description: "Engagement terminated before completion.",
    chipClass:
      "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-400",
    dotClass: "bg-rose-500",
    order: 130,
    hideFromKanban: true,
    terminal: true,
    notifyOnEnter: true,
  },
  archived: {
    label: "Archived",
    description: "Out of active rotation - kept for records.",
    chipClass:
      "bg-muted text-muted-foreground/80 ring-muted-foreground/20 line-through decoration-muted-foreground/50",
    dotClass: "bg-muted-foreground/40",
    order: 140,
    hideFromKanban: true,
    terminal: true,
    notifyOnEnter: true,
  },
};

/** Ordered list of every status. Drives pickers + status filters. */
export const PROJECT_STATUSES: ProjectStatusRow[] = (
  Object.entries(PROJECT_STATUS_CONFIG) as Array<
    [ProjectStatusRow, ProjectStatusConfig]
  >
)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([k]) => k);

/** Just the kanban-visible statuses, ordered. */
export const PROJECT_KANBAN_STATUSES: ProjectStatusRow[] = PROJECT_STATUSES.filter(
  (s) => !PROJECT_STATUS_CONFIG[s].hideFromKanban,
);

/**
 * Back-compat label lookup. Prefer reading from PROJECT_STATUS_CONFIG
 * directly in new code so you also get the chip class and dot class.
 */
export const PROJECT_STATUS_LABEL: Record<ProjectStatusRow, string> =
  Object.fromEntries(
    PROJECT_STATUSES.map((s) => [s, PROJECT_STATUS_CONFIG[s].label]),
  ) as Record<ProjectStatusRow, string>;

/**
 * Whether a transition into `to` should fire an in-app notification.
 * Centralised here so server code doesn't need to know which states are
 * interesting - the registry decides.
 */
export function shouldNotifyOnEnter(to: ProjectStatusRow): boolean {
  return !!PROJECT_STATUS_CONFIG[to].notifyOnEnter;
}
