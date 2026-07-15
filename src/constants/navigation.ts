import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FolderKanban,
  FilePlus2,
  Files,
  BookTemplate,
  FileText,
  FileSignature,
  BookOpen,
  CalendarClock,
  Workflow,
  Clock,
  Activity,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /**
   * When true, this nav item is locked behind a paid plan. The sidebar
   * renders a Pro badge next to the title for free-plan users.
   * Navigating still works — the page itself enforces the gate.
   */
  proRequired?: true;
}

export const primaryNav: NavItem[] = [
  { title: "Dashboard",    href: "/dashboard",          icon: LayoutDashboard },
  { title: "Clients",      href: "/dashboard/clients",  icon: Users },
  { title: "Lead Forms",   href: "/dashboard/lead-forms", icon: ClipboardList },
  { title: "Projects",     href: "/dashboard/projects", icon: FolderKanban },
  { title: "Documents",    href: "/dashboard/documents", icon: Files },
  { title: "Proposals",    href: "/dashboard/proposals",icon: FilePlus2 },
  { title: "Templates",    href: "/dashboard/templates", icon: BookTemplate },
  { title: "Invoices",     href: "/dashboard/invoices", icon: FileText },
  { title: "Contracts",    href: "/dashboard/contracts",icon: FileSignature },
  { title: "Welcome Docs", href: "/dashboard/welcome",  icon: BookOpen },
  { title: "Meetings",     href: "/dashboard/meetings", icon: CalendarClock },
  { title: "Portal",       href: "/dashboard/portal",   icon: Workflow,      proRequired: true },
  { title: "Time",         href: "/dashboard/time",     icon: Clock,         proRequired: true },
  { title: "Pulse",        href: "/dashboard/pulse",    icon: Activity,      proRequired: true },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings",      href: "/dashboard/settings", icon: Settings },
  { title: "Help & support",href: "/help",               icon: LifeBuoy },
];

/** Flat list of every nav item — useful for breadcrumbs and command palette. */
export const allNavItems: NavItem[] = [...primaryNav, ...secondaryNav];
