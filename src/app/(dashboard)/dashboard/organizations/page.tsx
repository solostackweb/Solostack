import * as React from "react";
import Link from "next/link";
import { Plus, Building2, Users, Briefcase, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listUserOrganizationsAction } from "@/features/organizations/actions";
import { format } from "date-fns";

export default async function OrganizationsPage() {
  const result = await listUserOrganizationsAction();
  const orgs = result.ok && result.data ? result.data.organizations : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Manage your teams, billing, and project collaboration.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/organizations/new">
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </Link>
        </Button>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No organizations yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first organization to start collaborating with your team.
            </p>
            <Button asChild className="mt-6">
              <Link href="/dashboard/organizations/new">
                Create Organization
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Link key={org.id} href={`/dashboard/organizations/${org.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{org.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {org.member_count} member{org.member_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">{org.role}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {org.member_count} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      Owner
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}