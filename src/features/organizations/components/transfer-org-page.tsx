"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Key, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { transferOwnershipAction } from "../actions";

interface TransferOrgPageProps {
  initialData: {
    org: {
      id: string;
      name: string;
      slug: string;
      owner_user_id: string;
      brand_color: string | null;
      brand_tagline: string | null;
      logo_url: string | null;
    };
    member_count: number;
    user_role: string;
    is_owner: boolean;
  };
  orgId: string;
}

export function TransferOrgPage({ initialData, orgId }: TransferOrgPageProps) {
  const router = useRouter();
  const [transferConfirm, setTransferConfirm] = React.useState<string | null>(null);
  const [transferring, setTransferring] = React.useState(false);

  const { org, members, is_owner } = initialData;

  if (!is_owner) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="mt-4 text-lg font-medium">Owner only</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Only the organization owner can transfer ownership.
            </p>
            <Button variant="outline" asChild className="mt-6">
              <Link href={`/dashboard/organizations/${orgId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to organization
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter eligible members (admins who aren't the current owner)
  const eligibleMembers = (members || []).filter(
    (m) => m.role === "admin" && m.user_id !== org.owner_user_id
  );

  const handleTransfer = async (newOwnerId: string) => {
    setTransferring(true);
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("newOwnerId", newOwnerId);

    const result = await transferOwnershipAction(undefined, formData);

    if (result.ok) {
      toast.success("Ownership transferred");
      router.push(`/dashboard/organizations/${orgId}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setTransferring(false);
    setTransferConfirm(null);
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Transfer ownership</h1>
        <p className="text-sm text-muted-foreground">
          Make another member the organization owner. You will become an admin.
        </p>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Transfer Ownership</CardTitle>
          </div>
          <CardDescription>
            This will make another member the organization owner. You will be demoted to admin.
            This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {eligibleMembers.length === 0 ? (
            <div className="text-center py-8">
              <Key className="mx-auto h-10 w-10 text-muted-foreground" />
              <h4 className="mt-2 text-lg font-medium">No eligible members</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Only admin members can become owners. Promote a member to admin first.
              </p>
              <Button variant="outline" asChild className="mt-4">
                <Link href={`/dashboard/organizations/${orgId}/settings?tab=members`}>
                  Manage members
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {eligibleMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="text-sm font-medium">
                          {member.user_name?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.user_name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">{member.user_email}</p>
                        <Badge variant="secondary" className="mt-1 text-xs">Admin</Badge>
                      </div>
                    </div>
                    <AlertDialog open={transferConfirm === member.id} onOpenChange={(open) => setTransferConfirm(open ? member.id : null)}>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-end">
                          {transferConfirm === member.id ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                              Confirm transfer to {member.user_name}
                            </>
                          ) : (
                            "Transfer"
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Transfer ownership to {member.user_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            They will become the new owner. You will become an admin. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setTransferConfirm(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleTransfer(member.user_id)}
                            disabled={transferring}
                          >
                            {transferring ? "Transferring…" : "Yes, transfer"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/organizations/${orgId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}