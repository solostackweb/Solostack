/**
 * src/features/contracts/signature-utils.ts
 * 
 * Utilities for capturing signature metadata including IP address, device info,
 * and user-agent information for legal audit trails.
 */

import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";

/**
 * Extract IP address from request headers.
 * Handles both direct connections and proxy scenarios (X-Forwarded-For).
 */
export async function getSigningIpAddress(): Promise<string> {
  const headersList = await headers();
  
  // Try X-Forwarded-For first (for proxies/load balancers)
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    // Get the first IP in the chain (client IP)
    return forwardedFor.split(",")[0].trim();
  }
  
  // Fall back to direct connection IP
  return headersList.get("x-real-ip") || 
         headersList.get("cf-connecting-ip") || 
         "unknown";
}

/**
 * Get user-agent string from request headers.
 */
export async function getSigningUserAgent(): Promise<string> {
  const headersList = await headers();
  return headersList.get("user-agent") || "unknown";
}

/**
 * Parse device information from user-agent string.
 * Returns: OS, browser name/version, and device type.
 */
export function parseDeviceInfo(userAgent: string): {
  os: string;
  browser: string;
  device_type: "desktop" | "mobile" | "tablet" | "unknown";
} {
  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // Determine device type
    let deviceType: "desktop" | "mobile" | "tablet" | "unknown" = "unknown";
    if (result.device.type === "mobile") {
      deviceType = "mobile";
    } else if (result.device.type === "tablet") {
      deviceType = "tablet";
    } else if (result.ua) {
      // If no device type but user-agent exists, assume desktop
      deviceType = "desktop";
    }

    const os = result.os.name
      ? `${result.os.name}${result.os.version ? ` ${result.os.version}` : ""}`
      : "unknown";

    const browser = result.browser.name
      ? `${result.browser.name}${result.browser.version ? ` ${result.browser.version}` : ""}`
      : "unknown";

    return {
      os,
      browser,
      device_type: deviceType,
    };
  } catch {
    // Fallback if parsing fails
    return {
      os: "unknown",
      browser: "unknown",
      device_type: "unknown",
    };
  }
}

/**
 * Capture complete signature metadata for audit trail.
 * Called during signing to record comprehensive audit information.
 */
export async function captureSignatureMetadata() {
  const userAgent = await getSigningUserAgent();
  const ipAddress = await getSigningIpAddress();
  const deviceInfo = parseDeviceInfo(userAgent);

  return {
    signed_ip: ipAddress,
    signed_user_agent: userAgent,
    signed_device: deviceInfo,
    signed_at: new Date().toISOString(),
  };
}
