"use client";

import { useEffect, useState } from "react";
import { Check, Database } from "lucide-react";

type Provider = "followupboss" | "hubspot";

const PROVIDER_LABEL: Record<Provider, string> = {
  followupboss: "Follow Up Boss",
  hubspot: "HubSpot",
};

const KEY_LABEL: Record<Provider, string> = {
  followupboss: "API key",
  hubspot: "Private app access token",
};

/**
 * "CRM" section of Settings — works ALONGSIDE a CRM the business already
 * runs (research/market/2026-09-07-why-followup-evidence-for-and-against.md:
 * roughly half of small businesses already have one). Importing does not
 * fire the instant-acknowledgement — see src/lib/crmSync.ts for why.
 */
export default function CrmConfig() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const [draftProvider, setDraftProvider] = useState<Provider>("followupboss");
  const [keyDraft, setKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/config")
      .then((r) => r.json())
      .then(
        (data: {
          success: boolean;
          connected?: boolean;
          provider?: Provider | null;
          accountLabel?: string | null;
          lastSyncedAt?: string | null;
          lastSyncError?: string | null;
        }) => {
          if (data.success) {
            setConnected(!!data.connected);
            setProvider(data.provider ?? null);
            setAccountLabel(data.accountLabel ?? null);
            setLastSyncedAt(data.lastSyncedAt ?? null);
            setLastSyncError(data.lastSyncError ?? null);
          }
        }
      )
      .finally(() => setLoading(false));
  }, []);

  async function connect() {
    if (!keyDraft.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/crm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: draftProvider, apiKey: keyDraft.trim() }),
      });
      const data: { success: boolean; provider?: Provider; accountLabel?: string | null; message?: string } = await res.json();
      if (data.success) {
        setConnected(true);
        setProvider(data.provider ?? draftProvider);
        setAccountLabel(data.accountLabel ?? null);
        setKeyDraft("");
      } else {
        setSaveError(data.message ?? "Couldn't connect — try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      const res = await fetch("/api/crm/config", { method: "DELETE" });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setConnected(false);
        setProvider(null);
        setAccountLabel(null);
        setLastSyncedAt(null);
        setLastSyncError(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <Database className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Connect your CRM</p>
          <p className="text-xs text-ink-soft mt-1">
            Already run Follow Up Boss or HubSpot? Keep it — FollowUp imports your contacts every 10 minutes and
            works alongside it, watching for leads it&apos;s neglecting. When FollowUp sends a follow-up, a note goes
            back to the same contact in your CRM, so nothing is only in one place.
          </p>

          {connected ? (
            <div className="mt-3">
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--sage)" }}>
                <Check className="h-3.5 w-3.5" /> Connected to {provider ? PROVIDER_LABEL[provider] : "your CRM"}
                {accountLabel ? ` (${accountLabel})` : ""}.
              </p>
              <p className="text-xs text-ink-soft mt-1">
                {lastSyncedAt
                  ? `Last synced ${new Date(lastSyncedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
                  : "First sync runs within 10 minutes."}
              </p>
              {lastSyncError && (
                <p className="text-xs mt-1" style={{ color: "var(--coral)" }}>
                  Last sync failed: {lastSyncError}
                </p>
              )}
              <button onClick={disconnect} disabled={saving} className="mt-2 text-xs font-medium" style={{ color: "var(--coral)" }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {saveError && (
                <p className="text-xs" style={{ color: "var(--coral)" }}>
                  {saveError}
                </p>
              )}
              <div className="flex gap-2">
                <select
                  value={draftProvider}
                  onChange={(e) => setDraftProvider(e.target.value as Provider)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs"
                >
                  <option value="followupboss">Follow Up Boss</option>
                  <option value="hubspot">HubSpot</option>
                </select>
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder={KEY_LABEL[draftProvider]}
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                />
                <button
                  onClick={connect}
                  disabled={saving || !keyDraft.trim()}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 shrink-0"
                  style={{ backgroundColor: "var(--ink)" }}
                >
                  {saving ? "Connecting…" : "Connect"}
                </button>
              </div>
              <p className="text-xs text-ink-soft">
                {draftProvider === "followupboss"
                  ? "Admin → API in Follow Up Boss."
                  : "Settings → Integrations → Private Apps in HubSpot (needs contacts read/write and notes write)."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
