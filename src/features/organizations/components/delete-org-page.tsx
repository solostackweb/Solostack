"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2, CheckCircle2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { deleteOrgAction } from "../actions";

interface DeleteOrgPageProps {
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

export function DeleteOrgPage({ initialData, orgId }: DeleteOrgPageProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const { org, member_count, is_owner } = initialData;

  if (!is_owner) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="mt-4 text-lg font-medium">Owner only</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Only the organization owner can delete this organization.
            </p>
            <Button variant="outline" asChild className="mt-6">
              <Link href={`/dashboard/organizations/${orgId}`}>Go back</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirmText !== org.name) {
      toast.error("Please type the organization name to confirm");
      return;
    }

    setDeleting(true);
    const formData = new FormData();
    formData.append("id", orgId);

    const result = await deleteOrgAction(undefined, formData);

    if (result.ok) {
      toast.success("Organization deleted");
      router.push("/dashboard/organizations");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete organization");
    }
    setDeleting(false);
    setShowConfirm(false);
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Delete organization</h1>
        <p className="text-sm text-muted-foreground">
          This action is permanent and cannot be undone.
        </p>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Deleting your organization will permanently remove all data including:
          </CardDescription>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>• {member_count} member{member_count !== 1 ? "s" : ""} and their access</li>
            <li>• All projects, invoices, contracts, and documents</li>
            <li>• Client data and communication history</li>
            <li>• Time entries, costs, and profitability data</li>
            <li>• Branding, settings, and integrations</li>
          </ul>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Type the organization name to confirm deletion:
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirm-name" className="sr-only">
                Organization name
              </Label>
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`Type "${org.name}" to confirm`}
                disabled={deleting}
              />
              <p className="text-xs text-muted-foreground">
                {confirmText && confirmText !== org.name
                  ? "Name does not match"
                  : "Must match exactly"}
              </p>
            </div>
          </div>

          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={deleting || confirmText !== org.name}
                onClick={() => setShowConfirm(true)}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete organization
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{org.name}" and all its data.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowConfirm(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete it"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent          </AlertDialog>
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/organizations/${orgId}`}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}