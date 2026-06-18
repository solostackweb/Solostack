import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProsePage } from "@/components/marketing/prose-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "What's new in Stackivo · Changelog",
  description:
    "Every shipped feature, fix, and improvement to Stackivo. Updated when we ship — usually weekly.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Stackivo changelog",
    description: "Every shipped feature, fix, and improvement.",
    url: `${siteConfig.url}/changelog`,
  },
};

export const dynamic = "force-static";

/**
 * Public changelog. Hand-curated for now — when ship velocity grows,
 * migrate to a `platform_settings` row or a small CMS.
 *
 * Convention:
 *   - "added" / "improved" / "fixed" tags
 *   - Newest at the top
 *   - Date format: YYYY-MM-DD
 */
interface Entry {
  date: string;
  items: Array<{
    tag: "added" | "improved" | "fixed" | "shipped";
    text: string;
  }>;
}

const ENTRIES: Entry[] = [
  {
    date: "2026-05-14",
    items: [
      {
        tag: "shipped",
        text: "Founder console (`/admin`) v1 — revenue snapshot, user management, audit log.",
      },
      {
        tag: "shipped",
        text: "Built-in live chat + ticketing — first-party support, replies in-app and by email.",
      },
      {
        tag: "added",
        text: "30-day money-back guarantee + risk-reversal strip on /pricing.",
      },
      { tag: "added", text: "Heatmaps + session replay (Microsoft Clarity)." },
    ],
  },
  {
    date: "2026-05-07",
    items: [
      {
        tag: "shipped",
        text: "Automated email delivery via Brevo: invoice sent / paid / overdue notifications.",
      },
      { tag: "improved", text: "Dashboard performance — 40% faster initial paint." },
      { tag: "fixed", text: "GST place-of-supply rules for inter-state invoices." },
    ],
  },
  {
    date: "2026-04-25",
    items: [
      { tag: "shipped", text: "Pulse analytics — revenue, top clients, time analytics." },
      { tag: "shipped", text: "Razorpay subscription billing (Pro plan)." },
    ],
  },
];

const TAG_STYLES: Record<Entry["items"][number]["tag"], string> = {
  shipped:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  added: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  improved:
    "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  fixed:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

export default function ChangelogPage() {
  return (
    <ProsePage
      title="What&rsquo;s new"
      lead={
        <>
          Every feature, fix, and improvement we ship. We build in the open
          &mdash; the roadmap follows the messages our users send us.
        </>
      }
    >
      <p>
        Want a feature?{" "}
        <Link href="/contact">
          Tell us <ArrowRight className="inline h-3 w-3" />
        </Link>
      </p>

      <div className="not-prose space-y-10">
        {ENTRIES.map((entry) => (
          <section key={entry.date}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {formatDate(entry.date)}
            </h2>
            <ul className="mt-3 space-y-2">
              {entry.items.map((item, i) => (
                <li
                  key={`${entry.date}-${i}`}
                  className="flex items-start gap-3 text-sm leading-7"
                >
                  <span
                    className={`mt-1 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TAG_STYLES[item.tag]}`}
                  >
                    {item.tag}
                  </span>
                  <span className="text-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ProsePage>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
