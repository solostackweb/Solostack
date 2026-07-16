/**
 * `FormData.get()` returns `null` for a field that isn't present in the
 * submitted form (e.g. an input that a given form variant doesn't render).
 * A zod `.optional()` string schema, however, accepts `undefined` — not
 * `null` — so an absent field is wrongly reported as "Invalid input".
 *
 * `coerceFormValues` normalises a plain object built from `formData.get(...)`
 * calls by turning every `null` into `undefined`. Optional fields then pass,
 * while genuinely required fields still fail validation as expected. Present
 * but empty inputs return `""` (not `null`), so they are unaffected.
 */
export function coerceFormValues<T extends Record<string, unknown>>(
  values: T,
): { [K in keyof T]: Exclude<T[K], null> | undefined } {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    const value = values[key];
    out[key] = value === null ? undefined : value;
  }
  return out as { [K in keyof T]: Exclude<T[K], null> | undefined };
}
