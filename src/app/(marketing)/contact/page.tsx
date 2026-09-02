import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Twitter } from "lucide-react";
import { ProsePage } from "@/components/marketing/prose-page";
import { SupportTicketForm } from "@/features/support/components/support-ticket-form";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact Stackivo · Talk to the team",
  description:
    "Get in touch with the Stackivo team. Live chat, email, or send us a detailed message — we usually reply within a few hours during waking hours (IST).",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Stackivo",
    description:
      "Live chat, email, or send a detailed message. Replies within a few hours (IST).",
    url: `${siteConfig.url}/contact`,
  },
};

export const dynamic = "force-static";

export default function ContactPage() {
  return (
    <ProsePage
      title="Talk to us"
      lead={
        <>
          We&apos;re a small team building Stackivo for Indian freelancers. The
          fastest way to reach us is right here — replies usually come within
          a few hours during waking hours (IST).
        </>
      }
    >
      {/* Quick contact tiles */}
      <div className="not-prose grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ContactTile
          icon={<Mail className="h-4 w-4 text-blue-600" />}
          title="Email support"
          description="For account, billing, or any detailed question."
          cta={
            <a href="mailto:support@stackivo.me" className="text-foreground">
              support@stackivo.me
            </a>
          }
        />
        <ContactTile
          icon={<Mail className="h-4 w-4 text-orange-600" />}
          title="Press &amp; partnerships"
          description="Coverage, partnerships, or business inquiries."
          cta={
            <a href="mailto:connect@stackivo.me" className="text-foreground">
              connect@stackivo.me
            </a>
          }
        />
        <ContactTile
          icon={<Twitter className="h-4 w-4 text-info-strong" />}
          title="Twitter / X"
          description="Public DMs are open. Quickest for short questions."
          cta={
            <a
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground"
            >
              @stackivo
            </a>
          }
        />
      </div>

      <h2>Send a detailed message</h2>
      <p>
        Best for bugs, feature requests, or anything that needs context. Every
        message is read by the team.
      </p>

      <div className="not-prose">
        <SupportTicketForm showContactFields={true} channel="contact_form" />
      </div>

      <h2>Looking for something else?</h2>
      <ul>
        <li>
          <Link href="/community">Early community</Link>
        </li>
        <li>
          <Link href="/about">About Stackivo</Link>
        </li>
        <li>
          <Link href="/terms">Terms of service</Link>
        </li>
        <li>
          <Link href="/privacy">Privacy policy</Link>
        </li>
      </ul>
    </ProsePage>
  );
}

function ContactTile({
  icon,
  title,
  description,
  cta,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  cta: React.ReactNode | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      {cta ? <div className="mt-2 text-sm">{cta}</div> : null}
    </div>
  );
}
