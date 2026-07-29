/**
 * Word-level diff for reviewing AI-proposed text.
 *
 * Phase 6's non-negotiable is that generated content never overwrites what the
 * user wrote without an explicit apply. A diff is what makes that promise
 * checkable rather than stated: the user sees exactly which words would change
 * before anything replaces their work.
 *
 * Word-level rather than character-level because these are prose fields —
 * proposal scope, contract clauses, email bodies. A character diff of two
 * paragraphs is unreadable; a word diff reads like tracked changes.
 *
 * Pure and dependency-free, so it runs on the server for eval and in the
 * browser for rendering.
 */

export type DiffOp = "unchanged" | "added" | "removed";

export interface DiffSegment {
  op: DiffOp;
  /** The words in this run, already joined with their original spacing. */
  text: string;
}

/**
 * Splits into words and whitespace as separate tokens.
 *
 * Keeping whitespace attached to words seems tidier but makes word boundaries
 * unstable: "three" at the end of a sentence and "three " mid-sentence are then
 * different tokens, so appending text marks the preceding word as changed. The
 * round trip still worked, but the user was shown more red and green than had
 * actually changed — which quietly erodes the point of reviewing a diff.
 * Separate tokens keep every reassembly exact and every highlight truthful.
 */
function tokenize(value: string): string[] {
  return value.match(/\S+|\s+/g) ?? [];
}

/**
 * Longest common subsequence over tokens.
 *
 * Quadratic in both time and memory, so the cap is a real constraint rather
 * than a formality: at 1200 tokens the table is ~1.4M cells (~11MB) per call,
 * and doubling the cap quadruples that on every request. Since whitespace is
 * its own token, 1200 is roughly 600 words — comfortably more than any single
 * prose field here. Longer inputs skip alignment and report a wholesale
 * replacement, which is still correct, just less granular.
 */
const MAX_TOKENS = 1200;

export function diffWords(original: string, proposed: string): DiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(proposed);

  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ op: "added", text: proposed }];
  if (b.length === 0) return [{ op: "removed", text: original }];
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    // Honest degradation: still shows both sides, just without word alignment.
    return [
      { op: "removed", text: original },
      { op: "added", text: proposed },
    ];
  }

  // lengths[i][j] = LCS length of a[i:] and b[j:]
  const lengths: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (op: DiffOp, text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.op === op) last.text += text;
    else segments.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("unchanged", a[i]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      push("removed", a[i]);
      i += 1;
    } else {
      push("added", b[j]);
      j += 1;
    }
  }
  while (i < a.length) {
    push("removed", a[i]);
    i += 1;
  }
  while (j < b.length) {
    push("added", b[j]);
    j += 1;
  }

  return segments;
}

/** True when the proposal would change nothing — no need to prompt for review. */
export function isNoOpDiff(segments: DiffSegment[]): boolean {
  return segments.every((segment) => segment.op === "unchanged");
}

/**
 * Reassembles what the field would contain if the proposal were applied.
 *
 * Used to verify that applying a diff reproduces the proposed text exactly. A
 * renderer that drops or reorders a segment would otherwise silently corrupt
 * the user's document at apply time.
 */
export function applyDiff(segments: DiffSegment[]): string {
  return segments
    .filter((segment) => segment.op !== "removed")
    .map((segment) => segment.text)
    .join("");
}

/** Counts of changed words, for a compact "12 added, 3 removed" summary. */
export function diffStats(segments: DiffSegment[]): { added: number; removed: number } {
  const count = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  let added = 0;
  let removed = 0;
  for (const segment of segments) {
    if (segment.op === "added") added += count(segment.text);
    if (segment.op === "removed") removed += count(segment.text);
  }
  return { added, removed };
}
