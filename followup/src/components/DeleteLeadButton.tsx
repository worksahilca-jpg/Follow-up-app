"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { NOT_CUSTOMER_REASONS, REASON_LABEL, whatFollowUpWillDo, type NotCustomerReason } from "@/lib/notCustomerReasons";

/**
 * The foot of the person page: "Not a customer" and "Delete".
 *
 * "Not a customer" is the owner correcting FollowUp (founder, 2026-09-29:
 * learn from corrections). It removes the person and remembers the sender
 * for this business, so their next email is set aside without asking the
 * model, and it stays reversible from Settings → Filtered out
 * (POST /api/leads/[id]/not-customer). Shown when there is an email
 * address to remember, or an Instagram or Messenger chat to set aside
 * (A-239): that chat moves to Filtered out, and if they write again the
 * "is this a customer?" check reads them again.
 *
 * "Delete" stays the plain, permanent removal, for a duplicate or a test.
 *
 * A-259: the confirm box asks one optional question, "Who is [name]?", and
 * the line under the four answers says what FollowUp will do with it. After
 * the third answer of one kind (selling, spam), one sheet asks once whether
 * to set those aside from now on (A-073).
 */

/** "Third", "fourth": the sheet's count in words. */
function nth(n: number): string {
  return ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][n] ?? `${n}th`;
}
function inWords(n: number): string {
  return ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}
export default function DeleteLeadButton({
  leadId,
  leadName,
  leadEmail,
  dmChat = false,
}: {
  leadId: string;
  leadName: string;
  leadEmail?: string | null;
  /** An Instagram or Messenger customer with no email: "Not a customer" sets their chat aside. */
  dmChat?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<null | "not-customer" | "delete">(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<NotCustomerReason | null>(null);
  // After the third answer of one kind: { kind, count } for the sheet.
  const [ask, setAsk] = useState<{ kind: NotCustomerReason; count: number } | null>(null);
  const first = leadName.startsWith("@") ? leadName : leadName.split(/\s+/)[0] || leadName;

  function leave() {
    router.push("/leads");
    router.refresh();
  }

  async function run(kind: "not-customer" | "delete") {
    setWorking(true);
    setError(null);
    try {
      const res =
        kind === "delete"
          ? await fetch(`/api/leads/${leadId}`, { method: "DELETE" })
          : await fetch(`/api/leads/${leadId}/not-customer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "That didn't work. Try again.");
      if (kind === "not-customer" && data.ask) {
        setAsk({ kind: data.ask, count: typeof data.askCount === "number" ? data.askCount : 3 });
        return;
      }
      leave();
    } catch (err) {
      setWorking(false);
      setConfirming(null);
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
  }

  if (ask) return <AlwaysSheet kind={ask.kind} count={ask.count} onDone={leave} />;

  if (confirming === "not-customer") {
    return (
      <div className="rounded-[var(--radius-box)] border border-line bg-card p-4">
        <p className="text-[15px] leading-snug">
          {leadEmail
            ? `Not a customer? FollowUp moves ${first} out of your customers.`
            : `Not a customer? FollowUp moves ${first}'s chat out of your customers.`}
        </p>
        <fieldset className="mt-3" disabled={working}>
          <legend className="text-[15px] font-medium">Who is {first}?</legend>
          <p className="mt-0.5 text-[13px] text-ink-soft">Optional. It helps FollowUp get the next one right.</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {NOT_CUSTOMER_REASONS.map((r) => {
              const on = reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(on ? null : r)}
                  className={
                    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3 text-center text-[14px] leading-tight transition-colors " +
                    (on ? "border-ink bg-card-2 font-medium text-ink" : "border-line bg-card text-ink-soft hover:text-ink")
                  }
                  style={on ? { boxShadow: "inset 0 0 0 1px var(--ink)" } : undefined}
                >
                  {on && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
                  {REASON_LABEL[r]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <p className="mt-3 text-[14px] leading-snug" aria-live="polite">
          {whatFollowUpWillDo(reason, first, leadEmail ?? null)}
        </p>
        <p className="mt-1 text-[13px] text-ink-soft">You can bring them back any time from Settings, under Filtered out.</p>
        <div className="mt-3.5 flex gap-2">
          <button
            onClick={() => run("not-customer")}
            disabled={working}
            className="min-h-11 rounded-full px-4 text-[15px] font-medium disabled:opacity-60 lg:min-h-9 lg:text-sm"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {working ? "Removing…" : "Yes, not a customer"}
          </button>
          <button
            onClick={() => {
              setConfirming(null);
              setReason(null);
            }}
            disabled={working}
            className="min-h-11 rounded-full border border-line px-4 text-[15px] font-medium lg:min-h-9 lg:text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (confirming === "delete") {
    return (
      <div className="rounded-[var(--radius-box)] border p-4" style={{ borderColor: "var(--coral)", backgroundColor: "var(--coral-soft)" }}>
        <p className="text-sm" style={{ color: "var(--coral)" }}>
          Delete {leadName}? This removes the lead and its whole conversation history. Can&apos;t be undone.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => run("delete")}
            disabled={working}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-on-coral disabled:opacity-60"
            style={{ backgroundColor: "var(--coral-fill)" }}
          >
            {working ? "Deleting…" : "Yes, delete"}
          </button>
          <button onClick={() => setConfirming(null)} disabled={working} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {(leadEmail || dmChat) && (
          <button
            type="button"
            onClick={() => setConfirming("not-customer")}
            className="text-[14px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Not a customer
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirming("delete")}
          className="text-[14px] text-ink-faint underline underline-offset-2 hover:text-ink-soft"
        >
          Delete this customer
        </button>
      </div>
      {error && (
        <p className="text-[13px] mt-2" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "Set these aside from now on?" (A-073, A-259): once per kind, after the
 * third answer. Either answer is remembered, so it is never asked again; a
 * dismissal without an answer leaves it for the next one.
 */
function AlwaysSheet({ kind, count, onDone }: { kind: NotCustomerReason; count: number; onDone: () => void }) {
  const [saving, setSaving] = useState<null | "yes" | "no">(null);
  const [error, setError] = useState<string | null>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const what = kind === "selling" ? "as selling you something" : "as spam";

  useEffect(() => {
    yesRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  async function answer(always: boolean) {
    setSaving(always ? "yes" : "no");
    setError(null);
    try {
      const res = await fetch("/api/not-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, always }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "That didn't save. Try again.");
      onDone();
    } catch (err) {
      setSaving(null);
      setError(err instanceof Error ? err.message : "That didn't save. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center" role="presentation">
      <div className="absolute inset-0" style={{ background: "rgba(10,10,10,.32)" }} onClick={onDone} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="always-title"
        className="relative w-full max-w-[440px] rounded-t-[20px] bg-card px-5 pt-2.5 lg:rounded-[20px] lg:pt-5"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-line lg:hidden" aria-hidden="true" />
        <p id="always-title" className="title-serif text-[24px] leading-tight">
          Set these aside from now on?
        </p>
        <p className="mt-2 text-[15px] leading-snug text-ink-soft">
          That&apos;s the {nth(count)} one you marked {what}. FollowUp can set ones like these aside without asking, and
          keep them in Filtered out in case it&apos;s wrong.
        </p>
        {error && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            ref={yesRef}
            type="button"
            onClick={() => answer(true)}
            disabled={saving !== null}
            className="h-12 w-full rounded-full text-[16px] font-medium disabled:opacity-60"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {saving === "yes" ? "Saving…" : "Yes, from now on"}
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            disabled={saving !== null}
            className="h-11 w-full text-[15px] text-ink-soft underline underline-offset-2 disabled:opacity-60"
          >
            {saving === "no" ? "Saving…" : `Just these ${inWords(count)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
