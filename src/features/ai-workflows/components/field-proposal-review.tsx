"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { diffStats, diffWords, isNoOpDiff, type DiffSegment } from "@/features/ai-workflows/text-diff";

/**
 * Review surface for AI-proposed field text.
 *
 * Deliberately decoupled from where the text came from. Some fields use the
 * generic `generateFieldAction`; others have their own richer action that
 * already knows about line items or currency. Both should land here, because
 * the property being protected — the user sees what would change and chooses —
 * belongs to the review step, not to whichever endpoint produced the words.
 */

interface FieldProposalReviewProps {
  /** What the field holds right now. */
  original: string;
  /** What the model suggests it should hold. */
  proposed: string;
  onApply: (next: string) => void;
  onDiscard: () => void;
  className?: string;
}

export function FieldProposalReview({
  original,
  proposed,
  onApply,
  onDiscard,
  className,
}: FieldProposalReviewProps) {
  const diff = React.useMemo(() => diffWords(original, proposed), [original, proposed]);
  const stats = React.useMemo(() => diffStats(diff), [diff]);
  const unchanged = isNoOpDiff(diff);

  return (
    <div className={cn("rounded-md border bg-muted/30 p-3", className)}>
      {unchanged ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Ivo didn&apos;t find anything worth changing here.
          </p>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onDiscard}>
            Close
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Suggested changes
              <span className="ml-1.5 font-normal">
                +{stats.added} / −{stats.removed} words
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onApply(proposed)}
              >
                <Check className="mr-1 h-3 w-3" />
                Apply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onDiscard}
              >
                <X className="mr-1 h-3 w-3" />
                Discard
              </Button>
            </div>
          </div>
          <DiffView diff={diff} />
        </>
      )}
    </div>
  );
}

/**
 * Renders the diff as tracked changes. Removed text is struck through rather
 * than hidden — the user is deciding whether to lose it, so they need to see
 * what would go.
 */
export function DiffView({ diff }: { diff: DiffSegment[] }) {
  return (
    <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
      {diff.map((segment, index) => {
        if (segment.op === "unchanged") return <span key={index}>{segment.text}</span>;
        if (segment.op === "added") {
          return (
            <span
              key={index}
              className="rounded-sm bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            >
              {segment.text}
            </span>
          );
        }
        return (
          <span
            key={index}
            className="rounded-sm bg-destructive/10 text-destructive line-through decoration-1"
          >
            {segment.text}
          </span>
        );
      })}
    </p>
  );
}
