/**
 * /admin/contracts/[id] - read-only contract detail with signature
 * timeline + delivery log + admin notes.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { getContractDetail, listAdminNotes } from "@/features/admin/queries";
import { recordAdminAction, requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, KpiGrid, StatCard } from "@/components/admin/kit";
import { AdminNotesPanel } from "@/components/admin/admin-notes";
import {
  formatIstStamp,
  formatRelative,
  shortenId,
} from "@/features/admin/format";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminContractDetailPage({ params }: Props) {
  const { id } = await params;
  const actor = await requireAdmin();
  const { contract, signatures, deliveries } = await getContractDetail(id);
  if (!contract) notFound();

  const notes = await listAdminNotes("contract", id);

  await recordAdminAction({
    actorId: actor.id,
    kind: "contract.read",
    targetType: "contract",
    targetId: id,
    success: true,
    durationMs: 0,
  });

  return (
    <AdminSection>
      <Link
        href="/admin/contracts"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> All contracts
      </Link>

      <AdminPageHeader
        title={contract.title}
        subtitle={
          <span className="space-x-2">
            <span>{contract.full_name}</span>
            <span className="text-muted-foreground/60">-</span>
            <span className="font-mono">{contract.email}</span>
          </span>
        }
        actions={
          <Link
            href={`/admin/users/${contract.user_id}`}
            className="rounded border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Open user
          </Link>
        }
      />

      <KpiGrid cols={4}>
        <StatCard label="Kind" value={contract.kind} />
        <StatCard label="Status" value={contract.status} />
        <StatCard label="Signed" value={contract.signed_at ? formatIstStamp(contract.signed_at) : "-"} />
        <StatCard
          label="Public link"
          value={
            contract.public_token ? (
              <a
                className="inline-flex items-center gap-1 truncate text-base hover:underline"
                href={`/c/${contract.public_token}`}
                target="_blank"
                rel="noreferrer"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "-"
            )
          }
        />
      </KpiGrid>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Signatures
        </h2>
        {signatures.length === 0 ? (
          <Empty>No signature events recorded.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03] text-xs">
            {signatures.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {s.signer_name ?? "Unknown"}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    user {shortenId(s.user_id)}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {s.signed_at
                    ? formatIstStamp(s.signed_at)
                    : formatRelative(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Deliveries
        </h2>
        {deliveries.length === 0 ? (
          <Empty>No deliveries logged.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03] text-xs">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
              >
                <div>
                  <span className="font-medium">{d.kind}</span>{" "}
                  <span className="text-muted-foreground">{d.status}</span>{" "}
                  {d.to_email ? (
                    <span className="font-mono">{d.to_email}</span>
                  ) : null}
                </div>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatRelative(d.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminNotesPanel
        targetType="contract"
        targetId={contract.id}
        notes={notes}
      />
    </AdminSection>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
