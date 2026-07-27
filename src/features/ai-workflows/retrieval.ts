import "server-only";

/**
 * The envelope every Ivo read tool returns to the model.
 *
 * Two problems this exists to solve.
 *
 * First, provenance. Grounded answers are only trustworthy if the model can
 * say what it read and when. Every result carries `asOf`, the `source` it came
 * from, and the `scope` that was applied, so an answer can be attributed and a
 * stale figure can be recognised as stale rather than presented as current.
 *
 * Second, and more importantly: a failed read must never look like an empty
 * one. Previously a source error handed the model a bare `{ error: ... }`
 * object while "no rows" handed it `{ rows: [] }`, and nothing in either shape
 * forced the distinction. A model that reads a timeout as "you have no overdue
 * invoices" produces a confident, wrong, and financially material answer. The
 * three statuses here are mutually exclusive and every consumer must branch on
 * them.
 */

/** Largest serialised tool payload handed back to the model, in characters. */
const MAX_PAYLOAD_CHARS = 6000;

export type IvoRetrieval =
  | {
      status: "ok";
      /** ISO timestamp of the moment the underlying read completed. */
      asOf: string;
      /** Stable identifier for the data source, e.g. "invoices". */
      source: string;
      /** The filter/scope applied, so a narrow read is not read as the whole set. */
      scope: string;
      /** Records actually included after truncation. */
      count: number;
      /** True when records were dropped to fit the payload budget. */
      truncated: boolean;
      data: unknown;
    }
  | {
      status: "empty";
      asOf: string;
      source: string;
      scope: string;
      /** Why there is nothing — genuinely no records, not a failure. */
      reason: string;
    }
  | {
      status: "unavailable";
      source: string;
      scope: string;
      /** Why the read could not be performed. Never implies absence of data. */
      reason: string;
    };

function nowIso() {
  return new Date().toISOString();
}

/**
 * Drops whole records until the serialised payload fits the budget.
 *
 * The previous implementation stringified the value and sliced the resulting
 * text, which handed the model a truncated object literal with an ellipsis
 * glued to the end — syntactically invalid JSON. Anything the model then
 * "read" past the cut was invention. Dropping records keeps the payload
 * parseable and makes the loss explicit via `truncated`.
 */
function fitRecords(records: unknown[]): { kept: unknown[]; truncated: boolean } {
  if (JSON.stringify(records).length <= MAX_PAYLOAD_CHARS) {
    return { kept: records, truncated: false };
  }
  const kept: unknown[] = [];
  let size = 2; // the enclosing brackets
  for (const record of records) {
    const encoded = JSON.stringify(record) ?? "null";
    const next = size + encoded.length + (kept.length > 0 ? 1 : 0);
    if (next > MAX_PAYLOAD_CHARS) break;
    kept.push(record);
    size = next;
  }
  return { kept, truncated: true };
}

/**
 * Wraps a successful list read. An empty array becomes `empty`, not `ok` with
 * zero rows, so the model has one unambiguous shape meaning "nothing here".
 */
export function retrievedRecords(
  source: string,
  scope: string,
  records: unknown[],
  emptyReason = "No matching records.",
): IvoRetrieval {
  if (records.length === 0) {
    return { status: "empty", asOf: nowIso(), source, scope, reason: emptyReason };
  }
  const { kept, truncated } = fitRecords(records);
  if (kept.length === 0) {
    // A single record too large to send. Report it as unavailable rather than
    // as an empty result, because records demonstrably exist.
    return {
      status: "unavailable",
      source,
      scope,
      reason: "The matching records are too large to summarise here.",
    };
  }
  return {
    status: "ok",
    asOf: nowIso(),
    source,
    scope,
    count: kept.length,
    truncated,
    data: kept,
  };
}

/** Wraps a successful single-object read, such as an aggregate snapshot. */
export function retrievedValue(source: string, scope: string, value: unknown): IvoRetrieval {
  if (value === null || value === undefined) {
    return { status: "empty", asOf: nowIso(), source, scope, reason: "No record found." };
  }
  const encoded = JSON.stringify(value) ?? "null";
  if (encoded.length > MAX_PAYLOAD_CHARS) {
    return {
      status: "unavailable",
      source,
      scope,
      reason: "The record is too large to summarise here.",
    };
  }
  return { status: "ok", asOf: nowIso(), source, scope, count: 1, truncated: false, data: value };
}

/**
 * Wraps a read that could not be performed. Callers must use this rather than
 * returning an empty result on failure.
 */
export function retrievalUnavailable(
  source: string,
  scope: string,
  reason = "The data source could not be read.",
): IvoRetrieval {
  return { status: "unavailable", source, scope, reason };
}

/**
 * Normalises whatever a read tool returned into the envelope.
 *
 * Existing tools return either `{ rows: [...] }` or a plain object. This keeps
 * the wrapping in one place instead of rewriting every executor, and anything
 * unrecognised is treated as a single value rather than silently dropped.
 */
export function asRetrieval(source: string, scope: string, output: unknown): IvoRetrieval {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const record = output as Record<string, unknown>;
    // An executor that already reported its own failure must stay a failure.
    if (typeof record.error === "string") {
      return retrievalUnavailable(source, scope, record.error);
    }
    if (Array.isArray(record.rows)) {
      return retrievedRecords(source, scope, record.rows);
    }
  }
  if (Array.isArray(output)) return retrievedRecords(source, scope, output);
  return retrievedValue(source, scope, output);
}
