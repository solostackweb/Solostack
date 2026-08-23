/**
 * Page-aware opening prompts: when Ivo is opened from a workspace section
 * without an explicit question, offer two or three prompts grounded in what
 * that section shows.
 *
 * Deliberately dependency-free and deterministic: no model call, no extra
 * reads - the same prompts any user could type, just one tap away. Phrasing
 * aligns with the deterministic lanes (meeting lists, record lists) where they
 * exist, so most taps take the fast path end to end.
 */

const PAGE_PROMPTS: Array<{ pattern: RegExp; prompts: string[] }> = [
  {
    pattern: /\/dashboard\/invoices/,
    prompts: [
      "Show my unpaid invoices",
      "How much am I owed right now?",
      "Send payment reminders for overdue invoices",
    ],
  },
  {
    pattern: /\/dashboard\/clients/,
    prompts: [
      "Show my clients",
      "Which clients should get a portal next?",
      "Help me add my first client.",
    ],
  },
  {
    pattern: /\/dashboard\/projects/,
    prompts: [
      "Show active projects",
      "What unbilled time should I invoice?",
    ],
  },
  {
    pattern: /\/dashboard\/contracts/,
    prompts: [
      "Show contracts waiting on signatures",
      "Help me draft my first contract.",
    ],
  },
  {
    pattern: /\/dashboard\/proposals/,
    prompts: [
      "Show pending proposals",
      "Help me draft a proposal",
    ],
  },
  {
    pattern: /\/dashboard\/meetings/,
    prompts: [
      "What meetings do I have coming up?",
      "Which meetings are awaiting a time pick?",
    ],
  },
  {
    pattern: /\/dashboard\/time/,
    prompts: [
      "Review my unbilled time by client and project",
      "Create an invoice for my unbilled time",
    ],
  },
  {
    pattern: /\/dashboard\/welcome/,
    prompts: ["Show my open welcome documents"],
  },
];

/** Prompts for a dashboard path, or [] when the page needs none. */
export function pagePromptsForPath(pathname: string | null | undefined): string[] {
  if (!pathname) return [];
  const found = PAGE_PROMPTS.find((entry) => entry.pattern.test(pathname));
  return found ? [...found.prompts] : [];
}
