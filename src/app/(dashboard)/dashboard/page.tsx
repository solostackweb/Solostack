import { Suspense } from "react";
import Link from "next/link";
import { FileText, FolderKanban, UserPlus } from "lucide-react";

import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { BusinessCommandCenterLazy } from "@/components/dashboard/business-command-center-lazy";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentClients } from "@/components/dashboard/recent-clients";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { UpcomingReminders } from "@/components/dashboard/upcoming-reminders";
import { AutomationSuggestions } from "@/components/dashboard/automation-suggestions";
import { IvoPreparedActions } from "@/components/dashboard/ivo-prepared-actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCompletenessAlert } from "@/features/onboarding/components/profile-completeness-alert";
import { DashboardSetupChecklist } from "@/components/dashboard/setup-checklist";
import {
  getKpiSnapshot,
  getRecentFeedSnapshot,
  getRecentClientsSnapshot,
  getRemindersSnapshot,
} from "@/features/dashboard/server";
import { getBusinessProfile } from "@/features/onboarding/server";
import { getCurrentSubscription } from "@/features/subscription/server";
import { FreePlanBanner } from "@/components/dashboard/free-plan-banner";
import { getAutomationLiteSnapshot } from "@/features/automation/server";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";


function firstNameOf(
  profile: { fullName: string; displayName?: string | null } | null,
): string {
  const source = profile?.displayName ?? profile?.fullName;
  if (!source) return "back";
  return source.trim().split(/\s+/)[0] ?? "back";
}

// ─── Async streaming sections ────────────────────────────────────────────────

async function KpiSection() {
  const {
    collectedAllTime,
    outstanding,
    overdueAmount,
    activeProjects,
    weeklyBillableSeconds,
    weeklyBillableAmount,
    revenueSeries,
  } = await getKpiSnapshot();
  return (
    <BusinessCommandCenterLazy
      collectedAllTime={collectedAllTime}
      outstanding={outstanding}
      overdueAmount={overdueAmount}
      activeProjects={activeProjects}
      weeklyBillableSeconds={weeklyBillableSeconds}
      weeklyBillableAmount={weeklyBillableAmount}
      revenueSeries={revenueSeries}
    />
  );
}

async function FeedSection() {
  const { recentInvoices, activity } = await getRecentFeedSnapshot();
  return (
    <div className="grid items-start gap-4 md:grid-cols-[1fr_280px] lg:grid-cols-3">
      <div className="lg:col-span-2">
        <RecentInvoices items={recentInvoices} />
      </div>
      <ActivityTimeline items={activity} />
    </div>
  );
}

async function AutomationSection() {
  const { suggestions } = await getAutomationLiteSnapshot();
  return (
    <div className="space-y-4">
      {/* Artifacts Ivo already drafted, awaiting one-click approval. */}
      <IvoPreparedActions />
      <AutomationSuggestions suggestions={suggestions} />
    </div>
  );
}

async function BottomGridSection() {
  const [{ recentClients }, { reminders }] = await Promise.all([
    getRecentClientsSnapshot(),
    getRemindersSnapshot(),
  ]);
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RecentClients items={recentClients} />
      <QuickActions />
      <UpcomingReminders items={reminders} />
    </div>
  );
}

// ─── Skeleton fallbacks ───────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.38fr)]">
        <div className="space-y-5 border-b p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-7 w-36 rounded-full" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3">
                <Skeleton className="mb-3 h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-7 w-36 rounded-full" />
          </div>
          <Skeleton className="h-[260px] w-full rounded-lg sm:h-[310px]" />
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid items-start gap-4 md:grid-cols-[1fr_280px] lg:grid-cols-3">
      <div className="rounded-lg border bg-card p-5 lg:col-span-2">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-5">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="mt-0.5 h-6 w-6 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutomationSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5">
      <Skeleton className="mb-2 h-4 w-44" />
      <Skeleton className="mb-5 h-3 w-72 max-w-full" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    </div>
  );
}

function BottomGridSkeleton() {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5">
          <Skeleton className="mb-4 h-4 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [profile, sub] = await Promise.all([
    getBusinessProfile(),
    getCurrentSubscription(),
  ]);
  const greetingName = firstNameOf(profile);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={`Welcome back, ${greetingName}`}
        description="Your money, work, and next moves in one clear view."
        className="border-b-0 pb-0 sm:pb-0"
        actions={
          <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <Button asChild size="sm" variant="ghost" className="px-2 sm:px-3">
              <Link href="/dashboard/clients?create=1">
                <UserPlus /> <span><span className="hidden sm:inline">New </span>client</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="px-2 sm:px-3">
              <Link href="/dashboard/projects?create=1">
                <FolderKanban /> <span><span className="hidden sm:inline">New </span>project</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-md px-2 sm:px-3"
            >
              <Link href="/dashboard/invoices/new">
                <FileText /> <span><span className="hidden sm:inline">New </span>invoice</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI tiles + revenue chart — fast DB aggregates */}
      <Suspense fallback={<KpiSkeleton />}>
        <KpiSection />
      </Suspense>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        {profile ? (
          <DashboardSetupChecklist
            hasSignature={Boolean(
              profile.signatureType ||
                profile.signatureImageUrl ||
                profile.signatureTextValue ||
                profile.signatureUpdatedAt,
            )}
          />
        ) : null}
        {(!sub || sub.plan === "free") && (
          <FreePlanBanner clientsUsed={profile?.lifetimeClientsCreated ?? 0} />
        )}
      </div>

      {profile ? <ProfileCompletenessAlert profile={profile} /> : null}

      {/* Recent invoices + activity — hydration waterfall */}
      <Suspense fallback={<FeedSkeleton />}>
        <FeedSection />
      </Suspense>

      <Suspense fallback={<AutomationSkeleton />}>
        <AutomationSection />
      </Suspense>

      {/* Recent clients + quick actions + reminders */}
      <Suspense fallback={<BottomGridSkeleton />}>
        <BottomGridSection />
      </Suspense>
    </div>
  );
}
