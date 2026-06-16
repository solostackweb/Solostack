"use client";

/**
 * Portal file upload button with a live progress bar.
 *
 * Flow: presign (our API, authorises + caps) → PUT to the same-origin Worker
 * (with XHR so we get upload progress) → commit (records the DB row). On
 * success it fires `onUploaded` with an optimistic row so the list updates
 * instantly, then calls router.refresh() to reconcile with the server.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalFileRow } from "@/lib/supabase/types";

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok ? "Unexpected server response." : `Request failed (${res.status}).`,
    );
  }
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.send(file);
  });
}

export function PortalFileUploadButton({
  portalId,
  currentUserId,
  onUploaded,
  className,
}: {
  portalId: string;
  currentUserId?: string;
  onUploaded?: (file: PortalFileRow) => void;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  async function onFiles(filelist: FileList | null) {
    if (!filelist || filelist.length === 0) return;
    setPending(true);
    setError(null);
    setProgress(0);
    try {
      for (const file of Array.from(filelist)) {
        const presignRes = await fetch(`/api/portals/${portalId}/files/presign`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        const presign = (await readJson(presignRes)) as
          | { ok: true; fileId: string; key: string; putUrl: string }
          | { ok: false; error: string };
        if (!presign.ok) throw new Error(presign.error);

        await putWithProgress(presign.putUrl, file, setProgress);

        const commitRes = await fetch(`/api/portals/${portalId}/files/commit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileId: presign.fileId,
            key: presign.key,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
          }),
        });
        const commit = (await readJson(commitRes)) as
          | { ok: true }
          | { ok: false; error: string };
        if (!commit.ok) throw new Error(commit.error);

        // Optimistic row so the list shows the file immediately.
        onUploaded?.({
          id: presign.fileId,
          portal_id: portalId,
          uploaded_by: currentUserId ?? "",
          r2_key: presign.key,
          name: file.name,
          size_bytes: file.size,
          mime_type: file.type || "application/octet-stream",
          category: "misc",
          approval_status: "none",
          created_at: new Date().toISOString(),
          deleted_at: null,
        });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          className={className ?? "h-9 rounded-full"}
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          {pending ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress > 0 ? `${progress}%` : "Uploading"}</>
          ) : (
            <><Upload className="h-3.5 w-3.5" /> Upload</>
          )}
        </Button>
      </div>
      {pending && (
        <div className="h-1 w-28 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && (
        <span className="max-w-[180px] truncate text-[11px] text-destructive">{error}</span>
      )}
    </div>
  );
}
