"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { manualTimeEntryAction, updateTimeEntryAction } from "../actions";
import { useSubscription } from "@/features/subscription/hooks/use-subscription";
import { Sparkles } from "lucide-react";
import type { TimerProjectOption } from "./active-timer-widget";
import type { TimeEntryRecord } from "../server";
import type { AiTimeEntryDraft } from "@/features/ai-workflows/types";

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: TimerProjectOption[];
  defaultHourlyRate?: number;
  initialAiDraft?: AiTimeEntryDraft | null;
  editing?: TimeEntryRecord | null;
}

const NO_PROJECT = "__none__";

interface FormState {
  description: string;
  projectId: string;
  date: string;
  hours: number;
  minutes: number;
  billable: boolean;
  hourlyRate: number;
}

/**
 * Manual time entry modal. Submits via `manualTimeEntryAction`, which
 * handles validation + inserts a completed `time_entries` row.
 */
export function ManualEntryDialog({
  open,
  onOpenChange,
  projects,
  defaultHourlyRate = 0,
  initialAiDraft,
  editing,
}: ManualEntryDialogProps) {
  const router = useRouter();
  const isEditing = Boolean(editing);
  const [pending, startTransition] = React.useTransition();
  const [values, setValues] = React.useState<FormState>(() => ({
    description: "",
    projectId: projects[0]?.id ?? NO_PROJECT,
    date: new Date().toISOString().slice(0, 10),
    hours: 1,
    minutes: 0,
    billable: false,
    hourlyRate: defaultHourlyRate,
  }));

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        description: editing.description ?? "",
        projectId: editing.projectId ?? NO_PROJECT,
        date: editing.startedAt.slice(0, 10),
        hours: Math.floor(editing.durationSeconds / 3600),
        minutes: Math.floor((editing.durationSeconds % 3600) / 60),
        billable: editing.billable,
        hourlyRate: editing.hourlyRate,
      });
    } else {
      setValues((v) => ({
        ...v,
        description: "",
        billable: false,
        date: new Date().toISOString().slice(0, 10),
        hourlyRate: defaultHourlyRate,
      }));
    }
  }, [open, defaultHourlyRate, editing]);

  const handleSubmit = () => {
    if (!values.description.trim()) {
      toast.error("Add a description");
      return;
    }
    const durationSeconds = values.hours * 3600 + values.minutes * 60;
    if (durationSeconds <= 0) {
      toast.error("Enter a duration");
      return;
    }
    // Midday start keeps the entry unambiguously on the chosen local date
    // even after UTC conversion.
    const startedAt = new Date(`${values.date}T12:00:00`).toISOString();

    const fd = new FormData();
    if (editing) fd.set("id", editing.id);
    fd.set("description", values.description.trim());
    if (values.projectId !== NO_PROJECT) {
      fd.set("projectId", values.projectId);
      const p = projects.find((x) => x.id === values.projectId);
      if (p?.clientId) fd.set("clientId", p.clientId);
    }
    fd.set("startedAt", startedAt);
    fd.set("durationSeconds", String(durationSeconds));
    fd.set("billable", values.billable ? "true" : "false");
    fd.set("hourlyRate", String(values.billable ? values.hourlyRate : 0));

    startTransition(async () => {
      const res = editing
        ? await updateTimeEntryAction(undefined, fd)
        : await manualTimeEntryAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? (editing ? "Entry updated" : "Time entry added"));
      onOpenChange(false);
      router.refresh();
    });
  };

  const applyAiDraft = React.useCallback((draft: AiTimeEntryDraft) => {
    setValues((prev) => ({
      ...prev,
      description: draft.description,
      projectId: draft.projectId || NO_PROJECT,
      date: draft.date || prev.date,
      hours: draft.hours,
      minutes: draft.minutes,
      billable: draft.billable,
      hourlyRate: draft.hourlyRate,
    }));
  }, []);

  React.useEffect(() => {
    if (!open || !initialAiDraft) return;
    applyAiDraft(initialAiDraft);
  }, [applyAiDraft, initialAiDraft, open]);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={isEditing ? "Edit time entry" : "Log time"}
      description={
        isEditing
          ? "Update the details of this time entry."
          : "Back-date an entry or log time you forgot to track live."
      }
    >
        <div className="space-y-4">
          <Field label="Description">
            <Textarea
              rows={2}
              className="resize-none"
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              placeholder="What did you work on?"
              autoFocus
            />
          </Field>

          <Field label="Project">
            <Select
              value={values.projectId}
              onValueChange={(v) => {
                const proj = projects.find((x) => x.id === v);
                const bill = !!proj?.billingEnabled;
                setValues((prev) => ({
                  ...prev,
                  projectId: v,
                  billable: bill,
                  hourlyRate: bill ? (proj?.hourlyRate || defaultHourlyRate) : prev.hourlyRate,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date">
              <Input
                type="date"
                value={values.date}
                onChange={(e) =>
                  setValues((v) => ({ ...v, date: e.target.value }))
                }
              />
            </Field>
            <Field label="Hours">
              <Input
                type="number"
                min="0"
                max="24"
                value={values.hours}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    hours: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="tabular-nums"
              />
            </Field>
            <Field label="Minutes">
              <Input
                type="number"
                min="0"
                max="59"
                value={values.minutes}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    minutes: Math.max(
                      0,
                      Math.min(59, Number(e.target.value) || 0),
                    ),
                  }))
                }
                className="tabular-nums"
              />
            </Field>
          </div>

          <BillableField
            billable={values.billable}
            hourlyRate={values.hourlyRate}
            projectBillingEnabled={
              !!projects.find((x) => x.id === values.projectId)?.billingEnabled
            }
            onBillableChange={(v) => setValues((prev) => ({ ...prev, billable: v }))}
            onRateChange={(v) => setValues((prev) => ({ ...prev, hourlyRate: v }))}
          />
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Saving…" : isEditing ? "Save changes" : "Save entry"}
          </Button>
        </div>
    </ResponsiveModal>
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
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function BillableField({
  billable,
  hourlyRate,
  projectBillingEnabled,
  onBillableChange,
  onRateChange,
}: {
  billable: boolean;
  hourlyRate: number;
  projectBillingEnabled: boolean;
  onBillableChange: (v: boolean) => void;
  onRateChange: (v: number) => void;
}) {
  const { canUse } = useSubscription();
  const canUseBillable = canUse("time.billable_rates");

  if (!projectBillingEnabled) {
    return (
      <p className="rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        Tracking-only project. Enable time billing on the project to bill this time.
      </p>
    );
  }

  if (!canUseBillable) {
    return (
      <div className="flex items-center justify-between rounded-md border border-primary/15 bg-primary/[0.03] px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Billable
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Pro
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            <a href="/dashboard/settings/billing" className="underline underline-offset-2 hover:text-foreground">
              Upgrade to Pro
            </a>{" "}
            to mark entries as billable and set hourly rates.
          </p>
        </div>
        <Switch checked={false} disabled />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Billable</p>
          <p className="text-xs text-muted-foreground">
            Count this time toward your client&apos;s budget
          </p>
        </div>
        <Switch checked={billable} onCheckedChange={onBillableChange} />
      </div>
      {billable && (
        <Field label="Hourly rate (₹)">
          <Input
            type="number"
            min="0"
            step="50"
            value={hourlyRate}
            onChange={(e) => onRateChange(Math.max(0, Number(e.target.value) || 0))}
            className="tabular-nums"
          />
        </Field>
      )}
    </>
  );
}
