import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getServerSupabase } from "@/lib/supabase/server";

export type AnySupabase = SupabaseClient<Database>;

export async function createSignedStorageUrl(
  bucket: "profile-images" | "branding-assets",
  path: string | null | undefined,
  client?: AnySupabase,
  /**
   * Lifetime of the signed link. The one-hour default suits in-app previews.
   * Email needs far longer — a recipient opening an invoice a week later must
   * still see the logo, not a broken image.
   */
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  if (!path) return null;
  const sb = client ?? (await getServerSupabase());
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Download an object from Supabase storage and return it as a base64
 * `data:` URL the React-PDF `<Image>` primitive can render reliably.
 *
 * Why we don't just hand React-PDF a signed URL:
 *   - React-PDF renders on the server. Network egress in some deployment
 *     environments (Vercel ISR, edge regions, cold serverless boots)
 *     can be slow or fail without surfacing an error — the PDF then
 *     ships with the logo silently missing.
 *   - Signed URLs have a TTL. If the PDF render is queued behind other
 *     work the URL can expire mid-render.
 *   - Inlining keeps supported image formats (PNG / JPEG / WebP / SVG)
 *     available to React-PDF without a network round-trip.
 *
 * Returns null when the path is empty, the file is missing, or the file
 * is not a supported image. Callers should treat null as "no logo" and
 * fall through to the text-only header block.
 */
export async function fetchStorageAsDataUrl(
  bucket: "profile-images" | "branding-assets",
  path: string | null | undefined,
  client?: AnySupabase,
): Promise<string | null> {
  if (!path) return null;
  const sb = client ?? (await getServerSupabase());
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) return null;

  // Sniff MIME from the blob first; fall back to the file extension.
  let mime = (data.type || "").toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    mime = guessMimeFromPath(path);
  }
  if (!isSupportedPdfImageMime(mime)) return null;

  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mime};base64,${base64}`;
}

/**
 * Best-effort: turn a value that might be a `data:` URL, a Supabase
 * storage path, or a fully-qualified https URL into a data URL the PDF
 * renderer can consume. Used for signature images (the column can hold
 * any of these three shapes depending on how the user signed).
 */
export async function normalizeImageForPdf(
  value: string | null | undefined,
  bucket: "profile-images" | "branding-assets",
  client?: AnySupabase,
): Promise<string | null> {
  if (!value) return null;
  // Already a data URL — pass through (React-PDF handles it natively).
  if (value.startsWith("data:")) return value;
  // External https URL — fetch and inline. React-PDF can sometimes
  // load these but inlining removes the failure mode entirely.
  if (/^https?:\/\//i.test(value)) {
    try {
      const res = await fetch(value);
      if (!res.ok) return null;
      const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
      if (!isSupportedPdfImageMime(mime)) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }
  // Otherwise treat as a storage path under the given bucket.
  return fetchStorageAsDataUrl(bucket, value, client);
}

function guessMimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function isSupportedPdfImageMime(mime: string): boolean {
  return (
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/webp" ||
    mime === "image/gif" ||
    mime === "image/svg+xml"
  );
}
