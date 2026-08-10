/** Remove model-authored HTML while retaining a small, safe Markdown subset. */
export function normalizeAssistantMarkup(content: string): string {
  return content
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether a text reply benefits from the wider structured-message measure. */
export function hasStructuredAssistantFormatting(content: string): boolean {
  const normalized = normalizeAssistantMarkup(content);
  return (
    /^\s*\|.+\|\s*$/m.test(normalized) ||
    /^\s*(?:#{1,6}\s+|\*\*[^*]+\*\*\s*$)/m.test(normalized) ||
    /^\s*(?:[-*]|\d+\.)\s+/m.test(normalized)
  );
}

export type AssistantRichBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "ordered"; items: string[] }
  | { kind: "unordered"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Parse the deliberately small formatting subset supported by IVo chat. */
export function parseAssistantRichText(source: string): AssistantRichBlock[] {
  const lines = normalizeAssistantMarkup(source).replace(/\r\n/g, "\n").split("\n");
  const blocks: AssistantRichBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.includes("|") && TABLE_SEPARATOR.test(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        const cells = tableCells(lines[index]);
        if (cells.some(Boolean)) rows.push(cells);
        index += 1;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }

    const markdownHeading = line.match(/^\s*#{1,6}\s+(.+)$/);
    const boldHeading = line.match(/^\s*\*\*([^*]+)\*\*\s*$/);
    if (markdownHeading || boldHeading) {
      blocks.push({
        kind: "heading",
        text: (markdownHeading?.[1] ?? boldHeading?.[1] ?? "").trim(),
      });
      index += 1;
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, "").trim());
        index += 1;
      }
      blocks.push({ kind: "ordered", items });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, "").trim());
        index += 1;
      }
      blocks.push({ kind: "unordered", items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*(?:#{1,6}\s+|\*\*[^*]+\*\*\s*$|\d+\.\s+|[-*]\s+)/.test(lines[index]) &&
      !(lines[index].includes("|") && TABLE_SEPARATOR.test(lines[index + 1] ?? ""))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

/** Plain-text fallback for surfaces that cannot render rich assistant text. */
export function formatAssistantMessageContent(content: string): string {
  return normalizeAssistantMarkup(content)
    .replace(
      /^[ \t]*\|?[ \t]*[-:]+(?:[ \t]*\|[ \t]*[-:]+)+[ \t]*\|?[ \t]*(?:\r?\n|$)/gm,
      "",
    )
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_line, cells: string) =>
      cells.split("|").map((cell) => cell.trim()).filter(Boolean).join(" — "),
    )
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\s+(\d+\.\s+)/g, "\n$1")
    .replace(/\s+([-*]\s+)/g, "\n$1")
    .replace(/([.!?])\s+(Next:|Focus:|Watch:|Tip:)/g, "$1\n$2")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
