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
  { key: "home", label: "Home", icon: Home, href: (id: string) => `/portal/${id}` },
  { key: "invoices", label: "Invoices", icon: Receipt, href: (id: string) => `/portal/${id}/invoices` },
  { key: "files", label: "Files", icon: Files, href: (id: string) => `/portal/${id}/files` },
  { key: "meetings", label: "Meetings", icon: Video, href: (id: string) => `/portal/${id}/meetings` },
  { key: "chat", label: "Chat", icon: MessageSquare, href: (id: string) => `/portal/${id}/chat` },
] as const;

export function ClientPortalShell({
  portalId,
  brandColor = "#2563EB",
  title,
  subtitle,
  children,
}: {
  portalId: string;
  portalName: string;
  clientName?: string | null;
  brandColor?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100svh-7rem)] pb-28">
      <div
        className="-mx-4 mb-4 border-b bg-background/70 px-4 py-4 sm:-mx-6 sm:px-6"
        style={{ top: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {children}

      <nav
        aria-label="Client portal navigation"
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)" }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between rounded-[1.4rem] border bg-background/95 p-1.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md">
          {navItems.map(({ key, href, icon: Icon, label }) => {
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
  const completion = calculateCompletion(data);

  return (
    <ClientPortalShell
      portalId={data.portalId}
      portalName={data.portalName}
      clientName={data.clientName}
      brandColor={data.brandColor}
      title="Home"
      subtitle="Project status and next actions"
    >
      <div className="space-y-5">
        <section
          className="overflow-hidden rounded-[1.6rem] border bg-card shadow-sm"
          style={{ borderTop: `4px solid ${data.brandColor}` }}
        >
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Good to see you</p>
              <h2 className="mt-1 truncate text-2xl font-bold tracking-tight">
                {data.portalName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestUpdate ? updateTypeLabel(latestUpdate.update_type) : "In progress"} • {completion}% complete
              </p>
            </div>
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
              style={{ background: data.brandColor }}
            >
              {initials(data.portalName)}
            </div>
          </div>
          <div className="mx-5 mb-5 h-2.5 overflow-hidden rounded-full bg-muted sm:mx-6 sm:mb-6">
            <div
              className="h-full rounded-full"
              style={{ width: `${completion}%`, background: data.brandColor }}
            />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <PortalActionCard
            icon={pendingApprovals > 0 ? CheckCircle2 : Files}
            label={pendingApprovals > 0 ? "Review needed" : "Next delivery"}
            title={
              pendingApprovals > 0
                ? `${pendingApprovals} approval${pendingApprovals > 1 ? "s" : ""} waiting`
                : deliverable?.name ?? latestUpdate?.title ?? "Nothing pending"
            }
            href={
              pendingApprovals > 0
                ? `/portal/${data.portalId}/updates`
                : `/portal/${data.portalId}/files`
            }
            color={data.brandColor}
          />
          <PortalActionCard
            icon={meeting?.meet_link ? Video : Clock3}
            label={meeting?.meet_link ? "Meeting room" : "Schedule"}
            title={meeting?.meet_link ? "Join meeting" : meeting?.topic ?? "No meeting scheduled"}
            href={meeting?.meet_link ?? `/portal/${data.portalId}/meetings`}
            external={Boolean(meeting?.meet_link)}
            color={data.brandColor}
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            icon={Wallet}
            label="Payments"
            title={formatPortalCurrency(currency, outstandingAmount)}
            meta={`${formatPortalCurrency(currency, paidAmount)} paid`}
            accent="emerald"
          />
          <StatusCard
            icon={Files}
            label="Current deliverable"
            title={deliverable?.name ?? "No deliverable yet"}
            meta={deliverable ? "Ready in Files" : "Your freelancer will share it here"}
            accent="blue"
          />
          <StatusCard
            icon={Clock3}
            label="Upcoming meeting"
            title={meeting?.proposed_time ?? "No meeting scheduled"}
            meta={meeting?.topic ?? "Meetings will appear here"}
            accent="amber"
          />
          <StatusCard
            icon={CheckCircle2}
            label="Pending approvals"
            title={pendingApprovals > 0 ? `${pendingApprovals} waiting` : "Nothing pending"}
            meta="Review requests appear in Updates"
            accent="rose"
          />
          <StatusCard
            icon={MessageSquare}
            label="Recent update"
            title={latestUpdate?.title ?? "No updates yet"}
            meta={latestUpdate?.body ?? "Progress notes will appear here"}
            className="sm:col-span-2 lg:col-span-4"
            accent="slate"
          />
        </section>

        <section className="rounded-[1.35rem] border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Workspace shortcuts</h2>
            <span className="text-[11px] font-medium text-muted-foreground">
              Client PWA
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ActionLink
              icon={Receipt}
              label="Invoices"
              href={`/portal/${data.portalId}/invoices`}
            />
            <ActionLink
              icon={Files}
              label="Files"
              href={`/portal/${data.portalId}/files`}
            />
            <ActionLink
              icon={Video}
              label="Meetings"
              href={`/portal/${data.portalId}/meetings`}
            />
            <ActionLink
              icon={MessageSquare}
              label="Chat"
              href={`/portal/${data.portalId}/chat`}
            />
            {meeting?.meet_link && (
              <ActionLink
                icon={Video}
                label="Join Meeting"
                href={meeting.meet_link}
                external
              />
            )}
          </div>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  meta: string;
  className?: string;
  accent?: "emerald" | "blue" | "amber" | "rose" | "slate";
}) {
  const accents = {
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  };

  return (
    <div className={`rounded-[1.15rem] border bg-card p-4 shadow-sm ${className ?? ""}`}>
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
    </div>
  );
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

function ActionLink({
  icon: Icon,
  label,
  href,
  external,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex min-h-14 items-center justify-center gap-2 rounded-xl border bg-background px-3 py-3 text-xs font-semibold shadow-sm transition hover:border-primary/40 hover:bg-muted/40"
    >
      <Icon className="h-4 w-4" />
      {label}
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

function calculateCompletion(data: ClientPortalProps): number {
  const total =
    data.updates.length +
    data.files.length +
    data.invoices.length +
    data.contracts.length +
    data.meetings.length;
  if (total === 0) return 12;
  const done =
    data.updates.filter((update) => update.approval_status === "approved").length +
    data.files.length +
    data.invoices.filter((invoice) => invoice.status === "paid").length +
    data.contracts.filter((contract) => contract.status === "signed").length +
    data.meetings.filter((meeting) => meeting.status === "completed").length;
  return Math.max(12, Math.min(96, Math.round((done / total) * 100)));
}

function updateTypeLabel(type: ClientPortalProps["updates"][number]["update_type"]): string {
  return type.replace(/_/g, " ");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "S";
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
