/**
 * Central registry of auth-related routes.
 *
 * Used by:
 *   - `middleware.ts` to decide what to redirect / allow.
 *   - Auth pages to compose links.
 *   - Server actions to redirect after signup / login / logout.
 *
 * Public tokenised routes (SAD §1.6 — /invoice/:token, /portal/:token,
 * /sign/:token) are expressed as PREFIX matchers.
 */

/** Where to land an authenticated user by default. */
export const AUTH_DEFAULT_REDIRECT = "/dashboard";

/** Where to send an unauthenticated user attempting to enter a protected area. */
export const AUTH_LOGIN_ROUTE = "/login";

/** The route pattern for anything requiring authentication. */
export const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/onboarding"] as const;

/** Authenticated client-portal routes that intentionally skip freelancer onboarding. */
export const CLIENT_PORTAL_PREFIX = "/portal";

/** Fully public routes (marketing, auth). No session check, no redirect. */
export const PUBLIC_EXACT_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/portal-access",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/confirm",
] as const;

/** Public tokenised routes — anything starting with these prefixes is public. */
export const PUBLIC_TOKENISED_PREFIXES = [
  "/i/",
  "/c/",
] as const;

/** Routes that authenticated users should NOT see (login/signup). */
export const AUTH_ONLY_ROUTES = [
  "/login",
  "/signup",
  "/portal-access",
  "/forgot-password",
] as const;

// --- Helpers ----------------------------------------------------------------

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isClientPortalPath(pathname: string): boolean {
  return pathname === CLIENT_PORTAL_PREFIX || pathname.startsWith(`${CLIENT_PORTAL_PREFIX}/`);
}

export function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_ROUTES.includes(
    pathname as (typeof AUTH_ONLY_ROUTES)[number],
  );
}

export function isPublicPath(pathname: string): boolean {
  if (
    PUBLIC_EXACT_ROUTES.includes(pathname as (typeof PUBLIC_EXACT_ROUTES)[number])
  ) {
    return true;
  }
  return PUBLIC_TOKENISED_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Build a login URL that remembers where the user wanted to go.
 * Middleware / guards use this so sign-in can hand off back to the target.
 */
export function buildLoginRedirect(
  originalPath: string,
  search?: string,
): string {
  const next = `${originalPath}${search ?? ""}`;
  const url = new URL(AUTH_LOGIN_ROUTE, "http://localhost");
  url.searchParams.set("next", next);
  return `${url.pathname}${url.search}`;
}
