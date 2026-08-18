"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createMeetingAction } from "../actions";
import { VIDEO_PROVIDER_LABEL, type VideoProvider } from "../types";

interface ClientOption {
  id: string;
  name: string;
}

/** Which video providers this deployment / user can actually use right now. */
export interface VideoProviderAvailability {
  daily: boolean;
  googleConfigured: boolean;
  googleConnected: boolean;
  zoom: boolean;
}

interface Prefill {
  topic?: string;
  clientId?: string | null;
  projectId?: string | null;
  proposalId?: string | null;
  contractId?: string | null;
}

export function MeetingNewView({
  clients,
  prefill,
  availabilityEnabled,
  videoProviders,
}: {
  clients: ClientOption[];
  prefill: Prefill;
  availabilityEnabled: boolean;
  videoProviders: VideoProviderAvailability;
}) {
  /**
   * Pre-selection mirrors what the app did before this picker existed, so an
   * unchanged habit produces an unchanged result: availability bookings got a
   * Meet link, everything else an in-app Daily room.
   */
  const defaultProviderFor = React.useCallback(
    (nextMode: "slots" | "availability"): VideoProvider => {
      if (nextMode === "availability" && videoProviders.googleConnected) {
        return "google_meet";
      }
      if (videoProviders.daily) return "daily";
      if (videoProviders.googleConnected) return "google_meet";
      return "manual_link";
    },
    [videoProviders],
  );
  const [topic, setTopic] = React.useState(prefill.topic ?? "");
  const [duration, setDuration] = React.useState(30);
  const [notes, setNotes] = React.useState("");
  const [clientId, setClientId] = React.useState(prefill.clientId ?? "");
  const [slots, setSlots] = React.useState<string[]>(["", "", ""]);
  const [mode, setMode] = React.useState<"slots" | "availability">("slots");
  const [videoProvider, setVideoProvider] = React.useState<VideoProvider>(() =>
    defaultProviderFor("slots"),
  );
  // Once the freelancer picks a provider, switching booking mode must not
  // silently overwrite that choice.
  const [providerTouched, setProviderTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const changeMode = (nextMode: "slots" | "availability") => {
    setMode(nextMode);
    if (!providerTouched) setVideoProvider(defaultProviderFor(nextMode));
  };
  const router = useRouter();

  const updateSlot = (index: number, value: string) =>
    setSlots((prev) => prev.map((slot, i) => (i === index ? value : slot)));

  const submit = async () => {
    if (!topic.trim()) {
      toast.error("Add a topic for the call.");
      return;
    }
    let isoSlots: string[] = [];
    if (mode === "slots") {
      isoSlots = slots
        .map((slot) => slot.trim())
        .filter(Boolean)
        .map((slot) => {
          const date = new Date(slot);
          return Number.isNaN(date.getTime()) ? null : date.toISOString();
        })
        .filter((slot): slot is string => slot !== null);
      if (isoSlots.length === 0) {
        toast.error("Offer at least one time slot.");
        return;
      }
    }

    setSaving(true);
    const res = await createMeetingAction({
      topic: topic.trim(),
      notes: notes.trim() || undefined,
      durationMinutes: duration,
      slots: isoSlots,
      mode,
      videoProvider,
      clientId: clientId || null,
      projectId: prefill.projectId ?? null,
      proposalId: prefill.proposalId ?? null,
      contractId: prefill.contractId ?? null,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Call created. Share the link from your meetings.");
    router.push("/dashboard/meetings");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule a call"
        description="Offer a few times; your client picks one from a private link. The video link is created for you when they confirm."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="h-4 w-4" /> Meetings
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-5 p-6">
          <Field label="Topic">
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Kickoff call — Website project"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)">
              <Input
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(event) =>
                  setDuration(Number(event.target.value || 30))
                }
              />
            </Field>
            <Field label="Client (optional)">
              <select
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {availabilityEnabled ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How should the client pick a time?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => changeMode("slots")}
                  className={
                    "rounded-lg border p-3 text-left text-sm transition " +
                    (mode === "slots"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40")
                  }
                >
                  <span className="font-medium">Propose specific times</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    You offer a few options.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => changeMode("availability")}
                  className={
                    "rounded-lg border p-3 text-left text-sm transition " +
                    (mode === "availability"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40")
                  }
                >
                  <span className="font-medium">My live availability</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Client picks from your open calendar times.
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {mode === "slots" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Proposed times
              </p>
              {slots.map((slot, index) => (
                <Input
                  key={index}
                  type="datetime-local"
                  value={slot}
                  onChange={(event) => updateSlot(index, event.target.value)}
                />
              ))}
              <p className="text-xs text-muted-foreground">
                Offer up to three options, in your local timezone.
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              The client will see your live open times (working hours minus
              busy calendar blocks) and pick one. A Google Calendar event is
              created automatically.
            </p>
          )}

          <VideoProviderPicker
            value={videoProvider}
            onChange={(next) => {
              setVideoProvider(next);
              setProviderTouched(true);
            }}
            availability={videoProviders}
          />

          <Field label="Notes (optional)">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Anything the client should know before the call."
            />
          </Field>

          <div className="flex justify-end">
            <Button type="button" onClick={submit} disabled={saving}>
              <CalendarClock className="h-4 w-4" />
              {saving ? "Creating..." : "Create call"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


interface ProviderOption {
  value: VideoProvider;
  hint: string;
  /** Set when the option can't be chosen at all on this deployment. */
  blockedReason?: string;
  /** Set when it's choosable but needs a connection first. */
  needsConnect?: boolean;
}

function VideoProviderPicker({
  value,
  onChange,
  availability,
}: {
  value: VideoProvider;
  onChange: (next: VideoProvider) => void;
  availability: VideoProviderAvailability;
}) {
  const options: ProviderOption[] = [
    {
      value: "daily",
      hint: "Embedded in Stackivo — your client joins in the browser.",
      blockedReason: availability.daily
        ? undefined
        : "Not set up on this deployment.",
    },
    {
      value: "google_meet",
      hint: "A Meet link on a real Google Calendar event.",
      blockedReason: availability.googleConfigured
        ? undefined
        : "Google isn't set up on this deployment.",
      needsConnect:
        availability.googleConfigured && !availability.googleConnected,
    },
    {
      value: "zoom",
      hint: "A scheduled Zoom meeting, created when the client confirms.",
      blockedReason: availability.zoom
        ? undefined
        : "Not set up on this deployment yet.",
    },
    {
      value: "manual_link",
      hint: "Paste your own link on the meeting after it's booked.",
    },
  ];

  const selected = options.find((option) => option.value === value);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Video link
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const blocked = Boolean(option.blockedReason);
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={blocked}
              onClick={() => onChange(option.value)}
              className={
                "rounded-lg border p-3 text-left text-sm transition " +
                (blocked
                  ? "cursor-not-allowed opacity-50"
                  : active
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40")
              }
            >
              <span className="font-medium">
                {VIDEO_PROVIDER_LABEL[option.value]}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {option.blockedReason ?? option.hint}
              </span>
            </button>
          );
        })}
      </div>

      {selected?.needsConnect ? (
        // Connect opens in a new tab on purpose — a redirect here would throw
        // away everything already typed into this form.
        <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          Google isn&apos;t connected yet, so no Meet link will be created.
          <a
            href="/api/google/connect?next=/dashboard/settings/integrations"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Connect Google <ExternalLink className="h-3 w-3" />
          </a>
          then come back to this tab.
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
