"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Copy,
  Link2,
  Lock,
  RefreshCw,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MEETING_STATUS_LABEL, type Meeting } from "../types";
import {
  cancelMeetingAction,
  completeMeetingAction,
  regenerateMeetingLinkAction,
  updateMeetingNotesAction,
} from "../actions";

/** Join opens shortly before the start and stays open past the end. */
const JOIN_OPEN_MIN = 15;
const JOIN_GRACE_MIN = 30;

function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

/** "in 2 hours" / "3 days ago" — relative time without a date library. */
function relativeLabel(target: number, now: number): string {
  const diff = target - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  return rtf.format(Math.round(diff / day), "day");
}

export function MeetingDetailView({
  meeting,
  clientName,
}: {
  meeting: Meeting;
  clientName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${meeting.publicToken}`
      : `/m/${meeting.publicToken}`;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Something went wrong.");
      return;
    }
    if (res.message) toast.success(res.message);
    router.refresh();
  };

  const startMs = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).getTime()
    : null;
  const joinOpensMs = startMs !== null ? startMs - JOIN_OPEN_MIN * 60_000 : null;
  const joinClosesMs =
    startMs !== null
      ? startMs + meeting.durationMinutes * 60_000 + JOIN_GRACE_MIN * 60_000
      : null;
  const ended = joinClosesMs !== null && now > joinClosesMs;
  const canJoin =
    meeting.status === "confirmed" &&
    joinOpensMs !== null &&
    now >= joinOpensMs &&
    !ended;

  return (
    <div className="space-y-5">
      <PageHeader
        title={meeting.topic}
        description={`${meeting.durationMinutes} minutes${
          clientName ? ` · ${clientName}` : ""
        }`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="h-4 w-4" /> Meetings
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* ---- Main column -------------------------------------------- */}
        <div className="min-w-0 space-y-4">
          {/* When + join */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    STATUS_STYLE[meeting.status],
                  )}
                >
                  {MEETING_STATUS_LABEL[meeting.status]}
                </span>
                {clientName ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {clientName}
                  </span>
                ) : null}
              </div>

              {meeting.status === "confirmed" && meeting.scheduledAt ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {formatSlot(meeting.scheduledAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ended
                        ? "This call has ended."
                        : relativeLabel(
                            new Date(meeting.scheduledAt).getTime(),
                            now,
                          )}{" "}
                      · {meeting.timezone}
                    </p>
                  </div>
                </div>
              ) : meeting.status === "proposed" ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {meeting.mode === "availability"
                      ? "Booking from your live availability"
                      : "Proposed times"}
                  </p>
                  {meeting.mode === "availability" ? (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Your client picks any open slot in your working hours.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {meeting.proposedSlots.map((slot) => (
                        <li key={slot} className="tabular-nums">
                          {formatSlot(slot)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {/* Join */}
              {meeting.status === "confirmed" ? (
                <div className="space-y-2 border-t pt-4">
                  {meeting.meetLink ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        disabled={!canJoin}
                        className={cn(!canJoin && "pointer-events-none opacity-50")}
                      >
                        <a
                          href={meeting.meetLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Video className="h-4 w-4" /> Join Google Meet
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            meeting.meetLink ?? "",
                          );
                          toast.success("Meet link copied.");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy Meet link
                      </Button>
                      {!canJoin ? (
                        <span className="text-xs text-muted-foreground">
                          {ended
                            ? "Call has ended."
                            : `Opens ${JOIN_OPEN_MIN} minutes before the start.`}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        This call has no Meet link — your Google connection was
                        probably unavailable when the client booked.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          run(() =>
                            regenerateMeetingLinkAction({ id: meeting.id }),
                          )
                        }
                        disabled={busy}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Create Meet link
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <NotesCard meeting={meeting} />
        </div>

        {/* ---- Side column --------------------------------------------- */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Client link</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Private booking page for this call.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copy}>
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {meeting.status === "proposed" || meeting.status === "confirmed" ? (
            <Card>
              <CardContent className="flex flex-col gap-2 p-5">
                <h2 className="text-sm font-semibold">Actions</h2>
                {meeting.status === "confirmed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      run(() => completeMeetingAction({ id: meeting.id }))
                    }
                    disabled={busy}
                  >
                    <Check className="h-4 w-4" /> Mark done
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start text-destructive"
                  onClick={() =>
                    run(() => cancelMeetingAction({ id: meeting.id }))
                  }
                  disabled={busy}
                >
                  <X className="h-4 w-4" /> Cancel meeting
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Two notes fields that must never be confused with each other: the brief the
 * client reads on the booking page, and the freelancer's own notes. Each saves
 * independently so one can't blank the other.
 */
function NotesCard({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [brief, setBrief] = React.useState(meeting.notes ?? "");
  const [priv, setPriv] = React.useState(meeting.privateNotes ?? "");
  const [savingBrief, setSavingBrief] = React.useState(false);
  const [savingPriv, setSavingPriv] = React.useState(false);

  const briefDirty = brief !== (meeting.notes ?? "");
  const privDirty = priv !== (meeting.privateNotes ?? "");

  const save = async (
    which: "brief" | "private",
    setSaving: (v: boolean) => void,
  ) => {
    setSaving(true);
    const res = await updateMeetingNotesAction(
      which === "brief"
        ? { id: meeting.id, notes: brief }
        : { id: meeting.id, privateNotes: priv },
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved.");
    router.refresh();
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Client brief</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Shown to your client on the booking page and included on the
            calendar event.
          </p>
          <Textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={3}
            placeholder="Anything the client should know before the call."
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => save("brief", setSavingBrief)}
              disabled={savingBrief || !briefDirty}
            >
              {savingBrief ? "Saving…" : "Save brief"}
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t pt-5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Private notes</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Only you can see these. Agenda before the call, outcomes and
            follow-ups after.
          </p>
          <Textarea
            value={priv}
            onChange={(event) => setPriv(event.target.value)}
            rows={6}
            placeholder="Agenda, decisions, next steps…"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => save("private", setSavingPriv)}
              disabled={savingPriv || !privDirty}
            >
              {savingPriv ? "Saving…" : "Save notes"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
