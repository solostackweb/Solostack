import "server-only";

import crypto from "node:crypto";

/**
 * Symmetric encryption for OAuth tokens at rest. Uses AES-256-GCM with a key
 * derived from TOKEN_ENCRYPTION_KEY (any string; hashed to 32 bytes). Returns
 * null when no key is set so callers can degrade gracefully.
 *
 * Format: base64(iv):base64(tag):base64(ciphertext)
 */

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptToken(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const key = getKey();
  if (!key) return null;
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
