"use client";

/**
 * CsvImportDialog
 *
 * Two-step dialog:
 *   1. Drop / pick a CSV file → client-side parse → preview table
 *   2. Click "Import N clients" → calls `importClientsAction`
 *
 * Expects columns: name (required), email, phone, company / business
 * Header row is auto-detected. Column matching is case- and
 * whitespace-insensitive. If no "name" column is found the import
 * is blocked with a clear error.
 *
 * Non-GST only: CSV imports always set gst_registered = false.
 * Users can edit individual clients after import to add GST details.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { importClientsAction, type CsvClientRow } from "../actions";

// ---------------------------------------------------------------------------
// CSV parser (no external dep — handles quoted fields + CRLF)
// ---------------------------------------------------------------------------

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let inQuote = false;
    let cur = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

// Normalise a header string for matching.
const normaliseHeader = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

// Find a column index by trying multiple aliases.
function findCol(headers: string[], ...aliases: string[]): number {
  const normalised = headers.map(normaliseHeader);
  for (const alias of aliases) {
    const idx = normalised.indexOf(normaliseHeader(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

interface ParsedResult {
  rows: CsvClientRow[];
  error?: string;
}

function mapRows(raw: string[][]): ParsedResult {
  if (raw.length < 2) {
    return { rows: [], error: "CSV must have a header row and at least one data row." };
  }

  const headers = raw[0]!;
  const nameIdx = findCol(headers, "name", "fullname", "full name", "client name", "clientname");
  if (nameIdx === -1) {
    return {
      rows: [],
      error: `No "name" column found. Detected columns: ${headers.join(", ")}`,
    };
  }

  const emailIdx = findCol(headers, "email", "email address", "emailaddress");
  const phoneIdx = findCol(headers, "phone", "mobile", "contact", "phone number", "phonenumber");
  const bizIdx = findCol(headers, "company", "business", "businessname", "company name", "organisation", "organization");

  const rows: CsvClientRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i]!;
    const fullName = row[nameIdx]?.trim() ?? "";
    if (!fullName) continue;
    rows.push({
      fullName,
      email: emailIdx !== -1 ? (row[emailIdx]?.trim() || undefined) : undefined,
      phone: phoneIdx !== -1 ? (row[phoneIdx]?.trim() || undefined) : undefined,
      businessName: bizIdx !== -1 ? (row[bizIdx]?.trim() || undefined) : undefined,
    });
  }

  if (rows.length === 0) {
    return { rows: [], error: "No valid rows found (all name fields are empty)." };
  }

  return { rows };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "pick" | "preview" | "done";

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<Step>("pick");
  const [dragging, setDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState("");
  const [rows, setRows] = React.useState<CsvClientRow[]>([]);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{
    imported: number;
    skipped: number;
    blocked: boolean;
  } | null>(null);

  // Reset state when dialog closes.
  React.useEffect(() => {
    if (!open) {
      setStep("pick");
      setFileName("");
      setRows([]);
      setParseError(null);
      setResult(null);
    }
  }, [open]);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rawRows = parseCsv(text);
      const { rows: parsed, error } = mapRows(rawRows);
      if (error) {
        setParseError(error);
        setRows([]);
      } else {
        setParseError(null);
        setRows(parsed.slice(0, 200));
        setStep("preview");
      }
    };
    reader.readAsText(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-picked after an error.
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    setLoading(true);
    try {
      const res = await importClientsAction(rows);
      setResult({ imported: res.imported, skipped: res.skipped, blocked: res.blocked });
      setStep("done");
      if (res.imported > 0) router.refresh();
    } catch {
      setParseError("Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl sm:max-h-[90vh] sm:overflow-y-auto"
      title="Import clients from CSV"
      description={
        <>
          Upload a CSV file with columns: <strong>name</strong> (required),
          email, phone, company. GST details can be added per-client after import.
        </>
      }
    >

        {/* Step 1 — file picker */}
        {step === "pick" && (
          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Drop your CSV here</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  or click to browse · max 200 rows
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={onInputChange}
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {parseError}
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Expected format
              </p>
              <pre className="overflow-x-auto whitespace-pre text-xs text-foreground/80">{`name,email,phone,company\nPriya Menon,priya@example.com,9876543210,DesignCo`}</pre>
            </div>
          </div>
        )}

        {/* Step 2 — preview */}
        {step === "preview" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium text-foreground">{fileName}</span>
              <span className="ml-auto shrink-0">
                {rows.length} client{rows.length !== 1 ? "s" : ""} detected
              </span>
              <button
                onClick={() => { setStep("pick"); setRows([]); setFileName(""); }}
                className="ml-1 rounded hover:opacity-70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      {["Name", "Email", "Phone", "Company"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{r.fullName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.email ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.businessName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
                  + {rows.length - 10} more rows not shown
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — done */}
        {step === "done" && result && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-semibold">
                {result.imported} client{result.imported !== 1 ? "s" : ""} imported
              </p>
              {result.skipped > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped
                </p>
              )}
              {result.blocked && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Import stopped at your plan limit. Upgrade to add more clients.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {step === "pick" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Importing…" : `Import ${rows.length} client${rows.length !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </div>
    </ResponsiveModal>
  );
}
