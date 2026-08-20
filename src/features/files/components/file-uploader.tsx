"use client";

import * as React from "react";
import { Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  recordUploadAction,
  requestUploadAction,
} from "../actions";
import type { FileBucket } from "../server";

interface FileUploaderProps {
  bucket: FileBucket;
  /** Logical entity for storage prefixing — e.g. `client/<id>` or
   * `project/<id>`. Combined into the storage path. */
  entity: string;
  /** Optional FK we should record on the metadata row. */
  projectId?: string | null;
  /** Comma-separated `accept` value, e.g. `"image/*,application/pdf"`. */
  accept?: string;
  /** Hard cap, in megabytes. Defaults to 25MB. */
  maxMB?: number;
  /** Cap on simultaneous uploads in one batch. */
  maxFiles?: number;
  /** Called once each file lands successfully. */
  onUploaded?: (file: { id: string; name: string; size: number }) => void;
  className?: string;
}

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

/**
 * Drag-and-drop file uploader.
 *
 * Flow:
 *   1. Server action mints a signed upload URL via `requestUploadAction`.
 *   2. Browser uploads bytes directly to Supabase Storage (XHR so we get
 *      progress events).
 *   3. Server action persists metadata via `recordUploadAction`.
 */
export function FileUploader({
  bucket,
  entity,
  projectId = null,
  accept,
  maxMB = 25,
  maxFiles = 8,
  onUploaded,
  className,
}: FileUploaderProps) {
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [isOver, setIsOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = React.useCallback(
    (incoming: FileList | File[]) => {
      const files = Array.from(incoming);
      if (files.length === 0) return;
      const limit = Math.max(0, maxFiles - queue.length);
      if (limit === 0) {
        toast.error(`You can upload up to ${maxFiles} files at a time.`);
        return;
      }
      const accepted: QueueItem[] = [];
      for (const file of files.slice(0, limit)) {
        if (file.size > maxMB * 1024 * 1024) {
          toast.error(`${file.name} is larger than ${maxMB}MB.`);
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${file.name}-${file.size}`,
          file,
          status: "pending",
          progress: 0,
        });
      }
      if (accepted.length === 0) return;
      setQueue((prev) => [...prev, ...accepted]);
      void uploadBatch(accepted);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue.length, maxFiles, maxMB, bucket, entity, projectId],
  );

  async function uploadBatch(items: QueueItem[]) {
    for (const item of items) {
      try {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "uploading" } : q,
          ),
        );
        const signed = await requestUploadAction({
          bucket,
          entity,
          fileName: item.file.name,
        });
        if (!signed.ok || !signed.data) throw new Error(signed.ok ? "No URL" : signed.error);
        await uploadToSignedUrl(signed.data.uploadUrl, item.file, (pct) =>
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress: pct } : q)),
          ),
        );
        const recorded = await recordUploadAction({
          fileName: item.file.name,
          storagePath: signed.data.path,
          fileSize: item.file.size,
          mimeType: item.file.type || null,
          projectId: projectId,
        });
        if (!recorded.ok || !recorded.data) {
          throw new Error(recorded.ok ? "Save failed" : recorded.error);
        }
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "done", progress: 100 } : q,
          ),
        );
        onUploaded?.({
          id: recorded.data.id,
          name: item.file.name,
          size: item.file.size,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed.";
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "error", error: message }
              : q,
          ),
        );
        toast.error(`${item.file.name}: ${message}`);
      }
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center transition-colors",
          isOver
            ? "border-primary bg-primary/5"
            : "hover:border-primary/40 hover:bg-muted/50",
        )}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground">
          Up to {maxFiles} files · {maxMB}MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">
                    {item.file.name}
                  </p>
                  <span className="shrink-0 text-micro tabular-nums text-muted-foreground">
                    {formatBytes(item.file.size)}
                  </span>
                </div>
                {item.status === "uploading" && (
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === "error" && (
                  <p className="mt-1 text-xs text-destructive">
                    {item.error}
                  </p>
                )}
                {item.status === "done" && (
                  <p className="mt-1 text-xs text-success">Uploaded</p>
                )}
              </div>
              {item.status === "uploading" ? (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                  aria-hidden
                />
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() =>
                    setQueue((prev) => prev.filter((q) => q.id !== item.id))
                  }
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function uploadToSignedUrl(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    if (file.type) xhr.setRequestHeader("content-type", file.type);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`HTTP ${xhr.status}`));
    });
    xhr.addEventListener("error", () =>
      reject(new Error("Network error during upload.")),
    );
    xhr.send(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
