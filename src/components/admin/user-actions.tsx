"use client";

/**
 * Founder Console - user-detail action sidebar.
 *
 * Renders every Phase-2 admin action that targets a single user.
 *
 * Action tiers (from `@/features/admin/types.ts`):
 *   - routine     -> bare button + onClick
 *   - sensitive   -> TypedConfirmButton (typed text match)
 *   - destructive -> TypedConfirmButton (typed text + 10s cooldown)
 *
 * Each form uses native `<form action={fn}>` posting to the server
 * actions - no client state library, no fetch, no JS-required path.
 * `useFormStatus` would let us disable buttons during pending, but
 * the `setSubmitting` inside TypedConfirmButton already does that.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye,
  KeyRound,
  MailCheck,
  PauseOctagon,
  PlayCircle,
  Gift,
  Trash2,
  Download,
} from "lucide-react";

import {
  adminPasswordResetAction,
  adminForceVerifyEmailAction,
  adminSuspendUserAction,
  adminUnsuspendUserAction,
  adminSoftDeleteUserAction,
  adminCompPlanAction,
  adminExportUserDataAction,
  type AdminActionResult,
} from "@/features/admin/actions";
import { TypedConfirmButton } from "./typed-confirm-button";

interface UserActionsProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    isSuspended: boolean;
    hasRazorpaySubscription: boolean;
  };
}

export function UserActions({ user }: UserActionsProps) {
  const router = useRouter();

  const announce = React.useCallback(
    (res: AdminActionResult<unknown>) => {
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    },
    [router],
  );

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Actions
      </h2>

      <div className="space-y-2 rounded-xl border bg-card shadow-sm shadow-black/[0.03] p-3">
        {/* View as - routine */}
        <form action="/api/admin/view-as/start" method="post">
          <input type="hidden" name="userId" value={user.id} />
          <ActionRow icon={Eye} title="Review mode" hint="Lock writes while reviewing">
            <button
              type="submit"
              className="inline-flex h-7 items-center justify-center rounded-md border px-3 text-xs hover:bg-accent"
            >
              Start
            </button>
          </ActionRow>
        </form>

        {/* Password reset - sensitive */}
        <form
          action={async () => {
            const res = await adminPasswordResetAction(user.id);
            announce(res);
          }}
        >
          <ActionRow
            icon={KeyRound}
            title="Send password reset"
            hint="Supabase recovery email"
          >
            <TypedConfirmButton
              label="Send"
              confirmText={user.email}
              tier="sensitive"
              helper="This emails the user a reset link."
            />
          </ActionRow>
        </form>

        {/* Force email verify - sensitive */}
        <form
          action={async () => {
            const res = await adminForceVerifyEmailAction(user.id);
            announce(res);
          }}
        >
          <ActionRow
            icon={MailCheck}
            title="Force email verify"
            hint="Skip the link for broken inboxes"
          >
            <TypedConfirmButton
              label="Verify"
              confirmText={user.email}
              tier="sensitive"
            />
          </ActionRow>
        </form>

        {/* DPDP data export - sensitive */}
        <form
          action={async () => {
            const res = await adminExportUserDataAction({ userId: user.id });
            if (res.ok && res.data?.signedUrl) {
              toast.success("Export ready - opening signed URL");
              window.open(res.data.signedUrl, "_blank", "noopener,noreferrer");
              router.refresh();
            } else if (!res.ok) {
              toast.error(res.error);
            }
          }}
        >
          <ActionRow
            icon={Download}
            title="Export user data (DPDP)"
            hint="Generates a JSON bundle + 24h signed URL"
          >
            <TypedConfirmButton
              label="Generate export"
              confirmText={user.email}
              tier="sensitive"
            />
          </ActionRow>
        </form>

        {/* Suspend / unsuspend - sensitive */}
        {user.isSuspended ? (
          <form
            action={async () => {
              const res = await adminUnsuspendUserAction(user.id);
              announce(res);
            }}
          >
            <ActionRow
              icon={PlayCircle}
              title="Unsuspend user"
              hint="Lift ban + restore login"
            >
              <TypedConfirmButton
                label="Unsuspend"
                confirmText={user.email}
                tier="sensitive"
              />
            </ActionRow>
          </form>
        ) : (
          <SuspendForm user={user} announce={announce} />
        )}

        {/* Comp plan - sensitive */}
        <CompPlanForm user={user} announce={announce} />

        {/* Soft delete - destructive */}
        <SoftDeleteForm user={user} announce={announce} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ActionRow({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border/40 pb-2 text-xs last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div>
          <div className="font-medium text-foreground">{title}</div>
          {hint ? (
            <div className="text-[11px] text-muted-foreground">{hint}</div>
          ) : null}
        </div>
      </div>
      <div className="sm:shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SuspendForm({
  user,
  announce,
}: {
  user: UserActionsProps["user"];
  announce: (r: AdminActionResult<unknown>) => void;
}) {
  const [reason, setReason] = React.useState("");
  return (
    <form
      action={async () => {
        const res = await adminSuspendUserAction({
          userId: user.id,
          reason: reason.trim() || undefined,
        });
        announce(res);
      }}
    >
      <ActionRow
        icon={PauseOctagon}
        title="Suspend user"
        hint="Block login immediately"
      >
        <div className="flex flex-col items-stretch gap-1.5">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="h-7 rounded border bg-background px-2 text-xs"
          />
          <TypedConfirmButton
            label="Suspend"
            confirmText={user.email}
            tier="sensitive"
            variant="destructive"
          />
        </div>
      </ActionRow>
    </form>
  );
}

function CompPlanForm({
  user,
  announce,
}: {
  user: UserActionsProps["user"];
  announce: (r: AdminActionResult<unknown>) => void;
}) {
  const [plan, setPlan] = React.useState<"pro" | "business">("pro");
  const [days, setDays] = React.useState<number>(30);
  const [reason, setReason] = React.useState("");
  const blocked = user.hasRazorpaySubscription;
  return (
    <form
      action={async () => {
        const res = await adminCompPlanAction({
          userId: user.id,
          plan,
          days,
          reason: reason.trim() || undefined,
        });
        announce(res);
      }}
    >
      <ActionRow
        icon={Gift}
        title="Comp plan"
        hint={
          blocked
            ? "Disabled: user has a live Razorpay subscription"
            : "Manual entitlement; doesn't touch Razorpay"
        }
      >
        <div className="flex flex-col items-stretch gap-1.5">
          <div className="flex gap-1.5">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as "pro" | "business")}
              className="h-7 rounded border bg-background px-1.5 text-xs"
            >
              <option value="pro">pro</option>
              <option value="business">business</option>
            </select>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) || 30)}
              className="h-7 w-16 rounded border bg-background px-1.5 text-xs tabular-nums"
            />
            <span className="self-center text-[11px] text-muted-foreground">
              days
            </span>
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="h-7 rounded border bg-background px-2 text-xs"
          />
          <TypedConfirmButton
            label="Comp"
            confirmText={user.email}
            tier="sensitive"
            disabled={blocked}
          />
        </div>
      </ActionRow>
    </form>
  );
}

function SoftDeleteForm({
  user,
  announce,
}: {
  user: UserActionsProps["user"];
  announce: (r: AdminActionResult<unknown>) => void;
}) {
  const [reason, setReason] = React.useState("");
  return (
    <form
      action={async () => {
        const res = await adminSoftDeleteUserAction({
          userId: user.id,
          reason: reason.trim() || undefined,
        });
        announce(res);
      }}
    >
      <ActionRow
        icon={Trash2}
        title="Soft-delete user"
        hint="Scrubs PII; preserves billing & invoice history"
      >
        <div className="flex flex-col items-stretch gap-1.5">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="h-7 rounded border bg-background px-2 text-xs"
          />
          <TypedConfirmButton
            label="Delete forever"
            confirmText={user.email}
            tier="destructive"
            variant="destructive"
            helper={
              <span>
                Cancels subscription, suppresses email, scrubs PII. Activity
                history (invoices, payments, contracts) is preserved for tax
                compliance.
              </span>
            }
          />
        </div>
      </ActionRow>
    </form>
  );
}
