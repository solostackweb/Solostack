import "server-only";

import { retrievedRecords, type IvoRetrieval } from "./retrieval";

/**
 * Versioned help/policy knowledge for Ivo's product questions.
 *
 * This replaces reading `.tsx` page sources off disk at runtime and regex-
 * stripping the JSX out of them. That approach had four problems: it depended
 * on `src/**` being present in the deployed bundle, which on serverless it
 * usually is not, so the documented "fallback" was in practice the primary
 * path; the regex chain mangled prose in ways nobody could see; the result was
 * one undifferentiated blob the model could not attribute; and it was cached in
 * a module variable forever with no version or freshness signal.
 *
 * Articles here are plain data. Each carries a stable `id`, a `title` and `url`
 * the model can cite, and the whole set carries a `KNOWLEDGE_VERSION` that must
 * be bumped whenever content changes so a stale answer is identifiable.
 *
 * This is authoritative product and policy text. When it disagrees with the
 * marketing pages, the marketing pages are what changed — update this file in
 * the same commit.
 */

/**
 * Bump on every content change. Date-based so an answer's provenance is
 * legible at a glance, and so drift against the marketing pages is visible.
 */
export const KNOWLEDGE_VERSION = "2026-07-26";

export interface KnowledgeArticle {
  id: string;
  title: string;
  /** In-app or marketing route a user can be pointed to. */
  url: string;
  section: "product" | "billing" | "policy" | "tax" | "support";
  /** Terms that should surface this article. Matched case-insensitively. */
  keywords: string[];
  body: string;
}

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "overview",
    title: "What Stackivo is",
    url: "/docs",
    section: "product",
    keywords: ["stackivo", "what is", "overview", "features", "product", "about"],
    body:
      "Stackivo is an all-in-one business OS for Indian freelancers and small agencies. It covers GST-ready invoicing, contracts and proposals with e-signatures, client portals, welcome documents, questionnaires, lead forms, meetings and scheduling, time tracking, and the Pulse analytics dashboard.",
  },
  {
    id: "refunds",
    title: "Refund policy",
    url: "/terms",
    section: "billing",
    keywords: ["refund", "money back", "reimburse", "chargeback", "cancel payment"],
    body:
      "A full refund can be requested within 30 days of any payment. After 30 days payments are non-refundable except where required by law. Refunds are processed to the original payment method via Razorpay. If Stackivo makes a material price change, the user may cancel before it applies and request a prorated refund. Repeated refund abuse may lead to account restriction.",
  },
  {
    id: "subscriptions",
    title: "Subscriptions and cancellation",
    url: "/dashboard/settings/billing",
    section: "billing",
    keywords: ["subscription", "cancel", "renew", "billing", "plan", "downgrade", "upgrade"],
    body:
      "Paid plans renew automatically at the end of each billing period unless cancelled first. Cancellation takes effect at the end of the current paid period and access continues until then. Plans are managed or cancelled at any time under Settings, Billing.",
  },
  {
    id: "payments",
    title: "How client payments work",
    url: "/docs",
    section: "billing",
    keywords: ["payment", "razorpay", "upi", "card", "netbanking", "pay invoice", "settle"],
    body:
      "Clients can pay invoices online via Razorpay using cards, UPI, or netbanking. Stackivo is a software platform and does not hold or process a user's clients' money on their behalf; funds settle through the user's own connected payment provider.",
  },
  {
    id: "gst",
    title: "GST and tax responsibility",
    url: "/docs",
    section: "tax",
    keywords: ["gst", "tax", "hsn", "sac", "lut", "igst", "cgst", "sgst", "export", "filing"],
    body:
      "Stackivo provides GST-ready invoicing tools, but the user remains responsible for their own tax registration, rates, collection, and filing. For exports, invoices can be issued under LUT without IGST where applicable. Stackivo does not file returns and does not provide tax advice.",
  },
  {
    id: "data-privacy",
    title: "Data ownership, export, and deletion",
    url: "/privacy",
    section: "policy",
    keywords: ["privacy", "data", "export", "delete", "gdpr", "account deletion", "own my data"],
    body:
      "A user's data belongs to them. Account data can be exported or the account deleted from Settings. Deletion runs after a short grace period, after which data is permanently purged. Full detail is in the Privacy Policy.",
  },
  {
    id: "support",
    title: "Getting help",
    url: "/docs",
    section: "support",
    keywords: ["support", "help", "contact", "email", "chat", "bug", "issue", "problem"],
    body:
      "Support is reachable at support@stackivo.me or through the in-app chat bubble at the bottom-right of the dashboard. Questions about specific plan prices or feature limits should be directed to the Pricing and Docs pages, which are the current source of truth.",
  },
];

/**
 * Words too common to indicate topic. Without this, "what is the capital of
 * France" matches every article — "what" and "the" appear in most bodies — and
 * the model receives irrelevant product text as though it were the answer.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "can", "how",
  "what", "when", "where", "who", "why", "does", "did", "was", "were", "this",
  "that", "there", "here", "have", "has", "had", "will", "would", "could",
  "should", "from", "about", "into", "them", "they", "get", "got", "any", "all",
  "out", "its", "his", "her", "our", "why", "isnt", "dont", "just", "like",
  "make", "made", "want", "need", "know", "tell", "give", "some", "than",
  "then", "very", "much", "many", "more", "most", "also", "been", "being",
]);

/**
 * Minimum score for an article to be considered relevant. A single incidental
 * body match scores 1, which is noise; a real hit lands on a keyword or the
 * title. Returning nothing is the safer failure here, because `empty` tells the
 * model to decline rather than to answer from a loosely-related article.
 */
const MIN_RELEVANCE = 3;

/** Whole-word containment, so "cat" does not match "certificate". */
function containsWord(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`, "i").test(haystack);
}

/** Cheap lexical relevance. No embedding call for a set this small. */
function scoreArticle(article: KnowledgeArticle, terms: string[]): number {
  const haystack = `${article.title} ${article.keywords.join(" ")} ${article.body}`;
  let score = 0;
  for (const term of terms) {
    if (article.keywords.some((keyword) => keyword.toLowerCase() === term)) score += 5;
    else if (containsWord(article.title, term)) score += 3;
    else if (article.keywords.some((keyword) => containsWord(keyword, term))) score += 3;
    else if (containsWord(haystack, term)) score += 1;
  }
  return score;
}

/**
 * Retrieves the articles relevant to a question, wrapped in the standard
 * retrieval envelope so a knowledge answer carries the same provenance
 * contract as a workspace-data answer.
 *
 * Returns `empty` when nothing matches. That is the correct signal: the model
 * is instructed to say it does not know and offer support, rather than
 * improvising product or policy claims — which for refunds, tax, or data
 * deletion would be a statement the business is held to.
 */
export function retrieveKnowledge(question: string, limit = 4): IvoRetrieval {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9@.]+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));

  const ranked = KNOWLEDGE_ARTICLES.map((article) => ({
    article,
    score: scoreArticle(article, terms),
  }))
    .filter((entry) => entry.score >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      id: entry.article.id,
      title: entry.article.title,
      url: entry.article.url,
      section: entry.article.section,
      body: entry.article.body,
    }));

  return retrievedRecords(
    "stackivo_help",
    `version=${KNOWLEDGE_VERSION}`,
    ranked,
    "No help article covers this question.",
  );
}
