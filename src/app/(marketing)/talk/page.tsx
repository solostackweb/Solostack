import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, MessageCircle, Mail } from "lucide-react";
import { ProsePage } from "@/components/marketing/prose-page";
import { siteConfig } from "@/config/site";
import { env } from "@/config/env";

export const metadata: Metadata = {
  title: "Talk to the founder · Stackivo",
  description:
    "Book a 30-minute call with the Stackivo team. Chat through your freelance setup, GST workflow, or anything you'd like to see in the product.",
  alternates: { canonical: "/talk" },
  openGraph: {
    title: "Talk to the Stackivo team",
    description: "Book a 30-minute call. Free. India-friendly hours (IST).",
    url: `${siteConfig.url}/talk`,
  },
};

export const dynamic = "force-static";

export default function TalkPage() {
  const calUrl = env.calComUrl;

  return (
    <ProsePage
      title="Talk to us"
      lead={
        <>
          Book a 30-minute call with the team. We&rsquo;ll walk through your
          freelance setup, your invoicing pain points, and whether Stackivo is
          a fit. No sales pressure. India-friendly hours (IST).
        </>
      }
    >
      {calUrl ? (
        <div className="not-prose">
          <div className="overflow-hidden rounded-xl border bg-card">
            <iframe
              src={calUrl}
              title="Book a 30-minute call with the Stackivo team"
              className="h-[720px] w-full"
              loading="lazy"
            />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Powered by Cal.com · Slots in your timezone
          </p>
        </div>
      ) : (
        <div className="not-prose rounded-xl border border-dashed bg-muted/30 p-6 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Calendar className="h-4 w-4" />
            Booking calendar coming soon
          </div>
          <p className="mt-2 text-muted-foreground">
            We haven&rsquo;t published our public calendar yet. In the
            meantime, the fastest ways to reach us are:
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>
                <strong>Live chat</strong> — open the chat icon at the
                bottom-right.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-blue-600" />
              <span>
                <strong>Email</strong> —{" "}
                <a
                  href="mailto:support@stackivo.me"
                  className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
                >
                  support@stackivo.me
                </a>
                . Replies usually within a few hours (IST).
              </span>
            </li>
          </ul>
        </div>
      )}

      <h2>What we&rsquo;ll cover</h2>
      <ul>
        <li>Where you are with invoicing today (tools, pain points, GST setup).</li>
        <li>How Stackivo would fit your day-to-day workflow.</li>
        <li>Anything missing — feature requests go straight on the roadmap.</li>
        <li>Pricing, migration, data export — whatever you&rsquo;d like.</li>
      </ul>

      <h2>Prefer to skip the call?</h2>
      <p>
        Totally fine.{" "}
        <Link href="/signup">Start free</Link> and explore the product
        yourself. Or open the live chat at the bottom-right of any page.
      </p>
    </ProsePage>
  );
}
