import type { LucideIcon } from "lucide-react";
import {
  User,
  Building2,
  Palette,
  FileText,
  Bell,
  Shield,
  CreditCard,
  Monitor,
  Wallet,
  Gift,
  Sparkles,
} from "lucide-react";

export interface SettingsNavItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

export interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

/**
 * The grouped navigation rail for the Settings module.
 * Each `href` maps 1:1 to a route under `src/app/(dashboard)/dashboard/settings/*`.
 */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: "Account",
    items: [
      {
        href: "/dashboard/settings/profile",
        label: "Profile",
        description: "Your personal information",
        icon: User,
      },
      {
        href: "/dashboard/settings/company",
        label: "Company",
        description: "Business details & tax info",
        icon: Building2,
      },
      {
        href: "/dashboard/settings/branding",
        label: "Branding",
        description: "Logo, colors, brand voice",
        icon: Palette,
      },
      {
        href: "/dashboard/settings/invoice",
        label: "Invoice defaults",
        description: "Numbering, terms, tax",
        icon: FileText,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        href: "/dashboard/settings/notifications",
        label: "Notifications",
        description: "Email & in-app alerts",
        icon: Bell,
      },
      {
        href: "/dashboard/settings/security",
        label: "Security",
        description: "Password, 2FA, sessions",
        icon: Shield,
      },
      {
        href: "/dashboard/settings/billing",
        label: "Billing",
        description: "Plan, usage, payment method",
        icon: CreditCard,
      },
      {
        href: "/dashboard/settings/payments",
        label: "Payments",
        description: "Razorpay for client invoices",
        icon: Wallet,
      },
      {
        href: "/dashboard/settings/appearance",
        label: "Appearance",
        description: "Theme & density",
        icon: Monitor,
      },
      {
        href: "/dashboard/settings/ivo",
        label: "Ivo",
        description: "What your assistant remembers",
        icon: Sparkles,
      },
      {
        href: "/dashboard/settings/referral",
        label: "Refer & earn",
        description: "Share Stackivo, get Pro free",
        icon: Gift,
      },
    ],
  },
];

export const ALL_SETTINGS_ITEMS: SettingsNavItem[] =
  SETTINGS_NAV_GROUPS.flatMap((g) => g.items);
