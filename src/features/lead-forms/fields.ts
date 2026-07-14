/**
 * Lead-form field model.
 *
 * A form's questions live in `lead_forms.fields` (jsonb). Known "standard"
 * fields map to dedicated `lead_submissions` columns; anything else is a
 * "custom" question whose answer is stored in `lead_submissions.answers`.
 *
 * The builder edits this list (toggle/require standard fields, add custom
 * text/textarea questions); the public form renders from it; the submit
 * action reads it to know which answers to collect.
 */

export type LeadFieldType = "text" | "email" | "tel" | "textarea";

export interface LeadFormField {
  /** Stable key. Standard fields use their canonical name; custom use `q_*`. */
  name: string;
  label: string;
  type: LeadFieldType;
  required: boolean;
  /** True for user-added questions (answer stored in the `answers` jsonb). */
  custom?: boolean;
}

/** Always shown, always required — the minimum viable lead. */
export const CORE_LEAD_FIELDS = new Set(["name", "email", "project"]);

/** Standard fields a form can include, in canonical order. */
export const STANDARD_LEAD_FIELDS: readonly LeadFormField[] = [
  { name: "name", label: "Your name", type: "text", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "company", label: "Company / brand", type: "text", required: false },
  { name: "country", label: "Country", type: "text", required: false },
  { name: "phone", label: "Phone", type: "tel", required: false },
  { name: "project", label: "What do you want help with?", type: "textarea", required: true },
  { name: "budget", label: "Budget", type: "text", required: false },
  { name: "timeline", label: "Timeline", type: "text", required: false },
];

const STANDARD_NAMES = new Set(STANDARD_LEAD_FIELDS.map((f) => f.name));

export function isStandardFieldName(name: string): boolean {
  return STANDARD_NAMES.has(name);
}

/** Prefix that carries a custom answer through the public form's FormData. */
export const CUSTOM_FIELD_PREFIX = "custom__";

/**
 * Turn a stored fields jsonb (possibly null / legacy) into a clean, ordered
 * list we can render. Guarantees the core fields exist + stay required, and
 * drops the derived `currency` field (handled by the country control).
 */
export function normalizeLeadFields(raw: unknown): LeadFormField[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: LeadFormField[] = [];
  const seen = new Set<string>();

  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name || name === "currency" || seen.has(name)) continue;

    const custom = !STANDARD_NAMES.has(name);
    const rawType = r.type as LeadFieldType;
    const type: LeadFieldType = (
      ["text", "email", "tel", "textarea"] as const
    ).includes(rawType)
      ? rawType
      : "text";

    out.push({
      name,
      label:
        typeof r.label === "string" && r.label.trim() ? r.label.trim() : name,
      // Custom questions are limited to text / textarea.
      type: custom ? (type === "textarea" ? "textarea" : "text") : type,
      required: CORE_LEAD_FIELDS.has(name) ? true : Boolean(r.required),
      custom: custom || undefined,
    });
    seen.add(name);
  }

  // Guarantee the core fields exist even if a legacy/blank config omitted them.
  for (const core of STANDARD_LEAD_FIELDS) {
    if (CORE_LEAD_FIELDS.has(core.name) && !seen.has(core.name)) {
      out.push({ ...core });
      seen.add(core.name);
    }
  }

  return out.length ? out : STANDARD_LEAD_FIELDS.map((f) => ({ ...f }));
}

/** Generate a stable custom field name from a label. */
export function makeCustomFieldName(
  label: string,
  existing: Set<string>,
): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "question";
  let name = `q_${base}`;
  let i = 2;
  while (existing.has(name)) name = `q_${base}_${i++}`;
  return name;
}
