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
      <Card className="mx-5 mb-8 border-dashed bg-muted/20 sm:mx-8 sm:mb-10">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {signed ? <LockKeyhole className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                {signed ? "Already signed" : "Ready to sign"}
              </p>
              <p className="text-xs text-muted-foreground">
                {signed
                  ? "This agreement has already been signed and is locked for recordkeeping."
                  : "Review the agreement and sign it securely using the button below."}
              </p>
            </div>
          </div>

          {signed ? (
            <div className="inline-flex items-center justify-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Signed and recorded
            </div>
          ) : (
            <Button
              onClick={() => setIsModalOpen(true)}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              <PenLine className="h-4 w-4" />
              {isPending ? "Signing…" : "Sign contract"}
            </Button>
          )}
        </CardContent>
      </Card>

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
