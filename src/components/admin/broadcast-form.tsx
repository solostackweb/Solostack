"use client";

/**
 * Destructive-tier broadcast composer.
 *
 * Sends one notification row per matched user. Gated with a typed
 * "SEND" confirmation plus cooldown because the action touches many users.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Megaphone, Users } from "lucide-react";

import { adminBroadcastNotificationAction } from "@/features/admin/actions";
import { TypedConfirmButton } from "./typed-confirm-button";

const TYPES = [
  { value: "announcement", label: "Announcement" },
  { value: "incident", label: "Incident" },
  { value: "maintenance", label: "Maintenance" },
] as const;

const TARGETS = [
  { value: "all", label: "Everyone" },
  { value: "free", label: "Free plan" },
  { value: "pro", label: "Pro plan" },
  { value: "business", label: "Business plan" },
] as const;

export function BroadcastForm() {
  const router = useRouter();
  const [type, setType] = React.useState<
    "announcement" | "incident" | "maintenance"
  >("announcement");
  const [target, setTarget] = React.useState<
    "all" | "free" | "pro" | "business"
  >("all");
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");

  return (
    <form
      action={async () => {
        const res = await adminBroadcastNotificationAction({
          type,
          targetPlan: target,
          title: title.trim(),
          message: message.trim() || undefined,
        });
        if (res.ok) {
          toast.success(res.message ?? "Broadcast sent");
          setTitle("");
          setMessage("");
          router.refresh();
        } else {
          toast.error(res.error);
        }
      }}
      className="overflow-hidden rounded-lg border bg-card text-xs shadow-sm"
    >
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <Megaphone className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">New Broadcast</h2>
            <p className="text-micro text-muted-foreground">
              Send an audited in-app notice to a selected customer segment.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-micro uppercase tracking-wider text-muted-foreground">
              Type
            </span>
            <select
              value={type}
              onChange={(e) =>
                setType(
                  e.target.value as
                    | "announcement"
                    | "incident"
                    | "maintenance",
                )
              }
              className="h-9 rounded-lg border bg-background px-2.5"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-micro uppercase tracking-wider text-muted-foreground">
              <Users className="h-3 w-3" />
              Audience
            </span>
            <select
              value={target}
              onChange={(e) =>
                setTarget(e.target.value as "all" | "free" | "pro" | "business")
              }
              className="h-9 rounded-lg border bg-background px-2.5"
            >
              {TARGETS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-wider text-muted-foreground">
            Title <span className="text-muted-foreground/60">(3-140 chars)</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Short, clear title shown in the notification center"
            className="h-10 rounded-lg border bg-background px-3"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-wider text-muted-foreground">
            Message{" "}
            <span className="text-muted-foreground/60">
              (optional - 2000 max)
            </span>
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Add context, links, or the action users should take."
            className="min-h-32 rounded-lg border bg-background px-3 py-2 leading-relaxed"
          />
        </label>

        <div className="rounded-lg border border-warning-subtle bg-warning/[0.04] px-3 py-2">
          <span className="flex items-start gap-2 text-xs text-warning-strong">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            One notification row is created per matched user. This is audited
            and cannot be undone.
          </span>
        </div>

        <TypedConfirmButton
          label="Send broadcast"
          confirmText="SEND"
          tier="destructive"
          variant="destructive"
          disabled={title.trim().length < 3}
          helper={
            <span>
              Type{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono">
                SEND
              </code>{" "}
              to confirm. A 10-second cooldown will apply.
            </span>
          }
        />
      </div>
    </form>
  );
}
