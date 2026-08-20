import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workflow, ArrowRight, MailQuestion } from "lucide-react";
import { listPortalsForCurrentUser } from "@/features/portals/server";
import { portalClientHome } from "@/features/portals/routes";
import { BRAND_PRIMARY } from "@/config/brand-colors";

export const metadata = { title: "Your portals" };
export const dynamic = "force-dynamic";

export default async function ClientPortalIndexPage() {
  const { ownedPortals, memberPortals } = await listPortalsForCurrentUser();
  const all = [...memberPortals, ...ownedPortals];
  // De-duplicate (a freelancer testing their own portal would otherwise
  // see it twice).
  const seen = new Set<string>();
  const portals = all.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Most clients are in exactly one portal — the one their freelancer
  // shared with them. Skip the picker screen entirely in that case and
  // drop them straight into the workspace. The picker remains as a
  // fallback for clients (or freelancers viewing client-side) who happen
  // to be in more than one.
  if (portals.length === 1) {
    redirect(portalClientHome(portals[0]!.id));
  }

  if (portals.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-lg border bg-card p-6 text-center sm:p-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Workflow className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          You don&apos;t have a portal yet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          When a freelancer or agency invites you to their workspace,
          you&apos;ll find it here. Invitations are sent by email.
        </p>
        <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-muted/40 p-3 text-left">
          <MailQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Looking for an invite? Check your inbox (and spam folder) for an
            email from your freelancer, then tap the &ldquo;Accept
            invitation&rdquo; button inside it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Pick a workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re in {portals.length} client workspaces. Tap one to
          see contracts, invoices, files, and updates.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {portals.map((p) => (
          <Link key={p.id} href={portalClientHome(p.id)} className="group">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="h-9 w-9 shrink-0 rounded-lg"
                    style={{ background: p.brand_color ?? BRAND_PRIMARY }}
                    aria-hidden
                  />
                  <Badge variant="outline" className="capitalize text-micro">
                    {p.status}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm font-semibold leading-snug">
                  {p.name}
                </p>
                <span className="inline-flex items-center gap-1 text-micro text-muted-foreground transition group-hover:text-foreground">
                  Open workspace <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
