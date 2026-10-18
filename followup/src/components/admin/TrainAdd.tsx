"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, INDUSTRY_SHORT } from "@/lib/industries";

/**
 * /admin/train → Add a conversation (A-292). Say what kind of business it's from, paste a real conversation or open a
 * WhatsApp export, "Read it" shows it split into customer and business with names, numbers, emails, links and
 * addresses already taken out, and "Save" keeps each reply from the business as an example for businesses of that
 * kind. Nothing is kept until Save, and then only the scrubbed text.
 */

type Channel = "email" | "instagram" | "whatsapp" | "text";
type Turn = { from: "customer" | "agent"; text: string };
type Read = { speakers: string[]; agent: string | null; turns: Turn[]; examples: number };

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
];

const pill = "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-medium disabled:opacity-50";
function pillStyle(on: boolean) {
  return on
    ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" }
    : { borderColor: "var(--line-strong)" };
}

async function post(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch("/api/admin/train", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: "Couldn't reach FollowUp. Check your connection and try again." } };
  }
}

export default function TrainAdd() {
  const router = useRouter();
  const [trade, setTrade] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [raw, setRaw] = useState("");
  const [permission, setPermission] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function readIt(agent?: string | null) {
    if (!raw.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    const { ok, data } = await post({ action: "read", raw, agent: agent ?? null });
    setBusy(false);
    if (!ok) {
      setRead(null);
      setError(String(data.message ?? "FollowUp couldn't read that."));
      return;
    }
    setRead(data as unknown as Read);
  }

  async function save() {
    if (!read?.agent || !trade || !permission || busy) return;
    setBusy(true);
    setError(null);
    const { ok, data } = await post({ action: "save", raw, agent: read.agent, trade, channel, permission: true });
    setBusy(false);
    if (!ok) {
      setError(String(data.message ?? "FollowUp couldn't save that."));
      return;
    }
    setSaved(Number(data.examples ?? 0));
    setRaw("");
    setRead(null);
    setPermission(false);
    router.refresh();
  }

  async function openFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 200_000) {
      setError("That file is too big. Export one chat at a time, without media.");
      return;
    }
    setRaw(await f.text());
    setRead(null);
    setSaved(null);
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className="rounded-2xl border border-line p-5">
        <p className="text-sm text-ink-soft" id="train-trade">What kind of business</p>
        <div role="group" aria-labelledby="train-trade" className="mt-2 flex flex-wrap gap-2">
          {INDUSTRIES.map((t) => (
            <button key={t} type="button" aria-pressed={trade === t} onClick={() => setTrade(t)} className={pill} style={pillStyle(trade === t)}>
              {INDUSTRY_SHORT[t]}
            </button>
          ))}
        </div>

        <p className="mt-5 text-sm text-ink-soft" id="train-channel">Where it happened</p>
        <div role="group" aria-labelledby="train-channel" className="mt-2 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button key={c.value} type="button" aria-pressed={channel === c.value} onClick={() => setChannel(c.value)} className={pill} style={pillStyle(channel === c.value)}>
              {c.label}
            </button>
          ))}
        </div>

        <label htmlFor="train-raw" className="mt-5 block text-sm text-ink-soft">
          Paste the conversation. Each message needs a name before it, like &ldquo;Maya: Hi&rdquo;.
        </label>
        <textarea
          id="train-raw"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setRead(null);
            setSaved(null);
          }}
          rows={7}
          placeholder={"[10/18/26, 10:02 AM] Maya: Hi, is the condo still available?\n[10/18/26, 10:05 AM] Ravi: Yes it is. Are you hoping to move soon?"}
          className="mt-2 w-full rounded-xl border bg-card px-3.5 py-3 text-[15px] leading-relaxed"
          style={{ borderColor: "var(--line-strong)" }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => file.current?.click()} className="min-h-11 text-[15px] text-ink-soft underline underline-offset-4">
            Open a WhatsApp export
          </button>
          <input ref={file} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => openFile(e.target.files?.[0])} />
          <button type="button" onClick={() => readIt()} disabled={!raw.trim() || busy} className={pill} style={pillStyle(false)}>
            {busy && !read ? "Reading…" : "Read it"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        {saved !== null && (
          <p role="status" className="mt-3 text-sm">
            Saved {saved} {saved === 1 ? "example" : "examples"}. Businesses of this kind use them from the next reply on.
          </p>
        )}
      </section>

      {read && (
        <section className="rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">FollowUp read {read.turns.length} {read.turns.length === 1 ? "turn" : "turns"}</h2>
            <p className="text-sm text-ink-soft">Names, numbers, emails and links are already taken out.</p>
          </div>

          <p className="mt-4 text-sm text-ink-soft" id="train-agent">Who is the business?</p>
          <div role="group" aria-labelledby="train-agent" className="mt-2 flex flex-wrap gap-2">
            {read.speakers.map((s) => (
              <button key={s} type="button" aria-pressed={read.agent === s} disabled={busy} onClick={() => readIt(s)} className={pill} style={pillStyle(read.agent === s)}>
                {s}
              </button>
            ))}
          </div>

          <ol className="mt-4">
            {read.turns.slice(0, 40).map((t, i) => (
              <li key={i} className="flex gap-3 border-t border-line py-3 first:border-t-0">
                <span className={`w-20 shrink-0 text-sm ${t.from === "agent" ? "font-semibold" : "text-ink-soft"}`}>{t.from === "agent" ? "Business" : "Customer"}</span>
                <span className="min-w-0 whitespace-pre-wrap break-words">{t.text}</span>
              </li>
            ))}
          </ol>
          {read.turns.length > 40 && <p className="text-sm text-ink-soft">And {read.turns.length - 40} more.</p>}

          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>I have the business&apos;s permission to use this conversation to teach FollowUp.</span>
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {read.examples === 0
                ? "No reply from the business answers a customer here, so there's nothing to learn from."
                : !trade
                  ? "Pick what kind of business this is, at the top, to save."
                  : `${read.examples} ${read.examples === 1 ? "example" : "examples"}: each reply from the business that answers the customer.`}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={!permission || !trade || read.examples === 0 || busy}
              className="inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {busy ? "Saving…" : `Save ${read.examples} ${read.examples === 1 ? "example" : "examples"}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
