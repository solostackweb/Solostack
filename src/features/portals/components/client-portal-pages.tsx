"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Files,
  Home,
  List,
  MessageSquare,
  Receipt,
  Send,
  Sparkles,
  Upload,
  Video,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postPortalMessageAction } from "../actions";
import { UpdatesSection } from "./updates-section";
import { MeetingsSection } from "./meetings-section";
import type { ViewProps } from "./portal-view";
import type { PortalFileRow } from "@/lib/supabase/types";

type ClientPortalProps = ViewProps;

const navItems = [
  { key: "home", label: "Home", icon: Home, href: (id: string) => `/portal/${id}`, mobile: true },
  { key: "updates", label: "Updates", icon: List, href: (id: string) => `/portal/${id}/updates`, mobile: false },
  { key: "invoices", label: "Invoices", icon: Receipt, href: (id: string) => `/portal/${id}/invoices`, mobile: true },
  { key: "files", label: "Files", icon: Files, href: (id: string) => `/portal/${id}/files`, mobile: true },
  { key: "meetings", label: "Meetings", icon: Video, href: (id: string) => `/portal/${id}/meetings`, mobile: true },
  { key: "chat", label: "Chat", icon: MessageSquare, href: (id: string) => `/portal/${id}/chat`, mobile: true },
] as const;

export function ClientPortalShell({
  portalId,
  portalName,
  clientName,
  freelancerName,
  brandColor = "#2563EB",
  title,
  subtitle,
  children,
}: {
  portalId: string;
  portalName: string;
  clientName?: string | null;
  freelancerName?: string | null;
  brandColor?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100svh-7rem)] pb-28 sm:pb-10">

      {/* ── Branded workspace header ───────────────────────────────── */}
      <section
        className="relative -mx-4 overflow-hidden border-b px-4 pb-0 pt-5 sm:-mx-6 sm:px-6"
        style={{
          background: `linear-gradient(135deg, ${brandColor}14, transparent 55%)`,
        }}
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-md"
              style={{ background: brandColor }}
            >
              {initials(portalName)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {portalName}
              </h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                Shared client workspace{clientName ? ` · ${clientName}` : ""}
              </p>
            </div>
          </div>

          {/* Desktop nav tabs — brand-coloured active state */}
          <nav
            aria-label="Portal sections"
            className="mt-4 hidden gap-1 overflow-x-auto sm:flex"
          >
            {navItems.map(({ key, href, icon: Icon, label }) => {
              const url = href(portalId);
              const active =
                key === "home" ? pathname === url : pathname?.startsWith(url);
              return (
                <Link
                  key={key}
                  href={url}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" style={active ? { color: brandColor } : undefined} />
                  {label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full"
                      style={{ background: brandColor }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          {/* Spacer keeps the band height consistent on mobile (no tabs) */}
          <div className="h-4 sm:hidden" />
        </div>
      </section>

      {/* ── Page heading ───────────────────────────────────────────── */}
      <div className="mx-auto mb-5 mt-6 flex max-w-[1400px] items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px]">{children}</div>

      {/* ── Footer attribution ─────────────────────────────────────── */}
      <p className="mx-auto mt-10 max-w-[1400px] text-center text-[11px] text-muted-foreground/70 sm:text-left">
        Powered by Stackivo · A shared workspace between you and{" "}
        {freelancerName ?? "your freelancer"}
      </p>

      {/* ── Mobile bottom nav ──────────────────────────────────────── */}
      <nav
        aria-label="Client portal navigation"
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)" }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between rounded-[1.4rem] border bg-background/95 p-1.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md">
          {navItems
            .filter((item) => item.mobile)
            .map(({ key, href, icon: Icon, label }) => {
              const url = href(portalId);
              const active =
                key === "home" ? pathname === url : pathname?.startsWith(url);
              return (
                <Link
                  key={key}
                  href={url}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1.5 py-2 text-[10px] font-semibold transition ${
                    active
                      ? "text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  style={active ? { background: brandColor } : undefined}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span>{label}</span>
                </Link>
              );
            })}
        </div>
      </nav>
    </div>
  );
}

export function ClientPortalHome({ data }: { data: ClientPortalProps }) {
  const paidAmount = data.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const outstandingAmount = data.invoices
    .filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const currency = data.invoices[0]?.currency ?? "INR";
  const deliverable =
    data.files.find((file) => file.category === "deliverable") ?? data.files[0] ?? null;
  const meeting = data.meetings.find(
    (item) => item.status === "accepted" || item.status === "pending",
  );
  const pendingApprovals = data.updates.filter(
    (update) =>
      update.update_type === "deliverable" &&
      update.approval_status !== "approved" &&
      update.approval_status !== "none",
  ).length;
  const latestUpdate = data.updates[0] ?? null;
  const openInvoices = data.invoices.filter(
    (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled",
  );
  const unsignedContracts = data.contracts.filter(
    (c) => c.status !== "signed" && c.status !== "declined",
  ).length;

  return (
    <ClientPortalShell
      portalId={data.portalId}
      portalName={data.portalName}
      clientName={data.clientName}
      freelancerName={freelancerName(data)}
      brandColor={data.brandColor}
      title="Home"
      subtitle="Everything for this project in one place"
    >
      <div className="space-y-5">
        {/* Things that need the client's attention — only shown when real. */}
        {(pendingApprovals > 0 || openInvoices.length > 0 || meeting?.meet_link) && (
          <section className="grid gap-3 md:grid-cols-2">
            {pendingApprovals > 0 && (
              <PortalActionCard
                icon={CheckCircle2}
                label="Needs your review"
                title={`${pendingApprovals} approval${pendingApprovals > 1 ? "s" : ""} waiting`}
                href={`/portal/${data.portalId}/updates`}
                color={data.brandColor}
              />
            )}
            {openInvoices.length > 0 && (
              <PortalActionCard
                icon={Wallet}
                label="Payment due"
                title={`${formatPortalCurrency(currency, outstandingAmount)} across ${openInvoices.length} invoice${openInvoices.length > 1 ? "s" : ""}`}
                href={`/portal/${data.portalId}/invoices`}
                color={data.brandColor}
              />
            )}
            {meeting?.meet_link && (
              <PortalActionCard
                icon={Video}
                label="Meeting room"
                title={`Join${meeting.proposed_time ? ` · ${meeting.proposed_time}` : ""}`}
                href={meeting.meet_link}
                external
                color={data.brandColor}
              />
            )}
          </section>
        )}

        {/* At-a-glance — every tile is grounded in real data and links out. */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard
            icon={Wallet}
            label="Payments"
            title={
              outstandingAmount > 0
                ? `${formatPortalCurrency(currency, outstandingAmount)} due`
                : "All settled"
            }
            meta={`${formatPortalCurrency(currency, paidAmount)} paid to date`}
            accent="emerald"
            href={`/portal/${data.portalId}/invoices`}
          />
          <StatusCard
            icon={Files}
            label="Files shared"
            title={
              data.files.length > 0
                ? `${data.files.length} file${data.files.length > 1 ? "s" : ""}`
                : "No files yet"
            }
            meta={deliverable?.name ?? "Deliverables will appear here"}
            accent="blue"
            href={`/portal/${data.portalId}/files`}
          />
          <StatusCard
            icon={Clock3}
            label="Next meeting"
            title={meeting?.proposed_time ?? "None scheduled"}
            meta={meeting?.topic ?? "Request one from Meetings"}
            accent="amber"
            href={`/portal/${data.portalId}/meetings`}
          />
          {unsignedContracts > 0 && (
            <StatusCard
              icon={FileText}
              label="Contracts to sign"
              title={`${unsignedContracts} pending`}
              meta="Review and sign in Files"
              accent="rose"
              href={`/portal/${data.portalId}/files`}
            />
          )}
        </section>

        {/* Latest update — links straight to the full Updates thread. */}
        <section className="rounded-[1.35rem] border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Latest update</h2>
            <Link
              href={`/portal/${data.portalId}/updates`}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          {latestUpdate ? (
            <Link
              href={`/portal/${data.portalId}/updates`}
              className="block rounded-xl border bg-background p-3 transition-colors hover:border-primary/40"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {updateTypeLabel(latestUpdate.update_type)} · {relativeTime(latestUpdate.created_at)}
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug">{latestUpdate.title}</p>
              {latestUpdate.body && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {latestUpdate.body}
                </p>
              )}
            </Link>
          ) : (
            <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              No updates yet. Progress notes from your freelancer will appear here.
            </p>
          )}
        </section>

        <RecentActivity activity={data.activity} />
      </div>
    </ClientPortalShell>
  );
}

export function ClientPortalUpdates({ data }: { data: ClientPortalProps }) {
  return (
    <ClientPortalShell
      portalId={data.portalId}
      portalName={data.portalName}
      clientName={data.clientName}
      freelancerName={freelancerName(data)}
      brandColor={data.brandColor}
      title="Updates"
      subtitle="Structured progress notes and approvals"
    >
      <UpdatesSection
        portalId={data.portalId}
        portalName={data.portalName}
        updates={data.updates}
        isOwner={false}
        currentUserId={data.currentUserId}
      />
    </ClientPortalShell>
  );
}

export function ClientPortalInvoices({ data }: { data: ClientPortalProps }) {
  const paidAmount = data.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const openInvoices = data.invoices.filter(
    (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled",
  );
  const openAmount = openInvoices.reduce(
    (sum, invoice) => sum + invoice.total_amount,
    0,
  );
  const currency = data.invoices[0]?.currency ?? "INR";

  return (
    <ClientPortalShell
      portalId={data.portalId}
      portalName={data.portalName}
      clientName={data.clientName}
      freelancerName={freelancerName(data)}
      brandColor={data.brandColor}
      title="Invoices"
      subtitle="Payments and receipts"
    >
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <StatusCard
            icon={Wallet}
            label="Outstanding"
            title={formatPortalCurrency(currency, openAmount)}
            meta={`${openInvoices.length} invoice${openInvoices.length === 1 ? "" : "s"} open`}
            accent={openAmount > 0 ? "amber" : "emerald"}
          />
          <StatusCard
            icon={CheckCircle2}
            label="Paid"
            title={formatPortalCurrency(currency, paidAmount)}
            meta="Payments recorded by your freelancer"
            accent="emerald"
          />
        </section>

        <section className="rounded-[1.35rem] border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Invoice documents</h2>
          {data.invoices.length === 0 ? (
            <EmptyBlock
              icon={Receipt}
              title="No invoices yet"
              text="Invoices shared by your freelancer will appear here."
            />
          ) : (
            <div className="mt-3 space-y-2">
              {data.invoices.map((invoice) => (
                <DocumentExternalCard
                  key={invoice.id}
                  icon={Receipt}
                  title={invoice.invoice_number}
                  meta={`${formatPortalCurrency(invoice.currency, invoice.total_amount)} - ${invoice.status.replace(/_/g, " ")}`}
                  href={invoice.public_token ? `/i/${invoice.public_token}` : null}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </ClientPortalShell>
  );
}

export function ClientPortalFiles({ data }: { data: ClientPortalProps }) {
  const categories = [
    "deliverable",
    "contract",
    "asset",
    "meeting_note",
    "misc",
  ];

  return (
    <ClientPortalShell
      portalId={data.portalId}
      portalName={data.portalName}
      clientName={data.clientName}
      freelancerName={freelancerName(data)}
      brandColor={data.brandColor}
      title="Files"
      subtitle="Documents and delivery assets"
    >
      <div className="space-y-5">
        {(data.contracts.length > 0 ||
          data.welcomeDocuments.length > 0) && (
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Project documents</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.invoices.map((invoice) => (
                <DocumentExternalCard
                  key={invoice.id}
                  icon={Receipt}
                  title={invoice.invoice_number}
                  meta={`${formatPortalCurrency(invoice.currency, invoice.total_amount)} • ${invoice.status.replace(/_/g, " ")}`}
                  href={invoice.public_token ? `/i/${invoice.public_token}` : null}
                />
              ))}
              {data.contracts.map((contract) => (
                <DocumentExternalCard
                  key={contract.id}
                  icon={FileText}
                  title={contract.title}
                  meta={contract.status.replace(/_/g, " ")}
                  href={contract.public_token ? `/c/${contract.public_token}` : null}
                />
              ))}
              {data.welcomeDocuments.map((doc) => (
                <DocumentExternalCard
                  key={doc.id}
                  icon={Sparkles}
                  title={doc.title}
                  meta={`${doc.status.replace(/_/g, " ")}${doc.acknowledgement_required ? " • acknowledgement required" : ""}`}
                  href={doc.public_token ? `/w/${doc.public_token}` : null}
                />
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Shared files</h2>
              <p className="text-xs text-muted-foreground">
                Deliverables, assets, contracts, and meeting notes.
              </p>
            </div>
            {data.r2Enabled && <FileUploadButton portalId={data.portalId} />}
          </div>

          {data.files.length === 0 ? (
            <EmptyBlock
              icon={Files}
              title="No files shared yet"
              text="When your freelancer uploads delivery files, they will appear here."
            />
          ) : (
            <div className="mt-4 space-y-5">
              {categories.map((category) => {
                const grouped = data.files.filter(
                  (file) => (file.category ?? "misc") === category,
                );
                if (grouped.length === 0) return null;
                return (
                  <div key={category} className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {categoryLabel(category)}
                    </p>
                    <div className="space-y-2">
                      {grouped.map((file) => (
                        <FileRow key={file.id} portalId={data.portalId} file={file} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </ClientPortalShell>
  );
}

export function ClientPortalMeetings({ data }: { data: ClientPortalProps }) {
  return (
    <ClientPortalShell
      portalId={data.portalId}
      portalName={data.portalName}
      clientName={data.clientName}
      freelancerName={freelancerName(data)}
      brandColor={data.brandColor}
      title="Meetings"
      subtitle="Calls, links, and scheduling"
    >
      <MeetingsSection
        portalId={data.portalId}
        portalName={data.portalName}
        meetings={data.meetings}
        isOwner={false}
        currentUserId={data.currentUserId}
      />
    </ClientPortalShell>
  );
}

export function ClientPortalChat({ data }: { data: ClientPortalProps }) {
  return (
    <ClientPortalShell
      portalId={data.portalId}
      portalName={data.portalName}
      clientName={data.clientName}
      freelancerName={freelancerName(data)}
      brandColor={data.brandColor}
      title="Chat"
      subtitle="Messages with your freelancer"
    >
      <MessagesPanel
        portalId={data.portalId}
        messages={data.messages}
        currentUserId={data.currentUserId}
      />
    </ClientPortalShell>
  );
}

export const ClientPortalMore = ClientPortalChat;

function StatusCard({
  icon: Icon,
  label,
  title,
  meta,
  className,
  accent = "slate",
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  meta: string;
  className?: string;
  accent?: "emerald" | "blue" | "amber" | "rose" | "slate";
  href?: string;
}) {
  const accents = {
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  };

  const inner = (
    <>
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${accents[accent]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {meta}
      </p>
    </>
  );

  const base = `rounded-[1.15rem] border bg-card p-4 shadow-sm ${className ?? ""}`;
  if (href) {
    return (
      <Link href={href} className={`${base} block transition-colors hover:border-primary/40`}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

function PortalActionCard({
  icon: Icon,
  label,
  title,
  href,
  color,
  external,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  href: string;
  color: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="group flex items-center gap-3 rounded-[1.25rem] border bg-card p-4 shadow-sm transition hover:border-primary/40"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{ background: color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold">
          {title}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function RecentActivity({ activity }: { activity: ClientPortalProps["activity"] }) {
  const visible = [...activity]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 6);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Recent activity</h2>
      {visible.length === 0 ? (
        <EmptyBlock
          icon={List}
          title="No activity yet"
          text="Updates, files, and meetings will appear here."
        />
      ) : (
        <ol className="mt-4 space-y-0">
          {visible.map((item, index) => (
            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index !== visible.length - 1 && (
                <span className="absolute left-[7px] top-4 h-full w-px bg-border" />
              )}
              <span className="relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold">
                    {item.type.replace(/[._]/g, " ")}
                  </p>
                  <time
                    className="shrink-0 text-[10px] text-muted-foreground"
                    dateTime={item.created_at}
                  >
                    {relativeTime(item.created_at)}
                  </time>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DocumentExternalCard({
  icon: Icon,
  title,
  meta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta: string;
  href: string | null;
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-[11px] capitalize text-muted-foreground">
          {meta}
        </span>
      </span>
      <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (!href) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-background p-3 opacity-50">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border bg-background p-3 transition hover:border-primary/40"
    >
      {content}
    </Link>
  );
}

function FileRow({ portalId, file }: { portalId: string; file: PortalFileRow }) {
  const viewUrl = `/portal/${portalId}/files/${file.id}`;
  const downloadUrl = `/api/portals/${portalId}/files/${file.id}/download`;

  return (
    <article className="flex items-center gap-3 rounded-xl border bg-background p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Files className="h-4 w-4" />
      </span>
      <Link href={viewUrl} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{file.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatBytes(file.size_bytes)} • {formatDate(file.created_at)}
        </p>
      </Link>
      <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full">
        <Link href={viewUrl} aria-label={`Preview ${file.name}`}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full">
        <a href={downloadUrl} aria-label={`Download ${file.name}`}>
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </article>
  );
}

function FileUploadButton({ portalId }: { portalId: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onFiles(filelist: FileList | null) {
    if (!filelist || filelist.length === 0) return;
    setPending(true);
    setError(null);
    try {
      for (const file of Array.from(filelist)) {
        const presignRes = await fetch(`/api/portals/${portalId}/files/presign`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        const presign = (await presignRes.json()) as
          | { ok: true; fileId: string; key: string; putUrl: string }
          | { ok: false; error: string };
        if (!presign.ok) throw new Error(presign.error);

        const putRes = await fetch(presign.putUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

        const commitRes = await fetch(`/api/portals/${portalId}/files/commit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileId: presign.fileId,
            key: presign.key,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
          }),
        });
        const commit = (await commitRes.json()) as
          | { ok: true }
          | { ok: false; error: string };
        if (!commit.ok) throw new Error(commit.error);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-9 rounded-full"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        <Upload className="h-3.5 w-3.5" />
        {pending ? "Uploading" : "Upload"}
      </Button>
      {error && <p className="max-w-[140px] truncate text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function MessagesPanel({
  portalId,
  messages,
  currentUserId,
}: {
  portalId: string;
  messages: ClientPortalProps["messages"];
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ordered = [...messages].reverse();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || body.trim().length === 0) return;
    setPending(true);
    setError(null);
    const res = await postPortalMessageAction({ portalId, body: body.trim() });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-[1.35rem] border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Conversation</h2>
        <p className="text-xs text-muted-foreground">
          Messages stay inside this client portal.
        </p>
      </div>
      <form onSubmit={onSubmit} className="border-b bg-background/45 p-3">
        <Textarea
          placeholder="Send a short note or question..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={8000}
          className="min-h-24 resize-none rounded-2xl bg-background"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-2 flex justify-end">
          <Button size="sm" className="h-9 rounded-full px-4" disabled={pending || !body.trim()}>
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </form>

      {ordered.length > 0 && (
        <ul className="max-h-[42svh] min-h-48 space-y-3 overflow-y-auto px-4 py-4">
          {ordered.map((message) => {
            const mine = message.author_id === currentUserId;
            return (
            <li
              key={message.id}
              className={`max-w-[86%] rounded-2xl border p-3 ${
                mine
                  ? "ml-auto border-primary/30 bg-primary text-primary-foreground"
                  : "mr-auto bg-background"
              }`}
            >
              <p
                className={`text-[11px] font-semibold ${
                  mine ? "text-primary-foreground/75" : "text-muted-foreground"
                }`}
              >
                {mine
                  ? "You"
                  : message.author?.full_name ?? message.author?.email ?? "Freelancer"}{" "}
                - {relativeTime(message.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center">
      <Icon className="h-7 w-7 text-muted-foreground/30" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function updateTypeLabel(type: ClientPortalProps["updates"][number]["update_type"]): string {
  return type.replace(/_/g, " ");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "S";
}

/** The freelancer (portal owner) display name, for client-facing copy. */
function freelancerName(data: ClientPortalProps): string | null {
  const owner = data.members.find((m) => m.role === "owner");
  return owner?.profile?.full_name ?? owner?.profile?.email ?? null;
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    deliverable: "Deliverables",
    contract: "Contracts",
    invoice: "Invoices",
    asset: "Assets",
    meeting_note: "Meeting notes",
    misc: "Other",
  };
  return labels[category] ?? "Other";
}

function formatPortalCurrency(currency: string, amount: number): string {
  if (!Number.isFinite(amount)) return `${currency} 0`;
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
