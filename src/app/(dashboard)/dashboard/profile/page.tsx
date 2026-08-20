import { redirect } from "next/navigation";
import { CheckCircle2, BadgeCheck, Building2, ShieldCheck, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { PlanCard } from "@/features/billing/components/plan-card";
import { UsageGrid } from "@/features/billing/components/usage-grid";
import { getBillingSubscription } from "@/features/billing/server";
import { getUsageSnapshot } from "@/features/subscription/server";
import type { UsageMetric } from "@/features/subscription/types";
import { requireOnboarded } from "@/features/onboarding/server";
import { getInitials, getDisplayName } from "@/features/profile/utils";
import { getStateName } from "@/features/gst/state-codes";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const TRACKED_METRICS: UsageMetric[] = [
  "clients_created",
  "invoices_created",
  "projects_created",
  "storage_bytes",
];

export default async function ProfilePage() {
  const profile = await requireOnboarded();
  if (!profile) redirect("/login");

  const [subscription, ...usageSnapshots] = await Promise.all([
    getBillingSubscription(),
    ...TRACKED_METRICS.map((m) => getUsageSnapshot(m)),
  ]);

  const usage = TRACKED_METRICS.reduce(
    (acc, metric, i) => {
      acc[metric] = usageSnapshots[i] ?? null;
      return acc;
    },
    {} as Record<UsageMetric, Awaited<ReturnType<typeof getUsageSnapshot>> | null>,
  );

  const displayName = getDisplayName(profile);
  const initials = getInitials(displayName || profile.fullName);
  const businessName =
    profile.businessName ?? profile.legalName ?? profile.fullName;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description="Your identity, GST status, and subscription overview."
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-4 w-4" /> Personal profile
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profile.avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Full name" value={profile.fullName} />
              <Detail label="Phone" value={profile.phone ?? "-"} />
              <Detail label="Role" value={profile.role ?? "-"} />
              <Detail label="Timezone" value={profile.timezone} />
            </div>
            {profile.bio && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                {profile.bio}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" /> Onboarding status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p>Onboarding completed</p>
              <Badge
                variant="secondary"
                className={profile.onboardingCompleted ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}
              >
                {profile.onboardingCompleted ? "Complete" : "In progress"}
              </Badge>
            </div>
            <Detail
              label="Current step"
              value={profile.onboardingStep.replace(/_/g, " ")}
            />
            <Detail
              label="Completed on"
              value={profile.onboardingCompletedAt ?? "-"}
            />
            <Detail
              label="Lifetime clients"
              value={String(profile.lifetimeClientsCreated)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Business identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Detail label="Business" value={businessName} />
            <Detail label="Legal name" value={profile.legalName ?? "-"} />
            <Detail label="Business type" value={profile.businessType ?? "-"} />
            <Detail label="Business email" value={profile.businessEmail ?? "-"} />
            <Detail label="Business phone" value={profile.businessPhone ?? "-"} />
            <Detail label="Website" value={profile.website ?? "-"} />
            <Detail
              label="Address"
              value={formatAddress(profile)}
              multiline
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> GST status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p>GST registered</p>
              <Badge
                variant="secondary"
                className={profile.gstRegistered ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}
              >
                {profile.gstRegistered ? "Registered" : "Not registered"}
              </Badge>
            </div>
            <Detail label="GSTIN" value={profile.gstin ?? "-"} mono />
            <Detail label="PAN" value={profile.pan ?? "-"} mono />
            <Detail
              label="State"
              value={
                profile.stateCode
                  ? `${getStateName(profile.stateCode)} (${profile.stateCode})`
                  : "-"
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4" /> Subscription snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PlanCard subscription={subscription} />
          <UsageGrid snapshots={usage} />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-right text-sm ${mono ? "font-mono" : ""} ${multiline ? "whitespace-pre-line" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function formatAddress(profile: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  country: string;
}): string {
  const parts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.stateCode ? `${getStateName(profile.stateCode)} ${profile.postalCode ?? ""}`.trim() : null,
    profile.country,
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join("\n") : "-";
}
