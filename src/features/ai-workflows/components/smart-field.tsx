"use client";

import * as React from "react";
import { Loader2, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FieldProposalReview } from "@/features/ai-workflows/components/field-proposal-review";
import { generateFieldAction } from "@/features/ai-workflows/field-generation-actions";
import type {
  IvoFieldKind,
  IvoFieldOperation,
  IvoFieldProposal,
} from "@/features/ai-workflows/field-generation";

/**
 * Ivo inside the work rather than beside it.
 *
 * Wraps any prose field with generate / improve / shorten / tone controls. The
 * component never writes to the field directly: it renders the proposal as a
 * diff and calls `onApply` only when the user presses Apply. Undo restores the
 * exact text that was there before, so an applied suggestion is never a
 * one-way door.
 */

interface SmartFieldProps {
  kind: IvoFieldKind;
  /** Current field text — the component is controlled by its parent. */
  value: string;
  onApply: (next: string) => void;
  /** Optional grounding. Ids are ownership-checked server-side. */
  clientId?: string;
  projectId?: string;
  /** Optional short brief passed to "generate". */
  brief?: string;
  className?: string;
  disabled?: boolean;
}

const OPERATIONS: Array<{ op: IvoFieldOperation; label: string; needsText: boolean }> = [
  { op: "generate", label: "Generate", needsText: false },
  { op: "improve", label: "Improve", needsText: true },
  { op: "shorten", label: "Shorten", needsText: true },
  { op: "expand", label: "Expand", needsText: true },
  { op: "soften", label: "Warmer", needsText: true },
  { op: "sharpen", label: "Sharper", needsText: true },
];

export function SmartField({
  kind,
  value,
  onApply,
  clientId,
  projectId,
  brief,
  className,
  disabled = false,
}: SmartFieldProps) {
  const [proposal, setProposal] = React.useState<IvoFieldProposal | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<IvoFieldOperation | null>(null);
  /** Text as it was immediately before an apply, so Undo is exact. */
  const [undoTo, setUndoTo] = React.useState<string | null>(null);

  const hasText = value.trim().length > 0;

  const run = React.useCallback(
    async (operation: IvoFieldOperation) => {
      setRunning(operation);
      setError(null);
      setProposal(null);
      try {
        const result = await generateFieldAction({
          kind,
          operation,
          current: value,
          brief,
          clientId,
          projectId,
        });
        if (result.ok) setProposal(result.proposal);
        else setError(result.error);
      } catch {
        setError("Ivo couldn't draft that just now. Try again in a moment.");
      } finally {
        setRunning(null);
      }
    },
    [brief, clientId, kind, projectId, value],
  );

  const apply = React.useCallback(() => {
    if (!proposal) return;
    // Capture what is being replaced before replacing it.
    setUndoTo(proposal.original);
    onApply(proposal.proposed);
    setProposal(null);
  }, [onApply, proposal]);

  const undo = React.useCallback(() => {
    if (undoTo === null) return;
    onApply(undoTo);
    setUndoTo(null);
  }, [onApply, undoTo]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {OPERATIONS.map(({ op, label, needsText }) => (
          <Button
            key={op}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            // Operations that rewrite need something to rewrite; offering them
            // on an empty field would just silently become "generate".
            disabled={disabled || running !== null || (needsText && !hasText)}
            onClick={() => void run(op)}
          >
            {running === op ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {label}
          </Button>
        ))}
        {undoTo !== null && !proposal ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={undo}
          >
            <Undo2 className="mr-1 h-3 w-3" />
            Undo
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="status">
          {error}
        </p>
      ) : null}

      {proposal ? (
        <FieldProposalReview
          original={proposal.original}
          proposed={proposal.proposed}
          onApply={apply}
          onDiscard={() => setProposal(null)}
        />
      ) : null}
    </div>
  );
}
