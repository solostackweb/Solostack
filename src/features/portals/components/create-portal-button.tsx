"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { ClientFormDialog } from "@/features/clients/components/client-form-dialog";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { createPortalAction } from "../actions";
import { portalDashboardDetail } from "../routes";
import type { AiPortalDraft } from "@/features/ai-workflows/types";

/**
 * "New portal" button + create dialog. The dialog collects only the
 * minimum needed to create a portal — name + brand colour. Members,
 * files, contracts, and invoices are added on the detail page once the
 * portal exists.
 */
interface CreatePortalButtonProps {
  clients: Array<{
    id: string;
    fullName: string;
    businessName: string | null;
    email: string | null;
  }>;
  activeClientIds?: string[];
  initialAiDraft?: AiPortalDraft | null;
}

export function CreatePortalButton({
  clients,
  activeClientIds = [],
  initialAiDraft,
}: CreatePortalButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [brandColor, setBrandColor] = React.useState("#2563EB");
  const [clientId, setClientId] = React.useState<string>("");
  const [clientDialogOpen, setClientDialogOpen] = React.useState(false);
  const [clientOptions, setClientOptions] = React.useState(() => clients);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const blockedClientIds = React.useMemo(
    () => new Set(activeClientIds),
    [activeClientIds],
  );
  const selectedClient = React.useMemo(
    () => clientOptions.find((client) => client.id === clientId) ?? null,
    [clientId, clientOptions],
  );

  React.useEffect(() => {
    setClientOptions(clients);
  }, [clients]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    if (!clientId) {
      setPending(false);
      setError("Select a client before creating the portal.");
      return;
    }
    if (blockedClientIds.has(clientId)) {
      setPending(false);
      setError("That client already has an active portal.");
      return;
    }
    if (!selectedClient?.email) {
      setPending(false);
      setError("Add an email to the client before creating the portal.");
      return;
    }
    const res = await createPortalAction({
      name: name.trim(),
      brandColor,
      clientId,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setName("");
    setClientId("");
    router.push(portalDashboardDetail(res.data!.portalId));
  }

  const applyAiDraft = React.useCallback((draft: AiPortalDraft) => {
    setName(draft.name);
    setBrandColor(draft.brandColor);
    if (draft.clientId) setClientId(draft.clientId);
  }, []);

  React.useEffect(() => {
    if (!initialAiDraft) return;
    setOpen(true);
    applyAiDraft(initialAiDraft);
  }, [applyAiDraft, initialAiDraft]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New portal
      </Button>
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Create a client portal"
        description="Only one active portal per client. You can attach contracts, invoices, and files after creation."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal-client">Client</Label>
            {clientOptions.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                No clients yet. Add one to create this portal.
              </div>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="portal-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((client) => (
                    <SelectItem
                      key={client.id}
                      value={client.id}
                      disabled={blockedClientIds.has(client.id) || !client.email}
                    >
                      {client.businessName
                        ? `${client.businessName} · ${client.fullName}`
                        : client.fullName}
                      {client.email ? ` (${client.email})` : " (add email first)"}
                      {blockedClientIds.has(client.id)
                        ? " · active portal exists"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClientDialogOpen(true)}
              >
                Add new client
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                asChild
              >
                <Link href="/dashboard/clients">Manage clients</Link>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portal-name">Portal name</Label>
            <Input
              id="portal-name"
              autoFocus
              required
              maxLength={120}
              placeholder="e.g. Acme Co. — Brand redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portal-color">Brand colour</Label>
            <div className="flex items-center gap-3">
              <input
                id="portal-color"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border bg-background"
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                maxLength={7}
                pattern="^#[0-9A-Fa-f]{6}$"
                className="w-32 font-mono"
              />
            </div>
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                name.trim().length < 2 ||
                clientId.length === 0 ||
                !selectedClient?.email ||
                clientOptions.length === 0
              }
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Creating
                </>
              ) : (
                "Create portal"
              )}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSaved={(client) => {
          setClientOptions((prev) => {
            const exists = prev.some((item) => item.id === client.id);
            if (exists) return prev;
            return [client, ...prev];
          });
          setClientId(client.id);
        }}
      />
    </>
  );
}
