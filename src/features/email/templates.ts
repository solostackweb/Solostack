import "server-only";

/**
 * Transactional email templates — premium branded layout.
 *
 * Single inline-styled HTML per template — Brevo sends MIME multipart
 * with both HTML and a plaintext fallback. Templates are pure
 * functions of a typed input so callers can't accidentally drop a
 * required token.
 *
 * Design intent: matches the new PDF design system. Brand colour,
 * business name, optional logo, signed footer with contact info. Mobile
 * Outlook-safe (everything is table-based, no flexbox, no `<style>` tag,
 * no class names — only inline styles).
 *
 * The `EmailBrand` shape mirrors the subset of `ResolvedBrand` (in
 * `features/documents/pdf/brand.ts`) that's useful in an HTML email.
 * Templates accept it optionally — when absent we fall back to a clean
 * "Stackivo" envelope so call sites that pre-date the redesign still
 * work unmodified.
 */

// =============================================================================
// Brand shape + tokens
// =============================================================================

export interface EmailBrand {
  businessName: string;
  /** Web URL the email client can render in <img>. Optional. */
  logoUrl: string | null;
  /** `#RRGGBB`. Falls back to the Stackivo primary if absent or invalid. */
  accent: string | null;
  /** Optional contact lines surfaced in the footer. */
  contact?: {
    email?: string | null;
    phone?: string | null;
    website?: string | null;
  };
}

export interface EmailRender {
  subject: string;
  html: string;
  text: string;
}

// Neutral palette — same slate tones we use in the app + PDF.
const COLOR = {
  text: "#0F172A",
  textSoft: "#1E293B",
  muted: "#64748B",
  faint: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primaryDefault: "#2563EB",
  primaryText: "#FFFFFF",
  successBg: "#DCFCE7",
  success: "#15803D",
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// =============================================================================
// Envelope
// =============================================================================

interface EnvelopeInput {
  preheader: string;
  /** Tiny tag rendered above the heading (e.g. "INVOICE", "RECEIPT"). */
  eyebrow?: string;
  /** Big H1 — usually the document or action name. */
  heading: string;
  /** Optional sub-heading rendered as a soft paragraph. */
  subheading?: string;
  /** Body paragraphs rendered as <p>. */
  paragraphs: string[];
  cta?: { label: string; href: string };
  /** Optional facts grid (label / value pairs) rendered as a 2-col card. */
  facts?: { label: string; value: string }[];
  /** Optional secondary "PS" paragraphs rendered after the CTA. */
  secondaryParagraphs?: string[];
  /** Optional success banner shown above the heading (e.g. "PAYMENT RECEIVED"). */
  successBanner?: string;
  /** "Sent by …" line at the foot of the body. */
  signature?: string;
  /** Brand identity — drives accent colour, header, footer contact. */
  brand?: EmailBrand;
}

/**
 * Build the email HTML.
 *
 * Layout (top → bottom):
 *
 *   ─ brand header ─────────────────────────────────────────
 *     {logo} {business name} {right: powered-by-stackivo tag}
 *   ─ optional success banner (green pill)
 *   ─ eyebrow
 *   ─ heading
 *   ─ subheading
 *   ─ paragraphs
 *   ─ facts card (label/value pairs)
 *   ─ CTA button
 *   ─ secondary paragraphs
 *   ─ "—  {sender}" signature line
 *   ─ branded footer with contact + powered-by line
 */
function envelope(input: EnvelopeInput): string {
  const accent = sanitizeColor(input.brand?.accent ?? null) ?? COLOR.primaryDefault;
  const businessName = input.brand?.businessName ?? "Stackivo";
  const logoUrl = input.brand?.logoUrl ?? null;
  const cleanPreheader = input.preheader.replace(/\s+/g, " ").slice(0, 140);

  const eyebrow = input.eyebrow
    ? `<p style="margin:0 0 8px;color:${accent};font-size:11px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;">${escapeHtml(input.eyebrow)}</p>`
    : "";

  const successBanner = input.successBanner
    ? `<div style="margin:0 0 20px;padding:10px 14px;background:${COLOR.successBg};border-radius:8px;color:${COLOR.success};font-weight:700;font-size:13px;letter-spacing:0.6px;text-transform:uppercase;">${escapeHtml(input.successBanner)}</div>`
    : "";

  const subheading = input.subheading
    ? `<p style="margin:0 0 18px;color:${COLOR.muted};font-size:14px;line-height:1.5;">${escapeHtml(input.subheading)}</p>`
    : "";

  const paragraphs = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:${COLOR.textSoft};font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`,
    )
    .join("");

  const facts = input.facts && input.facts.length > 0
    ? buildFactsBlock(input.facts)
    : "";

  const cta = input.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
        <tr>
          <td bgcolor="${accent}" style="border-radius:8px;">
            <a href="${escapeAttr(input.cta.href)}" target="_blank" rel="noreferrer"
              style="display:inline-block;padding:13px 26px;font-family:${FONT_STACK};font-weight:600;font-size:14px;color:${COLOR.primaryText};text-decoration:none;border-radius:8px;">
              ${escapeHtml(input.cta.label)} &nbsp;→
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const sps = (input.secondaryParagraphs ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 10px;color:${COLOR.muted};font-size:13px;line-height:1.55;">${escapeHtml(p)}</p>`,
    )
    .join("");

  const sig = input.signature
    ? `<p style="margin:22px 0 0;color:${COLOR.muted};font-size:13px;">— ${escapeHtml(input.signature)}</p>`
    : "";

  const header = buildHeader({ accent, businessName, logoUrl });
  const footer = buildFooter({ brand: input.brand });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:${FONT_STACK};color:${COLOR.text};">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(cleanPreheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};">
    <tr>
      <td align="center" style="padding:32px 14px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          ${header}
          <tr>
            <td style="background:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:0 0 12px 12px;padding:30px 32px 32px;">
              ${successBanner}
              ${eyebrow}
              <h1 style="margin:0 0 12px;color:${COLOR.text};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.3px;">${escapeHtml(input.heading)}</h1>
              ${subheading}
              ${paragraphs}
              ${facts}
              ${cta}
              ${sps}
              ${sig}
            </td>
          </tr>
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildHeader({
  accent,
  businessName,
  logoUrl,
}: {
  accent: string;
  businessName: string;
  logoUrl: string | null;
}): string {
  const logo = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(businessName)}" width="32" height="32" style="display:block;border-radius:6px;margin-right:10px;border:0;outline:none;" />`
    : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${accent};margin-right:10px;vertical-align:middle;"></span>`;

  return `<tr>
    <td style="background:${COLOR.surface};border:1px solid ${COLOR.border};border-bottom:none;border-radius:12px 12px 0 0;padding:18px 32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            ${logo}<span style="display:inline-block;vertical-align:middle;font-weight:700;font-size:15px;color:${COLOR.text};letter-spacing:-0.1px;">${escapeHtml(businessName)}</span>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="display:inline-block;height:4px;width:36px;border-radius:999px;background:${accent};"></span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function buildFooter({ brand }: { brand?: EmailBrand }): string {
  const businessName = brand?.businessName ?? "Stackivo";
  const contactLines: string[] = [];
  if (brand?.contact?.email) contactLines.push(brand.contact.email);
  if (brand?.contact?.phone) contactLines.push(brand.contact.phone);
  if (brand?.contact?.website) contactLines.push(brand.contact.website);

  const contactBlock =
    contactLines.length > 0
      ? `<p style="margin:0 0 6px;color:${COLOR.muted};font-size:12px;line-height:1.55;">${escapeHtml(contactLines.join(" · "))}</p>`
      : "";

  return `<tr>
    <td style="padding:18px 32px 0;">
      ${contactBlock}
      <p style="margin:6px 0 0;color:${COLOR.faint};font-size:11px;line-height:1.5;">
        Sent by ${escapeHtml(businessName)}. Powered by
        <a href="https://stackivo.in" style="color:${COLOR.faint};text-decoration:none;">Stackivo</a>.
      </p>
    </td>
  </tr>`;
}

function buildFactsBlock(facts: { label: string; value: string }[]): string {
  const rows = facts
    .map(
      (f) => `<tr>
        <td style="padding:6px 0;color:${COLOR.muted};font-size:12px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">${escapeHtml(f.label)}</td>
        <td align="right" style="padding:6px 0;color:${COLOR.text};font-size:14px;font-weight:600;">${escapeHtml(f.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;border:1px solid ${COLOR.border};border-radius:10px;padding:6px 16px;background:${COLOR.bg};">
    ${rows}
  </table>`;
}

function plain(
  paragraphs: string[],
  cta?: { label: string; href: string },
  signature?: string,
  facts?: { label: string; value: string }[],
) {
  const body = paragraphs.join("\n\n");
  const factsText =
    facts && facts.length > 0
      ? `\n\n${facts.map((f) => `${f.label}: ${f.value}`).join("\n")}`
      : "";
  const ctaText = cta ? `\n\n${cta.label}: ${cta.href}` : "";
  const signatureText = signature ? `\n\n— ${signature}` : "\n\n— Stackivo";
  return `${body}${factsText}${ctaText}${signatureText}`;
}

function formatSenderSignature(senderName: string, senderEmail?: string): string {
  return senderEmail ? `${senderName} <${senderEmail}>` : senderName;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function sanitizeColor(value: string | null): string | null {
  if (!value) return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

// =============================================================================
// TEMPLATES
// =============================================================================

// --- Invoice sent ---------------------------------------------------------

export interface InvoiceSentInput {
  invoiceNumber: string;
  amountFormatted: string;
  dueDate: string;
  clientName: string;
  senderName: string;
  senderEmail?: string;
  message: string | null;
  publicUrl: string;
  brand?: EmailBrand;
}

export function renderInvoiceSentEmail(input: InvoiceSentInput): EmailRender {
  const subject = `${input.senderName} sent you invoice ${input.invoiceNumber} — ${input.amountFormatted}`;
  const paragraphs: string[] = [
    `Hi ${input.clientName},`,
    `${input.senderName} has shared a new invoice with you. The full document is attached as a PDF and also available online.`,
  ];
  if (input.message?.trim()) paragraphs.push(input.message.trim());

  const facts = [
    { label: "Invoice", value: input.invoiceNumber },
    { label: "Amount due", value: input.amountFormatted },
    { label: "Due date", value: input.dueDate },
  ];

  return {
    subject,
    html: envelope({
      preheader: `Invoice ${input.invoiceNumber} · ${input.amountFormatted} · due ${input.dueDate}`,
      eyebrow: "Invoice",
      heading: `Invoice ${input.invoiceNumber}`,
      subheading: `${input.amountFormatted} · due ${input.dueDate}`,
      paragraphs,
      facts,
      cta: { label: "View invoice & pay", href: input.publicUrl },
      secondaryParagraphs: [
        "You can pay online securely or download the PDF for your records.",
      ],
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View invoice", href: input.publicUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
      facts,
    ),
  };
}

// --- Invoice reminder ----------------------------------------------------

export interface InvoiceReminderInput extends InvoiceSentInput {
  /**
   * Days relative to the due date. Positive = overdue (D+n); -1 = due
   * tomorrow; <= -2 = due in n days (pre-due heads-up); 0 = due today.
   */
  daysOverdue: number;
  /** When true, this overdue reminder is framed as the final notice. */
  finalNotice?: boolean;
}

export function renderInvoiceReminderEmail(
  input: InvoiceReminderInput,
): EmailRender {
  const isOverdue = input.daysOverdue > 0;
  const isDueToday = input.daysOverdue === 0;
  const isDueTomorrow = input.daysOverdue === -1;
  const isDueSoon = input.daysOverdue <= -2;
  const daysUntil = isDueSoon ? -input.daysOverdue : 0;
  const isFinal = isOverdue && input.finalNotice === true;

  const overdueLine = isOverdue
    ? isFinal
      ? `Final reminder: invoice ${input.invoiceNumber} is ${input.daysOverdue} days past due. Please arrange payment as soon as possible — the amount and pay link below are still valid.`
      : `Invoice ${input.invoiceNumber} is ${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"} past due. The amount and pay link below are still valid.`
    : isDueTomorrow
      ? `Just a heads-up — invoice ${input.invoiceNumber} is due tomorrow (${input.dueDate}). Please arrange payment at your earliest convenience.`
      : isDueToday
        ? `Invoice ${input.invoiceNumber} is due today. Please arrange payment to avoid a late mark.`
        : isDueSoon
          ? `A friendly heads-up — invoice ${input.invoiceNumber} is due in ${daysUntil} days (${input.dueDate}). No action needed yet; sharing early so it's on your radar.`
          : `This is a friendly reminder that invoice ${input.invoiceNumber} is due ${input.dueDate}.`;

  const paragraphs = [`Hi ${input.clientName},`, overdueLine];
  if (input.message?.trim()) paragraphs.push(input.message.trim());

  const subjectLine = isOverdue
    ? isFinal
      ? `Final reminder: invoice ${input.invoiceNumber} is overdue (${input.amountFormatted})`
      : `Reminder: invoice ${input.invoiceNumber} is overdue (${input.amountFormatted})`
    : isDueTomorrow
      ? `Invoice ${input.invoiceNumber} is due tomorrow — ${input.amountFormatted}`
      : isDueToday
        ? `Invoice ${input.invoiceNumber} is due today — ${input.amountFormatted}`
        : isDueSoon
          ? `Invoice ${input.invoiceNumber} is due in ${daysUntil} days — ${input.amountFormatted}`
          : `Reminder: invoice ${input.invoiceNumber} (${input.amountFormatted})`;

  const eyebrow = isOverdue
    ? isFinal
      ? "Final notice"
      : "Overdue invoice"
    : isDueTomorrow || isDueToday || isDueSoon
      ? "Payment due soon"
      : "Payment reminder";

  const heading = isOverdue
    ? `Invoice ${input.invoiceNumber} is overdue`
    : isDueTomorrow
      ? `Due tomorrow`
      : isDueToday
        ? `Due today`
        : isDueSoon
          ? `Due in ${daysUntil} days`
          : `Friendly reminder`;

  const dueDateLabel = isOverdue ? "Days overdue" : "Due date";
  const dueDateValue = isOverdue ? String(input.daysOverdue) : input.dueDate;

  return {
    subject: subjectLine,
    html: envelope({
      preheader: `${eyebrow} · invoice ${input.invoiceNumber} · ${input.amountFormatted}`,
      eyebrow,
      heading,
      subheading: `${input.amountFormatted} · due ${input.dueDate}`,
      paragraphs,
      facts: [
        { label: "Invoice", value: input.invoiceNumber },
        { label: "Amount", value: input.amountFormatted },
        { label: dueDateLabel, value: dueDateValue },
      ],
      cta: { label: "View & pay", href: input.publicUrl },
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View & pay", href: input.publicUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
    ),
  };
}

// --- Contract / Proposal sent --------------------------------------------

export interface ContractSentInput {
  kindLabel: "Contract" | "Proposal";
  title: string;
  clientName: string;
  senderName: string;
  senderEmail?: string;
  message: string | null;
  publicUrl: string;
  brand?: EmailBrand;
}

export function renderContractSentEmail(
  input: ContractSentInput,
): EmailRender {
  const subject = `${input.senderName} sent you a ${input.kindLabel.toLowerCase()}: ${input.title}`;
  const paragraphs = [
    `Hi ${input.clientName},`,
    `${input.senderName} has shared the ${input.kindLabel.toLowerCase()} “${input.title}” with you for review${input.kindLabel === "Contract" ? " and signature" : ""}. The full document is attached as a PDF.`,
  ];
  if (input.message?.trim()) paragraphs.push(input.message.trim());
  return {
    subject,
    html: envelope({
      preheader: `${input.kindLabel} · ${input.title}`,
      eyebrow: input.kindLabel,
      heading: input.title,
      paragraphs,
      cta: {
        label: input.kindLabel === "Contract" ? "Review & sign" : "Review proposal",
        href: input.publicUrl,
      },
      secondaryParagraphs: [
        input.kindLabel === "Contract"
          ? "Signing happens entirely online — no printing, no scanning."
          : "Reply to this email with any questions or change requests.",
      ],
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      {
        label: input.kindLabel === "Contract" ? "Review & sign" : "Review proposal",
        href: input.publicUrl,
      },
      formatSenderSignature(input.senderName, input.senderEmail),
    ),
  };
}

// --- Proposal sent -------------------------------------------------------

export interface ProposalSentInput {
  title: string;
  clientName: string;
  senderName: string;
  senderEmail?: string;
  /** Pre-formatted total (e.g. "₹1,50,000"). */
  amountFormatted: string;
  /** Pre-formatted validity date, when set. */
  validUntil?: string | null;
  message?: string | null;
  publicUrl: string;
  brand?: EmailBrand;
}

export function renderProposalSentEmail(input: ProposalSentInput): EmailRender {
  const subject = `${input.senderName} sent you a proposal: ${input.title}`;
  const paragraphs: string[] = [
    `Hi ${input.clientName},`,
    `${input.senderName} has put together a proposal for you — the scope, deliverables, timeline, and investment are all laid out for review. A PDF copy is attached for your records.`,
  ];
  if (input.message?.trim()) paragraphs.push(input.message.trim());

  const facts = [
    { label: "Proposal", value: input.title },
    { label: "Investment", value: input.amountFormatted },
    ...(input.validUntil ? [{ label: "Valid until", value: input.validUntil }] : []),
  ];

  return {
    subject,
    html: envelope({
      preheader: `Proposal · ${input.title} · ${input.amountFormatted}`,
      eyebrow: "Proposal",
      heading: input.title,
      subheading: `${input.amountFormatted}${input.validUntil ? ` · valid until ${input.validUntil}` : ""}`,
      paragraphs,
      facts,
      cta: { label: "Review proposal", href: input.publicUrl },
      secondaryParagraphs: [
        "Accepting online takes one click and simply confirms the direction — it is not an e-signature contract.",
        "Questions or change requests? Just reply to this email.",
      ],
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "Review proposal", href: input.publicUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
      facts,
    ),
  };
}

// --- Meeting invite (pick a time) ----------------------------------------

export interface MeetingInviteInput {
  topic: string;
  durationMinutes: number;
  clientName: string;
  hostName: string;
  /** Optional context from the host shown as a body paragraph. */
  notes?: string | null;
  publicUrl: string;
  brand?: EmailBrand;
}

export function renderMeetingInviteEmail(input: MeetingInviteInput): EmailRender {
  const subject = `${input.hostName} invites you to book a call — ${input.topic}`;
  const paragraphs: string[] = [
    `Hi ${input.clientName},`,
    `${input.hostName} would like to get on a call with you and has opened up their calendar. Pick whichever time suits you best — it takes a few seconds and you'll get a confirmation right away.`,
  ];
  if (input.notes?.trim()) paragraphs.push(input.notes.trim());

  const facts = [
    { label: "Topic", value: input.topic },
    { label: "Duration", value: `${input.durationMinutes} minutes` },
  ];

  return {
    subject,
    html: envelope({
      preheader: `Book a time for “${input.topic}” (${input.durationMinutes} min)`,
      eyebrow: "Meeting invite",
      heading: input.topic,
      subheading: `${input.durationMinutes}-minute call with ${input.hostName}`,
      paragraphs,
      facts,
      cta: { label: "Choose a time", href: input.publicUrl },
      secondaryParagraphs: [
        "Times are shown in your local timezone on the booking page.",
      ],
      signature: input.hostName,
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "Choose a time", href: input.publicUrl },
      input.hostName,
      facts,
    ),
  };
}

// --- Meeting confirmed ----------------------------------------------------

export interface MeetingConfirmedInput {
  /** Who this copy goes to — wording adapts. */
  audience: "client" | "host";
  topic: string;
  /** Pre-formatted local date + time. */
  whenFormatted: string;
  durationMinutes?: number;
  /** Recipient's name (client) — unused for host copies. */
  clientName?: string;
  hostName: string;
  meetLink?: string | null;
  /** True when an .ics calendar file is attached. */
  hasCalendarAttachment?: boolean;
  brand?: EmailBrand;
}

export function renderMeetingConfirmedEmail(
  input: MeetingConfirmedInput,
): EmailRender {
  const isClient = input.audience === "client";
  const subject = isClient
    ? `You're booked: ${input.topic} — ${input.whenFormatted}`
    : `Client confirmed: ${input.topic} — ${input.whenFormatted}`;

  const paragraphs: string[] = isClient
    ? [
        `Hi ${input.clientName ?? "there"},`,
        `Your call with ${input.hostName} is locked in. We look forward to speaking with you!`,
      ]
    : [
        `Good news — your client just picked a time for “${input.topic}”.`,
        input.meetLink
          ? "The video link is already on the booking, so you're all set."
          : "Add a video link from your Stackivo meetings page so your client can join with one click.",
      ];

  const facts = [
    { label: "Topic", value: input.topic },
    { label: "When", value: input.whenFormatted },
    ...(input.durationMinutes
      ? [{ label: "Duration", value: `${input.durationMinutes} minutes` }]
      : []),
  ];

  return {
    subject,
    html: envelope({
      preheader: `${input.topic} · ${input.whenFormatted}`,
      eyebrow: "Meeting confirmed",
      heading: input.topic,
      subheading: input.whenFormatted,
      successBanner: isClient ? "You're booked" : "Time confirmed",
      paragraphs,
      facts,
      ...(input.meetLink
        ? { cta: { label: "Join the call", href: input.meetLink } }
        : {}),
      secondaryParagraphs: [
        ...(input.hasCalendarAttachment
          ? ["A calendar invite (.ics) is attached — add it so you get a reminder."]
          : []),
        ...(isClient && !input.meetLink
          ? [`${input.hostName} will share the video link before the call.`]
          : []),
      ],
      signature: isClient ? input.hostName : undefined,
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      input.meetLink ? { label: "Join the call", href: input.meetLink } : undefined,
      isClient ? input.hostName : undefined,
      facts,
    ),
  };
}

// --- Questionnaire invite -------------------------------------------------

export interface QuestionnaireInviteInput {
  title: string;
  clientName: string;
  hostName: string;
  questionCount?: number;
  publicUrl: string;
  brand?: EmailBrand;
}

export function renderQuestionnaireInviteEmail(
  input: QuestionnaireInviteInput,
): EmailRender {
  const subject = `${input.hostName} needs a few answers: ${input.title}`;
  const count = input.questionCount && input.questionCount > 0
    ? `${input.questionCount} quick question${input.questionCount === 1 ? "" : "s"}`
    : "a few quick questions";
  const paragraphs = [
    `Hi ${input.clientName},`,
    `To keep your project moving, ${input.hostName} has put together ${count} for you. Your answers go straight to them — no account or sign-in needed.`,
  ];

  return {
    subject,
    html: envelope({
      preheader: `${input.title} · ${count}`,
      eyebrow: "Questionnaire",
      heading: input.title,
      subheading: `${count} from ${input.hostName}`,
      paragraphs,
      cta: { label: "Open the questionnaire", href: input.publicUrl },
      secondaryParagraphs: [
        "Your progress is saved as you answer, and the page is private to you.",
      ],
      signature: input.hostName,
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "Open the questionnaire", href: input.publicUrl },
      input.hostName,
    ),
  };
}

// --- Lead captured (to the freelancer) ------------------------------------

export interface LeadCapturedInput {
  formTitle: string;
  leadName: string;
  leadEmail: string;
  company?: string | null;
  projectSummary: string;
  budget?: string | null;
  timeline?: string | null;
  dashboardUrl: string;
}

export function renderLeadCapturedEmail(input: LeadCapturedInput): EmailRender {
  const subject = `New lead: ${input.leadName}${input.company ? ` (${input.company})` : ""} — ${input.formTitle}`;
  const paragraphs = [
    `${input.leadName} just reached out through your “${input.formTitle}” form. Their project, in their words:`,
    `“${input.projectSummary.slice(0, 600)}”`,
    "Leads cool off fast — a reply within a few hours dramatically improves conversion. Hit reply on this email to answer them directly, or open Stackivo to let Ivo draft the response.",
  ];

  const facts = [
    { label: "Name", value: input.leadName },
    { label: "Email", value: input.leadEmail },
    ...(input.company ? [{ label: "Company", value: input.company }] : []),
    ...(input.budget ? [{ label: "Budget", value: input.budget }] : []),
    ...(input.timeline ? [{ label: "Timeline", value: input.timeline }] : []),
  ];

  return {
    subject,
    html: envelope({
      preheader: `${input.leadName} · ${input.projectSummary.slice(0, 90)}`,
      eyebrow: "New lead",
      heading: `${input.leadName} wants to work with you`,
      subheading: `via ${input.formTitle}`,
      paragraphs,
      facts,
      cta: { label: "Open in Stackivo", href: input.dashboardUrl },
      secondaryParagraphs: [
        "Replying to this email goes straight to the lead — the Reply-To is set to their address.",
      ],
    }),
    text: plain(
      paragraphs,
      { label: "Open in Stackivo", href: input.dashboardUrl },
      undefined,
      facts,
    ),
  };
}

// --- Contract signed copy ------------------------------------------------

export interface ContractSignedCopyInput {
  title: string;
  clientName: string;
  senderName: string;
  senderEmail?: string;
  signedAt: string;
  publicUrl: string;
  brand?: EmailBrand;
}

export function renderContractSignedCopyEmail(
  input: ContractSignedCopyInput,
): EmailRender {
  const subject = `Signed copy: ${input.title}`;
  const paragraphs = [
    `Hi ${input.clientName},`,
    `Your signed copy of "${input.title}" is attached for your records.`,
    `You can also open the signed contract online using the link below.`,
  ];
  const facts = [
    { label: "Contract", value: input.title },
    { label: "Signed on", value: input.signedAt },
  ];

  return {
    subject,
    html: envelope({
      preheader: `Signed copy · ${input.title}`,
      successBanner: "Signed and recorded",
      eyebrow: "Contract",
      heading: `Signed copy`,
      subheading: input.title,
      paragraphs,
      facts,
      cta: { label: "View signed contract", href: input.publicUrl },
      secondaryParagraphs: [
        "Keep the attached PDF with your project records.",
      ],
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View signed contract", href: input.publicUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
      facts,
    ),
  };
}

// --- Invoice paid / Receipt ---------------------------------------------

export interface InvoicePaidInput {
  invoiceNumber: string;
  amountFormatted: string;
  clientName: string;
  senderName: string;
  senderEmail?: string;
  /** When set, surfaces "Receipt RCP-..." as the eyebrow + facts row. */
  receiptNumber?: string;
  /** Pay method label ("UPI", "Stackivo Managed", etc.). */
  paymentMethod?: string;
  /** Pretty-printed paid date for the body. */
  paidAtFormatted?: string;
  /** Reference (Razorpay payment id / UPI UTR). */
  reference?: string;
  /** URL to download the receipt PDF (when generated). */
  receiptUrl?: string;
  brand?: EmailBrand;
}

/** Receipt confirmation sent to the client after a payment is recorded. */
export function renderInvoicePaidEmail(input: InvoicePaidInput): EmailRender {
  const paragraphs = [
    `Hi ${input.clientName},`,
    `Just confirming we've received your payment of ${input.amountFormatted} against invoice ${input.invoiceNumber}. Thank you!`,
  ];
  if (input.receiptNumber) {
    paragraphs.push(
      `Your official receipt — ${input.receiptNumber} — is attached for your records.`,
    );
  }

  const facts: { label: string; value: string }[] = [
    { label: "Amount paid", value: input.amountFormatted },
    { label: "Invoice", value: input.invoiceNumber },
  ];
  if (input.receiptNumber) facts.push({ label: "Receipt", value: input.receiptNumber });
  if (input.paymentMethod) facts.push({ label: "Method", value: input.paymentMethod });
  if (input.paidAtFormatted) facts.push({ label: "Paid on", value: input.paidAtFormatted });
  if (input.reference) facts.push({ label: "Reference", value: input.reference });

  return {
    subject: `Payment received — invoice ${input.invoiceNumber}`,
    html: envelope({
      preheader: `Payment received · ${input.amountFormatted}`,
      successBanner: "Payment received",
      eyebrow: input.receiptNumber ? "Receipt" : "Payment confirmation",
      heading: `Thank you — payment received`,
      subheading: `${input.amountFormatted} settled against invoice ${input.invoiceNumber}`,
      paragraphs,
      facts,
      cta: input.receiptUrl
        ? { label: "Download receipt", href: input.receiptUrl }
        : undefined,
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      input.receiptUrl
        ? { label: "Download receipt", href: input.receiptUrl }
        : undefined,
      formatSenderSignature(input.senderName, input.senderEmail),
      facts,
    ),
  };
}

// --- Welcome document ----------------------------------------------------

export interface WelcomeDocumentSentInput {
  title: string;
  clientName: string;
  senderName: string;
  senderEmail?: string;
  message: string | null;
  publicUrl: string;
  brand?: EmailBrand;
}

export function renderWelcomeDocumentEmail(
  input: WelcomeDocumentSentInput,
): EmailRender {
  const subject = `${input.senderName} sent you an onboarding guide: ${input.title}`;
  const paragraphs = [
    `Hi ${input.clientName},`,
    `${input.senderName} has put together a short onboarding guide — “${input.title}” — covering how the engagement will run, communication, response times, and what to expect at each stage.`,
    `It's a five-minute read and answers most of the questions clients ask along the way. Worth skimming before we kick things off.`,
  ];
  if (input.message?.trim()) paragraphs.push(input.message.trim());
  return {
    subject,
    html: envelope({
      preheader: `Onboarding guide · ${input.title}`,
      eyebrow: "Welcome Guide",
      heading: input.title,
      subheading: "A quick five-minute read",
      paragraphs,
      cta: { label: "Read the guide", href: input.publicUrl },
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "Read the guide", href: input.publicUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
    ),
  };
}

// --- Portal invite -------------------------------------------------------

export interface PortalInviteInput {
  portalName: string;
  clientName: string | null;
  senderName: string;
  senderEmail?: string;
  acceptUrl: string;
  expiresIso: string;
  brand?: EmailBrand;
}

export function renderPortalInviteEmail(input: PortalInviteInput): EmailRender {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hello,";
  const expiry = new Date(input.expiresIso);
  const expiryHuman = isNaN(expiry.getTime())
    ? "soon"
    : expiry.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
  const paragraphs = [
    greeting,
    `${input.senderName} has invited you to ${input.portalName}.`,
    `Use the button below to open the portal and set up access. This invitation expires on ${expiryHuman}.`,
  ];
  return {
    subject: `Invitation to ${input.portalName}`,
    html: envelope({
      preheader: `Open your invitation to ${input.portalName}`,
      eyebrow: "Client Portal",
      heading: `Invitation to ${input.portalName}`,
      subheading: `Expires ${expiryHuman}`,
      paragraphs,
      cta: { label: "Open portal", href: input.acceptUrl },
      secondaryParagraphs: [
        "You will verify the invited email with a one-time code before the portal opens.",
      ],
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "Open portal", href: input.acceptUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
    ),
  };
}

// --- Portal access code --------------------------------------------------

export interface PortalAccessCodeInput {
  code: string;
  portalName?: string | null;
  expiresMinutes: number;
}

export function renderPortalAccessCodeEmail(
  input: PortalAccessCodeInput,
): EmailRender {
  const portalLabel = input.portalName ?? "your client portal";
  const paragraphs = [
    `Use this code to open ${portalLabel}:`,
    input.code,
    `This code expires in ${input.expiresMinutes} minutes. If you did not request it, you can ignore this email.`,
  ];

  return {
    subject: `Your Stackivo portal code is ${input.code}`,
    html: envelope({
      preheader: `Your portal code is ${input.code}`,
      eyebrow: "Client Portal",
      heading: input.code,
      subheading: `Your one-time code for ${portalLabel}`,
      paragraphs: [
        `Use this one-time code to open ${portalLabel}.`,
        `It expires in ${input.expiresMinutes} minutes. If you did not request it, you can ignore this email.`,
      ],
      signature: "Stackivo <connect@stackivo.me>",
    }),
    text: plain(paragraphs, undefined, "Stackivo <connect@stackivo.me>"),
  };
}

// =============================================================================
// PORTAL EVENT TEMPLATES
// =============================================================================

// --- Portal update posted (owner → client) --------------------------------

export interface PortalUpdatePostedInput {
  portalName: string;
  clientName: string | null;
  senderName: string;
  senderEmail?: string;
  updateTitle: string;
  updateType: string;
  body: string | null;
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderPortalUpdatePostedEmail(
  input: PortalUpdatePostedInput,
): EmailRender {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hello,";
  const typeLabel =
    input.updateType === "deliverable"
      ? "deliverable"
      : input.updateType === "revision"
        ? "revision"
        : input.updateType === "milestone"
          ? "milestone update"
          : "project update";

  const paragraphs: string[] = [
    greeting,
    `${input.senderName} has posted a new ${typeLabel} in your portal: *${input.updateTitle}*`,
  ];
  if (input.body?.trim()) paragraphs.push(input.body.trim().slice(0, 300));

  return {
    subject: `New ${typeLabel}: ${input.updateTitle} — ${input.portalName}`,
    html: envelope({
      preheader: `${input.senderName} posted "${input.updateTitle}" in ${input.portalName}`,
      eyebrow: "Portal Update",
      heading: input.updateTitle,
      subheading: `${input.portalName} · ${typeLabel}`,
      paragraphs,
      cta: { label: "View in portal", href: input.portalUrl },
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View in portal", href: input.portalUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
    ),
  };
}

// --- Portal weekly digest (owner → client) -------------------------------

export interface PortalWeeklyDigestInput {
  portalName: string;
  clientName: string | null;
  senderName: string;
  senderEmail?: string;
  /** Summary lines, e.g. "New updates" → "2". */
  facts: { label: string; value: string }[];
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderPortalWeeklyDigestEmail(
  input: PortalWeeklyDigestInput,
): EmailRender {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hello,";
  const paragraphs: string[] = [
    greeting,
    `Here's what moved in your "${input.portalName}" workspace this past week.`,
  ];

  return {
    subject: `Your weekly update — ${input.portalName}`,
    html: envelope({
      preheader: `This week in ${input.portalName}`,
      eyebrow: "Weekly Digest",
      heading: "This week's progress",
      subheading: input.portalName,
      paragraphs,
      facts: input.facts,
      cta: { label: "Open your portal", href: input.portalUrl },
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "Open your portal", href: input.portalUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
      input.facts,
    ),
  };
}

// --- Portal meeting requested (client → owner) ---------------------------

export interface PortalMeetingRequestedInput {
  portalName: string;
  ownerName: string;
  requesterName: string | null;
  topic: string;
  proposedTime: string | null;
  notes: string | null;
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderPortalMeetingRequestedEmail(
  input: PortalMeetingRequestedInput,
): EmailRender {
  const greeting = `Hi ${input.ownerName},`;
  const requester = input.requesterName ?? "Your client";
  const paragraphs: string[] = [
    greeting,
    `${requester} has requested a meeting in portal "${input.portalName}".`,
  ];
  if (input.notes?.trim()) paragraphs.push(input.notes.trim().slice(0, 300));

  const facts: { label: string; value: string }[] = [
    { label: "Topic", value: input.topic },
  ];
  if (input.proposedTime) facts.push({ label: "Proposed time", value: input.proposedTime });

  return {
    subject: `Meeting requested: ${input.topic} — ${input.portalName}`,
    html: envelope({
      preheader: `${requester} requested a meeting in ${input.portalName}`,
      eyebrow: "Meeting Request",
      heading: input.topic,
      subheading: input.portalName,
      paragraphs,
      facts,
      cta: { label: "View & respond", href: input.portalUrl },
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View & respond", href: input.portalUrl },
      undefined,
      facts,
    ),
  };
}

// --- Portal meeting confirmed (owner → client) ----------------------------

export interface PortalMeetingConfirmedInput {
  portalName: string;
  clientName: string | null;
  senderName: string;
  senderEmail?: string;
  topic: string;
  proposedTime: string | null;
  meetLink: string | null;
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderPortalMeetingConfirmedEmail(
  input: PortalMeetingConfirmedInput,
): EmailRender {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hello,";
  const paragraphs: string[] = [
    greeting,
    `Your meeting request has been confirmed in portal "${input.portalName}".`,
  ];
  if (input.meetLink) {
    paragraphs.push(`Join via: ${input.meetLink}`);
  }

  const facts: { label: string; value: string }[] = [
    { label: "Topic", value: input.topic },
  ];
  if (input.proposedTime) facts.push({ label: "Time", value: input.proposedTime });
  if (input.meetLink) facts.push({ label: "Join link", value: input.meetLink });

  return {
    subject: `Meeting confirmed: ${input.topic} — ${input.portalName}`,
    html: envelope({
      preheader: `Your meeting "${input.topic}" is confirmed`,
      successBanner: "Meeting confirmed",
      eyebrow: "Meeting",
      heading: input.topic,
      subheading: input.proposedTime ?? input.portalName,
      paragraphs,
      facts,
      cta: input.meetLink
        ? { label: "Join meeting", href: input.meetLink }
        : { label: "View in portal", href: input.portalUrl },
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      input.meetLink
        ? { label: "Join meeting", href: input.meetLink }
        : { label: "View in portal", href: input.portalUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
      facts,
    ),
  };
}

// --- Portal update approved (client → owner) ------------------------------

export interface PortalUpdateApprovedInput {
  portalName: string;
  ownerName: string;
  approverName: string | null;
  updateTitle: string;
  comment: string | null;
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderPortalUpdateApprovedEmail(
  input: PortalUpdateApprovedInput,
): EmailRender {
  const approver = input.approverName ?? "Your client";
  const paragraphs: string[] = [
    `Hi ${input.ownerName},`,
    `${approver} has approved "${input.updateTitle}" in portal "${input.portalName}".`,
  ];
  if (input.comment?.trim()) paragraphs.push(`Their note: "${input.comment.trim()}"`);

  return {
    subject: `Approved: ${input.updateTitle} — ${input.portalName}`,
    html: envelope({
      preheader: `${approver} approved "${input.updateTitle}"`,
      successBanner: "Approved",
      eyebrow: "Approval",
      heading: `"${input.updateTitle}" approved`,
      subheading: input.portalName,
      paragraphs,
      cta: { label: "View in portal", href: input.portalUrl },
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View in portal", href: input.portalUrl },
    ),
  };
}

// --- Portal revision requested (client → owner) ---------------------------

export interface PortalRevisionRequestedInput {
  portalName: string;
  ownerName: string;
  requesterName: string | null;
  updateTitle: string;
  comment: string | null;
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderPortalRevisionRequestedEmail(
  input: PortalRevisionRequestedInput,
): EmailRender {
  const requester = input.requesterName ?? "Your client";
  const paragraphs: string[] = [
    `Hi ${input.ownerName},`,
    `${requester} has requested revisions for "${input.updateTitle}" in portal "${input.portalName}".`,
  ];
  if (input.comment?.trim()) paragraphs.push(`Their feedback: "${input.comment.trim()}"`);

  return {
    subject: `Revision requested: ${input.updateTitle} — ${input.portalName}`,
    html: envelope({
      preheader: `${requester} requested revisions on "${input.updateTitle}"`,
      eyebrow: "Revision Requested",
      heading: `Revision requested`,
      subheading: `"${input.updateTitle}" · ${input.portalName}`,
      paragraphs,
      cta: { label: "View feedback", href: input.portalUrl },
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View feedback", href: input.portalUrl },
    ),
  };
}

// --- Portal file uploaded (owner → client) --------------------------------

export interface PortalFileUploadedInput {
  portalName: string;
  clientName: string | null;
  senderName: string;
  senderEmail?: string;
  fileName: string;
  fileCount: number;
  portalUrl: string;
  brand?: EmailBrand;
}

export function renderPortalFileUploadedEmail(
  input: PortalFileUploadedInput,
): EmailRender {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hello,";
  const fileDesc =
    input.fileCount === 1
      ? `a new file — "${input.fileName}"`
      : `${input.fileCount} new files`;

  const paragraphs = [
    greeting,
    `${input.senderName} has uploaded ${fileDesc} to your portal "${input.portalName}".`,
  ];

  return {
    subject: `New file${input.fileCount > 1 ? "s" : ""} in ${input.portalName}`,
    html: envelope({
      preheader: `${input.senderName} uploaded ${fileDesc} to ${input.portalName}`,
      eyebrow: "Files",
      heading: `New file${input.fileCount > 1 ? "s" : ""} shared`,
      subheading: input.portalName,
      paragraphs,
      cta: { label: "View files", href: input.portalUrl },
      signature: formatSenderSignature(input.senderName, input.senderEmail),
      brand: input.brand,
    }),
    text: plain(
      paragraphs,
      { label: "View files", href: input.portalUrl },
      formatSenderSignature(input.senderName, input.senderEmail),
    ),
  };
}

// =============================================================================
// Brand resolver helper for senders
// =============================================================================

/**
 * Build an `EmailBrand` from the raw profile columns most senders pull.
 * Callers that already have a `UserProfileRow` should pass the relevant
 * subset; the helper guards against null/empty values.
 */
export function buildEmailBrand(input: {
  businessName?: string | null;
  legalName?: string | null;
  fullName?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
}): EmailBrand {
  return {
    businessName:
      input.businessName ??
      input.legalName ??
      input.fullName ??
      "Stackivo",
    logoUrl: input.logoUrl ?? null,
    accent: input.brandColor ?? null,
    contact: {
      email: input.businessEmail ?? input.email ?? null,
      phone: input.businessPhone ?? input.phone ?? null,
      website: input.website ?? null,
    },
  };
}


// ---------------------------------------------------------------------------
// Subscription renewal reminder (autopay pre-debit courtesy notice)
// ---------------------------------------------------------------------------

export interface SubscriptionRenewalInput {
  planName: string;
  amountFormatted: string;
  /** Pre-formatted renewal / next-charge date. */
  renewsOn: string;
  manageUrl: string;
  senderEmail: string;
}

/**
 * Sent ~3 days before an autopay renewal. The mandatory 24h pre-debit
 * notification is sent by Razorpay (the payment aggregator); this is an
 * earlier courtesy heads-up with the amount, date, and a manage/cancel link.
 */
export function renderSubscriptionRenewalEmail(
  input: SubscriptionRenewalInput,
): EmailRender {
  const paragraphs = [
    "Hi,",
    `This is a heads-up that your Stackivo ${input.planName} subscription will auto-renew on ${input.renewsOn} for ${input.amountFormatted}.`,
    "No action is needed to continue. If you'd like to make changes, you can update or cancel your subscription any time before the renewal date — you'll keep access until the current period ends.",
    "Questions about a charge? Reply to this email and we'll help.",
  ];
  const cta = { label: "Manage subscription", href: input.manageUrl };
  const signature = formatSenderSignature("Stackivo Billing", input.senderEmail);
  return {
    subject: `Your Stackivo ${input.planName} renews on ${input.renewsOn} — ${input.amountFormatted}`,
    html: envelope({
      preheader: `Upcoming renewal · ${input.amountFormatted} on ${input.renewsOn}`,
      eyebrow: "Upcoming renewal",
      heading: `Your ${input.planName} plan renews soon`,
      subheading: `${input.amountFormatted} · ${input.renewsOn}`,
      paragraphs,
      facts: [
        { label: "Plan", value: input.planName },
        { label: "Amount", value: input.amountFormatted },
        { label: "Renews on", value: input.renewsOn },
      ],
      cta,
      signature,
    }),
    text: plain(paragraphs, cta, signature),
  };
}
// --- Support: ticket received (to customer) ------------------------------

export interface SupportTicketReceivedInput {
  customerName?: string | null;
  subject: string;
  slaLabel: string;
  threadUrl: string;
  senderEmail: string;
}

/** Auto-acknowledgement when a new support ticket is created. */
export function renderSupportTicketReceivedEmail(
  input: SupportTicketReceivedInput,
): EmailRender {
  const hi = input.customerName ? `Hi ${input.customerName},` : "Hi,";
  const paragraphs = [
    hi,
    `Thanks for reaching out — we've received your request and created a support ticket. Our typical first response: ${input.slaLabel}.`,
    `You can view the conversation and add anything you forgot using the link below. You can also just reply to this email and it will be added to the same thread.`,
  ];
  const cta = { label: "View your ticket", href: input.threadUrl };
  const signature = formatSenderSignature("Stackivo Support", input.senderEmail);
  return {
    subject: `We got your message: ${input.subject}`,
    html: envelope({
      preheader: `Ticket received · ${input.subject}`,
      eyebrow: "Support",
      heading: "We've got your request",
      subheading: input.subject,
      paragraphs,
      facts: [{ label: "Typical first response", value: input.slaLabel }],
      cta,
      signature,
    }),
    text: plain(paragraphs, cta, signature),
  };
}

// --- Support: agent reply (to customer) ----------------------------------

export interface SupportReplyInput {
  customerName?: string | null;
  subject: string;
  replyBody: string;
  threadUrl: string;
  senderName: string;
  senderEmail: string;
}

/** Sent to the customer when the founder/agent replies to their ticket. */
export function renderSupportReplyEmail(input: SupportReplyInput): EmailRender {
  const hi = input.customerName ? `Hi ${input.customerName},` : "Hi,";
  const paragraphs = [hi, input.replyBody, "Reply to this email to continue the conversation."];
  const cta = { label: "Open the conversation", href: input.threadUrl };
  const signature = formatSenderSignature(input.senderName, input.senderEmail);
  return {
    subject: `Re: ${input.subject}`,
    html: envelope({
      preheader: `Reply · ${input.subject}`,
      eyebrow: "Support",
      heading: "A reply to your request",
      subheading: input.subject,
      paragraphs,
      cta,
      signature,
    }),
    text: plain(paragraphs, cta, signature),
  };
}

// --- Support: new ticket alert (to founder) ------------------------------

export interface SupportAdminAlertInput {
  subject: string;
  category: string;
  plan: string;
  fromEmail: string;
  excerpt: string;
  adminUrl: string;
}

/** Internal heads-up to the founder when a new ticket arrives. */
export function renderSupportAdminAlertEmail(
  input: SupportAdminAlertInput,
): EmailRender {
  const paragraphs = [
    `New ${input.plan} support ticket from ${input.fromEmail}.`,
    input.excerpt,
  ];
  const cta = { label: "Open in admin", href: input.adminUrl };
  const signature = "Stackivo";
  return {
    subject: `[${input.plan}/${input.category}] ${input.subject}`,
    html: envelope({
      preheader: `New ticket · ${input.fromEmail}`,
      eyebrow: "New support ticket",
      heading: input.subject,
      paragraphs,
      facts: [
        { label: "From", value: input.fromEmail },
        { label: "Plan", value: input.plan },
        { label: "Category", value: input.category },
      ],
      cta,
      signature,
    }),
    text: plain(paragraphs, cta, signature),
  };
}
