"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MarkView } from "@/lib/checkerRounds";
import { CHECK_WORDS, MARK_CHECKS, STATUS_WORDS, trustLine, type CheckTrust } from "@/lib/checkerTrust";

/**
 * Admin → Train → Mark replies (plan step 4, A-321, founder 2026-10-23: "yes build it"). The founder reads FollowUp's
 * test replies one at a time and says whether they'd send each one; FollowUp then shows, check by check, how often its
 * checker agrees. The checker's reading isn't on the page until every reply in the round is marked. Founder only, on
 * invented realtor messages: owners are never asked to grade FollowUp (R-137).
 */

const solid = "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-40";
const solidStyle = { background: "var(--accent)", color: "var(--on-accent)" };
const outline = "inline-flex min-h-11 items-center rounded-full border px-5 text-[15px] font-semibold disabled:opacity-40";
const quiet = "min-h-11 underline underline-offset-4 disabled:opacity-50";

const CHIPS = [...MARK_CHECKS, "other"] as const;

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: "Couldn't reach FollowUp. Check your connection and try again." } };
  }
}

export default function TrainMark({ trade, view, markedAt }: { trade: string; view: MarkView; markedAt: string | null }) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Replies being written from another tab, or before a reload: look again until they're there.
  useEffect(() => {
    if (view.state !== "writing") return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [view.state, router]);

  async function write() {
    setWriting(true);
    setError(null);
    const { ok, data } = await post("/api/admin/train/mark", { trade });
    setWriting(false);
    if (!ok) setError(typeof data.message === "string" ? data.message : "Something went wrong. Try again.");
    router.refresh();
  }

  if (writing || view.state === "writing") {
    return (
      <div className="mt-5 rounded-2xl border border-line bg-card p-5" role="status">
        <p className="font-semibold">Writing 60 replies…</p>
        <p className="mt-1 text-[15px] text-ink-soft">About 2 minutes. The first one shows here when they&apos;re ready.</p>
      </div>
    );
  }

  if (view.state === "marking") return <Marking key={view.reply.id} trade={trade} view={view} />;

  if (view.state === "results") return <Results trade={trade} view={view} markedAt={markedAt} onMore={write} error={error} />;

  return (
    <>
      <p className="mt-5 max-w-[62ch] text-sm text-ink-soft">
        Before a lesson reaches every business, FollowUp&apos;s checker reads each test reply. Here you read the same kind of
        replies and say what you see, and FollowUp shows how often the checker agrees with you.
      </p>
      <div className="mt-4 rounded-2xl border border-line bg-card p-5">
        <p className="font-semibold">{trade}</p>
        <p className="mt-1.5 max-w-[62ch] text-[15px]">
          FollowUp writes 3 replies to each of the 20 realtor test messages, with the lessons in use: 60 replies. You mark
          each one. It takes about 10 minutes, and you can stop and come back.
        </p>
        <div className="mt-3.5 flex flex-wrap items-center gap-3.5">
          <button type="button" onClick={write} className={solid} style={solidStyle}>
            Write 60 replies
          </button>
          <span className="text-sm text-ink-soft">About 2 minutes.</span>
        </div>
        {(error ?? (view.state === "start" ? view.error : null)) && (
          <p className="mt-3 text-sm" style={{ color: "var(--coral)" }} role="alert">
            {error ?? (view.state === "start" ? view.error : null)}
          </p>
        )}
        <p className="mt-3 text-[12.5px] text-ink-faint">Only you see this page. The messages are made up, never a real customer&apos;s.</p>
      </div>
    </>
  );
}

function Marking({ trade, view }: { trade: string; view: Extract<MarkView, { state: "marking" }> }) {
  const router = useRouter();
  const [no, setNo] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(verdict: "send" | "fix" | "skip") {
    setBusy(true);
    setError(null);
    const { ok, data } = await post("/api/admin/train/mark/reply", { id: view.reply.id, verdict, marked: verdict === "fix" ? picked : [] });
    if (!ok) {
      setBusy(false);
      setError(typeof data.message === "string" ? data.message : "Couldn't keep that. Try again.");
      return;
    }
    router.refresh();
  }

  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const progress = Math.round(((view.number - 1) / Math.max(1, view.total)) * 100);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold tabular-nums">
          Reply {view.number} of {view.total}
        </p>
        <span className="text-sm text-ink-soft">
          {trade} ·{" "}
          <Link href="/admin/train?tab=talk" className="underline underline-offset-4">
            Stop for now
          </Link>
        </span>
      </div>
      <div className="mt-1.5 h-1 rounded-sm bg-card-2" role="progressbar" aria-valuenow={view.number - 1} aria-valuemin={0} aria-valuemax={view.total} aria-label="Replies marked">
        <div className="h-1 rounded-sm" style={{ width: `${progress}%`, background: "var(--ink)" }} />
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-card p-5">
        <div>
          <p className="text-[12.5px] text-ink-faint">Customer</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-base">“{view.reply.said}”</p>
        </div>
        <div>
          <p className="text-[12.5px] text-ink-faint">FollowUp&apos;s reply</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-base">{view.reply.reply}</p>
        </div>
      </div>

      <p id="would-send" className="mt-4 text-base font-semibold">
        Would you send this as it is?
      </p>
      <div role="group" aria-labelledby="would-send" className="mt-2.5 flex flex-wrap gap-3">
        <button type="button" onClick={() => send("send")} disabled={busy} className={outline} style={{ borderColor: "var(--line-strong, var(--line))" }}>
          Yes, send it
        </button>
        <button
          type="button"
          onClick={() => setNo(true)}
          disabled={busy}
          aria-pressed={no}
          className={outline}
          style={{ borderColor: no ? "var(--ink)" : "var(--line-strong, var(--line))", background: no ? "var(--card-2)" : undefined }}
        >
          No
        </button>
      </div>

      {no && (
        <>
          <p id="whats-wrong" className="mt-4 text-[15px]">
            What&apos;s wrong with it? Pick all that fit.
          </p>
          <div role="group" aria-labelledby="whats-wrong" className="mt-2.5 flex flex-wrap gap-2">
            {CHIPS.map((k) => {
              const on = picked.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  aria-pressed={on}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm"
                  style={on ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--line)" }}
                >
                  {CHECK_WORDS[k]}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {no && (
          <button type="button" onClick={() => send("fix")} disabled={busy || picked.length === 0} className={solid} style={solidStyle}>
            Next
          </button>
        )}
        <button type="button" onClick={() => send("skip")} disabled={busy} className={`${quiet} text-[15px] text-ink-soft`}>
          Skip this one
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--coral)" }} role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-[12.5px] text-ink-faint">The checker&apos;s reading stays hidden until you finish, so it can&apos;t sway you.</p>
    </>
  );
}

const ORDER: Record<CheckTrust["status"], number> = { trusted: 0, advice: 1, too_few: 2 };

function Results({
  trade,
  view,
  markedAt,
  onMore,
  error,
}: {
  trade: string;
  view: Extract<MarkView, { state: "results" }>;
  markedAt: string | null;
  onMore: () => void;
  error: string | null;
}) {
  const [showDisagree, setShowDisagree] = useState(false);
  const trusted = view.checks.filter((c) => c.status === "trusted").length;
  const advice = view.checks.filter((c) => c.status === "advice").length;
  // Checks with something to say first, in the order trusted, advice only, too few; the rest keep their own order.
  const checks = [...view.checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const n = view.disagreements.length;
  const standing =
    trusted === 0 && advice === 0
      ? "Too few flags yet to judge any check."
      : `It's trusted on ${trusted} ${trusted === 1 ? "check" : "checks"}${advice > 0 ? ` and gives advice only on ${advice}` : ""}.`;

  return (
    <>
      <div className="mt-5 rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-[13px] text-ink-soft">
          {view.marked} {trade} {view.marked === 1 ? "reply" : "replies"} marked{markedAt ? ` · last ${markedAt}` : ""}
        </p>
        <p className="mt-2 text-[15px]">
          <strong>
            The checker agreed with you on {view.agreement.agreed} of {view.agreement.judged}.
          </strong>{" "}
          {standing}
        </p>
      </div>

      <h2 className="mt-5 text-[15px] font-semibold">Each check</h2>
      <ul className="mt-1.5">
        {checks.map((c) => (
          <li key={c.check} className="border-t border-line py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.status === "trusted" ? "var(--sage)" : "var(--ink-faint)" }} />
                {CHECK_WORDS[c.check]}
              </span>
              <span className="text-sm text-ink-soft">{STATUS_WORDS[c.status]}</span>
            </div>
            <p className="ml-4 mt-0.5 text-sm text-ink-soft">{trustLine(c)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-[62ch] text-[13.5px] text-ink-soft">
        <strong>Trusted</strong> checks count against a lesson in a test, as now. An <strong>advice only</strong> check still
        shows its reading, but a lesson isn&apos;t marked worse because of it. A check is trusted when it catches at least 8
        in 10 of what you flag and wrongly flags no more than 1 in 10 of what you pass. Under 5 flags, it&apos;s too few to
        tell and keeps counting. FollowUp&apos;s own code checks (the message rules, a fact you gave) aren&apos;t marked here.
      </p>

      <div className="mt-3.5 flex flex-wrap items-center gap-4">
        {n > 0 && (
          <button type="button" onClick={() => setShowDisagree((s) => !s)} aria-expanded={showDisagree} className={solid} style={solidStyle}>
            {showDisagree ? "Hide them" : `See the ${n} you disagreed on`}
          </button>
        )}
        <button type="button" onClick={onMore} className={`${quiet} text-[15px] text-ink-soft`}>
          Mark 60 more
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--coral)" }} role="alert">
          {error}
        </p>
      )}

      {showDisagree && (
        <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
          {view.disagreements.map((d) => (
            <li key={d.id} className="border-t border-line px-5 py-4 first:border-t-0">
              <p className="text-[12.5px] text-ink-faint">Customer</p>
              <p className="whitespace-pre-wrap break-words">“{d.said}”</p>
              <p className="mt-2 text-[12.5px] text-ink-faint">FollowUp&apos;s reply</p>
              <p className="whitespace-pre-wrap break-words">{d.reply}</p>
              <p className="mt-2 text-sm">{d.you}</p>
              <p className="text-sm text-ink-soft">{d.checker}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
