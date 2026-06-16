"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDuration } from "../types";
import type { TimeEntryRecord } from "../server";
import { startTimerAction, stopTimerAction } from "../actions";

export interface TimerProjectOption {
  id: string;
  name: string;
  clientId: string | null;
  billingEnabled?: boolean;
  hourlyRate?: number;
}

interface ActiveTimerWidgetProps {
  running: TimeEntryRecord | null;
  projects: TimerProjectOption[];
  /** Default hourly rate used when starting a new timer. */
  defaultHourlyRate?: number;
  floating?: boolean;
  className?: string;
}

const NO_PROJECT = "__none__";

/**
 * Live timer widget backed by `time_entries`. When an entry with
 * `ended_at IS NULL` exists we display the elapsed seconds (ticking on
 * the client); otherwise we show the start form.
 */
export function ActiveTimerWidget({
  running,
  projects,
  defaultHourlyRate = 0,
  floating = false,
  className,
}: ActiveTimerWidgetProps) {
  const router = useRouter();
  const [description, setDescription] = React.useState("");
  const [projectId, setProjectId] = React.useState<string>(
    projects[0]?.id ?? NO_PROJECT,
  );
  const [elapsed, setElapsed] = React.useState(0);
  const [pending, startTransition] = React.useTransition();

  // Optimistic override so start/stop reflect instantly without waiting for the
  // page to refetch. `undefined` = use the server prop; `null` = just stopped;
  // an object = just started. Resets whenever fresh server data arrives.
  type ActiveView = Pick<
    NonNullable<typeof running>,
    "id" | "startedAt" | "description" | "projectId"
  >;
  const [override, setOverride] = React.useState<ActiveView | null | undefined>(undefined);
  React.useEffect(() => setOverride(undefined), [running]);
  const active: ActiveView | null = override === undefined ? running : override;

  // Seed / tick the elapsed-seconds counter from the running row's start time.
  React.useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const startMs = new Date(active.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  const handleStart = () => {
    if (!description.trim()) {
      toast.error("Add a description first");
      return;
    }
    const fd = new FormData();
    fd.set("description", description.trim());
    if (projectId !== NO_PROJECT) {
      fd.set("projectId", projectId);
      const p = projects.find((x) => x.id === projectId);
      if (p?.clientId) fd.set("clientId", p.clientId);
    }
    // Billing is opt-in per project: a timer is billable only when the chosen
    // project has billing enabled, using that project's rate.
    const billProj =
      projectId !== NO_PROJECT ? projects.find((x) => x.id === projectId) : undefined;
    const willBill = !!billProj?.billingEnabled;
    fd.set("billable", willBill ? "true" : "false");
    fd.set("hourlyRate", String(willBill ? (billProj?.hourlyRate || defaultHourlyRate) : 0));
    // Optimistic: show the running timer instantly.
    const optimisticDesc = description.trim();
    const optimisticProject = projectId !== NO_PROJECT ? projectId : null;
    setOverride({
      id: "optimistic",
      startedAt: new Date().toISOString(),
      description: optimisticDesc,
      projectId: optimisticProject,
    });
    setDescription("");
    startTransition(async () => {
      const res = await startTimerAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        setOverride(undefined); // revert
        setDescription(optimisticDesc);
        return;
      }
      router.refresh();
    });
  };

  const handleStop = () => {
    setOverride(null); // optimistic: hide immediately
    startTransition(async () => {
      const res = await stopTimerAction();
      if (!res.ok) {
        toast.error(res.error);
        setOverride(undefined); // revert
        return;
      }
      toast.success(res.message ?? "Timer stopped");
      router.refresh();
    });
  };

  const isRunning = !!active;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        floating &&
          "fixed bottom-4 left-1/2 z-40 w-[min(620px,calc(100%-2rem))] -translate-x-1/2 shadow-xl shadow-primary/10",
        isRunning && "border-primary/40 shadow-lg shadow-primary/10",
        className,
      )}
    >
      {isRunning ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
      ) : null}
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              "relative flex h-2.5 w-2.5 shrink-0",
            )}
          >
            {isRunning ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            ) : null}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full",
                isRunning
                  ? "bg-primary shadow-[0_0_8px_currentColor]"
                  : "bg-muted-foreground/30",
              )}
            />
          </span>
          <Input
            value={isRunning ? (active?.description ?? "") : description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isRunning ? "Timing…" : "What are you working on?"}
            disabled={isRunning}
            className="h-9 border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background"
          />
        </div>

        <Select
          value={isRunning ? (active?.projectId ?? NO_PROJECT) : projectId}
          onValueChange={setProjectId}
          disabled={isRunning}
        >
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Project" />
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

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "font-mono text-xl font-bold tabular-nums tracking-tight",
              isRunning ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {formatDuration(elapsed)}
          </span>

          {!isRunning ? (
            <Button
              type="button"
              size="sm"
              onClick={handleStart}
              disabled={pending}
              className="font-semibold shadow-md shadow-primary/15 transition-shadow hover:shadow-lg hover:shadow-primary/25"
            >
              <Play /> Start
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleStop}
              disabled={pending}
              className="font-semibold shadow-md shadow-destructive/15 transition-shadow hover:shadow-lg hover:shadow-destructive/25"
            >
              <Square /> Stop
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
