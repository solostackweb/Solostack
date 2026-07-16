"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendQuestionnaireAction } from "../actions";

export interface SendClientOption {
  id: string;
  name: string;
  phone?: string | null;
}

export function buildWhatsappHref(
  link: string,
  clientName: string,
  phone?: string | null,
): string {
  const message = `Hi ${clientName}, please fill out this quick questionnaire: ${link}`;
  const digits = (phone ?? "").replace(/[^0-9]/g, "");
  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function SendQuestionnaireDialog({
  questionnaireId,
  clients,
  trigger,
}: {
  questionnaireId: string;
  clients: SendClientOption[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [clientId, setClientId] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const client = clients.find((c) => c.id === clientId);

  const reset = () => {
    setLink(null);
    setClientId("");
    setCopied(false);
  };

  const send = async () => {
    if (!clientId) {
      toast.error("Pick a client to send to.");
      return;
    }
    setSending(true);
    const res = await sendQuestionnaireAction({ questionnaireId, clientId });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Sent.");
    setLink(`${window.location.origin}/q/${res.data?.publicToken ?? ""}`);
    router.refresh();
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send questionnaire</DialogTitle>
        </DialogHeader>

        {link ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sent to {client?.name ?? "your client"}. Share this private link:
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                asChild
                className="flex-1 bg-[#25D366] text-white hover:bg-[#1ebe5d]"
              >
                <a
                  href={buildWhatsappHref(
                    link,
                    client?.name ?? "there",
                    client?.phone,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4" /> Share on WhatsApp
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                Send another
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Client
              </span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Choose a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <DialogFooter>
              <Button type="button" onClick={send} disabled={sending}>
                <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
