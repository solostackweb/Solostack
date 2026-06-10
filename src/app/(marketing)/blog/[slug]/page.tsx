import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Calendar } from "lucide-react";
import { ProsePage } from "@/components/marketing/prose-page";
import { Section } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/motion";
import { Button } from "@/components/ui/button";
import { NewsletterForm } from "@/components/marketing/newsletter-form";
import { POSTS, getPostBySlug } from "@/features/blog/posts";
import { siteConfig } from "@/config/site";

interface RouteParams {
  slug: string;
}

export function generateStaticParams(): RouteParams[] {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: `${post.title} · Stackivo`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${siteConfig.url}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
    },
  };
}

export const dynamic = "force-static";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Compute "next post" link for end-of-post nav.
  const sorted = [...POSTS].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  const idx = sorted.findIndex((p) => p.slug === post.slug);
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  return (
    <>
      <ProsePage
        title={post.title}
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <BookOpen className="h-3 w-3" />
              {post.category}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {formatDate(post.publishedAt)}
            </span>
            <span>·</span>
            <span>{post.readingMinutes} min read</span>
          </span>
        }
      >
        {post.body}

        {/* JSON-LD for SEO. Article schema, fully filled. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
              {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${siteConfig.url}/blog` },
                { "@type": "ListItem", position: 3, name: post.title, item: `${siteConfig.url}/blog/${post.slug}` },
              ],
              },
              {
              "@type": "Article",
              headline: post.title,
              description: post.description,
              author: {
                "@type": "Organization",
                name: siteConfig.name,
                url: siteConfig.url,
              },
              publisher: {
                "@type": "Organization",
                name: siteConfig.name,
                url: siteConfig.url,
              },
              datePublished: post.publishedAt,
              dateModified: post.updatedAt ?? post.publishedAt,
              mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
              },
              ],
            }),
          }}
        />
      </ProsePage>

      {/* Closing CTA + newsletter + next-post nav */}
      <Section size="default" className="pb-8">
        <Reveal>
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Stackivo turns freelance admin into 10 clicks a week.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              GST invoices, contracts, time tracking, payments, reminders &mdash;
              one workspace. Free forever for your first 5 clients.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-11">
                <Link href="/signup" data-cta={`blog_${post.slug}_signup`}>
                  Start free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11">
                <Link href="/pricing" data-cta={`blog_${post.slug}_pricing`}>
                  See pricing
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section size="default" className="pb-16">
        <Reveal>
          <div className="mx-auto max-w-xl rounded-xl border bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium">
              Get one practical tip a month.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              India-specific freelancing &mdash; pricing, GST, cashflow. No spam.
            </p>
            <div className="mt-4 flex justify-center">
              <NewsletterForm
                source={`blog_post_${post.slug}`}
                ctaLabel="Subscribe"
                successLabel="Subscribed. Talk soon."
              />
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Next / back navigation */}
      <Section size="default" className="pb-24">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All posts
          </Link>
          {next ? (
            <Link
              href={`/blog/${next.slug}`}
              className="group inline-flex max-w-md flex-col items-end rounded-lg border bg-card p-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Read next
              </span>
              <span className="mt-0.5 text-sm font-semibold transition group-hover:text-primary">
                {next.title} <ArrowRight className="ml-0.5 inline h-3 w-3" />
              </span>
            </Link>
          ) : null}
        </div>
      </Section>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
