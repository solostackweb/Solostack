"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { IvoEntryPoint, openIvo } from "@/features/ai-workflows/components/ivo-entry-point";
import { cn } from "@/lib/utils";

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
  const [deletingClient, setDeletingClient] = React.useState<ClientRecord | null>(
    null,
  );
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage your clients, contacts, and billing details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IvoEntryPoint
            prompt="Show my clients and tell me who I should follow up with."
            label="Ask Ivo"
            variant="outline"
          />
          <Button
            onClick={() => setImportOpen(true)}
            variant="outline"
            size="sm"
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button onClick={handleAdd} size="sm">
            <Plus /> Add client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Total clients" value={stats.total} featured />
        <StatCard label="GST registered" value={stats.gst} />
        <StatCard label="Unregistered" value={stats.unregistered} />
      </div>

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
        emptyState={
          <EmptyState
            icon={Users}
            title={
              clients.length === 0
                ? "No clients yet"
                : "No clients match your filters"
            }
            description={
              clients.length === 0
                ? "Add your first client to start sending invoices and tracking work."
                : "Try adjusting your search or filters, or add a new client."
            }
            action={{ label: "Add client", onClick: handleAdd }}
            secondaryAction={
              clients.length === 0
                ? {
                    label: "Ask Ivo",
                    onClick: () => openIvo("Help me add my first client."),
                  }
                : undefined
            }
          />
        }
      />

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

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  featured,
}: {
  label: string;
  value: number;
  featured?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", featured && "col-span-2 sm:col-span-1")}>
      <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
