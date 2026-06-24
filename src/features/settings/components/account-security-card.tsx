"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "@/features/settings/components/settings-section";
import {
  changePasswordAction,
  requestAccountDeletionAction,
  cancelAccountDeletionAction,
  getAccountDeletionStatus,
  type AccountActionResult,
} from "@/features/auth/account-actions";

/**
 * Account security: in-app password change + the DPDP-compliant account
 * deletion flow (30-day grace, then a cron permanently purges the account).
 */
export function AccountSecurityCard() {
  const [pwState, pwAction, pwPending] = React.useActionState<
    AccountActionResult | undefined,
    FormData
  >(changePasswordAction, undefined);

  const [delState, delAction, delPending] = React.useActionState<
    AccountActionResult | undefined,
    FormData
  >(requestAccountDeletionAction, undefined);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [persistedPending, setPersistedPending] = React.useState<
    { scheduledAt: string | null } | null
  >(null);

  // Load any already-pending deletion so a user returning in a later session
  // still sees the "scheduled for deletion — cancel" state.
  React.useEffect(() => {
    let active = true;
    void getAccountDeletionStatus().then((s) => {
      if (active && s.pending) setPersistedPending({ scheduledAt: s.scheduledAt });
    });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (pwState?.ok) toast.success(pwState.message ?? "Password updated.");
    else if (pwState?.error) toast.error(pwState.error);
  }, [pwState]);

  const persistedMessage = persistedPending
    ? `Your account is scheduled for permanent deletion${
        persistedPending.scheduledAt
          ? ` on ${new Date(persistedPending.scheduledAt).toDateString()}`
          : ""
      }. You can cancel any time before then.`
    : null;
  const scheduled = delState?.ok ? delState.message : persistedMessage;

  return (
    <>
      <SettingsSection title="Password">
        <form action={pwAction} className="space-y-3 max-w-md">
          <div className="space-y-1.5">
            <label htmlFor="currentPassword" className="text-sm font-medium">
              Current password
            </label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-sm font-medium">
              New password
            </label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
            {pwState?.fieldErrors?.newPassword ? (
              <p className="text-xs text-destructive">{pwState.fieldErrors.newPassword[0]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
            {pwState?.fieldErrors?.confirmPassword ? (
              <p className="text-xs text-destructive">{pwState.fieldErrors.confirmPassword[0]}</p>
            ) : null}
          </div>
          <Button type="submit" size="sm" disabled={pwPending}>
            {pwPending ? "Updating…" : "Update password"}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection tone="danger" title="Danger zone">
        {scheduled ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{scheduled}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                const res = await cancelAccountDeletionAction();
                setCancelling(false);
                if (res.ok) {
                  toast.success(res.message ?? "Deletion cancelled.");
                  window.location.reload();
                } else {
                  toast.error(res.error ?? "Could not cancel.");
                }
              }}
            >
              {cancelling ? "Cancelling…" : "Cancel deletion"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and personal data. You have a
                30-day window to cancel by signing back in; after that it is
                erased and cannot be recovered. Export anything you need first.
              </p>
            </div>

            {!confirmOpen ? (
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                Delete account
              </Button>
            ) : (
              <form action={delAction} className="space-y-3 max-w-md rounded-md border border-destructive/40 p-3">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    Confirm your password
                  </label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="Leave blank if you signed up with Google" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirmText" className="text-sm font-medium">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm
                  </label>
                  <Input id="confirmText" name="confirmText" autoComplete="off" required />
                </div>
                {delState?.error ? (
                  <p className="text-xs text-destructive">{delState.error}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/5"
                    disabled={delPending}
                  >
                    {delPending ? "Scheduling…" : "Permanently delete"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </SettingsSection>
    </>
  );
}
