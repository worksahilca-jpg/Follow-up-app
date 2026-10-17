"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Phone } from "lucide-react";
import { BRIEF_SECTIONS, quotesOf, sectionTitle, type CallBrief } from "@/lib/callBrief";

export type CallToPrepare = {
  bookingId: string;
  leadId: string;
  /** The customer's full name and first name. */
  name: string;
  first: string;
  /** "2:00 PM", on the owner's clock. */
  time: string;
  /** Starts within the hour (or is under way): first in Today's Then; later calls follow the replies (A-283). */
  soon?: boolean;
  /** "Fri, Oct 18" when the call isn't today (the customer's page); null on Today. */
  day?: string | null;
  durationMinutes: number;
  /** Their number, for Call; null when FollowUp has none. */
  phone: string | null;
  /** The note as stored, when it is current; null to fetch it when the row opens. */
  brief: CallBrief | null;
};

/**
 * "Before your call" (A-268): what to talk about on a booked call, from the customer's own words. Up to five short
 * parts (what they want, what they asked, what's still open, what's on their mind, one next step to offer), then
 * "See their own words", which shows the message behind every line. Opened in place from Today's row, and at the top
 * of the customer's page until the call. The ink edge is the thing to do now; Call is outlined because Today's one
 * black button stays Send.
 */
export default function CallBriefCard({ call, onTheirPage = false }: { call: CallToPrepare; onTheirPage?: boolean }) {
  const { first } = call;
  const [brief, setBrief] = useState<CallBrief | null>(call.brief);
  const [state, setState] = useState<"ready" | "loading" | "none">(call.brief ? "ready" : "loading");
  const [showWords, setShowWords] = useState(false);

  const ref = useRef<HTMLElement>(null);

  // Asked when the card is on screen: a stored note shows at once and is replaced if a message came since (the server
  // writes it again only then). With nothing stored, the card says it is reading until the answer comes. On the
  // customer's page the card is there twice (phone and computer, one hidden), and only the one that shows asks.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let gone = false;
    let asked = false;
    const hadNote = Boolean(call.brief);
    const ask = () => {
      if (asked) return;
      asked = true;
      fetch(`/api/leads/${call.leadId}/call-brief?booking=${encodeURIComponent(call.bookingId)}`)
        .then((r) => r.json())
        .then((out: { success?: boolean; brief?: CallBrief | null }) => {
          if (gone) return;
          if (out.success && out.brief) {
            setBrief(out.brief);
            setState("ready");
          } else if (!hadNote) setState("none");
        })
        .catch(() => {
          if (!gone && !hadNote) setState("none");
        });
    };
    if (typeof IntersectionObserver === "undefined") {
      ask();
      return () => {
        gone = true;
      };
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        ask();
      }
    });
    io.observe(el);
    return () => {
      gone = true;
      io.disconnect();
    };
  }, [call.brief, call.bookingId, call.leadId]);

  const parts = brief ? BRIEF_SECTIONS.filter((s) => s !== "next" && brief[s].length > 0) : [];
  const next = brief?.next[0] ?? null;
  const words = brief ? quotesOf(brief) : [];
  const day = (iso: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));

  return (
    <section ref={ref} aria-label={`Before your call with ${first}`} className="box p-4 sm:p-5" style={{ borderColor: "var(--ink)" }}>
      <p className="text-[13px] text-ink-soft">Before your call</p>
      <h2 className="mt-1 text-[18px] font-semibold leading-snug tracking-[-0.01em]">
        Your call with {first} {call.day ? `on ${call.day} ` : ""}at {call.time}
      </h2>
      <p className="mt-1 text-[14px] leading-snug text-ink-soft">
        {call.durationMinutes} minutes.{" "}
        {state === "ready"
          ? `Everything below comes from your messages with ${first}.`
          : state === "loading"
            ? `Reading your messages with ${first}…`
            : `FollowUp found nothing to add yet. The chat has everything ${first} wrote.`}
      </p>

      {parts.map((s) => (
        <div key={s} className="mt-3.5 border-t border-line pt-3">
          <p className="text-[13px] font-semibold text-ink-soft">{sectionTitle(s, first)}</p>
          {brief![s].length === 1 ? (
            <p className="mt-0.5 text-[15px] leading-[1.45]">{brief![s][0].text}</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {brief![s].map((l) => (
                <li key={l.text} className="relative pl-3.5 text-[15px] leading-[1.45]">
                  <span aria-hidden="true" className="absolute left-0.5 top-[0.62em] h-[5px] w-[5px] rounded-full bg-ink-faint" />
                  {l.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {next && (
        <div className="mt-3.5 rounded-[14px] bg-card-2 px-3.5 py-3">
          <p className="text-[13px] font-semibold">{sectionTitle("next", first)}</p>
          <p className="mt-0.5 text-[15px] leading-[1.45]">{next.text}</p>
        </div>
      )}

      {words.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowWords((v) => !v)}
            aria-expanded={showWords}
            className="mt-3 flex min-h-11 w-full items-center justify-between border-t border-line text-left text-[14.5px] text-ink-soft"
          >
            {showWords ? `Hide ${first}'s own words` : `See ${first}'s own words`}
            {showWords ? <ChevronUp className="h-[18px] w-[18px]" aria-hidden="true" /> : <ChevronDown className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>
          {showWords && (
            <ul className="mt-0.5">
              {words.map((q, n) => (
                <li key={`${q.by}-${q.quote}`} className={`py-2.5 ${n === 0 ? "" : "border-t border-line"}`}>
                  <blockquote className="font-read text-[16px] leading-[1.45]">“{q.quote}”</blockquote>
                  <p className="mt-0.5 text-[12.5px] text-ink-faint">
                    {day(q.at)}
                    {q.by === "you" ? ", you wrote" : ""} · {sectionTitle(q.section, first)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {call.phone && (
          <a
            href={`tel:${call.phone}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink bg-card px-[18px] text-[15px] font-semibold text-ink hover:bg-card-2"
          >
            <Phone className="h-[17px] w-[17px]" aria-hidden="true" />
            Call {first}
          </a>
        )}
        {onTheirPage ? (
          // Already on their page: the chat is further down it.
          <a href="#conversation" className="inline-flex min-h-11 items-center text-[14.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
            Go to the chat
          </a>
        ) : (
          <Link
            href={`/leads/${call.leadId}`}
            data-nav="push"
            className="inline-flex min-h-11 items-center text-[14.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink"
          >
            Open the chat
          </Link>
        )}
      </div>
    </section>
  );
}
