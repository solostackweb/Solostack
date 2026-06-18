import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Security & data protection · Stackivo",
  description:
    "How Stackivo protects your data: row-level workspace isolation, TLS encryption, daily backups, DPDP Act compliance, and your right to export and delete.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Stackivo security",
    description:
      "Workspace isolation, TLS encryption, daily backups, DPDP Act compliance.",
    url: `${siteConfig.url}/security`,
  },
};

export const dynamic = "force-static";

export default function SecurityPage() {
  return (
    <ProsePage
      title="Security &amp; data protection"
      lead={
        <>
          Your invoices, contracts, and client records are some of the most
          sensitive data in your business. Here&rsquo;s how we protect them.
        </>
      }
    >
      <h2>Where your data lives</h2>
      <ul>
        <li>
          <strong>Database + file storage:</strong> Supabase (Frankfurt, EU).
          ISO 27001 + SOC 2 Type II certified.
        </li>
        <li>
          <strong>Email delivery:</strong> Brevo (EU).
        </li>
        <li>
          <strong>Payments:</strong> Razorpay (India). PCI DSS Level 1
          certified.
        </li>
        <li>
          <strong>Error tracking:</strong> Sentry (EU). Personal identifiers
          are scrubbed before being sent.
        </li>
        <li>
          <strong>Analytics:</strong> PostHog (EU). Respects DNT, no PII in
          events.
        </li>
        <li>
          <strong>Customer support:</strong> handled first-party within
          Stackivo; we only see what you choose to send us.
        </li>
      </ul>

      <h2>Encryption</h2>
      <ul>
        <li>
          <strong>In transit:</strong> TLS 1.2 or higher on every connection.
          HTTP &rarr; HTTPS redirects + HSTS.
        </li>
        <li>
          <strong>At rest:</strong> AES-256 encryption on the database and
          object storage layer (Supabase platform default).
        </li>
        <li>
          <strong>Passwords:</strong> bcrypt-hashed by Supabase Auth. We
          never see the plaintext.
        </li>
      </ul>

      <h2>Workspace isolation</h2>
      <p>
        Every row in our database carries a <code>user_id</code>. Postgres
        row-level security policies enforce that no authenticated user can
        ever read or write rows that don&rsquo;t belong to their workspace.
        This is checked at the database layer, not in application code, so
        even a serious application-level bug cannot leak cross-tenant data.
      </p>

      <h2>Backups &amp; durability</h2>
      <ul>
        <li>Automated daily backups, retained for 7 days.</li>
        <li>Point-in-time recovery to any 5-minute window in the last 7 days.</li>
        <li>Database replicated across multiple availability zones.</li>
        <li>Object storage replicated within the EU region.</li>
      </ul>

      <h2>Authentication &amp; session security</h2>
      <ul>
        <li>Email + password (bcrypt) and Google OAuth.</li>
        <li>Multi-factor authentication (TOTP) available in account settings.</li>
        <li>HTTP-only, secure, SameSite session cookies.</li>
        <li>Automatic suspicious-login detection + email alert.</li>
      </ul>

      <h2>Compliance</h2>
      <ul>
        <li>
          <strong>India DPDP Act 2023:</strong> we operate as your data
          fiduciary, with documented retention, export, and deletion rights.
          See <Link href="/privacy">privacy policy</Link>.
        </li>
        <li>
          <strong>GST records retention:</strong> tax-related records (e.g.
          GST invoices) are retained for 8 years per Indian law, even after
          account deletion, in anonymised form.
        </li>
        <li>
          <strong>Subprocessor list:</strong> the providers above are our
          only data processors. Material changes are notified at least 14
          days in advance.
        </li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>Export:</strong> one-click JSON export of every record you
          own, anytime.
        </li>
        <li>
          <strong>Delete:</strong> account closure soft-deletes immediately,
          permanent deletion after a 30-day recovery window.
        </li>
        <li>
          <strong>Correct:</strong> inline editing of any record. For
          identity / login data, email{" "}
          <a href="mailto:support@stackivo.me">support@stackivo.me</a>.
        </li>
        <li>
          <strong>Object:</strong> opt out of analytics any time via the
          account settings.
        </li>
      </ul>

      <h2>Incident response</h2>
      <p>
        If we ever experience a security incident affecting your data,
        we&rsquo;ll notify you by email within 72 hours, with a clear
        description of what happened, what data was involved, and what
        we&rsquo;re doing about it.
      </p>

      <h2>Reporting a vulnerability</h2>
      <p>
        Found a bug or potential vulnerability? Email{" "}
        <a href="mailto:support@stackivo.me">support@stackivo.me</a>. We
        respond within 48 hours and credit responsible disclosures (with your
        permission) on this page.
      </p>

      <h2>Questions?</h2>
      <p>
        Anything else &mdash; reach us at{" "}
        <a href="mailto:support@stackivo.me">support@stackivo.me</a> or via
        the <Link href="/contact">contact page</Link>. We&rsquo;ll happily
        provide a DPA, share infrastructure diagrams, or walk through our
        controls in detail.
      </p>
    </ProsePage>
  );
}
