"use client";

import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Upload, AlertCircle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignaturePadData = Parameters<SignatureCanvas["fromData"]>[0];
type SignaturePadLike = {
  toData?: () => SignaturePadData;
  clear?: () => void;
  fromData?: (data: SignaturePadData) => void;
};
type SignatureCanvasHandle = SignatureCanvas & {
  _signaturePad?: SignaturePadLike;
  signaturePad?: SignaturePadLike;
  isEmpty?: () => boolean;
  clear?: () => void;
  toDataURL?: (type?: string) => string;
};

interface SignatureCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onSignatureCapture: (signature: {
    type: "draw" | "type" | "upload";
    imageUrl?: string;
    textValue?: string;
    fontFamily?: string;
    legalName: string;
  }) => Promise<void>;
  title: string;
  description?: string;
  submitLabel?: string;
  showConsent?: boolean;
  defaultLegalName?: string;
}

export function SignatureCaptureModal({
  open,
  onClose,
  onSignatureCapture,
  title,
  description,
  submitLabel = "Complete Signature",
  showConsent = true,
  defaultLegalName = "",
}: SignatureCaptureModalProps) {
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for type tab
  const [typedName, setTypedName] = useState("");
  const [selectedFont, setSelectedFont] = useState("dancing-script");

  // State for upload tab
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  // Shared state
  const [legalName, setLegalName] = useState(defaultLegalName);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"draw" | "type" | "upload">(
    "draw"
  );
  const [canvasHasContent, setCanvasHasContent] = useState(false);

  // Monitor canvas drawing state via canvas events
  useEffect(() => {
    const canvas = signatureCanvasRef.current as SignatureCanvasHandle | null;
    if (!canvas) return;

    // Also check immediately
    const checkContent = () => {
      const isEmpty = canvas.isEmpty?.();
      setCanvasHasContent(!isEmpty);
    };
    
    const interval = setInterval(checkContent, 100);
    return () => clearInterval(interval);
  }, []);

  // Reset canvas state when switching away from draw tab
  useEffect(() => {
    if (activeTab !== "draw") {
      setCanvasHasContent(false);
    }
  }, [activeTab]);

  // Validation
  const isDrawValid = () => {
    return canvasHasContent;
  };

  const isTypeValid = () => typedName.trim().length > 0;
  const isUploadValid = () => uploadedImage !== null;

  const isSignatureValid =
    activeTab === "draw"
      ? isDrawValid()
      : activeTab === "type"
        ? isTypeValid()
        : isUploadValid();

  const isFormValid =
    isSignatureValid &&
    legalName.trim().length > 0 &&
    (!showConsent || (agreementAccepted && nameConfirmed));

  // Clear draw tab
  const handleClearDraw = () => {
    const canvas = signatureCanvasRef.current as SignatureCanvasHandle | null;
    if (canvas && typeof canvas.clear === 'function') {
      canvas.clear();
      setCanvasHasContent(false);
    }
  };

  // Undo draw using signature_pad data arrays (remove last stroke)
  const handleUndoDraw = () => {
    const canvas = signatureCanvasRef.current as SignatureCanvasHandle | null;
    if (!canvas) return;
    try {
      // Get the underlying signature_pad instance
      const signaturePad: SignaturePadLike = canvas._signaturePad || canvas.signaturePad || canvas;
      if (!signaturePad || typeof signaturePad.toData !== 'function') {
        console.warn('toData method not available, falling back to clear');
        if (typeof canvas.clear === 'function') canvas.clear();
        setCanvasHasContent(false);
        return;
      }
      
      const data = signaturePad.toData();
      if (!Array.isArray(data) || data.length === 0) return;
      
      data.pop();
      if (typeof signaturePad.clear === 'function') {
        signaturePad.clear();
      }
      if (typeof signaturePad.fromData === 'function') {
        signaturePad.fromData(data);
      }
      // Update state - empty if no more strokes
      setCanvasHasContent(data.length > 0);
    } catch (err) {
      console.error('Undo failed:', err);
      // Fallback: clear entirely if undo fails
      if (typeof canvas.clear === 'function') {
        canvas.clear();
      }
      setCanvasHasContent(false);
    }
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload PNG, JPG, or WEBP image");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUploadedImage(base64);
      setUploadFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Handle signature capture
  const handleCaptureSignature = async () => {
    if (!isFormValid) {
      alert("Please complete the signature, confirm your legal name, and accept the terms before saving.");
      return;
    }

    setIsLoading(true);
    try {
      let signatureData: Parameters<typeof onSignatureCapture>[0];

      if (activeTab === "draw") {
        const canvas = signatureCanvasRef.current as SignatureCanvasHandle | null;
        if (!canvas || typeof canvas.toDataURL !== 'function') {
          throw new Error("Canvas not ready. Please draw your signature again.");
        }
        const dataUrl = canvas.toDataURL("image/png");
        if (!dataUrl) throw new Error("Failed to capture signature");

        signatureData = {
          type: "draw",
          imageUrl: dataUrl,
          legalName,
        };
      } else if (activeTab === "type") {
        signatureData = {
          type: "type",
          textValue: typedName,
          fontFamily: selectedFont,
          legalName,
        };
      } else {
        if (!uploadedImage) throw new Error("No image uploaded");

        signatureData = {
          type: "upload",
          imageUrl: uploadedImage,
          legalName,
        };
      }

      await onSignatureCapture(signatureData);
      onClose();
    } catch (error) {
      console.error("Signature capture error:", error);
      alert("Failed to save signature. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-w-2xl grid-rows-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {/* Tabs for signature methods */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as typeof activeTab)}
            className="w-full"
          >
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="draw" className="min-w-0 px-2 text-xs sm:text-sm">
                Draw
              </TabsTrigger>
              <TabsTrigger value="type" className="min-w-0 px-2 text-xs sm:text-sm">
                Type
              </TabsTrigger>
              <TabsTrigger value="upload" className="min-w-0 px-2 text-xs sm:text-sm">
                Upload
              </TabsTrigger>
            </TabsList>

            {/* Draw Tab (PRIMARY) */}
            <TabsContent value="draw" className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sign using your mouse, touchscreen, or trackpad.
                </p>
                <div className="rounded-lg border-2 border-dashed bg-muted p-2 sm:p-4">
                  <SignatureCanvas
                    ref={signatureCanvasRef}
                    onEnd={() => {
                      // Callback when drawing ends
                      const canvas = signatureCanvasRef.current as SignatureCanvasHandle | null;
                      if (canvas) {
                        const isEmpty = canvas.isEmpty?.();
                        setCanvasHasContent(!isEmpty);
                      }
                    }}
                    canvasProps={{
                      style: { width: "100%", height: "200px", display: "block", touchAction: "none" },
                      className: "border border-border rounded w-full cursor-crosshair",
                    }}
                    backgroundColor="white"
                    penColor="#000000"
                    velocityFilterWeight={0.7}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearDraw}
                  disabled={!isDrawValid()}
                  className="flex-1"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUndoDraw}
                  disabled={!isDrawValid()}
                  className="flex-1"
                >
                  Undo
                </Button>
              </div>
            </TabsContent>

            {/* Type Tab (FALLBACK) */}
            <TabsContent value="type" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="typed-name">Full Legal Name</Label>
                <Input
                  id="typed-name"
                  placeholder="Enter your full legal name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-select">Signature Font</Label>
                <select
                  id="font-select"
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                >
                  <option value="dancing-script">Dancing Script</option>
                  <option value="great-vibes">Great Vibes</option>
                  <option value="pacifico">Pacifico</option>
                  <option value="satisfy">Satisfy</option>
                </select>
              </div>

              {typedName && (
                <div className="p-4 border-2 border-dashed rounded-lg bg-muted">
                  <p
                    className="text-4xl text-center text-muted-foreground"
                    style={{
                      fontFamily:
                        selectedFont === "dancing-script"
                          ? "'Dancing Script', cursive"
                          : selectedFont === "great-vibes"
                            ? "'Great Vibes', cursive"
                            : selectedFont === "pacifico"
                              ? "'Pacifico', cursive"
                              : "'Satisfy', cursive",
                    }}
                  >
                    {typedName}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Upload Tab (OPTIONAL) */}
            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload PNG, JPG, or WEBP image (max 5MB)
                </p>
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadedImage ? (
                    <div className="space-y-2">
                      {/* Signature previews are local data/blob URLs; Next Image adds no benefit here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uploadedImage}
                        alt="Uploaded signature"
                        className="max-h-32 mx-auto"
                      />
                      <p className="text-sm text-muted-foreground">
                        {uploadFileName}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="font-medium">Click to upload</p>
                      <p className="text-sm text-muted-foreground">
                        or drag and drop
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Legal Name Confirmation */}
          <div className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="legal-name">Confirm Your Legal Name</Label>
              <Input
                id="legal-name"
                placeholder="Full legal name as it appears on ID"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>

            {showConsent ? (
              <>
                <div className="flex gap-2 rounded-lg border border-warning-subtle bg-warning-subtle p-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-strong" />
                  <p className="text-sm text-warning-strong">
                    Before signing, you must accept the following:
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="accept-agreement"
                      checked={agreementAccepted}
                      onCheckedChange={(checked) =>
                        setAgreementAccepted(checked as boolean)
                      }
                    />
                    <Label
                      htmlFor="accept-agreement"
                      className="text-sm font-normal"
                    >
                      I have reviewed and accept the terms of this contract
                    </Label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="confirm-name"
                      checked={nameConfirmed}
                      onCheckedChange={(checked) =>
                        setNameConfirmed(checked as boolean)
                      }
                    />
                    <Label
                      htmlFor="confirm-name"
                      className="text-sm font-normal"
                    >
                      I confirm my legal name is{" "}
                      <strong>{legalName || "___________"}</strong> and I intend
                      to be legally bound by this signature
                    </Label>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Submit Button */}
        </div>

          {/* Submit Button */}
          <div className="sticky bottom-0 z-10 flex gap-3 border-t bg-background/95 px-5 py-4 backdrop-blur sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCaptureSignature}
              disabled={!isFormValid || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <span className="mr-2">Signing…</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}
