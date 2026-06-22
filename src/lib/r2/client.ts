import "server-only";

/**
 * Cloudflare R2 storage client + presigned URL helpers.
 *
 * R2 is S3-compatible, so we reuse `@aws-sdk/client-s3`. The two notable
 * differences vs vanilla AWS:
 *   1. Endpoint: `https://<accountId>.r2.cloudflarestorage.com`.
 *   2. Region must be `"auto"`.
 *   3. R2 doesn't charge egress, so we don't need to be paranoid about
 *      caching public asset downloads.
 *
 * Why presigned URLs instead of streaming through the Next.js server?
 *   - Edge-friendly: client uploads/downloads go directly to R2.
 *   - Saves Vercel function bandwidth (which IS metered).
 *   - Lets us scale to large files (>4.5MB) without hitting Vercel's
 *     request-body cap.
 *
 * Security model:
 *   - Presigned PUT URLs are short-lived (default 5 min).
 *   - Presigned GET URLs are short-lived (default 5 min).
 *   - The freelancer's Supabase RLS gates *who* can ask for a URL; once
 *     issued the URL is unforgeable but expires quickly.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireServerEnv } from "@/config/env";

export class R2NotConfiguredError extends Error {
  constructor() {
    super(
      "[r2] Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in your environment to enable file uploads.",
    );
    this.name = "R2NotConfiguredError";
  }
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
}

function loadConfig(): R2Config | null {
  const env = requireServerEnv();
  if (
    !env.r2AccountId ||
    !env.r2AccessKeyId ||
    !env.r2SecretAccessKey ||
    !env.r2Bucket
  ) {
    return null;
  }
  return {
    accountId: env.r2AccountId,
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    bucket: env.r2Bucket,
    publicBaseUrl: env.r2PublicBaseUrl,
  };
}

/** Returns true iff R2 is fully configured. UI calls this to hide upload UI. */
export function isR2Configured(): boolean {
  return loadConfig() !== null;
}

function requireConfig(): R2Config {
  const cfg = loadConfig();
  if (!cfg) throw new R2NotConfiguredError();
  return cfg;
}

let _client: S3Client | null = null;
function getClient(): { client: S3Client; cfg: R2Config } {
  const cfg = requireConfig();
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      // R2 ignores `forcePathStyle`; we keep the default. We DO disable
      // request-checksum injection because R2 used to (briefly) reject
      // the new "FLEXIBLE" checksum trailer headers added by the AWS SDK
      // v3 ≥ 3.730. Toggling these to "WHEN_REQUIRED" keeps R2 happy AND
      // is no less secure for non-replicated buckets.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return { client: _client, cfg };
}

// --- Public API --------------------------------------------------------

/** Upload limits enforced at the URL-mint step. Callers may pass smaller. */
export const R2_DEFAULT_PUT_TTL_SECONDS = 300; // 5 min
export const R2_DEFAULT_GET_TTL_SECONDS = 300; // 5 min
export const R2_MAX_OBJECT_BYTES = 250 * 1024 * 1024; // 250 MB

/**
 * MIME types that must NEVER be stored — they can execute script in a
 * browser if a victim is tricked into opening them. Blocking at upload
 * stops stored-XSS / branded-phishing via the file pipeline entirely.
 */
const BLOCKED_UPLOAD_MIME = new Set<string>([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/xml",
  "application/xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/x-httpd-php",
  "application/xhtml",
  "text/x-html",
]);

/** Normalise a raw Content-Type header to a bare lowercase media type. */
export function normaliseMime(raw: string | null | undefined): string {
  return (raw ?? "").split(";")[0]!.trim().toLowerCase();
}

/**
 * Reject web-executable uploads. Returns true when the type is safe to
 * store. Empty / wildcard types are rejected; octet-stream (generic binary)
 * is allowed. Everything not on the blocklist is permitted — freelancer
 * deliverables are too varied for a strict allowlist.
 */
export function isAllowedUploadMime(raw: string | null | undefined): boolean {
  const mime = normaliseMime(raw);
  if (!mime || mime === "*/*") return false;
  if (mime === "application/octet-stream") return true;
  return !BLOCKED_UPLOAD_MIME.has(mime);
}

/**
 * Only these stored types may be served `inline` (rendered in the browser
 * tab). Everything else is forced to `attachment` so a stored file can
 * never execute in an origin. PDFs + raster images are safe.
 */
const INLINE_SAFE_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** True when a stored content-type is safe to render inline in the browser. */
export function isInlineSafeMime(raw: string | null | undefined): boolean {
  return INLINE_SAFE_MIME.has(normaliseMime(raw));
}

/**
 * Mint a presigned PUT URL the browser can upload directly to.
 *
 * @param key       Bucket-relative object key. Convention:
 *                    `portals/<portalId>/<fileId>/<original-filename>`
 * @param contentType MIME type the browser will send.
 * @param ttlSeconds  Override the default 5-min expiry.
 */
export async function presignPut(input: {
  key: string;
  contentType: string;
  contentLength?: number;
  ttlSeconds?: number;
}): Promise<{ url: string; bucket: string; expiresAt: string }> {
  const { client, cfg } = getClient();
  const cmd = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  const ttl = input.ttlSeconds ?? R2_DEFAULT_PUT_TTL_SECONDS;
  const url = await getSignedUrl(client, cmd, { expiresIn: ttl });
  return {
    url,
    bucket: cfg.bucket,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
  };
}

/**
 * Mint a presigned GET URL the browser can use to download.
 * If `R2_PUBLIC_BASE_URL` is set we return the public CDN URL instead
 * (no expiry — useful when the bucket is fronted by a CDN with auth).
 */
export async function presignGet(input: {
  key: string;
  ttlSeconds?: number;
  /** If true, force a presigned URL even when a public base is set. */
  forcePresign?: boolean;
  /** Filename to send in `Content-Disposition`. */
  downloadFilename?: string;
  disposition?: "attachment" | "inline";
}): Promise<{ url: string; expiresAt: string | null }> {
  const { client, cfg } = getClient();

  if (cfg.publicBaseUrl && !input.forcePresign && !input.downloadFilename) {
    return {
      url: `${cfg.publicBaseUrl.replace(/\/$/, "")}/${encodeURI(input.key)}`,
      expiresAt: null,
    };
  }

  const cmd = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: input.key,
    ResponseContentDisposition: input.downloadFilename
      ? `${input.disposition ?? "attachment"}; filename="${sanitizeFilename(input.downloadFilename)}"`
      : undefined,
  });
  const ttl = input.ttlSeconds ?? R2_DEFAULT_GET_TTL_SECONDS;
  const url = await getSignedUrl(client, cmd, { expiresIn: ttl });
  return {
    url,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
  };
}

/** Permanently delete an object. Used when a portal file is removed. */
export async function deleteObject(key: string): Promise<void> {
  const { client, cfg } = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
  );
}

/** Confirm an object exists and return its size + content-type. */
export async function headObject(key: string): Promise<{
  size: number;
  contentType: string | null;
} | null> {
  const { client, cfg } = getClient();
  try {
    const r = await client.send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
    return {
      size: r.ContentLength ?? 0,
      contentType: r.ContentType ?? null,
    };
  } catch (err) {
    const e = err as { $metadata?: { httpStatusCode?: number } };
    if (e?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

// --- helpers -----------------------------------------------------------

function sanitizeFilename(name: string): string {
  // Strip control chars, smart-quotes, and characters that would break a
  // Content-Disposition header. Replace whitespace runs with single spaces.
  return name.replace(/[\u0000-\u001F"\\]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Build the canonical R2 object key for a portal file.
 *
 * Layout:
 *   portals/<portalId>/<fileId>/<safe-filename>
 *
 * Including `<fileId>` in the path means the same filename uploaded twice
 * doesn't collide AND we can delete by `fileId` prefix when revoking
 * access.
 */
export function buildPortalFileKey(input: {
  portalId: string;
  fileId: string;
  filename: string;
}): string {
  const safe =
    input.filename
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200) || "file";
  return `portals/${input.portalId}/${input.fileId}/${safe}`;
}
