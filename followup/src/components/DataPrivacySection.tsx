"use client";

/**
 * Settings → "Your data": the GDPR/PIPEDA export-and-erasure pair, in one
 * place. Export is available to any signed-in admin at any time; deletion
 * is admin-only, irreversible, and gated behind typing the business's own
 * name back — see /api/business/export and /api/business/delete.
 */

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Download, Eraser, TriangleAlert } from "lucide-react";
import { handleReauthRequired } from "@/lib/reauthClient";
import ImproveFollowUpToggle from "@/components/ImproveFollowUpToggle";
import PastRepliesToggle from "@/components/PastRepliesToggle";

export default function DataPrivacySection() {
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Practice customers (A-093): only the ones the practice-email button made. The row shows
  // only while there are some, then says what it removed.
  const [practiceCount, setPracticeCount] = useState(0);
  const [removingPractice, setRemovingPractice] = useState(false);
  const [practiceNote, setPracticeNote] = useState<string | null>(null);

  async function handleRemovePractice() {
    const n = practiceCount;
    if (!window.confirm(`Remove ${n} practice ${n === 1 ? "customer" : "customers"}? Real customers are never touched.`)) return;
    setRemovingPractice(true);
    setPracticeNote(null);
    try {
      const res = await fetch("/api/leads/practice", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't remove them. Try again.");
      setPracticeCount(0);
      setPracticeNote(`Removed ${data.removed} practice ${data.removed === 1 ? "customer" : "customers"}.`);
    } catch (err) {
      setPracticeNote(err instanceof Error ? err.message : "Couldn't remove them. Try again.");
    } finally {
      setRemovingPractice(false);
    }
  }

  // Every customer in one file, so the server asks for a fresh sign-in first, as Delete does
  // (security review L3, 2026-10-05): a stolen week-old cookie shouldn't be enough to take it.
  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/business/export");
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (await handleReauthRequired(res, data)) return;
      }
      if (!res.ok) throw new Error("Couldn't prepare the file. Try again.");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "followup-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Couldn't prepare the file. Try again.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    fetch("/api/business/delete")
      .then((r) => r.json())
      .then((data: { success: boolean; businessName?: string }) => {
        if (data.success) {
          setBusinessName(data.businessName ?? null);
          setIsAdmin(true);
        }
      })
      .finally(() => setLoaded(true));
    fetch("/api/leads/practice")
      .then((r) => r.json())
      .then((data: { success: boolean; count?: number }) => {
        if (data.success) setPracticeCount(data.count ?? 0);
      })
      .catch(() => {});
  }, []);

  async function handleDelete() {
    if (!businessName || confirmText.trim().toLowerCase() !== businessName.trim().toLowerCase()) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/business/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmText }),
      });
      const data = await res.json();
      // This is irreversible, so the server insists the session was
      // recently, actually re-proven — if it wasn't, this redirects
      // through Google's login screen and the admin just confirms again
      // once they're back.
      if (await handleReauthRequired(res, data)) return;
      if (!data.success) throw new Error(data.message ?? "Couldn't delete — try again.");
      // Nothing left to sign back into — send them to the marketing site,
      // not back to a dashboard for an account that no longer exists.
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete — try again.");
      setDeleting(false);
    }
  }

  if (!loaded || !isAdmin) return null;

  return (
    <div>
      {/* The consent switches first: they are the things here an owner
          decides rather than does. Export and delete follow. */}
      <ImproveFollowUpToggle />

      <div className="mt-4">
        <PastRepliesToggle />
      </div>

      <div className="mt-4 box p-5">
        <div className="flex items-center gap-4">
          <div
            className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
          >
            <Download className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Export everything</p>
            <p className="text-[13px] text-ink-soft mt-0.5">
              Every lead, conversation, deal, and setting tied to your business, as one JSON file. Credentials and
              tokens are never included.
            </p>
            {exportError && (
              <p className="mt-1 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
                {exportError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="shrink-0 text-sm font-medium rounded-full px-3.5 py-2 disabled:opacity-60"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {exporting ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>

      {(practiceCount > 0 || practiceNote) && (
        <div className="mt-4 box p-5">
          <div className="flex items-center gap-4">
            <div
              className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
            >
              <Eraser className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Practice customers</p>
              <p className="text-[13px] text-ink-soft mt-0.5">
                {practiceCount > 0
                  ? `${practiceCount} made by the practice email. Removing ${practiceCount === 1 ? "it clears it" : "them clears them"} from Today, Customers and your numbers. Real customers are never touched.`
                  : practiceNote}
              </p>
              {practiceCount > 0 && practiceNote && (
                <p className="mt-1 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
                  {practiceNote}
                </p>
              )}
            </div>
            {practiceCount > 0 && (
              <button
                type="button"
                onClick={handleRemovePractice}
                disabled={removingPractice}
                className="shrink-0 text-sm font-medium rounded-full border border-line px-3.5 py-2 disabled:opacity-60"
              >
                {removingPractice ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-[var(--radius-box)] border p-5" style={{ borderColor: "var(--coral)" }}>
        <div className="flex items-center gap-4">
          <div
            className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--coral-soft)", color: "var(--coral)" }}
          >
            <TriangleAlert className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Delete this business</p>
            <p className="text-[13px] text-ink-soft mt-0.5">
              Permanently erases every lead, conversation, message, deal, and team member — and cancels your
              subscription. This cannot be undone.
            </p>
          </div>
          {!confirmOpen && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="shrink-0 text-sm font-medium rounded-full px-3.5 py-2"
              style={{ backgroundColor: "var(--coral-fill)", color: "var(--on-coral)" }}
            >
              Delete…
            </button>
          )}
        </div>

        {confirmOpen && (
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-[13px] text-ink-soft">
              Type <span className="font-semibold text-ink">{businessName}</span> to confirm — everything goes,
              immediately, for good.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={businessName ?? ""}
                className="flex-1 rounded-[12px] border border-line bg-paper px-3 py-2 text-sm"
              />
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim().toLowerCase() !== (businessName ?? "").trim().toLowerCase()}
                className="shrink-0 text-sm font-medium rounded-full px-3.5 py-2 disabled:opacity-40"
                style={{ backgroundColor: "var(--coral-fill)", color: "var(--on-coral)" }}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={deleting}
                className="shrink-0 text-sm text-ink-soft px-2"
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--coral)" }}>
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
