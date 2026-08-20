import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tiny, dependency-free markdown renderer for welcome-document
 * section bodies. Intentionally limited so the surface area is small
 * and the rendered output is predictable across web + PDF.
 *
 * Supported syntax:
 *   **bold**      -> <strong>
 *   *italic*      -> <em>
 *   `code`        -> <code>
 *   [text](url)   -> <a href> (rel + target hardened)
 *   - bullet      -> <ul><li>
 *   1. numbered   -> <ol><li>
 *   > quote       -> <blockquote>
 *   blank line    -> paragraph break
 *
 * NOT supported (deliberate): images, headings (sections supply
 * their own heading), HTML passthrough, tables.
 *
 * Anchor URLs are scrubbed to http(s) and mailto only — anything else
 * (javascript:, data:) is dropped.
 */

interface Props {
  source: string;
  className?: string;
}

export function WelcomeMarkdown({ source, className }: Props) {
  const blocks = React.useMemo(() => parseBlocks(source), [source]);
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-7 text-foreground/80 [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline [&_strong]:font-semibold [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        className,
      )}
    >
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "blank" };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      out.push({ kind: "ul", items });
      continue;
    }
    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      out.push({ kind: "ol", items });
      continue;
    }
    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const acc: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        acc.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      out.push({ kind: "quote", text: acc.join(" ") });
      continue;
    }
    // Paragraph (single or multi-line, joined with spaces)
    const acc: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      acc.push(lines[i]);
      i += 1;
    }
    out.push({ kind: "p", text: acc.join(" ") });
  }
  return out;
}

function renderBlock(b: Block, key: number): React.ReactNode {
  switch (b.kind) {
    case "p":
      return <p key={key}>{renderInline(b.text)}</p>;
    case "ul":
      return (
        <ul key={key} className="ml-5 list-disc space-y-1.5 marker:text-muted-foreground">
          {b.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="ml-5 list-decimal space-y-1.5 marker:text-muted-foreground">
          {b.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-2 border-primary/40 bg-primary/5 px-4 py-2 text-foreground/80"
        >
          {renderInline(b.text)}
        </blockquote>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------

function renderInline(input: string): React.ReactNode[] {
  // Tokenise inline markdown into a flat array of strings + react nodes.
  // Order of substitution matters: code first (so other markup inside
  // backticks is preserved literally), then links, bold, italic.
  const tokens: Array<string | React.ReactElement> = [input];

  applyRule(tokens, /`([^`]+)`/g, (m, key) => (
    <code key={key}>{m[1]}</code>
  ));

  applyRule(tokens, /\[([^\]]+)\]\(([^)]+)\)/g, (m, key) => {
    const text = m[1];
    const safeUrl = sanitiseUrl(m[2]);
    if (!safeUrl) return <React.Fragment key={key}>{text}</React.Fragment>;
    return (
      <a
        key={key}
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer ugc"
      >
        {text}
      </a>
    );
  });

  applyRule(tokens, /\*\*([^*]+)\*\*/g, (m, key) => (
    <strong key={key}>{m[1]}</strong>
  ));

  applyRule(tokens, /(?<!\*)\*([^*\s][^*]*?)\*(?!\*)/g, (m, key) => (
    <em key={key}>{m[1]}</em>
  ));

  return tokens.map((t, i) =>
    typeof t === "string" ? <React.Fragment key={i}>{t}</React.Fragment> : t,
  );
}

/**
 * Walk every string token, splitting it on a regex and replacing the
 * match with the result of `make`. Non-string tokens pass through
 * unchanged. Mutates `tokens` in place for simplicity — the caller
 * never holds a stale reference.
 */
function applyRule(
  tokens: Array<string | React.ReactElement>,
  re: RegExp,
  make: (match: RegExpExecArray, key: number) => React.ReactElement,
): void {
  let key = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (typeof t !== "string") continue;
    const localRe = new RegExp(re.source, re.flags);
    let last = 0;
    const out: Array<string | React.ReactElement> = [];
    let m: RegExpExecArray | null;
    while ((m = localRe.exec(t)) !== null) {
      if (m.index > last) out.push(t.slice(last, m.index));
      out.push(make(m, key++));
      last = m.index + m[0].length;
    }
    if (out.length === 0) continue;
    if (last < t.length) out.push(t.slice(last));
    tokens.splice(i, 1, ...out);
    i += out.length - 1;
  }
}

const URL_RE = /^(https?:|mailto:)/i;
function sanitiseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (URL_RE.test(trimmed)) return trimmed;
  // Allow protocol-relative URLs by upgrading to https.
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  // Allow path-only URLs (relative anchors) for intra-app links.
  if (trimmed.startsWith("/")) return trimmed;
  return null;
}

/**
 * Plain-text fallback used by the PDF renderer. Strips markdown
 * markers without dropping the underlying text, so:
 *   "**Bold** and *italic*"  ->  "Bold and italic"
 */
export function welcomeMarkdownToPlain(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\*)\*([^*\s][^*]*?)\*(?!\*)/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*(\d+)\.\s+/gm, "$1. ")
    .replace(/^\s*>\s?/gm, "“")
    .trim();
}
