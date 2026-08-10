"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { parseAssistantRichText } from "@/features/ai-workflows/assistant-text";

function displayValue(value: string): string {
  return /^[a-z][a-z0-9_]*$/.test(value) && value.includes("_")
    ? value.replace(/_/g, " ")
    : value;
}

function inlineContent(value: string): React.ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`|(?<!\*)\*[^*]+\*(?!\*))/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={index}>{displayValue(part)}</React.Fragment>;
  });
}

function DataTableCards({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="space-y-2">
      {rows.map((row, rowIndex) => (
        <section key={`${row[0] ?? "row"}-${rowIndex}`} className="rounded-xl border border-border/70 bg-muted/[0.18] p-3">
          <h4 className="text-sm font-semibold leading-snug text-foreground">
            {inlineContent(row[0] || `Item ${rowIndex + 1}`)}
          </h4>
          <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {headers.slice(1).map((header, cellIndex) => {
              const value = row[cellIndex + 1];
              if (!value) return null;
              const isLast = cellIndex === headers.length - 2;
              return (
                <div key={`${header}-${cellIndex}`} className={cn("min-w-0", isLast && "sm:col-span-2")}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{header}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-foreground/85">{inlineContent(value)}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function AssistantRichText({ source }: { source: string }) {
  const blocks = React.useMemo(() => parseAssistantRichText(source), [source]);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, blockIndex) => {
        if (block.kind === "heading") {
          return <h3 key={blockIndex} className="pt-1 text-sm font-semibold text-foreground">{inlineContent(block.text)}</h3>;
        }
        if (block.kind === "table") {
          return <DataTableCards key={blockIndex} headers={block.headers} rows={block.rows} />;
        }
        if (block.kind === "ordered") {
          return (
            <ol key={blockIndex} className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{itemIndex + 1}</span>
                  <span className="min-w-0 pt-px">{inlineContent(item)}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (block.kind === "unordered") {
          return (
            <ul key={blockIndex} className="space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span>{inlineContent(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={blockIndex}>{inlineContent(block.text)}</p>;
      })}
    </div>
  );
}
