/**
 * Canonical route paths for the Client Portal feature.
 *
 *   /dashboard/portal              — freelancer-side: list of portals
 *   /dashboard/portal/<id>         — freelancer-side: portal management
 *   /portal                        — client-side: list of portals you belong to
 *   /portal/<id>                   — client-side: workspace home
 *   /portal/<id>/files             — client-side: files
 *   /portal/<id>/contracts         — client-side: contracts
 *   /portal/<id>/invoices          — client-side: invoices
 *   /portal/<id>/chat              — client-side: chat
 *   /portal/accept?token=<...>     — accept an emailed invitation
 */

export const PORTAL_DASHBOARD_INDEX = "/dashboard/portal";
export const portalDashboardDetail = (portalId: string): string =>
  `/dashboard/portal/${portalId}`;

export const PORTAL_CLIENT_INDEX = "/portal";
export const portalClientHome = (portalId: string): string =>
  `/portal/${portalId}`;
export const portalClientFiles = (portalId: string): string =>
  `/portal/${portalId}/files`;
export const portalClientFile = (portalId: string, fileId: string): string =>
  `/portal/${portalId}/files/${fileId}`;
export const portalClientUpdates = (portalId: string): string =>
  `/portal/${portalId}/updates`;
export const portalClientMeetings = (portalId: string): string =>
  `/portal/${portalId}/meetings`;
export const portalClientMore = (portalId: string): string =>
  `/portal/${portalId}/more`;
export const portalClientInvoices = (portalId: string): string =>
  `/portal/${portalId}/invoices`;
// Chat lives at /chat (there is no /messages or /contracts client page).
export const portalClientChat = (portalId: string): string =>
  `/portal/${portalId}/chat`;

export const PORTAL_ACCEPT_INVITE = "/portal/accept";
