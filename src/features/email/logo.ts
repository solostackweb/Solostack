import "server-only";

import {
  createSignedStorageUrl,
  type AnySupabase,
} from "@/features/profile/storage";

/**
 * The brand logo, as something an email client will actually render.
 *
 * PDFs embed the logo as a base64 `data:` URL because React-PDF renders
 * server-side and can't be trusted to fetch over the network mid-render. Email
 * is the opposite case: Gmail and Outlook both strip `data:` URIs, so inlining
 * one produced a logo nobody ever saw while padding the HTML body with
 * hundreds of KB of base64 — which reads to spam filters exactly like the
 * obfuscated payloads they're built to catch.
 *
 * So email gets a long-lived signed https URL instead, and `data:` inputs are
 * refused outright rather than passed through.
 */

/** A year. An invoice opened weeks later must still show the mark. */
const EMAIL_LOGO_TTL_SECONDS = 60 * 60 * 24 * 365;

export async function resolveEmailLogoUrl(
  path: string | null | undefined,
  client?: AnySupabase,
): Promise<string | null> {
  if (!path) return null;
  // Never let a base64 blob reach an email body.
  if (path.startsWith("data:")) return null;
  // Already a fully-qualified URL (legacy rows, external CDN) — use as-is.
  if (/^https?:\/\//i.test(path)) return path;
  return createSignedStorageUrl(
    "branding-assets",
    path,
    client,
    EMAIL_LOGO_TTL_SECONDS,
  );
}
