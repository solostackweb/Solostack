import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  FileSignature,
  HandHeart,
  Share2,
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
  { title: "Projects",     href: "/dashboard/projects", icon: FolderKanban },
  { title: "Invoices",     href: "/dashboard/invoices", icon: FileText },
  { title: "Contracts",    href: "/dashboard/contracts",icon: FileSignature },
  { title: "Welcome Docs", href: "/dashboard/welcome",  icon: HandHeart },
  { title: "Portal",       href: "/dashboard/portal",   icon: Share2,        proRequired: true },
  { title: "Time",         href: "/dashboard/time",     icon: Clock },
  { title: "Pulse",        href: "/dashboard/pulse",    icon: Activity,      proRequired: true },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings",      href: "/dashboard/settings", icon: Settings },
  { title: "Help & support",href: "/help",               icon: LifeBuoy },
];

/** Flat list of every nav item — useful for breadcrumbs and command palette. */
export const allNavItems: NavItem[] = [...primaryNav, ...secondaryNav];
