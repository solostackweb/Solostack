import type { Metadata } from "next";
import Link from "next/link";
import { Play, ArrowRight, MessageCircle } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { env } from "@/config/env";

export const metadata: Metadata = {
  title: "Stackivo demo · See it work in 90 seconds",
  description:
    "A 90-second walkthrough: signup, first GST invoice, and the Pulse revenue view. No sign-up required.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Stackivo demo",
    description: "See Stackivo end-to-end in 90 seconds.",
    url: `${siteConfig.url}/demo`,
  },
};

export const dynamic = "force-static";

/**
 * /demo — embedded YouTube or Loom walkthrough (or placeholder when unset).
 */
export default function DemoPage() {
  const videoUrl = toVideoEmbedUrl(env.demoVideoUrl);

  return (
    <>
      <PageHero
        eyebrow="Stackivo in 90 seconds"
        title="See it work end-to-end."
        subtitle="Signup → first GST invoice → Pulse revenue view. Real screen, no fluff."
      />

      <Section size="default" className="pb-14 sm:pb-16">
        {videoUrl ? (
          <div className="mx-auto max-w-3xl">
            <div className="overflow-hidden rounded-lg border bg-card shadow-xl">
              <div className="relative aspect-video">
                <iframe
                  src={videoUrl}
                  title="Stackivo 90-second product demo"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Play className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium">Demo video coming soon</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  We&rsquo;re recording a 90-second walkthrough. In the
                  meantime, the fastest way to see Stackivo is to spin up a
                  free workspace.
                </p>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/signup">
                    Start free <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Button asChild size="lg" className="h-11">
            <Link href="/signup">
              Start free in 60 seconds <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11">
            <Link href="/talk">
              <MessageCircle className="mr-2 h-4 w-4" />
              Talk to founder
            </Link>
          </Button>
        </div>
      </Section>
    </>
  );
}

function toVideoEmbedUrl(value: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.pathname.startsWith("/shorts/")
        ? url.pathname.split("/")[2]
        : url.pathname.startsWith("/embed/")
          ? url.pathname.split("/")[2]
          : url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }

    if (host === "loom.com") {
      const match = url.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      return match ? `https://www.loom.com/embed/${match[1]}` : "";
    }
  } catch {
    return "";
  }

  return "";
}
