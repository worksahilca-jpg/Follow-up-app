"use client";

/**
 * Settings → "Your data": the GDPR/PIPEDA export-and-erasure pair, in one
 * place. Export is available to any signed-in admin at any time; deletion
 * is admin-only, irreversible, and gated behind typing the business's own
 * name back — see /api/business/export and /api/business/delete.
 */

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Download, TriangleAlert } from "lucide-react";
import { handleReauthRequired } from "@/lib/reauthClient";

export default function DataPrivacySection() {
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="rounded-xl border border-line bg-card p-5">
        <div className="flex items-center gap-4">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
          >
            <Download className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Export everything</p>
            <p className="text-xs text-ink-soft mt-0.5">
              Every lead, conversation, deal, and setting tied to your business, as one JSON file. Credentials and
              tokens are never included.
            </p>
          </div>
          <a
            href="/api/business/export"
            className="shrink-0 text-sm font-medium rounded-lg px-3.5 py-2"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            Download
          </a>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-5" style={{ borderColor: "var(--coral)" }}>
        <div className="flex items-center gap-4">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--coral-soft)", color: "var(--coral)" }}
          >
            <TriangleAlert className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Delete this business</p>
            <p className="text-xs text-ink-soft mt-0.5">
              Permanently erases every lead, conversation, message, deal, and team member — and cancels your
              subscription. This cannot be undone.
            </p>
          </div>
          {!confirmOpen && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="shrink-0 text-sm font-medium rounded-lg px-3.5 py-2"
              style={{ backgroundColor: "var(--coral)", color: "white" }}
            >
              Delete…
            </button>
          )}
        </div>

        {confirmOpen && (
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-xs text-ink-soft">
              Type <span className="font-semibold text-ink">{businessName}</span> to confirm — everything goes,
              immediately, for good.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={businessName ?? ""}
                className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
              />
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim().toLowerCase() !== (businessName ?? "").trim().toLowerCase()}
                className="shrink-0 text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-40"
                style={{ backgroundColor: "var(--coral)", color: "white" }}
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
              <p className="mt-2 text-xs" style={{ color: "var(--coral)" }}>
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
