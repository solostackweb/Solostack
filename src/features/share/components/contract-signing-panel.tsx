"use client";

import { useState } from "react";
import { CheckCircle2, LockKeyhole, PenLine } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signContractPublicAction } from "@/features/contracts/public-actions";
import { SignatureCaptureModal } from "./signature-capture-modal";

export function ContractSigningPanel({
  token,
  signed,
  contractTitle,
}: {
  token: string;
  signed: boolean;
  contractTitle: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSignatureCapture = async (signature: {
    type: "draw" | "type" | "upload";
    imageUrl?: string;
    textValue?: string;
    fontFamily?: string;
    legalName: string;
  }) => {
    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.set("token", token);
          formData.set("signatureType", signature.type);
          formData.set("legalName", signature.legalName);

          if (signature.imageUrl) {
            formData.set("signatureImageUrl", signature.imageUrl);
          }
          if (signature.textValue) {
            formData.set("signatureTextValue", signature.textValue);
          }
          if (signature.fontFamily) {
            formData.set("signatureFontFamily", signature.fontFamily);
          }

          const result = await signContractPublicAction(formData);
          if (!result.ok) {
            reject(new Error(result.error || "Failed to save signature"));
            return;
          }
          // Reload to show updated status
          window.location.reload();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  };

  return (
    <>
      <Card className="mx-5 mb-8 overflow-hidden border-primary/15 bg-primary/[0.03] shadow-sm sm:mx-8 sm:mb-10">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-3.5">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {signed ? <LockKeyhole className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold tracking-tight">
                {signed ? "Already signed" : "Ready to sign?"}
              </p>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                {signed
                  ? "This agreement has already been signed and is locked for recordkeeping."
                  : "It takes under a minute — draw, type, or upload your signature. Both parties get a timestamped record."}
              </p>
            </div>
          </div>

          {signed ? (
            <div className="inline-flex items-center justify-center gap-2 rounded-lg bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" />
              Signed and recorded
            </div>
          ) : (
            <div className="flex w-full flex-col gap-3 sm:w-72 sm:shrink-0">
              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                />
                <span>
                  I consent to signing this document electronically under the
                  Information Technology Act, 2000, and agree my electronic
                  signature is legally binding.
                </span>
              </label>
              <Button
                size="lg"
                onClick={() => setIsModalOpen(true)}
                disabled={isPending || !agreed}
                className="w-full shadow-sm"
              >
                <PenLine className="h-4 w-4" />
                {isPending ? "Signing…" : "Review & sign contract"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!signed ? (
        <p className="mx-5 -mt-4 mb-8 text-xs leading-relaxed text-muted-foreground sm:mx-8 sm:mb-10">
          Do not use electronic signature for documents excluded under the First
          Schedule of the IT Act, 2000 (e.g. wills, powers of attorney,
          negotiable instruments, or property conveyances).
        </p>
      ) : null}

      <SignatureCaptureModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSignatureCapture={handleSignatureCapture}
        title="Sign Contract"
        description={`"${contractTitle}" — Choose your preferred signing method`}
      />
    </>
  );
}
