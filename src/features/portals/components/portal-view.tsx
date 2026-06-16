"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  CheckSquare,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Receipt,
  Files,
  Grid2X2,
  HelpCircle,
  Home,
  Info,
  List,
  MessageSquare,
  MoreHorizontal,
  Video,
  UserPlus,
  Trash2,
  Send,
  Loader2,
  Upload,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  File,
  FileImage,
  FileArchive,
  FileCode,
  Music,
  Film,
  Share2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortalMessages } from "../hooks/use-portal-messages";
import { storageTone } from "../storage";
import { DocumentCommentsThread } from "./document-comments";
import { EnablePushButton } from "./enable-push-button";
import { PortalQrCard } from "./portal-qr-card";
import { PortalFileUploadButton } from "./file-upload-button";
import { TypingDots } from "./typing-dots";
import {
  invitePortalMemberAction,
  deletePortalFileAction,
  revokePortalMemberAction,
  attachContractToPortalAction,
  attachInvoiceToPortalAction,
  archivePortalAction,
  deletePortalAction,
  updatePortalOnboardingAction,
} from "../actions";
import { attachWelcomeToPortalAction } from "@/features/welcome-documents/actions";
import { PORTAL_DASHBOARD_INDEX } from "@/features/portals/routes";
import { UpdatesSection } from "./updates-section";
import { MeetingsSection } from "./meetings-section";
import type {
  PortalActivityRow,
  PortalFileRow,
  PortalMessageRow,
  PortalRole,
  PortalUpdateRow,
  PortalUpdateReactionRow,
  PortalMeetingRow,
} from "@/lib/supabase/types";

export interface ViewProps {
  portalId: string;
  portalName: string;
  brandColor: string;
  portalStatus: string;
  role: PortalRole;
  currentUserId: string;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  members: Array<{
    user_id: string;
    role: PortalRole;
    profile: { full_name: string | null; email: string | null } | null;
  }>;
  pendingInvitations: Array<{
    id: string;
    email: string;
    expires_at: string;
  }>;
  files: PortalFileRow[];
  messages: Array<
    PortalMessageRow & {
      author: { full_name: string | null; email: string | null } | null;
    }
  >;
  contracts: Array<{
    id: string;
    title: string;
    status: string;
    public_token: string | null;
  }>;
  availableContracts: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    total_amount: number;
    currency: string;
    status: string;
    public_token: string | null;
  }>;
  availableInvoices: Array<{
    id: string;
    invoice_number: string;
    total_amount: number;
    currency: string;
    status: string;
  }>;
  welcomeDocuments: Array<{
    id: string;
    title: string;
    status: string;
    public_token: string | null;
    acknowledgement_required: boolean;
  }>;
  availableWelcomeDocuments: Array<{
    id: string;
    title: string;
    status: string;
    acknowledgement_required: boolean;
  }>;
  activity: PortalActivityRow[];
  storageUsage: { totalBytes: number; fileCount: number };
  storageCap: number;
  r2Enabled: boolean;
  /** Current member's previous visit time — powers "what's new since last visit". */
  lastSeenAt: string | null;
  /** Branded onboarding (owner-set). */
  welcomeVideoUrl: string | null;
  welcomeMessage: string | null;
  /** Freelancer's brand logo (signed URL) — shown on the client portal. */
  brandLogoUrl: string | null;
  updates: Array<
    PortalUpdateRow & {
      author: { full_name: string | null; email: string | null } | null;
      reactions: Array<
        PortalUpdateReactionRow & {
          profile: { full_name: string | null; email: string | null } | null;
        }
      >;
    }
  >;
  meetings: Array<
    PortalMeetingRow & {
      requester: { full_name: string | null; email: string | null } | null;
    }
  >;
  timeByProject: Array<{
    projectId: string | null;
    projectName: string;
    status: string | null;
    totalSeconds: number;
    billableSeconds: number;
    billableAmount: number;
    currency: string;
    entryCount: number;
  }>;
}

/**
 * Single canonical portal view — rendered on both the freelancer dashboard
 * (/dashboard/portal/<id>) and the client workspace (/portal/<id>).
 * `role` drives which controls are visible; server actions also re-check.
 */
export function PortalView(props: ViewProps) {
  const isOwner = props.role === "owner";

  if (!isOwner) {
    return <ClientPortalExperience {...props} />;
  }

  // Owner: Updates → Meetings → Contracts → Invoices → Welcome → Files → Chat
  // Client: Updates → Meetings → Invoices → Contracts → Welcome → Files → Chat
  const mainSections = isOwner ? (
    <>
      <UpdatesSection
        portalId={props.portalId}
        portalName={props.portalName}
        updates={props.updates}
        isOwner={isOwner}
        currentUserId={props.currentUserId}
      />
      <MeetingsSection
        portalId={props.portalId}
        portalName={props.portalName}
        meetings={props.meetings}
        isOwner={isOwner}
        currentUserId={props.currentUserId}
      />
      <ContractsSection
        contracts={props.contracts}
        available={props.availableContracts}
        isOwner={isOwner}
        portalId={props.portalId}
        currentUserId={props.currentUserId}
      />
      <InvoicesSection
        invoices={props.invoices}
        available={props.availableInvoices}
        isOwner={isOwner}
        portalId={props.portalId}
        currentUserId={props.currentUserId}
      />
      <WelcomeDocumentsSection
        documents={props.welcomeDocuments}
        available={props.availableWelcomeDocuments}
        isOwner={isOwner}
        portalId={props.portalId}
        currentUserId={props.currentUserId}
      />
      <FilesSection
        portalId={props.portalId}
        files={props.files}
        isOwner={isOwner}
        currentUserId={props.currentUserId}
        r2Enabled={props.r2Enabled}
        usage={props.storageUsage}
        cap={props.storageCap}
      />
      <MessagesSection
        portalId={props.portalId}
        messages={props.messages}
        currentUserId={props.currentUserId}
      />
    </>
  ) : (
    <>
      <UpdatesSection
        portalId={props.portalId}
        portalName={props.portalName}
        updates={props.updates}
        isOwner={isOwner}
        currentUserId={props.currentUserId}
      />
      <MeetingsSection
        portalId={props.portalId}
        portalName={props.portalName}
        meetings={props.meetings}
        isOwner={isOwner}
        currentUserId={props.currentUserId}
      />
      <InvoicesSection
        invoices={props.invoices}
        available={props.availableInvoices}
        isOwner={isOwner}
        portalId={props.portalId}
        currentUserId={props.currentUserId}
      />
      <ContractsSection
        contracts={props.contracts}
        available={props.availableContracts}
        isOwner={isOwner}
        portalId={props.portalId}
        currentUserId={props.currentUserId}
      />
      <WelcomeDocumentsSection
        documents={props.welcomeDocuments}
        available={props.availableWelcomeDocuments}
        isOwner={isOwner}
        portalId={props.portalId}
        currentUserId={props.currentUserId}
      />
      <FilesSection
        portalId={props.portalId}
        files={props.files}
        isOwner={isOwner}
        currentUserId={props.currentUserId}
        r2Enabled={props.r2Enabled}
        usage={props.storageUsage}
        cap={props.storageCap}
      />
      <MessagesSection
        portalId={props.portalId}
        messages={props.messages}
        currentUserId={props.currentUserId}
      />
    </>
  );
  return (
    // pb-20 reserves space for the mobile bottom nav bar (hidden on sm+).
    // The owner brand header (client name + money + view-as-client) now lives
    // on the dashboard page above the overview cards, so it's not repeated here.
    <div className="relative space-y-5 pb-20 sm:pb-0">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {mainSections}
        </div>

        {/* Right rail — owner-only admin chrome. Sticky on desktop so it stays
            visible while the main column scrolls. */}
        {isOwner && (
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Members first — most actionable for the freelancer */}
            <MembersSection
              portalId={props.portalId}
              members={props.members}
              pendingInvitations={props.pendingInvitations}
              isOwner={isOwner}
              clientId={props.clientId ?? null}
              clientEmail={props.clientEmail ?? null}
            />
            <PortalTimeSection items={props.timeByProject} />
            <OnboardingSettingsSection
              portalId={props.portalId}
              welcomeVideoUrl={props.welcomeVideoUrl}
              welcomeMessage={props.welcomeMessage}
            />
            <PortalQrCard portalId={props.portalId} />
            <ActivitySection activity={props.activity} />
            {/* Settings last — destructive actions should be out of the way */}
            <PortalSettingsSection
              portalId={props.portalId}
              status={props.portalStatus}
              portalName={props.portalName}
              isOwner={isOwner}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom nav — anchor-scroll to key sections */}
      <MobileNavBar />
    </div>
  );
}

// ============================================================================
// Client portal app shell
// ============================================================================

type PortalDocument = {
  title: string;
  url: string;
  mimeType?: string | null;
  kind: "file" | "invoice" | "contract" | "guide" | "link";
};

function ClientPortalExperience(props: ViewProps) {
  const [viewerDoc, setViewerDoc] = React.useState<PortalDocument | null>(null);
  const paidAmount = props.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const outstandingAmount = props.invoices
    .filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const overdueAmount = props.invoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const currency = props.invoices[0]?.currency ?? "INR";
  const latestDeliverable =
    props.files.find((file) => file.category === "deliverable") ??
    props.files[0] ??
    null;
  const currentDeliverable =
    latestDeliverable?.name ??
    props.updates.find((update) => update.update_type === "deliverable")?.title ??
    "No deliverable shared yet";
  const upcomingMeeting = props.meetings.find(
    (meeting) => meeting.status === "accepted" || meeting.status === "pending",
  );
  const pendingApprovals = props.updates.filter(
    (update) =>
      update.update_type === "deliverable" &&
      update.approval_status !== "approved" &&
      update.approval_status !== "none",
  ).length;
  const latestUpdate = props.updates[0] ?? null;
  const completion = calculatePortalCompletion(props);
  const phase = latestUpdate
    ? formatUpdateType(latestUpdate.update_type)
    : props.portalStatus === "active"
      ? "In progress"
      : props.portalStatus.replace(/_/g, " ");
  const primaryInvoice = props.invoices.find(
    (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled",
  ) ?? props.invoices[0] ?? null;
  const primaryApproval = props.updates.find(
    (update) => update.update_type === "deliverable" && update.approval_status !== "approved",
  );

  return (
    <div className="relative min-h-[calc(100svh-7rem)] pb-28">
      <ClientTopBar portalName={props.portalName} />

      <div id="portal-home" className="space-y-5 scroll-mt-24">
        <section
          className="overflow-hidden rounded-[1.35rem] border bg-card shadow-sm"
          style={{ borderTop: `4px solid ${props.brandColor}` }}
        >
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Good to see you</p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {props.portalName}
                </h1>
                <p className="mt-1 text-sm font-medium capitalize text-muted-foreground">
                  {phase} • {completion}% Complete
                </p>
              </div>
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm"
                style={{ background: props.brandColor }}
                aria-hidden
              >
                {initialsFromPortalName(props.portalName)}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${completion}%`, background: props.brandColor }}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ClientStatusCard
            icon={Wallet}
            label="Payments"
            title={formatPortalCurrency(currency, outstandingAmount)}
            meta={`${formatPortalCurrency(currency, paidAmount)} paid • ${formatPortalCurrency(currency, overdueAmount)} overdue`}
          />
          <ClientStatusCard
            icon={CheckSquare}
            label="Current deliverable"
            title={currentDeliverable}
            meta={latestDeliverable ? "Ready to view or download" : "Your freelancer will share it here"}
          />
          <ClientStatusCard
            icon={Clock3}
            label="Upcoming meeting"
            title={upcomingMeeting?.proposed_time ?? "No meeting scheduled"}
            meta={upcomingMeeting?.topic ?? "Request one when you need alignment"}
          />
          <ClientStatusCard
            icon={CheckCircle2}
            label="Pending approvals"
            title={pendingApprovals > 0 ? `${pendingApprovals} awaiting review` : "Nothing pending"}
            meta={primaryApproval?.title ?? "You are all caught up"}
          />
          <ClientStatusCard
            icon={MessageSquare}
            label="Recent update"
            title={latestUpdate?.title ?? "No updates yet"}
            meta={latestUpdate?.body ?? "Progress notes will appear here"}
            className="sm:col-span-2 lg:col-span-1"
          />
        </section>

        <ClientQuickActions
          portalId={props.portalId}
          invoice={primaryInvoice}
          deliverable={latestDeliverable}
          meeting={upcomingMeeting ?? null}
          approval={primaryApproval ?? null}
          onOpenDocument={setViewerDoc}
        />

        <ClientActivityTimeline activity={props.activity} />
      </div>

      <section id="portal-updates" className="mt-6 scroll-mt-24">
        <UpdatesSection
          portalId={props.portalId}
          portalName={props.portalName}
          updates={props.updates}
          isOwner={false}
          currentUserId={props.currentUserId}
        />
      </section>

      <ClientFilesPanel
        portalId={props.portalId}
        files={props.files}
        invoices={props.invoices}
        contracts={props.contracts}
        welcomeDocuments={props.welcomeDocuments}
        currentUserId={props.currentUserId}
        r2Enabled={props.r2Enabled}
        onOpenDocument={setViewerDoc}
      />

      <section id="portal-meetings" className="mt-6 scroll-mt-24">
        <MeetingsSection
          portalId={props.portalId}
          portalName={props.portalName}
          meetings={props.meetings}
          isOwner={false}
          currentUserId={props.currentUserId}
        />
      </section>

      <ClientMorePanel
        portalName={props.portalName}
        members={props.members}
        messages={props.messages}
        portalId={props.portalId}
        currentUserId={props.currentUserId}
      />

      <ClientBottomNav />
      <DocumentViewer document={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}

function ClientTopBar({ portalName }: { portalName: string }) {
  return (
    <div
      className="sticky top-14 z-20 -mx-4 mb-4 border-b bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
      style={{ top: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{portalName}</p>
          <p className="text-[11px] text-muted-foreground">Client companion app</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="More">
            <a href="#portal-more">
              <MoreHorizontal className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClientStatusCard({
  icon: Icon,
  label,
  title,
  meta,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  meta: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-sm ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{meta}</p>
    </div>
  );
}

function ClientQuickActions({
  portalId,
  invoice,
  deliverable,
  meeting,
  approval,
  onOpenDocument,
}: {
  portalId: string;
  invoice: ViewProps["invoices"][number] | null;
  deliverable: PortalFileRow | null;
  meeting: ViewProps["meetings"][number] | null;
  approval: ViewProps["updates"][number] | null;
  onOpenDocument: (document: PortalDocument) => void;
}) {
  const invoiceUrl = invoice?.public_token ? `/i/${invoice.public_token}` : null;
  const fileUrl = deliverable ? `/api/portals/${portalId}/files/${deliverable.id}/download` : null;

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Quick actions</h2>
        <span className="text-[11px] text-muted-foreground">What matters now</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <QuickAction
          icon={Video}
          label="Join Meeting"
          href={meeting?.meet_link}
          disabled={!meeting?.meet_link}
          external
        />
        <QuickAction
          icon={CreditCard}
          label="View Invoice"
          disabled={!invoiceUrl}
          onClick={() => invoiceUrl && onOpenDocument({ title: invoice?.invoice_number ?? "Invoice", url: invoiceUrl, kind: "invoice" })}
        />
        <QuickAction
          icon={Download}
          label="Download Deliverable"
          href={fileUrl}
          disabled={!fileUrl}
        />
        <QuickAction
          icon={CheckCircle2}
          label="Approve Deliverable"
          href="#portal-updates"
          disabled={!approval}
        />
        <QuickAction
          icon={MessageSquare}
          label="Open WhatsApp"
          href="https://wa.me/"
          external
        />
        <QuickAction
          icon={Files}
          label="View Files"
          href="#portal-files"
        />
      </div>
    </section>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  disabled,
  external,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string | null;
  disabled?: boolean;
  external?: boolean;
  onClick?: () => void;
}) {
  const className =
    "flex min-h-14 items-center justify-center gap-2 rounded-xl border bg-background px-3 py-3 text-xs font-semibold shadow-sm transition hover:border-primary/40 hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-45";
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} disabled={disabled}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    );
  }
  return (
    <a
      href={disabled ? undefined : href ?? "#"}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={`${className} ${disabled ? "pointer-events-none opacity-45" : ""}`}
      aria-disabled={disabled}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </a>
  );
}

function ClientActivityTimeline({ activity }: { activity: ViewProps["activity"] }) {
  const visible = [...activity]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 6);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold">Recent activity</h2>
      {visible.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-7 w-7 text-muted-foreground/30" />}
          message="No activity yet."
          hint="Updates, invoices, files, and meetings will appear here."
        />
      ) : (
        <ol className="space-y-0">
          {visible.map((item, index) => (
            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index !== visible.length - 1 && (
                <span className="absolute left-[7px] top-4 h-full w-px bg-border" />
              )}
              <span className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${getActivityDotColor(item.type)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold">{formatActivityTitle(item)}</p>
                  <time className="shrink-0 text-[10px] text-muted-foreground" dateTime={item.created_at}>
                    {getRelativeTime(item.created_at)}
                  </time>
                </div>
                {formatActivityDescription(item) && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {formatActivityDescription(item)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ClientFilesPanel({
  portalId,
  files,
  invoices,
  contracts,
  welcomeDocuments,
  currentUserId,
  r2Enabled,
  onOpenDocument,
}: {
  portalId: string;
  files: PortalFileRow[];
  invoices: ViewProps["invoices"];
  contracts: ViewProps["contracts"];
  welcomeDocuments: ViewProps["welcomeDocuments"];
  currentUserId: string;
  r2Enabled: boolean;
  onOpenDocument: (document: PortalDocument) => void;
}) {
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [localFiles, setLocalFiles] = React.useState(files);
  React.useEffect(() => setLocalFiles(files), [files]);
  const categories = ["deliverable", "contract", "invoice", "asset", "meeting_note", "misc"];

  return (
    <section id="portal-files" className="mt-6 scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Files</h2>
          <p className="text-xs text-muted-foreground">Deliverables, contracts, invoices, assets, and notes.</p>
        </div>
        <div className="flex rounded-full border bg-background p-1">
          <button
            type="button"
            className={`rounded-full p-2 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`rounded-full p-2 ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <Grid2X2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {r2Enabled && (
        <div className="mb-4 flex justify-end">
          <PortalFileUploadButton
            portalId={portalId}
            currentUserId={currentUserId}
            onUploaded={(f) => setLocalFiles((prev) => [f, ...prev])}
          />
        </div>
      )}

      {(invoices.length > 0 || contracts.length > 0 || welcomeDocuments.length > 0) && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Portal documents</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {invoices.map((invoice) => (
              <PortalDocumentCard
                key={`invoice-${invoice.id}`}
                icon={Receipt}
                title={invoice.invoice_number}
                meta={`${formatPortalCurrency(invoice.currency, invoice.total_amount)} • ${invoice.status.replace(/_/g, " ")}`}
                disabled={!invoice.public_token}
                onOpen={() =>
                  invoice.public_token &&
                  onOpenDocument({
                    title: invoice.invoice_number,
                    url: `/i/${invoice.public_token}`,
                    kind: "invoice",
                  })
                }
              />
            ))}
            {contracts.map((contract) => (
              <PortalDocumentCard
                key={`contract-${contract.id}`}
                icon={FileText}
                title={contract.title}
                meta={contract.status.replace(/_/g, " ")}
                disabled={!contract.public_token}
                onOpen={() =>
                  contract.public_token &&
                  onOpenDocument({
                    title: contract.title,
                    url: `/c/${contract.public_token}`,
                    kind: "contract",
                  })
                }
              />
            ))}
            {welcomeDocuments.map((document) => (
              <PortalDocumentCard
                key={`welcome-${document.id}`}
                icon={BookOpen}
                title={document.title}
                meta={`${document.status.replace(/_/g, " ")}${document.acknowledgement_required ? " • acknowledgement required" : ""}`}
                disabled={!document.public_token}
                onOpen={() =>
                  document.public_token &&
                  onOpenDocument({
                    title: document.title,
                    url: `/w/${document.public_token}`,
                    kind: "guide",
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {localFiles.length === 0 ? (
        <EmptyState
          icon={<Files className="h-7 w-7 text-muted-foreground/30" />}
          message="No files shared yet."
          hint="Important delivery files will stay organized here."
        />
      ) : (
        <div className="space-y-5">
          {categories.map((category) => {
            const grouped = localFiles.filter((file) => (file.category ?? "misc") === category);
            if (grouped.length === 0) return null;
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${CATEGORY_STYLE[category] ?? "bg-muted text-muted-foreground"}`}>
                    {CATEGORY_LABEL[category] || "Other"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{grouped.length} file{grouped.length > 1 ? "s" : ""}</span>
                </div>
                <div className={view === "grid" ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}>
                  {grouped.map((file) => (
                    <ClientFileCard
                      key={file.id}
                      portalId={portalId}
                      file={file}
                      uploadedBy={file.uploaded_by === currentUserId ? "You" : "Freelancer"}
                      onOpenDocument={onOpenDocument}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PortalDocumentCard({
  icon: Icon,
  title,
  meta,
  disabled,
  onOpen,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta: string;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-xl border bg-background p-3 text-left transition hover:border-primary/40 disabled:pointer-events-none disabled:opacity-45"
      onClick={onOpen}
      disabled={disabled}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-[11px] capitalize text-muted-foreground">{meta}</span>
      </span>
      <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ClientFileCard({
  portalId,
  file,
  uploadedBy,
  onOpenDocument,
}: {
  portalId: string;
  file: PortalFileRow;
  uploadedBy: string;
  onOpenDocument: (document: PortalDocument) => void;
}) {
  const url = `/api/portals/${portalId}/files/${file.id}/download`;

  async function shareFile() {
    const nav = globalThis.navigator as
      | (Navigator & { share?: (data: ShareData) => Promise<void> })
      | undefined;
    if (nav?.share) {
      await nav.share({ title: file.name, url });
      return;
    }
    await nav?.clipboard?.writeText(`${window.location.origin}${url}`);
  }

  return (
    <article className="flex items-center gap-3 rounded-xl border bg-background p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <FileTypeIcon mimeType={file.mime_type ?? ""} className="h-5 w-5" />
      </span>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpenDocument({ title: file.name, url, mimeType: file.mime_type, kind: "file" })}
      >
        <p className="truncate text-sm font-semibold">{file.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatBytes(file.size_bytes)} • {uploadedBy} • {formatDate(file.created_at)}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => onOpenDocument({ title: file.name, url, mimeType: file.mime_type, kind: "file" })}
          aria-label={`Preview ${file.name}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`Download ${file.name}`}>
          <a href={url}>
            <Download className="h-4 w-4" />
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={shareFile}
          aria-label={`Share ${file.name}`}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function ClientMorePanel({
  portalName,
  members,
  messages,
  portalId,
  currentUserId,
}: {
  portalName: string;
  members: ViewProps["members"];
  messages: ViewProps["messages"];
  portalId: string;
  currentUserId: string;
}) {
  const client = members.find((member) => member.role === "client") ?? members[0] ?? null;

  return (
    <section id="portal-more" className="mt-6 scroll-mt-24 space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">More</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MoreRow icon={UserPlus} title="Profile" meta={client?.profile?.email ?? "Client access"} />
          <MoreRow icon={Bell} title="Notifications" meta="Portal alerts and reminders" />
          <MoreRow icon={HelpCircle} title="Help & support" meta="Get help from your freelancer" />
          <MoreRow icon={Info} title="Portal information" meta={portalName} />
        </div>
      </div>
      <MessagesSection portalId={portalId} messages={messages} currentUserId={currentUserId} />
    </section>
  );
}

function MoreRow({
  icon: Icon,
  title,
  meta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
    </div>
  );
}

function ClientBottomNav() {
  const items = [
    { href: "#portal-home", icon: Home, label: "Home" },
    { href: "#portal-updates", icon: MessageSquare, label: "Updates" },
    { href: "#portal-files", icon: Files, label: "Files" },
    { href: "#portal-meetings", icon: Video, label: "Meetings" },
    { href: "#portal-more", icon: MoreHorizontal, label: "More" },
  ] as const;

  return (
    <nav
      aria-label="Client portal navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)" }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between rounded-full border bg-background/95 p-1.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md">
        {items.map(({ href, icon: Icon, label }, index) => (
          <a
            key={href}
            href={href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1.5 py-2 text-[10px] font-semibold transition ${
              index === 0
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function DocumentViewer({
  document,
  onClose,
}: {
  document: PortalDocument | null;
  onClose: () => void;
}) {
  if (!document) return null;
  const isImage = document.mimeType?.startsWith("image/");

  async function shareDocument() {
    if (!document) return;
    const nav = globalThis.navigator as
      | (Navigator & { share?: (data: ShareData) => Promise<void> })
      | undefined;
    if (nav?.share) {
      await nav.share({ title: document.title, url: document.url });
      return;
    }
    await nav?.clipboard?.writeText(`${window.location.origin}${document.url}`);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <div
        className="flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)" }}
      >
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onClose} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{document.title}</p>
          <p className="text-[11px] capitalize text-muted-foreground">{document.kind}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={shareDocument} aria-label="Share">
          <Share2 className="h-4 w-4" />
        </Button>
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Download">
          <a href={document.url}>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 bg-muted/40">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={document.url} alt={document.title} className="m-auto max-h-full max-w-full object-contain" />
        ) : (
          <iframe
            title={document.title}
            src={document.url}
            className="h-full w-full border-0 bg-background"
          />
        )}
      </div>
    </div>
  );
}

function calculatePortalCompletion(props: ViewProps): number {
  const totalSignals =
    props.updates.length +
    props.files.length +
    props.invoices.length +
    props.contracts.length +
    props.meetings.length;
  if (totalSignals === 0) return 12;
  const completedSignals =
    props.updates.filter((update) => update.approval_status === "approved").length +
    props.files.length +
    props.invoices.filter((invoice) => invoice.status === "paid").length +
    props.contracts.filter((contract) => contract.status === "signed").length +
    props.meetings.filter((meeting) => meeting.status === "completed").length;
  return Math.max(12, Math.min(96, Math.round((completedSignals / totalSignals) * 100)));
}

function formatUpdateType(type: ViewProps["updates"][number]["update_type"]): string {
  return type.replace(/_/g, " ");
}

function initialsFromPortalName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "S";
}

// ============================================================================
// Mobile bottom navigation
// ============================================================================

function MobileNavBar() {
  const items = [
    { href: "#portal-updates",  icon: MessageSquare, label: "Updates" },
    { href: "#portal-meetings", icon: Video,         label: "Meetings" },
    { href: "#portal-files",    icon: Files,         label: "Files"    },
    { href: "#portal-chat",     icon: Send,          label: "Chat"     },
  ] as const;

  return (
    <nav
      aria-label="Portal sections"
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden"
    >
      <div className="flex items-stretch justify-around">
        {items.map(({ href, icon: Icon, label }) => (
          <a
            key={href}
            href={href}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground active:text-foreground"
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

// ============================================================================
// Section: Welcome guides
// ============================================================================

function WelcomeDocumentsSection({
  documents,
  available,
  isOwner,
  portalId,
  currentUserId,
}: {
  documents: ViewProps["welcomeDocuments"];
  available: ViewProps["availableWelcomeDocuments"];
  isOwner: boolean;
  portalId: string;
  currentUserId: string;
}) {
  return (
    <Card id="portal-welcome" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Welcome guides
        </CardTitle>
        {isOwner && (
          <AttachExistingDialog
            triggerLabel="Attach"
            title="Attach a welcome guide"
            description="Pick a welcome document to share in this portal."
            emptyMessage="No welcome documents available to attach."
            items={available.map((doc) => ({
              id: doc.id,
              label: doc.title,
              meta: `${doc.status.replace(/_/g, " ")}${doc.acknowledgement_required ? " · ack" : ""}`,
            }))}
            onAttach={async (id) => attachWelcomeToPortalAction({ portalId, documentId: id })}
          />
        )}
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-7 w-7 text-muted-foreground/30" />}
            message={isOwner ? "Attach a welcome guide to onboard your client." : "No onboarding guides attached yet."}
          />
        ) : (
          <ul className={`divide-y rounded-lg border ${documents.length > 5 ? "max-h-[28rem] overflow-y-auto scrollbar-thin" : ""}`}>
            {documents.map((d) => {
              const needsAck = d.acknowledgement_required && d.status !== "acknowledged";
              return (
                <li key={d.id} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                        {d.status.replace(/_/g, " ")}
                        {d.acknowledgement_required ? " · acknowledgement required" : ""}
                      </p>
                    </div>
                    {isOwner ? (
                      // Freelancer: open the welcome doc in the dashboard — never
                      // the client-facing "Read & acknowledge".
                      <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
                        <Link href={`/dashboard/welcome/${d.id}`}>
                          View
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      d.public_token && (
                        <Button
                          asChild
                          size="sm"
                          variant={needsAck ? "default" : "outline"}
                          className="h-8 shrink-0"
                        >
                          <Link href={`/w/${d.public_token}`} target="_blank">
                            {needsAck ? "Read & acknowledge" : "Read guide"}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )
                    )}
                  </div>
                  <DocumentCommentsThread
                    portalId={portalId}
                    docType="welcome"
                    docId={d.id}
                    currentUserId={currentUserId}
                    isOwner={isOwner}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Contracts
// ============================================================================

function ContractsSection({
  contracts,
  available,
  isOwner,
  portalId,
  currentUserId,
}: {
  contracts: ViewProps["contracts"];
  available: ViewProps["availableContracts"];
  isOwner: boolean;
  portalId: string;
  currentUserId: string;
}) {
  const pendingCount = contracts.filter(
    (c) => c.status !== "signed" && c.status !== "declined",
  ).length;

  return (
    <Card id="portal-contracts" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Contracts
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              {pendingCount} to sign
            </span>
          )}
        </CardTitle>
        {isOwner && (
          <AttachExistingDialog
            triggerLabel="Attach"
            title="Attach a contract"
            description="Pick a contract to attach to this portal."
            emptyMessage="No contracts available to attach."
            items={available.map((c) => ({
              id: c.id,
              label: c.title,
              meta: c.status.replace(/_/g, " "),
            }))}
            onAttach={async (id) => attachContractToPortalAction({ portalId, contractId: id })}
          />
        )}
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7 text-muted-foreground/30" />}
            message="No contracts attached yet."
          />
        ) : (
          <ul className={`divide-y rounded-lg border ${contracts.length > 5 ? "max-h-[28rem] overflow-y-auto scrollbar-thin" : ""}`}>
            {contracts.map((c) => {
              const needsSign = c.status !== "signed" && c.status !== "declined";
              return (
                <li key={c.id} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                        {c.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    {isOwner ? (
                      // Freelancer: manage the contract in the dashboard — never
                      // the client-facing "Review & sign" action.
                      <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
                        <Link href={`/dashboard/contracts/${c.id}`}>
                          View
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      c.public_token && (
                        <Button
                          asChild
                          size="sm"
                          variant={needsSign ? "default" : "outline"}
                          className="h-8 shrink-0"
                        >
                          <Link href={`/c/${c.public_token}`} target="_blank">
                            {needsSign ? "Review & sign" : "View"}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )
                    )}
                  </div>
                  <DocumentCommentsThread
                    portalId={portalId}
                    docType="contract"
                    docId={c.id}
                    currentUserId={currentUserId}
                    isOwner={isOwner}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Invoices
// ============================================================================

function InvoicesSection({
  invoices,
  available,
  isOwner,
  portalId,
  currentUserId,
}: {
  invoices: ViewProps["invoices"];
  available: ViewProps["availableInvoices"];
  isOwner: boolean;
  portalId: string;
  currentUserId: string;
}) {
  const unpaidCount = invoices.filter(
    (i) => i.status !== "paid" && i.status !== "cancelled",
  ).length;

  return (
    <Card id="portal-invoices" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Invoices
          {unpaidCount > 0 && (
            <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
              {unpaidCount} unpaid
            </span>
          )}
        </CardTitle>
        {isOwner && (
          <AttachExistingDialog
            triggerLabel="Attach"
            title="Attach an invoice"
            description="Pick an invoice to share in this portal."
            emptyMessage="No invoices available to attach."
            items={available.map((i) => ({
              id: i.id,
              label: i.invoice_number,
              meta: `${i.currency} ${i.total_amount} · ${i.status}`,
            }))}
            onAttach={async (id) => attachInvoiceToPortalAction({ portalId, invoiceId: id })}
          />
        )}
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7 text-muted-foreground/30" />}
            message="No invoices attached yet."
          />
        ) : (
          <ul className={`divide-y rounded-lg border ${invoices.length > 5 ? "max-h-[28rem] overflow-y-auto scrollbar-thin" : ""}`}>
            {invoices.map((i) => {
              const paid = i.status === "paid";
              const cancelled = i.status === "cancelled";
              return (
                <li key={i.id} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.invoice_number}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        <span className="font-medium tabular-nums text-foreground">
                          {formatPortalCurrency(i.currency, i.total_amount)}
                        </span>
                        {" · "}
                        <span
                          className={
                            paid
                              ? "font-medium capitalize text-emerald-600 dark:text-emerald-400"
                              : cancelled
                                ? "capitalize text-muted-foreground line-through"
                                : "capitalize"
                          }
                        >
                          {i.status.replace(/_/g, " ")}
                        </span>
                      </p>
                    </div>
                    {isOwner ? (
                      // Freelancer: open the invoice in the dashboard — never the
                      // client-facing "Pay now". Always available, every invoice.
                      <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
                        <Link href={`/dashboard/invoices/${i.id}`}>
                          View
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      i.public_token && (
                        <Button
                          asChild
                          size="sm"
                          variant={paid || cancelled ? "outline" : "default"}
                          className="h-8 shrink-0"
                        >
                          <Link href={`/i/${i.public_token}`} target="_blank">
                            {paid ? "View receipt" : cancelled ? "View" : "Pay now"}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )
                    )}
                  </div>
                  <DocumentCommentsThread
                    portalId={portalId}
                    docType="invoice"
                    docId={i.id}
                    currentUserId={currentUserId}
                    isOwner={isOwner}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Files
// ============================================================================

// Map MIME type → icon component
function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cls = className ?? "h-4 w-4 shrink-0";
  if (mimeType.startsWith("image/"))  return <FileImage   className={cls} />;
  if (mimeType.startsWith("video/"))  return <Film        className={cls} />;
  if (mimeType.startsWith("audio/"))  return <Music       className={cls} />;
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document"))
                                      return <FileText    className={cls} />;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gzip") || mimeType.includes("archive"))
                                      return <FileArchive className={cls} />;
  if (mimeType.startsWith("text/code") || mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("json"))
                                      return <FileCode    className={cls} />;
  if (mimeType.startsWith("text/"))   return <FileText    className={cls} />;
  return <File className={cls} />;
}

const CATEGORY_LABEL: Record<string, string> = {
  contract:     "Contract",
  deliverable:  "Deliverable",
  asset:        "Asset",
  invoice:      "Invoice",
  meeting_note: "Meeting note",
  misc:         "",
};

const CATEGORY_STYLE: Record<string, string> = {
  contract:     "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  deliverable:  "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  asset:        "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  invoice:      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  meeting_note: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  misc:         "",
};

function FilesSection({
  portalId,
  files,
  isOwner,
  currentUserId,
  r2Enabled,
  usage,
  cap,
}: {
  portalId: string;
  files: PortalFileRow[];
  isOwner: boolean;
  currentUserId: string;
  r2Enabled: boolean;
  usage: { totalBytes: number; fileCount: number };
  cap: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [sortByLargest, setSortByLargest] = React.useState(false);
  // Local copy so uploads/deletes reflect instantly; re-synced from server props.
  const [localFiles, setLocalFiles] = React.useState(files);
  React.useEffect(() => setLocalFiles(files), [files]);
  const liveUsage = {
    totalBytes: localFiles.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0),
    fileCount: localFiles.length,
  };
  const usagePct = Number.isFinite(cap) && cap > 0
    ? Math.min(100, (liveUsage.totalBytes / cap) * 100)
    : 0;
  const tone = storageTone(liveUsage.totalBytes, cap);
  const barColor =
    tone === "full" ? "bg-destructive" : tone === "warn" ? "bg-amber-500" : "bg-primary";
  const displayFiles = sortByLargest
    ? [...localFiles].sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0))
    : localFiles;

  async function onDelete(fileId: string, fileName: string) {
    const ok = await confirm({
      title: `Delete "${fileName}"?`,
      description: "This file will be permanently removed from the portal.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setLocalFiles((prev) => prev.filter((f) => f.id !== fileId)); // optimistic
    await deletePortalFileAction({ portalId, fileId });
    router.refresh();
  }

  return (
    <Card id="portal-files" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Files className="h-4 w-4 text-muted-foreground" />
          Files
          <span className="text-[11px] font-normal text-muted-foreground">
            {formatBytes(liveUsage.totalBytes)}
            {Number.isFinite(cap) ? ` / ${formatBytes(cap)}` : ""}
          </span>
        </CardTitle>
        {r2Enabled && (
          <PortalFileUploadButton
            portalId={portalId}
            currentUserId={currentUserId}
            onUploaded={(f) => setLocalFiles((prev) => [f, ...prev])}
            className="h-8"
          />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Storage bar + usage */}
        {Number.isFinite(cap) && (
          <div className="space-y-1.5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={usagePct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full transition-[width] ${barColor}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] ${tone === "full" ? "text-destructive" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {formatBytes(liveUsage.totalBytes)} of {formatBytes(cap)} used
                {tone !== "ok" && " — free up space"}
              </span>
              {localFiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSortByLargest((v) => !v)}
                  className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {sortByLargest ? "Sort by newest" : "Largest first"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* R2 not configured warning */}
        {!r2Enabled && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-300">
            File storage isn&apos;t configured. Set{" "}
            <code className="font-mono">R2_ACCOUNT_ID</code>,{" "}
            <code className="font-mono">R2_ACCESS_KEY_ID</code>,{" "}
            <code className="font-mono">R2_SECRET_ACCESS_KEY</code>,{" "}
            <code className="font-mono">R2_BUCKET</code> in your environment to
            enable uploads.
          </p>
        )}

        {localFiles.length === 0 ? (
          <EmptyState
            icon={<Files className="h-7 w-7 text-muted-foreground/30" />}
            message="No files shared yet."
            hint={r2Enabled ? "Upload files to share them with your client." : undefined}
          />
        ) : (
          <ul className={`divide-y rounded-lg border ${displayFiles.length > 5 ? "max-h-80 overflow-y-auto scrollbar-thin" : ""}`}>
            {displayFiles.map((f) => {
              const catLabel = CATEGORY_LABEL[f.category ?? "misc"] ?? "";
              const catStyle = CATEGORY_STYLE[f.category ?? "misc"] ?? "";
              return (
                <li
                  key={f.id}
                  className="group flex items-center gap-3 px-3 py-2.5"
                >
                  {/* File type icon */}
                  <span className="shrink-0 text-muted-foreground">
                    <FileTypeIcon mimeType={f.mime_type ?? ""} />
                  </span>

                  {/* Name + category */}
                  <a
                    href={`/api/portals/${portalId}/files/${f.id}/download`}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 hover:underline"
                  >
                    <span className="truncate text-sm font-medium leading-tight">
                      {f.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {catLabel && (
                        <span className={`mr-1.5 rounded px-1 py-0.5 text-[10px] font-medium ${catStyle}`}>
                          {catLabel}
                        </span>
                      )}
                      {formatBytes(f.size_bytes)}
                    </span>
                  </a>

                  {/* Delete */}
                  {(isOwner || f.uploaded_by === currentUserId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => onDelete(f.id, f.name)}
                      aria-label={`Delete ${f.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


// ============================================================================
// Section: Chat
// ============================================================================

function MessagesSection({
  portalId,
  messages,
  currentUserId,
}: {
  portalId: string;
  messages: ViewProps["messages"];
  currentUserId: string;
}) {
  const {
    messages: live, peerOnline, peerTyping, peerReadAt, pending, error, send, notifyTyping,
  } = usePortalMessages({ portalId, currentUserId, initialMessages: messages });
  const [body, setBody] = React.useState("");
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [live.length, peerTyping]);

  const myLast = [...live].reverse().find((m) => m.author_id === currentUserId);
  const seen = Boolean(
    myLast && !myLast.pending && peerReadAt &&
      Date.parse(peerReadAt) >= Date.parse(myLast.created_at),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const text = body;
    setBody("");
    await send(text);
  }

  return (
    <Card id="portal-chat" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Chat
        </CardTitle>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            peerTyping
              ? "bg-primary/10 text-primary"
              : peerOnline
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {peerTyping ? (
            <>
              <TypingDots /> typing
            </>
          ) : (
            <>
              <span className="relative flex h-1.5 w-1.5">
                {peerOnline && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                )}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${peerOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
              </span>
              {peerOnline ? "Online" : "Offline"}
            </>
          )}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message thread */}
        {live.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-7 w-7 text-muted-foreground/30" />}
            message="No messages yet."
            hint="Use the form below to start the conversation."
          />
        ) : (
          <ul ref={listRef} className="max-h-[46svh] space-y-3 overflow-y-auto">
            {live.map((m) => {
              const mine = m.author_id === currentUserId;
              return (
                <li
                  key={m.id}
                  className={`max-w-[86%] rounded-2xl border p-3 ${
                    mine
                      ? "ml-auto rounded-br-sm border-primary/30 bg-primary text-primary-foreground"
                      : "mr-auto rounded-bl-sm bg-background"
                  } ${m.pending ? "opacity-70" : ""}`}
                >
                  <p
                    className={`text-[11px] font-semibold ${
                      mine ? "text-primary-foreground/75" : "text-muted-foreground"
                    }`}
                  >
                    {mine ? "You" : m.author?.full_name ?? m.author?.email ?? "Client"}{" "}
                    · {getRelativeTime(m.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {m.body}
                  </p>
                </li>
              );
            })}
            {peerTyping && (
              <li className="mr-auto flex w-fit items-center rounded-2xl rounded-bl-sm border bg-background px-3.5 py-2.5 text-muted-foreground">
                <TypingDots />
              </li>
            )}
          </ul>
        )}

        {/* Compose */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <form onSubmit={onSubmit} className="space-y-2.5">
            <Textarea
              id="portal-message"
              placeholder="Write a message, ask a question, or share a quick note…"
              value={body}
              onChange={(e) => { setBody(e.target.value); notifyTyping(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit(e as unknown as React.FormEvent);
                }
              }}
              maxLength={8000}
              rows={3}
              aria-label="Message"
            />
            {error && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                {myLast && !myLast.pending ? (seen ? "Seen" : "Sent") : "For files, use the Files section above."}
              </p>
              <Button
                type="submit"
                size="sm"
                className="h-8 shrink-0"
                disabled={pending || body.trim().length === 0}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Send</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Onboarding (owner only — branded welcome video + message)
// ============================================================================

function OnboardingSettingsSection({
  portalId,
  welcomeVideoUrl,
  welcomeMessage,
}: {
  portalId: string;
  welcomeVideoUrl: string | null;
  welcomeMessage: string | null;
}) {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = React.useState(welcomeVideoUrl ?? "");
  const [message, setMessage] = React.useState(welcomeMessage ?? "");
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await updatePortalOnboardingAction({
      portalId,
      welcomeVideoUrl: videoUrl.trim(),
      welcomeMessage: message.trim(),
    });
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not save."); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  const dirty =
    videoUrl.trim() !== (welcomeVideoUrl ?? "") ||
    message.trim() !== (welcomeMessage ?? "");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          Onboarding
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          A welcome video + note greets your client on their portal home.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="welcome-video" className="text-xs">Welcome video link</Label>
          <Input
            id="welcome-video"
            placeholder="Loom or YouTube link (optional)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="welcome-message" className="text-xs">Welcome message</Label>
          <Textarea
            id="welcome-message"
            placeholder="A short, warm intro for your client…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>
        {error && (
          <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
        )}
        <Button
          size="sm"
          className="w-full"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? "Saved" : "Save onboarding"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Portal settings (owner only, destructive — lives at bottom of rail)
// ============================================================================

function PortalSettingsSection({
  portalId,
  status,
  portalName,
  isOwner,
}: {
  portalId: string;
  status: string;
  portalName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState("");
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const archived = status === "archived";

  async function onArchive() {
    if (pending || archived) return;
    setPending(true);
    setError(null);
    const res = await archivePortalAction({ portalId });
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not deactivate portal."); return; }
    router.refresh();
  }

  async function onDelete() {
    if (pending) return;
    if (confirmName.trim() !== portalName) {
      setDialogError("Portal name does not match.");
      return;
    }
    setPending(true);
    setDialogError(null);
    const res = await deletePortalAction({ portalId });
    setPending(false);
    if (!res.ok) { setDialogError(res.error ?? "Could not delete portal."); return; }
    setConfirmName("");
    setDeleteOpen(false);
    router.push(PORTAL_DASHBOARD_INDEX);
    router.refresh();
  }

  if (!isOwner) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          Portal settings
        </CardTitle>
        <EnablePushButton className="h-8 shrink-0" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Deactivate to pause client access. Delete to permanently remove the
          portal and all attachments.
        </p>
        {error && (
          <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onArchive}
            disabled={pending || archived}
            className="w-full"
          >
            {archived ? "Portal deactivated" : "Deactivate portal"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { setError(null); setDeleteOpen(true); }}
            disabled={pending}
            className="w-full"
          >
            Delete portal
          </Button>
        </div>

        <Dialog
          open={deleteOpen}
          onOpenChange={(next) => { setDeleteOpen(next); if (!next) setDialogError(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this portal?</DialogTitle>
              <DialogDescription>
                This permanently removes the portal and all attachments. Type
                the portal name to confirm.
                <span className="mt-2 block text-xs text-muted-foreground">
                  Type <strong>{portalName}</strong> to confirm.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="portal-delete-name">Portal name</Label>
              <Input
                id="portal-delete-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={portalName}
              />
              {dialogError && (
                <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  {dialogError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setConfirmName(""); setDeleteOpen(false); }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={pending || confirmName.trim().length === 0}
              >
                {pending ? <Loader2 className="animate-spin" /> : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Members (owner right-rail, shown first)
// ============================================================================

function MembersSection({
  portalId,
  members,
  pendingInvitations,
  isOwner,
  clientId,
  clientEmail,
}: {
  portalId: string;
  members: ViewProps["members"];
  pendingInvitations: ViewProps["pendingInvitations"];
  isOwner: boolean;
  clientId: string | null;
  clientEmail: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasClient = members.length > 0;
  const hasPending = pendingInvitations.length > 0;
  const missingClientEmail = !clientEmail;
  const inviteDisabled = hasClient || hasPending || missingClientEmail;

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await invitePortalMemberAction({
      portalId,
      email: email.trim(),
      name: name.trim() || undefined,
    });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setEmail(""); setName(""); setOpen(false);
    router.refresh();
  }

  async function onRevoke(userId: string) {
    const ok = await confirm({
      title: "Revoke access?",
      description: "This member will immediately lose access to the portal.",
      confirmLabel: "Revoke",
      variant: "destructive",
    });
    if (!ok) return;
    await revokePortalMemberAction({ portalId, userId });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          Client access
        </CardTitle>
        {isOwner && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setOpen((o) => !o)}
            disabled={inviteDisabled}
          >
            Invite
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isOwner && missingClientEmail && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Add an email to the client profile before inviting.
            </p>
            {clientId && (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link href={`/dashboard/clients/${clientId}`}>
                  Add client email
                </Link>
              </Button>
            )}
          </div>
        )}
        {isOwner && (hasClient || hasPending) && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-300">
            One client per portal. Revoke current access before inviting another.
          </p>
        )}
        {open && isOwner && !inviteDisabled && (
          <form onSubmit={onInvite} className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1">
              <Label htmlFor="invite-email" className="text-xs">Client email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-name" className="text-xs">Name (optional)</Label>
              <Input
                id="invite-name"
                placeholder="Sam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
            )}
            <Button type="submit" size="sm" className="h-7 w-full text-xs" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : "Send invite"}
            </Button>
          </form>
        )}

        {members.length === 0 && pendingInvitations.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
            No client connected yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {members.map((member) => {
              const displayName = getMemberDisplayName(member.profile);
              const memberEmail = getMemberEmail(member.profile);
              const isOwnerMember = member.role === "owner";
              return (
                <li key={member.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    {memberEmail && (
                      <p className="text-[11px] text-muted-foreground">{memberEmail}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={isOwnerMember ? "default" : "secondary"} className="text-[10px]">
                      {isOwnerMember ? "Owner" : "Client"}
                    </Badge>
                    {isOwner && !isOwnerMember && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onRevoke(member.user_id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isOwner && pendingInvitations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Pending</p>
            <ul className="divide-y rounded-lg border">
              {pendingInvitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Expires {formatDate(inv.expires_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Pending</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Activity feed (timeline style)
// ============================================================================

function getActivityDotColor(type: string): string {
  if (type.startsWith("meeting."))      return "bg-violet-500";
  if (type.startsWith("update."))       return "bg-sky-500";
  if (type.startsWith("file."))         return "bg-amber-500";
  if (type.startsWith("contract."))     return "bg-blue-500";
  if (type.startsWith("invoice."))      return "bg-emerald-500";
  if (type.startsWith("portal.member")) return "bg-pink-500";
  return "bg-muted-foreground/40";
}

function portalHours(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Owner-side time-tracked summary, grouped per project. */
function PortalTimeSection({ items }: { items: ViewProps["timeByProject"] }) {
  if (!items || items.length === 0) return null;
  const grandTotal = items.reduce((sum, p) => sum + p.totalSeconds, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          Time tracked
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            {portalHours(grandTotal)}
            {items.length > 1 ? ` · ${items.length} projects` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((p) => (
          <div
            key={p.projectId ?? "none"}
            className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.projectName}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {portalHours(p.totalSeconds)}
                {p.billableSeconds > 0 ? ` · ${portalHours(p.billableSeconds)} billable` : ""}
              </p>
            </div>
            {p.billableAmount > 0 && (
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                {formatPortalCurrency(p.currency, p.billableAmount)}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivitySection({ activity }: { activity: ViewProps["activity"] }) {
  const ordered = [...activity].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const top = ordered.slice(0, 5);
  const older = ordered.slice(5);

  const renderItem = (
    item: ViewProps["activity"][number],
    isLast: boolean,
  ) => {
    const title = formatActivityTitle(item);
    const description = formatActivityDescription(item);
    return (
      <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
        {!isLast && (
          <div className="absolute left-[6px] top-[14px] bottom-0 w-px bg-border" />
        )}
        <div
          className={`relative z-10 mt-[3px] h-3.5 w-3.5 shrink-0 rounded-full ${getActivityDotColor(item.type)}`}
        />
        <div className="min-w-0 flex-1 pb-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium leading-tight">{title}</p>
            <time
              dateTime={item.created_at}
              className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
            >
              {getRelativeTime(item.created_at)}
            </time>
          </div>
          {description && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7 text-muted-foreground/30" />}
            message="No activity yet."
          />
        ) : (
          <>
            <ol className="relative space-y-0">
              {top.map((item, index) =>
                renderItem(item, index === top.length - 1 && older.length === 0),
              )}
            </ol>
            {older.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Older activity
                </p>
                <div className="max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  <ol className="relative space-y-0">
                    {older.map((item, index) =>
                      renderItem(item, index === older.length - 1),
                    )}
                  </ol>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Shared: AttachExistingDialog
// ============================================================================

function AttachExistingDialog({
  triggerLabel,
  title,
  description,
  emptyMessage,
  items,
  onAttach,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  emptyMessage: string;
  items: Array<{ id: string; label: string; meta?: string }>;
  onAttach: (id: string) => Promise<{ ok: boolean; error?: string | null }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAttach() {
    if (!selectedId || pending) return;
    setPending(true);
    setError(null);
    const res = await onAttach(selectedId);
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not attach. Please try again."); return; }
    setSelectedId("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="attach-select">Select item</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="attach-select">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}{item.meta ? ` · ${item.meta}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error && (
                <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAttach}
              disabled={pending || !selectedId || items.length === 0}
            >
              {pending ? <Loader2 className="animate-spin" /> : "Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Shared: EmptyState
// ============================================================================

function EmptyState({
  icon,
  message,
  hint,
}: {
  icon: React.ReactNode;
  message: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint && (
        <p className="text-xs text-muted-foreground/70">{hint}</p>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatPortalCurrency(currency: string, amount: number): string {
  if (!Number.isFinite(amount)) return `${currency} 0`;
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === Infinity) return "∞";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getRelativeTime(iso: string): string {
  const diffMs   = Date.now() - Date.parse(iso);
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)   return "just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7)   return `${diffDays}d ago`;
  if (diffDays < 30)  return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMemberDisplayName(
  profile: ViewProps["members"][number]["profile"],
): string {
  return profile?.full_name ?? profile?.email ?? "Unknown member";
}

function getMemberEmail(
  profile: ViewProps["members"][number]["profile"],
): string | null {
  return profile?.email ?? null;
}

function formatActivityTitle(item: PortalActivityRow): string {
  switch (item.type) {
    case "portal.created":            return "Portal created";
    case "portal.renamed":            return "Portal renamed";
    case "portal.member_invited":     return "Client invited";
    case "portal.member_joined":      return "Client joined";
    case "portal.member_revoked":     return "Access revoked";
    case "contract.attached":         return "Contract attached";
    case "invoice.attached":          return "Invoice attached";
    case "message.posted":            return "Message sent";
    case "file.uploaded":             return "File uploaded";
    case "file.deleted":              return "File deleted";
    case "update.posted":             return "Update posted";
    case "update.acknowledged":       return "Update acknowledged";
    case "update.approved":           return "Update approved";
    case "update.revision_requested": return "Revision requested";
    case "update.comment":            return "Comment added";
    case "meeting.requested":         return "Meeting requested";
    case "meeting.accepted":          return "Meeting confirmed";
    case "meeting.declined":          return "Meeting declined";
    case "meeting.completed":         return "Meeting completed";
    default:
      return item.type.replace(/[._]/g, " ");
  }
}

function formatActivityDescription(item: PortalActivityRow): string | null {
  const payload = parsePayload(item.payload);
  if (typeof payload.name === "string")    return payload.name;
  if (typeof payload.title === "string")   return payload.title;
  if (typeof payload.topic === "string")   return payload.topic;
  if (typeof payload.email === "string")   return payload.email;
  if (typeof payload.number === "string")  return `Invoice ${payload.number}`;
  if (typeof payload.preview === "string") return `"${payload.preview}"`;
  return null;
}

function parsePayload(payload: PortalActivityRow["payload"]): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}
