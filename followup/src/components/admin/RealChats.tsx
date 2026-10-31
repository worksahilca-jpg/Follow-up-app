"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanChat, endsRight, LIMITS, parseChat, splitList, type RealLine, type RealNext } from "@/lib/realChatText";

/**
 * Admin → Accuracy tests → Real chats (night plan A2, 2026-10-31): paste a real conversation a business owner agreed
 * to share, see it cleaned of names, emails, phone numbers and links, and keep it as a test case. Kept chats run as the
 * "Real conversations" row above. Only the founder sees this page.
 */

type Row = { id: string; createdAt: string; name: string; trade: string; channel: string; consent: string; lines: RealLine[] };

const field = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm";
const label = "text-sm font-medium";

function Preview({ lines }: { lines: RealLine[] }) {
  return (
    <ul className="flex flex-col gap-1.5 rounded-lg bg-card-2 px-3 py-3 text-sm">
      {lines.map((l, i) => (
        <li key={i} className="break-words whitespace-pre-wrap">
          <span className="text-ink-soft">{l.who === "in" ? "Customer: " : "Business: "}</span>
          {l.text}
        </li>
      ))}
    </ul>
  );
}

export default function RealChats({ rows, trades }: { rows: Row[]; trades: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState(trades[0] ?? "Real estate");
  const [channel, setChannel] = useState("instagram");
  const [pasted, setPasted] = useState("");
  const [customerNames, setCustomerNames] = useState("");
  const [businessNames, setBusinessNames] = useState("");
  const [task, setTask] = useState<"reply" | "followup" | "stop">("reply");
  const [daysQuiet, setDaysQuiet] = useState(3);
  const [shouldStop, setShouldStop] = useState(true);
  const [asks, setAsks] = useState("");
  const [told, setTold] = useState("");
  const [expect, setExpect] = useState("");
  const [consent, setConsent] = useState("");
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next: RealNext = task === "followup" ? { kind: "followup", daysQuiet } : task === "stop" ? { kind: "stop", shouldStop } : { kind: "reply" };
  const preview = useMemo(() => {
    if (!pasted.trim()) return null;
    const parsed = parseChat(pasted);
    if (parsed.error) return { error: parsed.error };
    const order = endsRight(parsed.lines, next);
    if (order) return { error: order };
    return { lines: cleanChat(parsed.lines, { customer: splitList(customerNames, LIMITS.names), business: splitList(businessNames, LIMITS.names) }, next) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasted, customerNames, businessNames, task, daysQuiet, shouldStop]);

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/real-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(out?.message ?? `That didn't save (error ${res.status}).`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("That didn't save. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const ok = await post({ action: "add", name, trade, channel, pasted, customerNames, businessNames, next, asks, told, expect, closing: task === "reply" && closing, consent });
    if (ok) {
      setPasted("");
      setName("");
      setAsks("");
      setTold("");
      setExpect("");
      setOpen(false);
    }
  }

  return (
    <section className="mt-12 flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold">Real chats</h2>
        <p className="text-sm text-ink-soft">
          Real conversations a business owner agreed to share, kept as tests. Names, emails, phone numbers, postal codes, links and
          @handles are taken out before anything is kept, and you see the cleaned chat first.
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="box overflow-hidden">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 border-t border-line px-5 py-3 first:border-t-0 text-sm">
              <div className="min-w-0">
                <p className="font-medium break-words">{r.name}</p>
                <p className="text-ink-soft">
                  {r.trade} · {r.channel} · {r.lines.length} messages · {r.consent}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => post({ action: "delete", id: r.id })}
                className="shrink-0 min-h-[44px] text-sm underline underline-offset-4 disabled:opacity-60"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="self-start rounded-full border border-ink px-4 min-h-[44px] text-sm font-medium">
          Add a real chat
        </button>
      ) : (
        <div className="box p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="rc-chat" className={label}>
              The chat
            </label>
            <p className="text-xs text-ink-soft">One message per line, starting with who wrote it: &quot;Customer:&quot; or &quot;Me:&quot;. Oldest first.</p>
            <textarea id="rc-chat" rows={8} className={field} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"Customer: Hi, is the condo on King still available?\nMe: Hi! Yes it is. Would you like to see it?\nCustomer: Maybe, what are the fees?"} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-cust" className={label}>
                The customer&apos;s names
              </label>
              <input id="rc-cust" className={field} value={customerNames} onChange={(e) => setCustomerNames(e.target.value)} placeholder="Priya, Priya Shah" />
              <p className="text-xs text-ink-soft">Each becomes &quot;Sam&quot;.</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-biz" className={label}>
                The business&apos;s names
              </label>
              <input id="rc-biz" className={field} value={businessNames} onChange={(e) => setBusinessNames(e.target.value)} placeholder="Raj, Raj Homes" />
              <p className="text-xs text-ink-soft">Each becomes &quot;Alex&quot;.</p>
            </div>
          </div>

          {preview && "error" in preview && preview.error && (
            <p className="text-sm" style={{ color: "var(--coral)" }}>
              {preview.error}
            </p>
          )}
          {preview && "lines" in preview && preview.lines && (
            <div className="flex flex-col gap-1">
              <p className={label}>What will be kept</p>
              <p className="text-xs text-ink-soft">Read it: a street address, a workplace or anything else private that&apos;s left, take it out above.</p>
              <Preview lines={preview.lines} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-trade" className={label}>
                Kind of business
              </label>
              <select id="rc-trade" className={field} value={trade} onChange={(e) => setTrade(e.target.value)}>
                {trades.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-channel" className={label}>
                Where
              </label>
              <select id="rc-channel" className={field} value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="instagram">Instagram</option>
                <option value="messenger">Messenger</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-task" className={label}>
                FollowUp should
              </label>
              <select id="rc-task" className={field} value={task} onChange={(e) => setTask(e.target.value as typeof task)}>
                <option value="reply">Reply to their last message</option>
                <option value="followup">Follow up after they went quiet</option>
                <option value="stop">Decide: stop or keep going</option>
              </select>
            </div>
          </div>
          {task === "followup" && (
            <div className="flex flex-col gap-1 max-w-[12rem]">
              <label htmlFor="rc-days" className={label}>
                Days quiet
              </label>
              <input id="rc-days" type="number" min={1} max={60} className={field} value={daysQuiet} onChange={(e) => setDaysQuiet(Number(e.target.value))} />
            </div>
          )}
          {task === "stop" && (
            <fieldset className="flex flex-col gap-1">
              <legend className={label}>Their last message is</legend>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="radio" name="rc-stop" checked={shouldStop} onChange={() => setShouldStop(true)} /> A no: FollowUp must stop
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="radio" name="rc-stop" checked={!shouldStop} onChange={() => setShouldStop(false)} /> Not a no: FollowUp keeps going
              </label>
            </fieldset>
          )}
          {task !== "stop" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="rc-asks" className={label}>
                  What they asked
                </label>
                <textarea id="rc-asks" rows={2} className={field} value={asks} onChange={(e) => setAsks(e.target.value)} placeholder="what the condo fees are" />
                <p className="text-xs text-ink-soft">One per line. Each must be answered, or &quot;I&apos;ll check&quot;.</p>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="rc-told" className={label}>
                  What they already told
                </label>
                <textarea id="rc-told" rows={2} className={field} value={told} onChange={(e) => setTold(e.target.value)} placeholder="a 2 bed, near the subway" />
                <p className="text-xs text-ink-soft">One per line. FollowUp must never ask for these again.</p>
              </div>
            </div>
          )}
          {task === "reply" && (
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" checked={closing} onChange={(e) => setClosing(e.target.checked)} /> They said no or have an agent: the reply must be a warm
              close, with no question
            </label>
          )}
          {task !== "stop" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-expect" className={label}>
                What a good message does here (optional)
              </label>
              <input id="rc-expect" className={field} value={expect} onChange={(e) => setExpect(e.target.value)} placeholder="Says the fees aren't known yet and offers to check, without guessing." />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-name" className={label}>
                Name of this test
              </label>
              <input id="rc-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer asks about condo fees" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rc-consent" className={label}>
                Who said it can be used
              </label>
              <input id="rc-consent" className={field} value={consent} onChange={(e) => setConsent(e.target.value)} placeholder="The realtor said OK, Nov 2" />
            </div>
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !preview || "error" in preview || !name.trim() || !consent.trim()}
              className="rounded-full bg-ink px-5 min-h-[44px] text-sm font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Keeping…" : "Keep this chat as a test"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] text-sm underline underline-offset-4">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
