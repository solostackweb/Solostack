/**
 * Supabase generated database types.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * Until that command is run against a real project, this file provides a
 * minimal hand-written shape that matches the schema in
 * `supabase/migrations/`. Keep it in sync with the migration files so
 * typed Supabase calls compile before the first codegen run.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- Enum-like string unions ------------------------------------------------

export type ProjectStatusRow =
  | "lead"
  | "planning"
  | "active"
  | "waiting_on_client"
  | "revision"
  | "review"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "archived";

export interface ProjectStatusHistoryRow {
  id: string;
  project_id: string;
  user_id: string;
  from_status: ProjectStatusRow | null;
  to_status: ProjectStatusRow;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export type InvoiceStatusRow =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "overdue"
  | "partially_paid";

export type ContractStatusRow =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "expired";

export type ContractKindRow = "proposal" | "contract";

export type InvoiceTaxMode = "non_gst" | "cgst_sgst" | "igst";

export type InvoiceClassificationRow = "standard" | "b2c" | "b2b";

export type ActivityEntityType =
  | "project"
  | "client"
  | "invoice"
  | "contract"
  | "welcome_document"
  | "time_entry"
  | "file"
  | "system";

export type SubscriptionStatusRow =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused"
  | "expired";

export type SubscriptionPlanRow = "free" | "pro" | "business";

// --- Table row types --------------------------------------------------------

export type BusinessType =
  | "individual"
  | "sole_proprietor"
  | "partnership"
  | "llp"
  | "private_limited"
  | "other";

export type OnboardingStep =
  | "business"
  | "gst"
  | "invoice"
  | "signature"
  | "first_client"
  | "done";

export type AccountTypeRow = "freelancer" | "portal_client";

export interface UserProfileRow {
  id: string;
  full_name: string;
  email: string;
  account_type: AccountTypeRow;
  avatar_url: string | null;
  display_name: string | null;
  phone: string | null;
  role: string | null;
  bio: string | null;
  company_name: string | null;
  gst_number: string | null;
  business_email: string | null;
  business_phone: string | null;
  website: string | null;
  logo_url: string | null;
  brand_icon_url: string | null;
  brand_color: string | null;
  brand_tagline: string | null;
  brand_signature: string | null;
  brand_intro: string | null;
  signature_type: "draw" | "type" | "upload" | null;
  signature_image_url: string | null;
  signature_text_value: string | null;
  signature_font_family: string | null;
  signature_updated_at: string | null;
  // Business identity (added in 0005)
  legal_name: string | null;
  business_name: string | null;
  business_type: BusinessType | null;
  gst_registered: boolean;
  gstin: string | null;
  pan: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_code: string | null;
  postal_code: string | null;
  country: string;
  default_currency: string;
  timezone: string;
  // Invoice preferences
  invoice_prefix: string | null;
  invoice_next_number: number;
  invoice_number_padding: number;
  invoice_reset_yearly: boolean;
  invoice_default_tax_mode: "intra" | "inter";
  invoice_default_gst_rate: number;
  invoice_send_reminders: boolean;
  invoice_default_due_days: number;
  invoice_default_notes: string | null;
  invoice_default_terms: string | null;
  notification_preferences: Record<string, unknown>;
  // Onboarding state
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  onboarding_step: OnboardingStep;
  // Free-plan enforcement
  lifetime_clients_created: number;
  // Per-user Razorpay credentials for client-invoice payments (added in 0023).
  // DEPRECATED in 0027 — kept only for historic data. New code must NOT read
  // or write these. The two-option model in 0027 supersedes this.
  razorpay_key_id: string | null;
  razorpay_account_status:
    | "unverified"
    | "connected"
    | "invalid"
    | "revoked";
  razorpay_test_mode: boolean;
  razorpay_connected_at: string | null;
  razorpay_last_verified_at: string | null;
  // Three-option payment-method config (0027 + updated in 0034).
  // `null` means the freelancer hasn't picked a method yet.
  payment_method_type: "stackivo_managed" | "upi_smart" | "upi_manual" | null;
  payment_method_configured_at: string | null;
  payout_account_holder_name: string | null;
  payout_bank_account_number: string | null;
  payout_bank_ifsc: string | null;
  payout_bank_name: string | null;
  payout_upi_vpa: string | null;
  // Added in 0034: Razorpay Payouts / Smart Collect
  payout_pan: string | null;
  razorpay_contact_id: string | null;
  razorpay_fund_account_id: string | null;
  fee_passthrough_enabled: boolean;
  fee_passthrough_percent: number | null;
  // Referral system (added in 0035)
  referral_code: string;
  referred_by: string | null;
  referral_count: number;
  created_at: string;
  updated_at: string;
}

// --- 0027 + 0034: receipts + manual confirmations --------------------------

export type PaymentMethodType = "stackivo_managed" | "upi_smart" | "upi_manual";

export type PayoutStatus =
  | "not_applicable"
  | "pending"
  | "processing"
  | "transferred"
  | "failed";

export interface InvoiceReceiptRow {
  id: string;
  invoice_id: string;
  user_id: string;
  receipt_number: string;
  payment_method: PaymentMethodType;
  amount: number;
  currency: string;
  paid_at: string;
  payer_name: string | null;
  payer_email: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceManualConfirmationRow {
  id: string;
  invoice_id: string;
  user_id: string;
  confirmed_by_user_id: string;
  amount: number;
  currency: string;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClientRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  business_name: string | null;
  gst_registered: boolean;
  gst_number: string | null;
  state_code: string | null;
  address: string | null;
  billing_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatusRow;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRow {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  currency: string;
  status: InvoiceStatusRow;
  tax_mode: InvoiceTaxMode;
  classification: InvoiceClassificationRow;
  seller_state_code: string | null;
  client_state_code: string | null;
  footer_note: string | null;
  payment_link: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_amount: number | null;
  payment_recorded_at: string | null;
  // Which collection flow produced the payment (0027). Distinct from the
  // free-form `payment_method` column kept from 0013 for legacy reasons.
  payment_method_used: PaymentMethodType | null;
  // Smart Collect fields (0034)
  smart_collect_virtual_account_id: string | null;
  smart_collect_vpa: string | null;
  smart_collect_expires_at: string | null;
  // Fee passthrough line item (0034)
  fee_passthrough_amount: number | null;
  notes: string | null;
  terms: string | null;
  public_token: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DeliveryKind =
  | "invoice_sent"
  | "invoice_reminder"
  | "invoice_viewed"
  | "invoice_paid"
  | "contract_sent"
  | "contract_signed"
  | "contract_declined"
  | "proposal_sent"
  | "welcome_document_sent"
  | "welcome_document_acknowledged"
  | "portal_invite"
  | "portal_digest"
  | "portal_update"
  | "portal_meeting"
  | "portal_file"
  | "custom";

export type DeliveryChannel = "email" | "sms" | "inapp";

export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed"
  | "suppressed";

export interface DeliveryLogRow {
  id: string;
  user_id: string;
  kind: DeliveryKind;
  channel: DeliveryChannel;
  entity_type: "invoice" | "contract" | "welcome_document" | "client" | "system";
  entity_id: string | null;
  to_email: string | null;
  subject: string | null;
  status: DeliveryStatus;
  provider: string;
  provider_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  idempotency_key: string | null;
}

export type EmailSuppressionReason =
  | "hard_bounce"
  | "soft_bounce_repeat"
  | "complaint"
  | "unsubscribe"
  | "invalid"
  | "manual";

export interface EmailSuppressionRow {
  email: string;
  reason: EmailSuppressionReason;
  triggered_by_user_id: string | null;
  provider: string;
  provider_message_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type SecurityEventKind =
  | "auth_login_failed"
  | "auth_signup_failed"
  | "auth_signup_duplicate"
  | "auth_ratelimit_tripped"
  | "auth_password_reset_requested"
  | "rls_guard_miss"
  | "webhook_signature_invalid"
  | "webhook_replay_detected"
  | "storage_prefix_mismatch"
  | "cron_monitor_alert"
  | "suppression_hit"
  | "other";

export type SecurityEventSeverity = "info" | "warn" | "alert";

export interface SecurityEventRow {
  id: string;
  kind: SecurityEventKind;
  severity: SecurityEventSeverity;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Json;
  request_id: string | null;
  created_at: string;
}

// --- Founder Console (admin) ----------------------------------------------

export type AdminActionTargetType =
  | "user"
  | "subscription"
  | "invoice"
  | "contract"
  | "file"
  | "email"
  | "notification"
  | "security_event"
  | "settings"
  | "query"
  | "system";

export interface AdminActionRow {
  id: string;
  actor_id: string | null;
  kind: string;
  target_type: AdminActionTargetType;
  target_id: string | null;
  success: boolean;
  duration_ms: number;
  metadata: Json;
  request_id: string | null;
  created_at: string;
}

export type AdminNoteTargetType =
  | "user"
  | "subscription"
  | "invoice"
  | "contract"
  | "file"
  | "email";

export interface AdminNoteRow {
  id: string;
  actor_id: string | null;
  target_type: AdminNoteTargetType;
  target_id: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettingRow {
  key: string;
  value: Json;
  updated_by: string | null;
  updated_at: string;
}

/**
 * Read-only denormalized view powering /admin/users list + detail.
 * Matches the columns in the `admin_user_overview` view defined in
 * migration 0019.
 */
export interface AdminUserOverviewRow {
  id: string;
  full_name: string;
  email: string;
  account_type: AccountTypeRow;
  avatar_url: string | null;
  company_name: string | null;
  country: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  plan: SubscriptionPlanRow | null;
  subscription_status: SubscriptionStatusRow | null;
  current_period_end: string | null;
  invoice_count: number;
  client_count: number;
  total_revenue_paise: number;
  suppression_count: number;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  amount: number;
  position: number;
  created_at: string;
}

export interface ContractRow {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  kind: ContractKindRow;
  title: string;
  content: string | null;
  status: ContractStatusRow;
  public_token: string | null;
  signed_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  declined_at: string | null;
  expires_at: string | null;
  currency: string;
  value_amount: number | null;
  created_at: string;
  updated_at: string;
  signature_type: "draw" | "type" | "upload" | null;
  signature_image_url: string | null;
  signature_text_value: string | null;
  signature_font_family: string | null;
  signature_metadata: Json | null;
  pdf_snapshot_url: string | null;
  pdf_snapshot_hash: string | null;
}

export interface ContractSignatureRow {
  id: string;
  contract_id: string;
  user_id: string;
  signature_type: "draw" | "type" | "upload";
  signature_image_url: string | null;
  signature_text_value: string | null;
  signature_font_family: string | null;
  legal_name: string;
  signed_ip: string | null;
  signed_user_agent: string | null;
  signed_device: Json | null;
  signed_at: string;
  pdf_snapshot_url: string | null;
  pdf_snapshot_hash: string | null;
  metadata: Json | null;
  created_at: string;
}

export interface TimeEntryRow {
  id: string;
  user_id: string;
  project_id: string | null;
  client_id: string | null;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  billable: boolean;
  hourly_rate: number;
  amount: number;
  tags: string[];
  invoice_id: string | null;
  invoiced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityEventRow {
  id: string;
  user_id: string;
  kind: string;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  title: string;
  message: string | null;
  metadata: Json;
  created_at: string;
}

export interface FileRow {
  id: string;
  user_id: string;
  project_id: string | null;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

export type BillingCycle = "monthly" | "yearly";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: SubscriptionPlanRow;
  status: SubscriptionStatusRow;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  razorpay_plan_id: string | null;
  billing_cycle: BillingCycle;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  ended_at: string | null;
  last_payment_at: string | null;
  next_charge_at: string | null;
  grace_period_ends_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface BillingPaymentRow {
  id: string;
  user_id: string;
  subscription_row_id: string | null;
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  razorpay_subscription_id: string | null;
  razorpay_invoice_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  card_last4: string | null;
  card_network: string | null;
  description: string | null;
  error_code: string | null;
  error_description: string | null;
  captured_at: string | null;
  receipt_url: string | null;
  metadata: Json;
  created_at: string;
}

export interface BillingEventRow {
  id: string;
  event_id: string;
  event_type: string;
  user_id: string | null;
  payload: Json;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface UsageCounterRow {
  id: string;
  user_id: string;
  metric: string;
  period_start: string;
  period_end: string;
  count: number;
  updated_at: string;
}

export interface InvoicePaymentAttemptRow {
  id: string;
  invoice_id: string;
  user_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  error_code: string | null;
  error_description: string | null;
  payload: Json | null;
  // Added in 0027.
  payment_method: PaymentMethodType;
  payout_status: PayoutStatus;
  payout_reference: string | null;
  payout_transferred_at: string | null;
  created_at: string;
}

// --- Client Portal -----------------------------------------------------------
//
// See migration 0024_client_portal.sql for the schema. These rows model the
// shared workspace between a freelancer and their client(s).

export type PortalStatus = "active" | "archived" | "deleted";
export type PortalRole = "owner" | "client";

export interface PortalRow {
  id: string;
  owner_user_id: string;
  name: string;
  client_id: string | null;
  brand_color: string | null;
  status: PortalStatus;
  welcome_video_url: string | null;
  welcome_message: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PortalMemberRow {
  portal_id: string;
  user_id: string;
  role: PortalRole;
  invited_at: string;
  joined_at: string | null;
  revoked_at: string | null;
  last_read_at: string | null;
  last_seen_at: string | null;
  calendar_feed_token: string | null;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export type PortalDocumentType = "contract" | "invoice" | "welcome";

export interface PortalDocumentCommentRow {
  id: string;
  portal_id: string;
  doc_type: PortalDocumentType;
  doc_id: string;
  author_id: string;
  body: string;
  resolved_at: string | null;
  created_at: string;
}

export interface PortalInvitationRow {
  id: string;
  portal_id: string;
  email: string;
  token_hash: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface PortalFileRow {
  id: string;
  portal_id: string;
  uploaded_by: string;
  r2_key: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  category: "contract" | "deliverable" | "asset" | "invoice" | "meeting_note" | "misc";
  approval_status: "none" | "submitted" | "under_review" | "approved" | "revision_requested";
  created_at: string;
  deleted_at: string | null;
}

export type PortalUpdateType =
  | "progress" | "deliverable" | "revision"
  | "payment" | "milestone" | "meeting" | "general";

export type PortalUpdateApprovalStatus =
  | "none" | "submitted" | "under_review" | "approved" | "revision_requested";

export type PortalFileCategory =
  | "contract" | "deliverable" | "asset" | "invoice" | "meeting_note" | "misc";

export interface PortalUpdateRow {
  id: string;
  portal_id: string;
  author_id: string;
  update_type: PortalUpdateType;
  title: string;
  body: string | null;
  approval_status: PortalUpdateApprovalStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PortalUpdateReactionKind =
  | "acknowledged" | "comment" | "approved" | "revision_requested";

export interface PortalUpdateReactionRow {
  id: string;
  update_id: string;
  user_id: string;
  kind: PortalUpdateReactionKind;
  body: string | null;
  created_at: string;
}

export type PortalMeetingStatus =
  | "pending" | "accepted" | "declined" | "completed" | "cancelled";

export interface PortalMeetingRow {
  id: string;
  portal_id: string;
  requested_by: string;
  topic: string;
  proposed_time: string | null;
  meet_link: string | null;
  notes: string | null;
  status: PortalMeetingStatus;
  scheduled_at: string | null;
  duration_minutes: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface PortalMessageRow {
  id: string;
  portal_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  attachments: Json | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface PortalActivityRow {
  id: number;
  portal_id: string;
  actor_id: string | null;
  type: string;
  payload: Json;
  created_at: string;
}

export interface PortalStorageUsageRow {
  portal_id: string;
  total_bytes: number;
  file_count: number;
  updated_at: string;
}

export interface PortalNotificationOutboxRow {
  id: number;
  recipient_id: string;
  portal_id: string | null;
  event_type: string;
  payload: Json;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
}

export interface PortalContractRow {
  portal_id: string;
  contract_id: string;
  added_at: string;
  added_by: string;
}

export interface PortalInvoiceRow {
  portal_id: string;
  invoice_id: string;
  added_at: string;
  added_by: string;
}

// --- welcome documents -----------------------------------------------------

export type WelcomeDocumentStatus = "draft" | "published" | "archived";

export interface WelcomeDocumentRow {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  intro: string | null;
  /** JSON-string array of `{ heading, body }` (same shape as contracts.content). */
  content: string;
  brand_color: string | null;
  cover_image_r2_key: string | null;
  status: WelcomeDocumentStatus;
  public_token: string | null;
  version: number;
  parent_id: string | null;
  acknowledgement_required: boolean;
  viewed_at: string | null;
  published_at: string | null;
  sent_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WelcomeDocumentViewRow {
  id: string;
  document_id: string;
  viewer_user_id: string | null;
  viewer_email: string | null;
  fingerprint_hash: string;
  user_agent: string | null;
  first_viewed_at: string;
  last_viewed_at: string;
  view_count: number;
}

export interface WelcomeDocumentAcknowledgementRow {
  id: string;
  document_id: string;
  viewer_user_id: string | null;
  viewer_name: string;
  viewer_email: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  acknowledged_at: string;
}

export interface WelcomeDocumentTemplateRow {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  intro: string | null;
  content: string;
  category: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalWelcomeDocumentRow {
  portal_id: string;
  document_id: string;
  added_by: string | null;
  added_at: string;
}

// --- Referral system (0035) -------------------------------------------------

export type ReferralStatus = "pending" | "completed" | "cancelled";

export interface ReferralEventRow {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: ReferralStatus;
  reward_months: number;
  created_at: string;
  completed_at: string | null;
}

// --- `Database` shape matching what `createClient<Database>()` expects ------

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow> & Pick<UserProfileRow, "id" | "full_name" | "email">;
        Update: Partial<UserProfileRow>;
      };
      clients: {
        Row: ClientRow;
        Insert: Partial<ClientRow> &
          Pick<ClientRow, "user_id" | "full_name">;
        Update: Partial<ClientRow>;
      };
      projects: {
        Row: ProjectRow;
        Insert: Partial<ProjectRow> &
          Pick<ProjectRow, "user_id" | "name">;
        Update: Partial<ProjectRow>;
      };
      invoices: {
        Row: InvoiceRow;
        Insert: Partial<InvoiceRow> &
          Pick<
            InvoiceRow,
            | "user_id"
            | "invoice_number"
            | "issue_date"
            | "due_date"
            | "subtotal"
            | "gst_amount"
            | "total_amount"
          >;
        Update: Partial<InvoiceRow>;
      };
      invoice_items: {
        Row: InvoiceItemRow;
        Insert: Partial<InvoiceItemRow> &
          Pick<
            InvoiceItemRow,
            "invoice_id" | "description" | "quantity" | "unit_price" | "amount"
          >;
        Update: Partial<InvoiceItemRow>;
      };
      contracts: {
        Row: ContractRow;
        Insert: Partial<ContractRow> &
          Pick<ContractRow, "user_id" | "title">;
        Update: Partial<ContractRow>;
      };
      contract_signatures: {
        Row: ContractSignatureRow;
        Insert: Partial<ContractSignatureRow> &
          Pick<
            ContractSignatureRow,
            "contract_id" | "user_id" | "signature_type" | "legal_name"
          >;
        Update: Partial<ContractSignatureRow>;
      };
      files: {
        Row: FileRow;
        Insert: Partial<FileRow> &
          Pick<FileRow, "user_id" | "file_name" | "storage_path" | "file_size">;
        Update: Partial<FileRow>;
      };
      notifications: {
        Row: NotificationRow;
        Insert: Partial<NotificationRow> &
          Pick<NotificationRow, "user_id" | "type" | "title">;
        Update: Partial<NotificationRow>;
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow> &
          Pick<SubscriptionRow, "user_id">;
        Update: Partial<SubscriptionRow>;
      };
      usage_counters: {
        Row: UsageCounterRow;
        Insert: Partial<UsageCounterRow> &
          Pick<UsageCounterRow, "user_id" | "metric" | "period_start" | "period_end">;
        Update: Partial<UsageCounterRow>;
      };
      time_entries: {
        Row: TimeEntryRow;
        Insert: Partial<TimeEntryRow> &
          Pick<TimeEntryRow, "user_id" | "started_at">;
        Update: Partial<TimeEntryRow>;
      };
      activity_events: {
        Row: ActivityEventRow;
        Insert: Partial<ActivityEventRow> &
          Pick<ActivityEventRow, "user_id" | "kind" | "entity_type" | "title">;
        Update: Partial<ActivityEventRow>;
      };
      invoice_payment_attempts: {
        Row: InvoicePaymentAttemptRow;
        Insert: Partial<InvoicePaymentAttemptRow> &
          Pick<
            InvoicePaymentAttemptRow,
            "invoice_id" | "user_id" | "amount" | "status"
          >;
        Update: Partial<InvoicePaymentAttemptRow>;
      };
      billing_payments: {
        Row: BillingPaymentRow;
        Insert: Partial<BillingPaymentRow> &
          Pick<
            BillingPaymentRow,
            "user_id" | "razorpay_payment_id" | "amount" | "status"
          >;
        Update: Partial<BillingPaymentRow>;
      };
      invoice_receipts: {
        Row: InvoiceReceiptRow;
        Insert: Partial<InvoiceReceiptRow> &
          Pick<
            InvoiceReceiptRow,
            | "invoice_id"
            | "user_id"
            | "receipt_number"
            | "payment_method"
            | "amount"
            | "paid_at"
          >;
        Update: Partial<InvoiceReceiptRow>;
      };
      invoice_manual_confirmations: {
        Row: InvoiceManualConfirmationRow;
        Insert: Partial<InvoiceManualConfirmationRow> &
          Pick<
            InvoiceManualConfirmationRow,
            | "invoice_id"
            | "user_id"
            | "confirmed_by_user_id"
            | "amount"
            | "paid_at"
          >;
        Update: Partial<InvoiceManualConfirmationRow>;
      };
      billing_events: {
        Row: BillingEventRow;
        Insert: Partial<BillingEventRow> &
          Pick<BillingEventRow, "event_id" | "event_type" | "payload">;
        Update: Partial<BillingEventRow>;
      };
      delivery_logs: {
        Row: DeliveryLogRow;
        Insert: Partial<DeliveryLogRow> &
          Pick<DeliveryLogRow, "user_id" | "kind" | "entity_type">;
        Update: Partial<DeliveryLogRow>;
      };
      email_suppressions: {
        Row: EmailSuppressionRow;
        Insert: Partial<EmailSuppressionRow> &
          Pick<EmailSuppressionRow, "email" | "reason">;
        Update: Partial<EmailSuppressionRow>;
      };
      security_events: {
        Row: SecurityEventRow;
        Insert: Partial<SecurityEventRow> &
          Pick<SecurityEventRow, "kind">;
        Update: Partial<SecurityEventRow>;
      };
      admin_actions: {
        Row: AdminActionRow;
        Insert: Partial<AdminActionRow> &
          Pick<
            AdminActionRow,
            "actor_id" | "kind" | "target_type" | "success" | "duration_ms"
          >;
        Update: Partial<AdminActionRow>;
      };
      admin_notes: {
        Row: AdminNoteRow;
        Insert: Partial<AdminNoteRow> &
          Pick<AdminNoteRow, "actor_id" | "target_type" | "target_id" | "body">;
        Update: Partial<AdminNoteRow>;
      };
      platform_settings: {
        Row: PlatformSettingRow;
        Insert: Partial<PlatformSettingRow> &
          Pick<PlatformSettingRow, "key" | "value">;
        Update: Partial<PlatformSettingRow>;
      };
      portals: {
        Row: PortalRow;
        Insert: Partial<PortalRow> &
          Pick<PortalRow, "owner_user_id" | "name">;
        Update: Partial<PortalRow>;
      };
      portal_members: {
        Row: PortalMemberRow;
        Insert: Partial<PortalMemberRow> &
          Pick<PortalMemberRow, "portal_id" | "user_id" | "role">;
        Update: Partial<PortalMemberRow>;
      };
      portal_invitations: {
        Row: PortalInvitationRow;
        Insert: Partial<PortalInvitationRow> &
          Pick<
            PortalInvitationRow,
            "portal_id" | "email" | "token_hash" | "invited_by" | "expires_at"
          >;
        Update: Partial<PortalInvitationRow>;
      };
      portal_files: {
        Row: PortalFileRow;
        Insert: Partial<PortalFileRow> &
          Pick<
            PortalFileRow,
            | "portal_id"
            | "uploaded_by"
            | "r2_key"
            | "name"
            | "size_bytes"
            | "mime_type"
          >;
        Update: Partial<PortalFileRow>;
      };
      portal_messages: {
        Row: PortalMessageRow;
        Insert: Partial<PortalMessageRow> &
          Pick<PortalMessageRow, "portal_id" | "author_id" | "body">;
        Update: Partial<PortalMessageRow>;
      };
      portal_document_comments: {
        Row: PortalDocumentCommentRow;
        Insert: Partial<PortalDocumentCommentRow> &
          Pick<PortalDocumentCommentRow, "portal_id" | "doc_type" | "doc_id" | "author_id" | "body">;
        Update: Partial<PortalDocumentCommentRow>;
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Partial<PushSubscriptionRow> &
          Pick<PushSubscriptionRow, "user_id" | "endpoint" | "p256dh" | "auth">;
        Update: Partial<PushSubscriptionRow>;
      };
      portal_activity: {
        Row: PortalActivityRow;
        Insert: Partial<PortalActivityRow> &
          Pick<PortalActivityRow, "portal_id" | "type">;
        Update: Partial<PortalActivityRow>;
      };
      portal_storage_usage: {
        Row: PortalStorageUsageRow;
        Insert: Partial<PortalStorageUsageRow> &
          Pick<PortalStorageUsageRow, "portal_id">;
        Update: Partial<PortalStorageUsageRow>;
      };
      portal_notification_outbox: {
        Row: PortalNotificationOutboxRow;
        Insert: Partial<PortalNotificationOutboxRow> &
          Pick<
            PortalNotificationOutboxRow,
            "recipient_id" | "event_type" | "payload"
          >;
        Update: Partial<PortalNotificationOutboxRow>;
      };
      portal_updates: {
        Row: PortalUpdateRow;
        Insert: Partial<PortalUpdateRow> &
          Pick<PortalUpdateRow, "portal_id" | "author_id" | "title">;
        Update: Partial<PortalUpdateRow>;
      };
      portal_update_reactions: {
        Row: PortalUpdateReactionRow;
        Insert: Partial<PortalUpdateReactionRow> &
          Pick<PortalUpdateReactionRow, "update_id" | "user_id" | "kind">;
        Update: Partial<PortalUpdateReactionRow>;
      };
      portal_meetings: {
        Row: PortalMeetingRow;
        Insert: Partial<PortalMeetingRow> &
          Pick<PortalMeetingRow, "portal_id" | "requested_by" | "topic">;
        Update: Partial<PortalMeetingRow>;
      };
      portal_contracts: {
        Row: PortalContractRow;
        Insert: Partial<PortalContractRow> &
          Pick<PortalContractRow, "portal_id" | "contract_id" | "added_by">;
        Update: Partial<PortalContractRow>;
      };
      portal_invoices: {
        Row: PortalInvoiceRow;
        Insert: Partial<PortalInvoiceRow> &
          Pick<PortalInvoiceRow, "portal_id" | "invoice_id" | "added_by">;
        Update: Partial<PortalInvoiceRow>;
      };
      welcome_documents: {
        Row: WelcomeDocumentRow;
        Insert: Partial<WelcomeDocumentRow> &
          Pick<WelcomeDocumentRow, "user_id" | "title">;
        Update: Partial<WelcomeDocumentRow>;
      };
      welcome_document_views: {
        Row: WelcomeDocumentViewRow;
        Insert: Partial<WelcomeDocumentViewRow> &
          Pick<WelcomeDocumentViewRow, "document_id" | "fingerprint_hash">;
        Update: Partial<WelcomeDocumentViewRow>;
      };
      welcome_document_acknowledgements: {
        Row: WelcomeDocumentAcknowledgementRow;
        Insert: Partial<WelcomeDocumentAcknowledgementRow> &
          Pick<WelcomeDocumentAcknowledgementRow, "document_id" | "viewer_name">;
        Update: Partial<WelcomeDocumentAcknowledgementRow>;
      };
      welcome_document_templates: {
        Row: WelcomeDocumentTemplateRow;
        Insert: Partial<WelcomeDocumentTemplateRow> &
          Pick<WelcomeDocumentTemplateRow, "title" | "content">;
        Update: Partial<WelcomeDocumentTemplateRow>;
      };
      portal_welcome_documents: {
        Row: PortalWelcomeDocumentRow;
        Insert: Partial<PortalWelcomeDocumentRow> &
          Pick<PortalWelcomeDocumentRow, "portal_id" | "document_id">;
        Update: Partial<PortalWelcomeDocumentRow>;
      };
      referral_events: {
        Row: ReferralEventRow;
        Insert: Partial<ReferralEventRow> &
          Pick<ReferralEventRow, "referrer_id" | "referred_id">;
        Update: Partial<ReferralEventRow>;
      };
    };
    Views: {
      admin_user_overview: {
        Row: AdminUserOverviewRow;
      };
    };
    Functions: {
      increment_usage: {
        Args: {
          p_user_id: string;
          p_metric: string;
          p_delta?: number;
          p_now?: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
