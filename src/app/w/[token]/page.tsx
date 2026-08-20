import * as React from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BookOpen, Download } from "lucide-react";

import {
  getSharedWelcomeDocument,
  recordWelcomeView,
} from "@/features/welcome-documents/server";
import { parseWelcomeContent } from "@/features/welcome-documents/content";
import { WelcomeMarkdown } from "@/features/welcome-documents/markdown";
import type { WelcomeDocumentRow } from "@/lib/supabase/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { BRAND_PRIMARY } from "@/config/brand-colors";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const doc = await getSharedWelcomeDocument(token);
  return {
    title: doc ? doc.title : "Welcome",
    robots: { index: false, follow: false },
  };
}

/**
 * Public viewer for a Welcome Document. Reached by anonymous clients
 * via `/w/<token>`; the token is the only capability check. We:
 *   1. Resolve the doc by token
 *   2. Record a throttled view (best-effort, never blocks the render)
 *   3. Render brand-coloured, mobile-first onboarding page with optional ack
 */
export default async function PublicWelcomePage({ params }: PageProps) {
  const { token } = await params;
  const doc = await getSharedWelcomeDocument(token);
  if (!doc) notFound();

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent");

  // If the visitor happens to be authenticated (eg. accessing from a
  // portal context) capture their identity for richer view records.
  let viewerUserId: string | null = null;
  let viewerEmail: string | null = null;
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerUserId = user?.id ?? null;
    viewerEmail = user?.email ?? null;
  } catch {
    /* anonymous */
  }

  // Best-effort. Never block the render on this side-effect.
  await recordWelcomeView(token, {
    ip,
    userAgent,
    viewerUserId,
    viewerEmail,
  }).catch(() => undefined);

  return <WelcomeViewer doc={doc} viewerEmail={viewerEmail} />;
}

function WelcomeViewer({
  doc,
  viewerEmail,
}: {
  doc: WelcomeDocumentRow;
  viewerEmail: string | null;
}) {
  const sections = parseWelcomeContent(doc.content);
  const brand = doc.brand_color ?? BRAND_PRIMARY;

  // Force light-mode CSS variable values on this public page.
  // The root layout wraps AppProviders (next-themes), which injects
  // class="dark" on <html> for users whose system is in dark mode.
  // That makes text-foreground/80 render as near-white — invisible on
  // the white article card. Overriding the variables here at the page
  // root means every Tailwind CSS-variable class (text-foreground,
  // text-muted-foreground, bg-muted, etc.) always resolves to the
  // correct light-mode value regardless of system preference.
  const lightVars = {
    "--background":        "0 0% 100%",
    "--foreground":        "222 47% 11%",
    "--card":              "0 0% 100%",
    "--card-foreground":   "222 47% 11%",
    "--muted":             "210 40% 96%",
    "--muted-foreground":  "215 16% 47%",
    "--primary":           "224 76% 40%",
    "--primary-foreground":"0 0% 100%",
    "--accent":            "210 40% 96%",
    "--accent-foreground": "222 47% 11%",
    "--border":            "214 32% 91%",
    "--input":             "214 32% 91%",
    "--ring":              "224 76% 40%",
    "--success":           "142 72% 36%",
    "--destructive":       "0 84% 60%",
    colorScheme:           "light",
  } as React.CSSProperties;

  return (
    <div
      className="relative min-h-screen bg-slate-50 text-slate-900"
      style={lightVars}
    >
      {/* Soft brand wash at the top of the canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background: `linear-gradient(to bottom, ${brand}14, transparent)`,
        }}
      />

      <main className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Eyebrow + title on the canvas */}
        <header className="mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-micro font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
            <BookOpen className="h-3.5 w-3.5" style={{ color: brand }} />
            Welcome guide
          </div>
          <h1 className="mt-4 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {doc.title}
          </h1>
          {doc.intro && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
              {doc.intro}
            </p>
          )}
        </header>

        <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-12px_rgba(15,23,42,0.12)]">
          {/* Brand accent bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: brand }} />
          <div className="space-y-10 p-6 sm:p-10">
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This guide is empty.
              </p>
            ) : (
              sections.map((section, i) => (
                <section key={section.id} className="space-y-3">
                  <h2 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight">
                    <span
                      className="font-mono text-xs tabular-nums"
                      style={{ color: brand }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {section.heading}
                  </h2>
                  <div className="pl-8 text-sm leading-relaxed text-slate-700 sm:pl-9">
                    <WelcomeMarkdown source={section.body} />
                  </div>
                </section>
              ))
            )}
          </div>
        </article>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Sent via Stackivo · This page is private to you.</span>
          <a
            href={`/api/share/welcome/${doc.public_token}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </a>
        </div>
      </main>
    </div>
  );
}
