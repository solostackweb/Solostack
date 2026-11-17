import { Suspense } from "react";
import { CreateOrgForm } from "@/features/organizations/components/create-org-form";

export const metadata = { title: "Create Organization" };

export default function NewOrganizationPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Create organization</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new workspace for your team. You'll be the owner.
        </p>
      </div>
      <Suspense fallback={<CreateOrgFormSkeleton />}>
        <CreateOrgForm />
      </Suspense>
    </div>
  );
}

function CreateOrgFormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded bg-muted" />
      <div className="h-10 w-80 animate-pulse rounded bg-muted" />
      <div className="h-40 w-full animate-pulse rounded border bg-muted" />
      <div className="h-12 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}