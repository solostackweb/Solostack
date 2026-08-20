/**
 * Compact collapsible JSON renderer for admin detail screens.
 *
 * Intentionally minimal - every other JSON-viewer dependency on npm
 * has bloat we don't need. Renders:
 *   - null / undefined as `-`
 *   - string in quotes
 *   - numbers / booleans bare
 *   - arrays / objects as foldable trees
 *
 * No CodeMirror, no react-json-view, no dep. ~70 LOC.
 */

"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface JsonViewerProps {
  value: unknown;
  /** Maximum nesting before auto-collapse. Default 2. */
  defaultExpandDepth?: number;
  className?: string;
}

export function JsonViewer({
  value,
  defaultExpandDepth = 2,
  className,
}: JsonViewerProps) {
  return (
    <div
      className={cn(
        "rounded border bg-muted/30 px-2 py-1.5 font-mono text-xs leading-relaxed",
        className,
      )}
    >
      <Node value={value} depth={0} defaultExpandDepth={defaultExpandDepth} />
    </div>
  );
}

function Node({
  value,
  depth,
  defaultExpandDepth,
  fieldName,
}: {
  value: unknown;
  depth: number;
  defaultExpandDepth: number;
  fieldName?: string;
}) {
  if (value === null || value === undefined) {
    return <Leaf field={fieldName} text="-" tone="muted" />;
  }
  if (typeof value === "string") {
    return <Leaf field={fieldName} text={`"${value}"`} tone="string" />;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <Leaf
        field={fieldName}
        text={String(value)}
        tone={typeof value === "boolean" ? "bool" : "number"}
      />
    );
  }
  if (Array.isArray(value)) {
    return (
      <Container
        field={fieldName}
        depth={depth}
        defaultExpandDepth={defaultExpandDepth}
        open="["
        close="]"
        entries={value.map((v, i) => ({ key: String(i), value: v }))}
      />
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => ({ key: k, value: v }),
    );
    return (
      <Container
        field={fieldName}
        depth={depth}
        defaultExpandDepth={defaultExpandDepth}
        open="{"
        close="}"
        entries={entries}
      />
    );
  }
  return <Leaf field={fieldName} text={String(value)} tone="muted" />;
}

function Container({
  field,
  depth,
  defaultExpandDepth,
  open,
  close,
  entries,
}: {
  field?: string;
  depth: number;
  defaultExpandDepth: number;
  open: string;
  close: string;
  entries: Array<{ key: string; value: unknown }>;
}) {
  const [expanded, setExpanded] = React.useState(depth < defaultExpandDepth);
  const isEmpty = entries.length === 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="group inline-flex items-center gap-1 text-left"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            expanded && "rotate-90",
            isEmpty && "opacity-0",
          )}
        />
        {field ? (
          <span className="text-foreground/80">&quot;{field}&quot;:</span>
        ) : null}
        <span className="text-muted-foreground">
          {open}
          {!expanded ? (
            <span className="opacity-60">
              {isEmpty ? "" : `...${entries.length}`}
            </span>
          ) : null}
          {!expanded ? close : null}
        </span>
      </button>
      {expanded && !isEmpty ? (
        <div className="ml-3 border-l border-border/60 pl-3">
          {entries.map((e) => (
            <Node
              key={e.key}
              fieldName={e.key}
              value={e.value}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
            />
          ))}
          <div className="text-muted-foreground">{close}</div>
        </div>
      ) : null}
    </div>
  );
}

function Leaf({
  field,
  text,
  tone,
}: {
  field?: string;
  text: string;
  tone: "string" | "number" | "bool" | "muted";
}) {
  const toneClass = {
    string: "text-success-strong",
    number: "text-info-strong",
    bool: "text-violet-700 dark:text-violet-400",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="whitespace-pre-wrap break-all">
      {field ? (
        <span className="text-foreground/80">&quot;{field}&quot;: </span>
      ) : null}
      <span className={toneClass}>{text}</span>
    </div>
  );
}
