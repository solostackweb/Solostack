"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { ProjectRecord } from "../server";
import {
  createProjectAction,
  updateProjectAction,
  type ActionResult,
} from "../actions";
import type { ProjectStatusRow } from "@/lib/supabase/types";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill when editing. Omit to create. */
  project?: ProjectRecord;
  clients: Array<{ id: string; name: string }>;
}

type ProjectFormResult = ActionResult<{ id: string }>;

const NO_CLIENT = "__none__";

/**
 * Create / edit project dialog. Submits through the real server actions and
 * `router.refresh()`es so the list + detail views re-hydrate.
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  clients,
}: ProjectFormDialogProps) {
  const router = useRouter();
  const isEdit = !!project;
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<ProjectFormResult | undefined>();
  // Status is captured implicitly: edits keep the project's current status
  // (the chip handles transitions live); new projects start at "planning".
  const initialStatus: ProjectStatusRow = project?.status ?? "planning";
  const [clientId, setClientId] = React.useState<string>(
    project?.clientId ?? NO_CLIENT,
  );
  const [billingEnabled, setBillingEnabled] = React.useState<boolean>(
    project?.billingEnabled ?? false,
  );

  React.useEffect(() => {
    if (open) {
      setState(undefined);
      setClientId(project?.clientId ?? NO_CLIENT);
      setBillingEnabled(project?.billingEnabled ?? false);
    }
  }, [open, project]);

  const errs = state && !state.ok ? state.fieldErrors : undefined;

  const handleSubmit = (formData: FormData) => {
    formData.set("status", initialStatus);
    if (clientId !== NO_CLIENT) formData.set("clientId", clientId);
    else formData.set("clientId", "");
    if (isEdit) formData.set("id", project.id);
    formData.set("billingEnabled", billingEnabled ? "true" : "false");
    if (!billingEnabled) formData.set("hourlyRate", "0");

    startTransition(async () => {
      const res = isEdit
        ? await updateProjectAction(undefined, formData)
        : await createProjectAction(undefined, formData);
      setState(res);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? (isEdit ? "Project updated" : "Project created"));
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit project" : "Create a project"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the core details for this project."
              : "Group related invoices, contracts, and files under one project."}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {state && !state.ok && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.error}
            </p>
          )}

          <Field label="Project name" required error={errs?.name?.[0]}>
            <Input
              name="name"
              defaultValue={project?.name ?? ""}
              required
              placeholder="Website redesign"
              autoFocus
            />
          </Field>

          <Field label="Description" error={errs?.description?.[0]}>
            <Textarea
              name="description"
              rows={2}
              className="resize-none"
              defaultValue={project?.description ?? ""}
              placeholder="What's this project about?"
            />
          </Field>

          <Field label="Client" error={errs?.clientId?.[0]}>
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/15"
            >
              <option value={NO_CLIENT}>No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          {isEdit && (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              Status is changed inline from the project header.
            </p>
          )}

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Bill time on this project</p>
                <p className="text-xs text-muted-foreground">
                  Off = track time only. On = time can be billable and invoiced.
                </p>
              </div>
              <Switch checked={billingEnabled} onCheckedChange={setBillingEnabled} />
            </div>
            {billingEnabled && (
              <Field label="Default hourly rate (₹)" error={errs?.hourlyRate?.[0]}>
                <Input
                  type="number"
                  name="hourlyRate"
                  min="0"
                  step="50"
                  defaultValue={project?.hourlyRate ?? 0}
                  className="tabular-nums"
                />
              </Field>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" error={errs?.startDate?.[0]}>
              <Input
                type="date"
                name="startDate"
                defaultValue={project?.startDate ?? ""}
              />
            </Field>
            <Field label="Due date" error={errs?.dueDate?.[0]}>
              <Input
                type="date"
                name="dueDate"
                defaultValue={project?.dueDate ?? ""}
              />
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
