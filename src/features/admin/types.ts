/**
 * Founder Console - shared types.
 *
 * The `AdminActionKind` union is the controlled vocabulary of every
 * audited admin operation. Adding a new admin action MUST add a new
 * value here; the lint rule in `runAdminAction()` enforces that the
 * `kind` argument is type-narrowed to this union, which prevents
 * typos from quietly creating a new (uncategorized) kind.
 *
 * Naming convention: `<resource>.<verb>[.<modifier>]` in past or
 * imperative form. The resource matches the `target_type` column.
 */

import type { AdminActionTargetType } from "@/lib/supabase/types";

export type AdminActionKind =
  // user
  | "user.read"
  | "user.view_as.start"
  | "user.view_as.stop"
  | "user.password_reset"
  | "user.email_verify_force"
  | "user.suspend"
  | "user.unsuspend"
  | "user.delete_soft"
  | "user.data_export"
  // subscription
  | "subscription.read"
  | "subscription.comp"
  | "subscription.refund"
  | "subscription.cancel"
  | "subscription.force_cycle"
  // coupon
  | "coupon.create"
  | "coupon.update"
  | "coupon.delete"
  // invoice
  | "invoice.read"
  | "invoice.share_link.regen"
  // contract
  | "contract.read"
  | "contract.share_link.regen"
  // file
  | "file.read"
  // email
  | "email.suppression.remove"
  | "email.suppression.add"
  | "email.send_test"
  // notification
  | "notification.broadcast"
  // settings
  | "settings.update"
  // query
  | "query.sql.run"
  // system
  | "system.note.create"
  | "system.note.update"
  | "system.note.delete"
  // support
  | "support.reply"
  | "support.status.update"
  | "support.priority.update"
  | "support.category.update"
  | "support.assign"
  | "support.tag.add"
  | "support.tag.remove"
  | "support.canned.create"
  | "support.canned.update"
  | "support.canned.delete";

/**
 * Tier of an admin action. Drives the confirmation UX:
 *
 *   routine     -> one-click, audited.
 *   sensitive   -> typed-confirmation modal (e.g. type email to confirm).
 *   destructive -> typed-confirmation + 10s cooldown + email receipt.
 *
 * Centralized here so the policy is enforceable at the call site.
 */
export type AdminActionTier = "routine" | "sensitive" | "destructive";

export const ADMIN_ACTION_TIER: Record<AdminActionKind, AdminActionTier> = {
  // routine reads + non-destructive ops
  "user.read": "routine",
  "user.view_as.start": "routine",
  "user.view_as.stop": "routine",
  "subscription.read": "routine",
  "invoice.read": "routine",
  "contract.read": "routine",
  "file.read": "routine",
  "email.suppression.remove": "routine",
  "email.suppression.add": "routine",
  "email.send_test": "routine",
  "invoice.share_link.regen": "routine",
  "contract.share_link.regen": "routine",
  "system.note.create": "routine",
  "system.note.update": "routine",
  "system.note.delete": "routine",
  "query.sql.run": "routine",
  "support.reply": "routine",
  "support.status.update": "routine",
  "support.priority.update": "routine",
  "support.category.update": "routine",
  "support.assign": "routine",
  "support.tag.add": "routine",
  "support.tag.remove": "routine",
  "support.canned.create": "routine",
  "support.canned.update": "routine",
  "support.canned.delete": "routine",

  // sensitive - typed confirm
  "user.password_reset": "sensitive",
  "user.data_export": "sensitive",
  "user.email_verify_force": "sensitive",
  "user.suspend": "sensitive",
  "user.unsuspend": "sensitive",
  "subscription.comp": "sensitive",
  "subscription.refund": "sensitive",
  "subscription.cancel": "sensitive",
  "subscription.force_cycle": "sensitive",
  "coupon.create": "sensitive",
  "coupon.update": "sensitive",
  "coupon.delete": "destructive",
  "settings.update": "sensitive",

  // destructive - typed confirm + cooldown + receipt
  "user.delete_soft": "destructive",
  "notification.broadcast": "destructive",
};

/**
 * Shape of metadata persisted per `runAdminAction()` call. The
 * `metadata` JSONB column on `admin_actions` accepts any shape but
 * we tag the common keys so the admin UI can render them safely.
 */
export interface AdminActionMetadata {
  /** Free-form note the admin typed at action time. */
  reason?: string;
  /** Pre-redaction snapshot of the entity, captured before mutation. */
  before?: Record<string, unknown>;
  /** Post-mutation snapshot. */
  after?: Record<string, unknown>;
  /** Error message if `success = false`. */
  error?: string;
  [key: string]: unknown;
}

/**
 * Compact descriptor passed to `runAdminAction()`. Re-exported as a
 * single record to keep call sites tight.
 */
export interface AdminActionDescriptor {
  kind: AdminActionKind;
  targetType: AdminActionTargetType;
  targetId: string | null;
  metadata?: AdminActionMetadata;
}
