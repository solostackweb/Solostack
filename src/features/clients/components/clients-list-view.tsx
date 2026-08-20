"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeIndianRupee,
  FileText,
  FolderKanban,
  Plus,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import {
  IvoEntryPoint,
  openIvo,
} from "@/features/ai-workflows/components/ivo-entry-point";

import type { ClientRecord } from "../server";
import { ClientsToolbar } from "./clients-toolbar";
import { buildClientColumns } from "./clients-columns";
import { ClientFormDialog } from "./client-form-dialog";
import { DeleteClientDialog } from "./delete-client-dialog";
import { ClientMobileCard } from "./client-mobile-card";
import { CsvImportDialog } from "./csv-import-dialog";

interface ClientsListViewProps {
  clients: ClientRecord[];
  /** When true (from ?create=1 URL param), auto-opens the new-client dialog on mount. */
  autoCreate?: boolean;
}

/**
 * Top-level clients view. Receives the authoritative list from the server
 * page; mutations go through server actions and a `router.refresh()`
 * re-hydrates this list.
 */
export function ClientsListView({ clients, autoCreate }: ClientsListViewProps) {
  const router = useRouter();
  const [editingClient, setEditingClient] = React.useState<ClientRecord | null>(
    null,
  );
  const [formOpen, setFormOpen] = React.useState(false);

  // Auto-open the create dialog when navigated from the FAB (?create=1).
  React.useEffect(() => {
    if (autoCreate) {
      setEditingClient(null);
      setFormOpen(true);
    }
  }, [autoCreate]);
  const [deletingClient, setDeletingClient] =
    React.useState<ClientRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const handleAdd = () => {
    setEditingClient(null);
    setFormOpen(true);
  };

  const handleEdit = React.useCallback((client: ClientRecord) => {
    setEditingClient(client);
    setFormOpen(true);
  }, []);

  const handleDelete = React.useCallback((client: ClientRecord) => {
    setDeletingClient(client);
    setDeleteOpen(true);
  }, []);

  const columns = React.useMemo(
    () => buildClientColumns({ onEdit: handleEdit, onDelete: handleDelete }),
    [handleEdit, handleDelete],
  );

  const stats = React.useMemo(() => {
    const total = clients.length;
    const gst = clients.filter((c) => c.gstRegistered).length;
    return { total, gst, unregistered: total - gst };
  }, [clients]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            The people and businesses behind your work and revenue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {clients.length > 0 ? (
            <div className="hidden sm:block">
              <IvoEntryPoint
                prompt="Show my clients and tell me who I should follow up with."
                label="Ask Ivo"
                variant="secondary"
              />
            </div>
          ) : null}
          <Button
            onClick={() => setImportOpen(true)}
            variant="ghost"
            size="sm"
            className="px-2 sm:px-3"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </Button>
          {clients.length > 0 ? (
            <Button onClick={handleAdd} size="sm" className="px-2 sm:px-3">
              <Plus /> Add client
            </Button>
          ) : null}
        </div>
      </div>

      {clients.length === 0 ? (
        <EmptyClientBook onAdd={handleAdd} />
      ) : (
        <>
          <ClientStats {...stats} />
          <DataTable
            columns={columns}
            data={clients}
            initialPageSize={10}
            onRowClick={(c) => router.push(`/dashboard/clients/${c.id}`)}
            toolbar={(table) => <ClientsToolbar table={table} />}
            mobileCard={(client, { isSelected, toggleSelected, onOpen }) => (
              <ClientMobileCard
                client={client}
                isSelected={isSelected}
                onToggleSelected={toggleSelected}
                onOpen={onOpen}
                onEdit={() => handleEdit(client)}
                onDelete={() => handleDelete(client)}
              />
            )}
          />
        </>
      )}

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editingClient ?? undefined}
      />

      <DeleteClientDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        client={deletingClient}
      />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function ClientStats({
  total,
  gst,
  unregistered,
}: {
  total: number;
  gst: number;
  unregistered: number;
}) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/70 bg-card sm:grid-cols-3">
      <ClientStat
        label="Total clients"
        value={total}
        className="col-span-2 sm:col-span-1"
      />
      <ClientStat
        label="GST registered"
        value={gst}
        className="border-t border-border/60 sm:border-l sm:border-t-0"
      />
      <ClientStat
        label="Unregistered"
        value={unregistered}
        className="border-l border-t border-border/60 sm:border-t-0"
      />
    </div>
  );
}

function ClientStat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`p-4 sm:p-5 ${className}`}>
      <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

const clientFlow = [
  { label: "Client", icon: Users },
  { label: "Project", icon: FolderKanban },
  { label: "Invoice", icon: FileText },
  { label: "Paid", icon: BadgeIndianRupee },
];

function EmptyClientBook({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-border/60 bg-primary/[0.025] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="text-micro font-semibold uppercase tracking-[0.16em] text-primary">
            Your client book
          </p>
          <h2 className="mt-3 max-w-md font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Every paid invoice starts with one client.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Add a person or business once, then carry their details cleanly
            through projects, invoices, and payments.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={onAdd}>
              <Plus /> Add your first client
            </Button>
            <Button
              variant="ghost"
              onClick={() => openIvo("Help me add my first client.")}
            >
              Ask Ivo <ArrowRight />
            </Button>
          </div>
        </div>

        <div className="flex min-h-64 items-center p-6 sm:p-10">
          <div className="relative grid w-full grid-cols-4">
            <div
              aria-hidden
              className="absolute left-[12.5%] right-[12.5%] top-5 h-px bg-primary/25"
            />
            {clientFlow.map(({ label, icon: Icon }, index) => (
              <div
                key={label}
                className="relative z-10 flex flex-col items-center text-center"
              >
                <span
                  className={
                    index === 0
                      ? "flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                      : "flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary"
                  }
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-3 text-xs font-semibold">{label}</span>
                <span className="mt-1 hidden text-micro text-muted-foreground sm:block">
                  {index === 0
                    ? "Add once"
                    : index === 1
                      ? "Do the work"
                      : index === 2
                        ? "Send the bill"
                        : "Track revenue"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
