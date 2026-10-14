"use client";

import { useEffect, useState } from "react";
import AppWindow from "@/components/app/AppWindow";

type Provider = "followupboss" | "hubspot";

type RecordItem = {
  id: string;
  at: string;
  title: string;
  quote: string | null;
  status: string;
  attempts: number;
  doneAt: string | null;
  nextTryAt: string | null;
};

type Config = {
  connected: boolean;
  provider: Provider | null;
  accountLabel: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  writesPaused: boolean;
  isAdmin: boolean;
  record: { broughtIn: number; weekCount: number; items: RecordItem[] } | null;
};

/**
 * The CRMs FollowUp works beside (A-252). The tiles are the drawing's: each
 * CRM's own colour, soft, so the row reads as theirs at a glance.
 */
const CRMS: { id: Provider; name: string; tile: string; bg: string; fg: string; keyLabel: string; where: string }[] = [
  { id: "followupboss", name: "Follow Up Boss", tile: "FB", bg: "#e8eefc", fg: "#2c4fb5", keyLabel: "API key", where: "Admin → API in Follow Up Boss" },
  {
    id: "hubspot",
    name: "HubSpot",
    tile: "Hs",
    bg: "#fdece4",
    fg: "#c2451d",
    keyLabel: "Private app access token",
    where: "Settings → Integrations → Private Apps in HubSpot. It needs contacts read and write, and notes write",
  },
];
const SOON = { name: "GoHighLevel", tile: "GH", bg: "#e9f3ee", fg: "#1f6b47" };

function Tile({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[12.5px] font-bold" style={{ background: bg, color: fg }}>
      {text}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-[1px]" style={{ background: color }} />;
}

function Soon() {
  return <span className="ml-2 rounded-full bg-[var(--slate-soft)] px-2 py-0.5 text-[12px] text-ink-faint">Soon</span>;
}

const quietLink = "min-h-11 text-[14px] text-ink-soft underline underline-offset-[3px] decoration-[var(--line-strong)] hover:text-ink disabled:opacity-60";

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "3:02 PM" today, "Yesterday", or "Oct 12": the record's left column. */
function whenShort(iso: string, now: Date): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return clock(iso);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function agoWords(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Why the last check failed, in words that say what to do (R-111). The sync
 * stores "<time> <message>" (src/lib/crmSync.ts); a refused key is the one
 * the owner can fix.
 */
function syncProblem(raw: string, name: string): string {
  const refused = /\b(401|403)\b/.test(raw);
  return refused
    ? `${name} refused the key. Disconnect, then connect again with a new key.`
    : `Couldn't reach ${name} on the last check. FollowUp tries again every 10 minutes.`;
}

/**
 * Settings › More › Advanced › "Your CRM" (A-252). Keep the app you already
 * use: FollowUp brings its customers in, writes back what it does, and keeps
 * a record of every write. The lists say only what FollowUp does today; what
 * is coming is tagged Soon.
 */
export default function CrmConfig() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [connectFor, setConnectFor] = useState<Provider | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const now = new Date();

  async function load() {
    try {
      const data = (await (await fetch("/api/crm/config")).json()) as { success: boolean } & Config;
      if (data.success) setConfig(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect() {
    if (!connectFor || !keyDraft.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/crm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: connectFor, apiKey: keyDraft.trim() }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setConnectFor(null);
        setKeyDraft("");
        await load();
      } else {
        setSaveError(data.message ?? "That didn't connect. Check the key and try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function setPaused(writesPaused: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/crm/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writesPaused }),
      });
      if ((await res.json()).success) await load();
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      const res = await fetch("/api/crm/config", { method: "DELETE" });
      if ((await res.json()).success) await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) return null;
  const crm = CRMS.find((c) => c.id === config.provider) ?? null;
  const connected = config.connected && !!crm;
  const opening = CRMS.find((c) => c.id === connectFor) ?? null;
  const items = config.record?.items ?? [];
  const shown = showAll ? items : items.slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {connected && crm ? (
        <div className="box p-5">
          <div className="flex items-center gap-3">
            <Tile text={crm.tile} bg={crm.bg} fg={crm.fg} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">
                {crm.name}
                {config.accountLabel ? <span className="font-normal text-ink-soft"> ({config.accountLabel})</span> : null}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-faint">
                <Dot color="var(--sage)" />
                Connected
                {config.record ? ` · ${config.record.broughtIn} customers brought in` : ""}
                {config.lastSyncedAt ? ` · checked ${agoWords(config.lastSyncedAt, now)}` : " · first check within 10 minutes"}
              </p>
            </div>
          </div>
          {config.lastSyncError && (
            <p className="mt-3 text-[14px]">
              <Dot color="var(--coral)" />
              {syncProblem(config.lastSyncError, crm.name)}
            </p>
          )}
          {config.writesPaused && (
            <p className="mt-3 text-[14px] text-ink-soft">Writing is paused. FollowUp still brings customers in, but writes nothing in {crm.name}.</p>
          )}
          {config.isAdmin && (
            <div className="mt-1 flex flex-wrap gap-x-5">
              <button type="button" onClick={() => setPaused(!config.writesPaused)} disabled={saving} className={quietLink}>
                {config.writesPaused ? "Turn writing back on" : "Pause writing there"}
              </button>
              <button type="button" onClick={disconnect} disabled={saving} className={quietLink}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="box p-5">
          <p className="text-[15px] font-semibold">Keep the app you already use</p>
          <p className="mt-1 text-[14px] text-ink-soft">FollowUp works beside it: it brings your customers in, and writes back what it does.</p>
          <div className="mt-2">
            {CRMS.map((c, i) => (
              <div key={c.id} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <Tile text={c.tile} bg={c.bg} fg={c.fg} />
                <span className="min-w-0 flex-1 text-[15px] font-medium">{c.name}</span>
                {config.isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setConnectFor(c.id);
                      setKeyDraft("");
                      setSaveError(null);
                    }}
                    // One black button on the page (A-252): the first CRM's; the others are outlined.
                    className={
                      i === 0
                        ? "min-h-11 shrink-0 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-accent"
                        : "min-h-11 shrink-0 rounded-full border border-line-strong bg-card px-4 text-[14px] font-semibold"
                    }
                  >
                    Connect
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3 border-t border-line py-3">
              <Tile text={SOON.tile} bg={SOON.bg} fg={SOON.fg} />
              <span className="min-w-0 flex-1 text-[15px] font-medium">{SOON.name}</span>
              <Soon />
            </div>
          </div>
          {!config.isAdmin && <p className="mt-1 text-[14px] text-ink-soft">Only an admin can connect a CRM.</p>}
          <p className="mt-1 text-[14px] text-ink-soft">
            Something else?{" "}
            <a href="#lead-webhook" className="underline underline-offset-[3px] decoration-[var(--line-strong)] hover:text-ink">
              Send customers in with Zapier or Make
            </a>
          </p>
        </div>
      )}

      <div className="box p-5">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-faint">Reads</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[14.5px]">
              <li>New customers, every 10 minutes</li>
              <li>When it last contacted each one</li>
              <li>
                &ldquo;Do not contact&rdquo; and closed
                <Soon />
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-faint">Writes back</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[14.5px]">
              <li>A note after every reply</li>
              <li>A note when someone&apos;s ready to talk</li>
              <li>
                The stage: Replied, Ready, Booked
                <Soon />
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-4 border-t border-line pt-3.5 text-[14px] text-ink-soft">
          If {crm && connected ? crm.name : "your CRM"} contacted someone in the last two weeks, FollowUp only watches, and tells you when
          they&apos;re ready. Nobody gets two messages.
        </p>
      </div>

      {connected && crm && config.record && (
        <div className="box p-5">
          <p className="text-[15px] font-semibold">What FollowUp wrote in {crm.name}</p>
          {items.length === 0 ? (
            <p className="mt-2 text-[14px] text-ink-soft">
              Nothing yet. The first note goes in after FollowUp&apos;s next reply to a customer who&apos;s also in {crm.name}.
            </p>
          ) : (
            <>
              <ul className="mt-3 flex flex-col gap-3">
                {shown.map((w) => (
                  <li key={w.id} className="grid grid-cols-[72px_1fr] gap-3.5">
                    <span className="pt-px text-[13px] tabular-nums text-ink-faint">{whenShort(w.at, now)}</span>
                    <span className="min-w-0 text-[14.5px] leading-snug">
                      {w.title}
                      {w.quote && <span className="block break-words text-[13px] text-ink-faint">{w.quote}</span>}
                      {w.status === "done" && w.attempts > 1 && w.doneAt && (
                        <span className="mt-0.5 block text-[13px] text-ink-soft">
                          <Dot color="var(--coral)" />
                          Couldn&apos;t reach {crm.name} at first. Tried again at {clock(w.doneAt)}: done. Nothing was lost.
                        </span>
                      )}
                      {w.status === "waiting" && (
                        <span className="mt-0.5 block text-[13px] text-ink-soft">
                          <Dot color="var(--coral)" />
                          Couldn&apos;t reach {crm.name}. Trying again{w.nextTryAt ? ` at ${clock(w.nextTryAt)}` : " soon"}.
                        </span>
                      )}
                      {w.status === "failed" && (
                        <span className="mt-0.5 block text-[13px] text-ink-soft">
                          <Dot color="var(--coral)" />
                          Not written after {w.attempts} tries. It&apos;s still here in FollowUp.
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {config.record.weekCount > 5 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className={`mt-2 ${quietLink}`}>
                  {showAll ? "Show fewer" : `Show all ${config.record.weekCount} this week`}
                </button>
              )}
              {showAll && config.record.weekCount > items.length && (
                <p className="text-[13px] text-ink-faint">The newest {items.length} are shown.</p>
              )}
            </>
          )}
        </div>
      )}

      {opening && (
        <AppWindow label={`Connect ${opening.name}`} size="small" onClose={() => setConnectFor(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <Tile text={opening.tile} bg={opening.bg} fg={opening.fg} />
              <p className="text-[18px] font-semibold">Connect {opening.name}</p>
            </div>
            <p className="mt-4 text-[14px] text-ink-soft">FollowUp will:</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[14.5px]">
              <li>See your customers, and when each was last contacted</li>
              <li>Add a note there after each reply it sends</li>
            </ul>
            <p className="mt-4 rounded-[12px] bg-[var(--sage-soft)] px-3.5 py-3 text-[14px] text-[var(--green-ink)]">
              It never deletes or changes anything there. It only adds notes.
            </p>
            <label htmlFor="crm-key" className="mt-5 block text-[14px] font-medium">
              Your {opening.keyLabel}
            </label>
            <p className="mt-0.5 text-[13px] text-ink-faint">{opening.where}.</p>
            <input
              id="crm-key"
              type="password"
              autoComplete="off"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void connect();
              }}
              autoFocus
              className="mt-2 h-11 w-full rounded-[12px] border border-line bg-paper px-3 text-base"
            />
            {saveError && (
              <p role="alert" className="mt-2 text-[14px]" style={{ color: "var(--coral)" }}>
                {saveError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={connect}
                disabled={saving || !keyDraft.trim()}
                className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-accent disabled:opacity-60"
              >
                {saving ? "Connecting…" : `Connect ${opening.name}`}
              </button>
              <button type="button" onClick={() => setConnectFor(null)} className={quietLink}>
                Cancel
              </button>
            </div>
          </div>
        </AppWindow>
      )}
    </div>
  );
}
