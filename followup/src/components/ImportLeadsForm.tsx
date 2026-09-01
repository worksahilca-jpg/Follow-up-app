"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Upload } from "lucide-react";

interface ImportResult {
  created: number;
  skipped: number;
  skippedSamples: string[];
}

export default function ImportLeadsForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/leads/import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Import failed — try again.");
      setResult({ created: data.created, skipped: data.skipped, skippedSamples: data.skippedSamples ?? [] });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed — try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Import leads from CSV</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!result && (
          <>
            <p className="text-sm text-ink-soft">
              Upload a CSV with a <strong>Name</strong> column (required), plus any of: Company, Email,
              Phone, Source, Deal value, Notes. Column names are matched loosely, so exports from Google
              Sheets, Excel, or most CRMs should just work.
            </p>

            <label
              className="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line py-8 cursor-pointer hover:bg-paper transition-colors"
            >
              <Upload className="h-6 w-6 text-ink-soft" />
              <span className="text-sm text-ink-soft">
                {uploading ? "Uploading…" : fileName ?? "Click to choose a .csv file"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {error && (
              <p className="text-sm mt-3" style={{ color: "var(--rust)" }}>
                {error}
              </p>
            )}
          </>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm">
              Imported <strong>{result.created}</strong> lead{result.created === 1 ? "" : "s"}
              {result.skipped > 0 && (
                <>
                  , skipped <strong>{result.skipped}</strong>
                </>
              )}
              .
            </p>
            {result.skippedSamples.length > 0 && (
              <div className="rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-1">
                {result.skippedSamples.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
                {result.skipped > result.skippedSamples.length && (
                  <p>…and {result.skipped - result.skippedSamples.length} more.</p>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--ink)" }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
