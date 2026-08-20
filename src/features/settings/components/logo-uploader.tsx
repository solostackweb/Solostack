"use client";

import * as React from "react";
import { Upload, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoUploaderProps {
  /** Descriptive label shown above the dropzone (e.g. "Company logo"). */
  label?: string;
  /** Short helper describing constraints. */
  hint?: string;
  /** Starting URL if the user already has one. Local-only for the demo. */
  initialUrl?: string;
  /** Max file size in MB (display-only; no upload actually happens). */
  maxMb?: number;
  /** Visual shape of the preview well. */
  shape?: "square" | "circle";
  /** Called when a valid file is selected. Return a URL to persist. */
  onUpload?: (file: File) => Promise<string | null>;
  /** Called when the user removes the asset. */
  onRemove?: () => Promise<void>;
  className?: string;
}

/**
 * Reusable logo/avatar uploader. Displays a preview + a drag-friendly dropzone.
 * NOT wired to any backend — it uses `URL.createObjectURL` so the user sees
 * their selected file immediately. Replace with a real uploader later.
 */
export function LogoUploader({
  label = "Logo",
  hint = "PNG, JPG, or SVG. Up to 2 MB. Recommended: 512×512.",
  initialUrl,
  maxMb = 2,
  shape = "square",
  onUpload,
  onRemove,
  className,
}: LogoUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(
    initialUrl ?? null,
  );
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  // Revoke any blob URL we created on unmount to avoid leaks.
  React.useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File is larger than ${maxMb} MB`);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    if (!onUpload) {
      toast.success("Preview updated — save to apply");
      return;
    }
    setIsUploading(true);
    try {
      const remoteUrl = await onUpload(file);
      if (remoteUrl) setPreview(remoteUrl);
      toast.success("Image updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!onRemove) return;
    setIsUploading(true);
    try {
      await onRemove();
      toast.success("Image removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Remove failed",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div
          className={cn(
            "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border bg-muted",
            shape === "circle" ? "rounded-full" : "rounded-lg",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {/* Dropzone */}
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !isUploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isUploading) inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Upload ${label.toLowerCase()}`}
          className={cn(
            "flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-4 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "hover:border-primary/50 hover:bg-muted/50",
            isUploading && "opacity-60",
          )}
        >
          <Upload className="mb-1 h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium">
            <span className="text-primary">
              {isUploading ? "Uploading" : "Click to upload"}
            </span>
            {!isUploading && " or drag & drop"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={isUploading}
          />
        </div>

        {/* Remove */}
        {preview && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={handleRemove}
            aria-label="Remove image"
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
