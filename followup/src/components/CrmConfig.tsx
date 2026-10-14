"use client";

import { useEffect, useState } from "react";
import AppWindow from "@/components/app/AppWindow";
import Switch from "@/components/Switch";
import { BOX, PILL, ConnectedAs, ConnectedMark, ConnectionRow, ConnectionSheet, NeedsMark, Soon } from "@/components/settings/connectionBits";

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
 * Settings › Where customers write › "Already use a CRM?" (A-252, simplified
 * by A-253). One row: "Follow Up Boss or HubSpot" with Connect, or the CRM
 * that is connected with ✓ Connected. What FollowUp reads and writes there is
 * said once, in the connect window, before the key is asked for; the record
 * of every note FollowUp wrote, the pause and Disconnect sit in the connected
 * window.
 */
export default function CrmConfig() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  // null: no window. "pick": which CRM. A provider: its key.
  const [step, setStep] = useState<"pick" | Provider | "connected" | null>(null);
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

  async function connect(provider: Provider) {
    if (!keyDraft.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/crm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: keyDraft.trim() }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setKeyDraft("");
        await load();
        setStep("connected");
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

  async function disconnect(name: string) {
    if (!window.confirm(`Disconnect ${name}? FollowUp stops bringing customers in from it and stops adding notes there. You can connect it again any time.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/crm/config", { method: "DELETE" });
      if ((await res.json()).success) {
        await load();
        setStep(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) return null;
  const crm = CRMS.find((c) => c.id === config.provider) ?? null;
  const connected = config.connected && !!crm;
  const opening = CRMS.find((c) => c.id === step) ?? null;
  const items = config.record?.items ?? [];
  const shown = showAll ? items : items.slice(0, 5);
  const close = () => {
    setStep(null);
    setSaveError(null);
    setShowAll(false);
  };
  const refused = !!config.lastSyncError && /\b(401|403)\b/.test(config.lastSyncError);

  return (
    <>
      <div className={BOX}>
        {connected && crm ? (
          <ConnectionRow
            glyph="crm"
            name={crm.name}
            sub={config.record ? `${config.record.broughtIn} customers brought in` : null}
            first
            onOpen={() => setStep("connected")}
            mark={refused ? <NeedsMark word="New key" /> : config.writesPaused ? <span className="shrink-0 text-[15px] text-ink-faint">Paused</span> : <ConnectedMark />}
          />
        ) : (
          <ConnectionRow
            glyph="crm"
            name="Follow Up Boss or HubSpot"
            first
            action={
              config.isAdmin ? (
                <button type="button" onClick={() => setStep("pick")} className={PILL}>
                  Connect
                </button>
              ) : null
            }
          />
        )}
      </div>
      {!connected && !config.isAdmin && <p className="text-[14px] text-ink-soft">Only an admin can connect a CRM.</p>}

      {step === "pick" && (
        <AppWindow label="Connect your CRM" size="small" onClose={close}>
          <div className="p-6">
            <p className="pr-8 text-[20px] font-semibold leading-tight">Which one do you use?</p>
            <div className={BOX + " mt-4"}>
              {CRMS.map((c, i) => (
                <div key={c.id} className={"flex min-h-[60px] items-center gap-3 px-4 py-2" + (i ? " border-t border-line-2" : "")}>
                  <Tile text={c.tile} bg={c.bg} fg={c.fg} />
                  <span className="min-w-0 flex-1 text-[16px] font-semibold">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(c.id);
                      setKeyDraft("");
                      setSaveError(null);
                    }}
                    className={PILL}
                  >
                    Connect
                  </button>
                </div>
              ))}
              <div className="flex min-h-[60px] items-center gap-3 border-t border-line-2 px-4 py-2">
                <Tile text={SOON.tile} bg={SOON.bg} fg={SOON.fg} />
                <span className="min-w-0 flex-1 text-[16px] font-semibold">{SOON.name}</span>
                <Soon />
              </div>
            </div>
          </div>
        </AppWindow>
      )}

      {opening && (
        <AppWindow label={`Connect ${opening.name}`} size="small" onClose={close}>
          <div className="p-6">
            <div className="flex items-center gap-3 pr-8">
              <Tile text={opening.tile} bg={opening.bg} fg={opening.fg} />
              <p className="text-[18px] font-semibold">Connect {opening.name}</p>
            </div>
            <p className="mt-4 text-[14px] text-ink-soft">FollowUp will:</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[14.5px]">
              <li>Bring in your customers, every 10 minutes, and see when each was last contacted</li>
              <li>Add a note there after each reply it sends, and when someone&apos;s ready to talk</li>
            </ul>
            <p className="mt-4 rounded-[12px] bg-[var(--sage-soft)] px-3.5 py-3 text-[14px] text-[var(--green-ink)]">
              It never deletes or changes anything there. It only adds notes.
            </p>
            <p className="mt-3 text-[14px] text-ink-soft">
              If {opening.name} contacted someone in the last two weeks, FollowUp only watches, and tells you when they&apos;re ready. Nobody gets two
              messages.
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
                if (e.key === "Enter") void connect(opening.id);
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
                onClick={() => connect(opening.id)}
                disabled={saving || !keyDraft.trim()}
                className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-accent disabled:opacity-60"
              >
                {saving ? "Connecting…" : `Connect ${opening.name}`}
              </button>
              <button type="button" onClick={() => setStep("pick")} className={quietLink}>
                Back
              </button>
            </div>
          </div>
        </AppWindow>
      )}

      {step === "connected" && connected && crm && (
        <ConnectionSheet
          label={crm.name}
          glyph="crm"
          title={crm.name}
          status={refused ? undefined : <ConnectedAs who={config.accountLabel} />}
          onClose={close}
          onDisconnect={config.isAdmin ? () => disconnect(crm.name) : undefined}
          disconnectLabel={`Disconnect ${crm.name}`}
          busy={saving}
        >
          <p className="mt-4 text-[15px] text-ink-soft">
            {config.record ? `${config.record.broughtIn} customers brought in` : "Customers come in from it every 10 minutes"}
            {config.lastSyncedAt ? ` · checked ${agoWords(config.lastSyncedAt, now)}` : " · first check within 10 minutes"}
          </p>
          {config.lastSyncError && (
            <p className="mt-3 text-[15px]">
              <Dot color="var(--coral)" />
              {syncProblem(config.lastSyncError, crm.name)}
            </p>
          )}
          {config.isAdmin && (
            <div className={BOX + " mt-4 flex min-h-[56px] items-center gap-3 px-4"}>
              <span className="flex-1 text-[16px]">Add notes in {crm.name}</span>
              <Switch checked={!config.writesPaused} onChange={() => setPaused(!config.writesPaused)} disabled={saving} label={`Add notes in ${crm.name}`} />
            </div>
          )}
          {config.writesPaused && (
            <p className="mt-2 text-[14px] text-ink-soft">Paused. FollowUp still brings customers in, but writes nothing in {crm.name}.</p>
          )}
          {config.record && (
            <div className="mt-5">
              <p className="text-[15px] font-semibold">What FollowUp wrote there this week</p>
              {items.length === 0 ? (
                <p className="mt-1.5 text-[14px] text-ink-soft">Nothing yet. The first note goes in after FollowUp&apos;s next reply to someone who&apos;s also in {crm.name}.</p>
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
                  {showAll && config.record.weekCount > items.length && <p className="text-[13px] text-ink-faint">The newest {items.length} are shown.</p>}
                </>
              )}
            </div>
          )}
        </ConnectionSheet>
      )}
    </>
  );
}
