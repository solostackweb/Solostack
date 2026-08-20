"use client";

import * as React from "react";
import { Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SignatureRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractTitle: string;
  defaultEmail?: string;
  defaultName?: string;
  onSend?: (values: {
    email: string;
    name: string;
    message: string;
  }) => void;
}

/**
 * "Send for signature" dialog. Pre-fills the client's name and email from
 * the contract metadata. Stub — no actual email is sent.
 */
export function SignatureRequestDialog({
  open,
  onOpenChange,
  contractTitle,
  defaultEmail = "",
  defaultName = "",
  onSend,
}: SignatureRequestDialogProps) {
  const [name, setName] = React.useState(defaultName);
  const [email, setEmail] = React.useState(defaultEmail);
  const [message, setMessage] = React.useState(
    `Hi,\n\nPlease find the agreement attached. Let me know if you have any questions — otherwise sign below when you're ready.\n\nThanks!`,
  );

  React.useEffect(() => {
    if (open) {
      setName(defaultName);
      setEmail(defaultEmail);
    }
  }, [open, defaultName, defaultEmail]);

  const handleSend = () => {
    if (!email.trim() || !name.trim()) {
      toast.error("Name and email are required");
      return;
    }
    onSend?.({ email, name, message });
    toast.success(`Signature request sent to ${email}`);
    onOpenChange(false);
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
      title={
        <span className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          Send for signature
        </span>
      }
      description={<span className="block truncate">{contractTitle}</span>}
    >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
              />
            </Field>
            <Field label="Recipient email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@acme.com"
              />
            </Field>
          </div>

          <Field label="Message">
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
            />
          </Field>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">
                Secure signature link
              </p>
              <p className="text-muted-foreground">
                Recipients sign via a unique link. You&apos;ll be notified when
                they view or sign the document.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend}>
            <Send /> Send request
          </Button>
        </div>
    </ResponsiveModal>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
