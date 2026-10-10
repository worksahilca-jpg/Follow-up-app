"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import { useRouter } from "next/navigation";
import { fillPriceSlot, hasPriceSlot, slotOf } from "@/lib/priceSlot";
import type { SiteReply } from "@/lib/siteReply";
import { Eyebrow } from "./canvasBits";
import { WARM_CARD } from "./ReplyCard";

/**
 * The reply card for a customer who came through a lead site that keeps
 * their contact private (backlog b018, design brain A-075): FollowUp can't
 * press Send inside Thumbtack, HomeStars or Kijiji, so the one step it
 * can't reach comes to the owner with the words already written.
 *
 * Same warm card as ReplyCard. Desktop: Open {site}, Copy reply, and the
 * quiet I replied · Don't reply. Phone: one button that copies and opens
 * (R-015, one decision per screen). A number the site's notice showed puts
 * Call first. "I replied" is "We talked" (A-039) said as what happened:
 * one tap, no pop-up, Undo, and reminders stop until the customer writes
 * again through the site.
 */
export default function SiteReplyCard({
  leadId,
  leadName,
  site,
  draft,
  waiting,
  dense = false,
}: {
  leadId: string;
  leadName: string;
  site: SiteReply;
  /** FollowUp's written reply, or "" when nothing is drafted. */
  draft: string;
  /** True when this reply is held for the owner (it's in Today). */
  waiting: boolean;
  dense?: boolean;
}) {
  const router = useRouter();
  const first = leadName.split(" ")[0] || leadName;
  const [price, setPrice] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | "replied" | "undo" | "skip">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "replied" | "skipped">(null);

  const needsPrice = hasPriceSlot(draft);
  // A price blank or an answer blank (A-100).
  const blankTopic = needsPrice ? (slotOf(draft) as { topic?: string } | null)?.topic : undefined;
  const blankHint = blankTopic ? `your answer on ${blankTopic}` : "$ price";
  const words = needsPrice ? fillPriceSlot(draft, price.trim()) : draft;
  const canCopy = words.trim().length > 0 && !(needsPrice && !price.trim());

  async function copy(): Promise<boolean> {
    setError(null);
    try {
      await navigator.clipboard.writeText(words);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      setError("Couldn't copy. Select the words and copy them yourself.");
      return false;
    }
  }

  async function copyAndOpen() {
    // Open first, in the tap itself, so the phone doesn't block it as a pop-up.
    if (site.url) window.open(site.url, "_blank", "noopener,noreferrer");
    if (canCopy) await copy();
  }

  async function replied(undo: boolean) {
    setBusy(undo ? "undo" : "replied");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/talked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(undo ? { undo: true, onSite: true } : { onSite: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save that. Try again.");
      setDone(undo ? null : "replied");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    setBusy("skip");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/dismiss-hold`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(typeof data.message === "string" ? data.message : "Couldn't do that. Try again.");
      setDone("skipped");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't do that. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      // The card folds into what happened (A-048), once, without fanfare.
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: MOTION.move, ease: MOTION.easeOut } }}
        className="rounded-[20px] border border-line bg-card p-5"
        role="status"
      >
        {done === "skipped" ? (
          <p className="text-[15px]">Set aside. FollowUp won&apos;t remind you about this one.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 text-[15px]">
              Marked as answered. FollowUp won&apos;t remind you about {first}. If {site.name} emails you that {first} wrote
              again, they&apos;ll show up here.
            </p>
            <button
              type="button"
              onClick={() => replied(true)}
              disabled={busy !== null}
              className="h-9 shrink-0 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-60"
            >
              {busy === "undo" ? "…" : "Undo"}
            </button>
          </div>
        )}
        {error && (
          <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
      </motion.div>
    );
  }

  const soft: React.CSSProperties = { borderColor: "var(--line-strong)", background: "var(--glass)" };
  const primary: React.CSSProperties = { background: "var(--accent)", color: "var(--on-accent)" };
  const bigButton = "inline-flex h-[52px] w-full items-center justify-center rounded-full text-base font-semibold";
  const smallButton =
    "inline-flex h-[38px] items-center rounded-full px-4 text-[14px] font-semibold disabled:opacity-60" + (dense ? "" : " lg:h-10");

  return (
    <div className={"relative overflow-hidden rounded-[20px] p-5" + (dense ? " lg:rounded-[16px] lg:px-5 lg:py-[18px]" : "")} style={WARM_CARD}>
      <Eyebrow tone="reply">{site.phone ? `Call or reply on ${site.name}` : `Reply on ${site.name}`}</Eyebrow>
      <p className="mt-2 text-[15px] font-medium leading-snug">
        {site.phone ? (
          <>
            {site.name} keeps {first}&apos;s email private, but shared their number.
          </>
        ) : (
          <>
            {site.name} keeps {first}&apos;s email private
            <span className="hidden lg:inline">, so your reply goes through {site.name}</span>.
          </>
        )}
      </p>

      {draft ? (
        <>
          <p className="mt-2.5 whitespace-pre-wrap rounded-xl border px-3.5 py-3 text-[15px] leading-relaxed" style={{ background: "var(--glass-strong)", borderColor: "var(--wash-edge)" }}>
            {needsPrice ? fillPriceSlot(draft, price.trim() || blankHint) : words}
          </p>
          {needsPrice && (
            <label className="mt-2 flex items-center gap-2 text-[13px] text-ink-soft">
              {blankTopic ? "Add your answer first:" : "Add the price first:"}
              <input
                id="site-reply-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={blankHint}
                autoComplete="off"
                className={(blankTopic ? "min-w-0 flex-1 " : "w-28 ") + "h-8 rounded-md border border-dashed bg-card px-2 text-[15px] text-ink"}
                style={{ borderColor: price.trim() ? "var(--line)" : "var(--ink-soft)" }}
              />
            </label>
          )}
          <p className="mt-2 hidden text-[13px] text-ink-soft lg:block">
            FollowUp wrote this for you. Copy it, then paste it on {site.name}.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-ink-soft">Write your reply on {site.name}.</p>
      )}

      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      {/* Phone: one decision. Call (when there's a number), then copy-and-open. */}
      <div className="mt-4 flex flex-col gap-2.5 lg:hidden">
        {site.phone && (
          <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className={bigButton} style={primary}>
            Call {site.phone}
          </a>
        )}
        <button
          type="button"
          onClick={copyAndOpen}
          disabled={needsPrice && !price.trim()}
          className={bigButton + " border disabled:opacity-60"}
          style={site.phone ? soft : primary}
        >
          {copied ? "Copied" : draft ? `Copy & open ${site.name}` : `Open ${site.name}`}
        </button>
      </div>

      {/* Desktop: the actions side by side. */}
      <div className={"mt-4 hidden flex-wrap items-center gap-2.5 lg:flex" + (dense ? " lg:mt-3.5 lg:gap-2" : "")}>
        {site.phone && (
          <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className={smallButton} style={primary}>
            Call {site.phone}
          </a>
        )}
        {site.url && (
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className={smallButton + (site.phone ? " border" : "")}
            style={site.phone ? soft : primary}
          >
            Open {site.name} ↗
          </a>
        )}
        {draft && (
          <button type="button" onClick={copy} disabled={!canCopy} className={smallButton + " border"} style={soft}>
            {copied ? "Copied" : "Copy reply"}
          </button>
        )}
      </div>

      <div className="mt-1 flex justify-center gap-1 lg:mt-2 lg:justify-start">
        <button
          type="button"
          onClick={() => replied(false)}
          disabled={busy !== null}
          className="h-10 px-2 text-[15px] font-medium underline underline-offset-[3px] disabled:opacity-60 lg:text-[14px]"
        >
          {busy === "replied" ? "…" : "I replied"}
        </button>
        {waiting && (
          <button type="button" onClick={skip} disabled={busy !== null} className="h-10 px-2 text-[15px] text-ink-soft disabled:opacity-60 lg:text-[14px]">
            {busy === "skip" ? "…" : "Don't reply"}
          </button>
        )}
      </div>
    </div>
  );
}
