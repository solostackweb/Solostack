/**
 * Domain types for the Welcome Document feature.
 *
 * NOT to be confused with contracts. Welcome documents are *onboarding
 * guides* — friendly, prose-heavy, no signature flow, no monetary
 * value. They sit alongside contracts in the share lifecycle but are
 * a separate feature with their own routes and PDF style.
 */

export interface WelcomeDocumentSection {
  id: string;
  heading: string;
  /** Markdown body. Renderer supports bold/italic/lists/links/code. */
  body: string;
}

export interface WelcomeDocumentTemplate {
  id: string;
  title: string;
  description: string | null;
  intro: string | null;
  sections: WelcomeDocumentSection[];
  category: string | null;
  isSystem: boolean;
}

/**
 * Hydrated welcome document — DB row + parsed sections, joined to
 * enough surrounding context (client name, view + ack counts) to
 * render the dashboard list and detail pages without further round
 * trips. Built by `getWelcomeDocument` / `listWelcomeDocuments`.
 */
export interface WelcomeDocumentRecord {
  id: string;
  userId: string;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  title: string;
  intro: string | null;
  sections: WelcomeDocumentSection[];
  brandColor: string | null;
  status: "draft" | "published" | "archived";
  publicToken: string | null;
  version: number;
  parentId: string | null;
  viewedAt: string | null;
  publishedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Aggregate view count (rows × view_count). */
  totalViews: number;
  uniqueViewers: number;
}
