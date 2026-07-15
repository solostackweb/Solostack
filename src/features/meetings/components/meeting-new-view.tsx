"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createMeetingAction } from "../actions";

interface ClientOption {
  id: string;
  name: string;
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
}: {
  clients: ClientOption[];
  prefill: Prefill;
}) {
  const [topic, setTopic] = React.useState(prefill.topic ?? "");
  const [duration, setDuration] = React.useState(30);
  const [notes, setNotes] = React.useState("");
  const [clientId, setClientId] = React.useState(prefill.clientId ?? "");
  const [slots, setSlots] = React.useState<string[]>(["", "", ""]);
  const [saving, setSaving] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const updateSlot = (index: number, value: string) =>
    setSlots((prev) => prev.map((slot, i) => (i === index ? value : slot)));

  const submit = async () => {
    if (!topic.trim()) {
      toast.error("Add a topic for the call.");
      return;
    }
    const isoSlots = slots
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

    setSaving(true);
    const res = await createMeetingAction({
      topic: topic.trim(),
      notes: notes.trim() || undefined,
      durationMinutes: duration,
      slots: isoSlots,
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
    toast.success(res.message ?? "Call created.");
    setShareUrl(`${window.location.origin}/m/${res.data?.publicToken ?? ""}`);
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (shareUrl) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Call created"
          description="Share this private link with your client — they'll pick one of your times."
        />
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard/meetings">View all calls</Link>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShareUrl(null);
                  setTopic("");
                  setNotes("");
                  setSlots(["", "", ""]);
                }}
              >
                Schedule another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule a call"
        description="Offer a few times; your client picks one from a private link. Add a video link after — connected in-app video is coming."
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
