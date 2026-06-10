import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Rss } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal, StaggerItem, StaggerReveal } from "@/components/marketing/motion";
import { NewsletterForm } from "@/components/marketing/newsletter-form";
import { POSTS } from "@/features/blog/posts";
import type { BlogPost } from "@/features/blog/types";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Blog · Stackivo",
  description:
    "Honest, India-specific writing on freelancer pricing, GST, contracts, taxes, and cashflow. Written by the Stackivo team.",
  alternates: {
    canonical: "/blog",
    types: {
      "application/rss+xml": `${siteConfig.url}/feed.xml`,
    },
  },
  openGraph: {
    title: "Stackivo blog",
    description:
      "India-specific freelancer writing: pricing, GST, contracts, taxes, cashflow.",
    url: `${siteConfig.url}/blog`,
  },
};

export const dynamic = "force-static";

export default function BlogIndexPage() {
  const posts = [...POSTS].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Practical writing for Indian freelancers."
        subtitle="No clickbait, no fluff. Pricing, GST, contracts, taxes, and cashflow — written by the people building Stackivo."
      >
        <Link
          href="/feed.xml"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Rss className="h-3 w-3" />
          Subscribe via RSS
        </Link>
      </PageHero>

      <Section size="ultra">
        {/* Featured — latest post, full-width card */}
        {featured ? (
          <Reveal>
            <Link
              href={`/blog/${featured.slug}`}
              data-cta={`blog_index_${featured.slug}`}
              className="group relative block overflow-hidden rounded-3xl border bg-card p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/[0.06] sm:p-10"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.06] blur-2xl"
              />
              <PostMeta post={featured} latest />
              <h2 className="mt-4 max-w-3xl font-display text-2xl font-semibold tracking-tight transition group-hover:text-primary sm:text-3xl">
                {featured.title}
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-muted-foreground sm:text-base">
                {featured.description}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Read post
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        ) : null}

        {/* The rest — responsive grid */}
        <StaggerReveal className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((p) => (
            <StaggerItem key={p.slug} className="h-full">
              <Link
                href={`/blog/${p.slug}`}
                data-cta={`blog_index_${p.slug}`}
                className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <PostMeta post={p} />
                <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight transition group-hover:text-primary">
                  {p.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  Read post <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerReveal>

        {/* Newsletter band */}
        <Reveal className="mt-12">
          <div className="flex flex-col items-center justify-between gap-5 rounded-3xl border bg-muted/30 px-7 py-8 text-center sm:px-10 lg:flex-row lg:text-left">
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                One practical India-freelancer tip a month.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pricing benchmarks, GST changes, contract templates. No spam, ever.
              </p>
            </div>
            <NewsletterForm
              source="blog_index"
              ctaLabel="Subscribe"
              successLabel="Subscribed. Talk soon."
            />
          </div>
        </Reveal>
      </Section>
    </>
  );
}

function PostMeta({ post, latest }: { post: BlogPost; latest?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-muted-foreground">
      {latest ? (
        <span className="rounded-full bg-primary px-2.5 py-0.5 font-bold text-primary-foreground">
          Latest
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
        <BookOpen className="h-3 w-3" />
        {post.category}
      </span>
      <span>{formatDate(post.publishedAt)}</span>
      <span>·</span>
      <span>{post.readingMinutes} min read</span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
