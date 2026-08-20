import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FilePlus,
  UserPlus,
  Play,
  BellRing,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getBusinessProfile } from "@/features/onboarding/server";
import { ReferralNudge } from "@/features/referral/components/referral-card";

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const ACTIONS: QuickAction[] = [
  {
    label: "Create invoice",
    description: "Bill a client",
    href: "/dashboard/invoices/new",
    icon: FilePlus,
  },
  {
    label: "Add client",
    description: "New contact",
    href: "/dashboard/clients",
    icon: UserPlus,
  },
  {
    label: "Log time",
    description: "Track an entry",
    href: "/dashboard/time",
    icon: Play,
  },
  {
    label: "Send reminder",
    description: "Nudge a payer",
    href: "/dashboard/invoices",
    icon: BellRing,
  },
];

export async function QuickActions() {
  const profile = await getBusinessProfile();
  const referralCode = profile?.referralCode ?? null;

  return (
    <Card className="flex h-full flex-col border-border/60 shadow-sm shadow-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold tracking-tight">Quick actions</CardTitle>
        <CardDescription className="text-xs">One-click shortcuts</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-2 pb-2">
        <ul className="space-y-0.5">
          {ACTIONS.map((a, i) => {
            const Icon = a.icon;
            const isPrimary = i === 0;
            return (
              <li key={a.label}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 hover:bg-accent/60"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-all duration-150",
                      isPrimary
                        ? "bg-gradient-to-br from-primary/15 to-violet-500/10 text-primary ring-primary/20 group-hover:shadow-md group-hover:shadow-primary/15 group-hover:ring-primary/35"
                        : "bg-muted/60 text-muted-foreground ring-border/50 group-hover:bg-primary/8 group-hover:text-primary group-hover:ring-primary/20",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-semibold", isPrimary ? "text-foreground" : "")}>
                      {a.label}
                    </p>
                    <p className="truncate text-micro text-muted-foreground">{a.description}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Referral nudge — shown when the profile has a referral code */}
        {referralCode && (
          <div className="mt-2 px-1 pb-1">
            <ReferralNudge code={referralCode} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
