"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  approveAndSendPreparedActionAction,
  refreshIvoPreparedActionsAction,
  resolveIvoPreparedActionAction,
  type IvoPreparedAction,
} from "@/features/ai-workflows/prepared-actions";

const TONE_STYLES = {
  info: "border-primary/20 bg-primary/5",
  warning: "border-amber-500/25 bg-amber-500/10",
  danger: "border-destructive/25 bg-destructive/10",
} as const;

/**
 * The approval inbox: artifacts Ivo already prepared (payment reminders,
 * lead replies, follow-ups) awaiting one-click approval. Refreshes itself
 * after mount so the dashboard render is never blocked by generation.
 */
export function IvoPreparedActions() {
  const [actions, setActions] = React.useState<IvoPreparedAction[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await refreshIvoPreparedActionsAction();
      if (cancelled) return;
      setActions(res.ok ? res.data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolve = React.useCallback(
    async (id: string, resolution: "approved" | "dismissed") => {
      setBusyId(id);
      const res = await resolveIvoPreparedActionAction({ id, resolution });
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      setActions((current) => (current ?? []).filter((action) => action.id !== id));
      return true;
    },
    [],
  );

  const handleApproveAndSend = React.useCallback(
    async (action: IvoPreparedAction) => {
      setBusyId(action.id);
      const res = await approveAndSendPreparedActionAction({ id: action.id });
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setActions((current) => (current ?? []).filter((item) => item.id !== action.id));
      toast.success(`Sent to ${action.recipientName ?? action.recipientEmail}. Replies come to your inbox.`);
    },
    [],
  );

  const handleOpenInMailApp = React.useCallback(
    async (action: IvoPreparedAction) => {
      // Hand the draft to the user's own mail client instead of sending
      // through Stackivo — approving either way, never sending silently.
      if (action.recipientEmail) {
        const mailto = `mailto:${encodeURIComponent(action.recipientEmail)}?subject=${encodeURIComponent(
          action.subject,
        )}&body=${encodeURIComponent(action.body)}`;
        window.open(mailto, "_blank", "noopener");
      } else {
        await navigator.clipboard.writeText(
          action.subject ? `${action.subject}\n\n${action.body}` : action.body,
        );
        toast.success("Draft copied — no email on file for this recipient.");
      }
      await resolve(action.id, "approved");
    },
    [resolve],
  );

  const handleCopy = React.useCallback(async (action: IvoPreparedAction) => {
    await navigator.clipboard.writeText(
      action.subject ? `${action.subject}\n\n${action.body}` : action.body,
    );
    toast.success("Draft copied.");
  }, []);

  // Nothing prepared and nothing loading → render nothing; the dashboard
  // stays clean instead of showing an empty shell.
  if (actions !== null && actions.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
          <Sparkles className="h-4 w-4 text-primary" />
          Ready for your approval
        </CardTitle>
        <CardDescription className="text-xs">
          Ivo already drafted these. Review, then send from your own email — nothing goes out without you.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {actions === null ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            Checking what can be prepared…
          </p>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => {
              const open = openId === action.id;
              return (
                <div
                  key={action.id}
                  className={cn(
                    "rounded-xl border p-3.5 transition-colors",
                    TONE_STYLES[action.tone],
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => setOpenId(open ? null : action.id)}
                    aria-expanded={open}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">
                        {action.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>

                  {open ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-lg border bg-background/80 p-3">
                        {action.subject ? (
                          <p className="text-xs font-semibold">
                            {action.subject}
                          </p>
                        ) : null}
                        <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {action.body}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {action.recipientEmail ? (
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            disabled={busyId === action.id}
                            onClick={() => handleApproveAndSend(action)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {busyId === action.id ? "Sending…" : "Approve & send"}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant={action.recipientEmail ? "outline" : "default"}
                          className="h-8 gap-1.5 text-xs"
                          disabled={busyId === action.id}
                          onClick={() => handleOpenInMailApp(action)}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {action.recipientEmail ? "Open in mail app" : "Approve & copy"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => handleCopy(action)}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs text-muted-foreground"
                          disabled={busyId === action.id}
                          onClick={() => resolve(action.id, "dismissed")}
                        >
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
