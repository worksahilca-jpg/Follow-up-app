"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import AppWindow from "@/components/app/AppWindow";
import Switch from "@/components/Switch";
import { ListRow, LetterTile, GROUP } from "@/components/app/IosList";
import { BrandTile } from "@/components/brandLogos";
import { BOX, PILL, ConnectedAs, ConnectedMark, ConnectionRow, ConnectionSheet, NeedsMark } from "@/components/settings/connectionBits";

type Provider = "followupboss" | "hubspot" | "gohighlevel";

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
 * The CRMs FollowUp works beside (A-252). Each tile is the CRM's own colour,
 * solid with white letters, like an iOS Settings row (A-273).
 */
const CRMS: { id: Provider; name: string; tile: string; bg: string; keyLabel: string; where: string }[] = [
  {
    // Option A (founder, 2026-10-16): a Private Integration key and the sub-account's Location ID, pasted once. Where
    // they live in GoHighLevel's screens is from HighLevel's own SDK docs and common setup guides; confirm with the
    // first real owner.
    id: "gohighlevel",
    name: "GoHighLevel",
    tile: "GH",
    bg: "#0d6e3c",
    keyLabel: "Private Integration key",
    where: "In GoHighLevel, Settings → Private Integrations → Create new. Let it read and write contacts, conversations and opportunities, then copy the key",
  },
  { id: "followupboss", name: "Follow Up Boss", tile: "FB", bg: "#2a5cdb", keyLabel: "API key", where: "Admin → API in Follow Up Boss" },
  {
    id: "hubspot",
    name: "HubSpot",
    tile: "Hs",
    bg: "#d9531e",
    // New HubSpot accounts can't make private apps any more; they get a service key, which FollowUp sends the
    // same way (founder's HubSpot test, 2026-10-15). An older account's private app token still works.
    keyLabel: "service key",
    where: "In HubSpot, search Settings for “service key” and create one that can read and write contacts. An older private app token works too",
  },
];
/** GoHighLevel's second box: which sub-account (src/lib/crm/gohighlevel.ts). */
const GHL_LOCATION_WHERE = "In GoHighLevel, Settings → Business Profile. It's a short code of letters and numbers";

function Tile({ text, bg, id }: { text: string; bg: string; id?: Provider }) {
  // HubSpot's own logo (A-276); GoHighLevel and Follow Up Boss keep their letters until their logo files are added.
  if (id === "hubspot") return <BrandTile brand="hubspot" />;
  return <LetterTile text={text} bg={bg} />;
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
export default function CrmConfig({ setup }: { setup?: { onConnected: (name: string, provider: Provider) => void } } = {}) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  // null: no window. "pick": which CRM. A provider: its key.
  const [step, setStep] = useState<"pick" | Provider | "connected" | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // "When they book a meeting, move them to" (A-275) and "When FollowUp sorts them" (A-303): the owner's stages there,
  // read when the window opens. `picking`: which one's list is open.
  const [stages, setStages] = useState<StageChoice | null>(null);
  const [picking, setPicking] = useState<"booked" | SortTier | null>(null);
  const now = new Date();

  async function loadStages() {
    try {
      const data = (await (await fetch("/api/crm/stages")).json()) as { success: boolean } & StageChoice;
      setStages(data.success ? data : { stages: [], chosen: null, dontMove: false });
    } catch {
      setStages({ stages: [], chosen: null, dontMove: false });
    }
  }

  async function chooseStage(stageId: string | null) {
    const which = picking ?? "booked";
    setSaving(true);
    try {
      const res = await fetch("/api/crm/stages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId, for: which }) });
      const data = (await res.json()) as { success: boolean; chosen: { id: string; name: string } | null; dontMove: boolean };
      if (data.success) {
        setStages((s) => {
          if (!s) return s;
          const choice = { chosen: data.chosen, dontMove: data.dontMove };
          return which === "booked" ? { ...s, ...choice } : { ...s, tiers: { ...(s.tiers ?? EMPTY_TIERS), [which]: choice } };
        });
      }
      setPicking(null);
    } finally {
      setSaving(false);
    }
  }

  async function setReadNotes(readNotes: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/crm/stages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readNotes }) });
      const data = (await res.json()) as { success: boolean };
      if (data.success) setStages((s) => (s ? { ...s, readNotes } : s));
    } finally {
      setSaving(false);
    }
  }

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
    if (!keyDraft.trim() || (provider === "gohighlevel" && !locationDraft.trim())) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/crm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: keyDraft.trim(), ...(provider === "gohighlevel" ? { locationId: locationDraft.trim() } : {}) }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setKeyDraft("");
        setLocationDraft("");
        await load();
        // Setup (A-272) moves on to "Connect these too"; Settings shows what is connected.
        if (setup) {
          setStep(null);
          setup.onConnected(CRMS.find((c) => c.id === provider)?.name ?? "Your CRM", provider);
        } else setStep("connected");
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
    setPicking(null);
    setStep(null);
    setSaveError(null);
    setShowAll(false);
  };
  const refused = !!config.lastSyncError && /\b(401|403)\b/.test(config.lastSyncError);

  const openKey = (id: Provider) => {
    setStep(id);
    setKeyDraft("");
    setLocationDraft("");
    setSaveError(null);
  };

  return (
    <>
      {setup ? (
        // Setup, "Do you use a CRM?" (A-272): the CRMs are the answers, one tap opens the key window.
        <div className={GROUP + " mt-5"}>
          {CRMS.map((c, i) => (
            <ListRow key={c.id} icon={<Tile text={c.tile} bg={c.bg} id={c.id} />} label={c.name} first={i === 0} onClick={() => openKey(c.id)} />
          ))}
        </div>
      ) : (
      <div className={BOX}>
        {connected && crm ? (
          <ConnectionRow
            glyph="crm"
            name={crm.name}
            sub={config.record ? `${config.record.broughtIn} customers brought in` : null}
            first
            onOpen={() => {
              setStep("connected");
              // The stage row reads the owner's own stages once, when the window first opens (A-275).
              if (config.isAdmin && !stages) void loadStages();
            }}
            mark={refused ? <NeedsMark word="New key" /> : config.writesPaused ? <span className="shrink-0 text-[15px] text-ink-faint">Paused</span> : <ConnectedMark />}
          />
        ) : (
          <ConnectionRow
            glyph="crm"
            name="Follow Up Boss, HubSpot or GoHighLevel"
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
      )}
      {!setup && !connected && !config.isAdmin && <p className="text-[14px] text-ink-soft">Only an admin can connect a CRM.</p>}

      {step === "pick" && (
        <AppWindow label="Connect your CRM" size="small" onClose={close}>
          <div className="p-6">
            <p className="ios-title3 pr-8">Which one do you use?</p>
            <div className={GROUP + " mt-4"}>
              {CRMS.map((c, i) => (
                <ListRow key={c.id} icon={<Tile text={c.tile} bg={c.bg} id={c.id} />} label={c.name} first={i === 0} onClick={() => openKey(c.id)} />
              ))}
            </div>
          </div>
        </AppWindow>
      )}

      {opening && (
        <AppWindow label={`Connect ${opening.name}`} size="small" onClose={close}>
          <div className="p-6">
            <div className="flex items-center gap-3 pr-8">
              <Tile text={opening.tile} bg={opening.bg} />
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
            {opening.id === "gohighlevel" && (
              <>
                <label htmlFor="crm-location" className="mt-5 block text-[14px] font-medium">
                  Your Location ID
                </label>
                <p className="mt-0.5 text-[13px] text-ink-faint">{GHL_LOCATION_WHERE}.</p>
                <input
                  id="crm-location"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={locationDraft}
                  onChange={(e) => setLocationDraft(e.target.value)}
                  autoFocus
                  className="mt-2 h-11 w-full rounded-[12px] border border-line bg-paper px-3 text-base"
                />
              </>
            )}
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
              autoFocus={opening.id !== "gohighlevel"}
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
                disabled={saving || !keyDraft.trim() || (opening.id === "gohighlevel" && !locationDraft.trim())}
                className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-accent disabled:opacity-60"
              >
                {saving ? "Connecting…" : `Connect ${opening.name}`}
              </button>
              <button type="button" onClick={() => (setup ? close() : setStep("pick"))} className={quietLink}>
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
          {picking && stages ? (
            <StagePicker
              crm={crm.name}
              stages={stages}
              choice={picking === "booked" ? stages : (stages.tiers?.[picking] ?? { chosen: null, dontMove: false })}
              title={picking === "booked" ? "When they book" : `When they're ${TIER_NAME[picking]}`}
              sub={picking === "booked" ? `Pick where they go in ${crm.name}.` : `Pick where they go in ${crm.name} when FollowUp marks them ${TIER_NAME[picking]}.`}
              footnote={picking === "booked" ? "FollowUp still remembers they booked, either way." : `FollowUp still marks them ${TIER_NAME[picking]} in FollowUp, either way.`}
              busy={saving}
              onBack={() => setPicking(null)}
              onChoose={chooseStage}
            />
          ) : (
          <>
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
          {config.isAdmin && <BookedStage crm={crm.name} stages={stages} onOpen={() => (stages ? setPicking("booked") : undefined)} />}
          {config.isAdmin && (
            <TierStages crm={crm.name} stages={stages} onOpen={(t) => (stages ? setPicking(t) : undefined)} onReadNotes={setReadNotes} busy={saving} />
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
          </>
          )}
        </ConnectionSheet>
      )}
    </>
  );
}

type Choice = { chosen: { id: string; name: string } | null; dontMove: boolean };
type SortTier = "ready" | "warm" | "later";
type StageChoice = Choice & {
  stages: { id: string; name: string }[];
  /** "When FollowUp sorts them" (A-303). Absent from an older server: the group waits. */
  tiers?: Record<SortTier, Choice>;
  readNotes?: boolean;
  notesAvailable?: boolean;
  /** When the CRM lists no stages: what the owner can turn on so it does. */
  stagesHelp?: string | null;
};
const EMPTY_TIERS: Record<SortTier, Choice> = { ready: { chosen: null, dontMove: false }, warm: { chosen: null, dontMove: false }, later: { chosen: null, dontMove: false } };
const TIER_NAME: Record<SortTier, string> = { ready: "Ready", warm: "Warm", later: "Later" };

/** What a stage row shows on the right. */
function stageValue(stages: StageChoice | null, choice: Choice | undefined): string {
  if (!stages || !choice) return "…";
  return choice.dontMove ? "Don't move them" : choice.chosen ? choice.chosen.name : stages.stages.length ? "Choose" : "Not available";
}

/**
 * "When they book a meeting → Move them to [stage] ›" (A-275, as drawn and approved 2026-10-17). FollowUp remembers the
 * booking either way; this is where they go in the owner's CRM.
 */
function BookedStage({ crm, stages, onOpen }: { crm: string; stages: StageChoice | null; onOpen: () => void }) {
  const value = stageValue(stages, stages ?? undefined);
  return (
    <>
      <p className="ios-footnote mt-6 px-4 uppercase tracking-[0.02em] text-ink-faint">When they book a meeting</p>
      <div className={GROUP + " mt-1.5"}>
        <ListRow label="Move them to" value={value} first onClick={stages && stages.stages.length ? onOpen : undefined} chevron={!!stages?.stages.length} />
      </div>
      <p className="ios-footnote mt-1.5 px-4 text-ink-soft">
        {stages?.stagesHelp && !stages.stages.length
          ? stages.stagesHelp
          : stages?.dontMove
          ? `FollowUp leaves them where they are in ${crm}, and remembers they booked, so it never texts them again.`
          : `FollowUp moves them there in ${crm}, and remembers it too, so it never texts them again.`}
      </p>
    </>
  );
}

/**
 * "When FollowUp sorts them" (A-303, as drawn and approved 2026-10-20): Ready, Warm and Later, each to one of the
 * owner's stages; and, where the CRM's notes can be read, "Read my notes".
 */
function TierStages({
  crm,
  stages,
  onOpen,
  onReadNotes,
  busy,
}: {
  crm: string;
  stages: StageChoice | null;
  onOpen: (tier: SortTier) => void;
  onReadNotes: (on: boolean) => void;
  busy: boolean;
}) {
  if (stages && !stages.tiers) return null;
  const tiers = stages?.tiers;
  const opens = Boolean(stages?.stages.length);
  const first = tiers?.warm.chosen?.name ?? "Nurture";
  const back = tiers?.ready.chosen?.name ?? "Ready";
  return (
    <>
      <p className="ios-footnote mt-6 px-4 uppercase tracking-[0.02em] text-ink-faint">When FollowUp sorts them</p>
      <div className={GROUP + " mt-1.5"}>
        {(["ready", "warm", "later"] as const).map((t, i) => (
          <ListRow key={t} label={TIER_NAME[t]} value={stageValue(stages, tiers?.[t])} first={i === 0} onClick={opens ? () => onOpen(t) : undefined} chevron={opens} />
        ))}
      </div>
      <p className="ios-footnote mt-1.5 px-4 text-ink-soft">
        FollowUp moves them in {crm} when what they say changes, and back again. Someone who says “in about three months” goes to {first}, and back to {back} when they&apos;re keen again.
      </p>
      {stages?.notesAvailable && (
        <>
          <div className={BOX + " mt-6 flex min-h-[56px] items-center gap-3 px-4"}>
            <span className="flex-1 text-[16px]">Read my notes</span>
            <Switch checked={stages.readNotes !== false} onChange={() => onReadNotes(stages.readNotes === false)} disabled={busy} label="Read my notes" />
          </div>
          <p className="ios-footnote mt-1.5 px-4 text-ink-soft">Like your call notes. A call that changes their plans moves them too. FollowUp never reads its own notes.</p>
        </>
      )}
    </>
  );
}

/** Their own stages, one ticked; "Don't move them" on its own. */
function StagePicker({
  crm,
  stages,
  choice,
  title,
  sub,
  footnote,
  busy,
  onBack,
  onChoose,
}: {
  crm: string;
  stages: StageChoice;
  choice: Choice;
  title: string;
  sub: string;
  footnote: string;
  busy: boolean;
  onBack: () => void;
  onChoose: (id: string | null) => void;
}) {
  const tick = <Check aria-label="Chosen" className="h-[18px] w-[18px] shrink-0 text-ink" strokeWidth={2.6} />;
  return (
    <div className="mt-2">
      <button type="button" onClick={onBack} className="ios-body inline-flex min-h-11 items-center text-ink">
        ‹ {crm}
      </button>
      <p className="ios-title3 mt-1">{title}</p>
      <p className="ios-subhead mt-1 text-ink-soft">{sub}</p>
      <p className="ios-footnote mt-6 px-4 uppercase tracking-[0.02em] text-ink-faint">Your stages</p>
      <div className={GROUP + " mt-1.5"}>
        {stages.stages.map((s, i) => (
          <ListRow
            key={s.id}
            label={s.name}
            first={i === 0}
            chevron={false}
            disabled={busy}
            onClick={() => onChoose(s.id)}
            trailing={!choice.dontMove && choice.chosen?.id === s.id ? tick : undefined}
          />
        ))}
      </div>
      <div className={GROUP + " mt-6"}>
        <ListRow label="Don't move them" first chevron={false} disabled={busy} onClick={() => onChoose(null)} trailing={choice.dontMove ? tick : undefined} />
      </div>
      <p className="ios-footnote mt-1.5 px-4 text-ink-soft">{footnote}</p>
    </div>
  );
}

